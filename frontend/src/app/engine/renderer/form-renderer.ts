import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  input,
  OnDestroy,
  OnInit,
  output,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MAT_NATIVE_DATE_FORMATS } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { debounceTime } from 'rxjs';

import { FieldComponent } from '../fields/field';
import { FormDefinition } from '../model';
import { FormValues } from './field-value';
import { FieldError, RenderedForm, StepState } from './rendered-form';
import { TrDateAdapter } from './tr-date-adapter';

/** What the user has entered so far; pass it back as `draft` to resume. */
export interface FormDraft {
  values: FormValues;
  /** Index among the steps visible at the time. */
  step: number;
  savedAt: string;
}

export interface FormSubmission {
  formId: string;
  version: number;
  /** Effective values: hidden fields null, computed fields included. */
  values: FormValues;
}

/**
 * Renders a form definition as a Material stepper. Each step is validated before moving on,
 * hidden steps are skipped, and a draft is emitted as the user types.
 */
@Component({
  selector: 'dyn-form-renderer',
  imports: [ReactiveFormsModule, MatStepperModule, MatButtonModule, MatIconModule, FieldComponent],
  templateUrl: './form-renderer.html',
  styleUrl: './form-renderer.scss',
  // Field components are rendered inside this one; their `dyn-*` classes are styled here.
  encapsulation: ViewEncapsulation.None,
  providers: [
    { provide: DateAdapter, useClass: TrDateAdapter },
    { provide: MAT_DATE_LOCALE, useValue: 'tr-TR' },
    { provide: MAT_DATE_FORMATS, useValue: MAT_NATIVE_DATE_FORMATS },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormRendererComponent implements OnInit, OnDestroy {
  readonly definition = input.required<FormDefinition>();
  readonly draft = input<FormDraft | null>(null);
  /** Today as `YYYY-MM-DD`; for tests. */
  readonly today = input<(() => string) | undefined>(undefined);
  /** True while the host is sending a submission: the submit button is disabled. */
  readonly busy = input(false);

  readonly submitted = output<FormSubmission>();
  readonly draftChange = output<FormDraft>();

  private readonly stepper = viewChild.required(MatStepper);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected form!: RenderedForm;

  ngOnInit(): void {
    const draft = this.draft();
    this.form = new RenderedForm(this.definition(), {
      injector: this.injector,
      initialValues: draft?.values,
      today: this.today(),
    });
    this.form.root.valueChanges
      .pipe(debounceTime(400), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.emitDraft());
    if (draft && draft.step > 0) {
      afterNextRender(
        () => {
          const stepper = this.stepper();
          const target = Math.min(draft.step, stepper.steps.length - 1);
          // A linear stepper treats steps the user never visited as incomplete; these were, in the earlier session.
          stepper.steps.toArray().slice(0, target).forEach((step) => (step.interacted = true));
          stepper.selectedIndex = target;
        },
        { injector: this.injector },
      );
    }
  }

  ngOnDestroy(): void {
    this.form.destroy();
  }

  protected next(step: StepState): void {
    step.group.markAllAsTouched();
    if (step.group.invalid) {
      this.focusFirstInvalid();
      return;
    }
    this.stepper().next();
  }

  protected submit(): void {
    if (this.busy()) return;
    this.form.root.markAllAsTouched();
    if (this.form.root.invalid) {
      const firstInvalid = this.form.visibleSteps().findIndex((s) => s.group.invalid);
      if (firstInvalid >= 0) {
        this.stepper().selectedIndex = firstInvalid;
      }
      this.focusFirstInvalid();
      return;
    }
    const definition = this.definition();
    this.submitted.emit({ formId: definition.id, version: definition.version, values: this.form.value() });
  }

  /**
   * Shows errors the server returned for a submission on their fields and moves to the first
   * one's step. Returns the errors that belong to no field, for the host to show elsewhere.
   */
  showServerErrors(errors: readonly FieldError[]): FieldError[] {
    const unmatched = this.form.applyServerErrors(errors);
    const steps = errors.map((e) => this.form.stepIndexOf(e.field)).filter((i) => i >= 0);
    if (steps.length > 0) {
      const target = Math.min(...steps);
      const stepper = this.stepper();
      stepper.steps.toArray().slice(0, target).forEach((step) => (step.interacted = true));
      stepper.selectedIndex = target;
      this.focusFirstInvalid();
    }
    return unmatched;
  }

  protected emitDraft(): void {
    this.draftChange.emit({
      values: this.form.draftValue(),
      step: this.stepper().selectedIndex,
      savedAt: new Date().toISOString(),
    });
  }

  /** Moves focus to the first field with an error in the current step, once errors are rendered. */
  private focusFirstInvalid(): void {
    afterNextRender(
      () => {
        const current = this.host.nativeElement.querySelector('[role="tabpanel"][aria-expanded="true"]');
        // Not aria-invalid: Material leaves it off empty required inputs on purpose.
        const target = (current ?? this.host.nativeElement).querySelector<HTMLElement>(
          'input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid, mat-radio-group.ng-invalid input',
        );
        target?.focus();
      },
      { injector: this.injector },
    );
  }
}
