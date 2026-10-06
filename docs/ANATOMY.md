<!-- Source for docs/ANATOMY.md. Edit this file or scripts/anatomy-table.mjs, then run: node scripts/build-anatomy.mjs -->
# Anatomy reference

Muscle Map knows 110 muscles. Each one is stored three ways:

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

### Neck

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Sternocleidomastoid** | Manubrium of the sternum and medial clavicle → Mastoid process of the skull | flexion of the neck; side-bends the neck to its own side | Accessory nerve (CN XI) | 150 N* | Scalenes (0.91) |
| **Splenius capitis** | Nuchal ligament and spinous processes C7–T3 → Mastoid process and occipital bone | extension of the neck; (side-bends the neck to its own side) | Dorsal rami of cervical nerves | 100 N* | Extensor carpi radialis brevis (0.8) |
| **Scalenes** | Transverse processes of cervical vertebrae → First and second ribs | side-bends the neck to its own side; (flexion of the neck) | Ventral rami of cervical nerves | 100 N* | Sternocleidomastoid (0.91) |
| **Levator scapulae** | Transverse processes C1–C4 → Superior angle of the scapula | (side-bends the neck to its own side); scapular elevation | Dorsal scapular nerve (C5) and C3–C4 | 170 N | Trapezius (upper) (0.88) |

### Back

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Trapezius (upper)** | Occipital bone and nuchal ligament → Lateral third of the clavicle | (extension of the neck); (side-bends the neck to its own side); scapular upward rotation | Accessory nerve (CN XI) | 281 N | Levator scapulae (0.88) |
| **Trapezius (middle)** | Spinous processes T1–T5 → Acromion and spine of the scapula | scapular stabiliser | Accessory nerve (CN XI) | 318 N | Trapezius (lower) (0.89) |
| **Trapezius (lower)** | Spinous processes T6–T12 → Medial spine of the scapula | scapular upward rotation | Accessory nerve (CN XI) | 557 N | Trapezius (middle) (0.89) |
| **Rhomboids (major and minor)** | Spinous processes C7–T5 → Medial border of the scapula | (adduction of the shoulder); (extension of the shoulder) | Dorsal scapular nerve | 599 N | Multifidus (0.79) |
| **Latissimus dorsi** | Spinous processes T7–L5, thoracolumbar fascia, iliac crest, lower ribs → Floor of the intertubercular groove of the humerus | extension of the shoulder; adduction of the shoulder; (side-bends the spine to its own side) | Thoracodorsal nerve | 1130 N | Teres major (0.75) |
| **Erector spinae** | Sacrum, iliac crest and spinous processes → Ribs, vertebrae and the base of the skull | extension of the spine; (side-bends the spine to its own side); (extension of the neck) | Dorsal rami of spinal nerves | 2000 N* | Biceps femoris (long head) (0.74) |
| **Multifidus** | Sacrum and transverse processes → Spinous processes two to four levels above | (extension of the spine); core brace | Dorsal rami of spinal nerves | 600 N* | Quadratus lumborum (0.85) |
| **Quadratus lumborum** | Iliac crest and iliolumbar ligament → 12th rib and transverse processes L1–L4 | side-bends the spine to its own side; (extension of the spine) | Ventral rami T12–L4 | 300 N* | Multifidus (0.85) |

### Chest

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Serratus anterior** | Outer surfaces of ribs 1–8 → Medial border of the scapula (front surface) | (flexion of the shoulder); scapular upward rotation | Long thoracic nerve | 923 N | Pectoralis minor (0.84) |
| **Pectoralis minor** | Ribs 3–5 → Coracoid process of the scapula | (flexion of the shoulder) | Medial pectoral nerve | 219 N | Coracobrachialis (0.88) |
| **Subclavius** | First rib → Underside of the clavicle | shoulder stabiliser | Nerve to subclavius | 196 N | Pectoralis minor (0.52) |
| **Pectoralis major (upper)** | Medial half of the clavicle → Lateral lip of the intertubercular groove | flexion of the shoulder; (adduction of the shoulder) | Lateral and medial pectoral nerves | 983 N | Deltoid (front) (0.81) |
| **Pectoralis major (lower)** | Sternum and costal cartilages 1–6 → Lateral lip of the intertubercular groove | adduction of the shoulder; (extension of the shoulder) | Lateral and medial pectoral nerves | 1146 N | Adductor magnus (0.91) |

