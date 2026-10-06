<!-- Source for docs/ANATOMY.md. Edit this file or scripts/anatomy-table.mjs, then run: node scripts/build-anatomy.mjs -->
# Anatomy reference

Muscle Map knows {{COUNT}} muscles. Each one is stored three ways:

1. **Anatomy:** origin, insertion, nerve, and action at each joint the camera can measure.
2. **Strength:** maximum isometric force in newtons, from Stanford's OpenSim research models wherever they include the muscle:
   - Rajagopal et al. 2016 full-body model, with 2017/2022 updates: hips and legs.
   - Wu et al. 2016 shoulder model: shoulder girdle.
   - Arm26: elbow.
   - The OpenSim wrist model: forearm and hand.
   Forces marked * are approximate literature values for muscles those models don't include.
3. **A structure-mapping description:** relations such as *(extends M knee)*, *(crosses M hip)*, *(originates-on M pelvis)*, *(proximal-to hip knee)* and *(cause (contracts M) (extends M knee))*.

**Works most like** is found by the Structure-Mapping Engine comparing those descriptions; nobody wrote it by hand. Arms and legs share a body plan: shoulder↔hip, elbow↔knee, humerus↔femur. So for a limb muscle, the app looks for its best match in the *other* limb (its functional homologue). For example, the knee extensors match the elbow extensors. Other muscles show their closest match anywhere in the body.

Where each muscle is drawn on the person is approximate and only for orientation.

{{TABLES}}

## Sources

- Rajagopal, A. et al. (2016). Full-body musculoskeletal model for muscle-driven simulation of human gait. *IEEE Trans. Biomed. Eng.* 63(10). With Lai et al. (2017) and Uhlrich et al. (2022) updates, from [opensim-org/opensim-models](https://github.com/opensim-org/opensim-models).
- Wu, W. et al. (2016). Subject-specific musculoskeletal modeling in the evaluation of shoulder muscle and joint function. *J. Biomech.* 49(15). Model file from [pyomeca/biobuddy](https://github.com/pyomeca/biobuddy).
- OpenSim Arm26 and wrist models, from [opensim-org/opensim-models](https://github.com/opensim-org/opensim-models).
- Holzbaur, K., Murray, W. & Delp, S. (2005). A model of the upper extremity for simulating musculoskeletal surgery and analyzing neuromuscular control. *Ann. Biomed. Eng.* 33(6): approximate forces for forearm rotators and brachioradialis.
- Ekman, P. & Friesen, W. (1978). *Facial Action Coding System*: action units for the face muscles.
