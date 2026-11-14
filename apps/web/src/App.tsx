import { useCallback, useEffect, useState } from 'react';
import { getBid, type BidRow } from './lib/api.js';
import { BidHeader } from './components/BidHeader.js';
import { BidTable } from './components/BidTable.js';
import { AddSub } from './components/AddSub.js';
import { ChatDrawer } from './components/ChatDrawer.js';

const BID_ID = 3;
const BID_NAME = 'Downtown Office Tower — GC bid';

export function App() {
  const [rows, setRows] = useState<BidRow[]>([]);
  const refresh = useCallback(() => { getBid(BID_ID).then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="app">
      <h1>Site Safety Intelligence</h1>
      <BidHeader name={BID_NAME} rows={rows} />
      <BidTable rows={rows} />
      <AddSub bidId={BID_ID} onAdded={refresh} />
      <ChatDrawer bidId={BID_ID} bidName={BID_NAME} />
    </div>
  );
}
