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
from ragas.metrics.collections.faithfulness.util import (
    StatementGeneratorInput,
    StatementGeneratorOutput,
    NLIStatementInput,
    NLIStatementOutput,
    StatementFaithfulnessAnswer,
)

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
    1. Extração detalhada de afirmações (statements), vereditos e justificativas (reasons) em PT-BR.
    2. Avaliação por segmentos quando o conteúdo excede 4000 caracteres (evita truncamento).
    3. Isolamento contra futuras alterações nas APIs internas do RAGAS.
    """

    def __init__(self, metric: Faithfulness):
        self.metric = metric
        self._configure_portuguese_prompts()

    def _configure_portuguese_prompts(self):
        """
        Configura instruções e exemplos em Português do Brasil (PT-BR) nos prompts
        do RAGAS Faithfulness para garantir que afirmações (statements) e justificativas (reasons)
        sejam geradas 100% em português.
        """
        if hasattr(self.metric, "statement_generator_prompt") and self.metric.statement_generator_prompt:
            self.metric.statement_generator_prompt.instruction = (
                "Dada uma pergunta e uma resposta em português, analise a resposta e decomponha "
                "cada frase em uma ou mais afirmações atômicas e totalmente compreensíveis em português "
                "do Brasil (PT-BR). Garanta que nenhum pronome ambíguo seja utilizado e que todo o texto "
                "gerado esteja estritamente em português do Brasil (PT-BR)."
            )
            self.metric.statement_generator_prompt.examples = [
                (
                    StatementGeneratorInput(
                        question="O que é o protocolo IPv6 e qual seu tamanho de endereço?",
                        answer="O IPv6 é a versão mais recente do Protocolo de Internet, desenvolvida pela IETF. Ele utiliza endereços de 128 bits para resolver a escassez de IPs.",
                    ),
                    StatementGeneratorOutput(
                        statements=[
                            "O IPv6 é a versão mais recente do Protocolo de Internet.",
                            "O IPv6 foi desenvolvido pela IETF.",
                            "O IPv6 utiliza endereços de 128 bits.",
                            "O IPv6 visa resolver a escassez de endereços IP.",
                        ]
                    ),
                ),
            ]

        if hasattr(self.metric, "nli_statement_prompt") and self.metric.nli_statement_prompt:
            self.metric.nli_statement_prompt.instruction = (
                "Sua tarefa é julgar a fidelidade (faithfulness) de uma série de afirmações com base "
                "estrita no contexto fornecido. Para cada afirmação, você deve retornar um veredito (verdict) "
                "igual a 1 se a afirmação puder ser inferida diretamente a partir do contexto, ou 0 se ela "
                "não puder ser inferida diretamente. A justificativa (reason) DEVE ser obrigatoriamente "
                "escrita em português do Brasil (PT-BR), explicando de forma clara e objetiva o motivo do veredito."
            )
            self.metric.nli_statement_prompt.examples = [
                (
                    NLIStatementInput(
                        context="O IPv6 utiliza um espaço de endereçamento de 128 bits. O mecanismo SLAAC permite a autoconfiguração de endereços na rede.",
                        statements=[
                            "O IPv6 utiliza 128 bits de endereçamento.",
                            "O IPv6 exige a configuração manual de todos os IPs.",
                            "O IPsec é obrigatório em todas as conexões IPv6.",
                        ],
                    ),
                    NLIStatementOutput(
                        statements=[
                            StatementFaithfulnessAnswer(
                                statement="O IPv6 utiliza 128 bits de endereçamento.",
                                reason="O contexto afirma expressamente que o IPv6 utiliza um espaço de endereçamento de 128 bits.",
                                verdict=1,
                            ),
                            StatementFaithfulnessAnswer(
                                statement="O IPv6 exige a configuração manual de todos os IPs.",
                                reason="O contexto menciona que o SLAAC permite a autoconfiguração de endereços, contradizendo a exigência de configuração manual.",
                                verdict=0,
                            ),
                            StatementFaithfulnessAnswer(
                                statement="O IPsec é obrigatório em todas as conexões IPv6.",
                                reason="Não há qualquer menção sobre a obrigatoriedade do IPsec no contexto fornecido.",
                                verdict=0,
                            ),
                        ]
                    ),
                ),
            ]

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
