import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, firstValueFrom, of, switchMap } from 'rxjs';

import { FormsApi, toProblem, VersionInfo } from '../api/forms-api';
import { DefinitionError, DefinitionValidationReport, FormDefinition } from '../engine/model';
import { blankDefinition } from './designer-model';

export type Selection = { kind: 'form' } | { kind: 'step'; id: string } | { kind: 'field'; id: string };

export interface ServerState {
  formKey: string | null;
  version: number | null;
  status: 'NEW' | 'DRAFT' | 'PUBLISHED';
}

/** Consecutive edits with the same merge key within this time become one undo step. */
const MERGE_WINDOW_MS = 1500;
const HISTORY_LIMIT = 100;

/**
 * State of one designer session: the definition being edited, the selection, undo/redo
 * history, and the server-side version. The backend validates the definition as it changes,
 * so the designer shows exactly the errors that would block saving.
 */
@Injectable()
export class DesignerStore {
  private readonly api = inject(FormsApi);

  readonly definition = signal<FormDefinition>(blankDefinition());
  readonly selection = signal<Selection>({ kind: 'form' });
  readonly server = signal<ServerState>({ formKey: null, version: null, status: 'NEW' });
  readonly dirty = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  /** Latest validation result; `null` until the first check or when the server is unreachable. */
  readonly report = signal<DefinitionValidationReport | null>(null);

  private readonly past = signal<FormDefinition[]>([]);
  private readonly future = signal<FormDefinition[]>([]);
  private lastMerge: { key: string; at: number } | null = null;

  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);
  readonly readOnly = computed(() => this.server().status === 'PUBLISHED');
  readonly errors = computed(() => this.report()?.errors ?? []);

  /** Errors grouped by the step or field they belong to (by id), for badges on the canvas. */
  readonly errorsByOwner = computed(() => {
    const byOwner = new Map<string, DefinitionError[]>();
    for (const error of this.errors()) {
      const owner = ownerOf(this.definition(), error.path) ?? '';
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), error]);
    }
    return byOwner;
  });

  constructor() {
    toObservable(this.definition)
      .pipe(
        debounceTime(300),
        switchMap((definition) => this.api.validate(definition).pipe(catchError(() => of(null)))),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((report) => this.report.set(report));
  }

  /** Starts a session on a definition; clears history. */
  load(definition: FormDefinition, server: ServerState): void {
    this.definition.set(definition);
    this.server.set(server);
    this.selection.set({ kind: 'form' });
    this.past.set([]);
    this.future.set([]);
    this.lastMerge = null;
    this.dirty.set(false);
    this.saveError.set(null);
  }

  /**
   * Applies an edit. Edits sharing `mergeKey` in quick succession (typing in a property
   * field) are undone together.
   */
  apply(change: (definition: FormDefinition) => FormDefinition, mergeKey?: string): void {
    if (this.readOnly()) return;
    const current = this.definition();
    const next = change(current);
    if (next === current) return;
    const now = Date.now();
    const merge = mergeKey && this.lastMerge?.key === mergeKey && now - this.lastMerge.at < MERGE_WINDOW_MS;
    if (!merge) {
      this.past.update((past) => [...past, current].slice(-HISTORY_LIMIT));
    }
    this.lastMerge = mergeKey ? { key: mergeKey, at: now } : null;
    this.future.set([]);
    this.definition.set(next);
    this.dirty.set(true);
  }

  undo(): void {
    const past = this.past();
    if (past.length === 0 || this.readOnly()) return;
    this.future.update((future) => [this.definition(), ...future]);
    this.past.set(past.slice(0, -1));
    this.definition.set(past[past.length - 1]);
    this.afterHistoryMove();
  }

  redo(): void {
    const [next, ...rest] = this.future();
    if (!next || this.readOnly()) return;
    this.past.update((past) => [...past, this.definition()]);
    this.future.set(rest);
    this.definition.set(next);
    this.afterHistoryMove();
  }

  select(selection: Selection): void {
    this.selection.set(selection);
  }

  /** Creates the form or updates its draft. Resolves to false when the server refused it. */
  async save(): Promise<boolean> {
    const server = this.server();
    if (server.status === 'PUBLISHED') return false;
    this.saving.set(true);
    this.saveError.set(null);
    try {
      const definition = this.definition();
      const info = await firstValueFrom(
        server.status === 'NEW'
          ? this.api.createDefinition(definition)
          : this.api.updateDefinition(server.formKey!, server.version!, definition),
      );
      this.saved(info);
      return true;
    } catch (error) {
      this.failed(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  /** Saves pending changes, then publishes. A published version is read-only from then on. */
  async publish(): Promise<boolean> {
    if (this.dirty() || this.server().status === 'NEW') {
      if (!(await this.save())) return false;
    }
    const { formKey, version } = this.server();
    this.saving.set(true);
    try {
      this.saved(await firstValueFrom(this.api.publish(formKey!, version!)));
      return true;
    } catch (error) {
      this.failed(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  /** Opens a new draft version copied from the published one. */
  async openNewDraft(): Promise<boolean> {
    const formKey = this.server().formKey!;
    this.saving.set(true);
    try {
      const info = await firstValueFrom(this.api.createDraft(formKey));
      const definition = await firstValueFrom(this.api.definitionVersion(formKey, info.version));
      this.load(definition, { formKey, version: info.version, status: info.status });
      return true;
    } catch (error) {
      this.failed(error);
      return false;
    } finally {
      this.saving.set(false);
    }
  }

  private saved(info: VersionInfo): void {
    this.server.set({ formKey: info.formKey, version: info.version, status: info.status });
    // The server owns version numbers; mirror it without making it an undoable edit.
    this.definition.update((d) => (d.version === info.version ? d : { ...d, version: info.version }));
    this.dirty.set(false);
  }

  private failed(error: unknown): void {
    const problem = toProblem(error);
    this.saveError.set(problem.detail ?? 'Kaydedilemedi.');
    if (problem.status === 400 && problem.errors) {
      this.report.set({ valid: false, errors: problem.errors as unknown as DefinitionError[] });
    }
  }

  private afterHistoryMove(): void {
    this.lastMerge = null;
    this.dirty.set(true);
    // Keep the selection only if what it points at still exists.
    const selection = this.selection();
    const definition = this.definition();
    if (selection.kind === 'field' && !ownerExists(definition, selection.id)) this.selection.set({ kind: 'form' });
    if (selection.kind === 'step' && !definition.steps.some((s) => s.id === selection.id)) {
      this.selection.set({ kind: 'form' });
    }
  }
}

/** The id of the step or field an error path such as `steps[0].fields[2].fields[1].label` points into. */
export function ownerOf(definition: FormDefinition, path: string): string | undefined {
  const match = /^steps\[(\d+)\](?:\.fields\[(\d+)\](?:\.fields\[(\d+)\])?)?/.exec(path);
  if (!match) return undefined;
  const step = definition.steps[Number(match[1])];
  if (!step) return undefined;
  if (match[2] === undefined) return step.id;
  const field = step.fields[Number(match[2])];
  if (!field || match[3] === undefined) return field?.id;
  return field.type === 'repeater' ? field.fields[Number(match[3])]?.id : field.id;
}

function ownerExists(definition: FormDefinition, id: string): boolean {
  return definition.steps.some((s) =>
    s.fields.some((f) => f.id === id || (f.type === 'repeater' && f.fields.some((c) => c.id === id))),
  );
}
