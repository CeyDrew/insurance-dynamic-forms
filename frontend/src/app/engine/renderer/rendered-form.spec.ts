import { Injector } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import casco from '../../../../../examples/casco.json';
import health from '../../../../../examples/health.json';
import home from '../../../../../examples/home.json';
import travel from '../../../../../examples/travel.json';
import { FormDefinition } from '../model';
import { FormValues } from './field-value';
import { FieldControl, RenderedForm, RepeaterControl } from './rendered-form';

const TODAY = '2026-03-15';

function render(definition: unknown, initialValues?: FormValues): RenderedForm {
  const form = new RenderedForm(definition as FormDefinition, {
    injector: TestBed.inject(Injector),
    today: () => TODAY,
    initialValues,
  });
  TestBed.tick();
  return form;
}

function control(form: RenderedForm, id: string): FieldControl {
  return form.field(id).control as FieldControl;
}

/** Sets a control the way a user would, then lets the rule effects run. */
function set(form: RenderedForm, id: string, value: unknown): void {
  control(form, id).setValue(value as never);
  control(form, id).markAsTouched();
  TestBed.tick();
}

/** Complete, valid answers for each example: the phase 3 "done" criterion. */
const ANSWERS: [string, unknown, FormValues][] = [
  [
    'casco',
    casco,
    {
      plate: '34ABC123',
      brand: 'toyota',
      modelYear: 2019,
      usageType: 'private',
      fuelType: 'gasoline',
      hasLpg: true,
      lpgBrand: 'brc',
      vehicleValue: 850000,
      drivers: [{ driverName: 'Ayşe Yılmaz', driverBirthDate: '1990-05-20', licenseYear: 2010 }],
      hadClaims: true,
      claimCount: 1,
      previousInsurer: 'axa',
      previousPolicyNo: 'P-123',
      coverageType: 'full',
      extras: ['glass', 'replacementCar'],
      startDate: '2026-04-01',
      notes: null,
    },
  ],
  [
    'home',
    home,
    {
      city: '35',
      district: 'Karşıyaka',
      fullAddress: 'Atatürk Cad. No: 12 Daire 4',
      uavtCode: '1234567890',
      ownership: 'owner',
      constructionType: 'steelReinforced',
      constructionYear: 2005,
      totalFloors: 6,
      floor: 3,
      grossArea: 120,
      hasDask: true,
      daskPolicyNo: '123456789',
      buildingValue: 2500000,
      contentsValue: 400000,
      valuables: [{ valuableName: 'Piyano', valuableValue: 120000 }],
      securityMeasures: ['steelDoor', 'alarm'],
      uninhabitedMonths: 0,
    },
  ],
  [
    'health',
    health,
    {
      nationalId: '12345678901',
      fullName: 'Mehmet Demir',
      birthDate: '1985-11-02',
      gender: 'male',
      hasSgk: true,
      heightCm: 180,
      weightKg: 82.5,
      smoker: false,
      chronicConditions: ['none'],
      hadSurgery: true,
      surgeries: [{ surgeryName: 'Apandisit', surgeryDate: '2022-06-10', surgeryHospital: null }],
      planType: 'inOutpatient',
      outpatientVisits: '10',
      declarationAccepted: true,
    },
  ],
  [
    'travel',
    travel,
    {
      region: 'schengen',
      countries: ['IT', 'FR'],
      purpose: 'tourism',
      departureDate: '2026-07-01',
      returnDate: '2026-07-10',
      winterSports: false,
      travelers: [
        { travelerName: 'AYSE YILMAZ', passportNo: 'U12345678', travelerBirthDate: '1990-05-20' },
        { travelerName: 'ALI YILMAZ', passportNo: 'U87654321', travelerBirthDate: '2015-01-10' },
      ],
      coverageLimit: '50000',
      cancellationCover: true,
      tripCost: 2400,
      email: 'ayse@example.com',
    },
  ],
];

