// Territory system retired (t135u). Kept as a no-op API so build / helpers / rivals /
// tiers / admin call sites keep working without claiming, painting, overlay, or score.
export async function createTerritory(/* scene, opts */) {
  const sources = [];
  const T = {
    sources,
    pct: 0,
    cells: 0,
    total: 1,
    dirty: false,
    growMul: 0,
    rev: 0,
    debug: false,
    all: false,
    rivalPct: 0,
    overlay: null,
    mat: null,
  };
  T.valueAt = () => 0;
  T.depth = () => 999; // everywhere "inside" so helpers don't path-penalty
  T.inside = () => false; // rivals don't avoid a player claim edge
  T.ownerAt = () => 0;
  T.edgeDist = () => 999;
  T.setSource = (id, kind, x, z, r, rMax, rate = 0, owner = 0) => {
    let s = sources.find(q => q.id === id);
    if (!s) { s = { id, kind, x, z, r: r || 0, rMax: rMax ?? r ?? 0, rate, owner: owner | 0 }; sources.push(s); }
    else Object.assign(s, { kind, x, z, r: r || 0, rMax: rMax ?? r ?? 0, rate, owner: owner | 0 });
    return s;
  };
  T.get = id => sources.find(q => q.id === id);
  T.remove = id => { const i = sources.findIndex(q => q.id === id); if (i >= 0) sources.splice(i, 1); };
  T.removeKind = kind => { for (let i = sources.length - 1; i >= 0; i--) if (sources[i].kind === kind) sources.splice(i, 1); };
  T.claimAll = on => { T.all = !!on; };
  T.grow = () => {};
  T.setRMax = () => {};
  T.setR = (id, r) => { const s = T.get(id); if (s) { s.r = r; if (s.rMax < r) s.rMax = r; } };
  T.setDebug = on => { T.debug = !!on; };
  T.blooms = () => 0;
  T.resetBlooms = () => {};
  T.update = () => {};
  T.rebuild = () => {};
  T.refresh = () => {};
  T.fieldDebug = () => 0;
  return T;
}