### Shoulder

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Deltoid (front)** | Lateral third of the clavicle → Deltoid tuberosity of the humerus | flexion of the shoulder; (abduction of the shoulder) | Axillary nerve | 557 N | Iliacus (0.8) |
| **Deltoid (middle)** | Acromion → Deltoid tuberosity of the humerus | abduction of the shoulder | Axillary nerve | 1098 N | Gluteus medius (0.87) |
| **Deltoid (rear)** | Spine of the scapula → Deltoid tuberosity of the humerus | extension of the shoulder; (abduction of the shoulder) | Axillary nerve | 945 N | Gluteus maximus (0.88) |
| **Supraspinatus** | Supraspinous fossa of the scapula → Greater tubercle of the humerus | abduction of the shoulder; rotator cuff | Suprascapular nerve | 411 N | Gluteus minimus (0.83) |
| **Infraspinatus** | Infraspinous fossa of the scapula → Greater tubercle of the humerus | rotator cuff | Suprascapular nerve | 865 N | Subscapularis (0.75) |
| **Teres minor** | Lateral border of the scapula → Greater tubercle of the humerus | (adduction of the shoulder); rotator cuff | Axillary nerve | 605 N | Adductor longus (0.73) |
| **Subscapularis** | Subscapular fossa of the scapula → Lesser tubercle of the humerus | rotator cuff | Upper and lower subscapular nerves | 944 N | Infraspinatus (0.75) |
| **Teres major** | Inferior angle of the scapula → Medial lip of the intertubercular groove | extension of the shoulder; adduction of the shoulder | Lower subscapular nerve | 235 N | Adductor magnus (0.84) |

### Arm

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Coracobrachialis** | Coracoid process of the scapula → Middle of the medial humerus | (flexion of the shoulder); (adduction of the shoulder) | Musculocutaneous nerve | 307 N | Tibialis posterior (0.75) |
| **Biceps brachii** | Supraglenoid tubercle (long head) and coracoid process (short head) → Radial tuberosity and bicipital aponeurosis | flexion of the elbow; (flexion of the shoulder) | Musculocutaneous nerve | 1060 N | Gastrocnemius (inner) (0.85) |
| **Brachialis** | Distal half of the front of the humerus → Coronoid process and tuberosity of the ulna | flexion of the elbow | Musculocutaneous nerve | 987 N | Biceps femoris (short head) (0.89) |
| **Triceps brachii** | Infraglenoid tubercle (long head) and back of the humerus (lateral and medial heads) → Olecranon of the ulna | extension of the elbow; (extension of the shoulder) | Radial nerve | 2047 N | Rectus femoris (0.82) |

