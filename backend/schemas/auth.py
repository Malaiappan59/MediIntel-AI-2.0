from typing import Literal

from pydantic import BaseModel, Field

UserRole = Literal["Admin", "Inventory Manager", "Procurement Manager", "Pharmacist", "Auditor", "Viewer"]


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)
    role: UserRole


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=16)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


class UserProfileResponse(BaseModel):
    id: int
    username: str
    full_name: str
    email: str
    role: UserRole
    permissions: list[str]


class AuthTokensResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class AuthResponse(BaseModel):
    user: UserProfileResponse
    tokens: AuthTokensResponse


class LogoutResponse(BaseModel):
    message: str
