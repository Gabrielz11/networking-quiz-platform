// src/lib/prompts/evidence-map.prompt.ts
//
// Prompt para extração estruturada de mapa de evidências a partir dos chunks
// recuperados. Instrui o LLM a identificar tópicos, fatos atômicos e fontes.
// Usado como passo intermediário antes da geração de conteúdo.

export const EVIDENCE_MAP_PROMPT_VERSION = "1.0.0";

export const EVIDENCE_MAP_PROMPT = `
Você é um analisador de evidências. Sua tarefa é extrair um mapa estruturado
de tópicos e fatos a partir de trechos de documentos recuperados.

[FONTES RECUPERADAS]

{{CONTEXT_CHUNKS}}

[FIM DAS FONTES]

[INSTRUÇÕES]

Analise todos os trechos acima e produza um JSON com a seguinte estrutura:

{
  "topics": [
    {
      "topic": "Nome do tópico identificado",
      "facts": [
        {
          "statement": "Afirmação atômica extraída das fontes",
          "sourceIds": ["id_do_chunk_1", "id_do_chunk_2"],
          "sourceLabels": ["Fonte: arquivo.pdf | Seção: X"]
        }
      ]
    }
  ]
}

[REGRAS DE EXTRAÇÃO]

1. Extraia APENAS fatos que estejam EXPLÍCITOS nos trechos fornecidos.
2. NÃO infira fatos que não aparecem diretamente nas fontes.
3. NÃO adicione conhecimento próprio para completar lacunas.
4. Cada fato deve ser uma afirmação atômica: uma única informação verificável.
5. Agrupe fatos por tópico semântico (ex: "Endereçamento", "Configuração", "Segurança").
6. Para cada fato, liste TODOS os IDs dos chunks que o sustentam.
7. Um fato pode ser sustentado por múltiplos chunks.
8. Se dois chunks dizem a mesma coisa, registre o fato uma única vez com ambos os IDs.
9. NÃO transforme inferências, relações causais ou generalizações em fatos.
10. NÃO registre como fato algo que é apenas sugerido mas não afirmado.

[TIPOS DE INFORMAÇÃO A EXTRAIR]

- Definições e conceitos
- Valores numéricos (tamanhos, quantidades, bits)
- Nomes de protocolos, mecanismos, padrões
- Comportamentos descritos (como algo funciona)
- Comparações explícitas
- Limitações mencionadas
- Exemplos concretos apresentados
- Resultados experimentais com seus contextos

[FORMATO DE SAÍDA]

Responda APENAS com o JSON válido, sem texto adicional antes ou depois.
Não inclua markdown code fences. Apenas o JSON puro.
`;
