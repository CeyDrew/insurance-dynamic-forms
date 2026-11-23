import { Injectable } from '@angular/core';

import { FormDraft } from '../engine/renderer';

/**
 * Keeps one draft per form version in localStorage. A draft from another version is
 * ignored rather than migrated: the questions may have changed.
 */
@Injectable({ providedIn: 'root' })
export class DraftStore {
  load(formId: string, version: number): FormDraft | null {
    try {
      const raw = localStorage.getItem(this.key(formId, version));
      return raw ? (JSON.parse(raw) as FormDraft) : null;
    } catch {
      return null;
    }
  }

  save(formId: string, version: number, draft: FormDraft): void {
    try {
      localStorage.setItem(this.key(formId, version), JSON.stringify(draft));
    } catch {
      // Storage full or disabled: drafts are a convenience, filling the form still works.
    }
  }

  clear(formId: string, version: number): void {
    try {
      localStorage.removeItem(this.key(formId, version));
    } catch {
      // See save().
    }
  }

  private key(formId: string, version: number): string {
    return `dyn-forms:draft:${formId}:v${version}`;
  }
}
