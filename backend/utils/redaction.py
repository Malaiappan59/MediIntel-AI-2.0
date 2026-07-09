import hashlib
import re

_REDACTION_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b"), "[REDACTED_SECRET]"),
    (re.compile(r"\bBearer\s+[A-Za-z0-9._-]+\b", flags=re.IGNORECASE), "[REDACTED_BEARER_TOKEN]"),
    (re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"), "[REDACTED_EMAIL]"),
    (re.compile(r"\b(?:MRN|UHID|PATIENT[\s_-]?ID)[:#\s-]*[A-Za-z0-9-]+\b", flags=re.IGNORECASE), "[REDACTED_PATIENT_ID]"),
    (re.compile(r"\b(?:\+?\d[\d\s().-]{7,}\d)\b"), "[REDACTED_PHONE]"),
    (re.compile(r"\b\d{8,}\b"), "[REDACTED_LONG_NUMBER]"),
)


def redact_sensitive_text(value: str | None, *, max_length: int = 220) -> str:
    if not value:
        return "No detail provided."

    normalized = " ".join(value.split())
    for pattern, replacement in _REDACTION_PATTERNS:
        normalized = pattern.sub(replacement, normalized)

    if len(normalized) > max_length:
        normalized = normalized[: max_length - 3].rstrip() + "..."

    return normalized or "No detail provided."


def build_audit_safe_prompt_detail(value: str | None) -> str:
    normalized = " ".join((value or "").split())
    fingerprint = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:12] if normalized else "empty"
    preview = redact_sensitive_text(normalized, max_length=180)
    return f"Prompt fingerprint={fingerprint}; preview={preview}"
