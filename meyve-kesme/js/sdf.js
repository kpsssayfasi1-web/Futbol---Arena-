// Tiny shape language. One description compiles to a JS distance function
// (cube generation, meshing, counts) and to GLSL (shading, cut faces, pieces),
// so both sides always agree on the shape.
//
// Primitives: sphere, ellipsoid, box, cylinder, cone, capsule, torus.
//   common fields: at:[x,y,z], rot:[rx,ry,rz] (radians), part:int,
//   lobes:{n, amp} (radial ripples around the local y axis), axis:'x'|'y'|'z'
// Operations: { op:'union'|'intersect', k, of:[...] }, { op:'subtract', k, from, cut:[...] }

const PRIMS = new Set(['sphere', 'ellipsoid', 'box', 'cylinder', 'cone', 'capsule', 'torus']);

function rotationMatrix(rot) {
  const [rx, ry, rz] = rot || [0, 0, 0];
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  // R = Rz * Ry * Rx (row-major)
  return [
    cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx,
    sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx,
    -sy, cy * sx, cy * cx,
  ];
}

const smin = (a, b, k) => {
  if (!k) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const smax = (a, b, k) => -smin(-a, -b, k);

// ---------- JS ----------
function primJs(n) {
  const at = n.at || [0, 0, 0];
  const R = n.rot ? rotationMatrix(n.rot) : null;
  const axis = n.axis || 'y';
  const lobes = n.lobes;
  const local = (x, y, z, out) => {
    let px = x - at[0], py = y - at[1], pz = z - at[2];
    if (R) {
      // inverse rotation = transpose
      const qx = R[0] * px + R[3] * py + R[6] * pz;
      const qy = R[1] * px + R[4] * py + R[7] * pz;
      const qz = R[2] * px + R[5] * py + R[8] * pz;
      px = qx; py = qy; pz = qz;
    }
    if (axis === 'x') [px, py] = [py, px];
    else if (axis === 'z') [py, pz] = [pz, py];
    let f = 1;
    if (lobes) {
      f = 1 + lobes.amp * Math.cos(lobes.n * Math.atan2(pz, px));
      px /= f;
      pz /= f;
    }
    out[0] = px; out[1] = py; out[2] = pz; out[3] = f;
  };
  const q = [0, 0, 0, 1];
  const shape = PRIM_JS[n.type](n);
  return (x, y, z) => {
    local(x, y, z, q);
    return shape(q[0], q[1], q[2]) * Math.min(1, q[3]);
  };
}

const PRIM_JS = {
  sphere: (n) => (x, y, z) => Math.hypot(x, y, z) - n.r,
  ellipsoid: (n) => {
    const [a, b, c] = n.r;
    return (x, y, z) => {
      const k0 = Math.hypot(x / a, y / b, z / c);
      const k1 = Math.max(1e-6, Math.hypot(x / (a * a), y / (b * b), z / (c * c)));
      return (k0 * (k0 - 1)) / k1;
    };
  },
  box: (n) => {
    const [bx, by, bz] = n.size;
    const r = n.round || 0;
    return (x, y, z) => {
      const qx = Math.abs(x) - bx + r, qy = Math.abs(y) - by + r, qz = Math.abs(z) - bz + r;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
    };
  },
  cylinder: (n) => {
    const r = n.round || 0;
    return (x, y, z) => {
      const dx = Math.hypot(x, z) - n.r + r;
      const dy = Math.abs(y) - n.h + r;
      return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - r;
    };
  },
  cone: (n) => {
    const { r1, r2, h } = n;
    const r = n.round || 0;
    return (x, y, z) => {
      const qx = Math.hypot(x, z), qy = y;
      const k2x = r2 - r1, k2y = 2 * h;
      const cax = qx - Math.min(qx, qy < 0 ? r1 : r2), cay = Math.abs(qy) - h;
      const t = Math.min(1, Math.max(0, ((r2 - qx) * k2x + (h - qy) * k2y) / (k2x * k2x + k2y * k2y)));
      const cbx = qx - r2 + k2x * t, cby = qy - h + k2y * t;
      const s = cbx < 0 && cay < 0 ? -1 : 1;
      return s * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby)) - r;
    };
  },
  capsule: (n) => {
    const [ax, ay, az] = n.a;
    const [bx, by, bz] = n.b;
    const [r1, r2] = Array.isArray(n.r) ? n.r : [n.r, n.r];
    const bax = bx - ax, bay = by - ay, baz = bz - az;
    const bb = bax * bax + bay * bay + baz * baz;
    return (x, y, z) => {
      const pax = x - ax, pay = y - ay, paz = z - az;
      const h = Math.min(1, Math.max(0, (pax * bax + pay * bay + paz * baz) / bb));
      return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (r1 + (r2 - r1) * h);
    };
  },
  torus: (n) => (x, y, z) => Math.hypot(Math.hypot(x, z) - n.R, y) - n.r,
};

