import anatomy from '../data/anatomy.json';
import type { BodyState, DofId, DofState } from './body';
import type { Side } from './geometry';

/*
 * From joint efforts to individual muscles.
 *
 *  - Sharing within a joint direction: every muscle that pulls the needed way works at the same
 *    effort (equal stress), the solution of minimising summed stress³ for one joint
 *    (Crowninshield & Brand, 1981). Secondary actions count in proportion.
 *  - Scapular rhythm: above ~30° of arm elevation the scapula rotates upward about 1° for every
 *    2° at the shoulder (Inman, Saunders & Abbott, 1944), so its upward rotators share the load.
 *  - The rotator cuff and deep trunk muscles brace their joints whenever those joints are loaded.
 *  - Hands: finger shapes from the hand tracker. Face: FACS-style expression scores.
 *  - Activation rises and falls with muscle time constants (about 15 ms on, 50 ms off; Zajac, 1989).
 */

export type MuscleDef = {
  id: string;
  name: string;
  group: string;
  region: string;
  view: 'front' | 'back' | 'side' | 'deep';
  bilateral: boolean;
  origin: string;
  insertion: string;
  nerve: string;
  includes?: string;
  note?: string;
  actions?: Record<string, number>;
  assist?: string;
  hand?: string;
  face?: Record<string, number>;
  facs?: string;
  draw: { a: string | number[]; b: string | number[]; w: number };
  force: number | null;
  source: string | null;
  parts?: string[];
  analogues: { id: string; score: number }[];
  homologue: { id: string; score: number } | null;
  description: string[];
};
export type Contraction = 'shortening' | 'lengthening' | 'holding' | 'expression';
/**
 * What a muscle is working *for*, separate from how it works (its contraction). Describing
 * function as purpose apart from mechanism is the core of analogical retrieval in innovation
 * research (Hope, Chan, Kittur & Shahaf, 2017): it lets a triceps in a push-up and a quadriceps
 * in a squat be recognised as doing the same job.
 */
export type Purpose = 'supporting' | 'braking' | 'driving' | 'holding-up' | 'lowering' | 'lifting' | 'steadying' | 'hand' | 'expression';
export const PURPOSE_TEXT: Record<Purpose, string> = {
  supporting: 'Bearing your weight',
  braking: 'Braking your weight on the way down',
  driving: 'Pushing your weight up',
  'holding-up': 'Holding the limb up against gravity',
  lowering: 'Lowering the limb under control',
  lifting: 'Lifting the limb',
  steadying: 'Steadying a joint',
  hand: 'Working the hand',
  expression: 'Making a facial expression',
};
export type MuscleState = {
  key: string; // `${id}:${side}`
  def: MuscleDef;
  side: Side | 'C';
  activation: number; // 0..1, smoothed
  contraction: Contraction | null;
  purpose: Purpose | null;
  /** The DOF (or hand/face signal) this activation comes from, for explanations. */
  because: { kind: 'joint'; dof: DofState; share: number } | { kind: 'assist'; text: string } | { kind: 'hand'; text: string } | { kind: 'face'; text: string } | null;
  observed: boolean; // false when the body part driving it isn't tracked
};
export type HandFeatures = {
  fingerFlex: number; // 0..1 (≈ 0–90° at MCP + PIP)
  distalFlex: number;
  fingerFlexVelocity: number; // per second
  thumbFlex: number;
  thumbAbduction: number;
  opposition: number;
  pinch: number;
  spread: number; // 0..1
  indexFlex: number;
  pinkyFlex: number;
  mcpFlex: number;
  ipFlex: number;
};

export const MUSCLES = anatomy.muscles as unknown as MuscleDef[];
const ON = 0.015, OFF = 0.05;

