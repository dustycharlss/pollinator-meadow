// Play-earned consumables (no shop / real money). Jumbo Basket = temporary carry boost.
export function createItems(ctx) {
  const I = { bag: { jumbo: 0 }, buff: null };
  // hydrate
  if (!ctx.save.items) ctx.save.items = { jumbo: 0 };
  I.bag.jumbo = ctx.save.items.jumbo | 0;

  I.give = (id, n = 1) => {
    if (id === 'jumbo') { I.bag.jumbo += n; ctx.save.items.jumbo = I.bag.jumbo; ctx.persist?.(); ctx.toast?.(`🧺 Jumbo Basket ×${I.bag.jumbo} — use from Interact!`, 2800); }
  };
  I.useJumbo = () => {
    if (I.bag.jumbo <= 0) { ctx.toast?.('No Jumbo Basket yet — finish a goal!', 2000); return false; }
    I.bag.jumbo--; ctx.save.items.jumbo = I.bag.jumbo; ctx.persist?.();
    I.buff = { id: 'jumbo', left: 90, trips: 3, mul: 2.0 };
    ctx.audio?.sample?.('ui/select-pop', 0.45);
    ctx.toast?.('🧺 Jumbo Basket! Carry ×2 for a few trips', 3000);
    ctx.onHud?.();
    return true;
  };
  I.capMul = () => (I.buff && I.buff.id === 'jumbo' ? I.buff.mul : 1);
  I.onDeliver = () => {
    if (!I.buff) return;
    I.buff.trips--;
    if (I.buff.trips <= 0) { I.buff = null; ctx.toast?.('🧺 Jumbo Basket wore out — nice hauling!', 2200); ctx.onHud?.(); }
  };
  I.update = (dt) => {
    if (!I.buff) return;
    I.buff.left -= dt;
    if (I.buff.left <= 0) { I.buff = null; ctx.toast?.('🧺 Jumbo Basket timed out', 1800); ctx.onHud?.(); }
  };
  I.count = (id) => I.bag[id] || 0;
  return I;
}
