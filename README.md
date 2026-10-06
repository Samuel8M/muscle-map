# Muscle Map

Real-time muscle estimates from a camera or a video. Muscle Map tracks the body (33 points in 3D), the hands (21 points each) and the face (52 expression measurements). It works out the physics of every joint and shows which of 110 muscles are working, how hard, what for, and how.

**Use it:** https://samuel8m.github.io/muscle-map/

Video is processed in the browser and never uploaded.

## What it shows

- **Muscles drawn on the body,** coloured from blue (resting) to red (full effort). Muscles on the side facing away are hidden unless you ask for them.
- **Working now:** the busiest muscles, each with its **purpose** (bearing your weight, braking on the way down, pushing you up, holding a limb up, steadying a joint) and **mechanism** (shortening, lengthening, holding).
- **Tap a muscle** to see its origin, insertion, nerve and research-model strength. It also shows the physics of why it is working, and what it *works most like* in the other limb (found by structure-mapping).
- **Movement memory:** record a movement and name it. It is recognised again later and related to your other movements.

## How it works

| Part | File | What it does |
|---|---|---|
| Tracking | `src/engine/tracking.ts` | MediaPipe pose, hand and face landmarkers in video mode (GPU, falling back to CPU). Each hand is assigned to the nearest body wrist. |
| Physics | `src/engine/body.ts` | Joint angles in a body-fixed anatomical frame, filtered with One Euro filters. Inverse dynamics on a Winter (2009) segment model: τ = −[Σ (cᵢ − p) × mᵢg + Σ (r_c − p) × F_c]·axis + I·α. Ground contacts come from the 3D height, the image floor line, or balance (centre of mass outside the feet means the hands must be holding the body up). Weight is shared by the lever rule. Effort = torque ÷ typical maximum torque. Optional extra load in the hands or on the shoulders. |
| Muscles | `src/engine/muscles.ts` | Equal-stress sharing among muscles that pull the same way (Crowninshield & Brand, 1981). Scapulohumeral rhythm above 30° of arm elevation, rotator-cuff and core bracing, hand rules from finger shape, face from FACS-style blendshapes. Activation dynamics of about 15 ms on and 50 ms off. Each muscle gets a purpose and a contraction type. |
| Anatomy | `scripts/anatomy-table.mjs` → `src/data/anatomy.json` | 110 muscles. Forces come from Stanford's OpenSim research models (Rajagopal 2016 full body, Wu 2016 shoulder, Arm26, wrist). Each muscle is stored as a structure-mapping description; analogues and arm↔leg matches are computed by SME. See [docs/ANATOMY.md](docs/ANATOMY.md). |
| Structure-mapping | `src/engine/sme.ts` | Structure-Mapping Engine with entity types and attribute-support constraints. |
| Memory | `src/engine/memory.ts` | Movements are stored as structured descriptions at three levels: body part, role in the limb plan, and purpose. New movements that fit a known one are integrated at once (schema theory); others are kept as episodes. Idle-time "dreaming" merges episodes SAGE-style and relates different movements. Retrieval is MAC/FAC: content vectors, then SME. |

The approach to purpose versus mechanism follows the analogical-innovation research behind [Analogical Engines](https://www.analogicalengines.com/); see [docs/ANALOGY_RESEARCH.md](docs/ANALOGY_RESEARCH.md).

## Limits

These are physics-based estimates, not measurements; real muscle activity needs EMG. A camera can't see co-contraction, weights you don't enter, or deep muscles directly. Side-on, side-to-side estimates rely on depth guesses and are shown at reduced weight. Not for medical use.

## Develop

```sh
npm install
npm run dev               # http://localhost:5187
npm run typecheck
npm run build:anatomy     # rebuild anatomy.json and docs/ANATOMY.md (Node 23.6+)
npm run build -- --base ./  # static build for GitHub Pages
```
