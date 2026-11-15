// Read-aloud line catalog. Play by id from lines.json.
//
// To swap voices (Alba, Jenny, American, …): drop the new pack at
// audio/voice/<name>/ with the same lines.json ids and <fileStem>.ogg|.m4a
// files, then change this one constant. No other code changes.
export const VOICE_BASE = 'audio/voice/cori/';

let catalog = null, loading = null;

function linesUrl() {
  return new URL(VOICE_BASE + 'lines.json', document.baseURI).href;
}

export function loadVoiceLines() {
  if (catalog) return Promise.resolve(catalog);
  if (loading) return loading;
  loading = fetch(linesUrl()).then(r => {
    if (!r.ok) throw new Error('lines.json ' + r.status);
    return r.json();
  }).then(rows => {
    const byId = new Map();
    for (const row of Array.isArray(rows) ? rows : []) byId.set(row.id, row);
    catalog = { rows: Array.isArray(rows) ? rows : [], byId };
    return catalog;
  }).catch(() => {
    loading = null;
    catalog = { rows: [], byId: new Map() };
    return catalog;
  });
  return loading;
}

export function voiceLine(id) {
  return catalog?.byId.get(id) || null;
}

export function voiceFileUrl(fileStem, ext) {
  return new URL(VOICE_BASE + fileStem + '.' + ext, document.baseURI).href;
}

export function voiceUrl(id, ext) {
  const row = voiceLine(id);
  return row ? voiceFileUrl(row.fileStem, ext) : null;
}

export function voiceIdsForGroup(group) {
  return catalog ? catalog.rows.filter(r => r.group === group).map(r => r.id) : [];
}

/** First id in the list that exists in lines.json. Missing clips fall through (e.g. lift → carry). */
export function firstVoiceId(ids) {
  const list = Array.isArray(ids) ? ids : (ids == null || ids === '' ? [] : [ids]);
  if (!list.length) return null;
  if (!catalog) return list[0];
  for (const id of list) if (id && catalog.byId.has(id)) return id;
  return null;
}
