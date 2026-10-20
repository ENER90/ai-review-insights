import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dedupe, normalizeReview, groupByProduct, chunk, parseJson, buildInsight, batchPrompt } from '../src/core.js';
const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}.json`, import.meta.url), 'utf8'));
const norm = (a: any[]) => a.map((x, i) => normalizeReview(x, i)).filter(Boolean) as any[];

describe('normalizeReview', () => {
  it('Mercado Libre: product name from title', () => { const r = norm(fx('ml')); expect(r.length).toBeGreaterThan(0); expect(r[0].product).toMatch(/samsung/i); expect(r[0].rating).toBeTypeOf('number'); });
  it('Walmart: skips product rows', () => { const a = fx('walmart'); const r = norm(a); expect(r.length).toBe(a.filter((x: any) => x.type === 'review' && x.text).length); });
  it('TrustRadius: merges pros/cons and keeps 10-point scale', () => { const r = norm(fx('trustradius')); expect(r[0].product).toBeTruthy(); expect(r[0].ratingScale).toBe(10); expect(r[0].text).toMatch(/Pros:/); });
  it('plain strings', () => { expect(normalizeReview('nice', 0)?.text).toBe('nice'); expect(normalizeReview('  ', 1)).toBeNull(); });
});
describe('helpers', () => {
  it('groups and chunks', () => { const g = groupByProduct(norm(fx('trustradius')), 'none'); expect([...g.keys()]).toEqual(['All reviews']); expect(chunk([1, 2, 3, 4, 5], 2)).toHaveLength(3); });
  it('parses fenced json', () => { expect(parseJson('```json\n{"a":1}\n```').a).toBe(1); expect(parseJson('x {"b":2} y').b).toBe(2); });
  it('prompt carries language', () => { expect(batchPrompt('X', norm(['a']), 'Spanish', true)).toContain('Spanish'); });
  it('buildInsight computes stats', () => {
    const rv = norm([{ type: 'review', productName: 'P', text: 'a', rating: 5 }, { type: 'review', productName: 'P', text: 'b', rating: 8, ratingScale: 10 }]);
    const ins = buildInsight('P', rv, [{ sentiment: 'positive', score: 0.8 }, { sentiment: 'negative', score: -0.4 }], { pros: [{ point: 'x', mentions: 1 }, { point: 'y', mentions: 3 }], summary: 's' }, { model: 'm', language: 'English' });
    expect(ins.averageRating5).toBe(4.5); expect(ins.sentiment?.positivePct).toBe(50); expect(ins.pros[0].point).toBe('y');
  });
});
describe('dedupe', () => { it('removes repeated reviews', () => { const r = norm([{ type: 'review', productName: 'A', reviewId: 1, text: 'x' }, { type: 'review', productName: 'A', reviewId: 1, text: 'x' }, { type: 'review', productName: 'A', reviewId: 2, text: 'x' }, { type: 'review', productName: 'B', reviewId: 1, text: 'x' }]); expect(dedupe(r)).toHaveLength(2); }); });
