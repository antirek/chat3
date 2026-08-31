import { buildConfigJsContent, resolveControlAppUrl, rewriteSpaIndexHtml } from '../publicPathServe.js';

describe('publicPathServe', () => {
  describe('buildConfigJsContent', () => {
    test('includes CONTROL_APP_URL from config', () => {
      const content = buildConfigJsContent({
        TENANT_API_URL: 'https://host/tenant-api',
        CONTROL_APP_URL: 'https://host/control-app',
        RABBITMQ_MANAGEMENT_URL: 'https://host/rabbitmq',
        PROJECT_NAME: 'test',
        APP_VERSION: '1.0.0',
      });

      expect(content).toContain('CONTROL_APP_URL: "https://host/control-app"');
      expect(content).toContain('getControlApiUrl: function');
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

  describe('rewriteSpaIndexHtml', () => {
    const sampleHtml = `<!DOCTYPE html>
<html>
  <head>
    <link rel="icon" href="/vite.svg" />
    <script src="/config.js"></script>
  </head>
  <body>
    <script type="module" src="/assets/index.js"></script>
  </body>
</html>`;

    test('rewrites root-absolute paths when public path is set', () => {
      const result = rewriteSpaIndexHtml(sampleHtml, '/control-app');

      expect(result).toContain('src="/control-app/config.js"');
      expect(result).toContain('href="/control-app/vite.svg"');
      expect(result).toContain('src="/control-app/assets/index.js"');
      expect(result).not.toContain('src="/config.js"');
    });

    test('leaves HTML unchanged when public path is empty', () => {
      const result = rewriteSpaIndexHtml(sampleHtml, '');
      expect(result).toBe(sampleHtml);
    });
  });
});
