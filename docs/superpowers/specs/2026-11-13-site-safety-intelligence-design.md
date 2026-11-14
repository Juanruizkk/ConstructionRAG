# Site Safety Intelligence — Design Spec

> Take-home for a Software Engineer role (judged on **RAG, embeddings, tool-calling**).
> Deadline: Sun Nov 15, 2026 night EST (formally Mon Nov 16, 9am EST).
> Status: **Sections 1–5 approved in brainstorming.** Next: spec self-review → user review gate → writing-plans.

## Problem
A general contractor (GC) is bidding a job and will bring 10–15 subcontractors on site. Before signing, the GC
wants to know which subs have a worrying safety history, and the foreman wants to ask plain-English questions
about it while on site (mobile). Deliverables: public repo + README (decisions & trade-offs); deployed URL is a plus.

## Decisions locked in brainstorming
- **Scope:** focused MVP — the AI core (RAG, embeddings, tool-calling) must shine; everything else is support.
- **Language:** TypeScript (strict), pnpm. Matches the SWE role + Juan's layered conventions.
- **Embeddings:** local/open, model `bge-small-en-v1.5` (384 dims), ONNX. **Primary lib `@huggingface/transformers` (Transformers.js v4)**, not `fastembed-js`.
  - Why: `fastembed@3.0.0` pins `onnxruntime-node@1.21.0` (old) + a 3rd-party native tokenizer `@anush008/tokenizers@0.6.0` → risk on Node 24 + Windows. `@huggingface/transformers@4.3.2` is more actively maintained and uses `onnxruntime-node@1.30.0` (newer prebuilds) + official tokenizer.
  - Behind an `EmbeddingProvider` interface so it's swappable. Store `embedding_model` on chunks.
  - **This machine runs Node v22.15.0, not 24** — "works on Node 24" must be confirmed with a smoke test on the deploy Node version during ETL step 1.
- **LLM:** Groq (open models, free tier + speed) behind an `LLMProvider` interface (same pattern as embeddings). Evals compare providers (Groq vs Claude/GPT) on tool-calling reliability; README compares them. Note Groq free-tier rate limits during evals.
- **Data scope:** NAICS `23%` (construction), ~last 10 years, **states CA + TX + NY** (adjustable). Tens of thousands of rows — comfortable, good demo variety. README notes it's "scalable to national".
- **CFR 1926 corpus (`explain_standard` tool):** stretch at the end if time allows (not core-blocking).
- **Repo shape:** Option B — lightweight pnpm monorepo.
- **Deploy:** Juan's **VPS + Dokploy** (persistent container → no cold start; the embedding model loads once at boot). Postgres+pgvector as a Dokploy service. `docker-compose.yml` is for local only. Secrets via Dokploy env vars (`API_KEY_ODP`, `GROQ_API_KEY`, `DATABASE_URL`, …), never committed.

## DOL API — verified facts (hit live)
- Auth: key in env var **`API_KEY_ODP`** (CLAUDE.md said `DOL_API_KEY` — wrong), passed as `X-API-KEY`.
- Request shape: `https://apiprod.dol.gov/v4/get/osha/<endpoint>/json?limit=&offset=&sort_by=&filter_object=&X-API-KEY=`
  - `agency = osha`; endpoints are names (`inspection`, `violation`, `accident`, `accident_injury`, `accident_abstract`, …), not numeric IDs.
  - Limits: **10,000 records or 5 MB per request** (default limit=10) → paginate with `offset`.
  - `filter_object`: JSON with `eq/neq/gt/lt/in/not_in/like` + `and`/`or`. NAICS `like "23%"` works. `in` operator works on `rel_insp_nr` (confirmed 200).
- Dictionary findings:
  - `accident` has `event_date` (yyyymmdd), `event_desc`, `event_keyword`, construction fields (`build_stories`, `nonbuild_ht`, `project_type`, `project_cost`, `const_end_use`), `fatality` flag, and its own `abstract_text`. **`accident` has NO `activity_nr`** → accident↔inspection link is only via `accident_injury.rel_insp_nr`.
  - `accident_abstract` is **fragmented**: multiple rows per `summary_nr`, ordered by `line_nr` → must reassemble.
  - `violation.delete_flag` domain `X;Deleted` → filter `X`. `viol_type` domain `S|W|R|O|U` (U = Unclassified).
