/** Resolve shipped online / closet art against the site base (Pages is not at /). */
const BASE = import.meta.env.BASE_URL || './';
const url = (p) => `url(${BASE}${p})`;

export function installOnlineArt() {
  const r = document.documentElement.style;
  r.setProperty('--ol-banner-toast', url('ui/online/banners/toast.png'));
  r.setProperty('--ol-toast-copied', url('ui/online/share/toast-copied.png'));
  r.setProperty('--ol-btn-leave', url('ui/online/leave/btn-leave.png'));
  r.setProperty('--ol-btn-leave-compact', url('ui/online/leave/btn-leave-compact.png'));
  r.setProperty('--ol-btn-play', url('ui/online/lobby/btn-play-friends.png'));
  r.setProperty('--ol-code-well', url('ui/online/lobby/code-well.png'));
  r.setProperty('--ol-pin-tile', url('ui/online/pin/tile.png'));
  r.setProperty('--ol-closet-panel', url('act3/ui/closet/panel.png'));
  r.setProperty('--ol-closet-equipped', url('act3/ui/closet/card-equipped.png'));
  r.setProperty('--ol-closet-unequipped', url('act3/ui/closet/card-unequipped.png'));
}

export { BASE };
