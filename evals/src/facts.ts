import postgres from 'postgres';

export interface Facts {
  bidId: number;
  bidName: string;
  worst: { id: number; name: string; riskRaw: number; serious: number; fatalities: number };
  ambiguousName: string;
  fatalIncidentContractor: { id: number; name: string } | null;
}

export async function loadFacts(url = process.env.DATABASE_URL!): Promise<Facts> {
  const sql = postgres(url, { max: 1 });
  try {
    const [bid] = await sql<{ id: number; name: string }[]>`SELECT id, name FROM bid ORDER BY id DESC LIMIT 1`;
    const ranked = await sql<{ id: number; name: string; risk_raw: number; n_serious: number; n_fatalities: number }[]>`
      SELECT r.contractor_id AS id, c.display_name AS name, r.risk_raw, r.n_serious, r.n_fatalities
      FROM contractor_risk r JOIN contractor c ON c.id = r.contractor_id
      JOIN bid_contractor bc ON bc.contractor_id = r.contractor_id
      WHERE bc.bid_id = ${bid!.id} ORDER BY r.risk_raw DESC`;
    const [amb] = await sql<{ display_name: string }[]>`
      SELECT display_name FROM contractor GROUP BY display_name HAVING count(*) > 1 LIMIT 1`;
    const [fatal] = await sql<{ id: number; name: string }[]>`
      SELECT r.contractor_id AS id, c.display_name AS name FROM contractor_risk r
      JOIN contractor c ON c.id = r.contractor_id
      JOIN bid_contractor bc ON bc.contractor_id = r.contractor_id
      WHERE bc.bid_id = ${bid!.id} AND r.n_fatalities > 0 LIMIT 1`;
    const worst = ranked[0]!;
    return {
      bidId: bid!.id,
      bidName: bid!.name,
      worst: { id: worst.id, name: worst.name, riskRaw: Number(worst.risk_raw), serious: worst.n_serious, fatalities: worst.n_fatalities },
      ambiguousName: amb?.display_name ?? 'ABC CONSTRUCTION',
      fatalIncidentContractor: fatal ? { id: fatal.id, name: fatal.name } : null,
    };
  } finally {
    await sql.end();
  }
}
