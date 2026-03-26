import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Iniciando limpeza do banco de dados ---')
  
  // A ordem importa devido às foreign keys
  try {
    console.log('Deletando QuestionInstance...')
    await prisma.questionInstance.deleteMany()
    
    console.log('Deletando QuizSession...')
    await prisma.quizSession.deleteMany()
    
    console.log('Deletando Question...')
    await prisma.question.deleteMany()
    
    console.log('Deletando Module...')
    await prisma.module.deleteMany()
    
    // Opcional: manter os usuários ou deletar também? 
    // Geralmente em "limpar o banco" o usuário quer resetar tudo exceto talvez o admin.
    // Vou manter os usuários por enquanto para não perder o login, 
    // mas se quiser deletar, basta adicionar aqui.

    console.log('--- Banco de dados limpo com sucesso! ---')
  } catch (error) {
    console.error('Erro ao limpar o banco:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
