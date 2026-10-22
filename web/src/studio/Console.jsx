import { useEffect, useRef, useState } from 'react';
import ChunkTiles from './ChunkTiles.jsx';
import { api } from '../api.js';
import { count, bytes } from '../format.js';

const TRY = ['load A cat:Clothing', 'load B color:Red', 'and A B', 'add A 0..70000', 'show A', 'optimize A', 'contains A 65536', 'random B 5000', 'help'];
const WELCOME = [
  { kind: 'dim', text: 'RoarMart bitmap console. Three scratch bitmaps: A, B and R (the last result).' },
  { kind: 'dim', text: 'Type help for the commands, or click one of the examples above.' },
];

// A small terminal for the engine. Every command runs on the server against real
// RoaringBitmap objects and reports how long it took.
export default function Console() {
  const [lines, setLines] = useState(WELCOME);
  const [state, setState] = useState(null);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [pos, setPos] = useState(-1);
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => { api.get('/api/lab/console').then((d) => setState(d.state)).catch(() => {}); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [lines]);

  const send = async (line) => {
    const text = line.trim();
    if (!text || busy) return;
    setBusy(true);
    setHistory((h) => [text, ...h.filter((x) => x !== text)].slice(0, 50));
    setPos(-1); setInput('');
    setLines((l) => [...l, { kind: 'cmd', text }]);
    try {
      const d = await api.post('/api/lab/console', { line: text });
      setLines((l) => [...l, ...d.lines].slice(-400));
      setState(d.state);
    } catch (e) {
      setLines((l) => [...l, { kind: 'err', text: e.message }]);
    }
    setBusy(false);
    inputRef.current?.focus();
  };

  const onKey = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); send(input); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const p = Math.min(pos + 1, history.length - 1); if (p >= 0) { setPos(p); setInput(history[p]); } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const p = pos - 1; setPos(p); setInput(p >= 0 ? history[p] : ''); }
    else if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); setLines([]); }
  };

  return (
    <>
      <div>
        <h1 className="s-h1">Bitmap console</h1>
        <p className="s-sub">Build bitmaps by hand, combine them and watch their containers change. Nothing here touches the shop.</p>
      </div>

      <div className="try-row">
        <span className="note-s">Try:</span>
        {TRY.map((t) => <button key={t} type="button" className="qchip try" onClick={() => send(t)} disabled={busy}>{t}</button>)}
      </div>

      <div className="console-grid">
        <div className="term" onClick={() => inputRef.current?.focus()}>
          <div className="term-log" ref={logRef}>
            {lines.map((l, i) => (
              <div key={i} className={'tl ' + l.kind}>{l.kind === 'cmd' ? <><span className="prompt">roar&gt;</span> {l.text}</> : l.text}</div>
            ))}
          </div>
          <label className="term-input">
            <span className="prompt">roar&gt;</span>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey}
              placeholder="type a command, e.g. add A 1..5000" spellCheck="false" autoComplete="off" autoFocus aria-label="Console command" />
          </label>
        </div>

        <div className="scratch">
          {['A', 'B', 'R'].map((n) => {
            const s = state && state[n];
            return (
              <div key={n} className="panel scratch-card">
                <div className="scratch-head">
                  <b className="mono">{n}</b>
                  <span className="note-s">{n === 'R' ? 'last result' : 'scratch bitmap'}</span>
                  <span className="num" style={{ marginLeft: 'auto' }}>{s ? `${count(s.cardinality)} IDs · ${bytes(s.bytes)}` : '…'}</span>
                </div>
                {s && <ChunkTiles chunks={s.chunks} />}
                {s && s.chunkCount > s.chunks.length && <span className="note-s">+ {count(s.chunkCount - s.chunks.length)} more chunks</span>}
              </div>
            );
          })}
          <div className="legend">
            <span><i style={{ background: 'var(--c-array)' }} />array</span>
            <span><i style={{ background: 'var(--c-bitmap)' }} />bitmap</span>
            <span><i style={{ background: 'var(--c-run)' }} />run</span>
          </div>
        </div>
      </div>
    </>
  );
}
