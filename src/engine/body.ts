import anatomy from '../data/anatomy.json';
import { POSE, type Side } from './geometry';

/*
 * Physics of the body from 3D pose (MediaPipe world landmarks: metres, origin between the hips,
 * y pointing down). Each frame:
 *  1. Kinematics: joint angles in anatomical planes, and their velocities and accelerations.
 *  2. Statics + dynamics: the torque the muscles at each joint must produce, by inverse
 *     dynamics on a segment model (Winter, 2009 segment masses):
 *       τ_muscle = −[ Σ_distal (c_i − p_joint) × m_i·g  +  Σ_contacts (r_c − p_joint) × F_c ] · axis  +  I·α
 *     where contacts are the hands/feet bearing weight, sharing F = m_body·g so that the centre
 *     of pressure lies under the centre of mass (quasi-static balance).
 *  3. Effort: τ divided by a typical maximum voluntary torque for that joint and direction.
 */

export type V3 = [number, number, number];
export type DofId = keyof typeof anatomy.dofs;
export type DofState = {
  id: DofId;
  side: Side | 'C';
  angle: number; // degrees
  velocity: number; // degrees per second
  torque: number; // N·m the muscles must produce, positive = DOF's positive direction
  effort: number; // torque ÷ typical max in that direction, signed
  lever?: { mass: number; distance: number }; // for explanations: load and its horizontal lever
  supported: boolean; // a hand/foot beyond this joint is bearing weight
  reliable: boolean; // false for side-to-side estimates when the camera sees the body side-on
};
export type BodyState = {
  time: number;
  dofs: Map<string, DofState>;
  contacts: { side: Side; part: 'foot' | 'hand'; share: number }[];
  com: V3;
  facing: 'front' | 'back' | 'side';
  airborne: boolean;
};

const G = 9.81;
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const unit = (a: V3): V3 => scale(a, 1 / (norm(a) || 1));
const lerp3 = (a: V3, b: V3, t: number): V3 => add(a, scale(sub(b, a), t));
const deg = (r: number) => (r * 180) / Math.PI;

/** Signed angle (degrees) from a to b about axis, measured in the plane perpendicular to it. */
function signedAngle(a: V3, b: V3, axis: V3) {
  const n = unit(axis);
  const pa = sub(a, scale(n, dot(a, n)));
  const pb = sub(b, scale(n, dot(b, n)));
  return deg(Math.atan2(dot(n, cross(pa, pb)), dot(pa, pb)));
}
const between = (a: V3, b: V3) => deg(Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))));

/** One Euro filter (Casiez et al., 2012): smooths jitter at rest without lagging fast motion. */
class OneEuro {
  private x?: number;
  private dx = 0;
  private t?: number;
  constructor(private minCutoff = 1.2, private beta = 0.02, private dCutoff = 1) {}
  filter(value: number, t: number) {
    if (this.t === undefined || this.x === undefined) {
      this.t = t;
      this.x = value;
      return value;
    }
    const dt = Math.max(1e-3, t - this.t);
    const alpha = (cutoff: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
    const dx = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff) * (value - this.x);
    this.t = t;
    return this.x;
  }
}

type Segment = { id: string; mass: number; com: V3; side?: Side };

