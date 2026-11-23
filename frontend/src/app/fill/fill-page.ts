import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith } from 'rxjs';

export interface FormSummary {
  id: string;
  version: number;
  title: string;
  description?: string;
}

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; forms: FormSummary[] };

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
          @for (form of forms(); track form.id) {
            <li>
              <mat-card appearance="outlined">
                <mat-card-header>
                  <mat-card-title>{{ form.title }}</mat-card-title>
                  <mat-card-subtitle>{{ form.id }} · v{{ form.version }}</mat-card-subtitle>
                </mat-card-header>
                @if (form.description) {
                  <mat-card-content>
                    <p>{{ form.description }}</p>
                  </mat-card-content>
                }
                <mat-card-actions>
                  <a mat-flat-button [routerLink]="['/fill', form.id]">Doldur</a>
                </mat-card-actions>
              </mat-card>
            </li>
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
  private readonly http = inject(HttpClient);

  protected readonly state = toSignal(
    this.http.get<FormSummary[]>('/api/examples').pipe(
      map((forms): ListState => ({ status: 'loaded', forms })),
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
