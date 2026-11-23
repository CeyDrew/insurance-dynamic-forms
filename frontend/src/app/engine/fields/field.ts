import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { RepeaterField } from '../model';
import { FieldState } from '../renderer/rendered-form';
import { RadioFieldComponent, SelectFieldComponent } from './choice-fields';
import { ComputedFieldComponent, InfoFieldComponent } from './display-fields';
import { FieldBase } from './field-base';
import { DateFieldComponent, NumberFieldComponent, TextFieldComponent } from './input-fields';

/** Renders any field by type; nothing while the field is hidden. */
@Component({
  selector: 'dyn-field',
  imports: [
    TextFieldComponent,
    NumberFieldComponent,
    DateFieldComponent,
    SelectFieldComponent,
    RadioFieldComponent,
    ComputedFieldComponent,
    InfoFieldComponent,
    forwardRef(() => RepeaterFieldComponent),
  ],
  template: `
    @if (state().rules.visible()) {
      @switch (state().field.type) {
        @case ('text') {
          <dyn-text-field [state]="state()" />
        }
        @case ('textarea') {
          <dyn-text-field [state]="state()" />
        }
        @case ('number') {
          <dyn-number-field [state]="state()" />
        }
        @case ('currency') {
          <dyn-number-field [state]="state()" />
        }
        @case ('date') {
          <dyn-date-field [state]="state()" />
        }
        @case ('select') {
          <dyn-select-field [state]="state()" />
        }
        @case ('multiselect') {
          <dyn-select-field [state]="state()" />
        }
        @case ('radio') {
          <dyn-radio-field [state]="state()" />
        }
        @case ('boolean') {
          <dyn-radio-field [state]="state()" />
        }
        @case ('repeater') {
          <dyn-repeater-field [state]="state()" />
        }
        @case ('computed') {
          <dyn-computed-field [state]="state()" />
        }
        @case ('info') {
          <dyn-info-field [state]="state()" />
        }
      }
    }
  `,
  host: { class: 'dyn-field' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldComponent {
  readonly state = input.required<FieldState>();
}

/** `repeater`: a list of rows, each rendering the child fields in its own rule scope. */
@Component({
  selector: 'dyn-repeater-field',
  imports: [MatButtonModule, MatIconModule, FieldComponent],
  template: `
    <fieldset class="dyn-repeater" [attr.aria-describedby]="describedBy()">
      <legend class="dyn-group-label">
        {{ field().label }}
        @if (state().rules.required()) {
          <span class="dyn-required" aria-hidden="true">*</span>
        }
      </legend>
      @if (field().hint) {
        <div class="dyn-hint" [id]="hintId()">{{ field().hint }}</div>
      }
      @for (row of state().rows!(); track row.key; let i = $index) {
        <section class="dyn-row" [attr.aria-labelledby]="state().domId + '-row-' + row.key">
          <header class="dyn-row-header">
            <h3 [id]="state().domId + '-row-' + row.key">{{ itemLabel() }} {{ i + 1 }}</h3>
            <button
              mat-icon-button
              type="button"
              (click)="remove(i)"
              [attr.aria-label]="itemLabel() + ' ' + (i + 1) + ' satırını sil'"
            >
              <mat-icon aria-hidden="true">delete</mat-icon>
            </button>
          </header>
          @for (child of row.fields; track child.field.id) {
            <dyn-field [state]="child" />
          }
        </section>
      } @empty {
        <p class="dyn-empty">Henüz {{ itemLabel().toLocaleLowerCase('tr-TR') }} eklenmedi.</p>
      }
      <button mat-stroked-button type="button" (click)="add()" [disabled]="atMax()">
        <mat-icon aria-hidden="true">add</mat-icon>
        {{ addLabel() }}
      </button>
      @if (touchedError(); as message) {
        <div class="dyn-error" [id]="errorId()" role="alert">{{ message }}</div>
      }
    </fieldset>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RepeaterFieldComponent extends FieldBase {
  private readonly repeater = computed(() => this.field() as RepeaterField);
  protected readonly itemLabel = computed(() => this.repeater().itemLabel ?? 'Satır');
  protected readonly addLabel = computed(() => this.repeater().addLabel ?? 'Ekle');
  protected readonly atMax = computed(() => {
    const max = this.repeater().validators?.find((v) => v.type === 'maxItems')?.value;
    return max !== undefined && this.state().rows!().length >= max;
  });

  protected add(): void {
    this.state().addRow!();
    this.state().control!.markAsTouched();
  }

  protected remove(index: number): void {
    this.state().removeRow!(index);
    this.state().control!.markAsTouched();
  }
}
