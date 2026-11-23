import { DragDropModule } from '@angular/cdk/drag-drop';
import { JsonPipe, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { FormsApi, toProblem } from '../api/forms-api';
import { FormDefinition } from '../engine/model';
import { FormRendererComponent } from '../engine/renderer';
import { FormRules } from '../engine/rules';
import { DesignerCanvasComponent, PaletteComponent } from './designer-canvas';
import { blankDefinition } from './designer-model';
import { DesignerStore, ownerOf } from './designer-store';
import { PropertiesPanelComponent } from './properties-panel';

/**
 * The form designer: palette, canvas and properties, with a live preview that is the real
 * renderer, the JSON being built, undo/redo, and the draft → publish flow of the API.
 */
@Component({
  selector: 'app-designer-editor',
  imports: [
    DragDropModule,
    JsonPipe,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTabsModule,
    MatTooltipModule,
    FormRendererComponent,
    PaletteComponent,
    DesignerCanvasComponent,
    PropertiesPanelComponent,
  ],
  providers: [DesignerStore],
  templateUrl: './designer-editor.html',
  styleUrl: './designer-editor.scss',
  host: { '(document:keydown)': 'shortcut($event)' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DesignerEditorPage {
  /** Route parameters; both absent for a new form. */
  readonly formKey = input<string | undefined>(undefined);
  readonly version = input<string | undefined>(undefined);

  protected readonly store = inject(DesignerStore);
  private readonly api = inject(FormsApi);
  private readonly location = inject(Location);

  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly copied = signal(false);
  protected readonly showErrors = signal(false);

  protected readonly status = computed(() => {
    const server = this.store.server();
    switch (server.status) {
      case 'NEW':
        return 'Yeni form · kaydedilmedi';
      case 'DRAFT':
        return `Taslak · v${server.version}${this.store.dirty() ? ' · kaydedilmemiş değişiklik var' : ''}`;
      case 'PUBLISHED':
        return `Yayında · v${server.version} · salt okunur`;
    }
  });

  /** The preview runs the real renderer, which needs every rule to compile. */
  protected readonly previewProblem = computed(() => {
    const definition = this.store.definition();
    if (definition.steps.every((s) => s.fields.length === 0)) return 'Önizleme için en az bir alan ekleyin.';
    try {
      new FormRules(definition);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  });

  constructor() {
    effect(() => {
      const formKey = this.formKey();
      const version = Number(this.version());
      untracked(() => (formKey && version ? this.open(formKey, version) : this.store.load(blankDefinition(), {
        formKey: null,
        version: null,
        status: 'NEW',
      })));
    });
  }

  private async open(formKey: string, version: number): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const [definition, versions] = await Promise.all([
        firstValueFrom(this.api.definitionVersion(formKey, version)),
        firstValueFrom(this.api.versions(formKey)),
      ]);
      const info = versions.find((v) => v.version === version)!;
      this.store.load(definition, { formKey, version, status: info.status });
    } catch (error) {
      this.loadError.set(toProblem(error).detail ?? 'Form yüklenemedi.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async save(): Promise<void> {
    if (await this.guardNewKey()) {
      if (await this.store.save()) this.syncUrl();
    }
  }

  protected async publish(): Promise<void> {
    if (this.store.server().status === 'NEW' && !(await this.guardNewKey())) return;
    if (await this.store.publish()) this.syncUrl();
  }

  protected async newDraft(): Promise<void> {
    if (await this.store.openNewDraft()) this.syncUrl();
  }

  protected selectError(path: string): void {
    const owner = ownerOf(this.store.definition(), path);
    const definition = this.store.definition();
    if (!owner) {
      this.store.select({ kind: 'form' });
    } else if (definition.steps.some((s) => s.id === owner)) {
      this.store.select({ kind: 'step', id: owner });
    } else {
      this.store.select({ kind: 'field', id: owner });
    }
  }

  protected async copyJson(): Promise<void> {
    await navigator.clipboard?.writeText(JSON.stringify(this.store.definition(), null, 2));
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }

  /** Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z / Ctrl+S, except while typing, where the browser's own undo applies. */
  protected shortcut(event: KeyboardEvent): void {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === 's') {
      event.preventDefault();
      void this.save();
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, [contenteditable]')) return;
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      this.store.undo();
    } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      this.store.redo();
    }
  }

  /**
   * POST /api/definitions with an existing id would silently add a version to that form,
   * so a new form must have an unused id.
   */
  private async guardNewKey(): Promise<boolean> {
    if (this.store.server().status !== 'NEW') return true;
    const formKey = this.store.definition().id;
    try {
      await firstValueFrom(this.api.versions(formKey));
      this.store.saveError.set(`'${formKey}' id'si başka bir formda kullanılıyor; form id'sini değiştirin.`);
      this.store.select({ kind: 'form' });
      return false;
    } catch {
      return true; // 404: free
    }
  }

  /** After the first save the URL points at the stored version, without reloading the editor. */
  private syncUrl(): void {
    const { formKey, version } = this.store.server();
    this.location.replaceState(`/designer/${formKey}/${version}`);
  }

  protected readonly asDefinition = (d: FormDefinition) => d;
}
