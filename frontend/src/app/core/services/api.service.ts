import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

/**
 * Thin wrapper around HttpClient with the backend base URL baked in.
 * Keeping this centralized means changing the API host/port (or later,
 * adding auth headers if this ever becomes multi-user) only happens here.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api';

  get<T>(path: string, params?: Record<string, string | number | boolean | undefined>): import('rxjs').Observable<T> {
    return this.http.get<T>(`${this.baseUrl}${path}`, { params: this.cleanParams(params) });
  }

  post<T>(path: string, body: unknown): import('rxjs').Observable<T> {
    return this.http.post<T>(`${this.baseUrl}${path}`, body);
  }

  patch<T>(path: string, body: unknown): import('rxjs').Observable<T> {
    return this.http.patch<T>(`${this.baseUrl}${path}`, body);
  }

  delete<T>(path: string): import('rxjs').Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}${path}`);
  }

  private cleanParams(params?: Record<string, string | number | boolean | undefined>) {
    if (!params) return undefined;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) out[k] = String(v);
    }
    return out;
  }
}
