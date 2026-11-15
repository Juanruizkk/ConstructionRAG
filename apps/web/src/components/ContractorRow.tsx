import { useState } from 'react';
import { band } from '../lib/band.js';
import type { BidRow } from '../lib/api.js';

export function ContractorRow({ r, enriching = false }: { r: BidRow; enriching?: boolean }) {
  const [open, setOpen] = useState(false);
  const b = band(r.riskScore);
  const notFound = r.status === 'not_found';
  const notLoaded = !notFound && !r.historyLoaded;
  const isEnriching = notLoaded && enriching;
  const expandable = !notFound && !notLoaded;
  return (
    <div className="card">
      <div className="row clickable" style={{ justifyContent: 'space-between' }} onClick={() => expandable && setOpen((o) => !o)}>
        <span className="sub-name">
          <strong>{r.name}</strong>
          {r.state && <span className="chip state">{r.state}</span>}
        </span>
        {notFound
          ? <span className="badge b-NONE">No OSHA record ≠ safe</span>
          : isEnriching
            ? <span className="badge enriching" title="Loading this sub's OSHA history…">Enriching…</span>
            : notLoaded
              ? <span className="badge b-NONE" title="OSHA history not downloaded for this sub yet">History not loaded</span>
              : <span className={`badge b-${b}`}>{b} · {r.riskScore ?? '—'}</span>}
      </div>
      {open && expandable && (
        <div className="breakdown">
          <div><span className="k">Inspections:</span> {r.inspections ?? 0}</div>
          <div><span className="k">Serious violations:</span> {r.serious ?? 0}</div>
          <div><span className="k">Fatalities:</span> {r.fatalities ?? 0}</div>
          <div><span className="k">risk_raw (uncapped):</span> {r.riskRaw != null ? r.riskRaw.toFixed(1) : '—'}</div>
        </div>
      )}
    </div>
  );
}
