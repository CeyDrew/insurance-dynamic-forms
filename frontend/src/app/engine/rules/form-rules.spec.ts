import { signal } from '@angular/core';

import casco from '../../../../../examples/casco.json';
import { FormDefinition } from '../model';
import { FormRules, RuleKind } from './form-rules';

const TODAY = '2026-03-15';

function cascoRules() {
  const evaluations: string[] = [];
  const rules = new FormRules(casco as unknown as FormDefinition, {
    today: () => TODAY,
    trace: (id: string, rule: RuleKind) => evaluations.push(`${id}.${rule}`),
  });
  return { rules, evaluations };
}

describe('FormRules', () => {
  it('shows a field only while its condition holds', () => {
    const { rules } = cascoRules();
    const hasLpg = rules.field('hasLpg');

    expect(hasLpg.visible()).toBe(false);
    rules.setValue('fuelType', 'gasoline');
    expect(hasLpg.visible()).toBe(true);
    rules.setValue('fuelType', 'diesel');
    expect(hasLpg.visible()).toBe(false);
  });

  it('reads a hidden field as null, so dependent rules follow', () => {
    const { rules } = cascoRules();
    rules.setValue('fuelType', 'gasoline');
    rules.setValue('hasLpg', true);
    expect(rules.field('lpgBrand').visible()).toBe(true);
    expect(rules.field('lpgBrand').required()).toBe(true);

    // hasLpg keeps its input but becomes hidden, so lpgBrand disappears too.
    rules.setValue('fuelType', 'diesel');

    expect(rules.field('hasLpg').input!()).toBe(true);
    expect(rules.field('hasLpg').value()).toBeNull();
    expect(rules.field('lpgBrand').visible()).toBe(false);
    expect(rules.field('lpgBrand').required()).toBe(false);
  });

  it('starts from default values', () => {
    const { rules } = cascoRules();

    expect(rules.field('usageType').value()).toBe('private');
  });

  it('computes values from other fields', () => {
    const { rules } = cascoRules();
    const vehicleAge = rules.field('vehicleAge');

    expect(vehicleAge.value()).toBeNull();
    rules.setValue('modelYear', 2018);
    expect(vehicleAge.value()).toBe(8);
    expect(vehicleAge.disabled()).toBe(true);
  });

  it('re-evaluates only the rules that read the changed field', () => {
    const { rules, evaluations } = cascoRules();
    const lpgVisible = rules.field('lpgBrand').visible;
    const vehicleAge = rules.field('vehicleAge').value;
    lpgVisible();
    vehicleAge();
    evaluations.length = 0;

    rules.setValue('plate', '34ABC123');
    lpgVisible();
    vehicleAge();
    expect(evaluations).toEqual([]);

    rules.setValue('modelYear', 2020);
    lpgVisible();
    vehicleAge();
    expect(evaluations).toEqual(['vehicleAge.expression']);
  });

  it('does not depend on the branch that short-circuit skipped', () => {
    const rules = new FormRules(
      {
        id: 'f',
        version: 1,
        title: 'F',
        steps: [
          {
            id: 's',
            title: 'S',
            fields: [
              { id: 'a', type: 'boolean', label: 'A' },
              { id: 'b', type: 'boolean', label: 'B' },
              { id: 'c', type: 'text', label: 'C', visibleWhen: 'a && b' },
            ],
          },
        ],
      },
      { trace: (id, rule) => evaluations.push(`${id}.${rule}`) },
    );
    const evaluations: string[] = [];
    const visible = rules.field('c').visible;
    visible();
    evaluations.length = 0;

    rules.setValue('b', true); // `a` is false, so `b` was never read
    visible();

    expect(evaluations).toEqual([]);
  });

  it('applies requiredWhen and step visibility', () => {
    const rules = new FormRules(
      {
        id: 'f',
        version: 1,
        title: 'F',
        steps: [
          {
            id: 'first',
            title: '1',
            fields: [
              { id: 'smoker', type: 'boolean', label: 'Sigara' },
              { id: 'perDay', type: 'number', label: 'Adet', requiredWhen: 'smoker == true' },
            ],
          },
          {
            id: 'second',
            title: '2',
            visibleWhen: 'smoker == true',
            fields: [{ id: 'years', type: 'number', label: 'Yıl', required: true }],
          },
        ],
      },
      { today: () => TODAY },
    );

    expect(rules.field('perDay').required()).toBe(false);
    expect(rules.stepVisible('second')()).toBe(false);
    expect(rules.field('years').required()).toBe(false); // hidden fields are never required

    rules.setValue('smoker', true);

    expect(rules.field('perDay').required()).toBe(true);
    expect(rules.stepVisible('second')()).toBe(true);
    expect(rules.field('years').required()).toBe(true);
  });

  it('evaluates repeater rows in their own scope', () => {
    const { rules } = cascoRules();
    rules.setValue('drivers', [{}, {}]);
    const young = rules.row('drivers', { driverBirthDate: signal<unknown>('2005-06-01') });
    const older = rules.row('drivers', { driverBirthDate: signal<unknown>('1980-01-01') });

    expect(young.get('driverAge')!.value()).toBe(20);
    expect(young.get('youngDriverNote')!.visible()).toBe(true);
    expect(older.get('driverAge')!.value()).toBe(46);
    expect(older.get('youngDriverNote')!.visible()).toBe(false);

    young.get('driverBirthDate')!.input!.set('1990-01-01');
    expect(young.get('youngDriverNote')!.visible()).toBe(false);
  });

  it('builds rules for every example without errors', async () => {
    const examples = await Promise.all([
      import('../../../../../examples/casco.json'),
      import('../../../../../examples/home.json'),
      import('../../../../../examples/health.json'),
      import('../../../../../examples/travel.json'),
    ]);
    for (const example of examples) {
      const definition = example.default as unknown as FormDefinition;
      const rules = new FormRules(definition, { today: () => TODAY });
      for (const step of definition.steps) {
        for (const field of step.fields) {
          expect(() => [rules.field(field.id).visible(), rules.field(field.id).value()]).not.toThrow();
        }
      }
    }
  });

  it('reports which rule of which field is invalid', () => {
    const broken = {
      id: 'f',
      version: 1,
      title: 'F',
      steps: [{ id: 's', title: 'S', fields: [{ id: 'a', type: 'text', label: 'A', visibleWhen: 'x =' }] }],
    } as FormDefinition;

    expect(() => new FormRules(broken)).toThrow("Invalid visibleWhen of 'a': '=' yerine '==' kullanın");
  });
});
