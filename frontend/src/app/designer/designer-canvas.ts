import { CdkDrag, CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

import { FIELD_TYPES, FieldDefinition, FieldType } from '../engine/model';
import {
  addStep,
  allIds,
  FIELD_LABELS,
  FieldLocation,
  findField,
  insertField,
  locate,
  moveField,
  newField,
} from './designer-model';
import { DesignerStore } from './designer-store';

export type DragData = { kind: 'new'; type: FieldType } | { kind: 'move'; id: string };
export interface ListData {
  stepIndex: number;
  repeaterId?: string;
}

export const FIELD_ICONS: Record<FieldType, string> = {
  text: 'short_text',
  textarea: 'notes',
  number: 'pin',
  currency: 'payments',
  date: 'event',
  boolean: 'toggle_on',
  select: 'arrow_drop_down_circle',
  multiselect: 'checklist',
  radio: 'radio_button_checked',
  repeater: 'repeat',
  computed: 'functions',
  info: 'info',
};

/**
 * Field types to drag onto the canvas. Clicking one adds it to the selected step (or into the
 * selected repeater), so the designer also works without a mouse.
 */
@Component({
  selector: 'app-palette',
  imports: [DragDropModule, MatIconModule, MatTooltipModule],
  template: `
    <h2 id="palette-title">Alanlar</h2>
    <div
      class="palette"
      cdkDropList
      id="palette"
      cdkDropListSortingDisabled
      [cdkDropListEnterPredicate]="noDrop"
      [cdkDropListDisabled]="store.readOnly()"
      role="group"
      aria-labelledby="palette-title"
    >
      @for (type of types; track type) {
        <button
          type="button"
          class="palette-item"
          cdkDrag
          [cdkDragData]="{ kind: 'new', type }"
          [disabled]="store.readOnly()"
          (click)="add(type)"
          [attr.aria-label]="labels[type] + ' ekle'"
        >
          <mat-icon aria-hidden="true">{{ icons[type] }}</mat-icon>
          {{ labels[type] }}
        </button>
      }
    </div>
  `,
  styleUrl: './designer-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaletteComponent {
  protected readonly store = inject(DesignerStore);
  protected readonly types = FIELD_TYPES;
  protected readonly labels = FIELD_LABELS;
  protected readonly icons = FIELD_ICONS;
  protected readonly noDrop = () => false;

  /** Adds to the end of the selected repeater, the selected step, or the step holding the selection. */
  protected add(type: FieldType): void {
    const definition = this.store.definition();
    const selection = this.store.selection();
    let target: FieldLocation = { stepIndex: 0, index: definition.steps[0].fields.length };
    if (selection.kind === 'step') {
      const stepIndex = definition.steps.findIndex((s) => s.id === selection.id);
      target = { stepIndex, index: definition.steps[stepIndex].fields.length };
    } else if (selection.kind === 'field') {
      const selected = findField(definition, selection.id);
      const location = locate(definition, selection.id)!;
      if (selected?.type === 'repeater' && type !== 'repeater') {
        target = { stepIndex: location.stepIndex, repeaterId: selected.id, index: selected.fields.length };
      } else {
        target = { ...location, index: location.index + 1 };
      }
    }
    const field = newField(type, allIds(definition));
    this.store.apply((d) => insertField(d, target, field));
    if (findField(this.store.definition(), field.id)) {
      this.store.select({ kind: 'field', id: field.id });
    }
  }
}

/** Steps and their fields; drop targets for the palette and for moving fields around. */
@Component({
  selector: 'app-designer-canvas',
  imports: [DragDropModule, NgTemplateOutlet, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './designer-canvas.html',
  styleUrl: './designer-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignerCanvasComponent {
  protected readonly store = inject(DesignerStore);
  protected readonly labels: Record<string, string> = FIELD_LABELS;
  protected readonly icons: Record<string, string> = FIELD_ICONS;
  protected readonly definition = this.store.definition;
  protected readonly readOnly = this.store.readOnly;

  protected readonly selectedId = computed(() => {
    const selection = this.store.selection();
    return selection.kind === 'form' ? null : selection.id;
  });

  /** Repeater rows cannot hold another repeater. */
  protected readonly notARepeater = (drag: CdkDrag<DragData>): boolean => {
    const data = drag.data;
    const type = data.kind === 'new' ? data.type : findField(this.store.definition(), data.id)?.type;
    return type !== 'repeater';
  };

  // The nested list is declared in an untyped ng-template, so its data arrives as `any`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- CdkDropList data is invariant
  protected drop(event: CdkDragDrop<any, any, any>): void {
    const target: FieldLocation = { ...(event.container.data as ListData), index: event.currentIndex };
    const data = event.item.data as DragData;
    if (data.kind === 'new') {
      const field = newField(data.type, allIds(this.store.definition()));
      this.store.apply((d) => insertField(d, target, field));
      this.store.select({ kind: 'field', id: field.id });
    } else {
      this.store.apply((d) => moveField(d, data.id, target));
    }
  }

  protected shift(field: FieldDefinition, delta: number, event: Event): void {
    event.stopPropagation();
    const location = locate(this.store.definition(), field.id)!;
    this.store.apply((d) => moveField(d, field.id, { ...location, index: Math.max(0, location.index + delta) }));
  }

  protected selectField(field: FieldDefinition, event: Event): void {
    event.stopPropagation();
    this.store.select({ kind: 'field', id: field.id });
  }

  protected selectStep(id: string): void {
    this.store.select({ kind: 'step', id });
  }

  protected addStep(): void {
    this.store.apply((d) => addStep(d));
    const steps = this.store.definition().steps;
    this.store.select({ kind: 'step', id: steps[steps.length - 1].id });
  }

  protected locationStep(id: string): number {
    return locate(this.store.definition(), id)?.stepIndex ?? 0;
  }

  protected errorCount(id: string): number {
    return this.store.errorsByOwner().get(id)?.length ?? 0;
  }

  /** Short notes on a card: required, conditional, computed. */
  protected badges(field: FieldDefinition): string[] {
    const f = field as unknown as Record<string, unknown>;
    return [
      f['required'] ? 'zorunlu' : null,
      f['requiredWhen'] ? 'koşullu zorunlu' : null,
      f['visibleWhen'] ? 'koşullu görünür' : null,
      f['disabledWhen'] ? 'koşullu salt okunur' : null,
      field.type === 'computed' ? `= ${f['expression']}` : null,
    ].filter((b): b is string => b !== null);
  }
}
