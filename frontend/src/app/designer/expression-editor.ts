import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { compileExpression, ExpressionError, FUNCTIONS } from '../engine/rules';

interface Suggestion {
  label: string;
  kind: 'alan' | 'fonksiyon';
  /** The whole expression after choosing this suggestion. */
  text: string;
  /** Caret position after insertion. */
  caret: number;
}

const MAX_SUGGESTIONS = 8;
const WORD_BEFORE_CARET = /[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Text box for a rule expression with live checking (the engine's own parser, so the
 * message and line/column match what the backend would say) and completion of field and
 * function names at the caret.
 */
@Component({
  selector: 'app-expression-editor',
  imports: [MatFormFieldModule, MatInputModule, MatAutocompleteModule],
  template: `
    <mat-form-field appearance="outline" class="expression" subscriptSizing="dynamic">
      <mat-label>{{ label() }}</mat-label>
      <textarea
        #box
        matInput
        rows="2"
        spellcheck="false"
        autocomplete="off"
        [value]="value() ?? ''"
        [readonly]="readonly()"
        [placeholder]="placeholder()"
        [matAutocomplete]="auto"
        [matAutocompleteDisabled]="readonly()"
        (input)="edited(box)"
        (keyup)="caret.set(box.selectionStart)"
        (click)="caret.set(box.selectionStart)"
      ></textarea>
      <mat-autocomplete #auto (optionSelected)="choose($event, box)">
        @for (suggestion of suggestions(); track suggestion.label) {
          <mat-option [value]="suggestion.text">
            <span class="name">{{ suggestion.label }}</span>
            <span class="kind">{{ suggestion.kind }}</span>
          </mat-option>
        }
      </mat-autocomplete>
      @if (problem(); as message) {
        <mat-hint class="problem">{{ message }}</mat-hint>
      } @else if (value()) {
        <mat-hint class="ok">Geçerli ifade</mat-hint>
      } @else {
        <mat-hint>{{ hint() }}</mat-hint>
      }
    </mat-form-field>
  `,
  styles: `
    .expression {
      width: 100%;
    }
    textarea {
      font-family: 'Roboto Mono', Consolas, monospace;
      font-size: 13px;
    }
    .problem {
      color: var(--mat-sys-error);
    }
    .ok {
      color: var(--mat-sys-primary);
    }
    .kind {
      margin-left: 8px;
      color: var(--mat-sys-on-surface-variant);
      font-size: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExpressionEditorComponent {
  readonly label = input.required<string>();
  readonly value = input<string | undefined>(undefined);
  /** Field ids this expression may read. */
  readonly names = input<readonly string[]>([]);
  readonly readonly = input(false);
  readonly placeholder = input('');
  readonly hint = input('Örn. hasLpg == true');

  readonly valueChange = output<string>();

  protected readonly caret = signal(0);
  /** Follows the input (e.g. after undo) and, between round trips, what the user typed. */
  private readonly current = linkedSignal(() => this.value() ?? '');

  protected readonly problem = computed(() => {
    const source = this.value();
    if (!source) return null;
    try {
      const unknown = compileExpression(source).variables.filter((name) => !this.names().includes(name));
      return unknown.length > 0 ? `'${unknown[0]}' adında bir alan yok` : null;
    } catch (error) {
      if (error instanceof ExpressionError) {
        return `${error.message} (satır ${error.line}, sütun ${error.column})`;
      }
      throw error;
    }
  });

  protected readonly suggestions = computed<Suggestion[]>(() => {
    const text = this.current();
    const caret = Math.min(this.caret(), text.length);
    const word = WORD_BEFORE_CARET.exec(text.slice(0, caret))?.[0];
    if (!word) return [];
    const start = caret - word.length;
    const lower = word.toLocaleLowerCase('en');
    const make = (label: string, insert: string, kind: Suggestion['kind']): Suggestion => ({
      label,
      kind,
      text: text.slice(0, start) + insert + text.slice(caret),
      caret: start + insert.length - (insert.endsWith('()') ? 1 : 0),
    });
    const fields = this.names()
      .filter((name) => name.toLocaleLowerCase('en').startsWith(lower) && name !== word)
      .map((name) => make(name, name, 'alan'));
    const functions = Object.keys(FUNCTIONS)
      .filter((name) => name.toLocaleLowerCase('en').startsWith(lower))
      .map((name) => make(`${name}()`, `${name}()`, 'fonksiyon'));
    return [...fields, ...functions].slice(0, MAX_SUGGESTIONS);
  });

  protected edited(box: HTMLTextAreaElement): void {
    this.current.set(box.value);
    this.caret.set(box.selectionStart);
    this.valueChange.emit(box.value);
  }

  protected choose(event: MatAutocompleteSelectedEvent, box: HTMLTextAreaElement): void {
    const chosen = this.suggestions().find((s) => s.text === event.option.value);
    const text = event.option.value as string;
    box.value = text;
    this.current.set(text);
    this.valueChange.emit(text);
    if (chosen) {
      box.setSelectionRange(chosen.caret, chosen.caret);
      this.caret.set(chosen.caret);
    }
  }
}
