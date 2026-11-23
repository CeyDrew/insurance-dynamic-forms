import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import casco from '../../../../examples/casco.json';
import { FormSubmission } from '../engine/renderer';
import { FillFormPage } from './fill-form-page';

describe('FillFormPage', () => {
  let fixture: ComponentFixture<FillFormPage>;
  let http: HttpTestingController;

  const el = () => fixture.nativeElement as HTMLElement;
  const submission: FormSubmission = { formId: 'casco-risk', version: 1, values: { plate: '99ABC123' } };

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    http.match((r) => r.url.startsWith('/api/lookups/')).forEach((r) => r.flush([]));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [FillFormPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(FillFormPage);
    fixture.componentRef.setInput('id', 'casco-risk');
    fixture.detectChanges();
    http.expectOne('/api/definitions/casco-risk').flush(casco);
    await settle();
  });

  function submit() {
    (fixture.componentInstance as unknown as { submit(s: FormSubmission): void }).submit(submission);
    return http.expectOne({ method: 'POST', url: '/api/submissions' });
  }

  it('shows the errors the server found on their fields', async () => {
    submit().flush(
      {
        status: 400,
        title: 'Doğrulama hatası',
        errors: [
          { field: 'plate', code: 'PATTERN', message: 'Geçersiz plaka' },
          { field: 'discount', code: 'UNKNOWN_FIELD', message: 'Formda böyle bir alan yok' },
        ],
      },
      { status: 400, statusText: 'Bad Request' },
    );
    await settle();

    expect(el().querySelector('mat-error')?.textContent).toContain('Geçersiz plaka');
    expect(el().querySelector('.submit-error')?.textContent).toContain('discount: Formda böyle bir alan yok');
  });

  it('reports a server it cannot reach', async () => {
    submit().error(new ProgressEvent('error'), { status: 0 });
    await settle();

    expect(el().querySelector('.submit-error')?.textContent).toContain('Sunucuya ulaşılamadı.');
  });

  it('shows the stored submission and drops the draft', async () => {
    localStorage.setItem('dyn-forms:draft:casco-risk:v1', '{}');

    submit().flush({ id: 5, formId: 'casco-risk', version: 1, submittedAt: '2026-11-23T19:52:00Z' });
    await settle();

    expect(el().querySelector('.result')?.textContent).toContain('Kayıt #5');
    expect(localStorage.getItem('dyn-forms:draft:casco-risk:v1')).toBeNull();
  });
});
