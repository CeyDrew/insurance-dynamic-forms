import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorIntl, MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { catchError, map, of, startWith, switchMap } from 'rxjs';

import { FormsApi, SubmissionPage, SubmissionQuery, SubmissionView, toProblem } from '../api/forms-api';
import { TrPaginatorIntl } from '../tr-paginator-intl';

type PageState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'loaded'; page: SubmissionPage };

const PAGE_SIZE = 10;

/**
 * Submitted answers, newest first. The answer filter runs on the server as an Oracle
 * JSON_EXISTS query over the stored JSON, e.g. `hasLpg = true` for vehicles with LPG.
 */
@Component({
  selector: 'app-submissions-page',
  imports: [
    FormsModule,
    JsonPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: './submissions-page.html',
  styleUrl: './submissions-page.scss',
  // Provided here, not app-wide, so the paginator stays out of the initial bundle.
  providers: [{ provide: MatPaginatorIntl, useClass: TrPaginatorIntl }],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubmissionsPage {
  /** Query parameter, e.g. coming from the "submitted" screen. */
  readonly formId = input<string | undefined>(undefined);

  private readonly api = inject(FormsApi);

  protected readonly forms = toSignal(this.api.definitions().pipe(catchError(() => of([]))), { initialValue: [] });

  // Filter inputs, applied with the button.
  protected selectedForm = signal('');
  protected field = signal('');
  protected value = signal('');

  private readonly query = signal<SubmissionQuery>({ page: 0, size: PAGE_SIZE });
  protected readonly expanded = signal<number | null>(null);
  protected readonly columns = ['id', 'form', 'submittedAt', 'summary', 'expand'];

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      switchMap((query) =>
        this.api.submissions(query).pipe(
          map((page): PageState => ({ status: 'loaded', page })),
          catchError((error: unknown) =>
            of<PageState>({ status: 'error', message: toProblem(error).errors?.[0]?.message ?? 'Cevaplar yüklenemedi.' }),
          ),
          startWith<PageState>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as PageState },
  );

  protected readonly page = computed(() => {
    const state = this.state();
    return state.status === 'loaded' ? state.page : null;
  });

  constructor() {
    effect(() => {
      const formId = this.formId();
      if (formId) {
        this.selectedForm.set(formId);
        this.query.set({ formId, page: 0, size: PAGE_SIZE });
      }
    });
  }

  protected apply(): void {
    this.expanded.set(null);
    this.query.set({
      formId: this.selectedForm() || undefined,
      field: this.field().trim() || undefined,
      value: this.field().trim() ? this.value().trim() : undefined,
      page: 0,
      size: PAGE_SIZE,
    });
  }

  protected example(): void {
    this.selectedForm.set('casco-risk');
    this.field.set('hasLpg');
    this.value.set('true');
    this.apply();
  }

  protected changePage(event: PageEvent): void {
    this.expanded.set(null);
    this.query.update((q) => ({ ...q, page: event.pageIndex, size: event.pageSize }));
  }

  protected toggle(row: SubmissionView): void {
    this.expanded.update((id) => (id === row.id ? null : row.id));
  }

  /** A few answered scalar values, for a quick look at the row. */
  protected summary(row: SubmissionView): string {
    return Object.entries(row.answers)
      .filter(([, v]) => v !== null && typeof v !== 'object')
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' · ');
  }

  protected formatTime(date: string): string {
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(date));
  }
}
