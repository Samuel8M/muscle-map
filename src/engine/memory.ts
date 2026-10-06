import anatomy from '../data/anatomy.json';
import type { BodyState, DofId } from './body';
import type { MuscleState } from './muscles';
import { keyOf, match as smeMatch, parse, similarity as smeSimilarity, type Description, type Expr, type MatchOptions } from './sme';

// Joints map to joints, muscle groups to groups, phases to phases; and only relations (what
// moves and works, and how) may set up correspondences.
const MATCH: MatchOptions = { types: ['joint', 'muscle-group', 'phase', 'whole-body'], attributesNeedSupport: true };
const similarity = (a: Description, b: Description, mapping?: ReturnType<typeof smeMatch>) => smeSimilarity(a, b, MATCH, mapping ?? smeMatch(a, b, MATCH));
const match = (a: Description, b: Description) => smeMatch(a, b, MATCH);

/*
 * Movement memory, modelled on how the brain stores new experiences:
 *
 *  - Each movement is stored as a structured description (structure-mapping): phases, the joints
 *    moving in each phase, the muscle groups working and how (shortening / lengthening / holding),
 *    whether the body is rising or lowering, and the order of phases. Joints and muscle groups
 *    are entities, so a left-leg lunge can map onto a right-leg lunge.
 *  - Fast episodic storage (hippocampus) and slow generalization (neocortex): Complementary
 *    Learning Systems (McClelland, McNaughton & O'Reilly, 1995; Kumaran, Hassabis & McClelland,
 *    2016). New information that fits an existing schema is integrated at once (Tse et al., 2007;
 *    van Kesteren et al., 2012); novel information waits as an episode.
 *  - Dreaming: offline replay merges analogous episodes into probabilistic generalizations
 *    (SAGE: Kuehne et al., 2000; McLure et al., 2010), then compares different movements to find
 *    analogies between them (REM-like recombination; Lewis, Knoblich & Poe, 2018).
 */

export type Sample = {
  t: number;
  angles: Record<string, number>;
  groups: Record<string, { activation: number; contraction: string | null; purpose: string | null }>;
  hipY: number; // normalised image height of the hips
  bodyHeight: number; // normalised image height of the body, for scale
};
type Stored = { name: string; exprs: string[] };
export type Episode = { id: string; name: string; description: Stored; created: number; consolidated: boolean };
export type Generalization = { id: string; counts: Record<string, number>; members: number; names: Record<string, number> };
export type Memory = { episodes: Episode[]; generalizations: Generalization[]; insights: string[]; dreamedAt?: number };

const KEY = 'muscle-map:memory:v1';
const ASSIMILATE = 0.55;
const RECOGNISE = 0.45;
const DOF_WORDS: Record<string, [string, string]> = {
  flex: ['flexing', 'extending'], abd: ['abducting', 'adducting'], df: ['dorsiflexing', 'plantarflexing'], lat: ['bending-left', 'bending-right'],
};
// Abstraction levels for structure-mapping: a joint's place in its limb, and a muscle group's
// role in the body plan. These let a push-up's elbow map onto a squat's knee.
const JOINT_ROLE: Record<string, string> = { shoulder: 'girdle-joint', hip: 'girdle-joint', elbow: 'middle-joint', knee: 'middle-joint', wrist: 'end-joint', ankle: 'end-joint', spine: 'axial-joint', neck: 'axial-joint' };
const GROUP_ROLES = (anatomy as unknown as { groups: Record<string, { roles: string[] }> }).groups;
const slug = (s: string) => s.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').toLowerCase();

export function sampleOf(body: BodyState, muscles: MuscleState[], hipY: number, bodyHeight: number): Sample {
  const angles: Record<string, number> = {};
  for (const [key, dof] of body.dofs) angles[key] = dof.angle;
  const groups: Sample['groups'] = {};
  for (const m of muscles) {
    if (m.def.region === 'face' || m.def.region === 'hand') continue;
    const key = `${slug(m.def.group)}${m.side === 'C' ? '' : m.side}`;
    const current = groups[key];
    if (!current || m.activation > current.activation) groups[key] = { activation: m.activation, contraction: m.contraction, purpose: m.purpose };
  }
  return { t: body.time, angles, groups, hipY, bodyHeight };
}

