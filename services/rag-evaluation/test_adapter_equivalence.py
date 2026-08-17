# services/rag-evaluation/test_adapter_equivalence.py
#
# Teste de equivalência entre o score nativo do RAGAS (ascore) e o
# score produzido pelo RagasFaithfulnessAdapter.

import asyncio
import os
import sys
import logging
from google import genai
from ragas.llms import llm_factory
from ragas.metrics.collections import Faithfulness
from ragas_adapter import RagasFaithfulnessAdapter

logging.basicConfig(level=logging.INFO)


async def main():
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        print("❌ GEMINI_API_KEY não configurada.")
        sys.exit(1)

    client = genai.Client(api_key=api_key)
    evaluator_llm = llm_factory("gemini-3.6-flash", provider="google", client=client)

    # Patch para cliente síncrono no modo async
    orig_agenerate = evaluator_llm.agenerate

    async def _patched_agenerate(prompt, response_model=None):
        try:
            return await orig_agenerate(prompt, response_model)
        except TypeError:
            return await asyncio.to_thread(evaluator_llm.generate, prompt, response_model)

    evaluator_llm.agenerate = _patched_agenerate

    metric = Faithfulness(llm=evaluator_llm)
    adapter = RagasFaithfulnessAdapter(metric)

    samples = [
        {
            "user_input": "Conceitos de IPv6",
            "response": "O IPv6 possui endereços de 128 bits e suporta auto-configuração SLAAC.",
            "retrieved_contexts": [
                "O protocolo IPv6 utiliza um espaço de endereçamento de 128 bits.",
                "O SLAAC permite que dispositivos configurem automaticamente seus endereços IPv6."
            ]
        },
        {
            "user_input": "Segurança no IPv6",
            "response": "O IPsec é obrigatório em todas as implementações de IPv6 e elimina qualquer vulnerabilidade de rede.",
            "retrieved_contexts": [
                "O IPsec foi originalmente projetado para o IPv6 como suporte nativo, mas seu uso prático é opcional na maioria dos sistemas operacionais modernos."
            ]
        }
    ]

    print("🧪 Executando teste de equivalência...")
    all_passed = True

    for i, s in enumerate(samples, 1):
        print(f"\n--- Amostra {i} ---")
        native_result = await metric.ascore(
            user_input=s["user_input"],
            response=s["response"],
            retrieved_contexts=s["retrieved_contexts"],
        )
        native_score = float(native_result.value)

        adapter_score, details = await adapter.evaluate_with_diagnostics(
            user_input=s["user_input"],
            response=s["response"],
            retrieved_contexts=s["retrieved_contexts"],
        )

        diff = abs(native_score - adapter_score)
        passed = diff < 0.0001

        print(f"Native ascore():     {native_score:.4f}")
        print(f"Adapter score:      {adapter_score:.4f}")
        print(f"Diferença absoluta:  {diff:.6f}")
        print(f"Total claims:       {details['totalClaims']} (Suportadas: {details['supportedClaims']}, Não suportadas: {details['unsupportedClaims']})")

        if not passed:
            all_passed = False
            print("❌ DIVERGÊNCIA DETECTADA!")
        else:
            print("✅ EQUIVALENTE")

    if all_passed:
        print("\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!")
    else:
        print("\n❌ FALHA NOS TESTES DE EQUIVALÊNCIA.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
