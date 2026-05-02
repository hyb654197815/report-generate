/** Public URL path prefix without trailing slash, e.g. "/reportGenerate" or "". */
export function getDeployBasePath(): string {
  const href = document.querySelector('base')?.getAttribute('href');
  if (!href) return '';
  try {
    const u = new URL(href, window.location.origin);
    let p = u.pathname;
    if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
    return p === '/' ? '' : p;
  } catch {
    return '';
  }
}

/** React Router basename: "/" at site root, "/reportGenerate" under that prefix. */
export function getRouterBasename(): string {
  const p = getDeployBasePath();
  return p === '' ? '/' : p;
}

/**
 * Axios baseURL: honors VITE_API_URL when set to an absolute URL; otherwise
 * mounts "/api" under the same prefix as &lt;base href&gt; (from nginx or "/").
 */
export function getApiBaseURL(): string {
  const env = import.meta.env.VITE_API_URL as string | undefined;
  if (env?.startsWith('http://') || env?.startsWith('https://')) {
    return env;
  }
  const prefix = getDeployBasePath();
  const tail = (env || '/api').replace(/\/?$/, '').replace(/^\//, '') || 'api';
  if (!prefix) return `/${tail}`;
  return `${prefix}/${tail}`;
}
