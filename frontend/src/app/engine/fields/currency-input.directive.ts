import { Directive, ElementRef, forwardRef, inject, input, Renderer2 } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * ControlValueAccessor for money amounts typed the Turkish way: the control holds a
 * number (`1250000.5`), the input shows `1.250.000,5` and reformats on blur.
 */
@Directive({
  selector: 'input[dynCurrencyInput]',
  host: {
    inputmode: 'decimal',
    autocomplete: 'off',
    '(input)': 'onInput()',
    '(blur)': 'onBlur()',
  },
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CurrencyInputDirective), multi: true }],
})
export class CurrencyInputDirective implements ControlValueAccessor {
  readonly maxFractionDigits = input(2);

  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private value: number | null = null;
  private onChange: (value: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: unknown): void {
    this.value = typeof value === 'number' && Number.isFinite(value) ? value : null;
    this.renderer.setProperty(this.element.nativeElement, 'value', formatAmount(this.value, this.maxFractionDigits()));
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(disabled: boolean): void {
    this.renderer.setProperty(this.element.nativeElement, 'disabled', disabled);
  }

  protected onInput(): void {
    this.value = parseAmount(this.element.nativeElement.value);
    this.onChange(this.value);
  }

  protected onBlur(): void {
    if (this.value !== null) {
      this.renderer.setProperty(this.element.nativeElement, 'value', formatAmount(this.value, this.maxFractionDigits()));
    }
    this.onTouched();
  }
}

/** `1.250.000,50` / `1250000,5` / `1250000` -> number; anything else -> `NaN`; empty -> `null`. */
export function parseAmount(text: string): number | null {
  const compact = text.replace(/\s/g, '');
  if (compact === '') return null;
  if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(compact)) return NaN;
  return Number(compact.replace(/\./g, '').replace(',', '.'));
}

export function formatAmount(value: number | null, maxFractionDigits: number): string {
  if (value === null || Number.isNaN(value)) return '';
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: maxFractionDigits }).format(value);
}
