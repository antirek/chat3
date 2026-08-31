import {
  buildConfigJsContent,
  resolveControlAppUrl,
  resolveSwaggerServerUrl,
  rewriteSpaIndexHtml,
} from '../publicPathServe.js';

describe('publicPathServe', () => {
  describe('buildConfigJsContent', () => {
    test('includes CONTROL_APP_URL and CONTROLO_PUBLIC_PATH from config', () => {
      const content = buildConfigJsContent({
        TENANT_API_URL: 'https://host/tenant-api',
        CONTROL_APP_URL: 'https://host/control-app',
        RABBITMQ_MANAGEMENT_URL: 'https://host/rabbitmq',
        PROJECT_NAME: 'test',
        APP_VERSION: '1.0.0',
        CONTROLO_PUBLIC_PATH: '/control-app',
      });

      expect(content).toContain('CONTROL_APP_URL: "https://host/control-app"');
      expect(content).toContain('CONTROLO_PUBLIC_PATH: "/control-app"');
      expect(content).toContain('getControlApiUrl: function');
    });

    test('normalizes empty CONTROLO_PUBLIC_PATH to empty string', () => {
      const content = buildConfigJsContent({
        TENANT_API_URL: 'https://host',
        CONTROL_APP_URL: 'https://host',
        RABBITMQ_MANAGEMENT_URL: 'https://host/rabbitmq',
        PROJECT_NAME: 'test',
        APP_VERSION: '1.0.0',
      });

      expect(content).toContain('CONTROLO_PUBLIC_PATH: ""');
    });
  });

  describe('resolveControlAppUrl', () => {
    test('uses env value when set', () => {
      expect(resolveControlAppUrl('https://host/control-app')).toBe('https://host/control-app');
    });

    test('falls back to localhost when env is empty', () => {
      expect(resolveControlAppUrl('')).toBe('http://localhost:3001');
      expect(resolveControlAppUrl(undefined)).toBe('http://localhost:3001');
    });
  });

  describe('resolveSwaggerServerUrl', () => {
    const req = {
      protocol: 'http',
      get(name: string): string | undefined {
        if (name === 'host') return 'gateway.example';
        if (name === 'x-forwarded-proto') return 'https';
        return undefined;
      },
    } as Parameters<typeof resolveSwaggerServerUrl>[2];

    test('prefers CONTROL_APP_URL env', () => {
      expect(resolveSwaggerServerUrl('https://host/control-app', '/control-app', req)).toBe(
        'https://host/control-app',
      );
    });

    test('builds from forwarded proto + host + public path when env empty', () => {
      expect(resolveSwaggerServerUrl('', '/control-app', req)).toBe(
        'https://gateway.example/control-app',
      );
      expect(resolveSwaggerServerUrl(undefined, '', req)).toBe('https://gateway.example');
    });
  });

  describe('rewriteSpaIndexHtml', () => {
    const absoluteHtml = `<!DOCTYPE html>
<html>
  <head>
    <link rel="icon" href="/vite.svg" />
    <script src="/config.js"></script>
  </head>
  <body>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>`;

    const relativeHtml = `<!DOCTYPE html>
<html>
  <head>
    <link rel="icon" href="./vite.svg" />
    <script src="./config.js"></script>
  </head>
  <body>
    <script type="module" src="./assets/index.js"></script>
  </body>
</html>`;

    test('rewrites root-absolute paths when public path is set', () => {
      const result = rewriteSpaIndexHtml(absoluteHtml, '/control-app');

      expect(result).toContain('src="/control-app/config.js"');
      expect(result).toContain('href="/control-app/vite.svg"');
      expect(result).toContain('src="/control-app/assets/index.js"');
      expect(result).not.toContain('src="/config.js"');
    });

    test('rewrites Vite relative ./ paths when public path is set', () => {
      const result = rewriteSpaIndexHtml(relativeHtml, '/control-app');

      expect(result).toContain('src="/control-app/config.js"');
      expect(result).toContain('href="/control-app/vite.svg"');
      expect(result).toContain('src="/control-app/assets/index.js"');
      expect(result).not.toContain('src="./config.js"');
    });

    test('leaves HTML unchanged when public path is empty', () => {
      expect(rewriteSpaIndexHtml(absoluteHtml, '')).toBe(absoluteHtml);
      expect(rewriteSpaIndexHtml(relativeHtml, '')).toBe(relativeHtml);
    });
  });
});
