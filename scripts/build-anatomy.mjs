// Builds src/data/anatomy.json and docs/ANATOMY.md.
//
//   node scripts/build-anatomy.mjs      (Node 23.6+ runs the TypeScript SME directly)
//
// Muscle forces come from the OpenSim models in research/opensim-muscles.json. Every muscle is
// also stored as a structure-mapping description (entities, attributes, relations, higher-order
// cause relations). Analogies between muscles, including arm↔leg homologies, are computed by
// SME over those descriptions, not hand-written.

import { readFileSync, writeFileSync } from 'node:fs';
import { keyOf, parse, similarity } from '../src/engine/sme.ts';
import { CHAINS, DOFS, FACE_MUSCLES, JOINT_BONES, MUSCLES, SEGMENTS, SOURCES } from './anatomy-table.mjs';

const opensim = JSON.parse(readFileSync(new URL('../research/opensim-muscles.json', import.meta.url), 'utf8'));

function forceOf(muscle) {
  if (!muscle.parts) return { force: muscle.force ?? null, source: muscle.force ? (muscle.forceNote ?? 'approximate') : null };
  let total = 0;
  const models = new Set();
  for (const part of muscle.parts) {
    const [key, name] = part.split(':');
    const model = SOURCES[key];
    const table = opensim.muscles[model];
    // Rajagopal lists each side separately; the right side stands for both.
    const entry = table[name] ?? table[`${name}_r`];
    if (!entry) throw new Error(`${muscle.id}: part ${part} not found in ${model}`);
    total += entry.max_isometric_force_N;
    models.add(model);
  }
  return { force: Math.round(total), source: [...models].join(', ') };
}

const JOINT_ORDER = ['spine', 'neck', 'jaw', 'shoulder', 'elbow', 'wrist', 'thumb', 'fingers', 'hip', 'knee', 'ankle', 'toes'];
// Ankle dorsiflexion is the homologue of wrist extension (both lift the back of the hand/foot).
const VERB = {
  flex: ['flexes', 'extends'],
  abd: ['abducts', 'adducts'],
  df: ['extends', 'flexes'],
  lat: ['side-bends', 'side-bends'],
};
const HAND_RULE_ACTIONS = {
  'wrist-flex': [], 'wrist-extend': [],
  'finger-flex': [['flexes', 'fingers']], 'finger-flex-distal': [['flexes', 'fingers']],
  'finger-extend': [['extends', 'fingers']], 'index-extend': [['extends', 'fingers']], 'little-extend': [['extends', 'fingers']],
  'thumb-flex': [['flexes', 'thumb']], 'thumb-extend': [['extends', 'thumb']], 'thumb-abduct': [['abducts', 'thumb']],
  'thumb-oppose': [['opposes', 'thumb'], ['abducts', 'thumb']], 'thumb-adduct': [['adducts', 'thumb']],
  'little-flex': [['flexes', 'fingers'], ['abducts', 'fingers']],
  lumbrical: [['flexes', 'fingers'], ['extends', 'fingers']],
  'finger-spread': [['abducts', 'fingers']], 'finger-squeeze': [['adducts', 'fingers']],
};
// Where each joint sits in its limb, so the arm and leg line up (shoulder~hip, elbow~knee…).
const JOINT_ROLE = { shoulder: 'girdle-joint', hip: 'girdle-joint', elbow: 'middle-joint', knee: 'middle-joint', wrist: 'end-joint', ankle: 'end-joint', fingers: 'digit-joint', toes: 'digit-joint', thumb: 'digit-joint', spine: 'axial-joint', neck: 'axial-joint', jaw: 'jaw-joint' };
const slug = (text) => text.replace(/[^a-z0-9]+/gi, '-').replace(/-+$/, '').toLowerCase();

