// Shared constants for the Roaring Bitmap engine.

// Every 32-bit ID is split into a 16-bit "key" (which chunk) and a 16-bit "low" part.
// One chunk therefore covers 2^16 = 65,536 IDs.
export const CHUNK_SIZE = 65536;

// An array container stores 16-bit values at 2 bytes each.
// A bitmap container always uses 65,536 bits = 8,192 bytes.
// They cost the same at 8,192 / 2 = 4,096 values, so that is the switch point:
//   cardinality <= 4096  -> array container is smaller
//   cardinality  > 4096  -> bitmap container is smaller
export const ARRAY_MAX = 4096;

// A bitmap container is 65,536 bits stored in 32-bit words: 65,536 / 32 = 2,048 words.
// (JavaScript bitwise operators work on 32-bit integers, so 32-bit words are the natural unit.)
export const BITMAP_WORDS = 2048;

// Bytes used by each container type (same formulas as the Roaring format spec):
//   array:  2 bytes per value + 2-byte cardinality header
//   bitmap: always 8,192 bytes
//   run:    4 bytes per run (start + length) + 2-byte run-count header
export const BITMAP_BYTES = 8192;

// Counts the 1-bits in a 32-bit word in constant time (classic SWAR popcount).
// Time: O(1)
export function popcount32(x) {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return Math.imul(x, 0x01010101) >>> 24;
}
