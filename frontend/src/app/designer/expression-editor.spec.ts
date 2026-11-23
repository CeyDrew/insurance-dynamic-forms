import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExpressionEditorComponent } from './expression-editor';

describe('ExpressionEditorComponent', () => {
  let fixture: ComponentFixture<ExpressionEditorComponent>;
  let emitted: string[];

  async function render(value: string | undefined, names = ['hasLpg', 'fuelType', 'modelYear']) {
    fixture = TestBed.createComponent(ExpressionEditorComponent);
    fixture.componentRef.setInput('label', 'Görünür olsun, eğer');
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('names', names);
    emitted = [];
    fixture.componentInstance.valueChange.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const hint = () => (fixture.nativeElement as HTMLElement).querySelector('mat-hint')!.textContent!.trim();
  const textarea = () => (fixture.nativeElement as HTMLElement).querySelector('textarea')!;

  function type(text: string, caret = text.length) {
    const box = textarea();
    box.value = text;
    box.setSelectionRange(caret, caret);
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  const suggestions = () =>
    (fixture.componentInstance as unknown as { suggestions(): { label: string; text: string }[] }).suggestions();

  it('confirms a valid expression', async () => {
    await render("fuelType == 'gasoline'");
    expect(hint()).toBe('Geçerli ifade');
  });

  it('reports syntax errors with line and column', async () => {
    await render('hasLpg = true');
    expect(hint()).toBe("'=' yerine '==' kullanın (satır 1, sütun 8)");
  });

  it('reports fields that do not exist', async () => {
    await render('hasLgp == true');
    expect(hint()).toBe("'hasLgp' adında bir alan yok");
  });

  it('suggests fields and functions for the word at the caret', async () => {
    await render('');
    type('fu');
    expect(suggestions().map((s) => s.label)).toEqual(['fuelType']);

    type('model > cu');
    expect(suggestions().map((s) => s.label)).toEqual(['currentYear()']);
    expect(suggestions()[0].text).toBe('model > currentYear()');
  });

  it('completes in the middle of an expression', async () => {
    await render('');
    type('has == true', 3);

    expect(suggestions()[0].text).toBe('hasLpg == true');
    expect(emitted.at(-1)).toBe('has == true');
  });
});
