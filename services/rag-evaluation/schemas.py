# services/rag-evaluation/schemas.py
#
# Schemas Pydantic para validação de request/response do endpoint de avaliação.

from pydantic import BaseModel, Field
from typing import List, Optional


class EvaluationRequest(BaseModel):
    """Payload recebido do worker Node.js."""

    evaluation_id: str
    module_id: str
    user_input: str                     # query / instrução de geração
    generated_content: str              # resposta gerada pela IA
    retrieved_contexts: List[str]       # textos dos chunks recuperados
    provider: str = "google"
    model: str = "gemini-3.6-flash"


class EvaluationResponse(BaseModel):
    """Resultado retornado ao worker Node.js."""

    evaluation_id: str
    score: float = Field(..., ge=0.0, le=1.0)
    evaluator: str = "ragas"
    evaluator_version: str
    details: Optional[dict] = None
