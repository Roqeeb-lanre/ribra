import { describe, expect, it } from 'vitest';
import { loginSchema, passwordRules, registerSchema, resetPasswordSchema } from './schemas';

describe('registerSchema', () => {
  it('accepts a valid sign-up', () => {
    const result = registerSchema.safeParse({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      password: 'analytical1',
    });
    expect(result.success).toBe(true);
  });

  it('explains what is wrong with a weak password', () => {
    const result = registerSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Include at least one number');
  });

  it('rejects an invalid email', () => {
    const result = registerSchema.safeParse({ name: 'Ada', email: 'ada@', password: 'abc12345' });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires both fields', () => {
    expect(loginSchema.safeParse({ email: '', password: '' }).success).toBe(false);
  });
});

describe('passwordRules', () => {
  it('marks each rule as met or not', () => {
    const met = passwordRules.map((rule) => rule.test('abc12345'));
    expect(met).toEqual([true, true, true]);
  });
});

describe('resetPasswordSchema', () => {
  it('requires both passwords to match', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'newPassword2',
      confirm: 'newPassword3',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['confirm']);
  });

  it('accepts a strong, matching password', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'newPassword2', confirm: 'newPassword2' }).success,
    ).toBe(true);
  });
});
