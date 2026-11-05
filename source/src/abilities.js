// Home abilities: every home stage-up unlocks a new gentle ability for that animal (stage 2, 3 and 4 of the nest).
// Nothing here is a combat or danger perk - they only make gathering, flying and building feel better.
export const ABILITIES = {
  bee: [
    { icon: '🧺', name: 'Pollen Baskets', desc: 'Carry 3 more pollen.', fx: { carry: 3 } },
    { icon: '🪽', name: 'Strong Wings', desc: 'Flying tires 25% slower.', fx: { drain: 0.75 } },
    { icon: '👑', name: 'Royal Buzz', desc: 'Buzz Boost is faster and recharges quicker.', fx: { boost: 1.25, boostCd: 0.7 } } ],
  bumblebee: [
    { icon: '🧶', name: 'Fuzzy Coat', desc: 'Carry 3 more pollen.', fx: { carry: 3 } },
    { icon: '🌀', name: 'Buzz Pollination', desc: 'Bumble Boost also shakes every flower around you at once.', fx: { buzz: true } },
    { icon: '🎈', name: 'Steady Wings', desc: 'Less wobble, tires 30% slower and drops less.', fx: { drain: 0.7, sink: 0.75 } } ],
  butterfly: [
    { icon: '🎨', name: 'Painted Wings', desc: 'Glides down more softly.', fx: { sink: 0.7 } },
    { icon: '👃', name: 'Nectar Sense', desc: 'Gather from 40% farther away.', fx: { reach: 1.4 } },
    { icon: '🍃', name: 'Migration Wind', desc: 'Flies faster and tires 30% slower.', fx: { drain: 0.7, speed: 1.15 } } ],
  hummingbird: [
    { icon: '🌺', name: 'Quick Sip', desc: 'Gather from 30% farther away.', fx: { reach: 1.3 } },
    { icon: '⚡', name: 'Dart Mastery', desc: 'Dart is faster and recharges sooner.', fx: { boost: 1.2, boostCd: 0.7 } },
    { icon: '✨', name: 'Endless Hover', desc: 'Hovering tires 35% slower.', fx: { drain: 0.65 } } ],
  moth: [
    { icon: '🌙', name: 'Moonscent', desc: 'Gather from 30% farther away.', fx: { reach: 1.3 } },
    { icon: '🪶', name: 'Silk Lift', desc: 'Drifts down more softly.', fx: { sink: 0.7 } },
    { icon: '🔆', name: 'Lunar Glow', desc: 'Flying tires 30% slower.', fx: { drain: 0.7 } } ],
  bat: [
    { icon: '📡', name: 'Echo Sense', desc: 'Gather from 30% farther away.', fx: { reach: 1.3 } },
    { icon: '🦇', name: 'Wide Wings', desc: 'Flying tires 25% slower.', fx: { drain: 0.75 } },
    { icon: '🌪️', name: 'Swoop Boost', desc: 'Swoop Boost is 50% stronger.', fx: { boost: 1.3, boostCd: 0.75 } } ],
  raccoon: [
    { icon: '🖐️', name: 'Nimble Paws', desc: 'Dig faster and reach farther.', fx: { digCd: 0.5, reach: 1.4 } },
    { icon: '🐾', name: 'Quick Paws', desc: 'Scampers 10% faster.', fx: { run: 1.1 } },
    { icon: '🌃', name: 'Night Forager', desc: 'Carry 4 more.', fx: { carry: 4 } } ],
  robin: [
    { icon: '🪺', name: 'Strong Beak', desc: 'Carry 3 more.', fx: { carry: 3 } },
    { icon: '🪽', name: 'Long Flaps', desc: 'Flying tires 25% slower.', fx: { drain: 0.75 } },
    { icon: '🎶', name: 'Dawn Chorus', desc: 'Hops 10% faster and a cheerful tune plays near home.', fx: { run: 1.1, speed: 1.1 } } ],
  opossum: [
    { icon: '🎒', name: 'Big Pouch', desc: 'Carry 4 more.', fx: { carry: 4 } },
    { icon: '💨', name: 'Scurry', desc: 'Scurries 10% faster.', fx: { run: 1.1 } },
    { icon: '🛠️', name: 'Master Builder', desc: 'Each stick step costs only 1 stick.', fx: { build: true } } ],
  bear: [
    { icon: '🧤', name: 'Big Paws', desc: 'Carry 5 more.', fx: { carry: 5 } },
    { icon: '🚶', name: 'Lumbering Gait', desc: 'Strolls 10% faster.', fx: { run: 1.1 } },
    { icon: '⛏️', name: 'Mighty Dig', desc: 'Digs from 50% farther away.', fx: { reach: 1.5 } } ]
};

const NONE = { carry: 0, drain: 1, sink: 1, reach: 1, boost: 1, boostCd: 1, digCd: 1, run: 1, speed: 1, build: false, buzz: false };
/** the combined effect of every ability a species has unlocked at this home stage (0..3) */
export function abilityFx(id, stage) {
  const f = Object.assign({}, NONE), list = ABILITIES[id] || [];
  for (let i = 0; i < Math.min(stage, list.length); i++) {
    const x = list[i].fx;
    for (const k in x) { if (k === 'carry') f.carry += x[k]; else if (typeof x[k] === 'boolean') f[k] = x[k]; else f[k] *= x[k]; }
  }
  return f;
}
