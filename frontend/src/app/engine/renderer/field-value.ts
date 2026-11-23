import { FieldDefinition } from '../model';
import { parseDate } from '../rules/functions';
import { Value } from '../rules';

/**
 * What a form control holds. Same as the definition's value types except dates,
 * which the datepicker edits as `Date` and the model stores as `YYYY-MM-DD`.
 */
export type ControlValue = string | number | boolean | Date | string[] | null;

/** Field id -> value in the definition's terms; repeater values are arrays of such rows. */
export type FormValues = Record<string, Value>;

/** Control value -> model value (what rules and the submission see). */
export function toModel(field: FieldDefinition, value: ControlValue | undefined): Value {
  if (value === undefined || value === null) {
    return null;
  }
  if (field.type === 'date') {
    return value instanceof Date && !Number.isNaN(value.getTime()) ? toIsoDate(value) : null;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  return value as Value;
}

/** Model value -> control value. */
export function fromModel(field: FieldDefinition, value: unknown): ControlValue {
  if (value === undefined || value === null) {
    return field.type === 'multiselect' ? [] : null;
  }
  if (field.type === 'date') {
    return fromIsoDate(value);
  }
  return value as ControlValue;
}

export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Local midnight of a `YYYY-MM-DD` string, or `null` if it is not a valid date. */
export function fromIsoDate(value: unknown): Date | null {
  const parts = parseDate(value as Value);
  return parts ? new Date(parts[0], parts[1] - 1, parts[2]) : null;
}

export function isEmptyValue(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  );
}
