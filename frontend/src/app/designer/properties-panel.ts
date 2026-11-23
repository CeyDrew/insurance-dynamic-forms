import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import {
  FieldDefinition,
  FieldType,
  FIELD_KEYS,
  OptionDefinition,
  ValidatorDefinition,
  ValidatorType,
} from '../engine/model';
import {
  allIds,
  expressionNames,
  FIELD_LABELS,
  findField,
  locate,
  moveField,
  moveStep,
  removeField,
  removeStep,
  renameField,
  updateField,
  updateForm,
  updateStep,
} from './designer-model';
import { DesignerStore } from './designer-store';
import { ExpressionEditorComponent } from './expression-editor';

const ID = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const FORM_ID = /^[a-z][a-z0-9-]*$/;

/** Validators each field type accepts; mirrors the backend's definition rules. */
const VALIDATORS: Partial<Record<FieldType, ValidatorType[]>> = {
  text: ['minLength', 'maxLength', 'pattern'],
  textarea: ['minLength', 'maxLength', 'pattern'],
  number: ['min', 'max'],
  currency: ['min', 'max'],
  date: ['minDate', 'maxDate'],
  multiselect: ['minItems', 'maxItems'],
  repeater: ['minItems', 'maxItems'],
};

const VALIDATOR_LABELS: Record<ValidatorType, string> = {
  minLength: 'En az karakter',
  maxLength: 'En fazla karakter',
  pattern: 'Desen (regex)',
  min: 'En küçük değer',
  max: 'En büyük değer',
  minDate: 'En erken tarih',
  maxDate: 'En geç tarih',
  minItems: 'En az adet',
  maxItems: 'En fazla adet',
};

