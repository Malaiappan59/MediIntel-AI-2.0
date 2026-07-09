from contextlib import contextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Iterator


@dataclass(slots=True)
class ToolRuntimeContext:
    username: str
    full_name: str
    email: str
    role: str


_runtime_context: ContextVar[ToolRuntimeContext | None] = ContextVar("medintel_tool_runtime_context", default=None)


@contextmanager
def tool_runtime(context: ToolRuntimeContext) -> Iterator[None]:
    token: Token[ToolRuntimeContext | None] = _runtime_context.set(context)
    try:
        yield
    finally:
        _runtime_context.reset(token)


def get_runtime_context() -> ToolRuntimeContext:
    context = _runtime_context.get()
    if context is None:
        raise RuntimeError("Tool runtime context is not available.")
    return context
