from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.audit.service import audit_service
from backend.auth.dependencies import CurrentUser, get_current_user, require_permissions
from backend.database.session import get_db_session
from backend.schemas.files import FileCreateResponse, FileMetadataRequest, FileResponse
from backend.services.file_service import file_service

router = APIRouter()


@router.get("/files", response_model=list[FileResponse])
def list_files(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> list[FileResponse]:
    return [FileResponse(**file_record) for file_record in file_service.list_files(db)]


@router.get("/knowledge", response_model=list[FileResponse])
def list_knowledge(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> list[FileResponse]:
    return [FileResponse(**file_record) for file_record in file_service.list_files(db)]


@router.post("/upload", response_model=FileCreateResponse)
async def upload_file(
    request: Request,
    current_user: CurrentUser = Depends(require_permissions("knowledge.upload")),
    db: Session = Depends(get_db_session),
) -> FileCreateResponse:
    try:
        content_type = request.headers.get("content-type", "")
        if "multipart/form-data" in content_type:
            form = await request.form()
            uploaded_file = form.get("file")
            if uploaded_file is None or not hasattr(uploaded_file, "read"):
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A file upload is required.")

            created = file_service.create_uploaded_file(
                db,
                filename=str(getattr(uploaded_file, "filename", "") or ""),
                category=str(form.get("category") or "").strip() or None,
                raw_bytes=await uploaded_file.read(),
                content_type=str(getattr(uploaded_file, "content_type", "") or "") or None,
                current_user=current_user,
            )
        else:
            payload = FileMetadataRequest.model_validate(await request.json())
            created = file_service.create_file(db, payload, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

    audit_service.log_event(
        db,
        current_user=current_user,
        agent="Knowledge Repository",
        tool="knowledge.upload",
        action="Knowledge Upload",
        entity_type="File",
        entity_id=created["id"],
        status="completed",
        detail=f"{created['filename']} uploaded to {created['category']}.",
    )
    db.commit()
    return FileCreateResponse(message="File uploaded successfully.", file=FileResponse(**created))


@router.delete("/files/{file_id}")
def delete_file(
    file_id: str,
    current_user: CurrentUser = Depends(require_permissions("knowledge.delete")),
    db: Session = Depends(get_db_session),
) -> dict:
    deleted = file_service.delete_file(db, file_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    audit_service.log_event(
        db,
        current_user=current_user,
        agent="Knowledge Repository",
        tool="knowledge.delete",
        action="Knowledge Delete",
        entity_type="File",
        entity_id=file_id,
        status="completed",
        detail=f"{file_id} removed from the knowledge repository.",
    )
    db.commit()
    return {"message": "File deleted successfully."}


@router.delete("/knowledge/{file_id}")
def delete_knowledge_file(
    file_id: str,
    current_user: CurrentUser = Depends(require_permissions("knowledge.delete")),
    db: Session = Depends(get_db_session),
) -> dict:
    deleted = file_service.delete_file(db, file_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    audit_service.log_event(
        db,
        current_user=current_user,
        agent="Knowledge Repository",
        tool="knowledge.delete",
        action="Knowledge Delete",
        entity_type="File",
        entity_id=file_id,
        status="completed",
        detail=f"{file_id} removed from the knowledge repository.",
    )
    db.commit()
    return {"message": "File deleted successfully."}


def _download_response(file_id: str, db: Session) -> Response:
    artifact = file_service.get_download_artifact(db, file_id)
    if artifact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    safe_filename = artifact.filename.replace('"', "")
    return Response(
        content=artifact.content,
        media_type=artifact.content_type,
        headers={"Content-Disposition": f'attachment; filename="{safe_filename}"'},
    )


@router.get("/files/{file_id}/download")
def download_file(
    file_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> Response:
    return _download_response(file_id, db)


@router.get("/knowledge/{file_id}/download")
def download_knowledge_file(
    file_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> Response:
    return _download_response(file_id, db)
