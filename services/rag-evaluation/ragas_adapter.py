# services/rag-evaluation/ragas_adapter.py
#
# Adaptador isolado para a métrica Faithfulness do RAGAS 0.4.3.
# Isola chamadas de APIs internas (_create_statements, _create_verdicts, _compute_score)
# e implementa avaliação segmentada para conteúdos > 4000 caracteres.

import re
import asyncio
import logging
from typing import List, Dict, Any, Tuple
from ragas.metrics.collections import Faithfulness

logger = logging.getLogger("rag-evaluation")

MAX_SEGMENT_CHARS = 4000


def segment_response(response: str) -> List[str]:
    """
    Divide a resposta gerada em segmentos lógicos (quebra por parágrafos/seções e frases),
    garantindo que cada trecho tenha no máximo MAX_SEGMENT_CHARS.
    Prioriza quebras semânticas em fins de parágrafo e frases para evitar cortar texto no meio de uma afirmação.
    """
    if len(response) <= MAX_SEGMENT_CHARS:
        return [response]

    paragraphs = response.split("\n\n")
    segments: List[str] = []
    current_segment = ""

    for p in paragraphs:
        if not p.strip():
            continue
        if len(current_segment) + len(p) + 2 <= MAX_SEGMENT_CHARS:
            current_segment = f"{current_segment}\n\n{p}".strip()
        else:
            if current_segment:
                segments.append(current_segment)
                current_segment = ""

            # Se um único parágrafo for maior que MAX_SEGMENT_CHARS, divide por limites de frases (.!?)
            if len(p) > MAX_SEGMENT_CHARS:
                sentences = re.split(r'(?<=[.!?])\s+', p)
                sub_seg = ""
                for sentence in sentences:
                    if len(sub_seg) + len(sentence) + 1 <= MAX_SEGMENT_CHARS:
                        sub_seg = f"{sub_seg} {sentence}".strip()
                    else:
                        if sub_seg:
                            segments.append(sub_seg)
                        sub_seg = sentence[:MAX_SEGMENT_CHARS]
                if sub_seg:
                    current_segment = sub_seg
            else:
                current_segment = p

    if current_segment:
        segments.append(current_segment)

    return segments if segments else [response[:MAX_SEGMENT_CHARS]]


class RagasFaithfulnessAdapter:
    """
    Encapsula o RAGAS Faithfulness (v0.4.3) oferecendo:
    1. Extração detalhada de afirmações (statements), vereditos e justificativas (reasons).
    2. Avaliação por segmentos quando o conteúdo excede 4000 caracteres (evita truncamento).
    3. Isolamento contra futuras alterações nas APIs internas do RAGAS.
    """

    def __init__(self, metric: Faithfulness):
        self.metric = metric

    async def evaluate_with_diagnostics(
        self,
        user_input: str,
        response: str,
        retrieved_contexts: List[str],
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Executa a avaliação de Faithfulness e retorna (score, details_dict).
        Score é garantido como ratio: supportedClaims / totalClaims.
        """
        if not response or not user_input or not retrieved_contexts:
            raise ValueError("user_input, response e retrieved_contexts são obrigatórios.")

        context_str = "\n".join(retrieved_contexts)
        segments = segment_response(response)
        is_segmented = len(segments) > 1

        logger.info(
            "Iniciando avaliação RAGAS | content_chars=%d | segments=%d",
            len(response),
            len(segments),
        )

        all_statements: List[str] = []

        # 1. Extração de afirmações sequencialmente por segmento (preserva ordem dos resultados)
        for idx, seg in enumerate(segments):
            logger.info(
                "Processando segmento %d/%d | segment_chars=%d",
                idx + 1,
                len(segments),
                len(seg),
            )
            try:
                if hasattr(self.metric, "_create_statements"):
                    seg_statements = await self.metric._create_statements(user_input, seg)
                else:
                    raise AttributeError("Método interno _create_statements não encontrado no RAGAS.")
                if seg_statements:
                    all_statements.extend(seg_statements)
            except Exception as e:
                logger.error("Erro ao gerar afirmações para segmento %d/%d: %s", idx + 1, len(segments), str(e))
                raise e

        if not all_statements:
            logger.warning("Nenhuma afirmação gerada a partir da resposta.")
            return 0.0, {
                "totalClaims": 0,
                "supportedClaims": 0,
                "unsupportedClaims": 0,
                "claims": [],
                "isSegmented": is_segmented,
                "segmentsCount": len(segments),
            }

        # 2. Vereditos NLI sobre todas as afirmações acumuladas
        try:
            if hasattr(self.metric, "_create_verdicts"):
                verdicts = await self.metric._create_verdicts(all_statements, context_str)
            else:
                raise AttributeError("Método interno _create_verdicts não encontrado no RAGAS.")
        except Exception as e:
            logger.error("Erro ao avaliar vereditos NLI: %s", str(e))
            raise e

        # 3. Cálculo do score oficial
        if hasattr(self.metric, "_compute_score"):
            raw_score = self.metric._compute_score(verdicts)
            score = 0.0 if (raw_score is None or str(raw_score) == "nan") else float(raw_score)
        else:
            faithful_count = sum(1 for s in verdicts.statements if getattr(s, "verdict", 0) == 1)
            score = faithful_count / len(verdicts.statements) if verdicts.statements else 0.0

        # 4. Formatação da lista de claims
        claims_details = []
        supported_count = 0
        unsupported_count = 0

        for item in verdicts.statements:
            is_supported = bool(getattr(item, "verdict", 0) == 1)
            if is_supported:
                supported_count += 1
            else:
                unsupported_count += 1

            claims_details.append({
                "statement": str(getattr(item, "statement", "")),
                "supported": is_supported,
                "reason": str(getattr(item, "reason", "Justificativa não fornecida pelo avaliador.")),
            })

        details = {
            "totalClaims": len(claims_details),
            "supportedClaims": supported_count,
            "unsupportedClaims": unsupported_count,
            "claims": claims_details,
            "isSegmented": is_segmented,
            "segmentsCount": len(segments),
        }

        return score, details
