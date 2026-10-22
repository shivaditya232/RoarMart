import { RoaringBitmap } from '../engine/index.js';

// The bitmap console: three scratch bitmaps (A, B and R, the last result) that the
// evaluator can change with typed commands. Every command reports its time, so the
// cost of each operation can be seen live. "load" copies a real catalogue bitmap in.

const MAX_ID = 4294967295;
const MAX_RANGE = 2_000_000;
const MAX_RANDOM = 1_000_000;
const NAMES = ['A', 'B', 'R'];

export const HELP = [
  'add A 42            add one ID (also: add A 1,5,9)',
  'add A 1000..9000    add a range of consecutive IDs',
  'remove A 42         remove an ID',
  'contains A 42       is 42 in A?',
  'random A 5000       add 5,000 random IDs below 200,000 (or: random A 5000 70000)',
  'load A brand:Nike   copy a real catalogue bitmap (any filter, e.g. color:Red, cat:Clothing)',
  'and A B             R = A AND B  (also: or A B, andnot A B)',
  'show A              list A\'s chunks and their containers',
  'optimize A          re-encode A in its smallest form (runs)',
  'copy R A            copy one bitmap into another',
  'clear A             empty A (clear all: everything)',
];

const fmtN = (n) => Number(n).toLocaleString('en-IN');
function fmtTime(ms) {
  if (ms < 0.001) return `${(ms * 1e6).toFixed(0)} ns`;
  if (ms < 1) return `${(ms * 1000).toFixed(1)} µs`;
  return `${ms.toFixed(2)} ms`;
}

function parseId(s) {
  if (!/^\d+$/.test(s || '')) throw new Error(`"${s ?? ''}" is not an ID (use a whole number from 0 to ${fmtN(MAX_ID)})`);
  const n = Number(s);
  if (n > MAX_ID) throw new Error(`IDs are 32-bit: the largest is ${fmtN(MAX_ID)}`);
  return n;
}

export class ScratchConsole {
  constructor(index) {
    this.index = index;
    this.bitmaps = { A: new RoaringBitmap(), B: new RoaringBitmap(), R: new RoaringBitmap() };
  }

  name(s) {
    const n = (s || '').toUpperCase();
    if (!NAMES.includes(n)) throw new Error(`"${s ?? ''}" is not a bitmap: use A, B or R`);
    return n;
  }

  describe(n) {
    const rb = this.bitmaps[n];
    const counts = { array: 0, bitmap: 0, run: 0 };
    for (const c of rb.containers) counts[c.type]++;
    const parts = Object.entries(counts).filter(([, v]) => v).map(([k, v]) => `${v} ${k}`);
    return `${n}: ${fmtN(rb.cardinality)} IDs in ${rb.keys.length} chunk${rb.keys.length === 1 ? '' : 's'}${parts.length ? ' (' + parts.join(', ') + ')' : ''}, ${fmtN(rb.sizeInBytes())} bytes`;
  }

  state() {
    const out = {};
    for (const n of NAMES) {
      const s = this.bitmaps[n].stats();
      out[n] = { cardinality: s.cardinality, bytes: s.bytes, chunkCount: s.chunks.length, chunks: s.chunks.slice(0, 48) };
    }
    return out;
  }

