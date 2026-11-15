import { useEffect, useRef, useState } from 'react';
import { Chat } from './Chat.js';

const MIN_W = 360;
const maxW = () => Math.min(window.innerWidth * 0.95, 1000);

export function ChatDrawer({ bidId, bidName }: { bidId: number; bidName: string }) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem('chatWidth'));
    return saved >= MIN_W ? saved : 460;
  });
  const dragging = useRef(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Drag-to-resize from the left edge (drawer is anchored right, so width = viewport − mouseX).
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const w = Math.max(MIN_W, Math.min(maxW(), window.innerWidth - e.clientX));
      widthRef.current = w;
      setWidth(w);
    };
    const stop = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('chatWidth', String(widthRef.current));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', stop);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', stop); };
  }, []);

  const startDrag = () => {
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  return (
    <>
      {!open && (
        <button className="fab" onClick={() => setOpen(true)} aria-label="Open foreman assistant">
          <span aria-hidden>💬</span> Ask the foreman
        </button>
      )}

      <div className={`overlay ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <aside className={`drawer ${open ? 'open' : ''}`} style={{ width }} aria-hidden={!open}>
        <div className="drawer-resize" onMouseDown={startDrag} title="Drag to resize" />
        <div className="drawer-head">
          <span className="t">Foreman assistant</span>
          <button className="x" onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </div>
        <Chat bidId={bidId} bidName={bidName} />
      </aside>
    </>
  );
}
