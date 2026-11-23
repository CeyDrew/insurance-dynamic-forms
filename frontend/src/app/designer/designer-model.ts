import { FieldDefinition, FieldType, FormDefinition, RepeaterField, StepDefinition } from '../engine/model';
import { tokenize } from '../engine/rules';

/**
 * Pure, immutable operations on a form definition for the designer. Every function returns a
 * new definition and leaves its input untouched, which is what makes undo/redo a plain stack.
 */

/** Where a field sits: in a step, or in a repeater's row template when `repeaterId` is set. */
export interface FieldLocation {
  stepIndex: number;
  repeaterId?: string;
  index: number;
}

export const FIELD_LABELS: Record<FieldType, string> = {
  text: 'Metin',
  textarea: 'Uzun metin',
  number: 'Sayı',
  currency: 'Tutar',
  date: 'Tarih',
  boolean: 'Evet / Hayır',
  select: 'Açılır liste',
  multiselect: 'Çoklu seçim',
  radio: 'Tek seçim',
  repeater: 'Tekrarlanan grup',
  computed: 'Hesaplanan değer',
  info: 'Bilgi notu',
};

const RULE_KEYS = ['visibleWhen', 'requiredWhen', 'disabledWhen', 'expression'] as const;

export function blankDefinition(): FormDefinition {
  return {
    id: 'yeni-form',
    version: 1,
    title: 'Yeni Form',
    steps: [{ id: 'step1', title: 'Adım 1', fields: [] }],
  };
}

/** Every step and field id in use, including repeater children. */
export function allIds(definition: FormDefinition): Set<string> {
  const ids = new Set<string>();
  for (const step of definition.steps) {
    ids.add(step.id);
    for (const field of step.fields) {
      ids.add(field.id);
      if (field.type === 'repeater') field.fields.forEach((child) => ids.add(child.id));
    }
  }
  return ids;
}

