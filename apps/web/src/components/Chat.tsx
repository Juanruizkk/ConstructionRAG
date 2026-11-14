import { useState } from 'react';
import { chat, type Citation } from '../lib/api.js';

interface Msg { role: 'user' | 'assistant'; text: string; citations?: Citation[] }

export function Chat({ bidId, bidName }: { bidId: number; bidName: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { role: 'user', text: q }]);
    setInput('');
    setBusy(true);
    try {
      const res = await chat(bidId, bidName, q);
      setMsgs((m) => [...m, { role: 'assistant', text: res.answer, citations: res.citations }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: 'Error contacting the assistant.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Ask the foreman assistant</h2>
      <div>
        {msgs.map((m, i) => (
          <div key={i} className={`msg-${m.role}`} style={{ margin: '6px 0' }}>
            <div className="bubble">{m.text}</div>
            {m.citations && m.citations.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 12 }}>
                {m.citations.map((c, j) => (
                  <a key={j} href={c.url} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>
                    {c.type === 'incident' ? `incident ${c.summary_nr}` : `inspection ${c.activity_nr}`}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="row">
        <input
          style={{ flex: 1 }}
          value={input}
          placeholder="Which of my subs has had a fatality?"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button onClick={send} disabled={busy}>{busy ? '…' : 'Send'}</button>
      </div>
    </section>
  );
}
