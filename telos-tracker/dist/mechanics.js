// Telos rotation data based on the supplied mechanic chart.
export const LABELS = {
  tendrils: "Tendrils / Grip",
  uppercut: "Uppercut / Energy Sword",
  holdstill: "Hold Still / Double Tap",
  onslaught: "Magic Onslaught",
  virus: "Virus",
  nospec: '"No Spec"',
  weakbomb: "Weak Anima Bomb",
  golemspawn: "Golem Spawn",
  instakill: "Instakill Bomb",
};

export const CYCLE = {
  1: ["tendrils", "uppercut", "holdstill"],
  2: ["onslaught", "holdstill", "virus", "uppercut", "tendrils"],
  3: ["virus", "nospec", "uppercut", "holdstill"],
  4: ["holdstill", "uppercut", "weakbomb"],
  5: ["golemspawn", "virus", "instakill"],
};

export const NEXT_TICKS = {
  1: { tendrils: 3, uppercut: 3, holdstill: 3 },
  2: { onslaught: 3, holdstill: 3, virus: 3, uppercut: 3, tendrils: 3 },
  3: { virus: 3, nospec: 3, uppercut: 3, holdstill: 3 },
  4: { holdstill: 3, uppercut: 3, weakbomb: 3, nospec: 3 },
  5: { golemspawn: 17, virus: 2, instakill: 2 },
};

export const PHASE_START = {
  1: { ticks: 7, mechanic: "tendrils" },
  2: { ticks: 3, mechanic: "onslaught" },
  3: { ticks: 7, mechanic: "virus" },
  4: { ticks: 3, mechanic: "holdstill" },
  5: { ticks: 10, mechanic: "golemspawn" },
};

export const CARRYOVER = {
  2: { tendrils: "onslaught", uppercut: "holdstill", holdstill: "tendrils" },
  3: { onslaught: "virus", holdstill: "nospec", virus: "nospec", uppercut: "uppercut", tendrils: "holdstill" },
  4: { virus: "holdstill", nospec: "nospec", uppercut: "uppercut", holdstill: "weakbomb" },
};

export const CARRYOVER_TICKS = { 2: 3, 3: 7, 4: 3 };

export function getEntry(phase, previousMechanic) {
  if (phase >= 2 && phase <= 4 && previousMechanic && CARRYOVER[phase]?.[previousMechanic]) {
    return { mechanic: CARRYOVER[phase][previousMechanic], ticks: CARRYOVER_TICKS[phase], carry: true };
  }
  return { ...PHASE_START[phase], carry: false };
}

export function getNext(phase, mechanic) {
  // Phase 4 can receive No Spec as carry-over, after which it goes to Hold Still.
  if (phase === 4 && mechanic === "nospec") return "holdstill";
  const cycle = CYCLE[phase] || [];
  const index = cycle.indexOf(mechanic);
  return index < 0 ? cycle[0] : cycle[(index + 1) % cycle.length];
}

export function getTicksAfter(phase, mechanic) {
  return NEXT_TICKS[phase]?.[mechanic] ?? 3;
}

// Chat messages are deliberately matched using distinctive fragments rather than
// exact OCR strings. Alt1 can occasionally insert punctuation/spacing into OCR.
export const CHAT_PATTERNS = [
  { mechanic: "tendrils", patterns: ["anima will return to the source", "return to the source"] },
  { mechanic: "uppercut", patterns: ["gielinor, give me strength", "give me strength"] },
  { mechanic: "holdstill", patterns: ["hold still, invader", "hold still"] },
];
