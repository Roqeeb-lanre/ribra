import { describe, expect, it } from 'vitest';
import {
  createRefreshToken,
  hashToken,
  hashesMatch,
  parseRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../src/modules/auth/tokens.js';

describe('access tokens', () => {
  it('round-trips the user id and role', () => {
    const token = signAccessToken({ userId: '665f1f77bcf86cd799439011', role: 'user' });
    expect(verifyAccessToken(token)).toEqual({ userId: '665f1f77bcf86cd799439011', role: 'user' });
  });

  it('rejects garbage', () => {
    expect(() => verifyAccessToken('not-a-token')).toThrow('You need to log in.');
  });
});

describe('refresh tokens', () => {
  it('embeds the session id and a random secret', () => {
    const sessionId = '665f1f77bcf86cd799439011';
    const a = createRefreshToken(sessionId);
    const b = createRefreshToken(sessionId);

    expect(parseRefreshToken(a)).toEqual({ sessionId });
    expect(a).not.toBe(b);
  });

  it('rejects malformed tokens', () => {
    expect(parseRefreshToken('nope')).toBeNull();
    expect(parseRefreshToken('xyz.abc')).toBeNull();
  });

  it('compares hashes safely', () => {
    const token = createRefreshToken('665f1f77bcf86cd799439011');
    expect(hashesMatch(hashToken(token), hashToken(token))).toBe(true);
    expect(hashesMatch(hashToken(token), hashToken(`${token}x`))).toBe(false);
  });
});
