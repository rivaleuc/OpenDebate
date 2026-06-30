# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
OpenDebate — a turn-based debate, judged by GenLayer validator consensus.

One party opens a debate on a motion and argues FOR it (side A); an opponent
joins arguing AGAINST (side B). They alternate `speak` turns, building a
transcript. `judge` has every validator independently read the whole transcript
and decide who argued better — the verdict is accepted only when validators
agree on the WINNER (comparative equivalence on the winner id), not on the
shape of the JSON. Scores and reasoning are advisory; the winner is the
consensus output.

The verb is "argue in alternating turns", distinct from negotiating a settlement
or ranking independent entries — it's an adversarial transcript scored as a whole.
"""
import json
from genlayer import *

WINNERS = ("a", "b", "tie")
MAX_TURNS = 12


def normalize_verdict(raw) -> dict:
    if not isinstance(raw, dict):
        raw = {}
    winner = str(raw.get("winner", "")).strip().lower()
    if winner not in WINNERS:
        winner = "tie"            # conservative default when unclear
    def _score(v):
        if not isinstance(v, int) or isinstance(v, bool):
            return 0
        return max(0, min(100, v))
    reasoning = raw.get("reasoning")
    if not isinstance(reasoning, str) or not reasoning.strip():
        reasoning = "no reasoning"
    return {"winner": winner, "score_a": _score(raw.get("score_a")), "score_b": _score(raw.get("score_b")), "reasoning": reasoning[:600]}


def validate_verdict(data) -> bool:
    if not isinstance(data, dict):
        return False
    if data.get("winner") not in WINNERS:
        return False
    for k in ("score_a", "score_b"):
        v = data.get(k)
        if not isinstance(v, int) or isinstance(v, bool) or v < 0 or v > 100:
            return False
    r = data.get("reasoning")
    return isinstance(r, str) and bool(r.strip())


class OpenDebate(gl.Contract):
    debates: TreeMap[str, str]
    debate_count: u256
    judged_count: u256

    def __init__(self):
        self.debate_count = u256(0)
        self.judged_count = u256(0)

    # -------------------------------------------------------------- open
    @gl.public.write
    def open_debate(self, motion: str, opening: str) -> str:
        motion = str(motion).strip()
        opening = str(opening).strip()
        if not motion or not opening:
            raise Exception("motion and opening argument required")
        key = str(int(self.debate_count))
        rec = {
            "party_a": str(gl.message.sender_address),
            "party_b": "",
            "motion": motion[:300],
            "transcript": [{"by": "a", "text": opening[:1200]}],
            "turn": "b",
            "state": "awaiting_b",     # awaiting_b -> debating -> judged
            "winner": "",
            "score_a": 0,
            "score_b": 0,
            "reasoning": "",
        }
        self.debates[key] = json.dumps(rec)
        self.debate_count += u256(1)
        return key

    # -------------------------------------------------------------- speak
    @gl.public.write
    def speak(self, debate_id: str, text: str) -> dict:
        """Join as B (first time) or take your alternating turn."""
        debate_id = str(debate_id)
        if debate_id not in self.debates:
            raise Exception("unknown debate")
        d = json.loads(self.debates[debate_id])
        text = str(text).strip()
        if not text:
            raise Exception("argument text required")
        sender = str(gl.message.sender_address)

        if d["state"] == "awaiting_b":
            if sender == d["party_a"]:
                raise Exception("waiting for an opponent to join side B")
            d["party_b"] = sender
            d["transcript"].append({"by": "b", "text": text[:1200]})
            d["turn"] = "a"
            d["state"] = "debating"
        elif d["state"] == "debating":
            who = "a" if sender == d["party_a"] else "b" if sender == d["party_b"] else ""
            if not who:
                raise Exception("only the two debaters may speak")
            if who != d["turn"]:
                raise Exception("not your turn")
            if len(d["transcript"]) >= MAX_TURNS:
                raise Exception("transcript is full — time to judge")
            d["transcript"].append({"by": who, "text": text[:1200]})
            d["turn"] = "b" if who == "a" else "a"
        else:
            raise Exception("debate already judged")

        self.debates[debate_id] = json.dumps(d)
        return {"debate": debate_id, "turns": len(d["transcript"]), "turn": d["turn"]}

    # -------------------------------------------------------------- judge
    @gl.public.write
    def judge(self, debate_id: str) -> dict:
        """Consensus reads the whole transcript and decides the winner."""
        debate_id = str(debate_id)
        if debate_id not in self.debates:
            raise Exception("unknown debate")
        d = json.loads(self.debates[debate_id])
        if d["state"] != "debating":
            raise Exception("debate is not ready to judge")
        if len(d["transcript"]) < 2:
            raise Exception("need arguments from both sides")

        verdict = self._judge(d["motion"], d["transcript"])
        d["winner"] = verdict["winner"]
        d["score_a"] = verdict["score_a"]
        d["score_b"] = verdict["score_b"]
        d["reasoning"] = verdict["reasoning"]
        d["state"] = "judged"
        self.debates[debate_id] = json.dumps(d)
        self.judged_count += u256(1)
        return {"debate": debate_id, "winner": verdict["winner"]}

    def _judge(self, motion: str, transcript) -> dict:
        block = "\n".join(f"[{t['by'].upper()}] {t['text']}" for t in transcript)

        def do_judge() -> str:
            prompt = f"""You are an impartial debate judge. Read the full debate and decide who argued better.

MOTION: {motion}

TRANSCRIPT (A argues FOR, B argues AGAINST):
{block}

Judge on logic, evidence, and rebuttals — not on your own opinion of the motion.
Reply ONLY JSON: {{"winner":"a|b|tie","score_a":<int 0-100>,"score_b":<int 0-100>,"reasoning":"<short>"}}"""
            raw = gl.nondet.exec_prompt(prompt, response_format="json")
            if not isinstance(raw, dict):
                try:
                    raw = json.loads(str(raw))
                except Exception:
                    raw = {}
            return json.dumps(normalize_verdict(raw))

        result = gl.eq_principle.prompt_comparative(
            do_judge,
            principle="The 'winner' (a / b / tie) must be identical across validators. Scores and reasoning wording may differ.",
        )
        data = json.loads(result) if isinstance(result, str) else result
        if not validate_verdict(data):
            data = normalize_verdict(data if isinstance(data, dict) else {})
        return data

    # -------------------------------------------------------------- views
    @gl.public.view
    def get_debate(self, debate_id: str) -> dict:
        debate_id = str(debate_id)
        if debate_id not in self.debates:
            return {"exists": False}
        d = json.loads(self.debates[debate_id])
        d["exists"] = True
        return d

    @gl.public.view
    def stats(self) -> dict:
        return {"total_debates": int(self.debate_count), "judged": int(self.judged_count)}
