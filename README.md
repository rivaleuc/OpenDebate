# OpenDebate

**A turn-based debate, judged by GenLayer validator consensus.**

[![GenLayer](https://img.shields.io/badge/GenLayer-Bradbury-ff4d6d)](https://genlayer.com) [![chainId](https://img.shields.io/badge/chainId-4221-4dd0e1)](https://docs.genlayer.com) [![contract](https://img.shields.io/badge/contract-Python%20GenVM-8a63d2)](https://docs.genlayer.com) [![tests](https://img.shields.io/badge/tests-4%2F4%20passing-3fb950)](tests) [![frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite%20%2B%20genlayer--js-22a6f2)](app) [![live](https://img.shields.io/badge/live-opendebate.pages.dev-f59e0b)](https://opendebate.pages.dev) [![License](https://img.shields.io/badge/license-MIT-2dd4bf)](LICENSE)

One party opens a debate on a motion and argues **FOR** it (side A); an opponent joins arguing
**AGAINST** (side B). They alternate `speak` turns, building a transcript. `judge` has every validator
independently read the whole transcript and decide who argued better — accepted only when validators
agree on the **winner** (comparative equivalence on the winner id), not on field shape. Scores and
reasoning are advisory; the winner is the consensus output.

The verb is **"argue in alternating turns"** — distinct from negotiating a settlement or ranking
independent entries; it's an adversarial transcript scored as a whole.

- **Live demo:** https://opendebate.pages.dev
- **Contract (Bradbury, chain 4221):** `0xA128E767ae6A8562e5e5B8c77091a47FFeba7cBE`
- **Deployed from:** `rivale` (`0xc388…51A44`)
- **Explorer:** https://explorer-bradbury.genlayer.com/contract/0xA128E767ae6A8562e5e5B8c77091a47FFeba7cBE

---

## Why GenLayer is essential

Deciding who won a debate is qualitative judgment over natural-language arguments — impossible on a
deterministic EVM. GenLayer has every validator read the same transcript and accept a result only when
they **agree on the winner**, turning subjective adjudication into a reproducible on-chain outcome.

## Workflow

| Step | Method | What happens |
| --- | --- | --- |
| Open | `open_debate(motion, opening)` | Creator posts the motion + opening (side A). |
| Speak | `speak(id, text)` | Opponent joins (side B), then the two alternate turns (enforced). |
| Judge | `judge(id)` | Consensus reads the transcript → winner (a / b / tie) + scores. |
| Read | `get_debate(id)` / `stats()` | Transcript, turn, verdict. |

### Correctness check

`_judge` wraps `do_judge` in **`gl.eq_principle.prompt_comparative`** — principle: *"the winner
(a / b / tie) must be identical across validators."* `validate_verdict` enforces the winner enum +
0–100 integer scores + a non-empty reasoning; `normalize_verdict` defaults the unclear case to `tie`.
Turn order is enforced on-chain (only the two debaters, only on their turn). Unit-tested incl. full
open → speak(join) → speak → judge with turn-order guards.

## Architecture

```
OpenDebate/
├── contracts/open_debate.py  ← GenLayer Intelligent Contract (turn-based transcript + consensus verdict)
├── tests/                    ← pytest: verdict guards, turn-order enforcement, full flow
└── app/                      ← React + Vite + Tailwind v4 + Framer Motion (21st.dev style)
                                violet rostrum theme, two-sided debate floor (A left / B right) + verdict bar
```

## Tests

```bash
cd OpenDebate
python3 -m venv .venv && .venv/bin/pip install pytest -q
.venv/bin/python -m pytest tests/ -q
```
Covers `normalize_verdict` / `validate_verdict`, and a full **open → join → turn → judge** integration
run with alternating-turn + non-debater guards (shim auto-inits `TreeMap`, varies `sender_address`).
**On-chain smoke-tested:** `open_debate` write + `get_debate` read verified live on Bradbury.

## Deploy

```bash
genlayer deploy --contract contracts/open_debate.py
```
