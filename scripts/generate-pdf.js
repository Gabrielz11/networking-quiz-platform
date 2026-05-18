const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Instancia o documento PDF no formato A4 com margens limpas
const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    bufferPages: true // Habilita manipulação de múltiplas páginas para numeração dinâmica
});

const outputPath = path.join(__dirname, '..', 'documento-redis-bullmq.pdf');
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// Cores da Paleta de Design (Premium/Moderna)
const colors = {
    primary: '#1E3A8A',    // Azul Marinho Profundo
    secondary: '#3B82F6',  // Azul Elétrico / Destaque
    dark: '#0F172A',       // Slate Escuro para texto principal
    lightBg: '#F8FAFC',    // Fundo cinza azulado claro para callouts
    border: '#E2E8F0',     // Cor de bordas para caixas
    gray: '#64748B',       // Cinza médio para legendas e cabeçalhos
    white: '#FFFFFF',      // Branco
    success: '#10B981'     // Verde para indicações positivas
};

// =========================================================================
// PÁGINA 1: CAPA PREMIUM
// =========================================================================

// Fundo decorativo no topo (Barra de cabeçalho estilizada)
doc.rect(0, 0, 595.28, 240)
   .fill(colors.primary);

// Detalhe de linha de sotaque no topo
doc.rect(0, 240, 595.28, 8)
   .fill(colors.secondary);

// Texto da Capa (Branco sobre Azul Escuro)
doc.fillColor(colors.white)
   .fontSize(12)
   .font('Helvetica-Bold')
   .text('LUMINA LMS — ARQUITETURA DE TECNOLOGIA', 50, 60, { characterSpacing: 1.5 });

doc.fontSize(28)
   .font('Helvetica-Bold')
   .text('Redis & BullMQ no Pipeline de RAG', 50, 100, { lineGap: 8 });

doc.fontSize(14)
   .font('Helvetica')
   .fillColor('#93C5FD') // Azul claro
   .text('Processamento Assíncrono e Ingestão de Documentos em Escala', 50, 175);

// Conteúdo Inferior da Capa (Texto Escuro sobre Fundo Branco)
doc.fillColor(colors.dark)
   .fontSize(16)
   .font('Helvetica-Bold')
   .text('1. Introdução Geral', 50, 290);

doc.rect(50, 312, 100, 2)
   .fill(colors.secondary);

const introText = 'Este documento descreve detalhadamente o funcionamento e a utilidade prática do Redis e do BullMQ no ecossistema do Lumina LMS. O processamento de arquivos PDF ou de texto para o RAG (Retrieval-Augmented Generation) exige etapas computacionais pesadas: extração de texto bruto, fragmentação inteligente (chunking), comunicação com APIs de inteligência artificial da OpenAI (geração de embeddings) e gravação de vetores no PostgreSQL (pgvector). \n\nPara evitar gargalos na interface do usuário (timeouts na rota de API) e garantir que o sistema continue extremamente ágil, implementou-se uma arquitetura baseada no padrão de projeto Producer-Consumer (Produtor-Consumidor), viabilizada pela combinação robusta de Redis e BullMQ.';

doc.fillColor(colors.dark)
   .fontSize(10.5)
   .font('Helvetica')
   .text(introText, 50, 330, { align: 'justify', lineGap: 5 });

// Caixa de Destaque / Callout na Capa (Padrão de Projeto)
doc.rect(50, 510, 495.28, 100)
   .fillAndStroke(colors.lightBg, colors.border);

doc.fillColor(colors.primary)
   .fontSize(11)
   .font('Helvetica-Bold')
   .text('💡 O CONCEITO CHAVE (PRODUCER-CONSUMER):', 65, 525);

const calloutText = 'Quando o professor faz o upload de um material, a rota de API apenas valida o arquivo, salva-o localmente e registra a tarefa no Redis (Producer). A requisição termina instantaneamente para o usuário final, e um processo independente (Consumer/Worker) é notificado para realizar a extração e vetorização do documento em segundo plano, sem travar o servidor principal.';

doc.fillColor(colors.dark)
   .fontSize(9.5)
   .font('Helvetica')
   .text(calloutText, 65, 545, { lineGap: 3.5, width: 465.28 });

// Rodapé da Capa
doc.fillColor(colors.gray)
   .fontSize(9)
   .text('Documento Gerado Automatizado • Lumina LMS Corp.', 50, 750)
   .text('Maio de 2026', 500, 750);


// =========================================================================
// PÁGINA 2: ESTRUTURA DO PIPELINE E FLUXO DE DADOS
// =========================================================================
doc.addPage();

// Cabeçalho da Página 2
doc.fillColor(colors.gray)
   .fontSize(8)
   .font('Helvetica')
   .text('LUMINA LMS — ESPECIFICAÇÃO TÉCNICA DE INFRAESTRUTURA', 50, 30);
