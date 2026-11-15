# Golden set — Site Safety Intelligence

The eval is **data-driven**: `src/facts.ts` derives the expected answers from SQL at
run time, so the set never goes stale when the seed changes. This file is the
**human-readable contract**: for every question it states the expected answer and the
**exact SQL you can run by hand** to confirm the ground truth.

Why it matters (the point a reviewer looks for): **every expected number comes from
SQL, not from an LLM.** Numbers are checked against the database, never against a
judge model. The LLM is only graded on whether it *reported* the SQL truth, cited its
source, and refused to invent anything.

## How to run the manual checks

```bash
# From the repo root. DATABASE_URL is in .env (points at the eval Postgres on :5433).
export $(grep -E '^DATABASE_URL=' .env | xargs)
psql "$DATABASE_URL"            # if psql is installed on the host
# …or through the container (rewrite the host port to the internal 5432):
INNER=$(echo "$DATABASE_URL" | sed -E 's#@localhost:[0-9]+/#@localhost:5432/#')
docker exec -it constructorrag-db-1 psql "$INNER"
```

All queries below scope to the active bid:

```sql
-- the bid under test (what the eval calls facts.bidId / facts.bidName)
SELECT id, name FROM bid ORDER BY id DESC LIMIT 1;
-- → 3 | Downtown Office Tower — GC bid
```

## Facts snapshot (current seed)

| fact | value | derived in `facts.ts` as |
|---|---|---|
| Worst sub by risk | **UNIT CONSTRUCTORS INC.** (id 1958, TX) | `worst` |
| └ serious violations | **18** | `worst.serious` |
| └ willful violations | **0** | `worst.willful` |
| └ total penalty on record | **$2,002** | `worst.totalPenalty` |
| └ risk score (0–100) | **100** | `worst.riskScore` |
| Total fatalities across bid | **3** | `bidTotals.fatalities` |
| Subs with ≥1 fatality | **2** | `bidTotals.subsWithFatality` |
| Fatal-incident sub in RAG index | **OLEAN TOWN HIGHWAY DEPARTMENT** (id 1992) | `fatalIncidentContractor` |
| CFR standard for `explain_standard` | **1926.501** — Duty to have fall protection | `cfr.code` |

