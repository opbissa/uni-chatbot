# LLM provider cost comparison

A living reference for per-query generation cost across hosted LLM APIs, so
we can decide whether adding a new `llm_provider` is worth it before writing
code. For *why* Ollama/Claude/Gemini were chosen and how per-tenant routing
works, see [DECISIONS.md](./DECISIONS.md) — this doc is pricing only, meant
to be refreshed, not re-litigated.

**Last updated:** 2026-07-28

## Cost anchor

A typical RAG query in this product runs ~2,500 input tokens (system prompt
+ retrieved context, `topK = 5` chunks) + ~250 output tokens. All
per-query figures below use that anchor. Actual cost scales with `topK`
and answer length — re-derive if either changes materially.

## Comparison table

| Provider / Model | Input $/M tokens | Output $/M tokens | Cost per query | vs. Haiku | Wired in? |
|---|---|---|---|---|---|
| Claude Haiku 4.5 | $1.00 | $5.00 | ~$0.0038 | baseline | Yes (`api/src/llm/claude.ts`) |
| Gemini 2.5 Flash | $0.15–0.30 | $1.25–2.50 | ~$0.0014–0.0018 | ~2.5–3x cheaper | Yes (`api/src/llm/gemini.ts`) |
| Gemini 2.5 Flash-Lite | $0.10 | $0.40 | ~$0.0002 | ~15x cheaper | No |
| GPT-4o-mini | $0.15 | $0.60 | ~$0.0005 | ~7x cheaper | No |
| GPT-5-mini | $0.13 | $1.00 | ~$0.0006 | ~6x cheaper | No |
| Groq — Llama 3.1 8B | $0.05 | $0.08 | ~$0.0001 | ~26x cheaper | No |
| Groq — Qwen3 32B | $0.29 | $0.59 | ~$0.0009 | ~4x cheaper | No |
| Sarvam 105B | ₹4 (~$0.05) | ₹16 (~$0.19) | ~₹0.014 (~$0.0002) | ~19x cheaper | No |
| Sarvam 30B | ₹2.5 (~$0.03) | ₹10 (~$0.12) | ~₹0.009 (~$0.0001) | ~34x cheaper | No |
| Ollama / Qwen 2.5 7B (self-hosted) | $0 marginal | $0 marginal | $0 | — | Yes (`api/src/llm/ollama.ts`); ~₹15–25k/mo server, breaks even vs. a hosted API around 1,500–2,000 sustained queries/day |

## Reading this for a decision

- **Cheapest hosted, unproven quality:** Groq Llama 3.1 8B and Sarvam are far
  cheaper than Haiku/Gemini, but haven't been benchmarked here on
  Hindi/Hinglish answer quality — the dimension that matters most for this
  product. Don't switch a tenant on price alone; benchmark first.
- **Sarvam is the one to prioritize testing:** it's cost-competitive with
  Groq *and* purpose-built for Indic languages, unlike the general-purpose
  options. Best odds of beating Haiku/Gemini on both cost and Hindi quality
  at once.
- **Gemini 2.5 Flash was already retired for new API keys as of 2026-07-28**
  (confirmed: `gemini-2.5-flash` 404s with "no longer available to new
  users"). The code (`api/src/llm/gemini.ts`) now defaults to
  `gemini-flash-latest`, an alias Google keeps pointed at its current stable
  Flash model — use aliases like this over pinned version names to avoid
  repeating this breakage.
- Self-hosted Ollama only wins once a tenant sustains ~1,500+ queries/day;
  below that, any hosted API line above is cheaper AND less to operate.

## How to refresh this doc

Prices move often and sources disagree even within the same week — treat
every row as directional, not quotable, until re-checked. To refresh:

1. Web-search `"<model> API pricing per million tokens <year>"` for each
   provider row (Anthropic, Google, OpenAI, Groq, Sarvam, and any new
   candidate).
2. Recompute cost-per-query using the anchor above:
   `(2500 * input_price + 250 * output_price) / 1_000_000`.
3. Update the table, the **Last updated** date, and note in the row if a
   model was renamed/retired/succeeded.
4. If a new provider looks worth adding, prototype in
   `api/src/llm/<provider>.ts` following the existing `claude.ts`/
   `gemini.ts` pattern (same `GenerateParams` in, `AsyncIterable<string>`
   out) — the abstraction in `api/src/llm/index.ts` makes this additive,
   not a refactor.
