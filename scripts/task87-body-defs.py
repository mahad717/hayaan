#!/usr/bin/env python3
"""Task 87: pull definitional passages from BODY text only (skip TOC region)."""
import re

lines = open("/home/z/my-project/scripts/doet-fulltext.txt", encoding="utf-8").read().split("\n")
body = " ".join(lines[200:1700])  # chapters 1-7 body region
body = re.sub(r"\s+", " ", body)

probes = [
    (r"An affordance[^.]{5,300}\.", "AFFORDANCE def"),
    (r"signifiers? (?:are|is)[^.]{5,300}\.", "SIGNIFIER def"),
    (r"affordance[^.]{0,80}relationship[^.]{5,250}\.", "AFFORDANCE relationship"),
    (r"signifier[^.]{0,60}(?:any mark|sound|label)[^.]{5,250}\.", "SIGNIFIER any mark"),
    (r"mapping[^.]{0,100}(?:relationship between)[^.]{5,250}\.", "MAPPING def"),
    (r"Feedback[^.]{0,60}(?:communicating|some way|immediately)[^.]{5,250}\.", "FEEDBACK def"),
    (r"A conceptual model[^.]{5,300}\.", "CONCEPTUAL MODEL def"),
    (r"(?:The )?gulf of execution[^.]{5,250}\.", "GULF EXECUTION"),
    (r"(?:The )?gulf of evaluation[^.]{5,250}\.", "GULF EVALUATION"),
    (r"Seven stages of action[^.]{5,250}\.", "SEVEN STAGES"),
    (r"(?:Constraints?)[^.]{0,80}(?:physical|cultural|semantic|logical)[^.]{5,200}\.", "CONSTRAINTS"),
    (r"[Ss]lips?[^.]{0,60}(?:result from automatic|unconscious|incorrect performance)[^.]{5,220}\.", "SLIPS def"),
    (r"[Mm]istakes?[^.]{0,60}(?:conscious|deliberate|planning|wrong goal)[^.]{5,220}\.", "MISTAKES def"),
    (r"[Kk]nowledge in the world[^.]{0,40}(?:is|as)[^.]{5,220}\.", "KNOWLEDGE WORLD"),
    (r"[Kk]nowledge in the head[^.]{0,40}(?:is|as)[^.]{5,220}\.", "KNOWLEDGE HEAD"),
    (r"Human-centered design[^.]{5,250}\.", "HCD def"),
    (r"double-diamond[^.]{5,220}\.", "DOUBLE DIAMOND"),
    (r"[Ff]orced functions?[^.]{5,220}\.", "FORCED FUNCTION"),
    (r" Norman's law[^.]{5,200}\.", "NORMAN'S LAW"),
    (r"design for error[^.]{5,200}\.", "DESIGN FOR ERROR"),
    (r"paradox of technology[^.]{5,260}\.", "PARADOX TECH"),
]

seen = set()
for pat, label in probes:
    m = re.search(pat, body)
    if m and m.group(0)[:80] not in seen:
        seen.add(m.group(0)[:80])
        print(f"■ {label}\n  {m.group(0)[:430]}\n")
    else:
        print(f"□ {label}: no match\n")
