import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { FieldDefinition, ValidatorDefinition, ValidatorType } from '../model';
import { fromIsoDate, isEmptyValue } from './field-value';

/** Error key of the dynamic required check. Other keys are the definition's validator types. */
export const REQUIRED = 'required';

/**
 * Validators for one field. `isRequired` is read on every run, so the caller re-runs
 * validation when a `requiredWhen` rule changes.
 */
export function fieldValidators(
  field: FieldDefinition,
  isRequired: () => boolean,
  today: () => string,
): ValidatorFn[] {
  const validators: ValidatorFn[] = [
    (control) => (isRequired() && isEmptyValue(control.value) ? { [REQUIRED]: true } : null),
  ];
  const definitions = ('validators' in field ? field.validators : undefined) ?? [];
  for (const definition of definitions as ValidatorDefinition[]) {
    validators.push(definitionValidator(definition, today));
  }
  return validators;
}

function definitionValidator(definition: ValidatorDefinition, today: () => string): ValidatorFn {
  const fail = (details: object): ValidationErrors => ({ [definition.type]: details });
  switch (definition.type) {
    case 'minLength':
    case 'maxLength': {
      const limit = definition.value;
      return (control) => {
        const v = control.value;
        if (typeof v !== 'string' || v === '') return null;
        const ok = definition.type === 'minLength' ? v.length >= limit : v.length <= limit;
        return ok ? null : fail({ limit, actual: v.length });
      };
    }
    case 'pattern': {
      const regex = new RegExp(`^(?:${definition.value})$`);
      return (control) => {
        const v = control.value;
        return typeof v !== 'string' || v === '' || regex.test(v) ? null : fail({ pattern: definition.value });
      };
    }
    case 'min':
    case 'max': {
      const limit = definition.value;
      return (control) => {
        const v = control.value;
        if (typeof v !== 'number' || Number.isNaN(v)) return null;
        const ok = definition.type === 'min' ? v >= limit : v <= limit;
        return ok ? null : fail({ limit, actual: v });
      };
    }
    case 'minDate':
    case 'maxDate':
      return (control) => {
        const v = control.value;
        const bound = fromIsoDate(definition.value === 'today' ? today() : definition.value);
        if (!(v instanceof Date) || Number.isNaN(v.getTime()) || !bound) return null;
        const ok = definition.type === 'minDate' ? v >= bound : v <= bound;
        return ok ? null : fail({ limit: bound });
      };
    case 'minItems':
    case 'maxItems': {
      const limit = definition.value;
      return (control) => {
        const v = control.value;
        if (!Array.isArray(v)) return null;
        // An empty optional list is the required check's business, not minItems'.
        if (definition.type === 'minItems' && v.length === 0) return null;
        const ok = definition.type === 'minItems' ? v.length >= limit : v.length <= limit;
        return ok ? null : fail({ limit, actual: v.length });
      };
    }
  }
}

const dateText = (date: unknown) =>
  date instanceof Date ? new Intl.DateTimeFormat('tr-TR').format(date) : String(date);

const DEFAULT_MESSAGES: Record<ValidatorType | typeof REQUIRED, (details: Record<string, unknown>) => string> = {
  required: () => 'Bu alan zorunlu',
  minLength: (d) => `En az ${d['limit']} karakter olmalı`,
  maxLength: (d) => `En fazla ${d['limit']} karakter olabilir`,
  pattern: () => 'Geçersiz biçim',
  min: (d) => `En az ${d['limit']} olmalı`,
  max: (d) => `En fazla ${d['limit']} olabilir`,
  minDate: (d) => `${dateText(d['limit'])} veya sonrası olmalı`,
  maxDate: (d) => `${dateText(d['limit'])} veya öncesi olmalı`,
  minItems: (d) => `En az ${d['limit']} seçim yapılmalı`,
  maxItems: (d) => `En fazla ${d['limit']} seçim yapılabilir`,
};

const REPEATER_MESSAGES: Partial<typeof DEFAULT_MESSAGES> = {
  required: () => 'En az bir satır eklenmeli',
  minItems: (d) => `En az ${d['limit']} satır olmalı`,
  maxItems: (d) => `En fazla ${d['limit']} satır eklenebilir`,
};

/** The message for the control's first error: the definition's `message`, or a Turkish default. */
export function errorMessage(field: FieldDefinition, control: AbstractControl): string | null {
  const errors = control.errors;
  if (!errors) {
    return null;
  }
  const key = Object.keys(errors)[0] as ValidatorType | typeof REQUIRED;
  const custom = ('validators' in field ? (field.validators as ValidatorDefinition[] | undefined) : undefined)?.find(
    (v) => v.type === key,
  )?.message;
  if (custom) {
    return custom;
  }
  const messages: Record<string, (details: Record<string, unknown>) => string> = {
    ...DEFAULT_MESSAGES,
    ...(field.type === 'repeater' ? REPEATER_MESSAGES : {}),
    // Raised by the Material datepicker input when the typed text is not a date.
    matDatepickerParse: () => 'Geçerli bir tarih girin (GG.AA.YYYY)',
  };
  return (messages[key] ?? (() => 'Geçersiz değer'))(errors[key] as Record<string, unknown>);
}
