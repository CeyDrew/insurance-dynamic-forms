/**
 * Form definition model. Mirrors `docs/form-definition-spec.md` and the Java
 * `com.portfolio.forms.schema` package; keep the three in step.
 */

/** A rule expression, e.g. `hasLpg == true`. Syntax: `docs/rule-language.md`. */
export type Expression = string;

/** `YYYY-MM-DD`. */
export type IsoDate = string;

export interface FormDefinition {
  id: string;
  version: number;
  title: string;
  description?: string;
  steps: StepDefinition[];
}

export interface StepDefinition {
  id: string;
  title: string;
  description?: string;
  visibleWhen?: Expression;
  fields: FieldDefinition[];
}

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'currency',
  'date',
  'boolean',
  'select',
  'multiselect',
  'radio',
  'repeater',
  'computed',
  'info',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export const VALIDATOR_TYPES = [
  'minLength',
  'maxLength',
  'pattern',
  'min',
  'max',
  'minDate',
  'maxDate',
  'minItems',
  'maxItems',
] as const;

export type ValidatorType = (typeof VALIDATOR_TYPES)[number];

export interface LengthValidator {
  type: 'minLength' | 'maxLength';
  value: number;
  message?: string;
}

export interface PatternValidator {
  type: 'pattern';
  value: string;
  message?: string;
}

export interface RangeValidator {
  type: 'min' | 'max';
  value: number;
  message?: string;
}

export interface DateValidator {
  type: 'minDate' | 'maxDate';
  value: IsoDate | 'today';
  message?: string;
}

export interface ItemCountValidator {
  type: 'minItems' | 'maxItems';
  value: number;
  message?: string;
}

export type ValidatorDefinition =
  | LengthValidator
  | PatternValidator
  | RangeValidator
  | DateValidator
  | ItemCountValidator;

export interface OptionDefinition {
  value: string;
  label: string;
}

export interface OptionsSource {
  type: 'remote';
  /** In-app path starting with `/`; returns `OptionDefinition[]`. */
  url: string;
}

/** Keys every field type has. */
interface FieldBase<T extends FieldType> {
  id: string;
  type: T;
  label: string;
  hint?: string;
  placeholder?: string;
  visibleWhen?: Expression;
}

/** Keys of fields the user fills in (everything except `computed` and `info`). */
interface InputFieldBase<T extends FieldType, V, R extends ValidatorDefinition = never>
  extends FieldBase<T> {
  required?: boolean;
  requiredWhen?: Expression;
  disabledWhen?: Expression;
  defaultValue?: V;
  validators?: R[];
}

type TextValidator = LengthValidator | PatternValidator;

export interface TextField extends InputFieldBase<'text', string, TextValidator> {}

export interface TextareaField extends InputFieldBase<'textarea', string, TextValidator> {
  rows?: number;
}

export interface NumberField extends InputFieldBase<'number', number, RangeValidator> {
  decimals?: number;
}

export interface CurrencyField extends InputFieldBase<'currency', number, RangeValidator> {
  /** ISO 4217, default `TRY`. */
  currency?: string;
}

export interface DateField extends InputFieldBase<'date', IsoDate, DateValidator> {}

export interface BooleanField extends InputFieldBase<'boolean', boolean> {}

/** Exactly one of `options` / `optionsSource`. */
type OptionsOrSource =
  | { options: OptionDefinition[]; optionsSource?: never }
  | { options?: never; optionsSource: OptionsSource };

export type SelectField = InputFieldBase<'select', string> & OptionsOrSource;

export type MultiselectField = InputFieldBase<'multiselect', string[], ItemCountValidator> &
  OptionsOrSource;

export interface RadioField extends InputFieldBase<'radio', string> {
  options: OptionDefinition[];
}

/** Fields allowed inside a repeater row: anything but another repeater. */
export type RepeaterItemField = Exclude<FieldDefinition, RepeaterField>;

export interface RepeaterField
  extends InputFieldBase<'repeater', Record<string, unknown>[], ItemCountValidator> {
  fields: RepeaterItemField[];
  itemLabel?: string;
  addLabel?: string;
}

export interface ComputedField extends FieldBase<'computed'> {
  expression: Expression;
  format?: 'number' | 'currency' | 'text';
}

export interface InfoField extends FieldBase<'info'> {
  content: string;
}

export type FieldDefinition =
  | TextField
  | TextareaField
  | NumberField
  | CurrencyField
  | DateField
  | BooleanField
  | SelectField
  | MultiselectField
  | RadioField
  | RepeaterField
  | ComputedField
  | InfoField;

/** Narrow a field by its `type`. */
export type FieldOfType<T extends FieldType> = Extract<FieldDefinition, { type: T }>;

type FieldKeys = { [T in FieldType]: readonly (keyof FieldOfType<T>)[] };

const BASE_KEYS = ['id', 'type', 'label', 'hint', 'placeholder', 'visibleWhen'] as const;
const INPUT_KEYS = [
  ...BASE_KEYS,
  'required',
  'requiredWhen',
  'disabledWhen',
  'defaultValue',
  'validators',
] as const;

/** Every key each field type accepts, at runtime. */
export const FIELD_KEYS = {
  text: INPUT_KEYS,
  textarea: [...INPUT_KEYS, 'rows'],
  number: [...INPUT_KEYS, 'decimals'],
  currency: [...INPUT_KEYS, 'currency'],
  date: INPUT_KEYS,
  boolean: INPUT_KEYS,
  select: [...INPUT_KEYS, 'options', 'optionsSource'],
  multiselect: [...INPUT_KEYS, 'options', 'optionsSource'],
  radio: [...INPUT_KEYS, 'options'],
  repeater: [...INPUT_KEYS, 'fields', 'itemLabel', 'addLabel'],
  computed: [...BASE_KEYS, 'expression', 'format'],
  info: [...BASE_KEYS, 'content'],
} as const satisfies FieldKeys;

// Compile-time guard: FIELD_KEYS lists every key of every field interface.
type MissingKeys = {
  [T in FieldType]: Exclude<keyof FieldOfType<T>, (typeof FIELD_KEYS)[T][number]>;
}[FieldType];
const fieldKeysComplete: [MissingKeys] extends [never] ? true : MissingKeys = true;
void fieldKeysComplete;

/** Error returned by `POST /api/definitions/validate`. */
export interface DefinitionError {
  path: string;
  code: DefinitionErrorCode;
  message: string;
}

export type DefinitionErrorCode =
  | 'INVALID_JSON'
  | 'UNKNOWN_PROPERTY'
  | 'INVALID_VALUE'
  | 'REQUIRED'
  | 'INVALID_ID'
  | 'DUPLICATE_ID'
  | 'PROPERTY_NOT_ALLOWED'
  | 'CONFLICTING_PROPERTIES'
  | 'DUPLICATE_OPTION'
  | 'INVALID_VALIDATOR'
  | 'EXPRESSION_SYNTAX'
  | 'UNKNOWN_REFERENCE'
  | 'INVALID_REFERENCE'
  | 'UNKNOWN_FUNCTION'
  | 'CIRCULAR_DEPENDENCY';

export interface DefinitionValidationReport {
  valid: boolean;
  errors: DefinitionError[];
}
