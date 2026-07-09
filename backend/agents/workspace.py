import asyncio
import json
import os
import time
from datetime import UTC, datetime

from backend.agents.models import ActionItem, ContributionItem, ExecutionPlan, KnowledgeSourceItem, SpecialistResult, SummaryBlock, WorkspaceReply
from backend.auth.dependencies import CurrentUser
from backend.services.knowledge_retrieval_service import search_knowledge_context
from backend.tools.runtime import ToolRuntimeContext, tool_runtime
from backend.utils.settings import get_settings

settings = get_settings()


class AIConfigurationError(RuntimeError):
    """Raised when the OpenAI agent runtime is unavailable."""


class AIExecutionError(RuntimeError):
    """Raised when the OpenAI agent runtime fails during execution."""


class WorkspaceAgentService:
    def _load_sdk(self):
        api_key = settings.get_openai_api_key()
        if not api_key:
            raise AIConfigurationError("OPENAI_API_KEY is not configured for MediIntel AI.")

        os.environ["OPENAI_API_KEY"] = api_key

        try:
            from agents import Agent, Runner
        except ImportError as exc:
            raise AIConfigurationError("The openai-agents package is not installed.") from exc

        try:
            from backend.tools import erp_tools
        except Exception as exc:  # pragma: no cover - import protection
            raise AIConfigurationError("Tool registration failed for the MediIntel agent runtime.") from exc

        return Agent, Runner, erp_tools

    async def _run_agent(self, Runner, agent, payload: str, *, failure_message: str):
        try:
            return await asyncio.wait_for(
                Runner.run(agent, payload),
                timeout=settings.openai_request_timeout_seconds,
            )
        except TimeoutError as exc:
            raise AIExecutionError(f"{failure_message} timed out.") from exc
        except Exception as exc:  # pragma: no cover - protects external agent runtime
            raise AIExecutionError(failure_message) from exc

    def _planner_instructions(self, user: CurrentUser) -> str:
        return (
            "You are the MediIntel Master Agent planner for a hospital inventory platform. "
            "Understand the user request, classify the intent, choose the minimum set of specialist agents needed, "
            "and return only the structured execution plan. Available agents are Inventory Agent, Forecast Agent, "
            "Recommendation Agent, and Procurement Agent. The Procurement Agent can also handle explicit supplier or stakeholder notification requests. "
            "When the user asks to create, approve, reject, notify, or execute something, route the plan to Procurement Agent. "
            "Always include Inventory Agent when the request involves shortages, risk, or procurement. "
            f"Current operator: {user.full_name} ({user.role})."
        )

    def _specialist_instructions(self, name: str) -> str:
        domain_map = {
            "Inventory Agent": "Analyse current inventory posture, stock buffers, and at-risk medicines.",
            "Forecast Agent": "Analyse forecast, shortage exposure, and near-term demand risk.",
            "Recommendation Agent": "Evaluate recommendations, compare scenarios, and justify the best operational path.",
            "Procurement Agent": "Review procurement readiness, approvals, supplier options, execution steps, and operational notification handoffs. Execute tools when the user explicitly asks to create, approve, reject, or notify.",
        }
        return (
            f"You are the {name} for MediIntel. {domain_map[name]} "
            "Use tools when you need real data. When the user asks for an operational action, execute the appropriate tool instead of only describing it. Return only a structured result with concrete findings, metrics, "
            "a table when appropriate, concise recommendations, and grounded sources when knowledge or policy context is relevant."
        )

    def _synthesizer_instructions(self, user: CurrentUser) -> str:
        return (
            "You are the MediIntel Master Agent synthesizer. Merge the specialist findings into a single enterprise response. "
            "Return a structured workspace reply. Never write long paragraphs. Use concise executive language, "
            "include actions that the frontend can surface, include grounded source cards whenever retrieval context exists, "
            "and keep the response grounded in the specialist findings only. "
            f"The logged-in user is {user.full_name}."
        )

    def _merge_sources(
        self,
        reply: WorkspaceReply,
        specialist_outputs: list[SpecialistResult],
        knowledge_context: list[dict],
    ) -> None:
        merged: dict[str, KnowledgeSourceItem] = {}

        for source in reply.sources:
            merged[source.id] = self._normalize_source_score(source)

        for result in specialist_outputs:
            for source in result.sources:
                merged.setdefault(source.id, self._normalize_source_score(source))

        if not merged:
            for source in knowledge_context:
                normalized = self._normalize_source_score(KnowledgeSourceItem.model_validate(source))
                merged[normalized.id] = normalized

        reply.sources = list(merged.values())[:4]

    def _normalize_source_score(self, source: KnowledgeSourceItem) -> KnowledgeSourceItem:
        if source.score is not None and source.score <= 1:
            source.score = round(source.score * 100, 2)
        return source

    async def run_workspace_query(self, current_user: CurrentUser, message: str) -> tuple[WorkspaceReply, ExecutionPlan, int]:
        Agent, Runner, erp_tools = self._load_sdk()
        knowledge_context = search_knowledge_context(message, limit=4)
        runtime = ToolRuntimeContext(
            username=current_user.username,
            full_name=current_user.full_name,
            email=current_user.email,
            role=current_user.role,
        )
        started_at = time.perf_counter()

        planner_agent = Agent(
            name="MediIntel Planner",
            model=settings.openai_model,
            instructions=self._planner_instructions(current_user),
            output_type=ExecutionPlan,
        )

        specialist_agents = {
            "Inventory Agent": Agent(
                name="Inventory Agent",
                model=settings.openai_model,
                instructions=self._specialist_instructions("Inventory Agent"),
                tools=[erp_tools.inventory_snapshot, erp_tools.alert_snapshot, erp_tools.knowledge_search],
                output_type=SpecialistResult,
            ),
            "Forecast Agent": Agent(
                name="Forecast Agent",
                model=settings.openai_model,
                instructions=self._specialist_instructions("Forecast Agent"),
                tools=[erp_tools.forecast_snapshot, erp_tools.inventory_snapshot, erp_tools.knowledge_search],
                output_type=SpecialistResult,
            ),
            "Recommendation Agent": Agent(
                name="Recommendation Agent",
                model=settings.openai_model,
                instructions=self._specialist_instructions("Recommendation Agent"),
                tools=[erp_tools.inventory_snapshot, erp_tools.forecast_snapshot, erp_tools.supplier_comparison, erp_tools.alert_snapshot, erp_tools.knowledge_search],
                output_type=SpecialistResult,
            ),
            "Procurement Agent": Agent(
                name="Procurement Agent",
                model=settings.openai_model,
                instructions=self._specialist_instructions("Procurement Agent"),
                tools=[
                    erp_tools.procurement_snapshot,
                    erp_tools.supplier_comparison,
                    erp_tools.inventory_snapshot,
                    erp_tools.knowledge_search,
                    erp_tools.create_procurement_request,
                    erp_tools.approve_procurement_request,
                    erp_tools.reject_procurement_request,
                    erp_tools.send_notification_email,
                ],
                output_type=SpecialistResult,
            ),
        }

        synthesizer = Agent(
            name="MediIntel Synthesizer",
            model=settings.openai_model,
            instructions=self._synthesizer_instructions(current_user),
            output_type=WorkspaceReply,
        )

        with tool_runtime(runtime):
            planner_result = await self._run_agent(
                Runner,
                planner_agent,
                json.dumps(
                    {
                        "user": current_user.full_name,
                        "role": current_user.role,
                        "message": message,
                    }
                ),
                failure_message="MediIntel planner could not classify the request.",
            )

            plan = planner_result.final_output
            if not plan.agents_required:
                plan.agents_required = ["Inventory Agent", "Forecast Agent"]

            specialist_outputs: list[SpecialistResult] = []
            for agent_name in plan.agents_required:
                agent = specialist_agents.get(agent_name)
                if agent is None:
                    continue
                result = await self._run_agent(
                    Runner,
                    agent,
                    json.dumps(
                        {
                            "intent": plan.intent,
                            "goal": plan.goal,
                            "message": message,
                            "user": current_user.full_name,
                            "knowledge_context": knowledge_context,
                        }
                    ),
                    failure_message=f"{agent_name} could not complete its specialist analysis.",
                )
                specialist_outputs.append(result.final_output)

            synth_input = json.dumps(
                {
                    "user": current_user.full_name,
                    "intent": plan.intent,
                    "goal": plan.goal,
                    "message": message,
                    "agents_used": plan.agents_required,
                    "findings": [finding.model_dump(mode="json") for finding in specialist_outputs],
                    "grounding_context": knowledge_context,
                    "response_contract": {
                        "actions": [
                            "Use frontend-safe action ids and prompts.",
                            "Keep tables structured.",
                            "Keep confidence as a percentage from 0 to 100.",
                        ],
                        "sources": [
                            "Use the sources array for grounded policy, contract, or knowledge evidence.",
                            "Each source should include id, filename, category, excerpt, score, and strategy.",
                        ],
                    },
                }
            )
            final_result = await self._run_agent(
                Runner,
                synthesizer,
                synth_input,
                failure_message="MediIntel synthesizer could not assemble the final response.",
            )
            reply = final_result.final_output

        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        reply.id = reply.id or f"CHAT-{int(time.time() * 1000)}"
        reply.user = current_user.full_name
        reply.created_at = reply.created_at or datetime.now(UTC).isoformat()
        reply.agents_used = reply.agents_used or plan.agents_required
        reply.runtime_mode = reply.runtime_mode or "live"
        if not reply.summary.headline and not reply.summary.narrative:
            reply.summary = SummaryBlock(
                headline="MediIntel AI response",
                narrative="The specialist agents completed the requested hospital operations review.",
                metrics=[],
            )
        reply.actions = reply.actions or []
        reply.contributions = reply.contributions or [
            ContributionItem(
                id=f"contribution-{index + 1}",
                agent=result.agent,
                summary=result.summary,
                detail=result.detail,
                status=result.status,
            )
            for index, result in enumerate(specialist_outputs)
        ]
        self._merge_sources(reply, specialist_outputs, knowledge_context)
        return reply, plan, elapsed_ms


workspace_agent_service = WorkspaceAgentService()