/** Edits whatever is selected on the canvas: the form, a step or a field. */
@Component({
  selector: 'app-properties-panel',
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    MatSlideToggleModule,
    ExpressionEditorComponent,
  ],
  templateUrl: './properties-panel.html',
  styleUrl: './properties-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PropertiesPanelComponent {
  protected readonly store = inject(DesignerStore);
  protected readonly labels = FIELD_LABELS;
  protected readonly validatorLabels = VALIDATOR_LABELS;

  protected readonly definition = this.store.definition;
  protected readonly readOnly = this.store.readOnly;

  protected readonly step = computed(() => {
    const selection = this.store.selection();
    return selection.kind === 'step' ? this.definition().steps.find((s) => s.id === selection.id) : undefined;
  });
  protected readonly stepIndex = computed(() => this.definition().steps.findIndex((s) => s.id === this.step()?.id));

  protected readonly field = computed(() => {
    const selection = this.store.selection();
    return selection.kind === 'field' ? findField(this.definition(), selection.id) : undefined;
  });
  protected readonly location = computed(() => {
    const field = this.field();
    return field ? locate(this.definition(), field.id) : undefined;
  });

  /** Keys the selected field's type accepts. */
  protected readonly keys = computed(() => new Set<string>(this.field() ? FIELD_KEYS[this.field()!.type] : []));
  protected readonly isInput = computed(() => this.keys().has('required'));

  protected readonly fieldNames = computed(() =>
    expressionNames(this.definition(), { fieldId: this.field()?.id }),
  );
  protected readonly stepNames = computed(() => expressionNames(this.definition(), { stepId: this.step()?.id }));
  /** A computed field may read any field (cycles are reported by validation). */
  protected readonly computedNames = computed(() => {
    const field = this.field();
    return field ? expressionNames(this.definition(), { fieldId: field.id }) : [];
  });

  protected readonly allowedValidators = computed(() => VALIDATORS[this.field()?.type ?? 'info'] ?? []);
  protected readonly validators = computed(
    () => ((this.field() as { validators?: ValidatorDefinition[] } | undefined)?.validators ?? []) as ValidatorDefinition[],
  );
  protected readonly unusedValidators = computed(() =>
    this.allowedValidators().filter((type) => !this.validators().some((v) => v.type === type)),
  );

  protected readonly options = computed(
    () => ((this.field() as { options?: OptionDefinition[] } | undefined)?.options ?? []) as OptionDefinition[],
  );
  protected readonly remoteUrl = computed(
    () => (this.field() as { optionsSource?: { url: string } } | undefined)?.optionsSource?.url,
  );

  // ---- form ------------------------------------------------------------------------

  protected setForm(key: 'id' | 'title' | 'description', value: string): void {
    this.store.apply((d) => updateForm(d, { [key]: value }), `form:${key}`);
  }

  protected formIdProblem(id: string): string | null {
    return FORM_ID.test(id) ? null : 'Küçük harfle başlamalı; küçük harf, rakam ve tire içerebilir';
  }

  // ---- step ------------------------------------------------------------------------

  protected setStep(key: 'title' | 'description' | 'visibleWhen', value: string): void {
    const id = this.step()!.id;
    this.store.apply((d) => updateStep(d, id, { [key]: value || undefined }), `step:${id}:${key}`);
  }

  protected renameStep(input: HTMLInputElement): void {
    const step = this.step()!;
    const id = input.value.trim();
    if (id === step.id) return;
    if (!ID.test(id) || allIds(this.definition()).has(id)) {
      input.value = step.id;
      return;
    }
    this.store.apply((d) => updateStep(d, step.id, { id }));
    this.store.select({ kind: 'step', id });
  }

  protected moveStepBy(delta: number): void {
    const index = this.stepIndex();
    this.store.apply((d) => moveStep(d, index, index + delta));
  }

  protected deleteStep(): void {
    const id = this.step()!.id;
    this.store.apply((d) => removeStep(d, id));
    this.store.select({ kind: 'form' });
  }

  // ---- field -----------------------------------------------------------------------

  protected set(key: string, value: unknown): void {
    const id = this.field()!.id;
    this.store.apply((d) => updateField(d, id, { [key]: value === '' ? undefined : value }), `field:${id}:${key}`);
  }

  protected setNumber(key: string, text: string): void {
    this.set(key, text === '' ? undefined : Number(text));
  }

  /** Renames on blur/Enter and updates every rule that reads the field. */
  protected rename(input: HTMLInputElement): void {
    const field = this.field()!;
    const id = input.value.trim();
    if (id === field.id) return;
    if (!ID.test(id) || allIds(this.definition()).has(id)) {
      input.value = field.id;
      return;
    }
    this.store.apply((d) => renameField(d, field.id, id));
    this.store.select({ kind: 'field', id });
  }

  protected idProblem(id: string): string | null {
    if (!ID.test(id)) return "Harfle başlamalı; harf, rakam ve '_' içerebilir";
    const field = this.field();
    return id !== field?.id && allIds(this.definition()).has(id) ? 'Bu id kullanılıyor' : null;
  }

  protected moveToStep(stepIndex: number): void {
    const id = this.field()!.id;
    const index = this.definition().steps[stepIndex].fields.length;
    this.store.apply((d) => moveField(d, id, { stepIndex, index }));
  }

  protected deleteField(): void {
    const id = this.field()!.id;
    this.store.apply((d) => removeField(d, id));
    this.store.select({ kind: 'form' });
  }

  // ---- options ---------------------------------------------------------------------

  protected setOption(index: number, key: 'value' | 'label', value: string): void {
    const options = this.options().map((o, i) => (i === index ? { ...o, [key]: value } : o));
    this.set('options', options);
  }

  protected addOption(): void {
    const n = this.options().length + 1;
    this.store.apply((d) =>
      updateField(d, this.field()!.id, {
        options: [...this.options(), { value: `secenek${n}`, label: `Seçenek ${n}` }],
      }),
    );
  }

  protected removeOption(index: number): void {
    this.store.apply((d) => updateField(d, this.field()!.id, { options: this.options().filter((_, i) => i !== index) }));
  }

  protected useRemote(remote: boolean): void {
    this.store.apply((d) =>
      updateField(d, this.field()!.id, {
        options: remote ? undefined : [{ value: 'secenek1', label: 'Seçenek 1' }],
        optionsSource: remote ? { type: 'remote', url: '/api/lookups/' } : undefined,
      }),
    );
  }

  protected setRemoteUrl(url: string): void {
    this.set('optionsSource', { type: 'remote', url });
  }

  // ---- validators ------------------------------------------------------------------

  protected addValidator(type: ValidatorType): void {
    const value = type === 'pattern' ? '.*' : type === 'minDate' || type === 'maxDate' ? 'today' : 1;
    this.store.apply((d) =>
      updateField(d, this.field()!.id, { validators: [...this.validators(), { type, value }] }),
    );
  }

  protected setValidator(index: number, key: 'value' | 'message', raw: string): void {
    const validator = this.validators()[index];
    const numeric = !['pattern', 'minDate', 'maxDate'].includes(validator.type);
    const value = key === 'value' && numeric ? (raw === '' ? undefined : Number(raw)) : raw || undefined;
    const validators = this.validators().map((v, i) => {
      if (i !== index) return v;
      const next = { ...v, [key]: value } as Record<string, unknown>;
      if (next['message'] === undefined) delete next['message'];
      return next as unknown as ValidatorDefinition;
    });
    this.set('validators', validators);
  }

  protected removeValidator(index: number): void {
    const validators = this.validators().filter((_, i) => i !== index);
    this.store.apply((d) =>
      updateField(d, this.field()!.id, { validators: validators.length > 0 ? validators : undefined }),
    );
  }

  protected isTextValidator(type: ValidatorType): boolean {
    return type === 'pattern' || type === 'minDate' || type === 'maxDate';
  }

  protected get<T>(field: FieldDefinition, key: string): T | undefined {
    return (field as unknown as Record<string, T>)[key];
  }

  protected errorsOf(id: string) {
    return this.store.errorsByOwner().get(id) ?? [];
  }
}
