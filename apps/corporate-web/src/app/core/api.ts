import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api-base';

export interface Job { id: number; slug: string; title: string; team: string; location: string; employment: string; summary: string; }
export interface PressSummary { slug: string; title: string; summary: string; publishedAt: string; }
export interface PressArticle extends PressSummary { body: string; }
export interface ContactRequest { name: string; email: string; topic: string; organisation?: string; message: string; website?: string; }
export interface ApplicationRequest { jobSlug?: string; name: string; email: string; profileUrl?: string; message: string; website?: string; }

/** What a failed call looks like to a form: a sentence to show, and messages per field. */
export interface ApiProblem { message: string; fields: Record<string, string>; }

export function problemFrom(error: unknown): ApiProblem {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as { message?: string; fields?: Record<string, string> } | null;
    if (error.status === 0) return { message: 'We could not reach our servers. Please check your connection and try again, or email us.', fields: {} };
    if (error.status === 429) return { message: 'Too many requests. Please wait a minute and try again.', fields: {} };
    return { message: body?.message ?? 'Something went wrong. Please try again.', fields: body?.fields ?? {} };
  }
  return { message: 'Something went wrong. Please try again.', fields: {} };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  jobs(): Observable<Job[]> { return this.http.get<Job[]>(`${API_BASE}/jobs`); }
  press(): Observable<PressSummary[]> { return this.http.get<PressSummary[]>(`${API_BASE}/press`); }
  article(slug: string): Observable<PressArticle> { return this.http.get<PressArticle>(`${API_BASE}/press/${encodeURIComponent(slug)}`); }
  contact(body: ContactRequest): Observable<unknown> { return this.http.post(`${API_BASE}/contact`, body); }
  apply(body: ApplicationRequest): Observable<unknown> { return this.http.post(`${API_BASE}/applications`, body); }
  subscribe(email: string): Observable<unknown> { return this.http.post(`${API_BASE}/newsletter/subscribe`, { email }); }
}
