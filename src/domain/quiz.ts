import type { QuizQuestion } from '../shared/types';

export const quizQuestions: QuizQuestion[] = [
  {
    id: 'q1',
    question: 'Que debe definirse antes de elegir un producto financiero?',
    options: ['El logo de la entidad', 'El objetivo y horizonte temporal', 'Solo la rentabilidad historica'],
    correctOption: 1,
    explanation: 'Primero se define objetivo y horizonte temporal para alinear plazo, liquidez y riesgo.',
    sourceChunkId: 'fa-001',
  },
  {
    id: 'q2',
    question: 'Que busca la diversificacion?',
    options: ['Eliminar todo riesgo', 'Concentrar el dinero', 'Reducir dependencia de una sola fuente de retorno'],
    correctOption: 2,
    explanation: 'Diversificar no elimina el riesgo, pero ayuda a gestionarlo.',
    sourceChunkId: 'fa-002',
  },
  {
    id: 'q3',
    question: 'Por que es util un fondo de emergencia?',
    options: ['Para evitar decisiones apresuradas ante imprevistos', 'Para reemplazar todo plan financiero', 'Para garantizar ganancias'],
    correctOption: 0,
    explanation: 'El fondo de emergencia ayuda a cubrir gastos esenciales ante imprevistos.',
    sourceChunkId: 'fa-003',
  },
];

export function gradeQuiz(answers: number[]) {
  const score = quizQuestions.reduce((total, question, index) => total + (answers[index] === question.correctOption ? 1 : 0), 0);
  return {
    score,
    total: quizQuestions.length,
    passed: score >= 2,
    feedback: quizQuestions.map((question, index) => ({
      questionId: question.id,
      correct: answers[index] === question.correctOption,
      explanation: question.explanation,
      sourceChunkId: question.sourceChunkId,
    })),
  };
}
