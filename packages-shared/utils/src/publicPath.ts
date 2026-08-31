/**
 * Public URL prefix for apps behind a path-gateway.
 * '' or '/' → '' (host root). 'admin' / '/admin/' → '/admin'.
 */
export function normalizePublicPath(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim();
  if (s === '' || s === '/') return '';
  if (!s.startsWith('/')) s = `/${s}`;
  return s.replace(/\/+$/, '');
}

/**
 * Prefix a resource path with the normalized public path.
 * withPublicPath('/config.js', '/control-app') → '/control-app/config.js'
 */
export function withPublicPath(path: string, publicPath: string): string {
  const prefix = normalizePublicPath(publicPath);
  const resource = path.startsWith('/') ? path : `/${path}`;
  if (!prefix) return resource;
  return `${prefix}${resource}`;
}

/**
 * Vue Router / browser base: '/' or '/control-app/'.
 */
export function resolveRouterBase(publicPath: string): string {
  const normalized = normalizePublicPath(publicPath);
  return normalized ? `${normalized}/` : '/';
}

/**
 * Derive public path from CONTROL_APP_URL pathname when CONTROLO_PUBLIC_PATH unset.
 */
export function publicPathFromControlAppUrl(controlAppUrl: string | undefined | null): string {
  if (!controlAppUrl?.trim()) return '';
  try {
    return normalizePublicPath(new URL(controlAppUrl.trim()).pathname);
  } catch {
    return '';
  }
}
