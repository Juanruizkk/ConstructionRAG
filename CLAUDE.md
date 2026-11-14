# CLAUDE.md — Site Safety Intelligence (take-home)

## Context
Take-home assessment for a **Software Engineer** role. The company cares a lot about **RAG, embeddings and tool calling**. Those are what get judged, so the AI layer has to be solid and well argued.

- **Deadline:** deliver by **Sunday Nov 15, 2026, night EST** (formally due Mon Nov 16, 9am EST).
- **Deliverables:** public repo + README with decisions & trade-offs. Deployed URL is a plus.
- **Owner:** Juan. Talk to him in informal Argentine Spanish and keep it concise and direct. Code, comments, README and commits go in **English**.

### The problem (from the brief)
A general contractor (GC) is bidding a job with 10–15 subcontractors. Before signing, the GC wants to know **which subs have a worrying safety history**. The **foreman wants to ask plain-English questions** about it while on site (mobile).

Required:
1. A database schema explained in the README (why this structure).
2. A quick way for the GC to see info on the subs.

The data is "messy on purpose". Other public data may help.

## Data sources
`enforcedata.dol.gov` has been **retired** and now redirects to `data.dol.gov` (DOL Open Data Portal). Each OSHA table is now its own dataset.

**Careful:** datasets 10349 / 10355 are **MSHA (mining)**. Don't use them.

| ID | Endpoint | Use |
|---|---|---|
| **10334** | `inspection` | Core: establishment, site address, NAICS, inspection type/dates |
| **10338** | `violation` | Citations: standard, type (serious/willful/repeat/other), penalties |
| 10357 | `violation_event` | Current violation status: penalties, abatement, settlements |
| 10331 | `accident` | Incidents investigated by OSHA |
| 10332 | `accident_abstract` | **Narrative text**, the main RAG corpus |
| 10333 | `accident_injury` | Injured person details (degree of injury → fatalities) |
| 10336 | `related_activity` | Complaints/referrals/accidents linked to inspections |
| 10337 | `emphasis_codes` | National/local emphasis programs |
| 10330 | `accident_lookup2` | Code lookups for accident tables |

- API: `https://apiprod.dol.gov/v4/...`. It needs a **free API key** (register at https://dataportal.dol.gov/registration). Read the key from the env var `DOL_API_KEY`, never commit it.
- **Check the exact request format, pagination/limits and field names against the portal docs and data dictionary before coding.** Don't assume them.
- Join key: `activity_nr` (inspection ↔ violation, etc.). For accident tables, check the related inspection key in the dictionary.
- **Scope the download:** construction only (NAICS starting with `23`) and roughly the last 10 years. The full dataset is millions of rows. Make the ETL idempotent and resumable (cache raw pages to `data/raw/`, gitignored).
- Optional extra corpus: the text of **29 CFR 1926** (construction standards), so the agent can explain cited standards with citations.

## Architecture (decided)
Key principle, and it should be explained in the README: **numbers come from tools/SQL, never from RAG.** RAG is only for unstructured text. That way the LLM can't hallucinate counts or penalties.

```
DOL API ──► ETL (TS) ──► Postgres + pgvector
                          ├─ relational: contractors, inspections, violations, accidents
                          └─ vectors: accident narratives, CFR sections, contractor name embeddings
                               ▲
Frontend (GC table + foreman chat) ──► API (Fastify) ──► Agent loop (LLM tool calling)
```

### 1. Entity resolution (the "messy" part)
The same sub shows up under many names ("ABC Roofing Inc", "A.B.C. ROOFING LLC").
- Normalize: uppercase, strip punctuation and legal suffixes (INC, LLC, CO, CORP…), collapse whitespace. Normalize address and zip too.
- Candidate matching: `pg_trgm` similarity on normalized name, blocked by state/zip.
- Ambiguous band: cosine similarity of embeddings (name + city/state) with an explicit threshold.
- Keep a `contractor` (canonical) + `contractor_alias` (raw name variants, with match method & confidence). Keep it explainable, and document false-merge vs. split trade-offs.

### 2. Tool calling (structured questions)
Typed tools with zod schemas. The LLM never writes free SQL by default.
- `search_contractor(name, state?)` → candidates with confidence
- `get_contractor_summary(contractor_id)` → inspections, violations by type, penalties, fatalities, last inspection, risk score
- `list_violations(contractor_id, since?, type?)`
- `compare_contractors(contractor_ids[], metric)`
- `search_incidents(query, contractor_id?)` → RAG over accident narratives
- `explain_standard(standard_code)` → RAG over the CFR text
- Optional escape hatch: `run_readonly_sql` (read-only DB role, row limit, timeout)

Every answer must **cite sources**: `activity_nr`, link to the osha.gov inspection page, CFR section.

### 3. RAG
- Chunks: one per accident abstract (they're short), CFR split by section.
- Store the embedding plus metadata (contractor_id, date, activity_nr) for filtered retrieval. Hybrid search (vector + `tsvector`) if time allows.

### 4. Risk score
A transparent, documented formula. Something like weighted counts (willful/repeat > serious > other), fatalities/hospitalizations, recency decay, normalized by number of inspections. Show the breakdown and not just the number. README caveat: **no inspections ≠ safe**.

## Stack (TypeScript)
- Node 24 + TypeScript (strict), pnpm
- API: **Fastify**, validation with **zod**
- DB: **Postgres + pgvector + pg_trgm**, ORM/migrations with **Drizzle**
- LLM: Anthropic SDK (Claude, tool use). Embeddings: OpenAI `text-embedding-3-small` or Voyage. Hide it behind an `EmbeddingProvider` interface.
- Frontend: Vite + React (or Next) with a mobile-friendly chat
- Local: `docker compose` (Postgres with pgvector)
- Deploy: Neon/Supabase (pgvector) + Render/Railway/Vercel
- Tests: vitest

### Code conventions (Juan's preference)
Clean, layered structure: `models / dtos / mappers / services / repositories`. Keep the agent tools thin and have them call services. Never hardcode secrets; use `.env` + `.env.example`.

## Suggested repo layout
```
/apps/api        Fastify server, agent loop, tools
/apps/web        GC dashboard + foreman chat
/packages/db     Drizzle schema, migrations, repositories
/packages/etl    DOL fetch, cleaning, entity resolution, embeddings
/evals           question set + expected answers + runner
docker-compose.yml
README.md
```

## Evals (important for this role)
10–20 questions with expected answers (exact numbers from SQL). Mix lookup, comparison, narrative/RAG and "unknown contractor" cases. Have a script that runs the agent and reports accuracy and tool-call correctness. Put the results in the README.

## README must cover
- Schema diagram + why (normalization, canonical contractor + aliases, why pgvector in the same DB)
- Tools vs. RAG split and why
- Entity resolution approach, thresholds, failure modes
- Risk score formula and limitations
- Data scoping choices (NAICS 23, years) and what was cleaned
- Trade-offs and what I'd do with more time
- How to run locally + deployed URL

## Plan
- **Fri/Sat AM:** API key, ETL for inspection + violation (+ accident tables), schema & migrations, entity resolution
- **Sat:** services, tools, agent loop, embeddings + RAG
- **Sun:** frontend, evals, deploy, README