describe('RenderedForm', () => {
  describe.each(ANSWERS)('%s example', (_name, definition, answers) => {
    it('becomes valid once filled in completely', () => {
      const empty = render(definition);
      expect(empty.root.valid).toBe(false);

      const form = render(definition, answers);

      const invalid = form.steps.flatMap((s) =>
        s.fields.filter((f) => f.control?.invalid).map((f) => `${f.field.id}: ${JSON.stringify(f.control!.errors)}`),
      );
      expect(invalid).toEqual([]);
      expect(form.root.valid).toBe(true);
    });

    it('round-trips its draft', () => {
      const form = render(definition, answers);

      const restored = render(definition, form.draftValue());

      expect(restored.value()).toEqual(form.value());
    });
  });

  it('submits effective values: computed included, hidden null, info omitted', () => {
    const form = render(casco, ANSWERS[0][2]);

    const value = form.value();

    expect(value['vehicleAge']).toBe(7);
    expect(value['driversInfo']).toBeUndefined();
    expect(value['drivers']).toEqual([
      { driverName: 'Ayşe Yılmaz', driverBirthDate: '1990-05-20', driverAge: 35, licenseYear: 2010 },
    ]);
  });

  it('clears and disables a field when it is hidden', () => {
    const form = render(casco);
    set(form, 'fuelType', 'gasoline');
    set(form, 'hasLpg', true);
    set(form, 'lpgBrand', 'brc');
    expect(control(form, 'lpgBrand').enabled).toBe(true);

    set(form, 'fuelType', 'diesel');

    expect(control(form, 'hasLpg').disabled).toBe(true);
    expect(control(form, 'hasLpg').value).toBeNull();
    expect(control(form, 'lpgBrand').disabled).toBe(true);
    expect(control(form, 'lpgBrand').value).toBeNull();
    expect(form.value()['lpgBrand']).toBeNull();
  });

  it('does not show errors on a field the moment it appears', () => {
    const form = render(casco);
    form.root.markAllAsTouched(); // user pressed "İleri" while lpgBrand was hidden
    set(form, 'fuelType', 'gasoline');

    set(form, 'hasLpg', true);

    expect(control(form, 'lpgBrand').invalid).toBe(true);
    expect(control(form, 'lpgBrand').touched).toBe(false);
  });

  it('restores the default value when a hidden field is shown again', () => {
    const form = render(casco);
    set(form, 'fuelType', 'gasoline');
    expect(control(form, 'hasLpg').value).toBe(false);
    set(form, 'fuelType', 'diesel');
    expect(control(form, 'hasLpg').value).toBeNull();

    set(form, 'fuelType', 'gasoline');

    expect(control(form, 'hasLpg').value).toBe(false);
  });

  it('requires a field only while requiredWhen holds', () => {
    const form = render(health);
    set(form, 'smoker', false);
    expect(control(form, 'cigarettesPerDay').disabled).toBe(true);

    set(form, 'smoker', true);

    expect(control(form, 'cigarettesPerDay').hasError('required')).toBe(true);
    set(form, 'cigarettesPerDay', 10);
    expect(control(form, 'cigarettesPerDay').valid).toBe(true);
  });

  it('checks definition validators', () => {
    const form = render(casco);

    set(form, 'plate', '99XYZ1');
    expect(control(form, 'plate').errors).toEqual({ pattern: expect.anything() });
    set(form, 'modelYear', 1970);
    expect(control(form, 'modelYear').errors).toEqual({ min: { limit: 1980, actual: 1970 } });
    set(form, 'startDate', new Date(2026, 2, 14));
    expect(control(form, 'startDate').errors).toEqual({ minDate: expect.anything() });
    set(form, 'startDate', new Date(2026, 2, 15));
    expect(control(form, 'startDate').valid).toBe(true);
  });

  it('adds and removes repeater rows, each with its own rules', () => {
    const form = render(casco);
    const drivers = form.field('drivers');
    expect(drivers.rows!().length).toBe(1); // required repeater starts with one row

    drivers.addRow!();
    TestBed.tick();
    const [first, second] = drivers.rows!();
    (first.group.controls['driverBirthDate'] as FieldControl).setValue(new Date(2005, 0, 1));
    (second.group.controls['driverBirthDate'] as FieldControl).setValue(new Date(1980, 0, 1));
    TestBed.tick();

    expect(first.fields.find((f) => f.field.id === 'youngDriverNote')!.rules.visible()).toBe(true);
    expect(second.fields.find((f) => f.field.id === 'youngDriverNote')!.rules.visible()).toBe(false);

    drivers.removeRow!(0);
    TestBed.tick();

    expect(drivers.rows!().map((r) => r.key)).toEqual([second.key]);
    expect((drivers.control as RepeaterControl).length).toBe(1);
  });

  it('feeds repeater rows to rules as a list', () => {
    const form = render(travel);
    const travelers = form.field('travelers');
    expect(form.rules.field('travelerCount').value()).toBe(1);

    travelers.addRow!();
    travelers.addRow!();
    TestBed.tick();

    expect(form.rules.field('travelerCount').value()).toBe(3);
  });

  it('enforces repeater item limits', () => {
    const form = render(casco);
    const drivers = form.field('drivers');
    for (let i = 0; i < 5; i++) drivers.addRow!();
    TestBed.tick();

    expect(drivers.control!.errors).toEqual({ maxItems: { limit: 5, actual: 6 } });
  });

  it('removes a hidden step from the flow and its fields from validation', () => {
    const form = render({
      id: 'f',
      version: 1,
      title: 'F',
      steps: [
        { id: 'one', title: '1', fields: [{ id: 'smoker', type: 'boolean', label: 'S', required: true }] },
        {
          id: 'two',
          title: '2',
          visibleWhen: 'smoker == true',
          fields: [{ id: 'years', type: 'number', label: 'Y', required: true }],
        },
      ],
    });
    set(form, 'smoker', false);

    expect(form.visibleSteps().map((s) => s.step.id)).toEqual(['one']);
    expect(form.root.valid).toBe(true);

    set(form, 'smoker', true);

    expect(form.visibleSteps().map((s) => s.step.id)).toEqual(['one', 'two']);
    expect(form.root.valid).toBe(false);
  });

  it('stores dates as YYYY-MM-DD in the model and Date in the control', () => {
    const form = render(health, { birthDate: '1985-11-02' });

    expect(control(form, 'birthDate').value).toEqual(new Date(1985, 10, 2));
    expect(form.value()['birthDate']).toBe('1985-11-02');
    expect(form.value()['insuredAge']).toBe(40);
  });
});
