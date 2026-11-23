import { computed, Directive, effect, input, signal } from '@angular/core';

import { FieldControl, FieldState } from '../renderer/rendered-form';
import { errorMessage } from '../renderer/validators';

/** Shared inputs and ARIA ids for field components. */
@Directive()
export abstract class FieldBase {
  readonly state = input.required<FieldState>();

  protected readonly field = computed(() => this.state().field);
  protected readonly control = computed(() => this.state().control as FieldControl);
  protected readonly labelId = computed(() => `${this.state().domId}-label`);
  protected readonly hintId = computed(() => `${this.state().domId}-hint`);
  protected readonly errorId = computed(() => `${this.state().domId}-error`);

  /** Bumped on every control event so OnPush templates see status and touched changes. */
  private readonly controlEvents = signal(0);

  /** Message for the control's first error, shown inside `mat-error` (which decides visibility itself). */
  protected readonly error = computed(() => {
    this.controlEvents();
    const control = this.state().control;
    return control?.invalid ? errorMessage(this.field(), control) : null;
  });

  /** Same message, but only once the user has touched the control: for controls outside `mat-form-field`. */
  protected readonly touchedError = computed(() => {
    this.controlEvents();
    return this.state().control?.touched ? this.error() : null;
  });

  /** `aria-describedby` for controls outside `mat-form-field`. */
  protected readonly describedBy = computed(() => {
    const ids = [this.field().hint ? this.hintId() : null, this.touchedError() ? this.errorId() : null];
    return ids.filter(Boolean).join(' ') || null;
  });

  constructor() {
    effect((onCleanup) => {
      const control = this.state().control;
      if (!control) return;
      const subscription = control.events.subscribe(() => this.controlEvents.update((n) => n + 1));
      onCleanup(() => subscription.unsubscribe());
    });
  }
}
