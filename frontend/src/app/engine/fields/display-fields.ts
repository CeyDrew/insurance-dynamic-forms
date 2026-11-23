import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { ComputedField, InfoField } from '../model';
import { FieldBase } from './field-base';

/** `computed`: a read-only, live-announced result. */
@Component({
  selector: 'dyn-computed-field',
  template: `
    <div class="dyn-computed">
      <span class="dyn-computed-label" [id]="labelId()">{{ field().label }}</span>
      <output class="dyn-computed-value" [attr.aria-labelledby]="labelId()" aria-live="polite">{{ text() }}</output>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComputedFieldComponent extends FieldBase {
  protected readonly text = computed(() => {
    const value = this.state().rules.value();
    const format = (this.field() as ComputedField).format;
    if (value === null) return '—';
    if (typeof value === 'number') {
      return format === 'currency'
        ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value)
        : new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(value);
    }
    if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';
    return Array.isArray(value) ? value.join(', ') : String(value);
  });
}

/** `info`: an explanatory note, no value. */
@Component({
  selector: 'dyn-info-field',
  imports: [MatIconModule],
  template: `
    <div class="dyn-info" role="note" [attr.aria-labelledby]="labelId()">
      <mat-icon aria-hidden="true">info</mat-icon>
      <div>
        <strong [id]="labelId()">{{ field().label }}</strong>
        <p>{{ content() }}</p>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoFieldComponent extends FieldBase {
  protected readonly content = computed(() => (this.field() as InfoField).content);
}
