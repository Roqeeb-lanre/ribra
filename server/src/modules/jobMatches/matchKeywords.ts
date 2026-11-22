/**
 * Checks which job keywords appear in a CV, in plain code (no AI).
 * This keeps the keyword part of the match score predictable and explainable:
 * the same CV and job always give the same result.
 */

export type JobKeyword = {
  keyword: string;
  importance: 'required' | 'preferred';
};

export type KeywordResult = JobKeyword & { found: boolean };

/** Common ways people write the same skill. Each group counts as one skill. */
const SYNONYMS: string[][] = [
  ['javascript', 'js', 'ecmascript'],
  ['typescript', 'ts'],
  ['node.js', 'nodejs', 'node'],
  ['react', 'react.js', 'reactjs'],
  ['next.js', 'nextjs'],
  ['vue', 'vue.js', 'vuejs'],
  ['express', 'express.js', 'expressjs'],
  ['mongodb', 'mongo'],
  ['postgresql', 'postgres'],
  ['kubernetes', 'k8s'],
  ['amazon web services', 'aws'],
  ['google cloud', 'gcp', 'google cloud platform'],
  ['ci/cd', 'cicd', 'continuous integration'],
  ['rest api', 'restful api', 'rest apis', 'restful apis', 'restful'],
  ['machine learning', 'ml'],
  ['artificial intelligence', 'ai'],
  ['user interface', 'ui'],
  ['user experience', 'ux'],
  ['tailwind', 'tailwind css', 'tailwindcss'],
  ['html', 'html5'],
  ['css', 'css3'],
  ['git', 'github', 'gitlab'],
  ['unit testing', 'unit tests', 'testing', 'jest', 'vitest'],
];

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** "React.js!" -> "react.js" (lowercase, trimmed, outer punctuation removed). */
function clean(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/^[^a-z0-9+#.]+|[^a-z0-9+#]+$/g, '');
}

/** Letters and numbers only: "Node.js" -> "nodejs", "CI/CD" -> "cicd". */
const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, '');

function variantsOf(keyword: string): string[] {
  const k = clean(keyword);
  const group = SYNONYMS.find((g) => g.includes(k));
  return group ? group : [k];
}

/** Whole-word match, so "Java" doesn't match inside "JavaScript" and "Go" doesn't match "Google". */
function containsTerm(text: string, compactText: string, term: string): boolean {
  if (!term) return false;
  const pattern = new RegExp(`(^|[^a-z0-9+#])${escapeRegex(term)}(?=$|[^a-z0-9+#])`, 'i');
  if (pattern.test(text)) return true;
  // Also catch spelling differences like "Node.js" vs "NodeJS" for longer terms.
  const c = compact(term);
  return c.length >= 5 && compactText.includes(c);
}

export function matchKeywords(cvText: string, keywords: JobKeyword[]): KeywordResult[] {
  const text = cvText.toLowerCase();
  const compactText = compact(cvText);
  const seen = new Set<string>();

  return keywords
    .filter((k) => {
      const key = variantsOf(k.keyword)[0]!;
      if (!k.keyword.trim() || seen.has(key)) return false; // drop blanks and duplicates
      seen.add(key);
      return true;
    })
    .map((k) => ({
      keyword: k.keyword.trim(),
      importance: k.importance,
      found: variantsOf(k.keyword).some((v) => containsTerm(text, compactText, v)),
    }));
}

/**
 * Share of keywords found, where required keywords count double.
 * Returns 0-100. No keywords at all counts as 100 (nothing is missing).
 */
export function keywordCoverage(results: KeywordResult[]): number {
  const weight = (r: KeywordResult) => (r.importance === 'required' ? 2 : 1);
  const total = results.reduce((sum, r) => sum + weight(r), 0);
  if (total === 0) return 100;
  const found = results.filter((r) => r.found).reduce((sum, r) => sum + weight(r), 0);
  return Math.round((found / total) * 100);
}

/** Final score: 60% the AI's overall judgement, 40% hard keyword coverage. */
export function combinedMatchScore(aiFitScore: number, coverage: number): number {
  const fit = Math.min(100, Math.max(0, aiFitScore));
  return Math.round(fit * 0.6 + coverage * 0.4);
}
