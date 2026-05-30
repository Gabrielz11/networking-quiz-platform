import { StudentActivityLogService } from "../src/services/student-activity-log.service";
import fs from "fs/promises";
import path from "path";

async function runTest() {
  console.log("Iniciando teste do StudentActivityLogService...");

  const testStudentId = "student-test-uuid-12345";
  
  // 1. Simular log de resposta do quiz
  console.log("Chamando logEvent para QUIZ_ANSWERED...");
  StudentActivityLogService.logEvent({
    studentId: testStudentId,
    eventType: "QUIZ_ANSWERED",
    metadata: {
      moduleId: "module-ipv6-basics",
      questionId: "question-1",
      isCorrect: true,
      difficulty: "EASY",
      responseTimeMs: 3500
    }
  });

  // 2. Simular log de explicação de IA
  console.log("Chamando logEvent para AI_EXPLANATION_REQUESTED...");
  StudentActivityLogService.logEvent({
    studentId: testStudentId,
    eventType: "AI_EXPLANATION_REQUESTED",
    textContent: "Como funciona a autoconfiguração SLAAC no IPv6?",
    metadata: {
      sessionId: "session-abc-123",
      questionId: "question-2",
      moduleId: "module-ipv6-basics"
    }
  });

  // 3. Simular feedback do aluno
  console.log("Chamando logEvent para STUDENT_FEEDBACK...");
  StudentActivityLogService.logEvent({
    studentId: testStudentId,
    eventType: "STUDENT_FEEDBACK",
    textContent: "Gostei muito da explicação sobre subredes!",
    metadata: {
      rating: 5
    }
  });

  // Aguarda 1.5 segundos para garantir que as operações assíncronas do logger em background terminaram
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 4. Verificar se o arquivo sentimento.log foi criado e ler conteúdo
  const logFilePath = path.join(process.cwd(), "storage", "logs", "sentimento.log");
  try {
    const fileContent = await fs.readFile(logFilePath, "utf-8");
    console.log("\nConteúdo do arquivo sentimento.log:");
    console.log(fileContent);

    // Contar linhas
    const lines = fileContent.trim().split("\n");
    if (lines.length >= 3) {
      console.log(`Sucesso! Foram gravadas ${lines.length} linhas de log.`);
      
      // Validar que cada linha é um JSON válido
      let allValid = true;
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (!parsed.student_id || !parsed.event_type || !parsed.created_at) {
            allValid = false;
            console.error("Campos obrigatórios ausentes no JSON:", line);
          }
        } catch (e) {
          allValid = false;
          console.error("Linha não é um JSON válido:", line);
        }
      }

      if (allValid) {
        console.log("✅ Teste passou! Todas as entradas do log são JSONs estruturados válidos.");
      } else {
        console.log("❌ Teste falhou! Algumas entradas possuem erros de estrutura.");
      }
    } else {
      console.log(`❌ Teste falhou! Esperava ao menos 3 linhas de log, obteve ${lines.length}.`);
    }
  } catch (err: any) {
    console.error("❌ Falha ao ler o arquivo sentimento.log:", err.message);
  }
}

runTest();
