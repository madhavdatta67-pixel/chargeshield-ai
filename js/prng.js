// Deterministic seeded PRNG (mulberry32) so demo data & ML results are
// reproducible across page loads — important for an app that claims to
// show "real" measured metrics rather than randomly-changing ones.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RNG = {
  _rand: mulberry32(20260209),
  reset(seed) {
    this._rand = mulberry32(seed || 20260209);
  },
  next() {
    return this._rand();
  },
  int(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  },
  float(min, max) {
    return this.next() * (max - min) + min;
  },
  bool(pTrue) {
    return this.next() < pTrue;
  },
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  },
  // Box-Muller gaussian
  gaussian(mean = 0, std = 1) {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    return mean + z * std;
  },
};
