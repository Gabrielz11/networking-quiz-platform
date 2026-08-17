# services/rag-evaluation/test_direct.py
# Teste de execução direta do RAGAS Faithfulness dentro do container Python.

import asyncio
import os
import ragas
from google import genai
from ragas.llms import llm_factory
from ragas.metrics.collections import Faithfulness


async def main():
    print(f"RAGAS versão: {ragas.__version__}")
    api_key = os.environ.get("GEMINI_API_KEY")
    print(f"GEMINI_API_KEY configurada: {Boolean(api_key) if 'Boolean' in globals() else bool(api_key)}")

    client = genai.Client(api_key=api_key)
    evaluator_llm = llm_factory("gemini-2.5-flash", provider="google", client=client)
    metric = Faithfulness(llm=evaluator_llm)

    user_input = "Conceitos do protocolo IPv6 e tamanho de endereçamento"
    response = "O protocolo IPv6 utiliza um espaço de endereçamento de 128 bits, permitindo 2^128 endereços únicos. Os endereços são representados em hexadecimal separados por dois pontos."
    retrieved_contexts = [
        "O IPv6 foi desenvolvido para substituir o IPv4 e usa 128 bits de endereçamento.",
        "A notação do IPv6 é feita em 8 grupos de 4 dígitos hexadecimais separados por caractere de dois-pontos (:)."
    ]

    print("Calculando score Faithfulness via Gemini...")
    result = await metric.ascore(
        user_input=user_input,
        response=response,
        retrieved_contexts=retrieved_contexts,
    )

    print(f"✅ Resultado Faithfulness: {result.value} (score={float(result.value):.4f})")

if __name__ == "__main__":
    asyncio.run(main())