// Returns { sdf(x,y,z), part(x,y,z) }.
export function compileJs(node) {
  const ev = buildJs(node);
  const state = { part: 0 };
  return {
    sdf: (x, y, z) => ev(x, y, z, state),
    part: (x, y, z) => {
      ev(x, y, z, state);
      return state.part;
    },
  };
}

function buildJs(n) {
  if (PRIMS.has(n.type)) {
    const f = n.type === 'capsule' ? PRIM_JS.capsule(n) : primJs(n);
    const part = n.part || 0;
    return (x, y, z, st) => {
      st.part = part;
      return f(x, y, z);
    };
  }
  if (n.op === 'union' || n.op === 'intersect') {
    const kids = n.of.map(buildJs);
    const union = n.op === 'union';
    return (x, y, z, st) => {
      let d = kids[0](x, y, z, st);
      let part = st.part;
      for (let i = 1; i < kids.length; i++) {
        const e = kids[i](x, y, z, st);
        if (union ? e < d : e > d) part = st.part;
        d = union ? smin(d, e, n.k) : smax(d, e, n.k);
      }
      st.part = part;
      return d;
    };
  }
  if (n.op === 'subtract') {
    const from = buildJs(n.from);
    const cut = buildJs({ op: 'union', of: n.cut });
    return (x, y, z, st) => {
      const d = from(x, y, z, st);
      const part = st.part;
      const c = cut(x, y, z, st);
      st.part = part;
      return smax(d, -c, n.k);
    };
  }
  throw new Error(`unknown shape node: ${JSON.stringify(n).slice(0, 80)}`);
}

// ---------- GLSL ----------
const f = (v) => {
  const s = Number(v).toFixed(5);
  return s.includes('.') ? s : `${s}.0`;
};
const v3 = (a) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;

export const SDF_GLSL_LIB = /* glsl */ `
float sdSmin(float a, float b, float k) { float h = max(k - abs(a - b), 0.0) / k; return min(a, b) - h * h * k * 0.25; }
float sdSmax(float a, float b, float k) { return -sdSmin(-a, -b, k); }
float sdEllipsoid(vec3 p, vec3 r) { float k0 = length(p / r); float k1 = max(1e-6, length(p / (r * r))); return k0 * (k0 - 1.0) / k1; }
float sdBox(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdCyl(vec3 p, float rad, float h, float r) { vec2 d = vec2(length(p.xz) - rad + r, abs(p.y) - h + r); return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - r; }
float sdCone(vec3 p, float r1, float r2, float h, float r) {
  vec2 q = vec2(length(p.xz), p.y);
  vec2 k1 = vec2(r2, h);
  vec2 k2 = vec2(r2 - r1, 2.0 * h);
  vec2 ca = vec2(q.x - min(q.x, (q.y < 0.0) ? r1 : r2), abs(q.y) - h);
  vec2 cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb))) - r;
}
float sdCapsule(vec3 p, vec3 a, vec3 b, float r1, float r2) { vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - mix(r1, r2, h); }
float sdTorus(vec3 p, float R, float r) { return length(vec2(length(p.xz) - R, p.y)) - r; }
`;

