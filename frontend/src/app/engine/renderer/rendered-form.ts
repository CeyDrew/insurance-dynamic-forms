import {
  computed,
  effect,
  Injector,
  signal,
  Signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { FormArray, FormControl, FormRecord } from '@angular/forms';
import { Subscription } from 'rxjs';

import { FieldDefinition, FormDefinition, RepeaterField, StepDefinition } from '../model';
import { FieldRules, FormRules, isoToday, Value } from '../rules';
import { ControlValue, fromModel, FormValues, toModel } from './field-value';
import { fieldValidators, SERVER } from './validators';

/** A field-level problem reported by the server; `field` is a path such as `drivers[0].driverName`. */
export interface FieldError {
  field: string;
  code: string;
  message: string;
}

export type FieldControl = FormControl<ControlValue>;
export type RowGroup = FormRecord<FieldControl>;
export type RepeaterControl = FormArray<RowGroup>;
export type StepGroup = FormRecord<FieldControl | RepeaterControl>;

export interface RowState {
  /** Stable key for `@for` tracking; survives removal of earlier rows. */
  readonly key: number;
  readonly group: RowGroup;
  readonly fields: readonly FieldState[];
}

export interface FieldState {
  readonly field: FieldDefinition;
  readonly rules: FieldRules;
  /** Unique DOM id prefix (repeater rows add the row key). */
  readonly domId: string;
  /** The control for input fields; `null` for computed and info fields. */
  readonly control: FieldControl | RepeaterControl | null;
  /** Repeater only. */
  readonly rows?: Signal<readonly RowState[]>;
  addRow?(): void;
  removeRow?(index: number): void;
}

export interface StepState {
  readonly step: StepDefinition;
  readonly group: StepGroup;
  readonly visible: Signal<boolean>;
  readonly fields: readonly FieldState[];
}

export interface RenderedFormOptions {
  /** Effects that keep controls in step with the rules are created in this injector. */
  injector: Injector;
  /** Model values to start from, e.g. a saved draft. Falls back to `defaultValue`. */
  initialValues?: FormValues;
  today?: () => string;
}

interface Cleanup {
  effects: { destroy(): void }[];
  subscriptions: Subscription[];
}

/**
 * Binds a form definition to Angular reactive forms. {@link FormRules} decides visibility,
 * requiredness and computed values; this class mirrors that onto controls:
 *
 * - a hidden field's value is cleared and its control disabled, so it neither validates
 *   nor appears in the form value;
 * - the required check reads the rule and is re-run whenever the rule changes;
 * - every control change is pushed back into the rule signals.
 */
export class RenderedForm {
  readonly rules: FormRules;
  readonly root = new FormRecord<StepGroup>({});
  readonly steps: readonly StepState[];
  readonly visibleSteps: Signal<readonly StepState[]>;

  private readonly injector: Injector;
  private readonly today: () => string;
  private readonly topLevel = new Map<string, FieldState>();
  private readonly cleanup: Cleanup = { effects: [], subscriptions: [] };
  private nextRowKey = 0;

  constructor(
    readonly definition: FormDefinition,
    options: RenderedFormOptions,
  ) {
    this.injector = options.injector;
    this.today = options.today ?? (() => isoToday());
    this.rules = new FormRules(definition, { today: this.today });
    const initial = options.initialValues ?? {};

    this.steps = definition.steps.map((step) => {
      const group: StepGroup = new FormRecord<FieldControl | RepeaterControl>({});
      const fields = step.fields.map((field) => {
        const state = this.buildField(field, this.rules.field(field.id), initial[field.id], field.id, this.cleanup);
        this.topLevel.set(field.id, state);
        if (state.control) {
          group.addControl(field.id, state.control);
        }
        return state;
      });
      this.root.addControl(step.id, group);
      return { step, group, visible: this.rules.stepVisible(step.id), fields };
    });
    this.visibleSteps = computed(() => this.steps.filter((s) => s.visible()));
  }

  /** Values as the definition sees them: hidden fields are null, computed fields included, info fields omitted. */
  value(): FormValues {
    const values: FormValues = {};
    for (const state of this.topLevel.values()) {
      if (state.field.type === 'info') continue;
      if (state.field.type === 'repeater') {
        values[state.field.id] = state.rules.visible()
          ? state.rows!().map((row) => this.rowValue(row, 'effective'))
          : null;
      } else {
        values[state.field.id] = state.rules.value();
      }
    }
    return values;
  }

  /** What the user entered, hidden or not; restoring it via `initialValues` rebuilds the same form. */
  draftValue(): FormValues {
    const values: FormValues = {};
    for (const state of this.topLevel.values()) {
      if (state.field.type === 'repeater') {
        values[state.field.id] = state.rows!().map((row) => this.rowValue(row, 'input'));
      } else if (state.control) {
        values[state.field.id] = this.inputValue(state);
      }
    }
    return values;
  }

  field(id: string): FieldState {
    const state = this.topLevel.get(id);
    if (!state) throw new Error(`Unknown field '${id}'`);
    return state;
  }

  /**
   * Shows errors the server found (e.g. `plate`, `drivers[0].driverName`) on their controls,
   * as a `server` error that clears on the next edit. Returns the ones no control matched.
   */
  applyServerErrors(errors: readonly FieldError[]): FieldError[] {
    const unmatched: FieldError[] = [];
    for (const error of errors) {
      const control = this.controlAt(error.field);
      if (control) {
        control.setErrors({ ...control.errors, [SERVER]: error.message });
        control.markAsTouched();
      } else {
        unmatched.push(error);
      }
    }
    return unmatched;
  }

  /** The step index (among visible steps) holding a field path, or -1. */
  stepIndexOf(path: string): number {
    const id = /^[A-Za-z_][A-Za-z0-9_]*/.exec(path)?.[0];
    return this.visibleSteps().findIndex((s) => s.fields.some((f) => f.field.id === id));
  }

  private controlAt(path: string): FieldControl | RepeaterControl | null {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)(?:\[(\d+)\]\.([A-Za-z_][A-Za-z0-9_]*))?$/.exec(path);
    const state = match ? this.topLevel.get(match[1]) : undefined;
    if (!match || !state?.control) return null;
    if (match[2] === undefined) return state.control;
    const row = state.rows?.()[Number(match[2])];
    return (row?.group.controls[match[3]] as FieldControl | undefined) ?? null;
  }

  destroy(): void {
    destroy(this.cleanup);
  }

  private buildField(
    field: FieldDefinition,
    rules: FieldRules,
    initial: unknown,
    domId: string,
    cleanup: Cleanup,
  ): FieldState {
    if (field.type === 'computed' || field.type === 'info') {
      return { field, rules, domId, control: null };
    }
    if (field.type === 'repeater') {
      return this.buildRepeater(field, rules, initial, domId, cleanup);
    }

    const control: FieldControl = new FormControl<ControlValue>(fromModel(field, initial ?? field.defaultValue), {
      validators: fieldValidators(field, () => untracked(rules.required), this.today),
    });
    const input = rules.input!;
    input.set(toModel(field, control.value));
    cleanup.subscriptions.push(control.valueChanges.subscribe((v) => input.set(toModel(field, v))));

    const state: FieldState = { field, rules, domId, control };
    this.bindRules(state, cleanup);
    return state;
  }

  private buildRepeater(
    field: RepeaterField,
    rules: FieldRules,
    initial: unknown,
    domId: string,
    cleanup: Cleanup,
  ): FieldState {
    const array: RepeaterControl = new FormArray<RowGroup>([], {
      validators: fieldValidators(field, () => untracked(rules.required), this.today),
    });
    const rows: WritableSignal<RowState[]> = signal([]);
    const rowCleanups = new Map<number, Cleanup>();
    const input = rules.input!;
    const syncInput = () =>
      input.set(rows().map((row) => this.rowValue(row, 'input')));

    const addRow = (values: FormValues = {}) => {
      const key = this.nextRowKey++;
      const rowCleanup: Cleanup = { effects: [], subscriptions: [] };
      const group: RowGroup = new FormRecord<FieldControl>({});
      const inputs: Record<string, WritableSignal<unknown>> = {};
      for (const child of field.fields) {
        if (child.type !== 'computed' && child.type !== 'info') {
          inputs[child.id] = signal<unknown>(null);
        }
      }
      const rowRules = this.rules.row(field.id, inputs);
      const fields = field.fields.map((child) => {
        const childState = this.buildField(child, rowRules.get(child.id)!, values[child.id], `${domId}-${key}-${child.id}`, rowCleanup);
        if (childState.control) {
          group.addControl(child.id, childState.control as FieldControl);
        }
        return childState;
      });
      rowCleanups.set(key, rowCleanup);
      rows.update((list) => [...list, { key, group, fields }]);
      array.push(group);
      rowCleanup.subscriptions.push(group.valueChanges.subscribe(syncInput));
      syncInput();
    };

    const removeRow = (index: number) => {
      const row = rows()[index];
      if (!row) return;
      destroy(rowCleanups.get(row.key)!);
      rowCleanups.delete(row.key);
      rows.update((list) => list.filter((_, i) => i !== index));
      array.removeAt(index);
      syncInput();
    };

    const clearRows = () => {
      rowCleanups.forEach(destroy);
      rowCleanups.clear();
      rows.set([]);
      array.clear();
      syncInput();
    };

    const initialRows = Array.isArray(initial) ? (initial as FormValues[]) : [];
    if (initialRows.length > 0) {
      initialRows.forEach((row) => addRow(row ?? {}));
    } else {
      for (let i = 0; i < this.minimumRows(field); i++) addRow();
    }
    cleanup.effects.push({ destroy: () => rowCleanups.forEach(destroy) });

    const state: FieldState = {
      field,
      rules,
      domId,
      control: array,
      rows,
      addRow: () => addRow(),
      removeRow,
    };
    this.bindRules(state, cleanup, () => {
      if (rows().length > 0) clearRows();
    }, () => {
      for (let i = rows().length; i < this.minimumRows(field); i++) addRow();
    });
    return state;
  }

  /** Rows to start with: one if the repeater is required, at least `minItems`. */
  private minimumRows(field: RepeaterField): number {
    const minItems = field.validators?.find((v) => v.type === 'minItems')?.value ?? 0;
    return Math.max(field.required ? 1 : 0, minItems);
  }

  /** Keeps a control's enabled state, value and validity in step with the field's rules. */
  private bindRules(state: FieldState, cleanup: Cleanup, clear?: () => void, restore?: () => void): void {
    const control = state.control!;
    const { field, rules } = state;
    let wasVisible: boolean | null = null;
    const ref = effect(
      () => {
        const visible = rules.visible();
        const disabled = rules.disabled();
        rules.required();
        untracked(() => {
          if (!visible) {
            if (clear) clear();
            else if (control.value !== null && !isEmptyArray(control.value)) {
              (control as FieldControl).setValue(fromModel(field, null));
            }
            control.disable({ emitEvent: false });
          } else {
            if (wasVisible === false) {
              // A field that appears was not answered yet: no error until the user gets to it.
              control.markAsUntouched();
              if (restore) restore();
              else if ('defaultValue' in field && field.defaultValue !== undefined && control.value === null) {
                (control as FieldControl).setValue(fromModel(field, field.defaultValue));
              }
            }
            if (disabled) control.disable({ emitEvent: false });
            else control.enable({ emitEvent: false });
            control.updateValueAndValidity();
          }
          wasVisible = visible;
        });
      },
      { injector: this.injector },
    );
    cleanup.effects.push(ref);
  }

  private inputValue(state: FieldState): Value {
    return toModel(state.field, (state.control as FieldControl).getRawValue());
  }

  /** `effective`: what rules see (hidden = null, computed included); `input`: what the user entered. */
  private rowValue(row: RowState, mode: 'effective' | 'input'): FormValues {
    const values: FormValues = {};
    for (const child of row.fields) {
      if (mode === 'effective' && child.field.type !== 'info') {
        values[child.field.id] = child.rules.value();
      } else if (mode === 'input' && child.control) {
        values[child.field.id] = this.inputValue(child);
      }
    }
    return values;
  }
}

function isEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length === 0;
}

function destroy(cleanup: Cleanup): void {
  cleanup.effects.forEach((ref) => ref.destroy());
  cleanup.subscriptions.forEach((sub) => sub.unsubscribe());
  cleanup.effects.length = 0;
  cleanup.subscriptions.length = 0;
}
