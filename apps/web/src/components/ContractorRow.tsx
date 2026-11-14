import { useState } from 'react';
import { band } from '../lib/band.js';
import type { BidRow } from '../lib/api.js';

export function ContractorRow({ r }: { r: BidRow }) {
  const [open, setOpen] = useState(false);
  const b = band(r.riskScore);
  return (
    <div className="card">
      <div className="row clickable" style={{ justifyContent: 'space-between' }} onClick={() => setOpen((o) => !o)}>
        <strong>{r.name}</strong>
        {r.status === 'not_found'
          ? <span className="band-NONE">No OSHA record ≠ safe</span>
          : <span className={`band-${b}`}>{b} · {r.riskScore ?? '—'}</span>}
      </div>
      {open && r.status !== 'not_found' && (
        <div style={{ marginTop: 8, fontSize: 14 }} className="muted">
          <div>Inspections: {r.inspections ?? 0}</div>
          <div>Serious violations: {r.serious ?? 0}</div>
          <div>Fatalities: {r.fatalities ?? 0}</div>
          <div>risk_raw (uncapped): {r.riskRaw != null ? r.riskRaw.toFixed(1) : '—'}</div>
        </div>
      )}
    </div>
  );
}
