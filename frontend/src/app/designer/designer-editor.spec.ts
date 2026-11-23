import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatTabGroupHarness } from '@angular/material/tabs/testing';
import { provideRouter } from '@angular/router';

import { DesignerCanvasComponent } from './designer-canvas';
import { DesignerEditorPage } from './designer-editor';
import { DesignerStore } from './designer-store';

describe('DesignerEditorPage', () => {
  let fixture: ComponentFixture<DesignerEditorPage>;
  let http: HttpTestingController;
  let store: DesignerStore;

  const el = () => fixture.nativeElement as HTMLElement;
  const button = (text: string) =>
    [...el().querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent!.trim().includes(text))!;
  const input = (label: string) => {
    const field = [...el().querySelectorAll('app-properties-panel mat-form-field')].find((f) =>
      f.querySelector('mat-label')?.textContent?.trim().startsWith(label),
    );
    return field!.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')!;
  };
  const typeInto = (box: HTMLInputElement | HTMLTextAreaElement, value: string, event = 'input') => {
    box.value = value;
    box.dispatchEvent(new Event(event));
  };

  async function settle() {
    fixture.detectChanges();
    await fixture.whenStable();
    // Answer the debounced background validation with "valid".
    await new Promise((resolve) => setTimeout(resolve, 320));
    http.match('/api/definitions/validate').forEach((r) => r.flush({ valid: true, errors: [] }));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DesignerEditorPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DesignerEditorPage);
    store = fixture.debugElement.injector.get(DesignerStore);
    await settle();
  });

  it('builds a form from scratch, previews it and publishes it', async () => {
    // Form settings
    typeInto(input('Form id'), 'evcil-hayvan');
    typeInto(input('Başlık'), 'Evcil Hayvan Sigortası');
    await settle();

    // Add fields from the palette (click = keyboard-friendly alternative to dragging)
    button('Evet / Hayır').click();
    await settle();
    typeInto(input('Etiket'), 'Köpek mi?');
    const idBox = input('Id') as HTMLInputElement;
    typeInto(idBox, 'isDog', 'change');
    await settle();

    button('Metin').click();
    await settle();
    typeInto(input('Etiket'), 'Cins');
    const rule = el().querySelectorAll<HTMLTextAreaElement>('app-expression-editor textarea')[0];
    typeInto(rule, 'isDog == true');
    await settle();

    expect(store.definition()).toMatchObject({
      id: 'evcil-hayvan',
      title: 'Evcil Hayvan Sigortası',
      steps: [
        {
          fields: [
            { id: 'isDog', type: 'boolean', label: 'Köpek mi?' },
            { id: 'text1', type: 'text', label: 'Cins', visibleWhen: 'isDog == true' },
          ],
        },
      ],
    });
    expect(el().querySelector('app-designer-canvas')!.textContent).toContain('koşullu görünür');

    // The preview is the real renderer
    const tabs = await TestbedHarnessEnvironment.loader(fixture).getHarness(MatTabGroupHarness);
    await tabs.selectTab({ label: 'Önizleme' });
    await settle();
    expect(el().querySelector('dyn-form-renderer')!.textContent).toContain('Köpek mi?');
    await tabs.selectTab({ label: 'JSON' });
    await settle();
    expect(el().querySelector('.json pre')!.textContent).toContain('"visibleWhen": "isDog == true"');

    // Publish: the id is checked to be free, the draft is created, then published
    button('Yayınla').click();
    http.expectOne('/api/definitions/evcil-hayvan/versions').flush('yok', { status: 404, statusText: 'Not Found' });
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne({ method: 'POST', url: '/api/definitions' }).flush(info('DRAFT'));
    await new Promise((resolve) => setTimeout(resolve));
    http.expectOne({ method: 'POST', url: '/api/definitions/evcil-hayvan/versions/1/publish' }).flush(info('PUBLISHED'));
    await settle();

    expect(el().querySelector('.status')!.textContent).toContain('Yayında · v1');
    expect(el().querySelector('a[href="/fill/evcil-hayvan"]')).not.toBeNull();
  });

  it('refuses to create a form whose id is taken', async () => {
    button('Metin').click();
    await settle();

    button('Kaydet').click();
    http.expectOne('/api/definitions/yeni-form/versions').flush([]);
    await settle();

    expect(el().querySelector('.banner.error')!.textContent).toContain("'yeni-form' id'si başka bir formda kullanılıyor");
    http.expectNone({ method: 'POST', url: '/api/definitions' });
  });

  it('moves fields by drag and drop, into a repeater too, and undoes with Ctrl+Z', async () => {
    button('Metin').click();
    button('Sayı').click();
    button('Tekrarlanan grup').click();
    await settle();
    const canvas = fixture.debugElement.query((d) => d.componentInstance instanceof DesignerCanvasComponent)
      .componentInstance as unknown as { drop(event: unknown): void };
    const ids = () => store.definition().steps[0].fields.map((f) => f.id);
    expect(ids()).toEqual(['text1', 'number1', 'repeater1']);

    canvas.drop({ container: { data: { stepIndex: 0 } }, currentIndex: 0, item: { data: { kind: 'move', id: 'number1' } } });
    expect(ids()).toEqual(['number1', 'text1', 'repeater1']);

    canvas.drop({
      container: { data: { stepIndex: 0, repeaterId: 'repeater1' } },
      currentIndex: 0,
      item: { data: { kind: 'new', type: 'date' } },
    });
    const repeater = store.definition().steps[0].fields[2];
    expect(repeater.type === 'repeater' && repeater.fields.map((f) => f.type)).toEqual(['date', 'text']);

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(ids()).toEqual(['text1', 'number1', 'repeater1']);
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
    expect(ids()).toEqual(['number1', 'text1', 'repeater1']);
  });
});

function info(status: 'DRAFT' | 'PUBLISHED') {
  return {
    formKey: 'evcil-hayvan',
    version: 1,
    title: 'Evcil Hayvan Sigortası',
    status,
    createdAt: '2026-11-23T10:00:00Z',
    updatedAt: '2026-11-23T10:00:00Z',
    publishedAt: status === 'PUBLISHED' ? '2026-11-23T10:00:00Z' : null,
  };
}
