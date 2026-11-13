// Deterministic random number helpers. Every random decision in the
// tournament comes from a stream derived from (seed, label), so the same
// seed always reproduces the same tournament, and changing one match
// never shifts the randomness of another.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MULBERRY_INCREMENT = 0x6d2b79f5;
const UINT32_RANGE = 4294967296;

export function hashSeed(input) {
  let hash = FNV_OFFSET;
  for (const char of String(input)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

// mulberry32: small, fast, good enough for simulation purposes.
export function createRng(seed) {
  let state = (typeof seed === 'number' ? seed : hashSeed(seed)) >>> 0;
  return {
    next() {
      state = (state + MULBERRY_INCREMENT) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / UINT32_RANGE;
    },
  };
}

export function deriveRng(seed, label) {
  return createRng(hashSeed(`${seed}|${label}`));
}

// Knuth's algorithm; fine for the small lambdas used in football scores.
export function samplePoisson(rng, lambda) {
  if (!(lambda >= 0)) throw new RangeError(`Poisson lambda must be >= 0, got ${lambda}`);
  const limit = Math.exp(-lambda);
  let count = 0;
  let product = rng.next();
  while (product > limit) {
    count += 1;
    product *= rng.next();
  }
  return count;
}

export function shuffle(rng, items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
