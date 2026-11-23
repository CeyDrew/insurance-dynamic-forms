import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';

import { OptionDefinition } from '../model';

/**
 * Loads `optionsSource: remote` lists. Each URL is fetched once and shared by every field
 * and repeater row that uses it; a failed request is not cached, so the next field retries.
 */
@Injectable({ providedIn: 'root' })
export class OptionsService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<OptionDefinition[]>>();

  load(url: string): Observable<OptionDefinition[]> {
    let options = this.cache.get(url);
    if (!options) {
      options = this.http.get<OptionDefinition[]>(url).pipe(
        catchError((error: unknown) => {
          this.cache.delete(url);
          return throwError(() => error);
        }),
        shareReplay(1),
      );
      this.cache.set(url, options);
    }
    return options;
  }
}
