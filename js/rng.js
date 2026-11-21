// Random numbers for Eyton's Cribbage.   Code: (c) Corey J Ruff
//
// SeededRng  - small, fast xorshift32 generator.  The same algorithm exists in the
//              Python test harness, so a given seed deals the same cards and makes the
//              same computer choices in both versions (used to prove they match).
// CryptoRng  - the browser's cryptographic generator, used for real shuffles.
//
// Both offer: random() in [0,1), randrange(n), choice(arr), shuffle(arr), sample(arr, k).

class BaseRng {
  randrange(n) { return Math.floor(this.random() * n); }
  choice(arr) { return arr[this.randrange(arr.length)]; }
  shuffle(arr) {                       // Fisher-Yates, in place
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.randrange(i + 1);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }
  sample(arr, k) {                     // k distinct items, partial Fisher-Yates
    const pool = arr.slice();
    for (let i = 0; i < k; i++) {
      const j = i + this.randrange(pool.length - i);
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, k);
  }
}

export class SeededRng extends BaseRng {
  constructor(seed = 1) {
    super();
    this.x = (seed >>> 0) || 0x9E3779B9;
  }
  random() {
    let x = this.x;
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    this.x = x;
    return x / 4294967296;
  }
}

export class CryptoRng extends BaseRng {
  constructor() {
    super();
    this.buf = new Uint32Array(64);
    this.i = 64;
  }
  random() {
    if (this.i >= 64) { globalThis.crypto.getRandomValues(this.buf); this.i = 0; }
    return this.buf[this.i++] / 4294967296;
  }
}
