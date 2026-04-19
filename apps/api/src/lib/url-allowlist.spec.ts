import { assertUrlAllowed } from './url-allowlist';

describe('assertUrlAllowed', () => {
  const allow = new Set(['jsonplaceholder.typicode.com']);

  it('allows https host on allowlist', () => {
    const u = assertUrlAllowed(
      'https://jsonplaceholder.typicode.com/todos/1',
      allow,
    );
    expect(u.hostname).toBe('jsonplaceholder.typicode.com');
  });

  it('rejects host not on allowlist', () => {
    expect(() =>
      assertUrlAllowed('https://evil.example/', allow),
    ).toThrow();
  });

  it('rejects private IP', () => {
    expect(() =>
      assertUrlAllowed('https://192.168.1.1/', allow),
    ).toThrow();
  });

  it('allows any public host when allowlist is null', () => {
    const u = assertUrlAllowed('https://www.example.com/path', null);
    expect(u.hostname).toBe('www.example.com');
  });
});