type V = { x: number; y: number; z: number };
const vsub = (a: V, b: V) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const vlen = (a: V) => Math.hypot(a.x, a.y, a.z);
const angleBetween = (a: V, b: V) => {
  const d = (a.x * b.x + a.y * b.y + a.z * b.z) / ((vlen(a) * vlen(b)) || 1);
  return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
};
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Finger and thumb shape from the 21 hand landmarks (any consistent 3D units). */
export function handFeatures(h: V[], previous: HandFeatures | undefined, dt: number): HandFeatures {
  const bend = (a: number, b: number, c: number) => angleBetween(vsub(h[b], h[a]), vsub(h[c], h[b]));
  const finger = (mcp: number) => ({ mcp: bend(0, mcp, mcp + 1), pip: bend(mcp, mcp + 1, mcp + 2), dip: bend(mcp + 1, mcp + 2, mcp + 3) });
  const fingers = [5, 9, 13, 17].map(finger);
  const flexOf = (f: { mcp: number; pip: number }) => clamp01((f.mcp + f.pip) / 180);
  const fingerFlex = fingers.reduce((s, f) => s + flexOf(f), 0) / 4;
  const size = vlen(vsub(h[9], h[0])) || 1;
  return {
    fingerFlex,
    distalFlex: clamp01(fingers.reduce((s, f) => s + f.dip, 0) / 4 / 70),
    fingerFlexVelocity: previous && dt > 0 ? (fingerFlex - previous.fingerFlex) / dt : 0,
    thumbFlex: clamp01((bend(1, 2, 3) + bend(2, 3, 4)) / 120),
    thumbAbduction: clamp01((angleBetween(vsub(h[2], h[1]), vsub(h[5], h[0])) - 30) / 40),
    opposition: clamp01(1 - (vlen(vsub(h[4], h[17])) / size - 0.3) / 0.5),
    pinch: clamp01(1 - (vlen(vsub(h[4], h[8])) / size - 0.1) / 0.5),
    spread: clamp01((angleBetween(vsub(h[6], h[5]), vsub(h[18], h[17])) - 30) / 30),
    indexFlex: flexOf(fingers[0]),
    pinkyFlex: flexOf(fingers[3]),
    mcpFlex: clamp01(fingers.reduce((s, f) => s + f.mcp, 0) / 4 / 80),
    ipFlex: clamp01(fingers.reduce((s, f) => s + f.pip, 0) / 4 / 90),
  };
}

/** Hand-muscle effort from finger shape. Unloaded hand movements need little force, so these stay modest. */
function handDrive(rule: string, f: HandFeatures): number {
  return 0.6 * handShape(rule, f);
}
function handShape(rule: string, f: HandFeatures): number {
  const grip = clamp01((f.fingerFlex - 0.3) / 0.55);
  switch (rule) {
    case 'finger-flex': return clamp01(0.7 * grip + 0.3 * Math.max(0, f.fingerFlexVelocity));
    case 'finger-flex-distal': return clamp01(0.6 * clamp01((f.distalFlex - 0.2) / 0.6) + 0.4 * grip);
    case 'finger-extend': return clamp01(0.5 * Math.max(0, -f.fingerFlexVelocity) + (f.fingerFlex < 0.08 ? 0.25 : 0) + 0.2 * grip);
    case 'wrist-extend': return 0.5 * grip; // wrist extensors stabilise the wrist while gripping
    case 'wrist-flex': return 0.3 * grip;
    case 'thumb-flex': return clamp01((f.thumbFlex - 0.2) / 0.6);
    case 'thumb-extend': return clamp01((1 - f.thumbFlex) * f.thumbAbduction);
    case 'thumb-abduct': return f.thumbAbduction;
    case 'thumb-oppose': return f.opposition;
    case 'thumb-adduct': return clamp01(f.pinch * (1 - f.thumbAbduction));
    case 'little-flex': return clamp01((f.pinkyFlex - 0.2) / 0.6);
    case 'lumbrical': return clamp01(f.mcpFlex * (1 - f.ipFlex) * 1.5);
    case 'finger-spread': return f.spread;
    case 'finger-squeeze': return clamp01((1 - f.spread) * (1 - f.fingerFlex) * 0.5);
    case 'index-extend': return clamp01((1 - f.indexFlex) * f.pinkyFlex * 1.5);
    case 'little-extend': return clamp01((1 - f.pinkyFlex) * f.indexFlex * 1.5);
    default: return 0;
  }
}