/** `prefix1`, `prefix2`, … : the first one not taken. */
export function uniqueId(prefix: string, taken: Set<string>): string {
  let n = 1;
  while (taken.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** A new field of `type` with sensible defaults, so it is valid as soon as it is dropped. */
export function newField(type: FieldType, taken: Set<string>): FieldDefinition {
  const id = uniqueId(type, taken);
  const label = FIELD_LABELS[type];
  const options = [
    { value: 'secenek1', label: 'Seçenek 1' },
    { value: 'secenek2', label: 'Seçenek 2' },
  ];
  switch (type) {
    case 'select':
    case 'multiselect':
    case 'radio':
      return { id, type, label, options } as FieldDefinition;
    case 'repeater': {
      const child = newField('text', new Set([...taken, id]));
      return { id, type, label, itemLabel: 'Satır', addLabel: 'Satır ekle', fields: [child as RepeaterField['fields'][number]] };
    }
    case 'computed':
      return { id, type, label, expression: '0' };
    case 'info':
      return { id, type, label, content: 'Açıklama metni' };
    default:
      return { id, type, label } as FieldDefinition;
  }
}

export function findField(definition: FormDefinition, id: string): FieldDefinition | undefined {
  const location = locate(definition, id);
  return location ? fieldsAt(definition, location)[location.index] : undefined;
}

/** Location of a field, or `undefined`. */
export function locate(definition: FormDefinition, id: string): FieldLocation | undefined {
  for (let stepIndex = 0; stepIndex < definition.steps.length; stepIndex++) {
    const fields = definition.steps[stepIndex].fields;
    for (let index = 0; index < fields.length; index++) {
      const field = fields[index];
      if (field.id === id) return { stepIndex, index };
      if (field.type === 'repeater') {
        const childIndex = field.fields.findIndex((c) => c.id === id);
        if (childIndex >= 0) return { stepIndex, repeaterId: field.id, index: childIndex };
      }
    }
  }
  return undefined;
}

/** The repeater containing a field, if any. */
export function parentRepeater(definition: FormDefinition, id: string): RepeaterField | undefined {
  const location = locate(definition, id);
  return location?.repeaterId ? (findField(definition, location.repeaterId) as RepeaterField) : undefined;
}

export function insertField(definition: FormDefinition, at: FieldLocation, field: FieldDefinition): FormDefinition {
  if (at.repeaterId && field.type === 'repeater') {
    return definition; // nested repeaters are not supported
  }
  return withFields(definition, at, (fields) => {
    const copy = [...fields];
    copy.splice(clamp(at.index, 0, copy.length), 0, field);
    return copy;
  });
}

export function removeField(definition: FormDefinition, id: string): FormDefinition {
  const location = locate(definition, id);
  if (!location) return definition;
  return withFields(definition, location, (fields) => fields.filter((f) => f.id !== id));
}

/** Moves a field, within its list or to another step or repeater. */
export function moveField(definition: FormDefinition, id: string, to: FieldLocation): FormDefinition {
  const from = locate(definition, id);
  const field = findField(definition, id);
  if (!from || !field || (to.repeaterId && field.type === 'repeater') || to.repeaterId === id) {
    return definition;
  }
  // `to.index` is the final position, as CDK's drop index is: remove first, then insert there.
  return insertField(removeField(definition, id), to, field);
}

/**
 * Replaces keys of a field. A key set to `undefined` or `''` is removed, so the saved JSON only
 * has keys that mean something (empty keys would be flagged by the definition validator).
 */
export function updateField(definition: FormDefinition, id: string, patch: Record<string, unknown>): FormDefinition {
  const location = locate(definition, id);
  if (!location) return definition;
  return withFields(definition, location, (fields) =>
    fields.map((f) => (f.id === id ? (clean({ ...f, ...patch }) as unknown as FieldDefinition) : f)),
  );
}

/** Renames a field and every expression that reads it. */
export function renameField(definition: FormDefinition, oldId: string, newId: string): FormDefinition {
  if (oldId === newId || !locate(definition, oldId) || allIds(definition).has(newId)) return definition;
  const renamed = updateField(definition, oldId, { id: newId });
  return mapRules(renamed, (expression) => renameInExpression(expression, oldId, newId));
}

/** Replaces the variable `oldName` in an expression; leaves strings, function names and invalid text alone. */
export function renameInExpression(expression: string, oldName: string, newName: string): string {
  let tokens;
  try {
    tokens = tokenize(expression);
  } catch {
    return expression;
  }
  let result = '';
  let last = 0;
  tokens.forEach((token, i) => {
    const next = tokens[i + 1];
    const isCall = next?.type === 'operator' && next.text === '(';
    if (token.type === 'identifier' && token.text === oldName && !isCall) {
      result += expression.slice(last, token.offset) + newName;
      last = token.offset + token.text.length;
    }
  });
  return result + expression.slice(last);
}

/**
 * Field ids an expression owned by `ownerId` (a field, a step, or nothing for the form) may read:
 * every top-level field, plus row siblings for a field inside a repeater. Info fields hold no
 * value; the owner itself and, for a step, its own fields are left out, matching the backend's
 * reference rules.
 */
export function expressionNames(definition: FormDefinition, owner: { fieldId?: string; stepId?: string }): string[] {
  const names: string[] = [];
  for (const step of definition.steps) {
    if (owner.stepId && step.id === owner.stepId) continue;
    for (const field of step.fields) {
      if (field.type !== 'info') names.push(field.id);
    }
  }
  const repeater = owner.fieldId ? parentRepeater(definition, owner.fieldId) : undefined;
  repeater?.fields.forEach((child) => child.type !== 'info' && names.push(child.id));
  return names.filter((name) => name !== owner.fieldId);
}

// ---- steps ------------------------------------------------------------------------

export function addStep(definition: FormDefinition, index = definition.steps.length): FormDefinition {
  const id = uniqueId('step', allIds(definition));
  const steps = [...definition.steps];
  steps.splice(index, 0, { id, title: `Adım ${steps.length + 1}`, fields: [] });
  return { ...definition, steps };
}

export function removeStep(definition: FormDefinition, stepId: string): FormDefinition {
  if (definition.steps.length <= 1) return definition;
  return { ...definition, steps: definition.steps.filter((s) => s.id !== stepId) };
}

export function moveStep(definition: FormDefinition, from: number, to: number): FormDefinition {
  const steps = [...definition.steps];
  const [step] = steps.splice(from, 1);
  steps.splice(clamp(to, 0, steps.length), 0, step);
  return { ...definition, steps };
}

export function updateStep(definition: FormDefinition, stepId: string, patch: Partial<StepDefinition>): FormDefinition {
  let renamedTo: string | undefined;
  const steps = definition.steps.map((step) => {
    if (step.id !== stepId) return step;
    if (patch.id && patch.id !== stepId) renamedTo = patch.id;
    return clean({ ...step, ...patch }) as unknown as StepDefinition;
  });
  if (renamedTo && allIds(definition).has(renamedTo)) return definition;
  return { ...definition, steps };
}

export function updateForm(definition: FormDefinition, patch: Partial<FormDefinition>): FormDefinition {
  return clean({ ...definition, ...patch }) as unknown as FormDefinition;
}

// ---- helpers ------------------------------------------------------------------------

function withFields(
  definition: FormDefinition,
  at: { stepIndex: number; repeaterId?: string },
  change: (fields: FieldDefinition[]) => FieldDefinition[],
): FormDefinition {
  const steps = definition.steps.map((step, i) => {
    if (i !== at.stepIndex) return step;
    if (!at.repeaterId) return { ...step, fields: change(step.fields) };
    return {
      ...step,
      fields: step.fields.map((f) =>
        f.id === at.repeaterId && f.type === 'repeater'
          ? { ...f, fields: change(f.fields) as RepeaterField['fields'] }
          : f,
      ),
    };
  });
  return { ...definition, steps };
}

function fieldsAt(definition: FormDefinition, at: FieldLocation): FieldDefinition[] {
  const fields = definition.steps[at.stepIndex]?.fields ?? [];
  if (!at.repeaterId) return fields;
  const repeater = fields.find((f) => f.id === at.repeaterId);
  return repeater?.type === 'repeater' ? repeater.fields : [];
}

function mapRules(definition: FormDefinition, map: (expression: string) => string): FormDefinition {
  const mapField = (field: FieldDefinition): FieldDefinition => {
    const copy: Record<string, unknown> = { ...field };
    for (const key of RULE_KEYS) {
      if (typeof copy[key] === 'string') copy[key] = map(copy[key] as string);
    }
    if (field.type === 'repeater') copy['fields'] = field.fields.map(mapField);
    return copy as unknown as FieldDefinition;
  };
  return {
    ...definition,
    steps: definition.steps.map((step) => ({
      ...step,
      ...(step.visibleWhen !== undefined ? { visibleWhen: map(step.visibleWhen) } : {}),
      fields: step.fields.map(mapField),
    })),
  };
}

function clean<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  ) as T;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