- OSHA inspection detail URL for citations: `https://www.osha.gov/ords/imis/establishment.inspection_detail?id=<activity_nr>` (verify when wiring citations).

---

## Section 1 — Architecture & deploy (APPROVED)

**Core principle (README):** numbers (counts, penalties, fatalities, risk score) **always come from SQL via typed tools**; RAG only retrieves unstructured text (narratives, CFR). The LLM never invents figures and never writes free SQL by default (optional read-only escape hatch).

```
DOL API ──► ETL (apps/api/src/etl, CLI commands)
             │  idempotent fetch → data/raw/ (gitignored)
             │  clean · entity resolution · embeddings (EmbeddingProvider)
             ▼
   Postgres + pgvector + pg_trgm  (docker local / Dokploy prod)
     ├─ relational: contractor, contractor_alias, inspection, violation,
     │              accident, accident_injury, bid, bid_contractor
     ├─ vectors:    accident_chunk (narratives)
     ├─ cfr_section (stretch, exact lookup — not a vector table)
     └─ MATERIALIZED VIEW contractor_risk   ◄── REFRESH at end of ETL
             ▲ repos (packages/db) ───────────────┐
             │                                     │ (ETL + evals use same repos)
   Fastify API (apps/api)                          │
     ├─ services ──► repos ──────────────────────┘
     │         └──► EmbeddingProvider  ◄── embeds the query at search time
     ├─ agent loop ──► LLMProvider (Groq | Claude | …)
     │     session context: bid_id
     │     output contract: answer + citations (activity_nr + osha.gov URL)
     └─ tools (zod) ──► services
             ▲
   apps/web (Vite+React, mobile-first)
     ├─ GC: search sub → add to bid → risk table (reads contractor_risk)
     └─ foreman chat (bid as context)
   evals/  ──► agent IN-PROCESS (not HTTP) → measures accuracy + tool-calls
```

**Repo layout (Option B — lightweight monorepo):**
```
/apps/api        Fastify + agent loop + tools + services + ETL commands
  src/ etl/ agent/ tools/ services/ models/ dtos/ mappers/
/apps/web        Vite + React (GC table + foreman chat)
/packages/db     Drizzle schema + migrations + repositories (shared: API + ETL + evals)
/evals           question set + in-process runner
docker-compose.yml   Postgres+pgvector (local)
README.md
```
- **Repositories live only in `packages/db`** (not duplicated in apps/api). `apps/api` keeps services/dtos/mappers/tools/agent/etl.
- ETL lives inside `apps/api` as `pnpm etl:*` commands (conscious choice, documented) instead of a separate package.
- Embeddings run **at query time too** (not only ETL): services → EmbeddingProvider. On Dokploy the model loads once → no per-request cold start; budget ~300–500 MB RAM for the API container.

## Section 2 — Data model (APPROVED)

Postgres + `pgvector` + `pg_trgm`. IDs `bigint`.

