import { useCallback, useEffect, useState } from 'react';
import { getBid, type BidRow } from './lib/api.js';
import { BidHeader } from './components/BidHeader.js';
import { BidTable } from './components/BidTable.js';
import { AddSub } from './components/AddSub.js';
import { ChatDrawer } from './components/ChatDrawer.js';
import { InfoModal } from './components/InfoModal.js';

const BID_ID = 3;
const BID_NAME = 'Downtown Office Tower — GC bid';

export function App() {
  const [rows, setRows] = useState<BidRow[]>([]);
  const [enriching, setEnriching] = useState<Set<number>>(new Set());

  const load = useCallback(async (): Promise<BidRow[]> => {
    const r = await getBid(BID_ID).catch(() => [] as BidRow[]);
    setRows(r);
    return r;
  }, []);

  useEffect(() => { void load(); }, [load]);

  // After adding a matched sub, poll while its history loads in the background (best-effort; may time out).
  const watchEnrich = useCallback(async (id: number) => {
    const fresh = await load();
    if (fresh.find((r) => r.contractorId === id)?.historyLoaded) return; // already loaded
    setEnriching((s) => new Set(s).add(id));
    let polls = 0;
    const tick = async () => {
      polls += 1;
      const f = await load();
      const done = f.find((r) => r.contractorId === id)?.historyLoaded;
      if (done || polls >= 15) { // ~60s cap
        setEnriching((s) => { const n = new Set(s); n.delete(id); return n; });
        return;
      }
      window.setTimeout(tick, 4000);
    };
    window.setTimeout(tick, 4000);
  }, [load]);

  const handleAdded = useCallback((id?: number) => {
    if (id != null) void watchEnrich(id);
    else void load();
  }, [watchEnrich, load]);

  return (
    <div className="app">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Site Safety Intelligence</h1>
        <InfoModal />
      </div>
      <BidHeader name={BID_NAME} rows={rows} />
      <BidTable rows={rows} enriching={enriching} />
      <AddSub bidId={BID_ID} onAdded={handleAdded} />
      <ChatDrawer bidId={BID_ID} bidName={BID_NAME} />
    </div>
  );
}
