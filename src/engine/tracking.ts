import { FaceLandmarker, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url';
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url';
import { POSE, type P2, type Side } from './geometry';

const MODELS = 'https://storage.googleapis.com/mediapipe-models';
const URLS = {
  pose: `${MODELS}/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
  hand: `${MODELS}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
  face: `${MODELS}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
};

type L3 = { x: number; y: number; z: number; visibility?: number };
export type Frame = {
  /** Normalised image landmarks (0..1) and 3D world landmarks (metres). */
  pose: { image: L3[]; world: L3[] } | null;
  hands: Partial<Record<Side, { image: L3[]; world: L3[] }>>;
  face: { image: L3[]; blendshapes: Record<string, number> } | null;
};

async function create<T>(make: (delegate: 'GPU' | 'CPU') => Promise<T>): Promise<T> {
  try {
    return await make('GPU');
  } catch (error) {
    console.warn('GPU unavailable, using CPU', error);
    return make('CPU');
  }
}

export class Tracker {
  private pose?: PoseLandmarker;
  private hands?: HandLandmarker;
  private face?: FaceLandmarker;
  private last = -1;

  async load(options: { hands: boolean; face: boolean }) {
    const wasm = { wasmLoaderPath, wasmBinaryPath };
    this.pose ??= await create((delegate) => PoseLandmarker.createFromOptions(wasm, {
      baseOptions: { modelAssetPath: URLS.pose, delegate },
      runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
    }));
    if (options.hands) this.hands ??= await create((delegate) => HandLandmarker.createFromOptions(wasm, {
      baseOptions: { modelAssetPath: URLS.hand, delegate },
      runningMode: 'VIDEO', numHands: 2,
    }));
    if (options.face) this.face ??= await create((delegate) => FaceLandmarker.createFromOptions(wasm, {
      baseOptions: { modelAssetPath: URLS.face, delegate },
      runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
    }));
  }

  detect(source: HTMLVideoElement, options: { hands: boolean; face: boolean }): Frame {
    // Every task needs strictly increasing timestamps for its whole life, even when a video
    // loops or is seeked, so use the wall clock rather than the video's time.
    const t = Math.max(Math.round(performance.now()), this.last + 1);
    this.last = t;
    const frame: Frame = { pose: null, hands: {}, face: null };
    if (this.pose) {
      const r = this.pose.detectForVideo(source, t);
      if (r.landmarks[0] && r.worldLandmarks[0]) frame.pose = { image: r.landmarks[0], world: r.worldLandmarks[0] };
    }
    if (options.hands && this.hands && frame.pose) {
      const r = this.hands.detectForVideo(source, t);
      // Assign each hand to the body side whose wrist it is nearest (more reliable than the
      // hand model's own left/right label, which assumes a mirrored selfie image).
      r.landmarks.forEach((image, i) => {
        const wrist = image[0];
        const near = (s: Side) => Math.hypot(frame.pose!.image[POSE.wrist[s]].x - wrist.x, frame.pose!.image[POSE.wrist[s]].y - wrist.y);
        const side: Side = near('L') < near('R') ? 'L' : 'R';
        if (!frame.hands[side]) frame.hands[side] = { image, world: r.worldLandmarks[i] };
      });
    }
    if (options.face && this.face) {
      const r = this.face.detectForVideo(source, t);
      if (r.faceLandmarks[0]) {
        const blendshapes: Record<string, number> = {};
        for (const c of r.faceBlendshapes[0]?.categories ?? []) blendshapes[c.categoryName] = c.score;
        frame.face = { image: r.faceLandmarks[0], blendshapes };
      }
    }
    return frame;
  }

}

export const toPixels = (points: L3[], width: number, height: number): P2[] => points.map((p) => ({ x: p.x * width, y: p.y * height }));