### OSHA entities
```
inspection
  activity_nr bigint PK
  contractor_id int FK→contractor NULL      -- assigned after ER
  estab_name_raw text
  site_address, site_city, site_state, site_zip   -- NOTE: job site, not company HQ
  naics_code text         -- filtered '23%'
  insp_type char, insp_scope char
  open_date date, nr_in_estab int
  owner_type char, is_state_plan bool/jurisdiction   -- derived from reporting_id (README)
  union_status, safety_const, close_case_date

violation
  id serial PK
  activity_nr bigint FK→inspection
  citation_id text
  standard text           -- e.g. '19260020 B02' → CFR link
  viol_type char          -- S|W|R|O|U  (U=Unclassified)
  current_penalty numeric, initial_penalty numeric
  nr_instances int, nr_exposed int, gravity int NULL
  issuance_date, abate_date, final_order_date
  UNIQUE (activity_nr, citation_id)         -- idempotent upserts
  -- ETL filters delete_flag='X' (documented)

accident
  summary_nr bigint PK      -- NO activity_nr (link is N:M via accident_injury)
  event_date date NULL      -- fallback: open_date of rel_insp (documented)
  event_desc, project_type, build_stories, nonbuild_ht, fatality_flag

accident_injury
  id serial PK
  summary_nr bigint FK→accident
  rel_insp_nr bigint        -- = inspection.activity_nr (employer of injured worker); FK not forced (scope orphans)
  degree_of_inj char        -- 1=Fatality,2=Hospitalized,3=NonHosp
  fall_ht, fall_distance, fat_cause, nature_of_inj, part_of_body, age, sex

accident_inspection  (VIEW)  -- DISTINCT (summary_nr, rel_insp_nr) from accident_injury
```
- **Accident↔inspection is N:M** (one accident → inspections of GC + each sub). Fatalities/hospitalizations for the risk score are counted by grouping `accident_injury` on `rel_insp_nr → inspection.contractor_id` (attributed to the injured worker's employer).

### Entity resolution tables
```
contractor
  id serial PK, canonical_name, display_name, norm_name
  primary_state text        -- "state where most inspected", NOT a HQ (README finding)
  created_at

contractor_alias
  id serial PK, contractor_id int FK
  raw_name text, norm_name text
  occurrences int, first_seen, last_seen
  match_method text  -- 'exact'|'trgm'|'typo'
  confidence numeric
  UNIQUE (contractor_id, norm_name)         -- one row per variant, not per inspection
```

### Bid
```
bid            id serial PK, name text, created_at
bid_contractor
  id serial PK
  bid_id int FK→bid
  contractor_id int FK→contractor NULL      -- null if not matched in OSHA
  entered_name text                          -- what the GC typed
  trade text NULL
  status text   -- 'matched' | 'not_found'
  UNIQUE (bid_id, contractor_id) WHERE contractor_id IS NOT NULL   -- partial index
```
- Demo ships with one seeded bid of 10–15 real contractors (mix of bad/clean/no-record). Foreman chat gets `bid_id` as session context.
- UI shows **"No OSHA record found ≠ safe"** for `not_found` → the README caveat as product.

### Vectors / RAG (+ CFR lookup)
```
accident_chunk
  id serial PK, summary_nr bigint FK
  contractor_ids int[]      -- GIN; all employers linked to the accident (keeps N:M)
  event_date date
  text text                 -- REASSEMBLED narrative (group by summary_nr, order by line_nr, concat)
  tsv tsvector              -- hybrid search (stretch)
  embedding vector(384), embedding_model text   -- 'bge-small-en-v1.5'

cfr_section (stretch)
  id serial PK, section_code text UNIQUE, title text, text text   -- exact lookup (no embedding)
```
- Reassemble narratives; enrich chunk with `accident.event_desc` + construction context. Compare against `accident.abstract_text` and keep the fuller text.
- **Indexes: HNSW** for vectors (not IVFFlat). GIN on `norm_name gin_trgm_ops`, `tsv`, `contractor_ids`. FKs on `violation.activity_nr`, `inspection.contractor_id`, `accident_injury.rel_insp_nr` (rel_insp_nr FK not forced — scope orphans).

### Materialized view
```
MATERIALIZED VIEW contractor_risk   -- REFRESH at end of ETL
  contractor_id
  n_inspections, n_inspections_clean           -- clean = no violations (positive signal)
  n_violations, n_serious, n_willful, n_repeat, n_other, n_unclassified
  n_pending_contested                           -- violations without final_order_date
  total_current_penalty                         -- DISPLAY ONLY, not in score
  n_fatalities, n_fatalities_cited, n_fatalities_no_citation
  n_hospitalizations
  n_violations_3y, n_fatalities_3y, ...         -- last 3 years (recency)
  last_inspection_date
  risk_raw                                      -- uncapped; table sorts by this
  risk_score                                    -- min(100, round(risk_raw)); display
  score_as_of timestamptz                       -- refresh time (decay is relative to it)
  naics4_percentile   -- STRETCH: percentile vs same 4-digit NAICS
```

## Section 3 — Entity Resolution (APPROVED)

Runs in ETL after loading inspections, before assigning `inspection.contractor_id`.

1. **Normalization** `normalizeName(raw)`: UPPER, trim, collapse whitespace, strip punctuation, `&`→`AND`, strip trailing legal suffixes (`INC, LLC, LLP, LP, CO, CORP, CORPORATION, COMPANY, LTD, PC, PLLC, DBA, THE`). E.g. `"A.B.C. ROOFING, LLC"` → `ABC ROOFING`.
2. **Blocking by state** (`site_state`) — site address is the job site, so block by **state only, never zip/city**; avoids O(n²) and avoids false national merges of generic names.
3. **Matching bands** (within state). Candidate pairs generated by `pg_trgm similarity`:
   - **Exact:** identical `norm_name` → merge, confidence 1.0.
   - **trgm ≥ 0.65 (high + ambiguous):** merge **only if `distinctiveTokensMatch(a,b)`**.
   - **trgm < 0.65:** no merge.
   ```
   distinctiveTokensMatch(a,b):
     tokenize, drop generic/industry tokens (ROOFING, CONSTRUCTION, CONTRACTOR(S),
       BUILDERS, ELECTRIC(AL), PLUMBING, MECHANICAL, CONCRETE, MASONRY, PAINTING,
       SERVICES, GROUP, ENTERPRISES, INDUSTRIES, …)
     ∃ distinctive ta∈a, tb∈b with:
        ta == tb                                          (exact)
        OR (len(ta)≥4 AND len(tb)≥4 AND levenshtein(ta,tb)≤1)  (typo tolerance)
   # SMITH vs SMTIH → merge (typo).  ABC vs ABD → no merge (short acronym).
   ```
   - **Embeddings are NOT used to decide name matches** (semantic similarity ≠ identity: "ABC ROOFING" vs "XYZ ROOFING" look similar). At most logged as a secondary confidence signal; can never cause a merge alone. README point.
4. **Clustering:** Union-Find over passing pairs → clusters. Per cluster: `canonical_name` = most frequent norm_name, `display_name` = most frequent raw_name, `primary_state` = state with most inspections.
   - **4b — cohesion validation (anti-chaining):** single-linkage can chain (A~B~C with A~C low). For each member require `similarity(member, canonical) ≥ 0.80 OR shares distinctive token with canonical`; otherwise split out. Flag oversized/low-cohesion clusters as "suspicious" → count + report in README.
5. **`search_contractor` (runtime tool):** same normalization; block by `state?` if given, else national (interactive, human picks); rank candidates by trgm over `contractor.norm_name` + `contractor_alias.norm_name` with confidence.

**Failure modes (README):**
- Multi-state split: default no cross-state merge → a sub working in CA & TX becomes two contractors (conscious trade-off; avoids generic false merges). Optional: cross-state merge only with very high similarity + distinctive (long, non-generic) name.
- Prefer **split over merge** (false merge is worse for a GC: attributes one sub's history to another).
- Generic names / typos raising trgm: residual, documented.

**Testing:** unit tests for `normalizeName`; `distinctiveTokensMatch` cases (SMITH/SMTIH merge, ABC/ABD split, A-B-C chain not fused); ~15-pair hand-labeled gold set → precision/recall in README.

## Section 4 — Risk Score (APPROVED, with adjustments)

Transparent & decomposable; computed in `contractor_risk` via SQL. Never shown without breakdown.

**Violation severity weights** (config): Willful 10, Repeat 7, Serious 3, Other 1, Unclassified 1.
- README justification for W=10 vs S=3: OSHA's statutory **maximum penalty for willful/repeat is 10× serious** — 2026: Serious/Other-than-Serious $16,550; Willful/Repeat $165,514 (no inflation increase for 2026). Source: https://www.osha.gov/memos/2026-05-21/2026-annual-adjustments-osha-civil-penalties

**Harm weights** (config): Fatality 50, Hospitalized 15, Non-hospitalized 3.

**Recency decay** (per event, SQL): `decay(date) = 0.5 ^ (age_years / 5)` (5-yr half-life); violations use `issuance_date`, injuries use `event_date`.

**Adjustments (approved):**
1. **Fatality/injury without citation:** if the injury's inspection (`rel_insp_nr`) has **no S/W/R violation**, the harm term for that injury is multiplied by **×0.3** (the incident happened but OSHA issued no serious citation). UI/breakdown label: "fatality (cited)" vs "fatality (no citation issued)".
2. **Count citation items, not `nr_instances`:** VSS sums one term per citation item (unique `activity_nr+citation_id`); `nr_instances` is stored but NOT multiplied into the score.
3. **Pending/contested violations:** rows **without `final_order_date` are counted** but flagged "pending/contested" in the breakdown. We use the **current `viol_type`**.
4. **Penalties are NOT in the score** (shown only). Reasons stated explicitly in README: avoids double-counting severity, and `current_penalty` depends on settlements/contests.

```
VSS = Σ_citation_items ( weight(type) × decay(issuance_date) )          -- one term per citation item
HS  = Σ_injuries       ( weight(degree) × decay(event_date)
                         × (0.3 if injury's rel_insp has no S/W/R viol else 1.0) )
severity_rate = VSS / max(n_inspections, 3)      -- floor 3; don't inflate 1-inspection subs
risk_raw      = 10 × severity_rate + HS           -- harm counts absolute
risk_score    = min(100, round(risk_raw))         -- display score
band          = HIGH (≥60) | MEDIUM (25–59) | LOW (1–24) | NONE
```
Multiplier `10×` and band cutoffs in config; calibrate against the 3-state data so bands are sensible (documented).

- **Ranking:** the GC table sorts by **`risk_raw` (uncapped)**, not the 0–100 `risk_score`, so the worst subs don't tie at 100. `risk_score`/`band` are for display.
- **`score_as_of`:** `contractor_risk` stores the refresh timestamp; shown in UI/summary because the decay is relative to that date.

**Breakdown** returned by `get_contractor_summary` / GC table: `risk_score` + band (+ `risk_raw` for ranking), fatalities split cited vs no-citation (decayed contribution), counts by type, pending/contested count, severity_rate (and #inspections), total penalty (display only), last-3y subset, last inspection date, `score_as_of`.

**Caveats (README + UI):**
- `risk_score = NULL` / "No OSHA record" when no inspections — **never 0**. No inspections ≠ safe.
- OSHA inspections aren't random (selection bias): high score may reflect scrutiny, not necessarily a worse firm.
- Normalizing by inspections can "reward" the rarely-inspected.
- 3-state scope: out-of-state history excluded; ER cross-state split divides a sub's score.
- **Stretch:** `naics4_percentile` — percentile of `risk_raw` vs same 4-digit NAICS ("worse than 85% of roofers") for fairer peer comparison.

## ETL cross-cutting decisions (APPROVED)
- Dependent tables loaded **from the in-scope `activity_nr` set**, not separately:
  - `violation`: `in` on `activity_nr` (batched); never orphan violations.
  - `accident_injury`: `in` on `rel_insp_nr` (batched) → then `summary_nr` set → `in` on `accident` + `accident_abstract`.
  - Batch size ~200 ids (safe URL length; tune/verify in impl). Fallback: full download + local filter.
- **Paginate within each batch:** 200 activity_nr can exceed the per-page limit (a big sub has many violations/inspection) → loop `offset` until exhausted.
- **Deterministic raw cache per batch:** `data/raw/<endpoint>/<hash(endpoint+filter_object+offset)>.json` → truly resumable (resume at failed batch). Retry with exponential backoff for rate limits.
- `rel_insp_nr` may point outside scope → do not force that FK / drop orphans, count them, README: "N injuries dropped: related inspection outside scope".
- Per-accident fatality/hospitalization counts reflect **only in-scope employers** (an accident may have injuries from out-of-scope employers we don't fetch). One README line.
- **Fixed ETL order (documented):** fetch → clean → entity resolution → assign `inspection.contractor_id` → recompute `accident_chunk.contractor_ids` → embed (only new/changed text; hash the text) → `REFRESH MATERIALIZED VIEW contractor_risk`.

---

## Section 5 — Agent, tools, RAG, evals (APPROVED, with adjustments)

Core principle holds: the LLM never invents numbers and never writes free SQL. Every fact comes from a typed tool.

### Tools (zod, thin → services)

| Tool | Input | Returns | Source |
|---|---|---|---|
| `get_bid` | *(uses session `bid_id`)* | bid subs: `matched` (contractor_id) + `not_found` (entered_name) | SQL |
| `search_contractor` | `name, state?` | candidates + `confidence` | SQL (trgm) |
| `get_contractor_summary` | `contractor_id` | risk_raw/score/band + full breakdown + `score_as_of` | SQL (MV) |
| `list_violations` | `contractor_id, since?, type?` | citation items (+ pending/contested flag) + `activity_nr` | SQL |
| `compare_contractors` | `contractor_ids[], metric` | ranking by metric | SQL |
| `search_incidents` | `query, contractor_id?` | top-k narratives + metadata + citations | RAG |
| `explain_standard` | `standard_code` | CFR text + section citation | **exact lookup** (stretch) |

- **No `run_readonly_sql` in the MVP** — the typed tools cover the eval questions; dropping it keeps "no free SQL" clean and reduces surface. Noted "with more time" in README.
- `metric` ∈ `risk_raw | fatalities | serious | repeat | willful | total_penalty | falls`. Ranking/counting ("which of my subs has most X") = number → structured tool, not RAG. Agent resolves "my subs" via `get_bid` → `contractor_ids` → `compare_contractors`. `falls` uses a structured signal from `accident_injury` (`fall_ht` not null / `fat_cause` = fall); approximation documented (event code depends on `accident_lookup2`).
- **`explain_standard` is an exact lookup, NOT RAG:** parse `standard_code` → normalized `section_code` → `cfr_section` row by equality. No embeddings / no similarity. No exact match → "standard not in corpus".

### Agent loop (`LLMProvider` = Groq)

- **System prompt:** (1) numbers come from tools, never invent; (2) mandatory **citation contract**; (3) session context = `bid_id` + bid name.
- Loop: `LLM → tool_calls → execute (services) → feed results → repeat → final answer`. **Max 6 iterations.**
- **Tool errors AND zod validation errors are returned to the LLM** as a readable `{error}` so it can self-correct (bad args, wrong tool) within the iteration budget.
- **Output contract** (validated by the eval runner):
```
{ answer: string,
  citations: [{ type:'inspection'|'incident'|'cfr',
                activity_nr?, summary_nr?, section_code?, url }] }
```
- OSHA URL: `https://www.osha.gov/ords/imis/establishment.inspection_detail?id=<activity_nr>` (verify when wiring). CFR → section link.
- `LLMProvider` behind an interface; **comparing Groq vs Claude is a stretch** (core runs on Groq), reported in README if done.

### RAG (retrieval)

- `search_incidents`: embed the query → search `accident_chunk`.
  - **With `contractor_id`: exact filtered search** (the contractor's chunk set is small → exact distance / sequential scan, so the ANN index can't drop matches). **HNSW is used only for global search** (no contractor filter).
  - **Similarity threshold:** if the best match is below the threshold, return **"no relevant incidents"** (don't surface weak matches). Threshold in config, tuned on real data.
  - Top-k (≈5) with `summary_nr`, `event_date`, linked `activity_nr`s, contractor → citations. Hybrid (vector + `tsv`, RRF) is a stretch.

### Evals (weighs most for the role)

- **~16 questions**, categories:
  - *Lookup*: "{sub} risk summary" → exact numbers.
  - *Comparison*: "which of my subs has most fatalities / worst risk?" → `get_bid` + `compare_contractors`.
  - *Narrative/RAG*: "what happened in {sub}'s accidents?" → `search_incidents` with citation.
  - *Unknown*: sub not in OSHA → "No OSHA record ≠ safe", no fabrication.
  - *Ambiguous name*: name matching several contractors → agent should disambiguate (ask / present candidates), not silently pick one.
  - *Pressure to fabricate*: user pushes for a number the tools don't support → agent must refuse/qualify, not invent.
  - *Out-of-scope*: question about data outside the 3-state/NAICS-23/10y scope → agent states the limitation.
- **Ground truth:** expected numbers computed **directly via SQL** in eval setup (always consistent with loaded data).
- **Citation grounding check:** every citation in the answer must correspond to something that actually appeared in a tool result during that conversation — no hallucinated `activity_nr`/`summary_nr`.
- **In-process runner** (not HTTP): calls the agent with a fixed `bid`, captures `answer` + **tool-call trace** (tool, args). Scores: (a) numeric accuracy, (b) tool-call correctness, (c) citation presence + grounding. README reports accuracy (+ per-provider if the Claude comparison stretch is done).

### Frontend (MVP, mobile-first)

One page, two zones:
- **GC dashboard:** bid table sorted by `risk_raw`, row expands to the breakdown; search box to add a sub (`search_contractor`); `not_found` rows show "No OSHA record ≠ safe".
- **Foreman chat:** mobile-first panel, `bid` as context; answers render citations as osha.gov links.

## Open follow-ups
- Confirm embeddings on the deploy Node version (smoke test, ETL step 1).
- Verify `in` batch max URL length; verify osha.gov citation URL format.
- Calibrate risk weights/bands on real 3-state data.