### Forearm

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Brachioradialis** | Lateral supracondylar ridge of the humerus → Styloid process of the radius | flexion of the elbow | Radial nerve | 261 N* | Biceps femoris (short head) (0.84) |
| **Anconeus** | Lateral epicondyle of the humerus → Olecranon and back of the ulna | (extension of the elbow) | Radial nerve | 350 N* | Extensor digitorum longus (0.8) |
| **Pronator teres** | Medial epicondyle of the humerus and coronoid process → Middle of the lateral radius | (flexion of the elbow) | Median nerve | 566 N* | Fibularis (peroneus) longus (0.8) |
| **Supinator** | Lateral epicondyle and supinator crest of the ulna → Upper lateral radius | — | Deep branch of the radial nerve | 476 N* | Pronator quadratus (0.75) |
| **Pronator quadratus** | Distal quarter of the ulna → Distal quarter of the radius | — | Anterior interosseous nerve | 75 N* | Supinator (0.75) |
| **Flexor carpi radialis** | Medial epicondyle of the humerus → Base of the 2nd metacarpal | flexion of the wrist; wrist flex | Median nerve | 60 N | Soleus (0.84) |
| **Palmaris longus** | Medial epicondyle of the humerus → Palmar aponeurosis | flexion of the wrist; wrist flex | Median nerve | 21 N | Soleus (0.84) |
| **Flexor carpi ulnaris** | Medial epicondyle and olecranon → Pisiform, hamate and base of the 5th metacarpal | flexion of the wrist; wrist flex | Ulnar nerve | 103 N | Soleus (0.84) |
| **Extensor carpi radialis longus** | Lateral supracondylar ridge of the humerus → Base of the 2nd metacarpal | extension of the wrist; (flexion of the elbow); wrist extend | Radial nerve | 66 N | Rectus femoris (0.77) |
| **Extensor carpi radialis brevis** | Lateral epicondyle of the humerus → Base of the 3rd metacarpal | extension of the wrist; wrist extend | Deep branch of the radial nerve | 123 N | Tibialis anterior (0.89) |
| **Extensor carpi ulnaris** | Lateral epicondyle of the humerus and back of the ulna → Base of the 5th metacarpal | extension of the wrist; wrist extend | Posterior interosseous nerve | 117 N | Tibialis anterior (0.89) |
| **Flexor digitorum superficialis** | Medial epicondyle, coronoid process and radius → Middle phalanges of fingers 2–5 | (flexion of the wrist); finger flex | Median nerve | 188 N | Gastrocnemius (inner) (0.78) |
| **Flexor digitorum profundus** | Front of the ulna and interosseous membrane → Distal phalanges of fingers 2–5 | (flexion of the wrist); finger flex distal | Median (index, middle) and ulnar (ring, little) nerves | 238 N | Gastrocnemius (inner) (0.75) |
| **Extensor digitorum** | Lateral epicondyle of the humerus → Extensor expansions of fingers 2–5 | (extension of the wrist); finger extend | Posterior interosseous nerve | 126 N | Rectus femoris (0.69) |
| **Extensor indicis** | Back of the distal ulna → Extensor hood of the index finger | index extend | Posterior interosseous nerve | 25 N | Rectus femoris (0.73) |
| **Extensor digiti minimi** | Lateral epicondyle of the humerus → Extensor hood of the little finger | little extend | Posterior interosseous nerve | 29 N | Rectus femoris (0.73) |
| **Flexor pollicis longus** | Front of the radius → Distal phalanx of the thumb | thumb flex | Anterior interosseous nerve | 62 N | Psoas major (0.73) |
| **Abductor pollicis longus** | Back of the ulna and radius → Base of the 1st metacarpal | thumb abduct | Posterior interosseous nerve | 58 N | Gluteus medius (0.63) |
| **Extensor pollicis brevis** | Back of the radius → Proximal phalanx of the thumb | thumb extend | Posterior interosseous nerve | 14 N | Rectus femoris (0.68) |
| **Extensor pollicis longus** | Back of the ulna → Distal phalanx of the thumb | thumb extend | Posterior interosseous nerve | 44 N | Rectus femoris (0.68) |

### Hand

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Thenar muscles** | Flexor retinaculum, scaphoid and trapezium → Thumb metacarpal and proximal phalanx | thumb oppose | Median nerve (recurrent branch) | 40 N* | Gluteus medius (0.75) |
| **Adductor pollicis** | 3rd metacarpal, capitate and trapezoid → Base of the thumb's proximal phalanx | thumb adduct | Deep branch of the ulnar nerve | 50 N* | Adductor brevis (0.84) |
| **Hypothenar muscles** | Pisiform, hamate and flexor retinaculum → Little finger metacarpal and proximal phalanx | little flex | Deep branch of the ulnar nerve | 25 N* | Gluteus minimus (0.76) |
| **Lumbricals** | Tendons of flexor digitorum profundus → Extensor expansions of fingers 2–5 | lumbrical | Median (1, 2) and ulnar (3, 4) nerves | 10 N* | Iliacus (0.77) |
| **Dorsal interossei** | Adjacent sides of the metacarpals → Proximal phalanges and extensor expansions | finger spread | Deep branch of the ulnar nerve | 30 N* | Gluteus medius (0.82) |
| **Palmar interossei** | Metacarpals 2, 4 and 5 → Proximal phalanges and extensor expansions | finger squeeze | Deep branch of the ulnar nerve | 20 N* | Adductor brevis (0.84) |

