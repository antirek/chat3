import type { Request } from 'express';
import { normalizePublicPath } from '@chat3/utils';

export interface ControloConfig {
  TENANT_API_URL: string;
  CONTROL_APP_URL: string;
  RABBITMQ_MANAGEMENT_URL: string;
  PROJECT_NAME: string;
  APP_VERSION: string;
}

export function buildConfigJsContent(config: ControloConfig): string {
  return `// Конфигурация URL для разных сервисов (генерируется динамически)
window.CHAT3_CONFIG = {
    TENANT_API_URL: ${JSON.stringify(config.TENANT_API_URL)},
    CONTROL_APP_URL: ${JSON.stringify(config.CONTROL_APP_URL)},
    RABBITMQ_MANAGEMENT_URL: ${JSON.stringify(config.RABBITMQ_MANAGEMENT_URL)},
    PROJECT_NAME: ${JSON.stringify(config.PROJECT_NAME)},
    APP_VERSION: ${JSON.stringify(config.APP_VERSION)},
    
    getTenantApiUrl: function(path = '') {
        return this.TENANT_API_URL + path;
    },
    
    getControlApiUrl: function(path = '') {
        return this.CONTROL_APP_URL + path;
    }
};`;
}

export function resolveControlAppUrl(
  controlAppUrlEnv: string | undefined,
  fallback = 'http://localhost:3001',
): string {
  const trimmed = controlAppUrlEnv?.trim();
  return trimmed || fallback;
}

export function resolveSwaggerServerUrl(
  controlAppUrlEnv: string | undefined,
  controloPublicPath: string,
  req: Pick<Request, 'get' | 'protocol'>,
): string {
  const fromEnv = controlAppUrlEnv?.trim();
  if (fromEnv) return fromEnv;

  const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
  const host = req.get('host') || 'localhost';
  const publicPath = normalizePublicPath(controloPublicPath);
  return `${protocol}://${host}${publicPath}`;
}

const ROOT_ABSOLUTE_ATTR_RE = /(\s(?:src|href)=["'])\/(config\.js|vite\.svg|assets\/|src\/)/g;

export function rewriteSpaIndexHtml(html: string, controloPublicPath: string): string {
  const publicPath = normalizePublicPath(controloPublicPath);
  if (!publicPath) return html;

  return html.replace(ROOT_ABSOLUTE_ATTR_RE, `$1${publicPath}/$2`);
}
