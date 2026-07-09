from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.auth.dependencies import CurrentUser
from backend.models.entities import FileRecord
from backend.rag.chroma_service import knowledge_service
from backend.schemas.files import FileMetadataRequest
from backend.services.erp_queries import list_files
from backend.services.knowledge_ingestion_service import DownloadArtifact, knowledge_ingestion_service


class FileService:
    def list_files(self, db: Session) -> list[dict]:
        return list_files(db)

    def create_file(self, db: Session, payload: FileMetadataRequest, current_user: CurrentUser) -> dict:
        prepared = knowledge_ingestion_service.prepare_text_document(
            filename=payload.filename,
            category=payload.category,
            content=payload.content,
            size_label=payload.size_label,
        )
        return self._create_record(db, prepared=prepared, current_user=current_user)

    def create_uploaded_file(
        self,
        db: Session,
        *,
        filename: str,
        category: str | None,
        raw_bytes: bytes,
        content_type: str | None,
        current_user: CurrentUser,
    ) -> dict:
        prepared = knowledge_ingestion_service.prepare_binary_document(
            filename=filename,
            category=category,
            raw_bytes=raw_bytes,
            content_type=content_type,
        )
        return self._create_record(db, prepared=prepared, current_user=current_user)

    def get_download_artifact(self, db: Session, file_code: str) -> DownloadArtifact | None:
        record = db.scalar(select(FileRecord).where(FileRecord.file_code == file_code))
        if record is None:
            return None

        return knowledge_ingestion_service.build_download_artifact(
            file_code=file_code,
            filename=record.filename,
            fallback_text=record.download_content,
        )

    def sync_repository_index(self, db: Session) -> int:
        indexed_count = 0
        rows = db.scalars(select(FileRecord).where(FileRecord.status == "indexed").order_by(FileRecord.upload_date.asc())).all()
        for record in rows:
            if not record.download_content.strip():
                continue
            knowledge_service.upsert_document(
                document_id=record.file_code,
                filename=record.filename,
                category=record.category,
                uploaded_by=record.uploaded_by,
                content=record.download_content,
            )
            indexed_count += 1
        return indexed_count

    def _create_record(self, db: Session, *, prepared, current_user: CurrentUser) -> dict:
        next_id = (db.scalar(select(func.count()).select_from(FileRecord)) or 0) + 1
        record = FileRecord(
            file_code=f"FILE-{next_id:03d}",
            filename=prepared.filename,
            category=prepared.category,
            upload_date=datetime.now(UTC),
            uploaded_by=current_user.full_name,
            status="indexed",
            size_label=prepared.size_label,
            summary="Indexing knowledge source.",
            download_content=prepared.extracted_text,
        )
        db.add(record)
        db.flush()

        try:
            knowledge_ingestion_service.persist_original(record.file_code, record.filename, prepared.raw_bytes)
            chunk_count = knowledge_service.upsert_document(
                document_id=record.file_code,
                filename=record.filename,
                category=record.category,
                uploaded_by=record.uploaded_by,
                content=record.download_content,
            )
            record.summary = knowledge_ingestion_service.build_summary(
                category=record.category,
                extracted_text=record.download_content,
                chunk_count=chunk_count,
            )
            db.commit()
            db.refresh(record)
        except Exception:
            db.rollback()
            knowledge_ingestion_service.delete_original(record.file_code)
            knowledge_service.delete_document(record.file_code)
            raise

        return self._serialize_record(record)

    def delete_file(self, db: Session, file_code: str) -> bool:
        record = db.scalar(select(FileRecord).where(FileRecord.file_code == file_code))
        if record is None:
            return False

        db.delete(record)
        db.commit()
        knowledge_service.delete_document(file_code)
        knowledge_ingestion_service.delete_original(file_code)
        return True

    def _serialize_record(self, record: FileRecord) -> dict:
        return {
            "id": record.file_code,
            "filename": record.filename,
            "category": record.category,
            "upload_date": record.upload_date.isoformat(),
            "uploaded_by": record.uploaded_by,
            "status": record.status,
            "size_label": record.size_label,
            "summary": record.summary,
            "download_content": record.download_content,
        }


file_service = FileService()
