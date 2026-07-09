import os
from functools import lru_cache
from pathlib import Path
import tempfile

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_CHROMADB_PATH = "./chromadb"
DEFAULT_UPLOADS_PATH = "./uploads"


class Settings(BaseSettings):
    app_name: str = "MediIntel API"
    environment: str = Field(default="development", validation_alias=AliasChoices("NODE_ENV", "ENVIRONMENT"))
    database_url: str = Field(
        default="postgresql+psycopg://medintel:medintel@database:5432/medintel",
        validation_alias="DATABASE_URL",
    )
    database_connect_max_retries: int = Field(default=30, validation_alias="DATABASE_CONNECT_MAX_RETRIES")
    database_connect_retry_seconds: float = Field(default=2.0, validation_alias="DATABASE_CONNECT_RETRY_SECONDS")
    chromadb_path: str = Field(default=DEFAULT_CHROMADB_PATH, validation_alias="CHROMADB_PATH")
    chromadb_collection: str = Field(default="medintel_knowledge", validation_alias="CHROMADB_COLLECTION")
    uploads_path: str = Field(default=DEFAULT_UPLOADS_PATH, validation_alias="UPLOADS_PATH")
    rag_chunk_size: int = Field(default=1200, validation_alias="RAG_CHUNK_SIZE")
    rag_chunk_overlap: int = Field(default=200, validation_alias="RAG_CHUNK_OVERLAP")
    openai_request_timeout_seconds: int = Field(default=45, validation_alias="OPENAI_REQUEST_TIMEOUT_SECONDS")
    agent_degraded_mode_enabled: bool = Field(default=False, validation_alias="AGENT_DEGRADED_MODE_ENABLED")
    jwt_secret_key: SecretStr = Field(default=SecretStr("change-me-in-production"), validation_alias="JWT_SECRET_KEY")
    jwt_secret_key_file: str | None = Field(default=None, validation_alias="JWT_SECRET_KEY_FILE")
    jwt_algorithm: str = Field(default="HS256", validation_alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(default=60, validation_alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES")
    jwt_refresh_token_expire_days: int = Field(default=7, validation_alias="JWT_REFRESH_TOKEN_EXPIRE_DAYS")
    run_db_migrations: bool = Field(default=True, validation_alias="RUN_DB_MIGRATIONS")
    seed_mock_data: bool = Field(default=False, validation_alias="SEED_MOCK_DATA")
    backend_cors_origins: str = Field(default="http://localhost:3000", validation_alias="BACKEND_CORS_ORIGINS")
    frontend_app_url: str = Field(default="http://localhost:3000", validation_alias="FRONTEND_APP_URL")
    openai_api_key: SecretStr | None = Field(default=None, validation_alias="OPENAI_API_KEY")
    openai_api_key_file: str | None = Field(default=None, validation_alias="OPENAI_API_KEY_FILE")
    openai_model: str = Field(default="gpt-4.1", validation_alias="OPENAI_MODEL")
    smtp_host: str | None = Field(default=None, validation_alias="SMTP_HOST")
    smtp_port: int = Field(default=587, validation_alias="SMTP_PORT")
    smtp_username: str | None = Field(default=None, validation_alias="SMTP_USERNAME")
    smtp_password: SecretStr | None = Field(default=None, validation_alias="SMTP_PASSWORD")
    smtp_password_file: str | None = Field(default=None, validation_alias="SMTP_PASSWORD_FILE")
    sendgrid_api_key: SecretStr | None = Field(default=None, validation_alias="SENDGRID_API_KEY")
    sendgrid_api_key_file: str | None = Field(default=None, validation_alias="SENDGRID_API_KEY_FILE")
    email_from: str = Field(default="mediintel@citycarehospital.org", validation_alias="EMAIL_FROM")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def backend_cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in {"production", "prod"}

    @property
    def is_vercel(self) -> bool:
        return os.getenv("VERCEL") == "1" or bool(os.getenv("VERCEL_ENV"))

    def get_jwt_secret_key(self) -> str:
        return self._resolve_secret(self.jwt_secret_key, self.jwt_secret_key_file, env_name="JWT_SECRET_KEY") or "change-me-in-production"

    def get_openai_api_key(self) -> str | None:
        return self._resolve_secret(self.openai_api_key, self.openai_api_key_file, env_name="OPENAI_API_KEY")

    def get_smtp_password(self) -> str | None:
        return self._resolve_secret(self.smtp_password, self.smtp_password_file, env_name="SMTP_PASSWORD")

    def get_sendgrid_api_key(self) -> str | None:
        return self._resolve_secret(self.sendgrid_api_key, self.sendgrid_api_key_file, env_name="SENDGRID_API_KEY")

    def get_chromadb_path(self) -> str:
        return self._resolve_runtime_path(self.chromadb_path, default_relative_path=DEFAULT_CHROMADB_PATH)

    def get_uploads_path(self) -> str:
        return self._resolve_runtime_path(self.uploads_path, default_relative_path=DEFAULT_UPLOADS_PATH)

    def runtime_warnings(self) -> list[str]:
        warnings: list[str] = []
        jwt_secret = self.get_jwt_secret_key()
        if jwt_secret == "change-me-in-production":
            warnings.append("JWT_SECRET_KEY is using the default development placeholder.")
        if len(jwt_secret) < 32:
            warnings.append("JWT_SECRET_KEY should be at least 32 characters for a stronger signing posture.")
        if not self.get_openai_api_key():
            warnings.append("OPENAI_API_KEY is not configured. MediIntel AI chat will fail until the live model runtime is configured.")
        if self.get_openai_api_key() and not self.get_openai_api_key().startswith("sk-"):
            warnings.append("OPENAI_API_KEY does not look like a standard OpenAI API key.")
        if self.is_vercel:
            if self.run_db_migrations:
                warnings.append(
                    "RUN_DB_MIGRATIONS is enabled, but the Vercel backend path expects migrations to be executed separately from function startup."
                )
            if self.seed_mock_data:
                warnings.append(
                    "SEED_MOCK_DATA is enabled, but the Vercel backend path expects seed loading to be executed separately from function startup."
                )
            warnings.append(
                f"Vercel runtime detected. Upload storage is using {self.get_uploads_path()}, which is ephemeral and should be replaced with managed object storage."
            )
            warnings.append(
                f"Vercel runtime detected. Knowledge index storage is using {self.get_chromadb_path()}, which is ephemeral and should be replaced with managed vector storage."
            )
        return warnings

    def validate_runtime(self) -> None:
        jwt_secret = self.get_jwt_secret_key()
        errors: list[str] = []

        if self.is_production:
            if jwt_secret == "change-me-in-production":
                errors.append("JWT_SECRET_KEY must be replaced before running in production.")
            if len(jwt_secret) < 32:
                errors.append("JWT_SECRET_KEY must be at least 32 characters in production.")

        if errors:
            raise RuntimeError("Invalid runtime configuration: " + " ".join(errors))

    def _resolve_secret(self, direct_value: SecretStr | None, file_path: str | None, *, env_name: str) -> str | None:
        if file_path and file_path.strip():
            path = Path(file_path.strip()).expanduser()
            if not path.is_absolute():
                path = Path.cwd() / path
            try:
                return path.read_text(encoding="utf-8").strip() or None
            except OSError as exc:
                raise RuntimeError(f"Unable to read {env_name}_FILE from {path}.") from exc

        if direct_value is None:
            return None

        normalized = direct_value.get_secret_value().strip()
        return normalized or None

    def _resolve_runtime_path(self, configured_path: str, *, default_relative_path: str) -> str:
        normalized = configured_path.strip() or default_relative_path

        if self.is_vercel and normalized in {default_relative_path, default_relative_path.removeprefix("./")}:
            temporary_root = Path(tempfile.gettempdir()) / "medintel-runtime"
            temporary_root.mkdir(parents=True, exist_ok=True)
            suffix = Path(default_relative_path).name
            return str((temporary_root / suffix).resolve())

        path = Path(normalized).expanduser()
        if not path.is_absolute():
            path = Path.cwd() / path
        return str(path.resolve())


@lru_cache
def get_settings() -> Settings:
    return Settings()
