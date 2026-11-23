import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { JsonPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { FormDefinition } from '../engine/model';
import { FormDraft, FormRendererComponent, FormSubmission } from '../engine/renderer';
import { DraftStore } from './draft-store';

type Load = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; definition: FormDefinition };

/**
 * Fills one form. Offers to resume a saved draft, saves a new one as the user types,
 * and shows what would be submitted (the submission API arrives in phase 4).
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

  private readonly http = inject(HttpClient);
  private readonly drafts = inject(DraftStore);

  protected readonly load = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        this.http.get<FormDefinition>(`/api/examples/${encodeURIComponent(id)}`).pipe(
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
  protected readonly submission = signal<FormSubmission | null>(null);

  protected resume(draft: FormDraft): void {
    this.startDraft.set(draft);
    this.draftDecided.set(true);
  }

  protected startOver(): void {
    const definition = this.definition()!;
    this.drafts.clear(definition.id, definition.version);
    this.startDraft.set(null);
    this.lastSaved.set(null);
    this.submission.set(null);
    this.draftDecided.set(true);
    this.session.update((n) => n + 1);
  }

  protected saveDraft(draft: FormDraft): void {
    const definition = this.definition()!;
    if (this.submission()) return;
    this.drafts.save(definition.id, definition.version, draft);
    this.lastSaved.set(new Date(draft.savedAt));
  }

  protected submitted(submission: FormSubmission): void {
    this.drafts.clear(submission.formId, submission.version);
    this.submission.set(submission);
  }

  protected formatTime(date: Date | string): string {
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
  }
}
