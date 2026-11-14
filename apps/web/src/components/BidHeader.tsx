import { band } from '../lib/band.js';
import type { BidRow } from '../lib/api.js';

const SCOPE_STATES = ['CA', 'TX', 'NY'];

export function BidHeader({ name, rows }: { name: string; rows: BidRow[] }) {
  const matched = rows.filter((r) => r.status !== 'not_found');
  const highRisk = matched.filter((r) => band(r.riskScore) === 'HIGH').length;
  const noRecord = rows.filter((r) => r.status === 'not_found').length;
  const worst = matched.reduce((m, r) => Math.max(m, r.riskScore ?? 0), 0);
  const bidStates = [...new Set(matched.map((r) => r.state).filter(Boolean))] as string[];
  const states = bidStates.length ? bidStates : SCOPE_STATES;

  return (
    <section className="hero">
      <div className="eyebrow">General contractor bid · pre-sign safety review</div>
      <div className="bid-name">{name}</div>
      <div className="sub">Reviewing {rows.length} subcontractors before signing.</div>

      <div className="chips">
        <span className="muted" style={{ fontSize: '0.75rem', alignSelf: 'center' }}>Coverage:</span>
        {states.map((s) => <span key={s} className="chip state">{s}</span>)}
        <span className="chip">OSHA construction (NAICS 23)</span>
        <span className="chip">~10 yrs</span>
      </div>

      <div className="stats">
        <div className="stat"><div className="n">{rows.length}</div><div className="l">Subs on bid</div></div>
        <div className="stat"><div className="n" style={{ color: highRisk ? 'var(--high)' : undefined }}>{highRisk}</div><div className="l">High risk</div></div>
        <div className="stat"><div className="n">{worst || '—'}</div><div className="l">Worst score</div></div>
        <div className="stat"><div className="n">{noRecord}</div><div className="l">No OSHA record</div></div>
      </div>
    </section>
  );
}
