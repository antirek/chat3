import {
  normalizePublicPath,
  withPublicPath,
  resolveRouterBase,
  publicPathFromControlAppUrl,
} from '../publicPath.js';

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

describe('resolveRouterBase', () => {
  test('classic FQDN uses root base', () => {
    expect(resolveRouterBase('')).toBe('/');
    expect(resolveRouterBase('/')).toBe('/');
  });

  test('path-gateway uses trailing-slash base', () => {
    expect(resolveRouterBase('/control-app')).toBe('/control-app/');
    expect(resolveRouterBase('control-app')).toBe('/control-app/');
  });
});

describe('publicPathFromControlAppUrl', () => {
  test('extracts pathname prefix', () => {
    expect(publicPathFromControlAppUrl('https://host/control-app')).toBe('/control-app');
    expect(publicPathFromControlAppUrl('https://host/control-app/')).toBe('/control-app');
    expect(publicPathFromControlAppUrl('https://host')).toBe('');
    expect(publicPathFromControlAppUrl('https://host/')).toBe('');
  });

  test('handles empty and invalid', () => {
    expect(publicPathFromControlAppUrl('')).toBe('');
    expect(publicPathFromControlAppUrl(undefined)).toBe('');
    expect(publicPathFromControlAppUrl('not-a-url')).toBe('');
  });
});
