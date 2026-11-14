import type { BidRow } from '../lib/api.js';
import { ContractorRow } from './ContractorRow.js';

export function BidTable({ rows }: { rows: BidRow[] }) {
  return (
    <section>
      <h2>Subcontractors on this bid <span className="muted">(worst first)</span></h2>
      {rows.length === 0 && <p className="muted">No subs yet.</p>}
      {rows.map((r) => <ContractorRow key={`${r.contractorId ?? 'nf'}-${r.name}`} r={r} />)}
    </section>
  );
}
