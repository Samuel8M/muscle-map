# Analogy research, and how Muscle Map uses it

## Analogical Engines

[Analogical Engines](https://www.analogicalengines.com/) is a Carnegie Mellon spin-out founded by Niki Kittur, Vikram Mohanty, Nikolas Martelaro, Cole Biehle and Dafna Shahaf. It won CMU's McGinnis Venture Competition. Its product helps R&D teams find solutions in unrelated fields by analogy. It does not do image recognition, but its method carries over directly.

From their [white paper](https://www.analogicalengines.com/research):

1. **Describe function, not appearance.** Each problem becomes a structured set of *problem schemas*: "vector embeddings and relational constraints that describe its key functions and relations at multiple levels of abstraction." Flossing, for example, becomes "disrupt a dense biofilm in a confined, fluid-filled space without abrasive contact." Searching on that finds mechanisms from distant domains rather than look-alike products.
2. **Separate purpose from mechanism.** They separate "what a system does from how it does it, then search for the same purpose achieved by a different mechanism." Each library entry encodes "a system's purpose, causal mechanism, and operating conditions in a common form."
3. **Retrieve fast, then map carefully.** Embeddings find candidates. Relational constraints then decide whether a candidate really fits, and the mechanism is adapted to the new domain.

They report that experts rated ideas 54% more novel with no loss of feasibility.

### The research behind it

- Hope, T., Chan, J., Kittur, A. & Shahaf, D. (2017). [Accelerating Innovation Through Analogy Mining](https://dl.acm.org/doi/10.1145/3097983.3098038). *KDD*. Products are represented by separate **purpose** and **mechanism** vectors. Two things with similar purposes but different mechanisms make useful analogies.
- Kittur, A. et al. (2019). [Scaling up analogical innovation with crowds and AI](https://www.pnas.org/doi/10.1073/pnas.1807185116). *PNAS*.
- Kang, H. B. et al. (2025). [BioSpark: Beyond Analogical Inspiration to LLM-augmented Transfer](https://dl.acm.org/doi/full/10.1145/3706598.3714053). *CHI*, Best Paper Honorable Mention. Covers mapping and adapting an inspiration to a target domain.
- These build on structure-mapping theory (Gentner, 1983), the Structure-Mapping Engine (Falkenhainer, Forbus & Gentner, 1989) and MAC/FAC retrieval (Forbus, Gentner & Law, 1995).

## Why this improves recognition

Recognisers normally classify by appearance: this region looks like a quadriceps, this pose looks like a squat. Appearance changes with camera angle, clothing, lighting and body type. **Function does not.** A squat is "lower the body by braking with the limb's middle-joint extensors, then drive it back up" whether it is filmed from the front, the side, or the back. Recognising function, and checking it against relational constraints, is what makes analogy-based recognition robust.

## What Muscle Map does with it

| Analogical Engines idea | In Muscle Map |
|---|---|
| Purpose separate from mechanism | Every working muscle has a **purpose** (bearing your weight, braking on the way down, pushing you up, holding a limb up, lowering a limb, lifting it, steadying a joint) and a separate **mechanism** (shortening, lengthening, holding). Both appear in the app. The purpose comes from physics: is weight coming up through a hand or foot on the ground, and which way is the joint moving? |
| Several levels of abstraction | Movement memories are described at three levels: the concrete muscle group and joint (*quadriceps, knee*), its role in the limb plan (*extends the middle joint*, *middle joint*), and its purpose (*braking*). A push-up's triceps and a squat's quadriceps therefore line up: same purpose, same role, different limb. Group roles are computed from the anatomy, not written by hand. |
| Embeddings to retrieve, relations to confirm | Recognition and dreaming use a two-stage search. A content vector (counts of each relation) is compared by cosine to shortlist memories cheaply. The Structure-Mapping Engine then checks the relational structure. |
| Relational constraints | Joints only correspond to joints, muscle groups to muscle groups, and phases to phases. Shared surface labels such as "both sides" can confirm a correspondence but never create one. |
| Common form for every entry | Every muscle (`src/data/anatomy.json`) and every remembered movement is stored in the same structure-mapping form, so anything can be compared with anything. |

See [ANATOMY.md](ANATOMY.md) for every muscle and its analogues, and the in-app *How does it know…* section for the physics.