function faceDrive(face: Record<string, number>, map: Record<string, number>, side: Side | 'C'): { value: number; key: string } {
  let best = { value: 0, key: '' };
  const sideWord = side === 'L' ? 'Left' : 'Right';
  for (const [raw, weight] of Object.entries(map)) {
    let key = raw.replace('_S', sideWord);
    if (raw === 'jawOpposite_S') key = side === 'L' ? 'jawRight' : 'jawLeft';
    const value = (face[key] ?? 0) * weight;
    if (value > best.value) best = { value, key };
  }
  return best;
}

/** Purpose in words, naming the body part that is moving (limb, trunk or head). */
export function purposeLabel(m: MuscleState) {
  if (!m.purpose) return '';
  const joint = m.because?.kind === 'joint' ? m.because.dof.id : '';
  const part = joint.startsWith('trunk') ? 'trunk' : joint.startsWith('neck') ? 'head' : 'limb';
  return PURPOSE_TEXT[m.purpose].replace('the limb', `the ${part}`);
}

function purposeOf(because: MuscleState['because'], contraction: Contraction | null): Purpose | null {
  if (!because) return null;
  if (because.kind === 'face') return 'expression';
  if (because.kind === 'hand') return 'hand';
  if (because.kind === 'assist') return 'steadying';
  // Weight coming up through a hand or foot on the ground: the muscle carries the body.
  if (because.dof.supported) return contraction === 'lengthening' ? 'braking' : contraction === 'shortening' ? 'driving' : 'supporting';
  return contraction === 'lengthening' ? 'lowering' : contraction === 'shortening' ? 'lifting' : 'holding-up';
}

export class MuscleModel {
  private states = new Map<string, MuscleState>();
  private handPrev = new Map<Side, HandFeatures>();

  constructor() {
    for (const def of MUSCLES) {
      const sides: (Side | 'C')[] = def.bilateral ? ['L', 'R'] : ['C'];
      for (const side of sides) {
        const key = `${def.id}:${side}`;
        this.states.set(key, { key, def, side, activation: 0, contraction: null, purpose: null, because: null, observed: false });
      }
    }
  }

  all() {
    return [...this.states.values()];
  }

