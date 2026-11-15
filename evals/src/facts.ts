import postgres from 'postgres';

export interface Facts {
  bidId: number;
  bidName: string;
  worst: {
    id: number; name: string; riskRaw: number; riskScore: number;
    serious: number; willful: number; fatalities: number; totalPenalty: number;
  };
  bidTotals: { subs: number; fatalities: number; subsWithFatality: number };
  cfr: { code: string; keyword: string };
  ambiguousName: string;
  fatalIncidentContractor: { id: number; name: string } | null;
}

export async function loadFacts(url = process.env.DATABASE_URL!): Promise<Facts> {
  const sql = postgres(url, { max: 1 });
  try {
    const [bid] = await sql<{ id: number; name: string }[]>`SELECT id, name FROM bid ORDER BY id DESC LIMIT 1`;
    const ranked = await sql<{
      id: number; name: string; risk_raw: number; risk_score: number;
      n_serious: number; n_willful: number; n_fatalities: number; total_current_penalty: number;
    }[]>`
      SELECT r.contractor_id AS id, c.display_name AS name, r.risk_raw, r.risk_score,
             r.n_serious, r.n_willful, r.n_fatalities, r.total_current_penalty
      FROM contractor_risk r JOIN contractor c ON c.id = r.contractor_id
      JOIN bid_contractor bc ON bc.contractor_id = r.contractor_id
      WHERE bc.bid_id = ${bid!.id} ORDER BY r.risk_raw DESC`;
    const [totals] = await sql<{ subs: number; fatalities: number; subs_with_fatality: number }[]>`
      SELECT count(*)::int AS subs,
             COALESCE(sum(r.n_fatalities),0)::int AS fatalities,
             count(*) FILTER (WHERE r.n_fatalities > 0)::int AS subs_with_fatality
      FROM bid_contractor bc JOIN contractor_risk r ON r.contractor_id = bc.contractor_id
      WHERE bc.bid_id = ${bid!.id}`;
    const [cfr] = await sql<{ section_code: string }[]>`
      SELECT section_code FROM cfr_section WHERE section_code = '1926.501' LIMIT 1`;
    const [amb] = await sql<{ display_name: string }[]>`
      SELECT display_name FROM contractor GROUP BY display_name HAVING count(*) > 1 LIMIT 1`;
    // Prefer a fatal-incident sub whose narrative is actually in the RAG index,
    // so the narrative case tests retrieval rather than an empty search.
    const [fatal] = await sql<{ id: number; name: string }[]>`
      SELECT r.contractor_id AS id, c.display_name AS name FROM contractor_risk r
      JOIN contractor c ON c.id = r.contractor_id
      JOIN bid_contractor bc ON bc.contractor_id = r.contractor_id
      WHERE bc.bid_id = ${bid!.id} AND r.n_fatalities > 0
      ORDER BY EXISTS (
        SELECT 1 FROM accident_chunk ac
        WHERE r.contractor_id = ANY(ac.contractor_ids) AND ac.embedding IS NOT NULL
      ) DESC, r.contractor_id
      LIMIT 1`;
    const worst = ranked[0]!;
    return {
      bidId: bid!.id,
      bidName: bid!.name,
      worst: {
        id: worst.id, name: worst.name,
        riskRaw: Number(worst.risk_raw), riskScore: Number(worst.risk_score),
        // COUNT(...) columns come back from postgres.js as strings (bigint) — coerce to number.
        serious: Number(worst.n_serious), willful: Number(worst.n_willful),
        fatalities: Number(worst.n_fatalities), totalPenalty: Math.round(Number(worst.total_current_penalty)),
      },
      bidTotals: { subs: totals!.subs, fatalities: totals!.fatalities, subsWithFatality: totals!.subs_with_fatality },
      cfr: { code: cfr?.section_code ?? '1926.501', keyword: 'fall protection' },
      ambiguousName: amb?.display_name ?? 'ABC CONSTRUCTION',
      fatalIncidentContractor: fatal ? { id: fatal.id, name: fatal.name } : null,
    };
  } finally {
    await sql.end();
  }
}
