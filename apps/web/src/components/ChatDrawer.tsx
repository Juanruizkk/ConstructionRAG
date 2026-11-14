import { useEffect, useState } from 'react';
import { Chat } from './Chat.js';

export function ChatDrawer({ bidId, bidName }: { bidId: number; bidName: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {!open && (
        <button className="fab" onClick={() => setOpen(true)} aria-label="Open foreman assistant">
          <span aria-hidden>💬</span> Ask the foreman
        </button>
      )}

      <div className={`overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <aside className={`drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <span className="t">Foreman assistant</span>
          <button className="x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </div>
        <Chat bidId={bidId} bidName={bidName} />
      </aside>
    </>
  );
}