### Abdomen

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Rectus abdominis** | Pubic crest and symphysis → Xiphoid process and costal cartilages 5–7 | flexion of the spine | Thoracoabdominal nerves (T7–T11) and subcostal nerve | 400 N* | Brachioradialis (0.84) |
| **External oblique** | Outer surfaces of ribs 5–12 → Linea alba, pubic tubercle and iliac crest | (flexion of the spine); side-bends the spine to its own side | Thoracoabdominal nerves (T7–T11) | 450 N* | Internal oblique (0.95) |
| **Internal oblique** | Thoracolumbar fascia, iliac crest and inguinal ligament → Ribs 10–12 and linea alba | (flexion of the spine); side-bends the spine to its own side | Thoracoabdominal nerves, iliohypogastric and ilioinguinal nerves | 400 N* | External oblique (0.95) |
| **Transversus abdominis** | Lower costal cartilages, thoracolumbar fascia and iliac crest → Linea alba and pubic crest | core brace | Thoracoabdominal nerves, iliohypogastric and ilioinguinal nerves | 300 N* | Subclavius (0.5) |

### Hip

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Gluteus maximus** | Ilium, sacrum, coccyx and thoracolumbar fascia → Gluteal tuberosity of the femur and iliotibial band | extension of the hip; (abduction of the hip) | Inferior gluteal nerve | 3338 N | Deltoid (rear) (0.88) |
| **Gluteus medius** | Outer surface of the ilium → Greater trochanter of the femur | abduction of the hip; pelvis level | Superior gluteal nerve | 2730 N | Deltoid (middle) (0.87) |
| **Gluteus minimus** | Outer surface of the ilium, below gluteus medius → Front of the greater trochanter | abduction of the hip; (flexion of the hip); pelvis level | Superior gluteal nerve | 1216 N | Supraspinatus (0.83) |
| **Tensor fasciae latae** | Anterior superior iliac spine → Iliotibial band | (flexion of the hip); (abduction of the hip) | Superior gluteal nerve | 411 N | Deltoid (front) (0.79) |
| **Iliacus** | Iliac fossa → Lesser trochanter of the femur | flexion of the hip | Femoral nerve | 1021 N | Brachialis (0.84) |
| **Psoas major** | Bodies and transverse processes T12–L5 → Lesser trochanter of the femur | flexion of the hip; (flexion of the spine) | Ventral rami L1–L3 | 1427 N | Flexor digitorum profundus (0.74) |
| **Piriformis** | Front of the sacrum → Greater trochanter of the femur | (abduction of the hip) | Nerve to piriformis (S1–S2) | 1030 N | Supraspinatus (0.77) |

### Thigh

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Adductor longus** | Body of the pubis → Middle third of the linea aspera | adduction of the hip; (flexion of the hip) | Obturator nerve | 917 N | Teres major (0.77) |
| **Adductor brevis** | Inferior ramus of the pubis → Upper linea aspera | adduction of the hip | Obturator nerve | 626 N | Adductor pollicis (0.84) |
| **Adductor magnus** | Ischiopubic ramus and ischial tuberosity → Linea aspera and adductor tubercle | adduction of the hip; (extension of the hip) | Obturator nerve and tibial part of the sciatic nerve | 2389 N | Teres major (0.84) |
| **Gracilis** | Body and inferior ramus of the pubis → Upper medial tibia (pes anserinus) | adduction of the hip; (flexion of the knee) | Obturator nerve | 281 N | Flexor digitorum superficialis (0.61) |
| **Sartorius** | Anterior superior iliac spine → Upper medial tibia (pes anserinus) | (flexion of the hip); (abduction of the hip); (flexion of the knee) | Femoral nerve | 249 N | Flexor digitorum superficialis (0.67) |
| **Rectus femoris** | Anterior inferior iliac spine → Tibial tuberosity via the patella | extension of the knee; flexion of the hip | Femoral nerve | 2192 N | Triceps brachii (0.82) |
| **Vastus lateralis** | Greater trochanter and lateral linea aspera → Tibial tuberosity via the patella | extension of the knee | Femoral nerve | 5149 N | Extensor carpi radialis brevis (0.84) |
| **Vastus medialis** | Medial linea aspera → Tibial tuberosity via the patella | extension of the knee | Femoral nerve | 2748 N | Extensor carpi radialis brevis (0.84) |
| **Vastus intermedius** | Front and side of the femoral shaft → Tibial tuberosity via the patella | extension of the knee | Femoral nerve | 1697 N | Extensor carpi radialis brevis (0.79) |
| **Biceps femoris (long head)** | Ischial tuberosity → Head of the fibula | flexion of the knee; extension of the hip | Tibial part of the sciatic nerve | 1313 N | Biceps brachii (0.82) |
| **Biceps femoris (short head)** | Lateral linea aspera → Head of the fibula | flexion of the knee | Common fibular part of the sciatic nerve | 557 N | Brachialis (0.89) |
| **Semitendinosus** | Ischial tuberosity → Upper medial tibia (pes anserinus) | flexion of the knee; extension of the hip | Tibial part of the sciatic nerve | 591 N | Biceps brachii (0.82) |
| **Semimembranosus** | Ischial tuberosity → Medial condyle of the tibia | flexion of the knee; extension of the hip | Tibial part of the sciatic nerve | 2201 N | Biceps brachii (0.79) |

