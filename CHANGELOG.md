# Changelog

## 0.1 (2026-10-20)
- First version: sentiment, pros/cons, themes, feature requests, quotes and summary per product. Gemini or OpenAI with your own key. Batching and 429 retry.

## Unreleased
- Missing apiKey no longer fails the run: it finishes successfully with a clear message (status message + OUTPUT record), without calling the AI or charging anything. apiKey is no longer a required field in the input schema.