  // Runs one command line. Returns { lines: [{ kind, text }] }, kind = 'out' | 'ok' | 'err' | 'dim'.
  run(line) {
    const words = String(line || '').trim().split(/\s+/).filter(Boolean);
    const lines = [];
    const out = (text, kind = 'out') => lines.push({ kind, text });
    if (words.length === 0) return { lines };
    const cmd = words[0].toLowerCase();
    const timed = (fn) => { const t = performance.now(); const r = fn(); return [r, performance.now() - t]; };

    try {
      switch (cmd) {
        case 'help': HELP.forEach((h) => out(h, 'dim')); break;

        case 'add': case 'remove': {
          const n = this.name(words[1]);
          const arg = words[2];
          if (!arg) throw new Error(`usage: ${cmd} A 42`);
          const rb = this.bitmaps[n];
          const range = arg.match(/^(\d+)\.\.(\d+)$/);
          if (range) {
            const lo = parseId(range[1]), hi = parseId(range[2]);
            if (hi < lo) throw new Error('the range must go from small to large');
            if (hi - lo + 1 > MAX_RANGE) throw new Error(`ranges are limited to ${fmtN(MAX_RANGE)} IDs in the console`);
            if (cmd === 'add') {
              const [, ms] = timed(() => rb.addRange(lo, hi));
              out(`added ${fmtN(hi - lo + 1)} consecutive IDs in ${fmtTime(ms)}  (empty chunks become run containers)`, 'ok');
            } else {
              const [, ms] = timed(() => { for (let x = lo; x <= hi; x++) rb.remove(x); });
              out(`removed ${fmtN(hi - lo + 1)} IDs in ${fmtTime(ms)}`, 'ok');
            }
          } else {
            const ids = arg.split(',').map(parseId);
            const [, ms] = timed(() => { for (const x of ids) (cmd === 'add' ? rb.add(x) : rb.remove(x)); });
            const where = ids.length === 1 ? `  → chunk ${ids[0] >>> 16}, position ${ids[0] & 0xffff}` : '';
            out(`${cmd === 'add' ? 'added' : 'removed'} ${fmtN(ids.length)} ID${ids.length === 1 ? '' : 's'} in ${fmtTime(ms)}${where}`, 'ok');
          }
          out(this.describe(n), 'dim');
          break;
        }

        case 'contains': {
          const n = this.name(words[1]);
          const x = parseId(words[2]);
          // One lookup is too quick to time on its own, so it is repeated 100,000 times.
          const rb = this.bitmaps[n];
          let has = false;
          const [, total] = timed(() => { for (let k = 0; k < 100_000; k++) has = rb.contains(x); });
          const ms = total / 100_000;
          const i = this.bitmaps[n].findKey(x >>> 16);
          const type = i >= 0 ? this.bitmaps[n].containers[i].type : null;
          out(`${has ? 'yes' : 'no'}: ${fmtN(x)} is ${has ? '' : 'not '}in ${n}  (${fmtTime(ms)} per lookup)`, has ? 'ok' : 'out');
          out(type ? `chunk ${x >>> 16} found by binary search over the keys, then looked up in its ${type} container` : `chunk ${x >>> 16} does not exist in ${n}, so the answer comes from the key search alone`, 'dim');
          break;
        }

        case 'random': {
          const n = this.name(words[1]);
          const k = words[2] ? parseId(words[2]) : 1000;
          const below = words[3] ? parseId(words[3]) : 200_000;
          if (k > MAX_RANDOM) throw new Error(`at most ${fmtN(MAX_RANDOM)} random IDs at a time`);
          if (below < 1) throw new Error('the upper limit must be at least 1');
          const rb = this.bitmaps[n];
          const [, ms] = timed(() => { for (let i = 0; i < k; i++) rb.add(Math.floor(Math.random() * below)); });
          out(`added ${fmtN(k)} random IDs below ${fmtN(below)} in ${fmtTime(ms)}`, 'ok');
          out(this.describe(n), 'dim');
          break;
        }

        case 'load': {
          const n = this.name(words[1]);
          const term = words.slice(2).join(' ');
          if (!term) throw new Error('usage: load A brand:Nike');
          if (!this.index.terms.has(term)) throw new Error(`no catalogue bitmap called "${term}" (try color:Red, for:Women, cat:Clothing)`);
          this.bitmaps[n] = this.index.bitmap(term).clone();
          out(`loaded ${term} into ${n}`, 'ok');
          out(this.describe(n), 'dim');
          break;
        }

        case 'and': case 'or': case 'andnot': {
          const a = this.name(words[1]), b = this.name(words[2]);
          const A = this.bitmaps[a], B = this.bitmaps[b];
          const trace = [];
          const [res, ms] = timed(() => (cmd === 'and' ? A.and(B, trace) : cmd === 'or' ? A.or(B) : A.andNot(B)));
          this.bitmaps.R = res;
          const sym = { and: '∩', or: '∪', andnot: '−' }[cmd];
          out(`R = ${a} ${sym} ${b}: ${fmtN(res.cardinality)} IDs in ${fmtTime(ms)}`, 'ok');
          if (cmd === 'and') {
            const shared = trace.length;
            out(`${A.keys.length} + ${B.keys.length} chunks walked with two pointers; ${shared} chunk${shared === 1 ? '' : 's'} in both got intersected`, 'dim');
            const methods = {};
            for (const t of trace) methods[t.method] = (methods[t.method] || 0) + 1;
            for (const [m, c] of Object.entries(methods)) out(`  ${c} × ${m}`, 'dim');
          }
          out(this.describe('R'), 'dim');
          break;
        }

        case 'show': {
          const n = this.name(words[1]);
          const rb = this.bitmaps[n];
          out(this.describe(n));
          if (rb.keys.length === 0) out('(empty)', 'dim');
          rb.stats().chunks.slice(0, 20).forEach((c) => {
            out(`  chunk ${String(c.key).padStart(5)}  ${c.type.padEnd(6)}  ${fmtN(c.cardinality).padStart(7)} IDs  ${fmtN(c.bytes).padStart(6)} B`, 'dim');
          });
          if (rb.keys.length > 20) out(`  … and ${rb.keys.length - 20} more chunks`, 'dim');
          break;
        }

        case 'optimize': {
          const n = this.name(words[1]);
          const before = this.bitmaps[n].sizeInBytes();
          const [runs, ms] = timed(() => this.bitmaps[n].runOptimize());
          out(`optimized ${n} in ${fmtTime(ms)}: ${fmtN(before)} → ${fmtN(this.bitmaps[n].sizeInBytes())} bytes, ${runs} run container${runs === 1 ? '' : 's'}`, 'ok');
          break;
        }

        case 'copy': {
          const from = this.name(words[1]), to = this.name(words[2]);
          this.bitmaps[to] = this.bitmaps[from].clone();
          out(`copied ${from} into ${to}`, 'ok');
          out(this.describe(to), 'dim');
          break;
        }

        case 'count': {
          const n = this.name(words[1]);
          out(this.describe(n));
          break;
        }

        case 'clear': {
          if ((words[1] || '').toLowerCase() === 'all') { for (const n of NAMES) this.bitmaps[n] = new RoaringBitmap(); out('cleared A, B and R', 'ok'); }
          else { const n = this.name(words[1]); this.bitmaps[n] = new RoaringBitmap(); out(`cleared ${n}`, 'ok'); }
          break;
        }

        default:
          throw new Error(`unknown command "${words[0]}". Type help to see the commands.`);
      }
    } catch (e) {
      out(e.message, 'err');
    }
    return { lines };
  }
}
