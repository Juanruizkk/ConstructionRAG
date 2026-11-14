import { useCallback, useEffect, useState } from 'react';
import { getBid, type BidRow } from './lib/api.js';
import { BidTable } from './components/BidTable.js';
import { AddSub } from './components/AddSub.js';
import { Chat } from './components/Chat.js';

const BID_ID = 3;
const BID_NAME = 'Downtown Office Tower — GC bid';

export function App() {
  const [rows, setRows] = useState<BidRow[]>([]);
  const refresh = useCallback(() => { getBid(BID_ID).then(setRows).catch(() => setRows([])); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <div className="app">
      <h1>Site Safety Intelligence</h1>
      <p className="muted">{BID_NAME}</p>
      <BidTable rows={rows} />
      <AddSub bidId={BID_ID} onAdded={refresh} />
      <Chat bidId={BID_ID} bidName={BID_NAME} />
    </div>
  );
}
