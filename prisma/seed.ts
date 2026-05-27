import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando o processo de seeding do banco de dados...");

  // 1. Limpeza do banco de dados (Ordem correta para evitar erros de Foreign Key)
  console.log("🗑️ Limpando dados anteriores...");
  await prisma.activityLog.deleteMany({});
  await prisma.studentModuleScore.deleteMany({});
  await prisma.questionInstance.deleteMany({});
  await prisma.quizSession.deleteMany({});
  await prisma.moduleSourceChunk.deleteMany({});
  await prisma.moduleSourceFile.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.module.deleteMany({});
  await prisma.user.deleteMany({});

  // 2. Criptografando senha comum para testes
  const hashedPassword = await bcrypt.hash("password123", 10);

  // 3. Criando Professor (TEACHER)
  console.log("👤 Criando professor...");
  const teacher = await prisma.user.create({
    data: {
      name: "Prof. Gabriel",
      email: "professor@lumina.com",
      password: hashedPassword,
      role: "TEACHER",
    },
  });

  // 4. Criando Estudantes (15 Alunos)
  console.log("👥 Criando estudantes...");
  const studentsData = [
    { name: "Ana Souza", email: "aluno01@lumina.com" },
    { name: "Bruno Silva", email: "aluno02@lumina.com" },
    { name: "Camila Oliveira", email: "aluno03@lumina.com" },
    { name: "Diego Santos", email: "aluno04@lumina.com" },
    { name: "Eduarda Lima", email: "aluno05@lumina.com" },
    { name: "Felipe Costa", email: "aluno06@lumina.com" },
    { name: "Gabriela Rocha", email: "aluno07@lumina.com" },
    { name: "Gustavo Mendes", email: "aluno08@lumina.com" },
    { name: "Isabela Alves", email: "aluno09@lumina.com" },
    { name: "João Pereira", email: "aluno10@lumina.com" },
    { name: "Lucas Fernandes", email: "aluno11@lumina.com" },
    { name: "Mariana Ribeiro", email: "aluno12@lumina.com" },
    { name: "Nicolas Carvalho", email: "aluno13@lumina.com" },
    { name: "Patrícia Gomes", email: "aluno14@lumina.com" },
    { name: "Rodrigo Almeida", email: "aluno15@lumina.com" },
  ];

  const students = await Promise.all(
    studentsData.map((s) =>
      prisma.user.create({
        data: {
          name: s.name,
          email: s.email,
          password: hashedPassword,
          role: "STUDENT",
        },
      })
    )
  );

  // 5. Criando Módulos de Aprendizado (Conteúdo teórico real sobre IPv6)
  console.log("📚 Criando módulos de ensino...");
  const module1 = await prisma.module.create({
    data: {
      title: "Introdução e Endereçamento IPv6",
      description: "Aprenda os conceitos fundamentais do protocolo IPv6, incluindo a estrutura do cabeçalho, notação hexadecimal e tipos de endereços.",
      authorId: teacher.id,
      content: `
# Introdução e Endereçamento IPv6

O protocolo IPv6 (Internet Protocol version 6) é a versão mais recente do protocolo IP, desenvolvida pela IETF (Internet Engineering Task Force) para substituir o IPv4. A principal motivação para a criação do IPv6 foi o esgotamento dos endereços IPv4 disponíveis.

## Tamanho e Espaço de Endereçamento
Enquanto o IPv4 utiliza endereços de 32 bits (aproximadamente 4.3 bilhões de endereços), o IPv6 utiliza **128 bits**. Isso gera um espaço de endereçamento de $2^{128}$ endereços (cerca de 340 undecilhões de endereços), garantindo a escalabilidade da Internet para dispositivos IoT, computadores e redes móveis por décadas.

## Notação Hexadecimal e Formato
Os endereços IPv6 são representados em formato hexadecimal, divididos em **8 grupos de 4 dígitos** (hextetos) separados por dois-pontos (\`:\`). 
Exemplo: \`2001:0db8:85a3:0000:0000:8a2e:0370:7334\`

### Regras de Simplificação / Compactação:
1.  **Omissão de zeros à esquerda**: Em qualquer grupo, os zeros que aparecem no início do grupo podem ser omitidos. 
    *   \`0db8\` torna-se \`db8\`
    *   \`0000\` torna-se \`0\`
2.  **Uso de dois-pontos duplos (\`::\`)**: Grupos consecutivos contendo apenas zeros (\`0000\`) podem ser substituídos uma única vez na representação do endereço por \`::\`.
    *   Endereço original: \`2001:db8:0000:0000:0000:0000:1428:57ab\`
    *   Endereço simplificado: \`2001:db8::1428:57ab\`

## Tipos de Endereço IPv6
O IPv6 não possui transmissões de broadcast. Ele utiliza três tipos principais de comunicação:
*   **Unicast**: Identifica uma única interface de rede. Os pacotes enviados para um endereço unicast são entregues à interface correspondente.
    *   *Global Unicast*: Endereços públicos roteáveis na Internet global (geralmente iniciados com \`2000::/3\`).
    *   *Link-Local*: Roteáveis apenas no link local físico. São autogerados e iniciam sempre com \`fe80::/10\`.
    *   *Loopback*: Identifica a própria máquina local. Representado por \`::1/128\`.
*   **Multicast**: Identifica um grupo de interfaces. Pacotes enviados a esse endereço são entregues a todos os dispositivos membros do grupo (iniciados com \`ff00::/8\`).
*   **Anycast**: Identifica um grupo de interfaces, mas o pacote é entregue à interface mais próxima geograficamente ou metricamente (compartilha o mesmo formato de endereços Unicast).
      `.trim(),
    },
  });

  const module2 = await prisma.module.create({
    data: {
      title: "Roteamento e Protocolo ICMPv6",
      description: "Estude o funcionamento do Neighbor Discovery Protocol (NDP), configuração automática (SLAAC) e os tipos de mensagens ICMPv6.",
      authorId: teacher.id,
      content: `
# Roteamento e Protocolo ICMPv6

O ICMPv6 (Internet Control Message Protocol version 6) é um dos pilares do funcionamento do IPv6. Diferente do IPv4 onde funções auxiliares eram distribuídas em vários protocolos (como ARP e IGMP), o IPv6 integra essas funcionalidades diretamente sob o guarda-chuva do ICMPv6.

## Neighbor Discovery Protocol (NDP)
O NDP opera na camada de enlace e utiliza mensagens ICMPv6 para gerenciar a interação entre nós no mesmo link de rede. Suas principais funções incluem:
1.  **Resolução de Endereços (Substituto do ARP)**: Mapeia um endereço IPv6 para o endereço MAC físico da placa de rede.
2.  **Descoberta de Roteador**: Permite que os hosts localizem roteadores ativos na rede local.
3.  **Detecção de Endereço Duplicado (DAD)**: Garante que nenhum outro dispositivo no mesmo link local esteja usando o mesmo endereço IPv6 escolhido.

### Mensagens do NDP:
*   **Router Solicitation (RS - Tipo 133)**: Enviado pelos hosts para solicitar que os roteadores enviem anúncios imediatamente, sem esperar pelo ciclo automático.
*   **Router Advertisement (RA - Tipo 134)**: Enviado periodicamente pelos roteadores para anunciar prefixos de rede, MTU, servidores DNS e opções de configuração automática.
*   **Neighbor Solicitation (NS - Tipo 135)**: Enviado por um dispositivo para descobrir o endereço MAC de um vizinho ou para realizar a detecção DAD.
*   **Neighbor Advertisement (NA - Tipo 136)**: Resposta ao Neighbor Solicitation contendo o endereço físico (MAC) solicitado.

## Autoconfiguração de Endereço (SLAAC)
A SLAAC (Stateless Address Autoconfiguration) permite que um host obtenha um endereço IPv6 global válido de forma totalmente automatizada e descentralizada, sem necessidade de um servidor DHCPv6 ativo. 
O host escuta a mensagem de Router Advertisement (RA), extrai o prefixo de rede (geralmente \`/64\`) e combina-o com seu próprio identificador de interface (calculado via método EUI-64 a partir do endereço MAC ou gerado de forma aleatória/privada RFC 4941).
      `.trim(),
    },
  });

  const module3 = await prisma.module.create({
    data: {
      title: "Mecanismos de Transição e Coexistência",
      description: "Compreenda as principais tecnologias para permitir a transição gradual do IPv4 para o IPv6, incluindo Pilha Dupla, Tunelamento e NAT64.",
      authorId: teacher.id,
      content: `
# Mecanismos de Transição e Coexistência

A migração global do IPv4 para o IPv6 não ocorre de um dia para o outro. Durante muitos anos, as duas versões do protocolo devem coexistir e interagir de forma transparente para os usuários finais. Existem três categorias principais de tecnologias de transição.

## 1. Pilha Dupla (Dual Stack)
É a estratégia de transição mais recomendada e limpa. Consiste em configurar dispositivos (computadores, servidores, roteadores) para rodar **ambos os protocolos simultaneamente** na mesma interface física.
*   Se um site de destino suporta apenas IPv4, a conexão utiliza a pilha IPv4.
*   Se o site suporta IPv6, a conexão utiliza preferencialmente a pilha IPv6.

## 2. Tunelamento (Tunneling)
Permite que pacotes IPv6 trafeguem através de uma infraestrutura que suporta apenas IPv4, encapsulando o pacote IPv6 dentro de um cabeçalho IPv4. 
*   **6to4**: Conecta redes IPv6 isoladas sobre redes IPv4 sem configuração manual de túneis (prefixo \`2002::/16\`).
*   **Teredo**: Encapsula pacotes IPv6 dentro de pacotes UDP/IPv4, permitindo que hosts atrás de dispositivos NAT IPv4 obtenham conectividade IPv6.
*   **ISATAP**: Utilizado para conectividade IPv6 dentro de redes corporativas locais sobre redes IPv4.

## 3. Tradução (Translation)
Permite a comunicação direta entre dispositivos que possuem apenas pilha IPv6 e servidores ou hosts que suportam apenas IPv4.
*   **NAT64**: Traduz o cabeçalho dos pacotes IPv6 em pacotes IPv4 e vice-versa no gateway de rede.
*   **DNS64**: Trabalha em conjunto com o NAT64. Quando um host IPv6 solicita o endereço IP de um domínio que possui apenas registro A (IPv4), o DNS64 gera sinteticamente um registro AAAA (IPv6) mapeando o IP IPv4 original dentro de um prefixo especial do gateway NAT64.
      `.trim(),
    },
  });

  // 6. Populando Notas e Logs de Teste (Mapeando os perfis acadêmicos descritos)
  console.log("📊 Gerando histórico de notas e logs de atividades...");

  const now = new Date();
  
  // Mapeamento de perfis de alunos
  const ana = students[0];    // Ana Souza - Perfil nota 10
  const bruno = students[1];  // Bruno Silva - Perfil recuperação
  const camila = students[2]; // Camila Oliveira - Perfil reprovado
  const diego = students[3];  // Diego Santos - Perfil aprovado em 1 tentativa
  const eduarda = students[4]; // Eduarda Lima - Perfil acessou mas não fez quiz

  // Mock de sessionIds para vinculação lógica
  const sId1 = "sess_ana_01";
  const sId2 = "sess_ana_02";
  const sId3 = "sess_ana_03";
  const sId4 = "sess_ana_04";
  
  const sId5 = "sess_bruno_01";
  const sId6 = "sess_bruno_02";
  const sId7 = "sess_bruno_03";
  
  const sId8 = "sess_camila_01";
  const sId9 = "sess_camila_02";
  
  const sId10 = "sess_diego_01";

  // --- POPULANDO NOTAS (StudentModuleScore) ---

  // Notas Ana Souza (Módulo 1) - Evolução Ascendente
  await prisma.studentModuleScore.createMany({
    data: [
      { userId: ana.id, moduleId: module1.id, sessionId: sId1, score: 6, completedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      { userId: ana.id, moduleId: module1.id, sessionId: sId2, score: 8, completedAt: new Date(now.getTime() - 18 * 60 * 60 * 1000) },
      { userId: ana.id, moduleId: module1.id, sessionId: sId3, score: 9, completedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
      { userId: ana.id, moduleId: module1.id, sessionId: sId4, score: 10, completedAt: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
    ],
  });

  // Notas Bruno Silva (Módulo 1) - Estável na Recuperação
  await prisma.studentModuleScore.createMany({
    data: [
      { userId: bruno.id, moduleId: module1.id, sessionId: sId5, score: 4, completedAt: new Date(now.getTime() - 20 * 60 * 60 * 1000) },
      { userId: bruno.id, moduleId: module1.id, sessionId: sId6, score: 5, completedAt: new Date(now.getTime() - 15 * 60 * 60 * 1000) },
      { userId: bruno.id, moduleId: module1.id, sessionId: sId7, score: 5, completedAt: new Date(now.getTime() - 10 * 60 * 60 * 1000) },
    ],
  });

  // Notas Camila Oliveira (Módulo 1) - Dificuldades/Reprovada
  await prisma.studentModuleScore.createMany({
    data: [
      { userId: camila.id, moduleId: module1.id, sessionId: sId8, score: 2, completedAt: new Date(now.getTime() - 30 * 60 * 60 * 1000) },
      { userId: camila.id, moduleId: module1.id, sessionId: sId9, score: 3, completedAt: new Date(now.getTime() - 22 * 60 * 60 * 1000) },
    ],
  });

  // Nota Diego Santos (Módulo 1) - Aprovado de Primeira
  await prisma.studentModuleScore.create({
    data: { userId: diego.id, moduleId: module1.id, sessionId: sId10, score: 8, completedAt: new Date(now.getTime() - 14 * 60 * 60 * 1000) },
  });

  // Notas de outros estudantes variados para dar volume à lista do Módulo 1
  for (let i = 5; i < 12; i++) {
    const student = students[i];
    const scoreVal = Math.floor(Math.random() * 5) + 5; // Nota de 5 a 9
    await prisma.studentModuleScore.create({
      data: {
        userId: student.id,
        moduleId: module1.id,
        sessionId: `sess_random_${student.id}`,
        score: scoreVal,
        completedAt: new Date(now.getTime() - i * 3 * 60 * 60 * 1000),
      },
    });
  }

  // Adicionando algumas notas no Módulo 2 para ter dados em mais de um módulo
  await prisma.studentModuleScore.createMany({
    data: [
      { userId: ana.id, moduleId: module2.id, sessionId: "sess_ana_mod2_01", score: 8, completedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
      { userId: diego.id, moduleId: module2.id, sessionId: "sess_diego_mod2_01", score: 9, completedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000) },
    ],
  });

  // --- POPULANDO LOGS DE ATIVIDADE (ActivityLog) ---

  // Logs da Ana Souza (Trilha de atividades rica)
  await prisma.activityLog.createMany({
    data: [
      { userId: ana.id, eventType: "LOGIN", createdAt: new Date(now.getTime() - 26 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "MODULE_ACCESS", moduleId: module1.id, metadata: { moduleTitle: module1.title }, createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "QUIZ_START", moduleId: module1.id, sessionId: sId1, createdAt: new Date(now.getTime() - 24.2 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "QUIZ_COMPLETE", moduleId: module1.id, sessionId: sId1, metadata: { score: 6 }, createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "SCORE_RECORDED", moduleId: module1.id, sessionId: sId1, metadata: { score: 6 }, createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
      
      { userId: ana.id, eventType: "LOGIN", createdAt: new Date(now.getTime() - 19 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "MODULE_ACCESS", moduleId: module1.id, metadata: { moduleTitle: module1.title }, createdAt: new Date(now.getTime() - 18.5 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "QUIZ_START", moduleId: module1.id, sessionId: sId2, createdAt: new Date(now.getTime() - 18.2 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "QUIZ_COMPLETE", moduleId: module1.id, sessionId: sId2, metadata: { score: 8 }, createdAt: new Date(now.getTime() - 18 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "SCORE_RECORDED", moduleId: module1.id, sessionId: sId2, metadata: { score: 8 }, createdAt: new Date(now.getTime() - 18 * 60 * 60 * 1000) },

      { userId: ana.id, eventType: "MODULE_ACCESS", moduleId: module1.id, metadata: { moduleTitle: module1.title }, createdAt: new Date(now.getTime() - 13 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "QUIZ_START", moduleId: module1.id, sessionId: sId3, createdAt: new Date(now.getTime() - 12.2 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "QUIZ_COMPLETE", moduleId: module1.id, sessionId: sId3, metadata: { score: 9 }, createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "SCORE_RECORDED", moduleId: module1.id, sessionId: sId3, metadata: { score: 9 }, createdAt: new Date(now.getTime() - 12 * 60 * 60 * 1000) },

      { userId: ana.id, eventType: "LOGIN", createdAt: new Date(now.getTime() - 7 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "QUIZ_START", moduleId: module1.id, sessionId: sId4, createdAt: new Date(now.getTime() - 6.5 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "QUIZ_COMPLETE", moduleId: module1.id, sessionId: sId4, metadata: { score: 10 }, createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "SCORE_RECORDED", moduleId: module1.id, sessionId: sId4, metadata: { score: 10 }, createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000) },

      { userId: ana.id, eventType: "MODULE_ACCESS", moduleId: module2.id, metadata: { moduleTitle: module2.title }, createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "QUIZ_START", moduleId: module2.id, sessionId: "sess_ana_mod2_01", createdAt: new Date(now.getTime() - 2.2 * 60 * 60 * 1000) },
      { userId: ana.id, eventType: "QUIZ_COMPLETE", moduleId: module2.id, sessionId: "sess_ana_mod2_01", metadata: { score: 8 }, createdAt: new Date(now.getTime() - 2 * 60 * 60 * 1000) },
    ],
  });

  // Logs do Bruno Silva
  await prisma.activityLog.createMany({
    data: [
      { userId: bruno.id, eventType: "LOGIN", createdAt: new Date(now.getTime() - 22 * 60 * 60 * 1000) },
      { userId: bruno.id, eventType: "MODULE_ACCESS", moduleId: module1.id, metadata: { moduleTitle: module1.title }, createdAt: new Date(now.getTime() - 21.5 * 60 * 60 * 1000) },
      { userId: bruno.id, eventType: "QUIZ_START", moduleId: module1.id, sessionId: sId5, createdAt: new Date(now.getTime() - 20.3 * 60 * 60 * 1000) },
      { userId: bruno.id, eventType: "QUIZ_COMPLETE", moduleId: module1.id, sessionId: sId5, metadata: { score: 4 }, createdAt: new Date(now.getTime() - 20 * 60 * 60 * 1000) },
      
      { userId: bruno.id, eventType: "QUIZ_START", moduleId: module1.id, sessionId: sId6, createdAt: new Date(now.getTime() - 15.3 * 60 * 60 * 1000) },
      { userId: bruno.id, eventType: "QUIZ_COMPLETE", moduleId: module1.id, sessionId: sId6, metadata: { score: 5 }, createdAt: new Date(now.getTime() - 15 * 60 * 60 * 1000) },

      { userId: bruno.id, eventType: "LOGIN", createdAt: new Date(now.getTime() - 11 * 60 * 60 * 1000) },
      { userId: bruno.id, eventType: "QUIZ_START", moduleId: module1.id, sessionId: sId7, createdAt: new Date(now.getTime() - 10.3 * 60 * 60 * 1000) },
      { userId: bruno.id, eventType: "QUIZ_COMPLETE", moduleId: module1.id, sessionId: sId7, metadata: { score: 5 }, createdAt: new Date(now.getTime() - 10 * 60 * 60 * 1000) },
    ],
  });

  // Logs da Camila Oliveira
  await prisma.activityLog.createMany({
    data: [
      { userId: camila.id, eventType: "LOGIN", createdAt: new Date(now.getTime() - 32 * 60 * 60 * 1000) },
      { userId: camila.id, eventType: "MODULE_ACCESS", moduleId: module1.id, metadata: { moduleTitle: module1.title }, createdAt: new Date(now.getTime() - 31 * 60 * 60 * 1000) },
      { userId: camila.id, eventType: "QUIZ_START", moduleId: module1.id, sessionId: sId8, createdAt: new Date(now.getTime() - 30.5 * 60 * 60 * 1000) },
      { userId: camila.id, eventType: "QUIZ_COMPLETE", moduleId: module1.id, sessionId: sId8, metadata: { score: 2 }, createdAt: new Date(now.getTime() - 30 * 60 * 60 * 1000) },

      { userId: camila.id, eventType: "QUIZ_START", moduleId: module1.id, sessionId: sId9, createdAt: new Date(now.getTime() - 22.4 * 60 * 60 * 1000) },
      { userId: camila.id, eventType: "QUIZ_COMPLETE", moduleId: module1.id, sessionId: sId9, metadata: { score: 3 }, createdAt: new Date(now.getTime() - 22 * 60 * 60 * 1000) },
    ],
  });

  // Logs da Eduarda Lima (Apenas acessou, nunca fez quiz)
  await prisma.activityLog.createMany({
    data: [
      { userId: eduarda.id, eventType: "LOGIN", createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000) },
      { userId: eduarda.id, eventType: "MODULE_ACCESS", moduleId: module1.id, metadata: { moduleTitle: module1.title }, createdAt: new Date(now.getTime() - 4.8 * 60 * 60 * 1000) },
      { userId: eduarda.id, eventType: "MODULE_ACCESS", moduleId: module2.id, metadata: { moduleTitle: module2.title }, createdAt: new Date(now.getTime() - 4.5 * 60 * 60 * 1000) },
    ],
  });

  // Logs genéricos para o restante dos estudantes (garantir que todos tenham log de login recente)
  for (let i = 5; i < students.length; i++) {
    const student = students[i];
    await prisma.activityLog.createMany({
      data: [
        { userId: student.id, eventType: "LOGIN", createdAt: new Date(now.getTime() - i * 1.5 * 60 * 60 * 1000) },
        { userId: student.id, eventType: "MODULE_ACCESS", moduleId: module1.id, metadata: { moduleTitle: module1.title }, createdAt: new Date(now.getTime() - i * 1.4 * 60 * 60 * 1000) },
      ],
    });
  }

  // 7. Populando Telemetria Educacional (StudentQuizTelemetry) para o Analytics Dashboard
  console.log("📈 Gerando telemetria de aprendizado para o Analytics...");
  
  for (let i = 0; i < 200; i++) {
    const student = students[Math.floor(Math.random() * students.length)];
    const module = Math.random() > 0.6 ? module2 : module1;
    const randomDaysAgo = Math.floor(Math.random() * 14);
    const createdAt = new Date(now.getTime() - randomDaysAgo * 24 * 60 * 60 * 1000 - Math.random() * 8 * 60 * 60 * 1000);
    
    const diffRoll = Math.random();
    const difficultyLevel = diffRoll > 0.7 ? "HARD" : (diffRoll > 0.4 ? "MEDIUM" : "EASY");
    
    let isCorrect = true;
    let responseTimeMs = 0;

    if (difficultyLevel === "EASY") {
      isCorrect = Math.random() > 0.15;
      responseTimeMs = Math.floor(Math.random() * 10000) + 5000;
    } else if (difficultyLevel === "MEDIUM") {
      isCorrect = Math.random() > 0.4;
      responseTimeMs = Math.floor(Math.random() * 25000) + 15000;
    } else {
      isCorrect = Math.random() > 0.65;
      responseTimeMs = Math.floor(Math.random() * 45000) + 30000;
    }

    if (module.id === module2.id) {
      if (Math.random() > 0.5) isCorrect = false; 
    }

    // Cria a sessão mock
    const session = await prisma.quizSession.create({
      data: {
        userId: student.id,
        moduleId: module.id,
        status: "COMPLETED",
        score: isCorrect ? 1 : 0,
        createdAt,
        updatedAt: createdAt
      }
    });

    // Cria uma mock question instance
    const question = await prisma.questionInstance.create({
      data: {
        sessionId: session.id,
        difficulty: difficultyLevel,
        prompt: `Mock question ${i}`,
        options: ["A", "B", "C", "D"],
        correctOptionIndex: 0,
        studentAnswer: isCorrect ? 0 : 1,
        isCorrect,
        createdAt
      }
    });

    // Cria a telemetria associada
    await prisma.studentQuizTelemetry.create({
      data: {
        userId: student.id,
        moduleId: module.id,
        sessionId: session.id,
        questionId: question.id,
        responseTimeMs,
        isCorrect,
        chosenOptionIndex: isCorrect ? 0 : 1,
        difficultyLevel,
        perceivedDifficulty: Math.floor(Math.random() * 5) + 1,
        createdAt,
      }
    });
  }

  console.log("✅ Banco de dados populado com sucesso!");
}

main()
  .catch((e) => {
    console.error("❌ Erro durante o seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