### Leg

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Gastrocnemius (inner)** | Medial condyle of the femur → Calcaneus via the Achilles tendon | plantarflexion of the ankle; (flexion of the knee) | Tibial nerve | 3116 N | Biceps brachii (0.85) |
| **Gastrocnemius (outer)** | Lateral condyle of the femur → Calcaneus via the Achilles tendon | plantarflexion of the ankle; (flexion of the knee) | Tibial nerve | 1575 N | Biceps brachii (0.85) |
| **Soleus** | Back of the upper tibia and fibula → Calcaneus via the Achilles tendon | plantarflexion of the ankle | Tibial nerve | 6195 N | Brachialis (0.84) |
| **Tibialis anterior** | Lateral condyle and upper lateral tibia → Medial cuneiform and base of the 1st metatarsal | dorsiflexion of the ankle | Deep fibular nerve | 1227 N | Extensor carpi radialis brevis (0.89) |
| **Tibialis posterior** | Back of the tibia, fibula and interosseous membrane → Navicular, cuneiforms and metatarsals 2–4 | (plantarflexion of the ankle) | Tibial nerve | 1730 N | Coracobrachialis (0.75) |
| **Fibularis (peroneus) longus** | Head and upper lateral fibula → Medial cuneiform and base of the 1st metatarsal | (plantarflexion of the ankle) | Superficial fibular nerve | 1115 N | Pronator teres (0.8) |
| **Fibularis (peroneus) brevis** | Lower lateral fibula → Base of the 5th metatarsal | (plantarflexion of the ankle) | Superficial fibular nerve | 521 N | Pronator teres (0.8) |
| **Extensor digitorum longus** | Lateral condyle of the tibia and front of the fibula → Toes 2–5 | (dorsiflexion of the ankle) | Deep fibular nerve | 603 N | Anconeus (0.8) |
| **Extensor hallucis longus** | Middle of the front of the fibula → Distal phalanx of the big toe | (dorsiflexion of the ankle) | Deep fibular nerve | 286 N | Anconeus (0.8) |
| **Flexor digitorum longus** | Back of the tibia → Distal phalanges of toes 2–5 | (plantarflexion of the ankle) | Tibial nerve | 423 N | Coracobrachialis (0.75) |
| **Flexor hallucis longus** | Back of the fibula → Distal phalanx of the big toe | (plantarflexion of the ankle) | Tibial nerve | 908 N | Coracobrachialis (0.75) |

### Face

