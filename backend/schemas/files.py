from pydantic import BaseModel, Field


class FileResponse(BaseModel):
    id: str
    filename: str
    category: str
    upload_date: str
    uploaded_by: str | None = None
    status: str
    size_label: str
    summary: str
    download_content: str


class FileCreateResponse(BaseModel):
    message: str
    file: FileResponse


class FileMetadataRequest(BaseModel):
    filename: str = Field(..., min_length=2)
    category: str = Field(..., min_length=2)
    content: str = Field(..., min_length=1)
    size_label: str = Field(..., min_length=2)
