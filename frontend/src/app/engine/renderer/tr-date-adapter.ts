import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/**
 * Native date adapter that understands dates typed as `GG.AA.YYYY` (also `/` or `-` separated).
 * The native `Date.parse` reads `03.04.2026` as March 4th or not at all, depending on the browser.
 */
@Injectable()
export class TrDateAdapter extends NativeDateAdapter {
  override parse(value: unknown, parseFormat?: unknown): Date | null {
    if (typeof value === 'string') {
      const text = value.trim();
      if (text === '') return null;
      const match = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
      if (!match) return this.invalid();
      const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
      const date = new Date(year, month - 1, day);
      const exists = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
      return exists ? date : this.invalid();
    }
    return super.parse(value, parseFormat);
  }
}