function describe(muscle) {
  const M = 'M';
  const exprs = new Set(['(muscle M)', `(in-${slug(muscle.region)} M)`, `(${muscle.view === 'deep' ? 'deep' : 'superficial'} M)`, `(group-${slug(muscle.group)} M)`]);
  const acts = [];
  for (const [dof, sign] of Object.entries(muscle.actions ?? {})) {
    const d = DOFS[dof];
    const kind = dof.endsWith('_flex') ? 'flex' : dof.endsWith('_abd') ? 'abd' : dof.endsWith('_df') ? 'df' : 'lat';
    acts.push([VERB[kind][sign > 0 ? 0 : 1], d.joint, Math.abs(sign)]);
  }
  for (const [verb, joint] of HAND_RULE_ACTIONS[muscle.hand] ?? []) acts.push([verb, joint, 1]);
  if (muscle.hand && muscle.region === 'forearm' && !acts.some(([, j]) => j === 'wrist')) acts.push(['crosses', 'wrist', 0.5]);
  for (const [verb, joint, strength] of acts) {
    exprs.add(`(crosses M ${joint})`);
    if (verb !== 'crosses') exprs.add(`(${verb} M ${joint})`);
    if (verb !== 'crosses' && strength >= 0.8) exprs.add(`(cause (contracts M) (${verb} M ${joint}))`);
  }
  if (muscle.region === 'face') {
    // Facial features are fixed places, not interchangeable entities: store them as attributes.
    for (const key of Object.keys(muscle.face ?? {})) {
      const feature = key.match(/^(brow|eye|cheek|nose|mouth|jaw)/)?.[1];
      if (feature) exprs.add(`(moves-${feature} M)`);
    }
    for (const unit of String(muscle.facs ?? '').match(/AU\d+/g) ?? []) exprs.add(`(${unit.toLowerCase()} M)`);
    if (/masseter|temporalis|pterygoid|digastric/.test(muscle.id)) exprs.add('(crosses M jaw)');
  }
  const joints = JOINT_ORDER.filter((j) => [...exprs].some((e) => e.endsWith(` ${j})`)));
  if (joints.length >= 2) exprs.add('(biarticular M)');
  if ((muscle.parts?.length ?? 0) >= 2) exprs.add('(multi-part M)');
  for (const [a, b] of CHAINS) if (joints.includes(a) && joints.includes(b)) exprs.add(`(proximal-to ${a} ${b})`);
  for (const j of joints) exprs.add(`(${JOINT_ROLE[j]} ${j})`);
  // Bones: origin on the bone before the first joint crossed, insertion after the last.
  if (joints.length && JOINT_BONES[joints[0]]) {
    exprs.add(`(originates-on M ${JOINT_BONES[joints[0]][0]})`);
    exprs.add(`(inserts-on M ${JOINT_BONES[joints.at(-1)][1]})`);
    for (const j of joints) exprs.add(`(spans ${JOINT_BONES[j][0]} ${JOINT_BONES[j][1]} ${j})`);
  }
  return { name: muscle.id, exprs: [...exprs].map(parse) };
}

const ARM = new Set(['shoulder', 'arm', 'forearm', 'hand']);
const LEG = new Set(['hip', 'thigh', 'leg']);
const limbOf = (m) => (ARM.has(m.region) ? 'arm' : LEG.has(m.region) ? 'leg' : null);

const all = [...MUSCLES, ...FACE_MUSCLES].map((muscle) => ({ ...muscle, ...forceOf(muscle) }));
const descriptions = new Map(all.map((muscle) => [muscle.id, describe(muscle)]));
for (const muscle of all) {
  const mine = descriptions.get(muscle.id);
  const scored = all
    .filter((other) => other.id !== muscle.id)
    .map((other) => ({ id: other.id, score: Math.round(similarity(descriptions.get(other.id), mine) * 100) / 100, limb: limbOf(other) }))
    .sort((a, b) => b.score - a.score);
  muscle.analogues = scored.slice(0, 5).filter((a) => a.score >= 0.3).map(({ id, score }) => ({ id, score }));
  const limb = limbOf(muscle);
  const across = limb && scored.find((a) => a.limb && a.limb !== limb && a.score >= 0.35);
  muscle.homologue = across ? { id: across.id, score: across.score } : null;
  muscle.description = mine.exprs.map(keyOf);
}

