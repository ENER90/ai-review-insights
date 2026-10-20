import { Actor, log } from 'apify';
import { dedupe, normalizeReview, groupByProduct, chunk, batchPrompt, reducePrompt, parseJson, buildInsight, Review } from './core.js';
import { LlmClient } from './llm.js';

interface Input {
  datasetIds?: string[]; jsonUrls?: string[]; reviews?: any[];
  llmProvider?: 'gemini' | 'openai'; apiKey?: string; model?: string;
  outputLanguage?: string; groupBy?: 'product' | 'none'; perReviewSentiment?: boolean;
  maxReviewsPerProduct?: number; maxReviews?: number; batchSize?: number; concurrency?: number;
}
await Actor.init();
const input = (await Actor.getInput<Input>()) ?? {};
const provider = input.llmProvider ?? 'gemini';
const model = input.model?.trim() || (provider === 'gemini' ? 'gemini-3.1-flash-lite' : 'gpt-4.1-mini');
const language = input.outputLanguage?.trim() || 'English';
const perReview = input.perReviewSentiment ?? true;
const batchSize = Math.min(80, Math.max(5, input.batchSize ?? 30));
const concurrency = Math.min(8, Math.max(1, input.concurrency ?? 2));
const maxPerProduct = input.maxReviewsPerProduct ?? 500, maxReviews = input.maxReviews ?? 2000;

// API key: bring-your-own only. No default key is baked into the actor.
const apiKey = input.apiKey?.trim();
if (!apiKey) throw new Error(`Input error: add your ${provider === 'gemini' ? 'Google Gemini API key (free at https://aistudio.google.com/apikey)' : 'OpenAI API key'} in "apiKey".`);

// Load reviews
const raw: any[] = [...(input.reviews ?? [])];
for (const id of input.datasetIds ?? []) {
  const ds = await Actor.openDataset(id.trim(), { forceCloud: true });
  let offset = 0;
  while (raw.length < maxReviews * 3) { const { items } = await ds.getData({ offset, limit: 1000, clean: true }); raw.push(...items); offset += items.length; if (items.length < 1000) break; }
  log.info(`Dataset ${id}: loaded ${offset} items.`);
}
for (const url of input.jsonUrls ?? []) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) }); if (!r.ok) throw new Error(`Could not download ${url}: HTTP ${r.status}`);
  const j: any = await r.json(); raw.push(...(Array.isArray(j) ? j : j.items ?? j.reviews ?? [j]));
}
const all = raw.map((x, i) => normalizeReview(x, i)).filter((x): x is Review => !!x);
const reviews = dedupe(all).slice(0, maxReviews);
if (all.length > reviews.length) log.info(`Removed ${all.length - reviews.length} duplicate reviews.`);
if (!reviews.length) throw new Error('Input error: no reviews found. Provide "datasetIds", "jsonUrls" or "reviews" (items with a text/review field).');
const groups = [...groupByProduct(reviews, input.groupBy ?? 'product')].map(([k, v]) => [k, v.slice(0, maxPerProduct)] as const);
log.info(`${reviews.length} reviews, ${groups.length} product(s). Model ${provider}/${model}, language ${language}.`);

const fallbackModels = input.model?.trim() ? [] : provider === 'gemini' ? ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite'] : [];
const llm = new LlmClient({ provider, apiKey, model, fallbackModels });
// simple concurrency pool
async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

let analyzed = 0, products = 0, failed = 0;
for (const [product, list] of groups) {
  try {
    const batches = chunk(list, batchSize);
    const partials = await pool(batches, concurrency, async (b) => parseJson(await llm.json(batchPrompt(product, b, language, perReview))));
    const sentiments: { sentiment: string; score: number }[] = [];
    const rows: any[] = [];
    partials.forEach((p, bi) => (p.reviews ?? []).forEach((s: any) => {
      const r = batches[bi][s.i]; if (!r || rows.some((x) => x.reviewId === r.id)) return; sentiments.push(s);
      rows.push({ type: 'reviewSentiment', product, reviewId: r.id, rating: r.rating ?? null, sentiment: s.sentiment, score: s.score, topics: s.topics ?? [], text: r.text.slice(0, 500) });
    }));
    // Retry reviews the model skipped (long batches sometimes drop indices).
    if (perReview) {
      const done = new Set(rows.map((x) => x.reviewId));
      const missing = list.filter((r) => !done.has(r.id));
      if (missing.length) {
        log.info(`${product}: re-analyzing ${missing.length} reviews skipped by the model.`);
        const mb = chunk(missing, 20);
        const extra = await pool(mb, concurrency, async (b) => { try { return parseJson(await llm.json(batchPrompt(product, b, language, true))); } catch { return {}; } });
        extra.forEach((p, bi) => (p.reviews ?? []).forEach((s: any) => { const r = mb[bi][s.i]; if (!r || done.has(r.id)) return; done.add(r.id); sentiments.push(s);
          rows.push({ type: 'reviewSentiment', product, reviewId: r.id, rating: r.rating ?? null, sentiment: s.sentiment, score: s.score, topics: s.topics ?? [], text: r.text.slice(0, 500) }); }));
      }
    }
    const final = partials.length === 1 ? partials[0] : parseJson(await llm.json(reducePrompt(product, partials.map(({ reviews: _r, ...x }) => x), language, list.length)));
    if (perReview) { await Actor.pushData(rows, 'review-analyzed'); analyzed += rows.length; }
    else analyzed += list.length;
    await Actor.pushData(buildInsight(product, list, sentiments, final, { model: llm.model, language }), 'product-insight'); products++;
    log.info(`✔ ${product}: ${list.length} reviews analyzed.`);
  } catch (e) {
    failed++; log.error(`✘ ${product}: ${(e as Error).message}`);
    if (/API error (400|401|403)/.test((e as Error).message)) throw new Error(`The LLM API rejected the request (check your API key / model): ${(e as Error).message}`);
  }
}
await Actor.setValue('RUN_STATS', { reviews: reviews.length, products, failed, perReviewRows: analyzed, llm: llm.usage, model, modelsUsed: [...llm.modelsUsed], provider });
log.info(`Done: ${products} product insights, ${analyzed} reviews. LLM calls ${llm.usage.calls}, tokens in ${llm.usage.inTokens} / out ${llm.usage.outTokens}.`);
if (!products) throw new Error('No product could be analyzed, see log.');
await Actor.exit();
