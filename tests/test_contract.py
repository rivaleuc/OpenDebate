"""OpenDebate tests: verdict guards, alternating-turn enforcement, full open→speak→judge flow."""

A = "0xAAa0000000000000000000000000000000000001"
B = "0xBBb0000000000000000000000000000000000002"
C = "0xCCc0000000000000000000000000000000000003"


def test_normalize_verdict(contract):
    n = contract.normalize_verdict
    assert n({"winner": "a", "score_a": 80, "score_b": 40, "reasoning": "clear"})["winner"] == "a"
    assert n({"winner": "B", "score_a": 5, "score_b": 9, "reasoning": "x"})["winner"] == "b"
    assert n({})["winner"] == "tie"                      # conservative default
    assert n({"winner": "a", "score_a": 999, "score_b": -3, "reasoning": "x"})["score_a"] == 100
    assert n({"winner": "a", "score_a": 999, "score_b": -3, "reasoning": "x"})["score_b"] == 0

def test_validate_verdict(contract):
    v = contract.validate_verdict
    assert v({"winner": "tie", "score_a": 50, "score_b": 50, "reasoning": "even"})
    assert not v({"winner": "draw", "score_a": 1, "score_b": 1, "reasoning": "x"})
    assert not v({"winner": "a", "score_a": "9", "score_b": 1, "reasoning": "x"})
    assert not v({"winner": "a", "score_a": 9, "score_b": 1, "reasoning": "  "})


def _new(contract):
    return contract, contract.OpenDebate()

def test_full_debate_flow(contract):
    mod, c = _new(contract)
    mod.gl.message.sender_address = A
    did = c.open_debate("AI agents should manage treasuries", "Agents act 24/7 without bias.")
    # A cannot speak again while awaiting B
    try:
        c.speak(did, "extra"); assert False, "A should wait for B"
    except Exception:
        pass
    # B joins
    mod.gl.message.sender_address = B
    r = c.speak(did, "Agents hallucinate and can be exploited.")
    assert r["turn"] == "a" and r["turns"] == 2
    # non-debater cannot speak
    mod.gl.message.sender_address = C
    try:
        c.speak(did, "me too"); assert False, "non-debater rejected"
    except Exception:
        pass
    # B cannot speak out of turn
    mod.gl.message.sender_address = B
    try:
        c.speak(did, "again"); assert False, "out of turn"
    except Exception:
        pass
    # A takes turn, then judge
    mod.gl.message.sender_address = A
    c.speak(did, "Guardrails + consensus mitigate that.")
    out = c.judge(did)
    assert out["winner"] in ("a", "b", "tie")
    d = c.get_debate(did)
    assert d["state"] == "judged" and len(d["transcript"]) == 3
    st = c.stats()
    assert st["total_debates"] == 1 and st["judged"] == 1
    mod.gl.message.sender_address = A

def test_cannot_judge_without_both_sides(contract):
    mod, c = _new(contract)
    mod.gl.message.sender_address = A
    did = c.open_debate("Motion", "Opening only.")
    try:
        c.judge(did); assert False, "should not judge before B joins"
    except Exception:
        pass
    mod.gl.message.sender_address = A
