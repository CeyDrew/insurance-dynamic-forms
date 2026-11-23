import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatRadioGroupHarness } from '@angular/material/radio/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatStepperHarness } from '@angular/material/stepper/testing';

import casco from '../../../../../examples/casco.json';
import { FormDefinition } from '../model';
import { FormValues } from './field-value';
import { FormDraft, FormRendererComponent, FormSubmission } from './form-renderer';

const TODAY = '2026-03-15';
const LOOKUP = [
  { value: 'toyota', label: 'Toyota' },
  { value: 'brc', label: 'BRC' },
  { value: 'axa', label: 'AXA Sigorta' },
];

const CASCO_ANSWERS: FormValues = {
  plate: '34ABC123',
  brand: 'toyota',
  modelYear: 2019,
  usageType: 'private',
  fuelType: 'diesel',
  vehicleValue: 850000,
  drivers: [{ driverName: 'Ayşe Yılmaz', driverBirthDate: '1990-05-20', licenseYear: 2010 }],
  hadClaims: false,
  coverageType: 'limited',
  startDate: '2026-04-01',
};

describe('FormRendererComponent', () => {
  let fixture: ComponentFixture<FormRendererComponent>;
  let loader: HarnessLoader;
  let http: HttpTestingController;
  let submissions: FormSubmission[];
  let drafts: FormDraft[];

  async function create(draft: FormDraft | null = null) {
    fixture = TestBed.createComponent(FormRendererComponent);
    fixture.componentRef.setInput('definition', casco as unknown as FormDefinition);
    fixture.componentRef.setInput('draft', draft);
    fixture.componentRef.setInput('today', () => TODAY);
    submissions = [];
    drafts = [];
    fixture.componentInstance.submitted.subscribe((s) => submissions.push(s));
    fixture.componentInstance.draftChange.subscribe((d) => drafts.push(d));
    loader = TestbedHarnessEnvironment.loader(fixture);
    await settle();
  }

  /** Renders, answers pending lookup requests and lets effects and change detection finish. */
  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    http.match(() => true).forEach((request) => request.flush(LOOKUP));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FormRendererComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('renders the steps and the first step fields', async () => {
    await create();
    const stepper = await loader.getHarness(MatStepperHarness);
    const steps = await stepper.getSteps();

    expect(await Promise.all(steps.map((s) => s.getLabel()))).toEqual([
      'Araç Bilgileri',
      'Sürücüler',
      'Hasar Geçmişi',
      'Teminat',
    ]);
    expect(await (await loader.getHarness(MatInputHarness.with({ selector: '#plate' }))).getPlaceholder()).toBe(
      '34ABC123',
    );
  });

  it('keeps the user on a step with errors and describes them accessibly', async () => {
    await create();

    await (await loader.getHarness(MatButtonHarness.with({ text: /İleri/ }))).click();
    await settle();

    const stepper = await loader.getHarness(MatStepperHarness);
    expect(await (await stepper.getSteps({ selected: true }))[0].getLabel()).toBe('Araç Bilgileri');
    const plate = el().querySelector<HTMLInputElement>('#plate')!;
    expect(plate.getAttribute('aria-required')).toBe('true');
    const describedBy = plate.getAttribute('aria-describedby')!.split(' ');
    const messages = describedBy.map((id) => el().querySelector(`[id="${id}"]`)?.textContent?.trim());
    expect(messages).toContain('Bu alan zorunlu');

    const usage = el().querySelector('mat-radio-group')!;
    expect(usage.getAttribute('aria-invalid')).toBe('false'); // has a default value
    expect(document.activeElement).toBe(plate); // focus moves to the first invalid field
  });

  it('shows and hides conditional fields as answers change', async () => {
    await create();
    const lpgQuestion = () => el().textContent!.includes('Araçta LPG var mı?');
    expect(lpgQuestion()).toBe(false);

    const fuel = await loader.getHarness(MatSelectHarness.with({ selector: '#fuelType' }));
    await fuel.open();
    await fuel.clickOptions({ text: 'Benzin' });
    await settle();
    expect(lpgQuestion()).toBe(true);
    expect(el().querySelector('#lpgBrand')).toBeNull();

    const hasLpg = await loader.getHarness(MatRadioGroupHarness.with({ selector: '[aria-labelledby="hasLpg-label"]' }));
    await hasLpg.checkRadioButton({ label: 'Evet' });
    await settle();
    expect(el().querySelector('#lpgBrand')).not.toBeNull();

    await fuel.open();
    await fuel.clickOptions({ text: 'Dizel' });
    await settle();
    expect(lpgQuestion()).toBe(false);
    expect(el().querySelector('#lpgBrand')).toBeNull();
  });

  it('shows computed values live', async () => {
    await create();
    const modelYear = await loader.getHarness(MatInputHarness.with({ selector: '#modelYear' }));

    await modelYear.setValue('2018');
    await settle();

    expect(el().querySelector('.dyn-computed-value')!.textContent).toBe('8');
  });

  it('parses and formats money the Turkish way', async () => {
    await create();
    const value = await loader.getHarness(MatInputHarness.with({ selector: '#vehicleValue' }));

    await value.setValue('1250000,5');
    await value.blur();
    await settle();

    expect(await value.getValue()).toBe('1.250.000,5');
  });

  it('walks through every step of a filled-in form and submits', async () => {
    await create({ values: CASCO_ANSWERS, step: 0, savedAt: '2026-03-15T10:00:00Z' });
    const stepper = await loader.getHarness(MatStepperHarness);

    for (let i = 0; i < 3; i++) {
      await (await loader.getAllHarnesses(MatButtonHarness.with({ text: /İleri/ })))[i].click();
      await settle();
    }
    expect(await (await stepper.getSteps({ selected: true }))[0].getLabel()).toBe('Teminat');
    await (await loader.getHarness(MatButtonHarness.with({ text: /Gönder/ }))).click();
    await settle();

    expect(submissions.length).toBe(1);
    expect(submissions[0].formId).toBe('casco-risk');
    expect(submissions[0].values).toMatchObject({
      plate: '34ABC123',
      vehicleAge: 7,
      hasLpg: null,
      drivers: [{ driverName: 'Ayşe Yılmaz', driverAge: 35 }],
      startDate: '2026-04-01',
    });
  });

  it('resumes a draft at its step', async () => {
    await create({ values: CASCO_ANSWERS, step: 2, savedAt: '2026-03-15T10:00:00Z' });
    await settle();

    const stepper = await loader.getHarness(MatStepperHarness);
    expect(await (await stepper.getSteps({ selected: true }))[0].getLabel()).toBe('Hasar Geçmişi');
  });

  it('emits a draft as the user types', async () => {
    await create();
    const plate = await loader.getHarness(MatInputHarness.with({ selector: '#plate' }));

    await plate.setValue('34ABC1');
    await new Promise((resolve) => setTimeout(resolve, 450));

    expect(drafts.at(-1)!.values['plate']).toBe('34ABC1');
    expect(drafts.at(-1)!.step).toBe(0);
  });
});
