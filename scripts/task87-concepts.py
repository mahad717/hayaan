#!/usr/bin/env python3
"""Task 87: pull definitional passages for Norman's core concepts from extracted fulltext."""
import re

text = open("/home/z/my-project/scripts/doet-fulltext.txt", encoding="utf-8").read()
joined = re.sub(r"\s+", " ", text)

terms = [
    "Affordances",
    "Signifiers",
    "Mapping",
    "Feedback",
    "Conceptual model",
    "Constraint",
    "Seven stages",
    "Slips",
    "Mistakes",
    "Forced",
    "knowledge in the world",
    "knowledge in the head",
    "Discoverability",
    "paradox of technology",
    "design thinking",
]

for t in terms:
    pat = re.compile(re.escape(t) + r"[^.]{0,60}(?:are|is|refer|defined|mean|term|word)[^.]*\.", re.I)
    m = pat.search(joined)
    if m:
        print("■", t.upper(), "\n ", m.group(0)[:450], "\n")
    else:
        # fallback: first occurrence context
        i = joined.lower().find(t.lower())
        if i >= 0:
            print("□", t.upper(), "(context)\n ", joined[i : i + 380], "\n")