/** Horizontal distance (m) from the centre of mass to the area the support points enclose (0 inside). */
function outsideSupport(points: V3[], com: V3) {
  const pts = points.map((p) => [p[0], p[2]] as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const turn = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list: [number, number][]) => {
    const out: [number, number][] = [];
    for (const p of list) {
      while (out.length >= 2 && turn(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  const hull = [...half(pts), ...half([...pts].reverse())];
  const c: [number, number] = [com[0], com[2]];
  if (hull.length >= 3 && hull.every((p, i) => turn(p, hull[(i + 1) % hull.length], c) >= 0)) return 0;
  let best = Infinity;
  const ring = hull.length ? hull : pts;
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ab = [b[0] - a[0], b[1] - a[1]];
    const t = Math.max(0, Math.min(1, ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1]) / ((ab[0] * ab[0] + ab[1] * ab[1]) || 1)));
    best = Math.min(best, Math.hypot(c[0] - (a[0] + ab[0] * t), c[1] - (a[1] + ab[1] * t)));
  }
  return best;
}

export class BodyTracker {
  private filters = new Map<string, OneEuro>();
  private history = new Map<string, { t: number; angle: number; velocity: number }>();
  private lowest: { t: number; y: number }[] = [];
  private liftFrames = 0;
  /** Weight the camera can't see: a barbell on the shoulders or weights in the hands. */
  extra: { kg: number; where: 'hands' | 'shoulders' } = { kg: 0, where: 'hands' };
  constructor(public bodyMass = 70) {}

  /** Forget motion history (after a video jumps or loops), so no false speeds appear. */
  reset() {
    this.filters.clear();
    this.history.clear();
    this.lowest = [];
    this.liftFrames = 0;
  }

  private smooth(key: string, value: number, t: number) {
    let f = this.filters.get(key);
    if (!f) {
      f = new OneEuro();
      this.filters.set(key, f);
    }
    return f.filter(value, t);
  }

  /** world: 33 MediaPipe world landmarks; image: 33 normalised image landmarks (for facing and lift-off). */
  update(world: { x: number; y: number; z: number }[], image: { x: number; y: number; visibility?: number }[], time: number): BodyState {
    const p = (i: number): V3 => [this.smooth(`${i}x`, world[i].x, time), this.smooth(`${i}y`, world[i].y, time), this.smooth(`${i}z`, world[i].z, time)];
    const pts = new Map<number, V3>();
    for (let i = 0; i < 33; i += 1) pts.set(i, p(i));
    const at = (name: Exclude<keyof typeof POSE, 'nose'>, s: Side) => pts.get(POSE[name][s])!;
    const midShoulder = lerp3(at('shoulder', 'L'), at('shoulder', 'R'), 0.5);
    const midHip = lerp3(at('hip', 'L'), at('hip', 'R'), 0.5);
    const midEar = lerp3(at('ear', 'L'), at('ear', 'R'), 0.5);

    // Anatomical frame, carried by the body so it stays right lying, planking or upside down:
    // "up" runs along the spine, "left" along the hip and shoulder lines, "forward" out of the
    // chest (the side the nose is on). Gravity alone stays world-vertical.
    const up = unit(sub(midShoulder, midHip));
    const down = scale(up, -1);
    const across = add(sub(at('shoulder', 'L'), at('shoulder', 'R')), sub(at('hip', 'L'), at('hip', 'R')));
    const left = unit(sub(across, scale(up, dot(across, up))));
    let forward = unit(cross(left, up));
    if (dot(sub(pts.get(POSE.nose)!, midEar), forward) < 0) forward = scale(forward, -1);
    const sagittal = unit(cross(down, forward)); // positive = flexing forward (hip, shoulder, elbow, ankle dorsiflexion)
    const trunkAxis = scale(sagittal, -1); // trunk/neck flexion: from up toward forward
    const abductAxis = (s: Side) => unit(cross(down, s === 'L' ? left : scale(left, -1)));
    const lateralAxis = unit(cross(up, left)); // bending toward the left is positive
    const worldUp: V3 = [0, -1, 0];

    // Segments with masses and centres of mass.
    const m = this.bodyMass;
    const segs: Segment[] = [
      { id: 'head', mass: 0.081 * m, com: midEar },
      { id: 'trunk', mass: 0.497 * m, com: lerp3(midShoulder, midHip, 0.5) },
    ];
    for (const s of ['L', 'R'] as Side[]) {
      const handTip = lerp3(at('index', s), at('pinky', s), 0.5);
      segs.push(
        { id: 'upperArm', side: s, mass: 0.028 * m, com: lerp3(at('shoulder', s), at('elbow', s), 0.436) },
        { id: 'forearm', side: s, mass: 0.016 * m, com: lerp3(at('elbow', s), at('wrist', s), 0.43) },
        { id: 'hand', side: s, mass: 0.006 * m, com: lerp3(at('wrist', s), handTip, 0.506) },
        { id: 'thigh', side: s, mass: 0.1 * m, com: lerp3(at('hip', s), at('knee', s), 0.433) },
        { id: 'shank', side: s, mass: 0.0465 * m, com: lerp3(at('knee', s), at('ankle', s), 0.433) },
        { id: 'foot', side: s, mass: 0.0145 * m, com: lerp3(at('heel', s), at('toe', s), 0.5) },
      );
    }
    // Extra load: in each hand (moves with the arms) or across the shoulders (with the trunk).
    if (this.extra.kg > 0) {
      if (this.extra.where === 'shoulders') segs.push({ id: 'load', mass: this.extra.kg, com: midShoulder });
      else for (const s of ['L', 'R'] as Side[]) segs.push({ id: 'load', side: s, mass: this.extra.kg / 2, com: lerp3(at('wrist', s), lerp3(at('index', s), at('pinky', s), 0.5), 0.5) });
    }
    const totalMass = segs.reduce((sum, seg) => sum + seg.mass, 0);
    const com = scale(segs.reduce((acc, seg) => add(acc, scale(seg.com, seg.mass)), [0, 0, 0] as V3), 1 / totalMass);

    // Contacts: the lowest hands/feet bear the weight, unless the body has left the ground.
    // Two independent checks, because a horizontal body (push-up, plank) confuses 3D height:
    // low in 3D, or level with the floor line in the image itself.
    const candidates: { side: Side; part: 'foot' | 'hand'; point: V3; imageY: number }[] = [];
    for (const s of ['L', 'R'] as Side[]) {
      const footIdx = [POSE.heel[s], POSE.toe[s], POSE.ankle[s]];
      const handIdx = [POSE.wrist[s], POSE.index[s], POSE.pinky[s]];
      for (const [part, idx] of [['foot', footIdx], ['hand', handIdx]] as const) {
        const lowest = idx.reduce((a, b) => (pts.get(b)![1] > pts.get(a)![1] ? b : a));
        candidates.push({ side: s, part, point: pts.get(lowest)!, imageY: Math.max(...idx.map((i) => image[i].y)) });
      }
    }
    const floor = Math.max(...candidates.map((c) => c.point[1]));
    const imageFloor = Math.max(...candidates.map((c) => c.imageY));
    const height = norm(sub(midEar, lerp3(at('ankle', 'L'), at('ankle', 'R'), 0.5))) || 1.5;
    const imageBody = Math.hypot(image[POSE.nose].x - (image[POSE.ankle.L].x + image[POSE.ankle.R].x) / 2, image[POSE.nose].y - (image[POSE.ankle.L].y + image[POSE.ankle.R].y) / 2) || 0.5;
    const onFloor = candidates.filter((c) => floor - c.point[1] < Math.max(0.05, height * 0.035) || imageFloor - c.imageY < imageBody * 0.05);
    // Lift-off: the lowest point in the image rose well above where it has recently been,
    // for several frames in a row (one jittery frame is not a jump).
    this.lowest = [...this.lowest.filter((x) => time - x.t < 1), { t: time, y: imageFloor }];
    this.liftFrames = Math.max(...this.lowest.map((x) => x.y)) - imageFloor > imageBody * 0.06 ? this.liftFrames + 1 : 0;
    const airborne = this.liftFrames >= 3;
    // Balance: a body at rest has its centre of mass over its supports. If it is well outside
    // what the feet cover, the feet alone would let it topple, so something else holds it up:
    // hands below the shoulders are bearing weight (e.g. push-ups with hands on a bench).
    if (!airborne && onFloor.length && onFloor.every((c) => c.part === 'foot')) {
      const base = onFloor.flatMap((c) => [at('heel', c.side), at('toe', c.side)]);
      if (outsideSupport(base, com) > 0.15) {
        for (const c of candidates) {
          const shoulderY = at('shoulder', c.side)[1];
          if (c.part === 'hand' && c.point[1] > shoulderY + 0.05 && !onFloor.includes(c)) onFloor.push(c);
        }
      }
    }
    const contacts = airborne ? [] : onFloor;
    // Where each support pushes: for a foot, the point where the balance line (straight down
    // from the centre of mass) meets it, kept between heel and toe; a hand pushes through its
    // lowest point.
    const flat = (v: V3): V3 => [v[0], 0, v[2]];
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    const pressurePoint = (c: (typeof contacts)[number]): V3 => {
      if (c.part === 'hand') return c.point;
      const heel = at('heel', c.side), toe = at('toe', c.side);
      const along = flat(sub(toe, heel));
      const t = clamp01(dot(sub(flat(com), flat(heel)), along) / (dot(along, along) || 1));
      const p = lerp3(heel, toe, t);
      return [p[0], Math.max(heel[1], toe[1]), p[2]];
    };
    const points = contacts.map(pressurePoint);
    // Sharing the weight: with two supports statics has an exact answer (the lever rule along
    // the line between them puts the centre of pressure under the centre of mass); with more,
    // nearer supports carry more.
    let shares: number[];
    // Facing decides which estimates the camera can actually see. Side-on, the two feet sit one
    // behind the other in depth (the least reliable axis), so two feet share the weight evenly.
    const dxFacing = image[POSE.shoulder.L].x - image[POSE.shoulder.R].x;
    const torsoFacing = Math.hypot(image[POSE.shoulder.L].x - image[POSE.hip.L].x, image[POSE.shoulder.L].y - image[POSE.hip.L].y) || 0.3;
    const sideOn = Math.abs(dxFacing) < torsoFacing * 0.3;
    if (points.length === 2 && sideOn && contacts.every((c) => c.part === 'foot')) {
      shares = [0.5, 0.5];
    } else if (points.length === 2) {
      const span = flat(sub(points[1], points[0]));
      const t = clamp01(dot(sub(flat(com), flat(points[0])), span) / (dot(span, span) || 1));
      shares = [1 - t, t];
    } else {
      const w = points.map((p) => 1 / (Math.hypot(p[0] - com[0], p[2] - com[2]) + 0.03));
      const total = w.reduce((a, b) => a + b, 0) || 1;
      shares = w.map((x) => x / total);
    }
    const loads = contacts.map((c, i) => ({ ...c, point: points[i], share: shares[i], force: [0, -totalMass * G * shares[i], 0] as V3 }));
    // Facing decides which estimates the camera can actually see: side-on, side-to-side motion
    // depends on depth guesses.
    const dx = image[POSE.shoulder.L].x - image[POSE.shoulder.R].x;
    const torsoLength = Math.hypot(image[POSE.shoulder.L].x - image[POSE.hip.L].x, image[POSE.shoulder.L].y - image[POSE.hip.L].y) || 0.3;
    const facing: BodyState['facing'] = Math.abs(dx) < torsoLength * 0.3 ? 'side' : dx > 0 ? 'front' : 'back';
    const asinDeg = (v: number) => deg(Math.asin(Math.max(-1, Math.min(1, v))));

    const dofs = new Map<string, DofState>();
    const record = (id: DofId, side: Side | 'C', angle: number, joint: V3, axis: V3, distal: Segment[], contactsBeyond: typeof loads, frontal = false) => {
      const key = side === 'C' ? id : `${id}_${side}`;
      const a = this.smooth(`${key}:angle`, angle, time);
      const last = this.history.get(key);
      const prev = last && time > last.t && time - last.t < 0.5 ? last : undefined;
      const dt = prev ? Math.max(1e-3, time - prev.t) : 0;
      const velocity = prev ? this.smooth(`${key}:vel`, (a - prev.angle) / dt, time) : 0;
      const acceleration = prev && dt ? this.smooth(`${key}:acc`, (velocity - prev.velocity) / dt, time) : 0;
      this.history.set(key, { t: time, angle: a, velocity });
      const n = unit(axis);
      // External moment about the joint from gravity on the distal segments and from the ground.
      let moment: V3 = [0, 0, 0];
      let leverMass = 0, leverWeighted = 0;
      for (const seg of distal) {
        const r = sub(seg.com, joint);
        moment = add(moment, cross(r, [0, seg.mass * G, 0]));
        leverMass += seg.mass;
        leverWeighted += seg.mass * Math.hypot(r[0], r[2]);
      }
      for (const c of contactsBeyond) moment = add(moment, cross(sub(c.point, joint), c.force));
      let torque = -dot(moment, n);
      // Moving limbs (nothing beyond the joint on the ground) also need torque to accelerate.
      if (!contactsBeyond.length) {
        const inertia = distal.reduce((sum, seg) => {
          const r = sub(seg.com, joint);
          const along = dot(r, n);
          return sum + seg.mass * (dot(r, r) - along * along);
        }, 0);
        torque += inertia * ((acceleration * Math.PI) / 180);
      }
      const [maxPos, maxNeg] = anatomy.dofs[id].max as [number, number];
      // Side-on, side-to-side torques rest on depth guesses: report them at reduced weight.
      const reliable = !(frontal && facing === 'side');
      const effort = (torque >= 0 ? torque / maxPos : torque / maxNeg) * (reliable ? 1 : 0.35);
      dofs.set(key, {
        id, side, angle: a, velocity, torque, effort, supported: contactsBeyond.length > 0, reliable,
        lever: leverMass ? { mass: leverMass, distance: leverWeighted / leverMass } : undefined,
      });
    };

    const sideSegs = (s: Side, ids: string[]) => segs.filter((seg) => seg.side === s && ids.includes(seg.id));
    const upperBody = segs.filter((seg) => ['head', 'trunk', 'upperArm', 'forearm', 'hand', 'load'].includes(seg.id));
    const trunkVec = sub(midShoulder, midHip);
    const trunkDown = scale(trunkVec, -1);
    record('trunk_flex', 'C', signedAngle(worldUp, trunkVec, trunkAxis), midHip, trunkAxis, upperBody, loads.filter((c) => c.part === 'hand'));
    const trunkSide = signedAngle(worldUp, trunkVec, lateralAxis);
    record('trunk_lat', 'C', trunkSide, midHip, lateralAxis, upperBody, loads.filter((c) => c.part === 'hand'), true);
    const neckVec = sub(midEar, midShoulder);
    const head = segs.filter((seg) => seg.id === 'head');
    record('neck_flex', 'C', signedAngle(trunkVec, neckVec, trunkAxis), midShoulder, trunkAxis, head, []);
    record('neck_lat', 'C', asinDeg(dot(unit(neckVec), left)), midShoulder, lateralAxis, head, [], true);
    for (const s of ['L', 'R'] as Side[]) {
      const armLoads = loads.filter((c) => c.part === 'hand' && c.side === s);
      const legLoads = loads.filter((c) => c.part === 'foot' && c.side === s);
      const arm = sub(at('elbow', s), at('shoulder', s));
      record('shoulder_flex', s, signedAngle(trunkDown, arm, sagittal), at('shoulder', s), sagittal, sideSegs(s, ['upperArm', 'forearm', 'hand', 'load']), armLoads);
      const outward = s === 'L' ? left : scale(left, -1);
      record('shoulder_abd', s, asinDeg(dot(unit(arm), outward)), at('shoulder', s), abductAxis(s), sideSegs(s, ['upperArm', 'forearm', 'hand', 'load']), armLoads, true);
      record('elbow_flex', s, 180 - between(sub(at('shoulder', s), at('elbow', s)), sub(at('wrist', s), at('elbow', s))), at('elbow', s), sagittal, sideSegs(s, ['forearm', 'hand', 'load']), armLoads);
      const thigh = sub(at('knee', s), at('hip', s));
      record('hip_flex', s, signedAngle(trunkDown, thigh, sagittal), at('hip', s), sagittal, sideSegs(s, ['thigh', 'shank', 'foot']), legLoads);
      record('hip_abd', s, asinDeg(dot(unit(thigh), outward)), at('hip', s), abductAxis(s), sideSegs(s, ['thigh', 'shank', 'foot']), legLoads, true);
      record('knee_flex', s, 180 - between(sub(at('hip', s), at('knee', s)), sub(at('ankle', s), at('knee', s))), at('knee', s), scale(sagittal, -1), sideSegs(s, ['shank', 'foot']), legLoads);
      record('ankle_df', s, 90 - between(sub(at('knee', s), at('ankle', s)), sub(at('toe', s), at('heel', s))), at('ankle', s), sagittal, sideSegs(s, ['foot']), legLoads);
    }

    return { time, dofs, contacts: loads.map(({ side, part, share }) => ({ side, part, share })), com, facing, airborne };
  }
}
