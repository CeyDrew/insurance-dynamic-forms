import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import casco from '../../../../examples/casco.json';
import { FormDefinition } from '../engine/model';
import { allIds, blankDefinition, insertField, newField, updateForm } from './designer-model';
import { DesignerStore, ownerOf } from './designer-store';

const cascoDef = casco as unknown as FormDefinition;

describe('DesignerStore', () => {
  let store: DesignerStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DesignerStore, provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(DesignerStore);
    http = TestBed.inject(HttpTestingController);
  });

  const title = () => store.definition().title;
  const setTitle = (value: string) => store.apply((d) => updateForm(d, { title: value }), 'form:title');

  it('undoes and redoes edits', () => {
    store.apply((d) => insertField(d, { stepIndex: 0, index: 0 }, newField('text', allIds(d))));
    store.apply((d) => insertField(d, { stepIndex: 0, index: 1 }, newField('number', allIds(d))));

    store.undo();
    expect(store.definition().steps[0].fields.map((f) => f.id)).toEqual(['text1']);
    store.undo();
    expect(store.definition().steps[0].fields).toEqual([]);
    expect(store.canUndo()).toBe(false);

    store.redo();
    store.redo();
    expect(store.definition().steps[0].fields.map((f) => f.id)).toEqual(['text1', 'number1']);
    expect(store.canRedo()).toBe(false);
  });

  it('undoes a burst of typing in one step, and a new edit clears redo', () => {
    setTitle('K');
    setTitle('Ka');
    setTitle('Kasko');
    store.undo();
    expect(title()).toBe('Yeni Form');

    store.redo();
    setTitle('Konut');
    expect(store.canRedo()).toBe(false);
  });

  it('ignores edits that change nothing', () => {
    store.apply((d) => d);
    expect(store.canUndo()).toBe(false);
    expect(store.dirty()).toBe(false);
  });

  it('drops a selection that undo made stale', () => {
    store.apply((d) => insertField(d, { stepIndex: 0, index: 0 }, newField('text', allIds(d))));
    store.select({ kind: 'field', id: 'text1' });

    store.undo();

    expect(store.selection()).toEqual({ kind: 'form' });
  });

  it('is read-only on a published version', () => {
    store.load(cascoDef, { formKey: 'casco-risk', version: 1, status: 'PUBLISHED' });

    setTitle('Değişmemeli');

    expect(title()).toBe('Kasko Risk Formu');
  });

  it('validates the definition on the server as it changes', async () => {
    setTitle('Kasko');
    await new Promise((resolve) => setTimeout(resolve, 350));

    const request = http.expectOne('/api/definitions/validate');
    expect(request.request.body.title).toBe('Kasko');
    request.flush({
      valid: false,
      errors: [{ path: 'steps[0].fields', code: 'REQUIRED', message: 'Adım en az bir alan içermeli' }],
    });

    expect(store.errorsByOwner().get('step1')?.[0].message).toBe('Adım en az bir alan içermeli');
  });

  it('creates a new form, then updates its draft, then publishes it', async () => {
    store.load(blankDefinition(), { formKey: null, version: null, status: 'NEW' });
    store.apply((d) => insertField(d, { stepIndex: 0, index: 0 }, newField('text', allIds(d))));

    const created = store.save();
    http.expectOne({ method: 'POST', url: '/api/definitions' }).flush(info('DRAFT'));
    expect(await created).toBe(true);
    expect(store.server()).toEqual({ formKey: 'yeni-form', version: 1, status: 'DRAFT' });
    expect(store.dirty()).toBe(false);

    setTitle('Evcil Hayvan');
    const published = store.publish();
    http.expectOne({ method: 'PUT', url: '/api/definitions/yeni-form/versions/1' }).flush(info('DRAFT'));
    await new Promise((resolve) => setTimeout(resolve)); // save() settles before publish is sent
    http.expectOne({ method: 'POST', url: '/api/definitions/yeni-form/versions/1/publish' }).flush(info('PUBLISHED'));
    expect(await published).toBe(true);
    expect(store.readOnly()).toBe(true);
  });

  it('shows why the server refused to save', async () => {
    const saving = store.save();
    http.expectOne('/api/definitions').flush(
      {
        detail: 'Form tanımı geçersiz',
        errors: [{ path: 'steps[0].fields', code: 'REQUIRED', message: 'Adım en az bir alan içermeli' }],
      },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(await saving).toBe(false);
    expect(store.saveError()).toBe('Form tanımı geçersiz');
    expect(store.errors()[0].code).toBe('REQUIRED');
  });

  it('maps error paths to the step or field they belong to', () => {
    expect(ownerOf(cascoDef, 'steps[0].fields[7].visibleWhen')).toBe('lpgBrand');
    expect(ownerOf(cascoDef, 'steps[1].fields[1].fields[2].expression')).toBe('driverAge');
    expect(ownerOf(cascoDef, 'steps[2].visibleWhen')).toBe('history');
    expect(ownerOf(cascoDef, 'title')).toBeUndefined();
  });
});

function info(status: 'DRAFT' | 'PUBLISHED') {
  return {
    formKey: 'yeni-form',
    version: 1,
    title: 'Yeni Form',
    status,
    createdAt: '2026-11-23T10:00:00Z',
    updatedAt: '2026-11-23T10:00:00Z',
    publishedAt: status === 'PUBLISHED' ? '2026-11-23T10:00:00Z' : null,
  };
}
