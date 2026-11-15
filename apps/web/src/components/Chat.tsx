import { useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chat, type Citation } from '../lib/api.js';

interface Msg { role: 'user' | 'assistant'; text: string; citations?: Citation[] }

const SUGGESTIONS = [
  'Which of my subs has the worst safety record?',
  'Which of my subs have had a worker fatality?',
  'What happened in the accidents involving Olean Town Highway Department?',
];

export function Chat({ bidId, bidName }: { bidId: number; bidName: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));
    try {
      const res = await chat(bidId, bidName, q);
      setMsgs((m) => [...m, { role: 'assistant', text: res.answer, citations: res.citations }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: 'Error contacting the assistant.' }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight));
    }
  }

  return (
    <>
      <div className="chat-scroll" ref={scrollRef}>
        {msgs.length === 0 && (
          <p className="empty">Ask about the subcontractors on this bid — risk, violations, or what happened in past incidents.</p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            <div className="bubble">
              {m.role === 'assistant'
                ? (
                  <div className="md">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{ a: (props) => <a {...props} target="_blank" rel="noreferrer" /> }}
                    >
                      {m.text}
                    </ReactMarkdown>
                  </div>
                )
                : m.text}
            </div>
            {m.citations && m.citations.length > 0 && (
              <div className="cites">
                {m.citations.map((c, j) => (
                  <a key={j} href={c.url} target="_blank" rel="noreferrer">
                    {c.type === 'incident' ? `incident ${c.summary_nr}` : `inspection ${c.activity_nr}`}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && <div className="msg msg-assistant"><div className="bubble muted">thinking…</div></div>}
      </div>

      <div className="chat-foot">
        {msgs.length === 0 && (
          <div className="suggest">
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => ask(s)}>{s}</button>)}
          </div>
        )}
        <div className="row">
          <input
            style={{ flex: 1 }}
            value={input}
            placeholder="Ask a question…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ask(input)}
          />
          <button className="primary" onClick={() => ask(input)} disabled={busy}>{busy ? '…' : 'Send'}</button>
        </div>
      </div>
    </>
  );
}
