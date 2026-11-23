import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { FormDefinition } from '../engine/model';
import { FieldError, FormSubmission, FormValues } from '../engine/renderer';

export interface FormSummary {
  formKey: string;
  title: string;
  publishedVersion: number | null;
  draftVersion: number | null;
  updatedAt: string;
}

export interface Submitted {
  id: number;
  formId: string;
  version: number;
  submittedAt: string;
}

export interface SubmissionView {
  id: number;
  formId: string;
  version: number;
  submittedAt: string;
  answers: FormValues;
}

export interface SubmissionPage {
  items: SubmissionView[];
  total: number;
  page: number;
  size: number;
}

export interface SubmissionQuery {
  formId?: string;
  field?: string;
  value?: string;
  page?: number;
  size?: number;
}

/** RFC 9457 problem details as the backend returns them. */
export interface Problem {
  status: number;
  title?: string;
  detail?: string;
  errors?: FieldError[];
}

/** Reads the problem body of a failed request, or describes a network failure. */
export function toProblem(error: unknown): Problem {
  // A network failure also carries an object (a ProgressEvent), so look for problem fields.
  const body = error instanceof HttpErrorResponse ? (error.error as Record<string, unknown> | null) : null;
  if (body && typeof body === 'object' && ('detail' in body || 'errors' in body || 'title' in body)) {
    return { status: (error as HttpErrorResponse).status, ...(body as Omit<Problem, 'status'>) };
  }
  const status = error instanceof HttpErrorResponse ? error.status : 0;
  return { status, detail: status === 0 ? 'Sunucuya ulaşılamadı.' : 'Beklenmeyen bir hata oluştu.' };
}

@Injectable({ providedIn: 'root' })
export class FormsApi {
  private readonly http = inject(HttpClient);

  definitions(): Observable<FormSummary[]> {
    return this.http.get<FormSummary[]>('/api/definitions');
  }

  /** The latest published version of a form. */
  publishedDefinition(formKey: string): Observable<FormDefinition> {
    return this.http.get<FormDefinition>(`/api/definitions/${encodeURIComponent(formKey)}`);
  }

  submit(submission: FormSubmission): Observable<Submitted> {
    return this.http.post<Submitted>('/api/submissions', submission);
  }

  submissions(query: SubmissionQuery): Observable<SubmissionPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    }
    return this.http.get<SubmissionPage>('/api/submissions', { params });
  }
}
