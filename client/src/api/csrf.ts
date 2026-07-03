let csrfToken: string | null = null;

export function getCsrfToken() {
  return csrfToken;
}

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

export async function fetchCsrfToken(): Promise<string> {
  const res = await fetch('/api/api.php?action=getCsrfToken', { credentials: 'include' });
  if (res.ok) {
    const json = await res.json();
    if (json.csrfToken) {
      csrfToken = json.csrfToken;
      return json.csrfToken;
    }
  }
  const authRes = await fetch('/api/api.php?action=checkAuth', { credentials: 'include' });
  const authJson = await authRes.json();
  if (authJson.csrfToken) {
    csrfToken = authJson.csrfToken;
    return authJson.csrfToken;
  }
  throw new Error('Unable to connect. Please try again.');
}

export async function ensureCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  return fetchCsrfToken();
}