/**
 * Describes a movement by its gist, the way people remember movements: the joints that move a
 * lot, the muscle groups doing most of the work and how, and the order of phases. A repeated
 * movement is reduced to one cycle that starts with its lowering (or bending) phase, and left
 * and right are merged when both sides do the same thing.
 */
export function describeMovement(samples: Sample[], name = 'movement'): Description {
  const exprs = new Set<string>();
  if (samples.length < 4) return { name, exprs: [] };
  const keys = Object.keys(samples[0].angles);
  const range = (k: string, list = samples) => Math.max(...list.map((s) => s.angles[k])) - Math.min(...list.map((s) => s.angles[k]));
  const dominant = [...keys].sort((a, b) => range(b) - range(a))[0];
  const dominantRange = range(dominant);
  const moving = dominantRange > 15;
  // Phases: stretches where the dominant joint keeps moving the same way.
  let phases: { samples: Sample[]; sign: number }[] = [];
  if (moving) {
    let current: Sample[] = [samples[0]];
    let sign = 0;
    for (let i = 1; i < samples.length; i += 1) {
      const window = samples.slice(Math.max(0, i - 3), i + 1);
      const v = (window.at(-1)!.angles[dominant] - window[0].angles[dominant]) / Math.max(1e-3, window.at(-1)!.t - window[0].t);
      const s = Math.abs(v) < 15 ? sign : Math.sign(v);
      if (sign !== 0 && s !== sign && current.length > 3) {
        phases.push({ samples: current, sign });
        current = [];
      }
      sign = s || sign;
      current.push(samples[i]);
    }
    if (current.length > 3) phases.push({ samples: current, sign });
    // One cycle, starting where the dominant joint bends (flexes): "down, then up".
    const start = phases.findIndex((p) => p.sign > 0);
    if (phases.length >= 2) phases = phases.slice(Math.max(0, start), Math.max(0, start) + 2);
    if (phases.length < 2 && start > 0) phases = phases.slice(start - 1, start + 1);
  } else phases.push({ samples, sign: 0 });

  const words: Record<string, [string, string]> = DOF_WORDS;
  type Statement = { p: string; verb: string; kind: string; side: string };
  const statements: Statement[] = [];
  const declared = new Set<string>();
  const entity = (kind: string, side: string) => {
    const id = side === 'B' ? kind : `${kind}${side}`;
    if (!declared.has(id)) {
      declared.add(id);
      exprs.add(`(${kind} ${id})`);
      exprs.add(`(${JOINT_ROLE[kind] || ['spine', 'neck', 'wrist', 'ankle'].includes(kind) ? 'joint' : 'muscle-group'} ${id})`);
      for (const role of [JOINT_ROLE[kind], ...(GROUP_ROLES[kind]?.roles ?? [])].filter(Boolean)) exprs.add(`(${role} ${id})`);
      if (side === 'B') exprs.add(`(both-sides ${id})`);
      else if (side === 'L') exprs.add(`(left ${id})`);
      else if (side === 'R') exprs.add(`(right ${id})`);
    }
    return id;
  };
  phases.forEach((phase, i) => {
    const p = `p${i + 1}`;
    exprs.add(`(phase ${p})`);
    if (i > 0) exprs.add(`(then p${i} ${p})`);
    const first = phase.samples[0], last = phase.samples.at(-1)!;
    // Salient joint motions only: big in absolute terms and relative to the main motion.
    const threshold = Math.max(15, dominantRange * 0.35);
    const motions = new Map<string, Map<string, string>>(); // "joint|verb" → sides
    for (const k of keys) {
      const change = last.angles[k] - first.angles[k];
      if (Math.abs(change) < threshold) continue;
      const [dofId, side = 'C'] = k.split(/_(?=[LR]$)/);
      const d = anatomy.dofs[dofId as DofId];
      if (!d) continue;
      const kind = dofId.endsWith('_flex') ? 'flex' : dofId.endsWith('_abd') ? 'abd' : dofId.endsWith('_df') ? 'df' : 'lat';
      const verb = words[kind][change > 0 ? 0 : 1];
      const key = `${d.joint}|${verb}`;
      if (!motions.has(key)) motions.set(key, new Map());
      motions.get(key)!.set(side, verb);
    }
    for (const [key, sides] of motions) {
      const [joint, verb] = key.split('|');
      const side = sides.has('L') && sides.has('R') ? 'B' : sides.has('L') ? 'L' : sides.has('R') ? 'R' : 'B';
      statements.push({ p, verb, kind: joint, side });
    }
    // The muscle groups doing most of the work (top four), and how.
    const means = Object.keys(first.groups).map((g) => ({ g, mean: phase.samples.reduce((s, x) => s + (x.groups[g]?.activation ?? 0), 0) / phase.samples.length }));
    const byGroup = new Map<string, { sides: Set<string>; mean: number; how: Record<string, number>; why: Record<string, number> }>();
    for (const { g, mean } of means) {
      if (mean < 0.12) continue;
      const side = /[LR]$/.test(g) ? g.slice(-1) : 'C';
      const base = side === 'C' ? g : g.slice(0, -1);
      const entry = byGroup.get(base) ?? { sides: new Set<string>(), mean: 0, how: {}, why: {} };
      entry.sides.add(side);
      entry.mean = Math.max(entry.mean, mean);
      for (const x of phase.samples) {
        const c = x.groups[g]?.contraction;
        if (c) entry.how[c] = (entry.how[c] ?? 0) + 1;
        const w = x.groups[g]?.purpose;
        if (w) entry.why[w] = (entry.why[w] ?? 0) + 1;
      }
      byGroup.set(base, entry);
    }
    const top = [...byGroup.entries()].sort((a, b) => b[1].mean - a[1].mean).slice(0, 4);
    for (const [base, entry] of top) {
      const side = entry.sides.has('L') && entry.sides.has('R') ? 'B' : entry.sides.has('L') ? 'L' : entry.sides.has('R') ? 'R' : 'B';
      const how = Object.entries(entry.how).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'holding';
      // Two levels: what the group is working for (purpose) and how (mechanism).
      const why = Object.entries(entry.why).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (why) statements.push({ p, verb: why, kind: base, side });
      statements.push({ p, verb: how, kind: base, side });
      if (entry.mean > 0.45) statements.push({ p, verb: 'hard', kind: base, side });
    }
    const drop = (last.hipY - first.hipY) / Math.max(0.1, first.bodyHeight);
    if (Math.abs(drop) > 0.06) exprs.add('(whole-body body)');
    if (drop > 0.06) exprs.add(`(during ${p} (lowering body))`);
    if (drop < -0.06) exprs.add(`(during ${p} (raising body))`);
  });
  // A body part that works on both sides anywhere in the movement is one two-sided entity
  // throughout, so the phases refer to the same thing.
  const twoSided = new Set(statements.filter((x) => x.side === 'B').map((x) => x.kind));
  for (const kind of new Set(statements.map((x) => x.kind))) {
    const sides = new Set(statements.filter((x) => x.kind === kind).map((x) => x.side));
    if (sides.has('L') && sides.has('R')) twoSided.add(kind);
  }
  for (const x of statements) exprs.add(`(during ${x.p} (${x.verb} ${entity(x.kind, twoSided.has(x.kind) ? 'B' : x.side)}))`);
  return { name, exprs: [...exprs].map(parse) };
}

