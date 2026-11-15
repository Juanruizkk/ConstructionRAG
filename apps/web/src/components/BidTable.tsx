import type { BidRow } from '../lib/api.js';
import { ContractorRow } from './ContractorRow.js';

export function BidTable({ rows, enriching }: { rows: BidRow[]; enriching: Set<number> }) {
  return (
    <section>
      <h2>Subcontractors on this bid <span className="muted">(worst first)</span></h2>
      {rows.length === 0 && <p className="muted">No subs yet.</p>}
      {rows.map((r) => (
        <ContractorRow
          key={`${r.contractorId ?? 'nf'}-${r.name}`}
          r={r}
          enriching={r.contractorId != null && enriching.has(r.contractorId)}
        />
      ))}
    </section>
  );
}
