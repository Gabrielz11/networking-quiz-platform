import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALLOWED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', 'postgres']);

async function main() {
  // 1. Bloqueio por ambiente de produção
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERRO DE SEGURANÇA: Execução de clean-db é proibida em ambiente de produção!');
    process.exit(1);
  }

  // 2. Validação estrita do hostname via new URL()
  const dbUrlString = process.env.DATABASE_URL;
  if (!dbUrlString) {
    console.error('❌ ERRO DE SEGURANÇA: Variável DATABASE_URL não definida.');
    process.exit(1);
  }

  let hostname: string;
  try {
    const parsedUrl = new URL(dbUrlString);
    hostname = parsedUrl.hostname;
  } catch {
    console.error('❌ ERRO DE SEGURANÇA: Formato inválido na DATABASE_URL.');
    process.exit(1);
  }

  if (!ALLOWED_HOSTNAMES.has(hostname)) {
    console.error(`❌ ERRO DE SEGURANÇA: Execução negada. O hostname "${hostname}" não é um ambiente local permitido.`);
    console.error('Hostnames permitidos: localhost, 127.0.0.1, ::1, postgres (apenas container local)');
    process.exit(1);
  }

  // 3. Exigência da flag explícita --confirm
  if (!process.argv.includes('--confirm')) {
    console.error('⚠️ ATENÇÃO: Este script realiza a exclusão em massa de dados.');
    console.error(`Hostname detectado: "${hostname}"`);
    console.error('Para confirmar a execução, passe a flag explícita: npx tsx scripts/clean-db.ts --confirm');
    process.exit(1);
  }

  console.log('--- Iniciando limpeza do banco de dados ---');
  console.log(`Executando limpeza no host: "${hostname}"`);

  try {
    console.log('Deletando QuestionInstance...');
    await prisma.questionInstance.deleteMany();

    console.log('Deletando QuizSession...');
    await prisma.quizSession.deleteMany();

    console.log('Deletando Question...');
    await prisma.question.deleteMany();

    console.log('Deletando Module...');
    await prisma.module.deleteMany();

    console.log('--- Banco de dados limpo com sucesso! ---');
  } catch (error) {
    console.error('Erro ao limpar o banco:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

