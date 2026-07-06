let csrfToken: string | null = null;

export function getCsrfToken() {
  return csrfToken;
}

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

async function parseJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(res.ok ? 'Invalid server response' : `Server unavailable (${res.status})`);
  }
}

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/api/api.php?action=getCsrfToken', { credentials: 'include' });
  if (res.ok) {
    const json = await parseJsonSafe(res);
    if (json.csrfToken) {
      csrfToken = json.csrfToken as string;
      return json.csrfToken as string;
    }
  }
  const authRes = await fetch('/api/api.php?action=checkAuth', { credentials: 'include' });
  const authJson = await parseJsonSafe(authRes);
  if (authJson.csrfToken) {
    csrfToken = authJson.csrfToken as string;
    return authJson.csrfToken as string;
  }
  throw new Error('Unable to connect. Please try again.');
}

export async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  return fetchCsrfToken();
}