// Each group's role in the body plan: the primary actions most of its muscles share, with the
// joint replaced by its place in the limb (quadriceps and triceps both "extend the middle joint").
const groups = {};
for (const group of [...new Set(all.map((x) => x.group))]) {
  const members = all.filter((x) => x.group === group && x.region !== 'face');
  const counts = {};
  for (const muscle of members) {
    for (const [dof, sign] of Object.entries(muscle.actions ?? {})) {
      if (Math.abs(sign) < 0.8) continue;
      const d = DOFS[dof];
      const kind = dof.endsWith('_flex') ? 'flex' : dof.endsWith('_abd') ? 'abd' : dof.endsWith('_df') ? 'df' : 'lat';
      const role = `${VERB[kind][sign > 0 ? 0 : 1]}-${JOINT_ROLE[d.joint]}`;
      counts[role] = (counts[role] ?? 0) + 1;
    }
  }
  groups[slug(group)] = { name: group, roles: Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([r]) => r) };
}

writeFileSync(new URL('../src/data/anatomy.json', import.meta.url), JSON.stringify({
  about: 'Generated by scripts/build-anatomy.mjs from scripts/anatomy-table.mjs and research/opensim-muscles.json. Do not edit by hand.',
  sources: opensim.sources,
  dofs: DOFS,
  segments: SEGMENTS,
  groups,
  muscles: all,
}, null, 1) + '\n');

// ── Human-readable reference ──────────────────────────────────────────────────────────────
const byId = new Map(all.map((x) => [x.id, x]));
const actionText = (muscle) => {
  const parts = Object.entries(muscle.actions ?? {}).map(([dof, s]) => {
    const d = DOFS[dof];
    const word = d.lateral ? 'side-bends the ' + d.joint + ' to its own side' : `${s > 0 ? d.pos : d.neg} of the ${d.joint}`;
    return Math.abs(s) < 0.8 ? `(${word})` : word;
  });
  if (muscle.hand) parts.push(muscle.hand.replace(/-/g, ' '));
  if (muscle.assist) parts.push(`${muscle.assist.replace(/-/g, ' ')}`);
  if (muscle.facs) parts.push(`FACS ${muscle.facs}`);
  return parts.join('; ') || '—';
};
const regions = [...new Set(all.map((x) => x.region))];
let doc = readFileSync(new URL('../docs/ANATOMY.template.md', import.meta.url), 'utf8');
const sections = regions.map((region) => {
  const rows = all.filter((x) => x.region === region).map((x) => {
    const like = x.homologue ? `${byId.get(x.homologue.id).name} (${x.homologue.score})` : (x.analogues[0] ? `${byId.get(x.analogues[0].id).name} (${x.analogues[0].score})` : '—');
    const force = x.force ? `${x.force} N${x.parts ? '' : '*'}` : '—';
    return `| **${x.name}** | ${x.origin} → ${x.insertion} | ${actionText(x)} | ${x.nerve} | ${force} | ${like} |`;
  });
  return `### ${region.charAt(0).toUpperCase() + region.slice(1)}\n\n| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |\n|---|---|---|---|---|---|\n${rows.join('\n')}`;
});
doc = doc.replace('{{TABLES}}', sections.join('\n\n')).replace('{{COUNT}}', String(all.length));
writeFileSync(new URL('../docs/ANATOMY.md', import.meta.url), doc);

console.log(`${all.length} muscles (${MUSCLES.length} body, ${FACE_MUSCLES.length} face).`);
for (const id of ['triceps_brachii', 'biceps_brachii', 'deltoid_middle', 'flexor_carpi_radialis', 'rectus_femoris', 'gastrocnemius_medial', 'zygomaticus_major']) {
  const x = byId.get(id);
  console.log(x.name.padEnd(28), '↔', x.homologue ? `${byId.get(x.homologue.id).name} ${x.homologue.score}` : '—', '| ≈', x.analogues.slice(0, 3).map((a) => `${byId.get(a.id).name} ${a.score}`).join(', '));
}
