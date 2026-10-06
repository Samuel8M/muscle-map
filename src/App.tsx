import { Activity, Brain, Camera, Circle, Film, LoaderCircle, LockKeyhole, Pause, Play, Square, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import anatomy from './data/anatomy.json';
import { BodyTracker, type BodyState, type DofId, type DofState } from './engine/body';
import { dream, forget, learn, loadMemory, recognise, sampleOf, type Memory, type Sample } from './engine/memory';
import { MUSCLES, MuscleModel, purposeLabel, type MuscleState } from './engine/muscles';
import { drawMuscles, effortColour } from './engine/render';
import { Tracker, type Frame } from './engine/tracking';
import type { Side } from './engine/geometry';

type Source = 'camera' | 'video';
type Snapshot = { working: MuscleState[]; selected: MuscleState | null; body: BodyState | null; fps: number; tracked: boolean; hands: number; face: boolean };

const DEFS = new Map(MUSCLES.map((m) => [m.id, m]));
const CONTRACTION: Record<string, string> = {
  shortening: 'Shortening (concentric)',
  lengthening: 'Lengthening under load (eccentric)',
  holding: 'Holding still (isometric)',
  expression: 'Facial expression',
};
const sideName = (s: Side | 'C') => (s === 'L' ? 'left' : s === 'R' ? 'right' : '');
const dofLabel = (id: string) => {
  const d = anatomy.dofs[id as DofId];
  return d ? d.joint.charAt(0).toUpperCase() + d.joint.slice(1) : id;
};

function explainWhy(m: MuscleState, body: BodyState | null): string {
  const b = m.because;
  if (!m.observed) return 'The part of the body this muscle moves is not visible to the camera right now.';
  if (!b || m.activation < 0.05) return 'Resting: nothing it does is needed right now.';
  if (b.kind === 'face') return `Driven by your expression: ${b.text}.`;
  if (b.kind === 'hand') return `Read from your hand shape (${b.text}).`;
  if (b.kind === 'assist') return `Working as a helper: ${b.text}.`;
  const d = b.dof;
  const def = anatomy.dofs[d.id];
  const direction = d.torque >= 0 ? def.pos : def.neg;
  const where = `${sideName(d.side)} ${def.joint}`.trim();
  const load = d.supported
    ? `Your weight comes up through your ${d.side === 'C' ? 'hands' : 'limb'} from the ground`
    : d.lever ? `Gravity pulls on about ${d.lever.mass.toFixed(1)} kg of body, on average ${(d.lever.distance * 100).toFixed(0)} cm out from your ${where}` : 'Gravity and motion load the joint';
  return `${load}. Holding that needs ${Math.abs(d.torque).toFixed(1)} N·m of ${direction} at the ${where}: about ${Math.round(Math.abs(d.effort) * 100)}% of a typical maximum. All muscles that produce ${direction} there share it${b.share < 1 ? '; this one helps partly' : ''}.`;
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const tracker = useRef(new Tracker());
  const bodyTracker = useRef(new BodyTracker(70));
  const model = useRef(new MuscleModel());
  const hits = useRef(new Map<string, Path2D>());
  const samples = useRef<Sample[]>([]);
  const recording = useRef<Sample[] | null>(null);
  const settings = useRef({ hands: true, face: true, labels: true, hidden: false, mirror: false });
  const selectedRef = useRef<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'running' | 'error'>('idle');
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [options, setOptions] = useState({ hands: true, face: true, labels: true, hidden: false });
  const [bodyMass, setBodyMass] = useState(70);
  const [extra, setExtra] = useState<{ kg: number; where: 'hands' | 'shoulders' }>({ kg: 0, where: 'hands' });
  const [selected, setSelected] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot>({ working: [], selected: null, body: null, fps: 0, tracked: false, hands: 0, face: false });
  const [memory, setMemory] = useState<Memory>(loadMemory);
  const [recognised, setRecognised] = useState<{ name: string; score: number } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingName, setPendingName] = useState<Sample[] | null>(null);
  const [movementName, setMovementName] = useState('');
  const [note, setNote] = useState('');
  const memoryRef = useRef(memory);
  useEffect(() => { memoryRef.current = memory; }, [memory]);

  useEffect(() => { settings.current = { ...settings.current, ...options }; }, [options]);
  useEffect(() => { bodyTracker.current.bodyMass = bodyMass; }, [bodyMass]);
  useEffect(() => { bodyTracker.current.extra = extra; }, [extra]);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Dream (consolidate new movement memories) whenever there are new ones and the device is idle.
  const unconsolidated = memory.episodes.filter((e) => !e.consolidated).length;
  useEffect(() => {
    if (!unconsolidated) return;
    const run = () => setMemory((current) => dream(current));
    if ('requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(run, { timeout: 5000 });
      return () => window.cancelIdleCallback(handle);
    }
    const handle = setTimeout(run, 2000);
    return () => clearTimeout(handle);
  }, [unconsolidated]);

  // The processing loop: track, compute physics and muscles, draw.
  useEffect(() => {
    if (status !== 'running') return;
    let stopped = false;
    let lastTime = -1, lastUi = 0, lastRecognise = 0, frames = 0, fpsStart = performance.now(), fps = 0;
    let lastFrame: Frame | null = null;
    const video = videoRef.current!;
    const step = () => {
      if (stopped) return;
      const canvas = canvasRef.current;
      if (canvas && video.readyState >= 2 && video.videoWidth) {
        const t = source === 'video' ? video.currentTime : performance.now() / 1000;
        if (t !== lastTime) {
          const dt = lastTime < 0 ? 0 : Math.max(0, t - lastTime);
          lastTime = t;
          if (canvas.width !== video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; }
          const s = settings.current;
          const frame = tracker.current.detect(video, s);
          // Hands far from the camera are too small to read finger shapes reliably.
          for (const side of ['L', 'R'] as Side[]) {
            const h = frame.hands[side];
            if (h && Math.hypot((h.image[0].x - h.image[9].x) * canvas.width, (h.image[0].y - h.image[9].y) * canvas.height) < 40) delete frame.hands[side];
          }
          lastFrame = frame;
          const body = frame.pose ? bodyTracker.current.update(frame.pose.world, frame.pose.image, t) : null;
          const handsWorld: Partial<Record<Side, { x: number; y: number; z: number }[]>> = {};
          for (const side of ['L', 'R'] as Side[]) if (frame.hands[side]) handsWorld[side] = frame.hands[side]!.world;
          const muscles = model.current.update(body, handsWorld, frame.face?.blendshapes ?? null, dt);
          hits.current = drawMuscles(canvas.getContext('2d')!, frame, body, muscles, canvas.width, canvas.height, { mirror: s.mirror, labels: s.labels, hidden: s.hidden, selected: selectedRef.current });
          if (body && frame.pose) {
            const img = frame.pose.image;
            const sample = sampleOf(body, muscles, (img[23].y + img[24].y) / 2, Math.abs((img[27].y + img[28].y) / 2 - img[0].y));
            samples.current = [...samples.current.filter((x) => t - x.t < 4 && x.t <= t), sample];
            if (recording.current) {
              recording.current.push(sample);
              if (recording.current.length > 600) stopRecording();
            }
          }
          frames += 1;
          const now = performance.now();
          if (now - fpsStart > 1000) { fps = (frames * 1000) / (now - fpsStart); frames = 0; fpsStart = now; }
          if (now - lastUi > 160) {
            lastUi = now;
            const working = muscles.filter((m) => m.activation > 0.08).sort((a, b) => b.activation - a.activation).slice(0, 12);
            const sel = selectedRef.current ? muscles.find((m) => m.key === selectedRef.current) ?? null : null;
            setSnapshot({ working: working.map((m) => ({ ...m })), selected: sel ? { ...sel } : null, body, fps, tracked: !!frame.pose, hands: Object.keys(frame.hands).length, face: !!frame.face });
          }
          if (now - lastRecognise > 1000 && !recording.current) {
            lastRecognise = now;
            setRecognised(recognise(memoryRef.current, samples.current));
          }
        }
      }
      if ('requestVideoFrameCallback' in video) video.requestVideoFrameCallback(() => step());
      else requestAnimationFrame(step);
    };
    void lastFrame;
    step();
    const reset = () => { lastTime = -1; bodyTracker.current.reset(); };
    video.addEventListener('seeked', reset);
    return () => { stopped = true; video.removeEventListener('seeked', reset); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, source]);

  async function start(kind: Source, file?: File) {
    setError('');
    setStatus('loading');
    setSource(kind);
    setSelected(null);
    try {
      await tracker.current.load(settings.current);
      const video = videoRef.current!;
      video.srcObject = null;
      video.removeAttribute('src');
      if (kind === 'camera') {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser cannot use the camera here. Try Chrome or Safari over https.');
        video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        settings.current.mirror = true;
      } else if (file) {
        video.src = URL.createObjectURL(file);
        video.loop = true;
        settings.current.mirror = false;
      }
      video.muted = true;
      video.playsInline = true;
      await video.play();
      setPaused(false);
      setStatus('running');
    } catch (e) {
      console.error(e);
      setError(e instanceof Error && /Permission|NotAllowed/i.test(e.name + e.message) ? 'Camera permission was refused. Allow the camera in your browser settings and try again.' : e instanceof Error ? e.message : 'Could not start.');
      setStatus('error');
    }
  }

  function stop() {
    const video = videoRef.current!;
    (video.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    video.pause();
    video.srcObject = null;
    setStatus('idle');
    setSource(null);
  }

  function togglePause() {
    const video = videoRef.current!;
    if (video.paused) { void video.play(); setPaused(false); } else { video.pause(); setPaused(true); }
  }

  function onCanvasClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext('2d')!;
    const hit = [...hits.current.entries()].reverse().find(([, path]) => ctx.isPointInPath(path, x, y));
    setSelected(hit ? hit[0] : null);
  }

  function startRecording() {
    recording.current = [];
    setIsRecording(true);
    setNote('');
  }
  function stopRecording() {
    const recorded = recording.current;
    recording.current = null;
    setIsRecording(false);
    if (recorded && recorded.length > 8) setPendingName(recorded);
    else setNote('That was too short to remember. Record at least a second of movement.');
  }
  function saveMovement() {
    if (!pendingName || !movementName.trim()) return;
    const result = learn(memory, movementName.trim(), pendingName);
    setMemory(result.memory);
    setNote(result.note);
    setPendingName(null);
    setMovementName('');
  }

  const selectedDef = snapshot.selected?.def ?? (selected ? DEFS.get(selected.split(':')[0]) : undefined);
  const knownMovements = useMemo(() => {
    const names = new Map<string, number>();
    for (const g of memory.generalizations) for (const [n, c] of Object.entries(g.names)) names.set(n, (names.get(n) ?? 0) + c);
    for (const e of memory.episodes) if (!e.consolidated) names.set(e.name, (names.get(e.name) ?? 0) + 1);
    return [...names.entries()];
  }, [memory]);
  const body = snapshot.body;
  const weightControls = (
    <span className="weights">
      <label>Body weight <input type="number" min={20} max={250} value={bodyMass} onChange={(e) => setBodyMass(Number(e.target.value) || 70)} /> kg</label>
      <label>Extra weight <input type="number" min={0} max={400} value={extra.kg} onChange={(e) => setExtra({ ...extra, kg: Math.max(0, Number(e.target.value) || 0) })} /> kg</label>
      <select value={extra.where} onChange={(e) => setExtra({ ...extra, where: e.target.value as 'hands' | 'shoulders' })} aria-label="Where the extra weight is held">
        <option value="hands">in the hands</option>
        <option value="shoulders">on the shoulders (barbell)</option>
      </select>
    </span>
  );
  const contactText = !body ? '—' : body.airborne ? 'In the air' : body.contacts.length === 0 ? 'Not touching the ground' : body.contacts.map((c) => `${sideName(c.side)} ${c.part}`).join(', ');
  const jointRows = useMemo(() => {
    if (!body) return [];
    const order: DofId[] = ['neck_flex', 'trunk_flex', 'trunk_lat', 'shoulder_flex', 'shoulder_abd', 'elbow_flex', 'hip_flex', 'hip_abd', 'knee_flex', 'ankle_df'];
    return order.map((id) => {
      const d = anatomy.dofs[id];
      const get = (k: string) => body.dofs.get(k);
      const cells: (DofState | undefined)[] = 'sided' in d ? [get(`${id}_L`), get(`${id}_R`)] : [get(id)];
      return { id, label: `${dofLabel(id)} ${d.pos.replace('side bend to the left', 'side bend')}`, cells };
    });
  }, [body]);

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand"><span className="brand-mark"><Activity size={20} /></span>Muscle Map</span>
        <span className="private"><LockKeyhole size={15} />Video never leaves this device</span>
      </header>

      <main className="page">
        {status !== 'running' && (
          <section className="welcome">
            <h1>See every muscle<br /><em>as you move.</em></h1>
            <p className="lead">Point a camera at yourself or open a video. Muscle Map tracks your body, hands and face, works out the physics of every joint, and shows which muscles are working, how hard, and why.</p>
            <div className="start">
              <button className="button primary large" disabled={status === 'loading'} onClick={() => void start('camera')} type="button"><Camera size={20} />Use camera</button>
              <button className="button large" disabled={status === 'loading'} onClick={() => fileRef.current?.click()} type="button"><Film size={20} />Open a video</button>
            </div>
            <div className="settings">
              {weightControls}
              <label><input type="checkbox" checked={options.hands} onChange={(e) => setOptions({ ...options, hands: e.target.checked })} /> Track hands</label>
              <label><input type="checkbox" checked={options.face} onChange={(e) => setOptions({ ...options, face: e.target.checked })} /> Track face</label>
            </div>
            {status === 'loading' && <p className="loading"><LoaderCircle className="spin" size={18} />Loading the body, hand and face trackers…</p>}
            {error && <p className="problem">{error}</p>}
            <p className="tip">For the best results: whole body in view, camera level and upright, good light. The camera can't see weights you hold, so enter them above.</p>
          </section>
        )}

        <section className={status === 'running' ? 'workspace' : 'workspace hidden'}>
          <div className="stage-column">
            <div className="stage">
              <video ref={videoRef} className={settings.current.mirror ? 'mirror' : ''} playsInline muted />
              <canvas ref={canvasRef} onClick={onCanvasClick} />
              <div className="badges">
                <span>{snapshot.tracked ? `${Math.round(snapshot.fps)} fps` : 'Looking for a person…'}</span>
                {body && <span>Facing {body.facing === 'front' ? 'camera' : body.facing === 'back' ? 'away' : 'sideways'}</span>}
                {snapshot.hands > 0 && <span>{snapshot.hands} hand{snapshot.hands > 1 ? 's' : ''}</span>}
                {snapshot.face && <span>Face</span>}
                {recognised && <span className="recognised">Looks like: {recognised.name} ({Math.round(recognised.score * 100)}%)</span>}
              </div>
            </div>
            <div className="controls">
              {source === 'video' && <button className="button" onClick={togglePause} type="button">{paused ? <Play size={18} /> : <Pause size={18} />}{paused ? 'Play' : 'Pause'}</button>}
              <button className="button" onClick={stop} type="button"><X size={18} />Stop</button>
              {weightControls}
              <label className="toggle"><input type="checkbox" checked={options.labels} onChange={(e) => setOptions({ ...options, labels: e.target.checked })} /> Labels</label>
              <label className="toggle"><input type="checkbox" checked={options.hidden} onChange={(e) => setOptions({ ...options, hidden: e.target.checked })} /> Show muscles on the far side</label>
              <span className="legend"><i style={{ background: effortColour(0) }} />resting <i style={{ background: effortColour(0.5) }} />working <i style={{ background: effortColour(1) }} />maximum</span>
            </div>
            <p className="hint">Tap any muscle on the video to learn about it.</p>
          </div>

          <aside className="side">
            {selectedDef && (
              <section className="panel muscle-card">
                <div className="card-head">
                  <div>
                    <h2>{selectedDef.name}{snapshot.selected && snapshot.selected.side !== 'C' ? ` (${sideName(snapshot.selected.side)})` : ''}</h2>
                    <p className="group">{selectedDef.group}</p>
                  </div>
                  <button className="close" onClick={() => setSelected(null)} type="button" aria-label="Close"><X size={18} /></button>
                </div>
                {snapshot.selected && (
                  <div className="effort">
                    <div className="bar"><span style={{ width: `${Math.round(snapshot.selected.activation * 100)}%`, background: effortColour(snapshot.selected.activation) }} /></div>
                    <b>{Math.round(snapshot.selected.activation * 100)}%</b>
                    <span>{snapshot.selected.purpose ? <><b>Purpose:</b> {purposeLabel(snapshot.selected)} · <b>How:</b> {snapshot.selected.contraction ? CONTRACTION[snapshot.selected.contraction] : '—'}</> : 'Resting'}</span>
                  </div>
                )}
                {snapshot.selected && <p className="why">{explainWhy(snapshot.selected, body)}</p>}
                <dl>
                  <dt>Runs from</dt><dd>{selectedDef.origin}</dd>
                  <dt>To</dt><dd>{selectedDef.insertion}</dd>
                  <dt>Nerve</dt><dd>{selectedDef.nerve}</dd>
                  {selectedDef.includes && <><dt>Includes</dt><dd>{selectedDef.includes}</dd></>}
                  <dt>Strength</dt><dd>{selectedDef.force ? `${selectedDef.force} N maximum force (${selectedDef.source})` : 'Not modelled'}</dd>
                </dl>
                {(selectedDef.homologue || selectedDef.analogues.length > 0) && (
                  <div className="analogy">
                    <b>Works most like</b>
                    {selectedDef.homologue && <p>{DEFS.get(selectedDef.homologue.id)?.name} in the {['shoulder', 'arm', 'forearm', 'hand'].includes(selectedDef.region) ? 'leg' : 'arm'} ({Math.round(selectedDef.homologue.score * 100)}% same structure): the same job at the matching joint of the other limb.</p>}
                    <p className="kin">Similar: {selectedDef.analogues.slice(0, 4).map((a) => `${DEFS.get(a.id)?.name} ${Math.round(a.score * 100)}%`).join(', ')}</p>
                  </div>
                )}
                {selectedDef.note && <p className="fine">{selectedDef.note}</p>}
              </section>
            )}

            <section className="panel">
              <h2>Working now</h2>
              <p className="sub">On the ground: {contactText}</p>
              {snapshot.working.length === 0 ? <p className="sub">Nothing is working hard. Move, lift an arm, or squat.</p> : (
                <ul className="working">
                  {snapshot.working.map((m) => (
                    <li key={m.key}>
                      <button onClick={() => setSelected(m.key)} type="button" className={selected === m.key ? 'active' : ''}>
                        <span className="name">{m.def.name}{m.side !== 'C' ? ` ${m.side}` : ''}</span>
                        <span className="bar"><span style={{ width: `${Math.round(m.activation * 100)}%`, background: effortColour(m.activation) }} /></span>
                        <span className="pct">{Math.round(m.activation * 100)}%</span>
                        <span className="mode">{purposeLabel(m)}{m.contraction && m.contraction !== 'expression' ? ` · ${CONTRACTION[m.contraction].split(' (')[0].toLowerCase()}` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <h2>Movement memory</h2>
              <p className="sub">Teach it a movement, and it will recognise it again and relate it to others.</p>
              {pendingName ? (
                <div className="name-row">
                  <input autoFocus placeholder="Name it, e.g. squat" value={movementName} onChange={(e) => setMovementName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveMovement()} />
                  <button className="button primary" onClick={saveMovement} type="button" disabled={!movementName.trim()}>Remember</button>
                  <button className="text-button" onClick={() => setPendingName(null)} type="button">Discard</button>
                </div>
              ) : (
                <button className={isRecording ? 'button recording' : 'button'} onClick={isRecording ? stopRecording : startRecording} type="button" disabled={status !== 'running'}>
                  {isRecording ? <><Square size={16} />Stop recording</> : <><Circle size={16} />Record a movement</>}
                </button>
              )}
              {note && <p className="sub">{note}</p>}
              {knownMovements.length > 0 && <p className="sub">Knows: {knownMovements.map(([n, c]) => `${n}${c > 1 ? ` ×${c}` : ''}`).join(', ')}</p>}
              {memory.insights.length > 0 && (
                <div className="dreams"><b><Brain size={15} /> Worked out while dreaming</b><ul>{memory.insights.map((i) => <li key={i}>{i}</li>)}</ul></div>
              )}
              {(memory.episodes.length > 0) && <button className="text-button quiet" onClick={() => setMemory(forget())} type="button">Forget all movements</button>}
            </section>

            <section className="panel">
              <h2>Joints</h2>
              <table className="joints">
                <thead><tr><th /><th>Angle</th><th>Effort</th></tr></thead>
                <tbody>
                  {jointRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.label}</td>
                      <td>{row.cells.map((c, i) => <span key={i}>{c ? `${Math.round(c.angle)}°` : '—'}</span>)}</td>
                      <td>{row.cells.map((c, i) => <span key={i} style={{ color: c ? effortColour(Math.abs(c.effort)) : undefined }}>{c ? `${Math.round(c.effort * 100)}%` : '—'}</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="fine">Two numbers: left, right. Effort is the torque the joint needs ÷ a typical maximum; negative means the opposite direction (extension, adduction, plantarflexion).</p>
            </section>
          </aside>
        </section>

        <details className="how">
          <summary>How does it know which muscles are working?</summary>
          <div className="how-body">
            <ul>
              <li><b>Tracking.</b> Google MediaPipe follows 33 body points in 3D (in metres), 21 points on each hand and 52 facial expression measurements.</li>
              <li><b>Physics.</b> Each body segment has a known share of body weight (Winter, 2009). For every joint the app computes the torque the muscles must produce to hold or move the body against gravity, τ = Σ r × m·g (plus I·α while moving). For a leg or arm on the ground it uses the push of the ground, F = m·g, shared so your balance point stays over your feet. Dividing by a typical maximum torque gives the effort.</li>
              <li><b>Muscles.</b> 110 muscles, with strengths from Stanford's OpenSim research models. Muscles that pull the same way share the work at equal effort. Shoulder-blade muscles join in as the arm rises past 30°, and deep stabilisers brace loaded joints. Hands are read from finger shapes, and the face from expression units (FACS).</li>
              <li><b>Shortening, lengthening, holding.</b> If the joint moves the way the muscle pulls, it is shortening (concentric). If it moves the other way under load, the muscle is braking (eccentric), like your thighs on the way down in a squat.</li>
              <li><b>Analogies and memory.</b> Every muscle and every movement you teach is stored as a structure-mapping description. That is how it knows the triceps does for the elbow what the quadriceps does for the knee, and how it recognises movements. New movements that fit something known are learned at once; new kinds are consolidated later while it dreams.</li>
            </ul>
            <p className="fine"><b>Limits.</b> These are physics-based estimates, not measurements: real muscle activity needs EMG sensors on the skin. A camera can't see muscles pushing against each other (co-contraction), extra weights you hold, or deep muscles directly. Accuracy drops when the camera is tilted, the body is partly hidden, or the view is straight side-on. Not for medical use.</p>
          </div>
        </details>
      </main>
      <input ref={fileRef} type="file" accept="video/*" className="visually-hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void start('video', f); e.target.value = ''; }} />
    </div>
  );
}