/**
 * MAC stage (Forbus, Gentner & Law, 1995): a "content vector" of how often each relation occurs,
 * compared by cosine. It is cheap, like the vector embeddings Analogical Engines use to
 * retrieve candidates, and only candidates that pass it go on to full structure-mapping (FAC).
 */
function contentVector(d: Description) {
  const counts = new Map<string, number>();
  const walk = (e: Expr) => {
    counts.set(e.pred, (counts.get(e.pred) ?? 0) + 1);
    for (const a of e.args) if (typeof a !== 'string') walk(a);
  };
  d.exprs.forEach(walk);
  return counts;
}
function cosine(a: Map<string, number>, b: Map<string, number>) {
  let dotp = 0, na = 0, nb = 0;
  for (const [k, v] of a) { na += v * v; dotp += v * (b.get(k) ?? 0); }
  for (const v of b.values()) nb += v * v;
  return dotp / (Math.sqrt(na * nb) || 1);
}

const store = (d: Description): Stored => ({ name: d.name, exprs: d.exprs.map(keyOf) });
const restore = (s: Stored): Description => ({ name: s.name, exprs: s.exprs.map(parse) });
const generalized = (g: Generalization): Description => ({ name: g.id, exprs: Object.entries(g.counts).filter(([, n]) => n / g.members >= 0.5).map(([e]) => parse(e)) });
const nameOf = (g: Generalization) => Object.entries(g.names).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'movement';

