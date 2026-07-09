from __future__ import annotations

from backend.database.session import SessionLocal
from backend.rag.chroma_service import knowledge_service
from backend.services.erp_queries import list_files
from backend.services.rag_service import score_documents


def search_knowledge_context(query: str, *, limit: int = 3) -> list[dict]:
    indexed_results = knowledge_service.search(query, limit=limit)
    normalized = [_normalize_indexed_result(item) for item in indexed_results]
    normalized = [item for item in normalized if item["id"] and item["excerpt"]]
    if normalized:
        return normalized[:limit]

    with SessionLocal() as db:
        fallback_results = score_documents(query, list_files(db))
        return [
            {
                "id": item["document"]["id"],
                "filename": item["document"]["filename"],
                "category": item["document"]["category"],
                "excerpt": item["document"]["download_content"][:280],
                "score": round(item["score"] * 100, 2),
                "strategy": "lexical-fallback",
            }
            for item in fallback_results[:limit]
            if item["score"] > 0
        ]


def _normalize_indexed_result(item: dict) -> dict:
    metadata = item.get("metadata") or {}
    return {
        "id": str(item.get("id") or metadata.get("document_id") or ""),
        "filename": str(metadata.get("filename") or "Knowledge Source"),
        "category": str(metadata.get("category") or "Knowledge"),
        "excerpt": str(item.get("excerpt") or item.get("content") or "")[:280],
        "score": float(item["score"]) if item.get("score") is not None else None,
        "strategy": str(item.get("source") or "vector-search"),
    }
