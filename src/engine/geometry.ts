/*
 * Body geometry on screen: named points derived from the tracked landmarks, and the small
 * anchor language the anatomy table uses to say where each muscle runs.
 *
 *   "hip>knee@0.3+0.1"  = 30% of the way from hip to knee, pushed 0.1 shoulder-widths outward
 *   "h:5"              = hand landmark 5 (same side's hand)
 *   [61, 291]          = face-mesh point (subject's right, subject's left)
 */

export type P2 = { x: number; y: number };
export type Side = 'L' | 'R';

// MediaPipe pose landmark indices (subject's left / right).
export const POSE = {
  nose: 0,
  ear: { L: 7, R: 8 }, shoulder: { L: 11, R: 12 }, elbow: { L: 13, R: 14 }, wrist: { L: 15, R: 16 },
  pinky: { L: 17, R: 18 }, index: { L: 19, R: 20 }, thumb: { L: 21, R: 22 },
  hip: { L: 23, R: 24 }, knee: { L: 25, R: 26 }, ankle: { L: 27, R: 28 }, heel: { L: 29, R: 30 }, toe: { L: 31, R: 32 },
} as const;
type SidedName = Exclude<keyof typeof POSE, 'nose'>;

const lerp = (a: P2, b: P2, t: number): P2 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const mid = (a: P2, b: P2) => lerp(a, b, 0.5);

/** Every named point, for one side of the body, from 2D pose landmarks (pixels). */
export function namedPoints(pose: P2[], side: Side): Record<string, P2> {
  const other: Side = side === 'L' ? 'R' : 'L';
  const at = (name: SidedName, s: Side = side) => pose[POSE[name][s]];
  const shoulder = at('shoulder'), hip = at('hip');
  const midShoulder = mid(at('shoulder', 'L'), at('shoulder', 'R'));
  const midHip = mid(at('hip', 'L'), at('hip', 'R'));
  const midEar = mid(at('ear', 'L'), at('ear', 'R'));
  const shoulderMed = lerp(shoulder, midShoulder, 0.5);
  const hipMed = lerp(hip, midHip, 0.5);
  const torso = (t: number, towardMid: number) => lerp(lerp(shoulder, midShoulder, towardMid), lerp(hip, midHip, towardMid), t);
  const points: Record<string, P2> = {
    nose: pose[POSE.nose], midShoulder, midHip, midEar,
    neckBase: lerp(midShoulder, midEar, 0.12),
    occiput: lerp(midShoulder, midEar, 0.8),
    sternTop: lerp(midShoulder, midHip, 0.05),
    xiphoid: lerp(midShoulder, midHip, 0.4),
    navel: lerp(midShoulder, midHip, 0.72),
    pubis: lerp(midShoulder, midHip, 1.05),
    thoracicHigh: lerp(midShoulder, midHip, 0.12),
    thoracic: lerp(midShoulder, midHip, 0.4),
    lumbar: lerp(midShoulder, midHip, 0.8),
    sacrum: lerp(midShoulder, midHip, 0.97),
    acromion: lerp(shoulder, midShoulder, 0.08),
    clavMid: lerp(shoulder, midShoulder, 0.5),
    scapSup: lerp(shoulderMed, hipMed, 0.04),
    scapMed: torso(0.18, 0.6),
    scapInf: torso(0.32, 0.45),
    chestLat: torso(0.28, 0.05),
    ribLow: torso(0.6, 0.05),
    iliacCrest: lerp(hip, shoulder, 0.12),
    asis: lerp(lerp(hip, midHip, 0.25), shoulder, 0.07),
    ischium: lerp(lerp(hip, midHip, 0.45), at('knee'), 0.08),
    trochanter: lerp(hip, at('knee'), 0.08),
    handTip: mid(at('index'), at('pinky')),
  };
  for (const name of Object.keys(POSE) as (keyof typeof POSE)[]) {
    if (name === 'nose') continue;
    points[name] = at(name as SidedName);
    points[`~${name}`] = at(name as SidedName, other);
  }
  // Push iliac crest and trochanter outward a little from the midline.
  const out = unit({ x: shoulder.x - midShoulder.x, y: shoulder.y - midShoulder.y });
  const width = distance(at('shoulder', 'L'), at('shoulder', 'R'));
  points.iliacCrest = { x: points.iliacCrest.x + out.x * width * 0.08, y: points.iliacCrest.y + out.y * width * 0.08 };
  points.trochanter = { x: points.trochanter.x + out.x * width * 0.1, y: points.trochanter.y + out.y * width * 0.1 };
  return points;
}

export const distance = (a: P2, b: P2) => Math.hypot(a.x - b.x, a.y - b.y);
export const unit = (v: P2) => {
  const n = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / n, y: v.y / n };
};

export type AnchorContext = {
  points: Record<string, P2>;
  /** Shoulder width in pixels: the unit for offsets and muscle widths. */
  scale: number;
  /** Body centre line point, to know which way is "outward". */
  centre: P2;
  hand?: P2[];
  face?: P2[];
  side: Side;
};

/** Resolves one anchor; returns null when a point it needs isn't tracked. */
export function anchor(spec: string | number[], ctx: AnchorContext): P2 | null {
  if (Array.isArray(spec)) {
    const index = ctx.side === 'R' ? spec[0] : spec[1];
    return ctx.face?.[index] ?? null;
  }
  const match = spec.match(/^([^>+@-]+)(?:>([^@]+)@(-?[\d.]+))?([+-][\d.]+)?$/);
  if (!match) return null;
  const [, first, second, t, offset] = match;
  const resolve = (name: string): P2 | null => {
    if (name.startsWith('h:')) return ctx.hand?.[Number(name.slice(2))] ?? null;
    return ctx.points[name] ?? null;
  };
  const a = resolve(first);
  if (!a) return null;
  let p = a;
  let along: P2 | null = null;
  if (second) {
    const b = resolve(second);
    if (!b) return null;
    p = lerp(a, b, Number(t));
    along = { x: b.x - a.x, y: b.y - a.y };
  }
  if (offset) {
    const amount = Number(offset) * (first.startsWith('h:') ? handSize(ctx.hand) : ctx.scale);
    // Outward: perpendicular to the segment, on the side away from the body's centre line.
    let dir = along ? unit({ x: -along.y, y: along.x }) : unit({ x: p.x - ctx.centre.x, y: p.y - ctx.centre.y });
    if ((p.x - ctx.centre.x) * dir.x + (p.y - ctx.centre.y) * dir.y < 0) dir = { x: -dir.x, y: -dir.y };
    p = { x: p.x + dir.x * amount, y: p.y + dir.y * amount };
  }
  return p;
}

export const handSize = (hand?: P2[]) => (hand ? distance(hand[0], hand[9]) : 1);
export const faceWidth = (face?: P2[]) => (face ? distance(face[234], face[454]) : 1);

/** A spindle (muscle-belly) outline from a to b with the given half-width. */
export function spindle(a: P2, b: P2, halfWidth: number): Path2D {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length, ny = dx / length;
  const w = Math.min(halfWidth, length * 0.45);
  const c1 = { x: a.x + dx * 0.45, y: a.y + dy * 0.45 };
  const path = new Path2D();
  path.moveTo(a.x, a.y);
  path.quadraticCurveTo(c1.x + nx * w * 2, c1.y + ny * w * 2, b.x, b.y);
  path.quadraticCurveTo(c1.x - nx * w * 2, c1.y - ny * w * 2, a.x, a.y);
  path.closePath();
  return path;
}
