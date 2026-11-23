import { describe, expect, it } from 'vitest';
import { isStaleBuildError } from './staleBuild';

describe('isStaleBuildError', () => {
  it('recognises missing page files from an old deploy', () => {
    expect(
      isStaleBuildError(
        new TypeError(
          'Failed to fetch dynamically imported module: https://ribra.vercel.app/assets/JobMatchPage-B1zxgkLG.js',
        ),
      ),
    ).toBe(true);
    expect(isStaleBuildError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleBuildError(new Error('Cannot read properties of undefined'))).toBe(false);
  });
});
