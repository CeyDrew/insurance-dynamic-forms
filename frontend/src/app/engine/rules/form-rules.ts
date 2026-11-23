import { computed, Signal, signal, WritableSignal } from '@angular/core';

import { FieldDefinition, FormDefinition, RepeaterField } from '../model';
import { compileExpression, CompiledExpression, isoToday } from './expression';
import { isTruthy, Value } from './value';

export type RuleKind = 'visibleWhen' | 'requiredWhen' | 'disabledWhen' | 'expression';

export interface FormRulesOptions {
  /** Today as `YYYY-MM-DD`; injectable for tests. Defaults to the local date. */
  today?: () => string;
  /** Called every time a rule is (re)evaluated. For tests and debugging. */
  trace?: (fieldId: string, rule: RuleKind) => void;
}

/** Reactive state of one field. */
export interface FieldRules {
  readonly field: FieldDefinition;
  /** What the user entered; `null` for computed and info fields. */
  readonly input: WritableSignal<unknown> | null;
  /** Value other rules see: the input (or computed result), or `null` while hidden. */
  readonly value: Signal<Value>;
  readonly visible: Signal<boolean>;
  readonly required: Signal<boolean>;
  readonly disabled: Signal<boolean>;
}

/** Name lookup for expressions; a repeater row scope falls back to the form scope. */
class Scope {
  private readonly entries = new Map<string, Signal<Value>>();

  constructor(private readonly parent: Scope | null = null) {}

  define(name: string, value: Signal<Value>): void {
    this.entries.set(name, value);
  }

  read(name: string): Value {
    const entry = this.entries.get(name);
    if (entry) {
      return entry();
    }
    return this.parent ? this.parent.read(name) : null;
  }
}

/**
 * Turns a form definition into signals. Every rule is a `computed()` that reads field
 * values through signals, so Angular tracks the dependency graph: changing a field only
 * re-evaluates the rules that actually read it.
 */
export class FormRules {
  private readonly scope = new Scope();
  private readonly fields = new Map<string, FieldRules>();
  private readonly steps = new Map<string, Signal<boolean>>();
  private readonly compiled = new Map<string, CompiledExpression>();
  private readonly today: () => string;
  private readonly trace: (fieldId: string, rule: RuleKind) => void;

  constructor(
    readonly definition: FormDefinition,
    options: FormRulesOptions = {},
  ) {
    this.today = options.today ?? (() => isoToday());
    this.trace = options.trace ?? (() => undefined);

    for (const step of definition.steps) {
      const stepVisible = this.condition(step.visibleWhen, step.id, 'visibleWhen', this.scope, true);
      this.steps.set(step.id, stepVisible);
      for (const field of step.fields) {
        this.fields.set(field.id, this.buildField(field, this.scope, stepVisible));
      }
    }
  }

  field(id: string): FieldRules {
    const rules = this.fields.get(id);
    if (!rules) {
      throw new Error(`Unknown field '${id}'`);
    }
    return rules;
  }

  stepVisible(id: string): Signal<boolean> {
    const visible = this.steps.get(id);
    if (!visible) {
      throw new Error(`Unknown step '${id}'`);
    }
    return visible;
  }

  setValue(id: string, value: unknown): void {
    const input = this.field(id).input;
    if (!input) {
      throw new Error(`Field '${id}' is not an input`);
    }
    input.set(value);
  }

  /**
   * Rules for one row of a repeater. Row fields see their siblings first, then form fields.
   * `inputs` lets the caller own the row's value signals (e.g. bound to a FormArray row).
   */
  row(repeaterId: string, inputs: Record<string, WritableSignal<unknown>> = {}): Map<string, FieldRules> {
    const repeater = this.field(repeaterId);
    if (repeater.field.type !== 'repeater') {
      throw new Error(`Field '${repeaterId}' is not a repeater`);
    }
    const rowScope = new Scope(this.scope);
    const rules = new Map<string, FieldRules>();
    for (const child of (repeater.field as RepeaterField).fields) {
      rules.set(child.id, this.buildField(child, rowScope, repeater.visible, inputs[child.id]));
    }
    return rules;
  }

  private buildField(
    field: FieldDefinition,
    scope: Scope,
    parentVisible: Signal<boolean>,
    ownInput?: WritableSignal<unknown>,
  ): FieldRules {
    const visibleRule = this.condition(field.visibleWhen, field.id, 'visibleWhen', scope, true);
    const visible = computed(() => parentVisible() && visibleRule());

    let input: WritableSignal<unknown> | null = null;
    let raw: Signal<Value>;
    if (field.type === 'computed') {
      const expression = this.compile(field.expression, field.id, 'expression');
      raw = computed(() => {
        this.trace(field.id, 'expression');
        return expression.evaluate({ read: (name) => scope.read(name), today: this.today() });
      });
    } else if (field.type === 'info') {
      raw = signal(null);
    } else {
      input = ownInput ?? signal<unknown>(field.defaultValue ?? (field.type === 'repeater' ? [] : null));
      const source = input;
      raw = computed(() => (source() ?? null) as Value);
    }

    const value = computed(() => (visible() ? raw() : null));
    scope.define(field.id, value);

    const isInput = field.type !== 'computed' && field.type !== 'info';
    const requiredRule =
      isInput && !field.required
        ? this.condition(field.requiredWhen, field.id, 'requiredWhen', scope, false)
        : null;
    const alwaysRequired = isInput && field.required === true;
    const required = computed(() => visible() && (alwaysRequired || (requiredRule?.() ?? false)));
    const disabled = isInput
      ? this.condition(field.disabledWhen, field.id, 'disabledWhen', scope, false)
      : computed(() => true);

    return { field, input, value, visible, required, disabled };
  }

  /** A boolean rule; `fallback` when the definition does not set one. */
  private condition(
    source: string | undefined,
    ownerId: string,
    rule: RuleKind,
    scope: Scope,
    fallback: boolean,
  ): Signal<boolean> {
    if (source === undefined) {
      return computed(() => fallback);
    }
    const expression = this.compile(source, ownerId, rule);
    return computed(() => {
      this.trace(ownerId, rule);
      return isTruthy(expression.evaluate({ read: (name) => scope.read(name), today: this.today() }));
    });
  }

  private compile(source: string, ownerId: string, rule: RuleKind): CompiledExpression {
    const key = `${ownerId}.${rule}`;
    let expression = this.compiled.get(key);
    if (!expression) {
      try {
        expression = compileExpression(source);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid ${rule} of '${ownerId}': ${reason}`, { cause: error });
      }
      this.compiled.set(key, expression);
    }
    return expression;
  }
}
