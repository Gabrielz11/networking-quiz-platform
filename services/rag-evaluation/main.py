# services/rag-evaluation/main.py
#
# Servidor FastAPI para avaliação de confiabilidade RAGAS (Faithfulness).
# Expõe POST /evaluate e GET /health.
# Executar com: uvicorn main:app --host 127.0.0.1 --port 8000

import asyncio
import logging

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException

from schemas import EvaluationRequest, EvaluationResponse
from ragas_service import evaluate_faithfulness

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] [%(name)s] %(levelname)s: %(message)s",
)
logger = logging.getLogger("rag-evaluation")

app = FastAPI(
    title="Lumina LMS — RAG Evaluation Service",
    description="Microsserviço de avaliação de confiabilidade de conteúdo educacional via RAGAS.",
    version="1.0.0",
)

# Timeout interno para a avaliação (segundos)
EVALUATION_TIMEOUT_SECONDS = 300


@app.get("/health")
async def health():
    """Verificação de integridade do serviço."""
    return {"status": "ok"}


@app.post("/evaluate", response_model=EvaluationResponse)
async def evaluate(request: EvaluationRequest):
    """
    Executa a métrica Faithfulness do RAGAS sobre o conteúdo gerado.

    Recebe user_input, generated_content (response) e retrieved_contexts.
    Retorna o score de fidelidade (0.0 a 1.0).
    """
    logger.info(
        "[RAG Evaluation] evaluation started | evaluationId=%s | moduleId=%s",
        request.evaluation_id,
        request.module_id,
    )

    try:
        result = await asyncio.wait_for(
            evaluate_faithfulness(
                user_input=request.user_input,
                response=request.generated_content,
                retrieved_contexts=request.retrieved_contexts,
                model_name=request.model,
            ),
            timeout=EVALUATION_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.error(
            "[RAG Evaluation] timeout após %ds | evaluationId=%s",
            EVALUATION_TIMEOUT_SECONDS,
            request.evaluation_id,
        )
        raise HTTPException(
            status_code=504,
            detail=f"Avaliação excedeu o timeout de {EVALUATION_TIMEOUT_SECONDS}s.",
        )
    except Exception as e:
        logger.error(
            "[RAG Evaluation] failed | evaluationId=%s | error=%s",
            request.evaluation_id,
            str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Erro na avaliação RAGAS: {str(e)}",
        )

    logger.info(
        "[RAG Evaluation] completed | evaluationId=%s | score=%.4f",
        request.evaluation_id,
        result["score"],
    )

    return EvaluationResponse(
        evaluation_id=request.evaluation_id,
        score=result["score"],
        evaluator="ragas",
        evaluator_version=result["evaluator_version"],
        details=result.get("details"),
    )
