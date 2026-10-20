# AI Review Insights – Sentiment, Pros & Cons, Feature Requests

Turn hundreds of raw customer reviews into a **decision-ready report in minutes**. This actor reads reviews from any Apify dataset (or JSON / inline text) and uses AI (**Google Gemini or OpenAI, with your own key**) to produce, per product:

- 😊 **Sentiment** – % positive / neutral / negative and an average score, plus optional sentiment per review
- ✅ **Top pros** and ❌ **top cons**, with how many reviews mention each
- 🧩 **Themes** (e.g. "battery life", "customer support") with their sentiment
- 💡 **Feature requests** customers are asking for
- 💬 **Notable quotes** and a short **executive summary**
- 🌍 Output in **any language** (English, Spanish, Portuguese, German…), whatever the language of the reviews

## Who is it for
1. **Product & marketing teams** – find out what customers love and hate about your product (or your competitor's) on G2, Trustpilot, Amazon or Walmart.
2. **E-commerce sellers & agencies** – analyze marketplace reviews (Mercado Libre, Walmart, Amazon) to improve listings and spot defects.
3. **AI agents & analysts** – a clean JSON summary of thousands of reviews, ready for dashboards, n8n/Make/Zapier or an LLM via Apify MCP.

## Works with
Any dataset whose rows have review text (`text`, `review`, `content`, `body`, `pros`/`cons`...). Tested with:
[Mercado Libre Reviews & Questions](https://apify.com/ener90/mercadolibre-reviews-questions), [Walmart Products & Reviews](https://apify.com/ener90/walmart-products-reviews) and [Software Reviews (TrustRadius)](https://apify.com/ener90/software-reviews-scraper). Product rows, questions and other non-review rows are skipped automatically. Reviews are grouped by `productName` / `title` / `name`.

## Your AI key (bring your own)
You use **your own** Gemini or OpenAI API key, so you only pay your provider's real AI cost (often **$0 on Gemini's free tier**). A free Gemini key takes 1 minute: [aistudio.google.com/apikey](https://aistudio.google.com/apikey). The key is a secret input: it is stored encrypted and never written to the output or logs.

## Input example
```json
{
  "datasetIds": ["YOUR_DATASET_ID"],
  "llmProvider": "gemini",
  "apiKey": "AIza...",
  "outputLanguage": "English",
  "groupBy": "product",
  "perReviewSentiment": true,
  "maxReviewsPerProduct": 500
}
```

| Field | Description | Default |
|---|---|---|
| `datasetIds` | Apify dataset IDs with reviews | – |
| `jsonUrls` | URLs returning a JSON array of reviews | – |
| `reviews` | Inline reviews (strings or objects with `text`) | – |
| `llmProvider` | `gemini` or `openai` | `gemini` |
| `apiKey` | Your AI API key (secret) | required |
| `model` | Any model of the provider | `gemini-3.1-flash-lite` / `gpt-4.1-mini` |
| `outputLanguage` | Language of the insights | `English` |
| `groupBy` | `product` or `none` | `product` |
| `perReviewSentiment` | Also output one row per review | `true` |
| `maxReviewsPerProduct` / `maxReviews` | Limits | 500 / 2000 |
| `batchSize` / `concurrency` | Reviews per AI request / parallel requests | 30 / 2 |

## Output example (product insight)
```json
{
  "type": "productInsight",
  "product": "Asana",
  "reviewsAnalyzed": 100,
  "averageRating5": 4.3,
  "sentiment": { "positivePct": 78, "neutralPct": 15, "negativePct": 7, "avgScore": 0.58 },
  "summary": "Users value Asana's clear task tracking and collaboration...",
  "pros": [{ "point": "Easy task tracking and visibility", "mentions": 41 }],
  "cons": [{ "point": "Steep pricing for advanced features", "mentions": 14 }],
  "themes": [{ "theme": "Ease of use", "sentiment": "positive", "mentions": 37 }],
  "featureRequests": [{ "request": "Better reporting dashboards", "mentions": 6 }],
  "notableQuotes": ["It keeps the whole team on the same page."],
  "language": "English",
  "model": "gemini-3.1-flash-lite"
}
```
Per-review rows (`type: "reviewSentiment"`) contain `product`, `reviewId`, `rating`, `sentiment`, `score` (-1…1), `topics` and the review text. Dataset views: **Product insights**, **Themes & quotes**, **Sentiment per review**.

## Pricing
Pay per event: you pay per **review analyzed** and per **product insight** generated. AI usage is billed separately by your own provider (Gemini free tier covers small runs).

## Rate limits
Free-tier keys have per-minute limits. The actor batches ~30 reviews per request and automatically retries on `429` with back-off, so large runs just take a bit longer. Keep `concurrency` at 1–2 on free keys.

## FAQ
**Is my data sent anywhere else?** Only to the AI provider you choose, with your key.
**Can I analyze reviews in Spanish and get English insights?** Yes, set `outputLanguage`.
**Legal?** The actor only processes data you provide. Make sure you have the right to use the reviews you analyze.

## Integrations
Chain it after any review scraper with Apify integrations / webhooks, or call it from n8n, Make, Zapier or the Apify MCP server (Claude, ChatGPT).

---
Source for the Apify actor. Build: `npm ci && npm run build && npm test`.
