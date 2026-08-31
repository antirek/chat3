/**
 * Runtime public path helpers for controlo-ui behind path-gateway.
 * Kept local (no @chat3/utils dep in the browser bundle).
 */

export function normalizeControloPublicPath(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  let s = String(raw).trim();
  if (s === '' || s === '/') return '';
  if (!s.startsWith('/')) s = `/${s}`;
  return s.replace(/\/+$/, '');
}

export type ControloPublicPathConfig = {
  CONTROLO_PUBLIC_PATH?: string;
  CONTROL_APP_URL?: string;
};

/**
 * Vue Router history base: '/' for classic FQDN, '/control-app/' for path-gateway.
 * Prefers CONTROLO_PUBLIC_PATH; falls back to pathname of CONTROL_APP_URL.
 */
export function resolveControloRouterBase(
  config?: ControloPublicPathConfig | null,
): string {
  const cfg =
    config ??
    (typeof window !== 'undefined' ? window.CHAT3_CONFIG : undefined) ??
    {};

  let path = normalizeControloPublicPath(cfg.CONTROLO_PUBLIC_PATH);
  if (!path && cfg.CONTROL_APP_URL) {
    try {
      path = normalizeControloPublicPath(new URL(cfg.CONTROL_APP_URL).pathname);
    } catch {
      // ignore invalid URL
    }
  }

  return path ? `${path}/` : '/';
}
