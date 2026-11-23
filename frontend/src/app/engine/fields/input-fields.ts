import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { CurrencyField, NumberField, TextareaField } from '../model';
import { CurrencyInputDirective } from './currency-input.directive';
import { FieldBase } from './field-base';

/** `text` and `textarea`. */
@Component({
  selector: 'dyn-text-field',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  template: `
    <mat-form-field appearance="outline" class="dyn-form-field">
      <mat-label>{{ field().label }}</mat-label>
      @if (field().type === 'textarea') {
        <textarea
          matInput
          [id]="state().domId"
          [formControl]="control()"
          [rows]="rows()"
          [placeholder]="field().placeholder ?? ''"
          [required]="state().rules.required()"
        ></textarea>
      } @else {
        <input
          matInput
          [id]="state().domId"
          [formControl]="control()"
          [placeholder]="field().placeholder ?? ''"
          [required]="state().rules.required()"
          autocomplete="off"
        />
      }
      @if (field().hint) {
        <mat-hint>{{ field().hint }}</mat-hint>
      }
      <mat-error>{{ error() }}</mat-error>
    </mat-form-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextFieldComponent extends FieldBase {
  protected readonly rows = computed(() => (this.field() as TextareaField).rows ?? 3);
}

const CURRENCY_SYMBOLS: Record<string, string> = { TRY: '₺', EUR: '€', USD: '$', GBP: '£' };

/** `number` and `currency`. */
@Component({
  selector: 'dyn-number-field',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, CurrencyInputDirective],
  template: `
    <mat-form-field appearance="outline" class="dyn-form-field dyn-narrow">
      <mat-label>{{ field().label }}</mat-label>
      @if (field().type === 'currency') {
        <input
          matInput
          dynCurrencyInput
          [id]="state().domId"
          [formControl]="control()"
          [placeholder]="field().placeholder ?? ''"
          [required]="state().rules.required()"
        />
      } @else {
        <input
          matInput
          type="number"
          [id]="state().domId"
          [formControl]="control()"
          [step]="step()"
          [placeholder]="field().placeholder ?? ''"
          [required]="state().rules.required()"
        />
      }
      @if (field().type === 'currency') {
        <span matTextSuffix>{{ symbol() }}</span>
      }
      @if (field().hint) {
        <mat-hint>{{ field().hint }}</mat-hint>
      }
      <mat-error>{{ error() }}</mat-error>
    </mat-form-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberFieldComponent extends FieldBase {
  protected readonly step = computed(() => {
    const decimals = (this.field() as NumberField).decimals ?? 0;
    return decimals === 0 ? 1 : 1 / 10 ** decimals;
  });
  protected readonly symbol = computed(() => {
    const code = (this.field() as CurrencyField).currency ?? 'TRY';
    return CURRENCY_SYMBOLS[code] ?? code;
  });
}

/** `date`; the control holds a `Date`, the model a `YYYY-MM-DD` string. */
@Component({
  selector: 'dyn-date-field',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatDatepickerModule],
  template: `
    <mat-form-field appearance="outline" class="dyn-form-field dyn-narrow">
      <mat-label>{{ field().label }}</mat-label>
      <input
        matInput
        [id]="state().domId"
        [matDatepicker]="picker"
        [formControl]="control()"
        [required]="state().rules.required()"
        placeholder="GG.AA.YYYY"
        autocomplete="off"
      />
      <mat-datepicker-toggle matIconSuffix [for]="picker" />
      <mat-datepicker #picker />
      @if (field().hint) {
        <mat-hint>{{ field().hint }}</mat-hint>
      }
      <mat-error>{{ error() }}</mat-error>
    </mat-form-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DateFieldComponent extends FieldBase {}
