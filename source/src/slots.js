/** Player slots. A slot is { idx, body, src, color, local }.
 *  Solo: one slot, src = kb-all+touch+gamepad, swap moves the slot between bodies.
 *  ?slots=2 (N0 debug): Bruiser←WASD, Scout←arrows, bodies stay locked.
 *  Online / S8 will add more local and remote sources on the same path.
 */
const COLORS = ['#ffd23f', '#6db4d6', '#d45890'];

export function createSlots(opts = {}) {
  const slots = [];
  let followCur = true;
  let locked = false;

  function all() { return slots; }
  function list() { return slots; }
  function driven() { return slots.map(s => s.body).filter(Boolean); }
  function localSlots() { return slots.filter(s => s.local && s.body); }
  function byBody(id) { return slots.find(s => s.body === id) || null; }
  function at(i) { return slots[i] || null; }

  function taken() { return new Set(slots.map(s => s.body).filter(Boolean)); }

  function setBody(idx, body) {
    const s = slots[idx];
    if (!s) return false;
    if (body && taken().has(body) && s.body !== body) return false;
    s.body = body || null;
    return true;
  }

  function clear() { slots.length = 0; }

  function add(spec = {}) {
    const idx = slots.length;
    const s = {
      idx,
      body: spec.body ?? null,
      src: spec.src || null,
      color: spec.color || COLORS[idx % COLORS.length],
      local: spec.local !== false,
    };
    slots.push(s);
    return s;
  }

  function setupSolo(body, src) {
    clear();
    followCur = true;
    locked = false;
    add({ body, src, local: true, color: COLORS[0] });
  }

  /** Debug ?slots=2: Bruiser on kb-left, Scout on kb-right. */
  function setupDebug2(srcs, ids = { bruiser: 'bear', scout: 'bee' }) {
    clear();
    followCur = false;
    locked = true;
    add({ body: ids.bruiser, src: srcs.left, local: true, color: COLORS[0] });
    add({ body: ids.scout, src: srcs.right, local: true, color: COLORS[1] });
  }

  function onSwap(id) {
    if (!id) return;
    if (followCur && slots[0]) {
      // Solo: the one slot follows the active body. Never share a body.
      if (slots[0].body === id) return;
      const other = byBody(id);
      if (other && other !== slots[0]) return;
      slots[0].body = id;
    }
  }

  return {
    all, list, driven, localSlots, byBody, at, setBody, add, clear,
    setupSolo, setupDebug2, onSwap,
    get followCur() { return followCur; },
    set followCur(v) { followCur = !!v; },
    get locked() { return locked; },
    get length() { return slots.length; },
  };
}

export { COLORS as SLOT_COLORS };
