/** Resolve shipped online / closet art against the document (not the CSS file in assets/). */
function assetUrl(p) {
  const base = import.meta.env.BASE_URL || './';
  try { return new URL(p, new URL(base, document.baseURI)).href; }
  catch (e) { return base + p; }
}
const url = (p) => `url("${assetUrl(p)}")`;
const BASE = import.meta.env.BASE_URL || './';

export function installOnlineArt() {
  const r = document.documentElement.style;
  r.setProperty('--ol-banner-toast', url('ui/online/banners/toast.png'));
  r.setProperty('--ol-toast-copied', url('ui/online/share/toast-copied.png'));
  r.setProperty('--ol-btn-leave', url('ui/online/leave/btn-leave.png'));
  r.setProperty('--ol-btn-leave-compact', url('ui/online/leave/btn-leave-compact.png'));
  r.setProperty('--ol-btn-play', url('ui/online/lobby/btn-play-friends.png'));
  r.setProperty('--ol-code-well', url('ui/online/lobby/code-well.png'));
  r.setProperty('--ol-pin-tile', url('ui/online/pin/tile.png'));
  r.setProperty('--ol-hold-btn', url('ui/online/gate/hold-btn.png'));
  r.setProperty('--ol-gate-ring-0', url('ui/online/gate/ring-0.png'));
  r.setProperty('--ol-gate-ring-33', url('ui/online/gate/ring-33.png'));
  r.setProperty('--ol-gate-ring-66', url('ui/online/gate/ring-66.png'));
  r.setProperty('--ol-gate-ring-100', url('ui/online/gate/ring-100.png'));
  r.setProperty('--ol-closet-panel', url('act3/ui/closet/panel.png'));
  r.setProperty('--ol-closet-equipped', url('act3/ui/closet/card-equipped.png'));
  r.setProperty('--ol-closet-unequipped', url('act3/ui/closet/card-unequipped.png'));
}

export { BASE };
