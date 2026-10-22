import { COLOR } from './labels.js';
import { count } from '../format.js';

// One tile per chunk (65,536 IDs). Colour = container type, fill = how full the chunk is.
export default function ChunkTiles({ chunks, flash }) {
  if (!chunks || chunks.length === 0) return <span className="note-s">empty</span>;
  return (
    <div className="tiles">
      {chunks.map((c) => (
        <div key={c.key} className={'tile-c' + (flash ? ' flash' : '')} title={`chunk ${c.key}: ${c.type}, ${count(c.cardinality)} values, ${count(c.bytes)} bytes`}>
          <div className="fill" style={{ width: Math.max(3, (c.cardinality / 65536) * 100) + '%', background: COLOR[c.type] }} />
          <div className="lab">{c.type} · {count(c.cardinality)}</div>
        </div>
      ))}
    </div>
  );
}