// Emits statements computing distance into `dv` and part into `pv`.
function emit(n, ctx) {
  const id = ctx.next++;
  const dv = `d${id}`;
  const pv = `m${id}`;
  if (PRIMS.has(n.type)) {
    const lines = [];
    let q = 'p';
    if (n.type !== 'capsule') {
      lines.push(`vec3 q${id} = p - ${v3(n.at || [0, 0, 0])};`);
      q = `q${id}`;
      if (n.rot) {
        const R = rotationMatrix(n.rot);
        // GLSL mat3 is column-major; transpose(R) * v == R^T v
        lines.push(`${q} = mat3(${R.map(f).join(', ')}) * ${q};`);
      }
      if (n.axis === 'x') lines.push(`${q} = ${q}.yxz;`);
      else if (n.axis === 'z') lines.push(`${q} = ${q}.xzy;`);
      if (n.lobes) {
        lines.push(`float lf${id} = 1.0 + ${f(n.lobes.amp)} * cos(${f(n.lobes.n)} * atan(${q}.z, ${q}.x));`);
        lines.push(`${q}.xz /= lf${id};`);
      }
    }
    let expr;
    switch (n.type) {
      case 'sphere': expr = `length(${q}) - ${f(n.r)}`; break;
      case 'ellipsoid': expr = `sdEllipsoid(${q}, ${v3(n.r)})`; break;
      case 'box': expr = `sdBox(${q}, ${v3(n.size)}, ${f(n.round || 0)})`; break;
      case 'cylinder': expr = `sdCyl(${q}, ${f(n.r)}, ${f(n.h)}, ${f(n.round || 0)})`; break;
      case 'cone': expr = `sdCone(${q}, ${f(n.r1)}, ${f(n.r2)}, ${f(n.h)}, ${f(n.round || 0)})`; break;
      case 'torus': expr = `sdTorus(${q}, ${f(n.R)}, ${f(n.r)})`; break;
      default: {
        const [r1, r2] = Array.isArray(n.r) ? n.r : [n.r, n.r];
        expr = `sdCapsule(p, ${v3(n.a)}, ${v3(n.b)}, ${f(r1)}, ${f(r2)})`;
      }
    }
    lines.push(`float ${dv} = (${expr})${n.lobes ? ` * min(1.0, lf${id})` : ''};`);
    lines.push(`float ${pv} = ${f(n.part || 0)};`);
    ctx.code.push(...lines);
    return { dv, pv };
  }
  if (n.op === 'union' || n.op === 'intersect') {
    const kids = n.of.map((c) => emit(c, ctx));
    ctx.code.push(`float ${dv} = ${kids[0].dv}; float ${pv} = ${kids[0].pv};`);
    const union = n.op === 'union';
    for (let i = 1; i < kids.length; i++) {
      const k = kids[i];
      ctx.code.push(`if (${k.dv} ${union ? '<' : '>'} ${dv}) ${pv} = ${k.pv};`);
      const fn = union ? (n.k ? `sdSmin(${dv}, ${k.dv}, ${f(n.k)})` : `min(${dv}, ${k.dv})`) : n.k ? `sdSmax(${dv}, ${k.dv}, ${f(n.k)})` : `max(${dv}, ${k.dv})`;
      ctx.code.push(`${dv} = ${fn};`);
    }
    return { dv, pv };
  }
  if (n.op === 'subtract') {
    const from = emit(n.from, ctx);
    const cut = emit({ op: 'union', of: n.cut }, ctx);
    const fn = n.k ? `sdSmax(${from.dv}, -${cut.dv}, ${f(n.k)})` : `max(${from.dv}, -${cut.dv})`;
    ctx.code.push(`float ${dv} = ${fn}; float ${pv} = ${from.pv};`);
    return { dv, pv };
  }
  throw new Error('unknown shape node');
}

// GLSL function `float <name>(vec3 p, out float part)`.
export function compileGlsl(node, name = 'objMap') {
  const ctx = { next: 0, code: [] };
  const res = emit(node, ctx);
  return `float ${name}(vec3 p, out float part) {\n  ${ctx.code.join('\n  ')}\n  part = ${res.pv};\n  return ${res.dv};\n}\n`;
}
