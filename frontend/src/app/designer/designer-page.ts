import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { catchError, firstValueFrom, map, of, startWith } from 'rxjs';

import { FormsApi, FormSummary, toProblem } from '../api/forms-api';

type ListState = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; forms: FormSummary[] };

/** All forms with their published and draft versions; entry point to the designer. */
@Component({
  selector: 'app-designer-page',
  imports: [RouterLink, MatButtonModule, MatIconModule, MatTableModule],
  template: `
    <header class="head">
      <h1>Form Tasarımcısı</h1>
      <a mat-flat-button routerLink="/designer/new">
        <mat-icon aria-hidden="true">add</mat-icon>
        Yeni form
      </a>
    </header>
    @if (error(); as message) {
      <p role="alert" class="error">{{ message }}</p>
    }
    @switch (state().status) {
      @case ('error') {
        <p role="alert">Formlar yüklenemedi. Backend çalışıyor mu?</p>
      }
      @case ('loaded') {
        <table mat-table [dataSource]="forms()">
          <ng-container matColumnDef="title">
            <th mat-header-cell *matHeaderCellDef>Form</th>
            <td mat-cell *matCellDef="let f">
              {{ f.title }} <span class="muted">{{ f.formKey }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="published">
            <th mat-header-cell *matHeaderCellDef>Yayında</th>
            <td mat-cell *matCellDef="let f">{{ f.publishedVersion ? 'v' + f.publishedVersion : '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="draft">
            <th mat-header-cell *matHeaderCellDef>Taslak</th>
            <td mat-cell *matCellDef="let f">{{ f.draftVersion ? 'v' + f.draftVersion : '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef><span class="visually-hidden">İşlemler</span></th>
            <td mat-cell *matCellDef="let f" class="actions">
              @if (f.draftVersion) {
                <a mat-stroked-button [routerLink]="['/designer', f.formKey, f.draftVersion]">Taslağı düzenle</a>
              } @else {
                <button mat-stroked-button type="button" (click)="newDraft(f)">Yeni versiyon</button>
              }
              @if (f.publishedVersion) {
                <a mat-button [routerLink]="['/designer', f.formKey, f.publishedVersion]">Görüntüle</a>
              }
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
        </table>
      }
    }
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .muted {
      margin-left: 6px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 6px 0;
    }
    .error {
      color: var(--mat-sys-error);
    }
    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignerPage {
  private readonly api = inject(FormsApi);
  private readonly router = inject(Router);

  protected readonly columns = ['title', 'published', 'draft', 'actions'];
  protected readonly error = signal<string | null>(null);
  protected readonly state = toSignal(
    this.api.definitions().pipe(
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

  protected async newDraft(form: FormSummary): Promise<void> {
    try {
      const info = await firstValueFrom(this.api.createDraft(form.formKey));
      await this.router.navigate(['/designer', info.formKey, info.version]);
    } catch (error) {
      this.error.set(toProblem(error).detail ?? 'Taslak açılamadı.');
    }
  }
}
