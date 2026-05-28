export function buildBatchQuizPrompt(title: string, content: string): string {
    return `Você é um professor acadêmico de Redes de Computadores especialista em IPv6.
    O usuário fornecerá o título e o conteúdo de um módulo de estudo.
    Sua tarefa é criar um quiz contendo de 3 a 10 questões de múltipla escolha baseadas EXCLUSIVAMENTE nesse conteúdo.
    Para cada questão, determine o nível de dificuldade (easy, medium, hard).
    Retorne EXATAMENTE UM JSON com a seguinte estrutura:
    {
    "questions": [
        {
        "prompt": "Enunciado da questão",
        "options": ["Opção 1", "Opção 2", "Opção 3", "Opção 4"],
        "correct_option_index": 0,
        "difficulty": "easy",
        "explanation_base": "Explicação objetiva da resposta correta."
        }
    ]
    }

    Título do Módulo: ${title}

    Conteúdo:
    ${content}`;
}
