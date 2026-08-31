import { normalizePublicPath, withPublicPath } from '../publicPath.js';

describe('normalizePublicPath', () => {
  test('empty and root values normalize to empty string', () => {
    expect(normalizePublicPath(undefined)).toBe('');
    expect(normalizePublicPath(null)).toBe('');
    expect(normalizePublicPath('')).toBe('');
    expect(normalizePublicPath('   ')).toBe('');
    expect(normalizePublicPath('/')).toBe('');
  });

  test('adds leading slash and removes trailing slash', () => {
    expect(normalizePublicPath('control-app')).toBe('/control-app');
    expect(normalizePublicPath('/control-app')).toBe('/control-app');
    expect(normalizePublicPath('/control-app/')).toBe('/control-app');
    expect(normalizePublicPath('  /control-app/  ')).toBe('/control-app');
  });
});

describe('withPublicPath', () => {
  test('prefixes resource path when public path is set', () => {
    expect(withPublicPath('/config.js', '/control-app')).toBe('/control-app/config.js');
    expect(withPublicPath('config.js', '/control-app')).toBe('/control-app/config.js');
  });

  test('returns resource unchanged when public path is empty', () => {
    expect(withPublicPath('/config.js', '')).toBe('/config.js');
    expect(withPublicPath('/config.js', '/')).toBe('/config.js');
  });
});
