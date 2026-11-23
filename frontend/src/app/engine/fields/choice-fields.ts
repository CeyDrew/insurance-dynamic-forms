import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';

import { OptionDefinition, RadioField, SelectField } from '../model';
import { OptionsService } from '../renderer/options.service';
import { FieldBase } from './field-base';

type RemoteState = { status: 'idle' | 'loading' | 'error' } | { status: 'loaded'; options: OptionDefinition[] };

/** `select` and `multiselect`, with static `options` or a cached `optionsSource`. */
@Component({
  selector: 'dyn-select-field',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatSelectModule],
  template: `
    <mat-form-field appearance="outline" class="dyn-form-field">
      <mat-label>{{ field().label }}</mat-label>
      <mat-select
        [id]="state().domId"
        [formControl]="control()"
        [multiple]="multiple()"
        [required]="state().rules.required()"
        [placeholder]="field().placeholder ?? ''"
      >
        @if (!multiple() && !state().rules.required()) {
          <mat-option [value]="null">—</mat-option>
        }
        @for (option of options(); track option.value) {
          <mat-option [value]="option.value">{{ option.label }}</mat-option>
        }
      </mat-select>
      @if (remote().status === 'loading') {
        <mat-hint>Seçenekler yükleniyor…</mat-hint>
      } @else if (remote().status === 'error') {
        <mat-hint class="dyn-hint-error">Seçenekler yüklenemedi. Sayfayı yenileyip tekrar deneyin.</mat-hint>
      } @else if (field().hint) {
        <mat-hint>{{ field().hint }}</mat-hint>
      }
      <mat-error>{{ error() }}</mat-error>
    </mat-form-field>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SelectFieldComponent extends FieldBase {
  private readonly optionsService = inject(OptionsService);

  protected readonly multiple = computed(() => this.field().type === 'multiselect');
  protected readonly remote = signal<RemoteState>({ status: 'idle' });
  protected readonly options = computed(() => {
    const field = this.field() as SelectField;
    if (field.options) return field.options;
    const remote = this.remote();
    return remote.status === 'loaded' ? remote.options : [];
  });

  constructor() {
    super();
    effect((onCleanup) => {
      const source = (this.field() as SelectField).optionsSource;
      if (!source) return;
      this.remote.set({ status: 'loading' });
      const subscription = this.optionsService.load(source.url).subscribe({
        next: (options) => this.remote.set({ status: 'loaded', options }),
        error: () => this.remote.set({ status: 'error' }),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }
}

const YES_NO: OptionDefinition[] = [
  { value: true as unknown as string, label: 'Evet' },
  { value: false as unknown as string, label: 'Hayır' },
];

/** `radio` and `boolean` (Evet / Hayır): a labelled radio group with its own hint and error. */
@Component({
  selector: 'dyn-radio-field',
  imports: [ReactiveFormsModule, MatRadioModule],
  template: `
    <div class="dyn-group" [class.dyn-group-invalid]="touchedError()">
      <span class="dyn-group-label" [id]="labelId()">
        {{ field().label }}
        @if (state().rules.required()) {
          <span class="dyn-required" aria-hidden="true">*</span>
        }
      </span>
      <mat-radio-group
        class="dyn-radio-group"
        [formControl]="control()"
        [attr.aria-labelledby]="labelId()"
        [attr.aria-describedby]="describedBy()"
        [attr.aria-required]="state().rules.required()"
        [attr.aria-invalid]="!!touchedError()"
      >
        @for (option of options(); track option.value) {
          <mat-radio-button [value]="option.value">{{ option.label }}</mat-radio-button>
        }
      </mat-radio-group>
      @if (field().hint) {
        <div class="dyn-hint" [id]="hintId()">{{ field().hint }}</div>
      }
      @if (touchedError(); as message) {
        <div class="dyn-error" [id]="errorId()" role="alert">{{ message }}</div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadioFieldComponent extends FieldBase {
  protected readonly options = computed(() =>
    this.field().type === 'boolean' ? YES_NO : (this.field() as RadioField).options,
  );
}
