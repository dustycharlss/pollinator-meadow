// polish4: slim Beans' models-lod/lod-map.json drops at build time (the raw file carries tris/bytes/notes/QA ~180 KB; the game
// needs only keys, LOD paths, distances incl. distances.lite, and the skinned flag).
const slimLodMap = {
  name: 'slim-lod-map', enforce: 'pre',
  transform(code, id) {
    if (!/[\\/]models-lod[\\/](?:.*[\\/])?lod-map\.json$/.test(id.split('?')[0])) return null;
    let j; try { j = JSON.parse(code); } catch (e) { return null; }
    if (!Array.isArray(j.entries)) return null;
    const entries = j.entries.filter(e => !e.skipped && (e.lod1 || e.lod2)).map(e => {
      const D = e.distances || {}, L = D.lite || {};
      return { keys: [...new Set([...(e.keys || []), ...(e.short_keys || []), e.tc_path, e.lod0].filter(Boolean))], lod1: e.lod1 || null, lod2: e.lod2 || null,
        d1: D.lod1 ?? null, d2: D.lod2 ?? null, l1: L.lod1 ?? null, l2: L.lod2 ?? null, skinned: !!e.skinned, cls: e.size_class };
    });
    return { code: JSON.stringify({ slim: 1, entries }), map: null };
  },
};
export default { base: './', build: { chunkSizeWarningLimit: 1500, target: 'es2020' }, server: { host: true }, plugins: [slimLodMap] };
