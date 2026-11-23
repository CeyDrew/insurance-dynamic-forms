import casco from '../../../../../examples/casco.json';
import health from '../../../../../examples/health.json';
import home from '../../../../../examples/home.json';
import travel from '../../../../../examples/travel.json';
import {
  FIELD_KEYS,
  FIELD_TYPES,
  FieldDefinition,
  FieldType,
  FormDefinition,
  VALIDATOR_TYPES,
} from './form-definition';

const FORM_KEYS = ['id', 'version', 'title', 'description', 'steps'];
const STEP_KEYS = ['id', 'title', 'description', 'visibleWhen', 'fields'];

/** Returns every key/type that the TypeScript model would not accept, with its path. */
function modelMismatches(form: Record<string, unknown>): string[] {
  const problems: string[] = [];
  const unknownKeys = (obj: object, allowed: readonly string[], path: string) =>
    Object.keys(obj)
      .filter((key) => !allowed.includes(key))
      .forEach((key) => problems.push(`${path}.${key}`));

  const checkField = (field: Record<string, unknown>, path: string) => {
    const type = field['type'] as FieldType;
    if (!FIELD_TYPES.includes(type)) {
      problems.push(`${path}.type=${String(type)}`);
      return;
    }
    unknownKeys(field, FIELD_KEYS[type], path);
    ((field['validators'] ?? []) as { type: string }[]).forEach((v, i) => {
      if (!(VALIDATOR_TYPES as readonly string[]).includes(v.type)) {
        problems.push(`${path}.validators[${i}].type=${v.type}`);
      }
    });
    ((field['fields'] ?? []) as Record<string, unknown>[]).forEach((child, i) =>
      checkField(child, `${path}.fields[${i}]`),
    );
  };

  unknownKeys(form, FORM_KEYS, '');
  (form['steps'] as Record<string, unknown>[]).forEach((step, s) => {
    unknownKeys(step, STEP_KEYS, `steps[${s}]`);
    (step['fields'] as Record<string, unknown>[]).forEach((field, f) =>
      checkField(field, `steps[${s}].fields[${f}]`),
    );
  });
  return problems;
}

describe('form definition model', () => {
  it.each([
    ['casco', casco],
    ['health', health],
    ['home', home],
    ['travel', travel],
  ])('%s example fits the TypeScript model', (_name, json) => {
    expect(modelMismatches(json)).toEqual([]);
  });

  it('reports keys the model does not know', () => {
    const broken = {
      id: 'x',
      version: 1,
      title: 'X',
      steps: [
        {
          id: 's',
          title: 'S',
          fields: [
            { id: 'a', type: 'text', label: 'A', rows: 3 },
            { id: 'b', type: 'slider', label: 'B' },
          ],
        },
      ],
    };

    expect(modelMismatches(broken)).toEqual(['steps[0].fields[0].rows', 'steps[0].fields[1].type=slider']);
  });

  it('accepts a typed definition with every field type', () => {
    const form = {
      id: 'all-types',
      version: 1,
      title: 'Tüm tipler',
      steps: [
        {
          id: 'main',
          title: 'Adım',
          fields: [
            { id: 'a', type: 'text', label: 'A', validators: [{ type: 'pattern', value: '^x$' }] },
            { id: 'b', type: 'textarea', label: 'B', rows: 3 },
            { id: 'c', type: 'number', label: 'C', decimals: 1, validators: [{ type: 'min', value: 0 }] },
            { id: 'd', type: 'currency', label: 'D', currency: 'TRY' },
            { id: 'e', type: 'date', label: 'E', validators: [{ type: 'maxDate', value: 'today' }] },
            { id: 'f', type: 'boolean', label: 'F', defaultValue: false },
            { id: 'g', type: 'select', label: 'G', optionsSource: { type: 'remote', url: '/api/x' } },
            { id: 'h', type: 'multiselect', label: 'H', options: [{ value: '1', label: 'Bir' }] },
            {
              id: 'i',
              type: 'radio',
              label: 'I',
              options: [
                { value: 'y', label: 'Evet' },
                { value: 'n', label: 'Hayır' },
              ],
            },
            {
              id: 'j',
              type: 'repeater',
              label: 'J',
              fields: [{ id: 'k', type: 'text', label: 'K' }],
              validators: [{ type: 'maxItems', value: 3 }],
            },
            { id: 'l', type: 'computed', label: 'L', expression: 'c * 2' },
            { id: 'm', type: 'info', label: 'M', content: 'Bilgi' },
          ],
        },
      ],
    } satisfies FormDefinition;

    const types = form.steps[0].fields.map((f: FieldDefinition) => f.type);
    expect(new Set(types)).toEqual(new Set(FIELD_TYPES));
  });
});