export function loadMemory(): Memory {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Memory) : null;
    if (parsed && Array.isArray(parsed.episodes) && Array.isArray(parsed.generalizations)) return { ...parsed, insights: parsed.insights ?? [] };
  } catch {
    // Unreadable or blocked storage: start fresh.
  }
  return { episodes: [], generalizations: [], insights: [] };
}

function save(memory: Memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Storage can be refused (private windows); memory still works for this visit.
  }
  return memory;
}

export function forget(): Memory {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
  return { episodes: [], generalizations: [], insights: [] };
}

function absorb(g: Generalization, e: Episode) {
  for (const statement of e.description.exprs) g.counts[statement] = (g.counts[statement] ?? 0) + 1;
  g.members += 1;
  g.names[e.name] = (g.names[e.name] ?? 0) + 1;
  e.consolidated = true;
}

/** Learns a named movement. Fits an existing schema → integrated at once; otherwise kept as an episode. */
export function learn(memory: Memory, name: string, samples: Sample[]): { memory: Memory; note: string } {
  const d = describeMovement(samples, name);
  if (!d.exprs.length) return { memory, note: 'Not enough movement was recorded to remember.' };
  const episode: Episode = { id: `ep${Date.now().toString(36)}`, name, description: store(d), created: Date.now(), consolidated: false };
  const generalizations = memory.generalizations.map((g) => ({ ...g, counts: { ...g.counts }, names: { ...g.names } }));
  const best = generalizations.map((g) => ({ g, sim: similarity(generalized(g), d) })).sort((a, b) => b.sim - a.sim)[0];
  if (best && best.sim >= ASSIMILATE) {
    absorb(best.g, episode);
    return { memory: save({ ...memory, generalizations, episodes: [...memory.episodes, episode] }), note: `Fitted straight into what it already knew about “${nameOf(best.g)}” (${Math.round(best.sim * 100)}% alike), so it was learned at once.` };
  }
  return { memory: save({ ...memory, episodes: [...memory.episodes, episode].slice(-200) }), note: `Remembered “${name}” as a new experience; it will be connected to what it knows while it dreams.` };
}