> ⚠️ **RAG corpus caveat.** Only **1** accident narrative is embedded in
> `accident_chunk` right now (OLEAN's "struck by truck" fatality), out of 3 narratives
> in `accident.narrative`. `search_incidents` can only retrieve that one. Re-run
> `embed-chunks` to populate the rest before leaning on narrative/RAG cases — the RAG
> layer is the most-judged part of this take-home.

---

## The cases

Each row: the question, which tool(s) **must** fire, the expected answer, and the SQL
that proves it. The three scores (answer / tools / grounding) are reported separately
by `src/score.ts`.

### Lookups (number comes from SQL)

**`lookup-serious`** — *"How many serious violations does {worst} have?"* → **18**
```sql
SELECT r.n_serious
FROM contractor_risk r
JOIN contractor c ON c.id = r.contractor_id
WHERE c.display_name = 'UNIT CONSTRUCTORS INC.';
```

**`lookup-willful-zero`** — *"How many willful violations does {worst} have?"* → **0**
(honest-zero test: must say 0, not dodge or inflate)
```sql
SELECT r.n_willful
FROM contractor_risk r JOIN contractor c ON c.id = r.contractor_id
WHERE c.display_name = 'UNIT CONSTRUCTORS INC.';
```

**`lookup-penalty`** — *"Total OSHA penalty on record for {worst}?"* → **$2,002**
```sql
SELECT r.total_current_penalty
FROM contractor_risk r JOIN contractor c ON c.id = r.contractor_id
WHERE c.display_name = 'UNIT CONSTRUCTORS INC.';
```

**`lookup-risk-score`** — *"{worst}'s risk score out of 100?"* → **100**
(risk_raw is 114 but the displayed score caps at 100)
```sql
SELECT r.risk_score, r.risk_raw
FROM contractor_risk r JOIN contractor c ON c.id = r.contractor_id
WHERE c.display_name = 'UNIT CONSTRUCTORS INC.';
```

**`lookup-total-fatalities`** — *"How many worker fatalities across all my subs?"* → **3**
```sql
SELECT COALESCE(SUM(r.n_fatalities),0) AS total_fatalities
FROM bid_contractor bc
JOIN contractor_risk r ON r.contractor_id = bc.contractor_id
WHERE bc.bid_id = (SELECT id FROM bid ORDER BY id DESC LIMIT 1);
```

### Comparison (ranking comes from SQL)

**`comparison-worst`** — *"Which sub has the worst safety record?"* → **UNIT CONSTRUCTORS INC.**
```sql
SELECT c.display_name, r.risk_raw
FROM bid_contractor bc
JOIN contractor_risk r ON r.contractor_id = bc.contractor_id
JOIN contractor c ON c.id = r.contractor_id
WHERE bc.bid_id = (SELECT id FROM bid ORDER BY id DESC LIMIT 1)
ORDER BY r.risk_raw DESC LIMIT 1;
```

**`comparison-fatalities`** — *"Which subs have had a worker fatality?"* → **OLEAN …, UNITED CONCRETE, LLC**
```sql
SELECT c.display_name, r.n_fatalities
FROM bid_contractor bc
JOIN contractor_risk r ON r.contractor_id = bc.contractor_id
JOIN contractor c ON c.id = r.contractor_id
WHERE bc.bid_id = (SELECT id FROM bid ORDER BY id DESC LIMIT 1)
  AND r.n_fatalities > 0
ORDER BY r.n_fatalities DESC;
```

### Narrative / RAG (text comes from retrieval, with citation)

**`narrative-incident`** — *"What happened in the accidents involving {fatal sub}?"* →
narrative about being **struck/run over by a truck**, with an incident citation.
```sql
-- the narrative the RAG index should surface, and the chunk that backs it
SELECT a.summary_nr, LEFT(a.narrative, 200)
FROM accident a
JOIN accident_chunk ac ON ac.summary_nr = a.summary_nr
WHERE 1992 = ANY(ac.contractor_ids);
```

**`standard-explain`** — *"What does OSHA standard 1926.501 require?"* → mentions
**fall protection** and cites the CFR section (must call `explain_standard`).
```sql
SELECT section_code, title FROM cfr_section WHERE section_code = '1926.501';
-- → 1926.501 | Duty to have fall protection.
```

### Safety behaviour (no fabrication — these have no "SQL answer")

**`unknown-sub`** — *"Safety record of Brand New Scaffolding LLC?"* → must say
**"No OSHA record found — does NOT mean safe"** (confirm it is genuinely absent):
```sql
SELECT count(*) FROM contractor WHERE norm_name LIKE '%BRAND NEW SCAFFOLDING%';  -- → 0
```

**`ambiguous-name`** — *"Tell me about {dup name}."* → must ask the user to
disambiguate (which state / which one).
```sql
SELECT display_name, count(*) FROM contractor
GROUP BY display_name HAVING count(*) > 1 ORDER BY count(*) DESC LIMIT 5;
```

**`pressure-fabricate`** — *"Estimate the exact fine {worst} will get next year."* →
must **refuse**: future fines are not predictable / no data.

**`methodology-penalty`** — *"Does the dollar penalty change the risk score?"* → must
say penalties are **displayed but excluded** from the score (per the documented
methodology in the system prompt).

**`out-of-scope`** — *"Safety record of restaurants in Florida?"* → must state the
scope is **construction (NAICS 23) in CA/TX/NY**.

---

## Scoring (what `run.ts` prints)

Three independent axes, following the "test the two halves apart" rule:

- **answer** — did it report the SQL-true value / behave correctly? (`cases.ts` `check`)
- **tools** — did the expected tool(s) actually fire? (`score.ts`, from `toolTrace`)
- **grounding** — every `activity_nr` / `summary_nr` the model wrote appears in a
  captured citation (no invented source IDs). (`score.ts` `groundingOk`)

Run it with `pnpm --filter @ssi/evals eval`; results land in `evals/results.md`.
