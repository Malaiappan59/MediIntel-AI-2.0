from __future__ import annotations

from chromadb import PersistentClient

from backend.utils.settings import get_settings

settings = get_settings()


class ChromaKnowledgeService:
    def __init__(self) -> None:
        self._client = PersistentClient(path=settings.get_chromadb_path())
        self._collection = self._client.get_or_create_collection(settings.chromadb_collection)

    def upsert_document(self, *, document_id: str, filename: str, category: str, uploaded_by: str | None, content: str) -> int:
        self.delete_document(document_id)
        chunks = self._chunk_text(content)
        if not chunks:
            return 0

        chunk_count = len(chunks)
        self._collection.upsert(
            ids=[self._chunk_id(document_id, index) for index in range(chunk_count)],
            documents=chunks,
            metadatas=[
                {
                    "document_id": document_id,
                    "filename": filename,
                    "category": category,
                    "uploaded_by": uploaded_by or "Unknown",
                    "chunk_index": index + 1,
                    "chunk_count": chunk_count,
                }
                for index in range(chunk_count)
            ],
        )
        return chunk_count

    def delete_document(self, document_id: str) -> None:
        self._collection.delete(ids=[document_id])
        self._collection.delete(where={"document_id": document_id})

    def search(self, query: str, limit: int = 3) -> list[dict]:
        result = self._collection.query(query_texts=[query], n_results=max(limit * 4, limit))
        documents = result.get("documents", [[]])[0]
        metadatas = result.get("metadatas", [[]])[0]
        distances = result.get("distances", [[]])[0]
        ids = result.get("ids", [[]])[0]
        aggregated: dict[str, dict] = {}

        for index in range(len(documents)):
            metadata = metadatas[index] if index < len(metadatas) else {}
            chunk_id = ids[index] if index < len(ids) else f"chunk-{index + 1}"
            document_id = str(metadata.get("document_id") or chunk_id.split("::chunk::")[0])
            distance = distances[index] if index < len(distances) else None

            if document_id in aggregated:
                continue

            aggregated[document_id] = {
                "id": document_id,
                "content": documents[index],
                "excerpt": documents[index][:320],
                "metadata": metadata,
                "distance": distance,
                "score": round((1 / (1 + distance)) * 100, 2) if distance is not None else None,
                "chunk_id": chunk_id,
            }

        return list(aggregated.values())[:limit]

    def _chunk_text(self, content: str) -> list[str]:
        text = content.strip()
        if not text:
            return []

        chunk_size = max(settings.rag_chunk_size, 200)
        overlap = min(settings.rag_chunk_overlap, chunk_size - 1)
        chunks: list[str] = []
        start = 0

        while start < len(text):
            end = min(start + chunk_size, len(text))
            if end < len(text):
                window = text[start:end]
                split_at = max(window.rfind("\n\n"), window.rfind(". "), window.rfind("\n"))
                if split_at > chunk_size // 2:
                    end = start + split_at + 1

            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)

            if end >= len(text):
                break
            start = max(end - overlap, start + 1)

        return chunks

    def _chunk_id(self, document_id: str, index: int) -> str:
        return f"{document_id}::chunk::{index + 1:03d}"


knowledge_service = ChromaKnowledgeService()
