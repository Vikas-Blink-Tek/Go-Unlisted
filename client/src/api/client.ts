import { ensureCsrfToken } from './csrf';

const API_BASE = '/api/api.php';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  action: string,
  method: 'GET' | 'POST' = 'GET',
  data?: unknown,
  params?: Record<string, string>,
): Promise<T> {
  const search = new URLSearchParams({ action, ...params });
  const url = `${API_BASE}?${search}`;

  const headers: Record<string, string> = {};
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
    const token = await ensureCsrfToken();
    headers['X-CSRF-Token'] = token;
  }

  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: Object.keys(headers).length ? headers : undefined,
    body: method === 'POST' && data ? JSON.stringify(data) : undefined,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError('Something went wrong. Please try again.', res.status);
  }

  if (!res.ok) {
    throw new ApiError(
      (json.error as string) || (json.message as string) || `Request failed (${res.status})`,
      res.status,
    );
  }

  return json as T;
}