| Muscle | Origin → insertion | Action | Nerve | Max force | Works most like |
|---|---|---|---|---|---|
| **Frontalis** | Epicranial aponeurosis → Skin of the eyebrows | FACS AU1, AU2 | Facial nerve (temporal branch) | — | Corrugator supercilii (0.77) |
| **Corrugator supercilii** | Medial end of the brow ridge → Skin above the middle of the eyebrow | FACS AU4 | Facial nerve (temporal branch) | — | Procerus (0.87) |
| **Procerus** | Nasal bone → Skin between the eyebrows | FACS AU4 (with AU9) | Facial nerve | — | Corrugator supercilii (0.87) |
| **Orbicularis oculi** | Medial orbital margin and medial palpebral ligament → Skin around the eye | FACS AU6, AU7, AU45 | Facial nerve (temporal and zygomatic branches) | — | Levator palpebrae superioris (0.68) |
| **Levator palpebrae superioris** | Lesser wing of the sphenoid → Upper eyelid | FACS AU5 | Oculomotor nerve (CN III) | — | Orbicularis oculi (0.68) |
| **Levator labii superioris alaeque nasi** | Frontal process of the maxilla → Nostril and upper lip | FACS AU9 | Facial nerve (zygomatic and buccal branches) | — | Procerus (0.87) |
| **Levator labii superioris** | Infraorbital margin of the maxilla → Upper lip | FACS AU10 | Facial nerve (buccal branch) | — | Zygomaticus major (0.83) |
| **Zygomaticus major** | Zygomatic bone → Corner of the mouth (modiolus) | FACS AU12 | Facial nerve (zygomatic and buccal branches) | — | Levator labii superioris (0.83) |
| **Zygomaticus minor** | Zygomatic bone → Upper lip | FACS AU11 | Facial nerve (buccal branch) | — | Levator labii superioris (0.83) |
| **Risorius** | Parotid fascia → Corner of the mouth (modiolus) | FACS AU20 | Facial nerve (buccal branch) | — | Levator labii superioris (0.83) |
| **Buccinator** | Alveolar processes of the maxilla and mandible → Corner of the mouth (modiolus) | FACS AU14 | Facial nerve (buccal branch) | — | Levator labii superioris (0.62) |
| **Depressor anguli oris** | Oblique line of the mandible → Corner of the mouth (modiolus) | FACS AU15 | Facial nerve (marginal mandibular branch) | — | Levator labii superioris (0.83) |
| **Depressor labii inferioris** | Oblique line of the mandible → Lower lip | FACS AU16 | Facial nerve (marginal mandibular branch) | — | Levator labii superioris (0.83) |
| **Mentalis** | Incisive fossa of the mandible → Skin of the chin | FACS AU17 | Facial nerve (marginal mandibular branch) | — | Levator labii superioris (0.83) |
| **Orbicularis oris** | Maxilla, mandible and the surrounding muscles → Skin and mucosa of the lips | FACS AU18, AU22, AU23, AU24, AU28 | Facial nerve (buccal and marginal mandibular branches) | — | Levator labii superioris (0.65) |
| **Platysma** | Fascia over the upper chest → Lower border of the mandible and skin of the lower face | FACS AU21 | Facial nerve (cervical branch) | — | Levator labii superioris (0.83) |
| **Masseter** | Zygomatic arch → Angle and outer ramus of the mandible | FACS jaw clench (inferred) | Mandibular nerve (CN V3) | — | Temporalis (1) |
| **Temporalis** | Temporal fossa → Coronoid process of the mandible | FACS jaw clench (inferred) | Mandibular nerve (CN V3) | — | Masseter (1) |
| **Lateral pterygoid** | Sphenoid bone (lateral pterygoid plate) → Neck of the mandible and the jaw joint | FACS AU26, AU29, AU30 | Mandibular nerve (CN V3) | — | Digastric (0.91) |
| **Digastric** | Mastoid notch (back belly) and mandible (front belly) → Hyoid bone via an intermediate tendon | FACS AU26, AU27 | Mandibular nerve (front) and facial nerve (back) | — | Lateral pterygoid (0.91) |

## Sources

- Rajagopal, A. et al. (2016). Full-body musculoskeletal model for muscle-driven simulation of human gait. *IEEE Trans. Biomed. Eng.* 63(10). With Lai et al. (2017) and Uhlrich et al. (2022) updates, from [opensim-org/opensim-models](https://github.com/opensim-org/opensim-models).
- Wu, W. et al. (2016). Subject-specific musculoskeletal modeling in the evaluation of shoulder muscle and joint function. *J. Biomech.* 49(15). Model file from [pyomeca/biobuddy](https://github.com/pyomeca/biobuddy).
- OpenSim Arm26 and wrist models, from [opensim-org/opensim-models](https://github.com/opensim-org/opensim-models).
- Holzbaur, K., Murray, W. & Delp, S. (2005). A model of the upper extremity for simulating musculoskeletal surgery and analyzing neuromuscular control. *Ann. Biomed. Eng.* 33(6): approximate forces for forearm rotators and brachioradialis.
- Ekman, P. & Friesen, W. (1978). *Facial Action Coding System*: action units for the face muscles.
