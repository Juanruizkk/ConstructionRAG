import { useState } from 'react';
import { addToBid, searchContractor, type SearchHit } from '../lib/api.js';

export function AddSub({ bidId, onAdded }: { bidId: number; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [searched, setSearched] = useState(false);

  async function go() {
    setResults(await searchContractor(name));
    setSearched(true);
  }
  async function add(contractorId: number) {
    await addToBid(bidId, { contractorId });
    onAdded();
  }
  async function addNotFound() {
    if (!name.trim()) return;
    await addToBid(bidId, { enteredName: name.trim() });
    setResults([]);
    setSearched(false);
    setName('');
    onAdded();
  }

  return (
    <section>
      <h2>Add a subcontractor</h2>
      <div className="row">
        <input style={{ flex: 1 }} value={name} placeholder="e.g. ABC Roofing" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} />
        <button onClick={go}>Search</button>
      </div>
      {results.map((r) => (
        <div key={r.contractor_id} className="card row" style={{ justifyContent: 'space-between' }}>
          <span>{r.display_name} <span className="muted">{r.primary_state}</span></span>
          <span className="row">
            <span className="muted" style={{ marginRight: 8 }}>match {(r.confidence * 100).toFixed(0)}%</span>
            <button onClick={() => add(r.contractor_id)}>Add</button>
          </span>
        </div>
      ))}
      {searched && (
        <div className="card row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">Not in OSHA? Add "{name}" as a no-record sub</span>
          <button onClick={addNotFound}>Add as not-found</button>
        </div>
      )}
    </section>
  );
}
