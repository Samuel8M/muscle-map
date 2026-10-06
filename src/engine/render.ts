import type { BodyState } from './body';
import { anchor, faceWidth, handSize, namedPoints, POSE, spindle, type AnchorContext, type P2, type Side } from './geometry';
import type { MuscleState } from './muscles';
import { toPixels, type Frame } from './tracking';

export type DrawOptions = { mirror: boolean; labels: boolean; hidden: boolean; selected: string | null };

const BONES: [number, number][] = [
  [11, 12], [11, 23], [12, 24], [23, 24], [11, 13], [13, 15], [12, 14], [14, 16],
  [23, 25], [25, 27], [24, 26], [26, 28], [27, 29], [29, 31], [27, 31], [28, 30], [30, 32], [28, 32],
];

/** Colour for an effort level: cool blue at rest through to red at full effort. */
export const effortColour = (a: number, alpha = 1) => `hsla(${Math.round(215 - 215 * Math.min(1, a))}, 85%, ${50 + 5 * (1 - a)}%, ${alpha})`;

/** Draws the muscles over the video; returns their outlines for tapping. */
export function drawMuscles(ctx: CanvasRenderingContext2D, frame: Frame, body: BodyState | null, muscles: MuscleState[], width: number, height: number, options: DrawOptions) {
  ctx.clearRect(0, 0, width, height);
  const hits = new Map<string, Path2D>();
  if (!frame.pose) return hits;
  const flip = (points: P2[]) => (options.mirror ? points.map((p) => ({ x: width - p.x, y: p.y })) : points);
  const pose = flip(toPixels(frame.pose.image, width, height));
  const hands: Partial<Record<Side, P2[]>> = {};
  for (const s of ['L', 'R'] as Side[]) if (frame.hands[s]) hands[s] = flip(toPixels(frame.hands[s]!.image, width, height));
  const face = frame.face ? flip(toPixels(frame.face.image, width, height)) : undefined;
  // Size unit: shoulder width, but never less than ¾ of the torso length (side-on, the
  // shoulders overlap and their width collapses).
  const torso = Math.hypot((pose[11].x + pose[12].x - pose[23].x - pose[24].x) / 2, (pose[11].y + pose[12].y - pose[23].y - pose[24].y) / 2);
  const scale = Math.max(Math.hypot(pose[11].x - pose[12].x, pose[11].y - pose[12].y), torso * 0.75) || 60;
  const centre = { x: (pose[11].x + pose[12].x + pose[23].x + pose[24].x) / 4, y: (pose[11].y + pose[12].y + pose[23].y + pose[24].y) / 4 };
  const contexts: Record<Side, AnchorContext> = {
    L: { points: namedPoints(pose, 'L'), scale, centre, hand: hands.L, face, side: 'L' },
    R: { points: namedPoints(pose, 'R'), scale, centre, hand: hands.R, face, side: 'R' },
  };
  const facing = body?.facing ?? 'front';

  // Faint skeleton for orientation.
  ctx.lineWidth = Math.max(1.5, scale * 0.012);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  for (const [a, b] of BONES) {
    const visible = (frame.pose.image[a].visibility ?? 1) > 0.4 && (frame.pose.image[b].visibility ?? 1) > 0.4;
    if (!visible) continue;
    ctx.beginPath();
    ctx.moveTo(pose[a].x, pose[a].y);
    ctx.lineTo(pose[b].x, pose[b].y);
    ctx.stroke();
  }

  type Item = { m: MuscleState; path: Path2D; mid: P2; visible: boolean; deep: boolean };
  const items: Item[] = [];
  for (const m of muscles) {
    const def = m.def as MuscleState['def'] & { draw: { a: string | number[]; b: string | number[]; w: number } };
    const side: Side = m.side === 'C' ? 'R' : m.side;
    const ctxSide = contexts[side];
    if (def.region === 'face' && !face) continue;
    const usesHand = typeof def.draw.a === 'string' && def.draw.a.startsWith('h:');
    if (usesHand && !hands[side]) continue;
    // Skip limbs the pose model can barely see.
    const limb = { arm: POSE.wrist[side], forearm: POSE.wrist[side], shoulder: POSE.elbow[side], thigh: POSE.knee[side], leg: POSE.ankle[side], hip: POSE.hip[side] } as Record<string, number>;
    const check = limb[def.region];
    if (check !== undefined && (frame.pose.image[check].visibility ?? 1) < 0.35) continue;
    const a = anchor(def.draw.a, ctxSide), b = anchor(def.draw.b, ctxSide);
    if (!a || !b) continue;
    const unit = def.region === 'face' ? faceWidth(face) : usesHand ? handSize(hands[side]) : scale;
    const path = spindle(a, b, def.draw.w * unit);
    const view = def.view;
    const visible = view === 'side' || facing === 'side' ? view !== 'deep' : (view === 'front') === (facing === 'front') && view !== 'deep';
    items.push({ m, path, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, visible, deep: view === 'deep' });
  }
  // Deep and far-side muscles first, then the visible ones, strongest on top.
  items.sort((x, y) => Number(x.visible) - Number(y.visible) || x.m.activation - y.m.activation);
  for (const item of items) {
    const { m, path, visible, deep } = item;
    if (!visible && !deep && !options.hidden) continue;
    const a = m.activation;
    const alpha = visible ? 0.16 + 0.62 * a : 0.06 + 0.3 * a;
    ctx.fillStyle = effortColour(a, alpha);
    ctx.fill(path);
    ctx.setLineDash(visible ? [] : [4, 3]);
    ctx.lineWidth = m.key === options.selected ? 3 : 1;
    ctx.strokeStyle = m.key === options.selected ? '#ffd84d' : `rgba(255,255,255,${visible ? 0.55 : 0.3})`;
    ctx.stroke(path);
    hits.set(m.key, path);
  }
  ctx.setLineDash([]);
  if (options.labels) {
    const top = items.filter((i) => i.visible || i.m.key === options.selected).filter((i) => i.m.activation > 0.2 || i.m.key === options.selected).sort((x, y) => y.m.activation - x.m.activation).slice(0, 6);
    ctx.font = `600 ${Math.max(11, Math.round(scale * 0.075))}px "DM Sans", system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    const placed: { x: number; y: number; w: number; h: number }[] = [];
    const h = Math.max(18, Math.round(scale * 0.11));
    for (const { m, mid } of top) {
      const text = `${m.def.name}${m.side === 'C' ? '' : ` ${m.side}`} ${Math.round(m.activation * 100)}%`;
      const w = ctx.measureText(text).width + 10;
      // Nudge down until it no longer overlaps an earlier label (give up after a few tries).
      let box = { x: mid.x - w / 2, y: mid.y - h / 2, w, h };
      for (let tries = 0; tries < 6 && placed.some((p) => box.x < p.x + p.w && p.x < box.x + box.w && box.y < p.y + p.h && p.y < box.y + box.h); tries += 1) box = { ...box, y: box.y + h + 2 };
      if (placed.some((p) => box.x < p.x + p.w && p.x < box.x + box.w && box.y < p.y + p.h && p.y < box.y + box.h)) continue;
      placed.push(box);
      ctx.fillStyle = 'rgba(20,24,20,0.78)';
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, box.x + 5, box.y + box.h / 2);
    }
  }
  return hits;
}
