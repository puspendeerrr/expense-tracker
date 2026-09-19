import type { ApiErrorDetail, ApiResponse } from '../types/auth';
import { apiUrl } from './env';

export class ApiClientError extends Error {
  readonly code: string;
  readonly fields?: Array<{ field: string; message: string }>;
  readonly details?: ApiErrorDetail['details'];
  readonly status: number;

  constructor(status: number, error: ApiErrorDetail) {
    super(error.message || 'An unexpected error occurred.');
    this.name = 'ApiClientError';
    this.status = status;
    this.code = error.code || 'UNKNOWN_ERROR';
    this.fields = error.fields;
    this.details = error.details;
  }

  getFieldError(field: string): string | undefined {
    return this.fields?.find((f) => f.field === field)?.message;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  // Resolves against VITE_API_BASE_URL when set; stays relative (same-origin) otherwise.
  const url = apiUrl(endpoint.startsWith('/') ? endpoint : `/api/${endpoint}`);
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Accept', 'application/json');

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Always send and receive cookies
    });
  } catch (networkErr: unknown) {
    throw new ApiClientError(0, {
      code: 'NETWORK_ERROR',
      message: 'Network error. Please check your internet connection and try again.',
    });
  }

  let body: ApiResponse<T> | null = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      body = await response.json();
    } catch {
      body = null;
    }
  }

  if (!response.ok || !body?.ok) {
    const errorDetail: ApiErrorDetail = body?.error || {
      code: 'HTTP_ERROR',
      message: response.statusText || 'Request failed.',
    };
    throw new ApiClientError(response.status, errorDetail);
  }

  return body.data as T;
}

