import { describe, expect, it } from 'vitest';
import {
  combinedMatchScore,
  keywordCoverage,
  matchKeywords,
  type JobKeyword,
} from '../src/modules/jobMatches/matchKeywords.js';

const cv = `Full-stack developer. Built a MERN e-commerce app with React.js, NodeJS, Express and MongoDB.
Deployed with GitHub Actions. Strong communication skills. Wrote unit tests with Jest.`;

const req = (keyword: string): JobKeyword => ({ keyword, importance: 'required' });
const pref = (keyword: string): JobKeyword => ({ keyword, importance: 'preferred' });

describe('matchKeywords', () => {
  it('finds skills written in different ways (synonyms and spelling)', () => {
    const results = matchKeywords(cv, [
      req('React'),
      req('Node.js'),
      req('Mongo'),
      pref('Unit testing'),
    ]);
    expect(results.every((r) => r.found)).toBe(true);
  });

  it('reports skills that are missing', () => {
    const results = matchKeywords(cv, [req('TypeScript'), req('Docker'), pref('GraphQL')]);
    expect(results.map((r) => r.found)).toEqual([false, false, false]);
  });

  it('matches whole words only', () => {
    // "Java" must not match "JavaScript"-like text, "Go" must not match "Google".
    const results = matchKeywords('I write JavaScript at Google.', [req('Java'), req('Go')]);
    expect(results.map((r) => r.found)).toEqual([false, false]);
  });

  it('is case-insensitive and ignores duplicates and blanks', () => {
    const results = matchKeywords(cv, [req('EXPRESS'), req('express'), req('  ')]);
    expect(results).toHaveLength(1);
    expect(results[0]!.found).toBe(true);
  });
});

describe('keywordCoverage', () => {
  it('counts required keywords double', () => {
    const coverage = keywordCoverage([
      { keyword: 'React', importance: 'required', found: true },
      { keyword: 'Docker', importance: 'preferred', found: false },
    ]);
    expect(coverage).toBe(67); // 2 of 3 weighted points
  });

  it('treats an empty list as full coverage', () => {
    expect(keywordCoverage([])).toBe(100);
  });
});

describe('combinedMatchScore', () => {
  it('blends 60% AI judgement with 40% keyword coverage', () => {
    expect(combinedMatchScore(80, 50)).toBe(68);
    expect(combinedMatchScore(150, 100)).toBe(100);
  });
});