doc.strokeColor(colors.border)
   .moveTo(50, 42)
   .lineTo(545.28, 42)
   .stroke();

doc.fillColor(colors.primary)
   .fontSize(16)
   .font('Helvetica-Bold')
   .text('2. O Fluxo de Ingestão de Dados Passo a Passo', 50, 60);

doc.rect(50, 80, 150, 2)
   .fill(colors.secondary);

// Passo 1
doc.fillColor(colors.primary)
   .fontSize(11)
   .font('Helvetica-Bold')
   .text('Passo 1: Upload e Salvamento Físico', 50, 100);

doc.fillColor(colors.dark)
   .fontSize(9.5)
   .font('Helvetica')
   .text('O usuário envia o arquivo (PDF/TXT) pela interface gráfica. A rota POST /api/modules/[moduleId]/sources recebe o multipart/form-data, valida o tamanho e formato, aciona o StorageService e salva o arquivo na pasta ./storage/uploads/modules/[moduleId]/[timestamp].[pdf|txt].', 50, 118, { lineGap: 3 });

// Passo 2
doc.fillColor(colors.primary)
   .fontSize(11)
   .font('Helvetica-Bold')
   .text('Passo 2: Registro e Disparo do Processamento', 50, 175);

doc.fillColor(colors.dark)
   .fontSize(9.5)
   .font('Helvetica')
   .text('Logo em seguida, o sistema registra o arquivo na tabela ModuleSourceFile no Postgres com status "UPLOADED" e dispara a chamada para a service processSourceFile(). Esta service atualiza o status para "PROCESSING" e adiciona um Job no BullMQ através de enqueueDocumentProcessing(fileId, moduleId).', 50, 193, { lineGap: 3 });

// Passo 3
doc.fillColor(colors.primary)
   .fontSize(11)
   .font('Helvetica-Bold')
   .text('Passo 3: Fila no Redis (O Papel do Redis + BullMQ)', 50, 250);

doc.fillColor(colors.dark)
   .fontSize(9.5)
   .font('Helvetica')
   .text('O Redis serve como a engrenagem central da fila. O BullMQ cria uma estrutura de dados de fila chamada "embedding-processing" dentro do Redis. Os Jobs enviados guardam o ID do arquivo e do módulo. O Redis armazena de forma persistente a fila e gerencia concorrências, garantindo que o job nunca seja perdido mesmo se o servidor cair.', 50, 268, { lineGap: 3 });

// Passo 4
doc.fillColor(colors.primary)
   .fontSize(11)
   .font('Helvetica-Bold')
   .text('Passo 4: Processamento no Worker em Segundo Plano', 50, 325);

doc.fillColor(colors.dark)
   .fontSize(9.5)
   .font('Helvetica')
   .text('Um Worker dedicado (embeddingWorker) configurado no arquivo embedding-worker.ts fica rodando em segundo plano ouvindo a fila no Redis. Ao detectar o novo Job:\n1. O Worker extrai o texto do arquivo (PDF ou texto simples) usando o document-parser.\n2. Divide o texto em fragmentos inteligentes de até 500 tokens (Token-Aware Chunking).\n3. Envia os fragmentos para a API da OpenAI (text-embedding-3-small) para computar os embeddings vetoriais de 1536 dimensões.\n4. Limpa chunks antigos e salva os novos chunks e seus respectivos vetores na tabela ModuleSourceChunk no PostgreSQL (utilizando o pgvector).\n5. Atualiza o status do arquivo original para "PROCESSED" no banco de dados.', 50, 343, { lineGap: 3 });


// Caixa de Benefícios (Tabela Simples)
doc.rect(50, 490, 495.28, 140)
   .fillAndStroke(colors.lightBg, colors.border);

doc.fillColor(colors.primary)
   .fontSize(11)
   .font('Helvetica-Bold')
   .text('🌟 POR QUE ESTA ARQUITETURA É ALTAMENTE RECOMENDADA?', 65, 505);

const benefitsText = '• Evita Request Timeout: O parseamento de PDFs longos e a geração de embeddings na OpenAI podem demorar dezenas de segundos. Em servidores Next.js convencionais (como na Vercel), requisições HTTP normais possuem timeout de 10 a 15 segundos. A fila assíncrona resolve isso completamente.\n\n• Resiliência Automática: Se a API da OpenAI falhar devido a instabilidade, o BullMQ automaticamente retenta processar o Job até 3 vezes com um tempo de espera exponencial (backoff exponencial de 2 segundos).\n\n• Controle de Concorrência e Escala: O Redis impede sobrecargas. Você pode subir 5 workers separados em servidores diferentes para rodar o processamento paralelamente sem interferir na rota de navegação do app.';

doc.fillColor(colors.dark)
   .fontSize(9)
   .font('Helvetica')
   .text(benefitsText, 65, 525, { lineGap: 3, width: 465.28 });


