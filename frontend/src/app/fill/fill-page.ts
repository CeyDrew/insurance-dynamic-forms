import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith } from 'rxjs';

import { FormsApi, FormSummary } from '../api/forms-api';

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; forms: FormSummary[] };

/** Published forms a customer or agent can fill in. */
@Component({
  selector: 'app-fill-page',
  imports: [RouterLink, MatCardModule, MatButtonModule, MatProgressSpinnerModule],
  template: `
    <h1>Form Doldur</h1>
    @switch (state().status) {
      @case ('loading') {
        <mat-spinner diameter="32" aria-label="Formlar yükleniyor" />
      }
      @case ('error') {
        <p role="alert">Formlar yüklenemedi. Backend çalışıyor mu? (<code>./mvnw spring-boot:run</code>)</p>
      }
      @case ('loaded') {
        <ul class="form-list">
          @for (form of forms(); track form.formKey) {
            <li>
              <mat-card appearance="outlined">
                <mat-card-header>
                  <mat-card-title>{{ form.title }}</mat-card-title>
                  <mat-card-subtitle>{{ form.formKey }} · v{{ form.publishedVersion }}</mat-card-subtitle>
                </mat-card-header>
                <mat-card-actions>
                  <a mat-flat-button [routerLink]="['/fill', form.formKey]">Doldur</a>
                </mat-card-actions>
              </mat-card>
            </li>
          } @empty {
            <p>Yayınlanmış form yok.</p>
          }
        </ul>
      }
    }
  `,
  styles: `
    .form-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      padding: 0;
      list-style: none;
    }
    mat-card {
      height: 100%;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FillPage {
  protected readonly state = toSignal(
    inject(FormsApi)
      .definitions()
      .pipe(
        map((all): ListState => ({ status: 'loaded', forms: all.filter((f) => f.publishedVersion !== null) })),
        catchError(() => of<ListState>({ status: 'error' })),
        startWith<ListState>({ status: 'loading' }),
      ),
    { requireSync: true },
  );

  protected forms(): FormSummary[] {
    const state = this.state();
    return state.status === 'loaded' ? state.forms : [];
  }
}