/** What the recent movement most resembles, if anything (MAC/FAC retrieval). */
export function recognise(memory: Memory, samples: Sample[]): { name: string; score: number } | null {
  const d = describeMovement(samples);
  if (!d.exprs.length) return null;
  const probe = contentVector(d);
  const candidates = [
    ...memory.generalizations.map((g) => ({ name: nameOf(g), d: generalized(g) })),
    ...memory.episodes.filter((e) => !e.consolidated).map((e) => ({ name: e.name, d: restore(e.description) })),
  ].filter((c) => cosine(probe, contentVector(c.d)) >= 0.3);
  const ranked = candidates.map((c) => ({ name: c.name, score: similarity(c.d, d) })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const rival = ranked.find((r) => r.name !== best?.name);
  // Only name it when it clearly beats every other kind of movement.
  return best && best.score >= RECOGNISE && (!rival || best.score - rival.score >= 0.08) ? best : null;
}

const MUSCLE_GROUP_ANALOGY = (a: string, b: string) => {
  // Use the anatomy's own SME homologies: do the two groups contain homologous muscles?
  const muscles = anatomy.muscles as { id: string; group: string; homologue: { id: string } | null }[];
  const inGroup = (g: string) => muscles.filter((m) => slug(m.group) === g);
  return inGroup(a).some((m) => m.homologue && inGroup(b).some((n) => n.id === m.homologue!.id));
};

/** Offline consolidation: replay and generalize (non-REM-like), then relate movements (REM-like). */
export function dream(memory: Memory): Memory {
  const generalizations = memory.generalizations.map((g) => ({ ...g, counts: { ...g.counts }, names: { ...g.names } }));
  const episodes = memory.episodes.map((e) => ({ ...e }));
  for (const e of episodes.filter((x) => !x.consolidated).sort(() => Math.random() - 0.5)) {
    if (e.consolidated) continue;
    const d = restore(e.description);
    const best = generalizations.map((g) => ({ g, sim: similarity(generalized(g), d) })).sort((a, b) => b.sim - a.sim)[0];
    if (best && best.sim >= ASSIMILATE) { absorb(best.g, e); continue; }
    const partner = episodes.find((o) => o !== e && !o.consolidated && similarity(restore(o.description), d) >= ASSIMILATE);
    if (partner) {
      const g: Generalization = { id: `gen${generalizations.length + 1}`, counts: {}, members: 0, names: {} };
      absorb(g, e);
      absorb(g, partner);
      generalizations.push(g);
    }
  }
  // Relate different movements to each other by structure-mapping.
  const insights: string[] = [];
  const known = [
    ...generalizations.map((g) => ({ name: nameOf(g), d: generalized(g), members: g.members })),
    ...episodes.filter((e) => !e.consolidated).map((e) => ({ name: e.name, d: restore(e.description), members: 1 })),
  ];
  for (const k of known) if (k.members > 1) insights.push(`Merged ${k.members} recordings of “${k.name}” into one pattern.`);
  for (let i = 0; i < known.length; i += 1) {
    for (let j = i + 1; j < known.length; j += 1) {
      const a = known[i], b = known[j];
      if (a.name === b.name) continue;
      const mapping = match(a.d, b.d);
      const sim = similarity(a.d, b.d, mapping);
      if (sim < 0.4) continue;
      // Entity correspondences that cross body parts are the interesting analogies.
      const swaps = [...mapping.entities].filter(([x, y]) => x.replace(/[LR]$/, '') !== y.replace(/[LR]$/, '') && !/^p\d/.test(x));
      const homologous = swaps.filter(([x, y]) => MUSCLE_GROUP_ANALOGY(x.replace(/[LR]$/, ''), y.replace(/[LR]$/, '')));
      // Correspondences between things with the same role in the body plan (knee~elbow as
      // middle joints, quadriceps~triceps as middle-joint extensors) are the meaningful ones.
      // A part's primary role is the first role listed for it (its strongest shared action).
      const primaryRole = (d: Description, id: string) => d.exprs.find((e) => e.args.length === 1 && e.args[0] === id && /-joint$/.test(e.pred))?.pred;
      const sameRole = swaps.filter(([x, y]) => { const r = primaryRole(a.d, x); return !!r && r === primaryRole(b.d, y); });
      const pretty = (s: string) => s.replace(/[LR]$/, '').replace(/-/g, ' ');
      const pct = Math.round(sim * 100);
      if (homologous.length) {
        const [x, y] = homologous[0];
        insights.push(`“${a.name}” is like “${b.name}” (${pct}%): it uses the ${pretty(x)} where the other uses the ${pretty(y)}, muscles that play the same role in the arm and the leg.`);
      } else if (sameRole.length) {
        const pairs = sameRole.slice(0, 2).map(([x, y]) => `the ${pretty(x)} does the job of the ${pretty(y)}`);
        insights.push(`“${a.name}” is like “${b.name}” (${pct}%): ${pairs.join(', and ')}, same role in the other limb.`);
      } else if (swaps.length) {
        const [x, y] = swaps[0];
        insights.push(`“${a.name}” is like “${b.name}” (${pct}%), with the ${pretty(x)} in the role of the ${pretty(y)}.`);
      } else insights.push(`“${a.name}” and “${b.name}” share ${pct}% of their structure.`);
    }
  }
  return save({ episodes, generalizations, insights: insights.slice(0, 12), dreamedAt: Date.now() });
}
