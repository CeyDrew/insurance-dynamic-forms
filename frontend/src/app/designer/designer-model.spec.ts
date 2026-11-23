import casco from '../../../../examples/casco.json';
import { FormDefinition, RepeaterField } from '../engine/model';
import {
  addStep,
  allIds,
  blankDefinition,
  findField,
  insertField,
  locate,
  moveField,
  newField,
  removeField,
  removeStep,
  renameField,
  renameInExpression,
  updateField,
  updateStep,
} from './designer-model';

const cascoDef = casco as unknown as FormDefinition;
const ids = (def: FormDefinition, step = 0) => def.steps[step].fields.map((f) => f.id);

describe('designer model', () => {
  it('creates fields with unique ids and valid defaults', () => {
    const taken = allIds(cascoDef);
    const select = newField('select', taken);
    const repeater = newField('repeater', new Set([...taken, select.id])) as RepeaterField;

    expect(select).toMatchObject({ id: 'select1', type: 'select', label: 'Açılır liste' });
    expect('options' in select && select.options?.length).toBe(2);
    expect(repeater.id).toBe('repeater1');
    expect(repeater.fields[0].id).toBe('text1');
  });

  it('inserts, moves within a step, across steps and into a repeater', () => {
    let def = blankDefinition();
    def = addStep(def);
    def = insertField(def, { stepIndex: 0, index: 0 }, newField('text', allIds(def)));
    def = insertField(def, { stepIndex: 0, index: 1 }, newField('number', allIds(def)));
    def = insertField(def, { stepIndex: 0, index: 2 }, newField('repeater', allIds(def)));
    expect(ids(def)).toEqual(['text1', 'number1', 'repeater1']);

    def = moveField(def, 'number1', { stepIndex: 0, index: 0 });
    expect(ids(def)).toEqual(['number1', 'text1', 'repeater1']);

    def = moveField(def, 'text1', { stepIndex: 1, index: 0 });
    expect(ids(def)).toEqual(['number1', 'repeater1']);
    expect(ids(def, 1)).toEqual(['text1']);

    def = moveField(def, 'number1', { stepIndex: 0, repeaterId: 'repeater1', index: 0 });
    expect(locate(def, 'number1')).toEqual({ stepIndex: 0, repeaterId: 'repeater1', index: 0 });
  });

  it('refuses to put a repeater inside a repeater', () => {
    let def = insertField(blankDefinition(), { stepIndex: 0, index: 0 }, newField('repeater', new Set()));
    const before = def;
    def = insertField(def, { stepIndex: 0, repeaterId: 'repeater1', index: 0 }, newField('repeater', allIds(def)));

    expect(def).toBe(before);
  });

  it('never mutates its input', () => {
    const def = structuredClone(cascoDef);
    const snapshot = JSON.stringify(def);

    removeField(moveField(updateField(def, 'plate', { label: 'X' }), 'hasLpg', { stepIndex: 2, index: 0 }), 'brand');

    expect(JSON.stringify(def)).toBe(snapshot);
  });

  it('drops keys that are cleared', () => {
    const def = updateField(cascoDef, 'plate', { hint: '', placeholder: undefined, required: undefined });
    const plate = findField(def, 'plate')!;

    expect('hint' in plate).toBe(false);
    expect('placeholder' in plate).toBe(false);
    expect('required' in plate).toBe(false);
  });

  it('renames a field and every rule that reads it', () => {
    const def = renameField(cascoDef, 'hasLpg', 'lpgInstalled');

    expect(findField(def, 'lpgInstalled')).toBeDefined();
    expect(findField(def, 'lpgBrand')).toMatchObject({
      visibleWhen: 'lpgInstalled == true',
      requiredWhen: 'lpgInstalled == true',
    });
  });

  it('does not rename into a taken id', () => {
    expect(renameField(cascoDef, 'hasLpg', 'plate')).toBe(cascoDef);
  });

  it('renames only variables, not strings or function names', () => {
    expect(renameInExpression("age(age) > age && name == 'age'", 'age', 'years')).toBe(
      "age(years) > years && name == 'age'",
    );
    expect(renameInExpression('age >', 'age', 'years')).toBe('years >');
    expect(renameInExpression("age == 'open", 'age', 'years')).toBe("age == 'open"); // unreadable: untouched
  });

  it('keeps at least one step and refuses duplicate step ids', () => {
    expect(removeStep(blankDefinition(), 'step1').steps.length).toBe(1);
    expect(updateStep(cascoDef, 'vehicle', { id: 'plate' })).toBe(cascoDef);
    expect(updateStep(cascoDef, 'vehicle', { title: 'Araç' }).steps[0].title).toBe('Araç');
  });
});
