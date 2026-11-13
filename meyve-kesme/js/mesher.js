// Surface Nets: turns a distance function into a smooth triangle mesh. Vertices
// are pulled onto the exact surface and normals come from the SDF gradient.

function gradient(sdf, x, y, z, e = 0.002) {
  const gx = sdf(x + e, y, z) - sdf(x - e, y, z);
  const gy = sdf(x, y + e, z) - sdf(x, y - e, z);
  const gz = sdf(x, y, z + e) - sdf(x, y, z - e);
  const l = Math.hypot(gx, gy, gz) || 1;
  return [gx / l, gy / l, gz / l];
}

// bounds: {min:[..], max:[..]}; res: cells along the longest side.
export function surfaceNets(sdf, bounds, res = 110) {
  const ext = [0, 1, 2].map((k) => bounds.max[k] - bounds.min[k]);
  const h = Math.max(...ext) / res;
  const dims = ext.map((e) => Math.max(2, Math.ceil(e / h) + 1));
  const [nx, ny, nz] = dims;
  const field = new Float32Array(nx * ny * nz);
  const at = (i, j, k) => (k * ny + j) * nx + i;
  // Narrow band: sample a coarse grid first, then refine only near the surface.
  const C = 4;
  const cdims = dims.map((d) => Math.ceil((d - 1) / C) + 1);
  const coarse = new Float32Array(cdims[0] * cdims[1] * cdims[2]);
  const cat = (i, j, k) => (k * cdims[1] + j) * cdims[0] + i;
  for (let k = 0; k < cdims[2]; k++) {
    for (let j = 0; j < cdims[1]; j++) {
      for (let i = 0; i < cdims[0]; i++) coarse[cat(i, j, k)] = sdf(bounds.min[0] + i * C * h, bounds.min[1] + j * C * h, bounds.min[2] + k * C * h);
    }
  }
  const band = C * h * 1.8;
  for (let k = 0; k < nz; k++) {
    const z = bounds.min[2] + k * h;
    const ck = Math.min(cdims[2] - 1, Math.round(k / C));
    for (let j = 0; j < ny; j++) {
      const y = bounds.min[1] + j * h;
      const cj = Math.min(cdims[1] - 1, Math.round(j / C));
      for (let i = 0; i < nx; i++) {
        const cv = coarse[cat(Math.min(cdims[0] - 1, Math.round(i / C)), cj, ck)];
        field[at(i, j, k)] = Math.abs(cv) > band ? cv : sdf(bounds.min[0] + i * h, y, z);
      }
    }
  }
  const vertIndex = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cell = (i, j, k) => (k * (ny - 1) + j) * (nx - 1) + i;
  const positions = [];
  const corners = new Float32Array(8);
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const CO = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const v = field[at(i + CO[c][0], j + CO[c][1], k + CO[c][2])];
          corners[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (const [a, b] of EDGES) {
          const va = corners[a], vb = corners[b];
          if (va < 0 === vb < 0) continue;
          const t = va / (va - vb);
          sx += CO[a][0] + (CO[b][0] - CO[a][0]) * t;
          sy += CO[a][1] + (CO[b][1] - CO[a][1]) * t;
          sz += CO[a][2] + (CO[b][2] - CO[a][2]) * t;
          cnt++;
        }
        let px = bounds.min[0] + (i + sx / cnt) * h;
        let py = bounds.min[1] + (j + sy / cnt) * h;
        let pz = bounds.min[2] + (k + sz / cnt) * h;
        for (let it = 0; it < 2; it++) {
          const d = sdf(px, py, pz);
          const g = gradient(sdf, px, py, pz);
          const step = Math.max(-h, Math.min(h, d));
          px -= g[0] * step;
          py -= g[1] * step;
          pz -= g[2] * step;
        }
        vertIndex[cell(i, j, k)] = positions.length / 3;
        positions.push(px, py, pz);
      }
    }
  }
  const indices = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) indices.push(a, c, b, a, d, c);
    else indices.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const inside0 = field[at(i, j, k)] < 0;
        if (inside0 === field[at(i + 1, j, k)] < 0) continue;
        quad(vertIndex[cell(i, j - 1, k - 1)], vertIndex[cell(i, j, k - 1)], vertIndex[cell(i, j, k)], vertIndex[cell(i, j - 1, k)], !inside0);
      }
    }
  }
  for (let k = 1; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const inside0 = field[at(i, j, k)] < 0;
        if (inside0 === field[at(i, j + 1, k)] < 0) continue;
        quad(vertIndex[cell(i - 1, j, k - 1)], vertIndex[cell(i - 1, j, k)], vertIndex[cell(i, j, k)], vertIndex[cell(i, j, k - 1)], !inside0);
      }
    }
  }
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 1; j < ny - 1; j++) {
      for (let i = 1; i < nx - 1; i++) {
        const inside0 = field[at(i, j, k)] < 0;
        if (inside0 === field[at(i, j, k + 1)] < 0) continue;
        quad(vertIndex[cell(i - 1, j - 1, k)], vertIndex[cell(i, j - 1, k)], vertIndex[cell(i, j, k)], vertIndex[cell(i - 1, j, k)], !inside0);
      }
    }
  }
  const pos = new Float32Array(positions);
  const nor = new Float32Array(pos.length);
  for (let v = 0; v < pos.length; v += 3) {
    const g = gradient(sdf, pos[v], pos[v + 1], pos[v + 2]);
    nor[v] = g[0];
    nor[v + 1] = g[1];
    nor[v + 2] = g[2];
  }
  const index = pos.length / 3 > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
  return { positions: pos, normals: nor, index };
}
