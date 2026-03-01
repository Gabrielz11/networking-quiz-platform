# 🎓 IPv6 Pedagogy App

Uma plataforma interativa web voltada para alunos iniciantes em Redes de Computadores, focada especificamente em contornar as dificuldades na compreensão do **endereçamento IPv6 (representação, abreviação e estrutura dos 128-bits)**. 

O sistema aplica conceitos de redução do ruído cognitivo visual através da metodologia **"uma-pergunta-por-vez"** e usa uma Inteligência Artificial local para fornecer correções construtivas e explicações baseadas nas respostas erradas dos alunos frente ao gabarito do professor.

## 🛠 Features Principais

### Para o Aluno
* **Módulos Limpos**: Conteúdos redigidos pelo tutor lidos num ambiente acadêmico Markdown, com zero distração.
* **Simulados Guiados**: Uma questão na tela, barra de progresso simples.
* **Tutor de IA Local**: Ao errar uma alternativa, a ferramenta não mostra apenas um "Errado" gigante. Ela envia o enunciado, a alternativa correta, a alternativa do aluno e uma base de aprendizagem (inserida pelo mestre) para o modelo da Ollama, que devolve uma justificativa pedagógica no tom de um instrutor dedicado para aquela alternativa exata que ele falhou.

### Para o Professor
* **Dashboard Autenticado**: Autenticação encriptada pelo Supabase. CRUD completo de módulos.
* **Banco de Questões**: O professor elabora o quiz e vincula uma "Explicação Mestra" para cada questão. A IA se subordina a esse texto base e restringe possíveis alucinações. 

---

## 🚀 Arquitetura e Stack
Este projeto foi desenvolvido com uma arquitetura moderna para suportar Next.js App Router num repositório SSR (Server Side Rendering), além de tecnologias locais para garantir R$0,00 de custo operacional de LLMs pra instituições acadêmicas:

- **Framework**: `Next.js 16`
- **Componentes**: `React.js` + `Tailwind CSS V4`
- **Acessibilidade e Componentes UI**: `shadcn/ui`
- **Banco de Dados / Auth / RLS (Row Level Security)**: `Supabase`
- **Engine IA**: `Ollama` com o Modelo LLaMA-3 (bancado no Client/Server Loop local pela verificação no terminal).

---

## 💻 Clonando e Rodando Localmente

Para rodar o projeto do zero na sua máquina para estudo ou contribuição, o sistema precisa estar rodando o Supabase e o contêiner do Ollama. 

### 1. Requisitos
- [Node.js](https://nodejs.org/) (versão 18+)
- Conta no [Supabase](https://supabase.com/)
- Interface ou Docker do motor IA [Ollama.com](https://ollama.com/)

### 2. Passo-a-passo (Supabase)
Após a criação do seu App no painel web ou CLI do Supabase, você precisa rodar no Editor SQL o arquivo esquema de arquitetura incluído no repositório:
```sql
-- Copie e rode o conteúdo local do arquivo:
supabase-schema.sql
```

Na raiz do projeto renomeie seu`.env.local` e o preencha com as URL keys do painel do Supabase apontando para o seu banco da web.
```properties
NEXT_PUBLIC_SUPABASE_URL=https://<SUA_URL_AQUI>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<SUA_CHAVE_AQUI>
```

### 3. Passo-a-passo (Ollama)
O sistema foi configurado para bater na API Rest Padrão da Ollama em `localhost:11434`. Assumindo que você tenha instalado o gerenciador na máquina ou utilize Docker, vamos puxar o modelo:

#### Opção A: Usando Instalação Nativa
\`\`\`bash
# Puxará ±4.7GBs pra memória. Pode ser trocado no `src/app/api/explain/route.ts` caso tenha limitações no Setup
ollama run llama3
\`\`\`

#### Opção B: Usando Docker (Recomendado)
Se preferir rodar em um contêiner Docker para manter sua máquina limpa:
\`\`\`bash
# Cria o contêiner com persistência de volume e exporta a porta 11434
docker run -d --name ollama -p 11434:11434 -v ollama:/root/.ollama ollama/ollama

# Executa e faz o download do modelo Llama3 dentro do contêiner
docker exec ollama ollama run llama3
\`\`\`

### 4. Rodando o Projeto

\`\`\`bash
git clone https://github.com/SEU_USER/ipv6-lms.git
cd ipv6-lms
npm install
npm run dev
\`\`\`
A plataforma estará acessível agora em `http://localhost:3000`.

---

## 🎨 Design Guideline

A aparência original obedeceu ao protocolo das Vercel/Linear vibes:
1. `Light Mode` primário como guia de contraste. Cor Primária: `#2563EB`.
2. Interação fluida, micro-interações minimalistas.
3. Componentização em shadcn/ui.

Qualquer alteração visual na arquitetura deverá respeitar o documento original `DESIGN-GUIDELINE.md` providenciado nas referências originais do criador.

> Open Source - 2026. Divirta-se quebrando código e ensinando Internet!
