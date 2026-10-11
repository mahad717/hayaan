#!/usr/bin/env python3
"""Task 87: second pass — looser probes for remaining Norman concepts."""
import re

lines = open("/home/z/my-project/scripts/doet-fulltext.txt", encoding="utf-8").read().split("\n")
body = " ".join(lines[200:1700])
body = re.sub(r"\s+", " ", body)

probes = [
    (r"gulf of execution[^.]{0,200}", "GULF EXECUTION", 1),
    (r"gulf of evaluation[^.]{0,200}", "GULF EVALUATION", 1),
    (r"(?:define|defined)\s+the gulf[^.]{0,250}", "GULF DEFINE", 1),
    (r"slips? (?:as|are)[^.]{0,200}", "SLIPS", 2),
    (r"mistakes? (?:as|are)[^.]{0,200}", "MISTAKES", 2),
    (r"[Cc]onstraints?[^.]{0,30}(?:limit|restrict|narrow)[^.]{0,200}", "CONSTRAINTS", 1),
    (r"[Ff]orced functions?[^.]{0,250}", "FORCED FUNCTION", 1),
    (r"interlocks?[^.]{0,150}", "INTERLOCK", 1),
    (r"lock-?ins?[^.]{0,150}", "LOCK-IN", 1),
    (r"lock-?outs?[^.]{0,150}", "LOCK-OUT", 1),
    (r"Norman[^.]{0,40}law[^.]{0,220}", "NORMAN'S LAW", 1),
    (r"[Dd]esign(?:ing)? for error[^.]{0,220}", "DESIGN FOR ERROR", 1),
    (r"simplif(?:y|ication)[^.]{0,180}", "SIMPLIFY", 1),
    (r"[Ss]tandardiz(?:e|ation)[^.]{0,200}", "STANDARDIZE", 1),
    (r"[Pp]aradox of technology[^.]{0,300}", "PARADOX", 1),
    (r"fundamental principles of (?:interaction|design)[^.]{0,250}", "FUNDAMENTAL PRINCIPLES", 2),
]

for pat, label, n in probes:
    matches = re.findall(pat, body)
    uniq = []
    for m in matches[:n]:
        s = m.strip()
        if s and s not in uniq:
            uniq.append(s)
    for s in uniq[:1]:
        print(f"■ {label}\n  {s[:400]}\n")
    if not uniq:
        print(f"□ {label}: none\n")
