# services/rag-evaluation/test_absent_truth.py
#
# Testes para validar que afirmações tecnicamente verdadeiras mas AUSENTES
# dos contextos recuperados recebem verdict=0 (não suportadas).
#
# Esse é o caso mais crítico para Faithfulness: o modelo não deve receber
# crédito por afirmações corretas que não estão nas fontes.
#
# Executar com: python test_absent_truth.py

import asyncio
import os
import sys
import logging
from google import genai
from ragas.llms import llm_factory
from ragas.metrics.collections import Faithfulness
from ragas_adapter import RagasFaithfulnessAdapter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_absent_truth")


# Casos de teste: afirmações tecnicamente corretas mas ausentes do contexto
ABSENT_TRUTH_CASES = [
    {
        "name": "Portas DHCPv6 ausentes",
        "user_input": "DHCPv6 e configuração de endereços",
        "response": "O DHCPv6 utiliza as portas UDP 546 (cliente) e 547 (servidor) para comunicação.",
        "retrieved_contexts": [
            "O DHCPv6 é um protocolo que permite a configuração stateful de endereços IPv6 em redes."
        ],
        "expected_unsupported_keywords": ["546", "547", "portas"],
        "description": "Portas 546/547 são corretas mas não mencionadas no contexto",
    },
    {
        "name": "RFC ausente",
        "user_input": "Protocolo IPv6",
        "response": "O IPv6 foi padronizado pela RFC 2460 e posteriormente atualizado pela RFC 8200.",
        "retrieved_contexts": [
            "O IPv6 é a versão mais recente do Protocolo de Internet, projetado para substituir o IPv4."
        ],
        "expected_unsupported_keywords": ["RFC 2460", "RFC 8200"],
        "description": "Números de RFC são corretos mas não estão no contexto",
    },
    {
        "name": "Código ICMPv6 ausente",
        "user_input": "ICMPv6 e descoberta de vizinhos",
        "response": "O ICMPv6 utiliza o tipo 135 para Neighbor Solicitation e o tipo 136 para Neighbor Advertisement.",
        "retrieved_contexts": [
            "O ICMPv6 é fundamental para o funcionamento do IPv6, incluindo a descoberta de vizinhos na rede local."
        ],
        "expected_unsupported_keywords": ["135", "136"],
        "description": "Tipos ICMPv6 são corretos mas não mencionados no contexto",
    },
    {
        "name": "Finalidade de link-local ausente",
        "user_input": "Tipos de endereço IPv6",
        "response": "Endereços link-local (fe80::/10) são utilizados para comunicação entre dispositivos no mesmo segmento de rede e são essenciais para o funcionamento do NDP.",
        "retrieved_contexts": [
            "O IPv6 possui diferentes tipos de endereço, incluindo endereços unicast, multicast e anycast."
        ],
        "expected_unsupported_keywords": ["fe80", "NDP", "link-local"],
        "description": "Detalhes de link-local são corretos mas ausentes do contexto",
    },
    {
        "name": "Comparação IPv4 vs IPv6 sem sustentação",
        "user_input": "Diferenças entre IPv4 e IPv6",
        "response": "O IPv6 elimina a necessidade de NAT, pois oferece endereços suficientes para todos os dispositivos, diferente do IPv4 que depende de NAT para conservar endereços.",
        "retrieved_contexts": [
            "O IPv4 utiliza endereços de 32 bits enquanto o IPv6 utiliza endereços de 128 bits, proporcionando um espaço de endereçamento significativamente maior."
        ],
        "expected_unsupported_keywords": ["NAT"],
        "description": "Relação com NAT é tecnicamente correta mas não está no contexto",
    },
]


async def run_tests():
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

    print("🧪 Executando testes de verdade-ausente (absent truth)...")
    print("=" * 60)

    all_passed = True
    results_summary = []

    for case in ABSENT_TRUTH_CASES:
        print(f"\n--- {case['name']} ---")
        print(f"📋 {case['description']}")

        try:
            score, details = await adapter.evaluate_with_diagnostics(
                user_input=case["user_input"],
                response=case["response"],
                retrieved_contexts=case["retrieved_contexts"],
            )

            # Verificar se há claims não suportados
            unsupported_claims = [
                c for c in details.get("claims", [])
                if not c["supported"]
            ]

            # Verificar se pelo menos uma keyword esperada aparece nos claims não suportados
            unsupported_texts = " ".join(c["statement"] for c in unsupported_claims).lower()
            keywords_found = [
                kw for kw in case["expected_unsupported_keywords"]
                if kw.lower() in unsupported_texts
            ]

            passed = len(unsupported_claims) > 0 and len(keywords_found) > 0

            print(f"Score: {score:.4f}")
            print(f"Total claims: {details['totalClaims']}")
            print(f"Não suportados: {details['unsupportedClaims']}")

            for c in details.get("claims", []):
                status = "✅" if c["supported"] else "❌"
                print(f"  {status} {c['statement'][:80]}")
                if not c["supported"]:
                    print(f"      Razão: {c['reason'][:100]}")

            if passed:
                print("✅ PASSOU — Afirmações ausentes foram corretamente marcadas como não suportadas")
            else:
                print("❌ FALHOU — Afirmações ausentes deveriam ser marcadas como não suportadas")
                if len(unsupported_claims) == 0:
                    print("   ⚠️  Nenhum claim foi marcado como não suportado!")
                if len(keywords_found) == 0:
                    print(f"   ⚠️  Keywords esperadas não encontradas nos claims não suportados: {case['expected_unsupported_keywords']}")
                all_passed = False

            results_summary.append({
                "name": case["name"],
                "passed": passed,
                "score": score,
                "unsupported": details["unsupportedClaims"],
                "total": details["totalClaims"],
            })

        except Exception as e:
            print(f"❌ ERRO — {str(e)}")
            all_passed = False
            results_summary.append({
                "name": case["name"],
                "passed": False,
                "score": 0,
                "unsupported": 0,
                "total": 0,
                "error": str(e),
            })

    # Resumo final
    print("\n" + "=" * 60)
    print("📊 RESUMO DOS TESTES DE VERDADE-AUSENTE")
    print("=" * 60)

    for r in results_summary:
        status = "✅" if r["passed"] else "❌"
        error_info = f" | ERRO: {r.get('error', '')[:50]}" if "error" in r else ""
        print(f"  {status} {r['name']}: score={r['score']:.4f} | não-suportados={r['unsupported']}/{r['total']}{error_info}")

    passed_count = sum(1 for r in results_summary if r["passed"])
    total_count = len(results_summary)

    if all_passed:
        print(f"\n🎉 TODOS OS {total_count} TESTES PASSARAM!")
    else:
        print(f"\n❌ {passed_count}/{total_count} testes passaram. Alguns falharam.")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(run_tests())
