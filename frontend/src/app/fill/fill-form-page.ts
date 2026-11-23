import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { FormsApi, Submitted, toProblem } from '../api/forms-api';
import { FormDefinition } from '../engine/model';
import { FormDraft, FormRendererComponent, FormSubmission } from '../engine/renderer';
import { DraftStore } from './draft-store';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; definition: FormDefinition };

/**
 * Fills the latest published version of a form. Offers to resume a saved draft, saves a new
 * one as the user types, and sends the answers to the server, which validates them again.
 */
@Component({
  selector: 'app-fill-form-page',
  imports: [
    RouterLink,
    JsonPipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    FormRendererComponent,
  ],
  templateUrl: './fill-form-page.html',
  styleUrl: './fill-form-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FillFormPage {
  /** Route parameter. */
  readonly id = input.required<string>();

  private readonly api = inject(FormsApi);
  private readonly drafts = inject(DraftStore);
  private readonly renderer = viewChild(FormRendererComponent);

  protected readonly load = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        this.api.publishedDefinition(id).pipe(
          map((definition): Load => ({ status: 'loaded', definition })),
          catchError(() => of<Load>({ status: 'error' })),
          startWith<Load>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as Load },
  );

  protected readonly definition = computed(() => {
    const load = this.load();
    return load.status === 'loaded' ? load.definition : null;
  });

  /** Draft found on arrival, waiting for the user to resume or discard it. */
  protected readonly pendingDraft = computed(() => {
    const definition = this.definition();
    if (!definition || this.draftDecided()) return null;
    return this.drafts.load(definition.id, definition.version);
  });
  private readonly draftDecided = signal(false);

  /** Draft the renderer starts from. */
  protected readonly startDraft = signal<FormDraft | null>(null);
  /** Bumped to recreate the renderer from scratch. */
  protected readonly session = signal(0);
  protected readonly lastSaved = signal<Date | null>(null);
  protected readonly sending = signal(false);
  /** Problems the server reported that belong to no single field. */
  protected readonly submitError = signal<string[]>([]);
  protected readonly result = signal<{ submitted: Submitted; values: FormSubmission['values'] } | null>(null);

  protected resume(draft: FormDraft): void {
    this.startDraft.set(draft);
    this.draftDecided.set(true);
  }

  protected startOver(): void {
    const definition = this.definition()!;
    this.drafts.clear(definition.id, definition.version);
    this.startDraft.set(null);
    this.lastSaved.set(null);
    this.result.set(null);
    this.submitError.set([]);
    this.draftDecided.set(true);
    this.session.update((n) => n + 1);
  }

  protected saveDraft(draft: FormDraft): void {
    const definition = this.definition()!;
    if (this.result()) return;
    this.drafts.save(definition.id, definition.version, draft);
    this.lastSaved.set(new Date(draft.savedAt));
  }

  protected submit(submission: FormSubmission): void {
    this.sending.set(true);
    this.submitError.set([]);
    this.api.submit(submission).subscribe({
      next: (submitted) => {
        this.sending.set(false);
        this.drafts.clear(submission.formId, submission.version);
        this.result.set({ submitted, values: submission.values });
      },
      error: (error: unknown) => {
        this.sending.set(false);
        const problem = toProblem(error);
        if (problem.status === 400 && problem.errors?.length) {
          // The server re-checks every rule; anything it rejected is shown on its field.
          const unmatched = this.renderer()?.showServerErrors(problem.errors) ?? problem.errors;
          this.submitError.set(
            unmatched.length > 0
              ? unmatched.map((e) => `${e.field}: ${e.message}`)
              : ['Sunucu bazı cevapları kabul etmedi; işaretli alanları düzeltin.'],
          );
        } else {
          this.submitError.set([problem.detail ?? 'Gönderilemedi.']);
        }
      },
    });
  }

  protected formatTime(date: Date | string): string {
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
  }
}
