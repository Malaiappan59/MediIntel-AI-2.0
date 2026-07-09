from __future__ import annotations

from collections import Counter
from math import sqrt


def cosine_similarity(left: Counter[str], right: Counter[str]) -> float:
    numerator = sum(left[token] * right[token] for token in left.keys() & right.keys())
    left_norm = sqrt(sum(value * value for value in left.values()))
    right_norm = sqrt(sum(value * value for value in right.values()))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return numerator / (left_norm * right_norm)


def score_documents(query: str, documents: list[dict], key: str = "download_content") -> list[dict]:
    query_terms = Counter(query.lower().split())
    scored = []

    for document in documents:
        content_terms = Counter(document[key].lower().split())
        score = cosine_similarity(query_terms, content_terms)
        scored.append({"score": round(score, 4), "document": document})

    return sorted(scored, key=lambda item: item["score"], reverse=True)
