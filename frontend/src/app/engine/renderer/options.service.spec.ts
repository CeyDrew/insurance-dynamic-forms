import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OptionsService } from './options.service';

describe('OptionsService', () => {
  let service: OptionsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(OptionsService);
    http = TestBed.inject(HttpTestingController);
  });

  it('fetches a URL once and shares it between fields and later subscribers', () => {
    const results: unknown[] = [];
    service.load('/api/lookups/cities').subscribe((o) => results.push(o));
    service.load('/api/lookups/cities').subscribe((o) => results.push(o));

    http.expectOne('/api/lookups/cities').flush([{ value: '34', label: 'İstanbul' }]);
    service.load('/api/lookups/cities').subscribe((o) => results.push(o));

    http.verify();
    expect(results).toHaveLength(3);
  });

  it('does not cache a failure, so the next field retries', () => {
    const errors: unknown[] = [];
    service.load('/api/lookups/cities').subscribe({ error: (e) => errors.push(e) });
    http.expectOne('/api/lookups/cities').flush('down', { status: 503, statusText: 'Unavailable' });

    const results: unknown[] = [];
    service.load('/api/lookups/cities').subscribe((o) => results.push(o));
    http.expectOne('/api/lookups/cities').flush([]);

    expect(errors).toHaveLength(1);
    expect(results).toEqual([[]]);
  });
});