// =========================================================================
// PÁGINA 3: MAPEAMENTO DE CÓDIGO E CONFIGURAÇÃO
// =========================================================================
doc.addPage();

// Cabeçalho da Página 3
doc.fillColor(colors.gray)
   .fontSize(8)
   .font('Helvetica')
   .text('LUMINA LMS — MAPA DE IMPLEMENTAÇÃO E INFRAESTRUTURA', 50, 30);
doc.strokeColor(colors.border)
   .moveTo(50, 42)
   .lineTo(545.28, 42)
   .stroke();

doc.fillColor(colors.primary)
   .fontSize(16)
   .font('Helvetica-Bold')
   .text('3. Onde os Códigos de Redis e BullMQ estão de fato?', 50, 60);

doc.rect(50, 80, 150, 2)
   .fill(colors.secondary);

// Estrutura de Pastas e Arquivos
const structures = [
    {
        file: 'docker-compose.yml',
        desc: 'Contém a definição do container Docker "lumina_redis" rodando a imagem leve "redis:7-alpine" na porta padrão "6379", garantindo que a infraestrutura suba localmente de forma simples com "docker compose up -d".'
    },
    {
        file: 'src/lib/env.ts',
        desc: 'Valida e injeta a variável de ambiente REDIS_URL utilizando a biblioteca Zod, configurando "redis://localhost:6379" como fallback caso a variável não seja informada.'
    },
    {
        file: 'src/lib/rag/jobs/queues/embedding-queue.ts',
        desc: 'Cria a instância do RedisConnection e define a fila "embedding-processing" do BullMQ. Exporta a função assíncrona enqueueDocumentProcessing() para injetar tarefas de forma simples no ecossistema.'
    },
    {
        file: 'src/lib/rag/jobs/workers/embedding-worker.ts',
        desc: 'O motor em segundo plano. Declara o "embeddingWorker" ouvindo a fila no Redis. Possui toda a lógica de parseamento, chunking, geração de embeddings da OpenAI e persistência no banco vetorial via pgvector.'
    },
    {
        file: 'src/lib/rag/jobs/workers/start-workers.ts',
        desc: 'Código bootstrap responsável por inicializar os Workers do BullMQ, ouvir eventos de progresso, sucesso ou erro, além de gerenciar o encerramento gracioso (Graceful Shutdown) fechando a conexão com o Redis em caso de SIGINT.'
    }
];

let currentY = 100;
structures.forEach((item) => {
    // Marcador
    doc.circle(55, currentY + 5, 3)
       .fill(colors.secondary);

    // Nome do Arquivo
    doc.fillColor(colors.dark)
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(item.file, 65, currentY);

    // Descrição
    doc.fillColor(colors.gray)
       .fontSize(9)
       .font('Helvetica')
       .text(item.desc, 65, currentY + 15, { lineGap: 3, width: 480 });

    currentY += doc.heightOfString(item.desc, { width: 480 }) + 25;
});

// Resumo Geral da Infraestrutura do RAG
doc.rect(50, 480, 495.28, 140)
   .fillAndStroke(colors.lightBg, colors.border);

doc.fillColor(colors.primary)
   .fontSize(11)
   .font('Helvetica-Bold')
   .text('📋 CONFIGURAÇÕES DE REDIS NO ARQUIVO .ENV', 65, 495);

const configEnvText = 'A conexão física do projeto com a instância do Redis é estabelecida puramente a partir de variáveis de ambiente. Abaixo está a listagem exata de como a infraestrutura de filas e o Redis estão configurados no arquivo de ambiente:\n\n' +
    '  • REDIS_URL="redis://localhost:6379"\n' +
    '  • UPLOAD_DIR="./storage/uploads"\n' +
    '  • RAG_CHUNK_SIZE="500"\n' +
    '  • RAG_CHUNK_OVERLAP="80"\n\n' +
    'Isto significa que para rodar o pipeline assíncrono em ambiente local, basta subir o container correspondente e executar o Next.js normalmente com "npm run dev".';

doc.fillColor(colors.dark)
   .fontSize(9)
   .font('Helvetica')
   .text(configEnvText, 65, 515, { lineGap: 3, width: 465.28 });


// =========================================================================
// RENDERIZAÇÃO DE NÚMEROS DE PÁGINAS EM TODAS AS PÁGINAS
// =========================================================================
const range = doc.bufferedPageRange();
for (let i = range.start; i < (range.start + range.count); i++) {
    doc.switchToPage(i);
    
    // Não renderiza cabeçalhos e rodapés extras na capa (página 0)
    if (i > 0) {
        doc.fillColor(colors.gray)
           .fontSize(8)
           .font('Helvetica')
           .text(`Página ${i + 1} de ${range.count}`, 50, 750, { align: 'right' });
    }
}

// Finaliza o arquivo PDF
doc.end();

stream.on('finish', () => {
    console.log('PDF gerado com sucesso em: documento-redis-bullmq.pdf');
});