  update(body: BodyState | null, hands: Partial<Record<Side, V[]>>, face: Record<string, number> | null, dt: number) {
    const dofOf = (id: string, side: Side | 'C') => body?.dofs.get(anatomy.dofs[id as DofId] && 'sided' in anatomy.dofs[id as DofId] ? `${id}_${side}` : id);
    const features: Partial<Record<Side, HandFeatures>> = {};
    for (const s of ['L', 'R'] as Side[]) {
      const h = hands[s];
      if (h) {
        features[s] = handFeatures(h, this.handPrev.get(s), dt);
        this.handPrev.set(s, features[s]!);
      } else this.handPrev.delete(s);
    }
    // Shoulder loads, for scapular rhythm and cuff bracing.
    const shoulderLoad = (s: Side) => {
      const flex = dofOf('shoulder_flex', s), abd = dofOf('shoulder_abd', s);
      if (!flex || !abd) return { elevation: 0, load: 0, angle: 0 };
      const elevation = Math.max(0, flex.effort, abd.effort);
      return { elevation, load: Math.max(Math.abs(flex.effort), Math.abs(abd.effort)), angle: Math.max(flex.angle, abd.angle) };
    };
    const trunkLoad = () => Math.max(Math.abs(body?.dofs.get('trunk_flex')?.effort ?? 0), Math.abs(body?.dofs.get('trunk_lat')?.effort ?? 0));

    for (const state of this.states.values()) {
      const { def, side } = state;
      let drive = 0;
      let because: MuscleState['because'] = null;
      let contraction: Contraction | null = null;
      let observed = false;
      if (def.region === 'face') {
        if (face) {
          observed = true;
          const { value, key } = def.bilateral ? faceDrive(face, def.face ?? {}, side) : faceDrive(face, def.face ?? {}, 'C');
          const other = !def.bilateral ? faceDrive(face, def.face ?? {}, 'L') : { value: 0, key: '' };
          const best = other.value > value ? other : { value, key };
          drive = Math.min(1, best.value);
          if (drive > 0.05) {
            because = { kind: 'face', text: `${best.key.replace(/([A-Z])/g, ' $1').toLowerCase()} (FACS ${def.facs})` };
            contraction = 'expression';
          }
        }
      } else {
        // Joint-driven actions.
        for (const [dofId, weight] of Object.entries(def.actions ?? {})) {
          if (!body) break;
          const lateral = 'lateral' in anatomy.dofs[dofId as DofId];
          const dof = dofOf(dofId, side === 'C' ? 'L' : side);
          if (!dof) continue;
          observed = true;
          // For side-bending, a muscle bends toward its own side: left = positive.
          const direction = lateral ? weight * (side === 'R' ? -1 : 1) : weight;
          if (Math.sign(direction) !== Math.sign(dof.effort)) continue;
          const value = Math.min(1, Math.abs(dof.effort) * Math.abs(direction));
          if (value > drive) {
            drive = value;
            because = { kind: 'joint', dof, share: Math.abs(direction) };
            const moving = dof.velocity * Math.sign(direction);
            contraction = Math.abs(dof.velocity) < 12 ? 'holding' : moving > 0 ? 'shortening' : 'lengthening';
          }
        }
        // Stabilising and synergist roles.
        if (body && def.assist && side !== 'C') {
          const sh = shoulderLoad(side);
          let value = 0, text = '';
          if (def.assist === 'scapular-upward-rotation') {
            value = sh.elevation * clamp01((sh.angle - 30) / 60);
            text = 'rotating the shoulder blade upward as the arm rises past 30° (scapulohumeral rhythm)';
          } else if (def.assist === 'scapular-elevation') {
            value = 0.6 * sh.elevation * clamp01((sh.angle - 30) / 60);
            text = 'lifting the shoulder blade as the arm rises';
          } else if (def.assist === 'scapular-stabiliser') {
            value = 0.5 * sh.load;
            text = 'holding the shoulder blade steady against the arm\'s load';
          } else if (def.assist === 'rotator-cuff') {
            value = 0.4 * sh.load;
            text = 'pressing the ball of the shoulder into its socket while the arm is loaded';
          } else if (def.assist === 'shoulder-stabiliser') {
            value = 0.2 * sh.load;
            text = 'steadying the collarbone while the arm is loaded';
          } else if (def.assist === 'core-brace') {
            value = 0.5 * trunkLoad();
            text = 'bracing the spine while the trunk is loaded';
          }
          observed = true;
          if (value > drive) {
            drive = value;
            because = { kind: 'assist', text };
            contraction = 'holding';
          }
        }
        // Hand-driven muscles.
        const rule = def.hand;
        if (rule && side !== 'C' && features[side]) {
          observed = true;
          const value = handDrive(rule, features[side]!);
          if (value > drive) {
            drive = value;
            because = { kind: 'hand', text: rule.replace(/-/g, ' ') };
            const v = features[side]!.fingerFlexVelocity;
            contraction = Math.abs(v) < 0.3 ? 'holding' : (rule.includes('extend') ? -v : v) > 0 ? 'shortening' : 'lengthening';
          }
        }
        if (def.region === 'hand' && !features[side as Side]) observed = false;
      }
      // Muscle activation dynamics: quick to switch on, slower to switch off.
      const tau = drive > state.activation ? ON : OFF;
      state.activation += (drive - state.activation) * (1 - Math.exp(-Math.max(0, dt) / tau));
      state.because = because;
      state.contraction = state.activation > 0.05 ? contraction : null;
      state.purpose = state.activation > 0.05 ? purposeOf(because, contraction) : null;
      state.observed = observed;
    }
    return this.all();
  }
}
