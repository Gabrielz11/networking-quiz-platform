# services/rag-evaluation/ragas_service.py
#
# Lógica de avaliação Faithfulness usando RAGAS 0.4.3 + Gemini via google-genai SDK.
# Recebe user_input, response e retrieved_contexts, e retorna o score e diagnósticos detalhados.

import os
import time
import asyncio
import logging
from ragas_adapter import RagasFaithfulnessAdapter

logger = logging.getLogger("rag-evaluation")


async def evaluate_faithfulness(
    user_input: str,
    response: str,
    retrieved_contexts: list[str],
    model_name: str = "gemini-3.6-flash",
) -> dict:
    """
    Executa a métrica Faithfulness do RAGAS para avaliar se as afirmações
    na resposta gerada podem ser inferidas a partir dos contextos recuperados.

    Retorna dict com 'score' (float 0-1), 'evaluator_version' (str) e 'details' (dict).
    """
    import ragas
    from google import genai
    from ragas.llms import llm_factory
    from ragas.metrics.collections import Faithfulness

    start_time = time.time()

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY não está configurada no ambiente.")

    client = genai.Client(api_key=api_key)

    evaluator_llm = llm_factory(
        model_name,
        provider="google",
        client=client,
    )

    # Garante suporte assíncrono e resiliência contra erros 503/429 do Gemini
    orig_agenerate = evaluator_llm.agenerate

    async def _patched_agenerate(prompt, response_model=None):
        max_retries = 3
        delay = 2.0
        for attempt in range(1, max_retries + 1):
            try:
                try:
                    return await orig_agenerate(prompt, response_model)
                except TypeError:
                    return await asyncio.to_thread(evaluator_llm.generate, prompt, response_model)
            except Exception as e:
                err_str = str(e)
                if ("503" in err_str or "429" in err_str or "UNAVAILABLE" in err_str or "HIGH_DEMAND" in err_str.upper()) and attempt < max_retries:
                    logger.warning("Gemini 503/429 detectado (tentativa %d/%d). Aguardando %.1fs...", attempt, max_retries, delay)
                    await asyncio.sleep(delay)
                    delay *= 2
                else:
                    raise e

    evaluator_llm.agenerate = _patched_agenerate

    metric = Faithfulness(llm=evaluator_llm)
    adapter = RagasFaithfulnessAdapter(metric)

    logger.info(
        "Iniciando avaliação Faithfulness | model=%s | user_input_len=%d | response_len=%d | contexts=%d",
        model_name,
        len(user_input),
        len(response),
        len(retrieved_contexts),
    )

    score, details = await adapter.evaluate_with_diagnostics(
        user_input=user_input,
        response=response,
        retrieved_contexts=retrieved_contexts,
    )

    latency_ms = int((time.time() - start_time) * 1000)

    # Injeta metadados de execução da avaliação nos detalhes
    details["evaluator"] = "ragas"
    details["evaluatorVersion"] = ragas.__version__
    details["provider"] = "google"
    details["model"] = model_name
    details["latencyMs"] = latency_ms
    details["responseTruncated"] = False  # Conteúdo é totalmente avaliado via segmentação

    logger.info(
        "Avaliação concluída | score=%.4f | claims=%d (suportadas=%d) | latency=%dms",
        score,
        details["totalClaims"],
        details["supportedClaims"],
        latency_ms,
    )

    return {
        "score": score,
        "evaluator_version": ragas.__version__,
        "details": details,
    }
