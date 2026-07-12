import { answerFromApprovedContent } from './rag';
import { analyzeLeadContext } from './leadScoring';
import type { ConversationMessage, DiscoveryQuestion, Lead, UserProfile } from '../shared/types';

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function historyText(history: ConversationMessage[], nextUserText: string) {
  return [...history.filter((message) => message.role === 'user').map((message) => message.content), nextUserText];
}

function wasQuestionAsked(question: DiscoveryQuestion, history: ConversationMessage[]) {
  const askedText = normalize(history.filter((message) => message.role === 'assistant').map((message) => message.content).join(' '));
  return askedText.includes(normalize(question.text));
}

function hasAnsweredQuestion(question: DiscoveryQuestion, text: string, analysis: ReturnType<typeof analyzeLeadContext>) {
  const questionText = normalize(question.text);
  const fullText = normalize(text);
  if (questionText.includes('organizacion') || questionText.includes('familia') || questionText.includes('equipo')) {
    return analysis.signals.segment !== 'UNDETERMINED';
  }
  if (questionText.includes('cuantas personas')) {
    return analysis.signals.companyContext && /\b\d{1,5}\b/.test(fullText);
  }
  if (questionText.includes('objetivo') || questionText.includes('interes principal')) {
    return analysis.signals.interestTags.length > 0 || analysis.signals.educationalIntent || analysis.signals.commercialIntent;
  }
  if (questionText.includes('horizonte') || questionText.includes('cuando') || questionText.includes('comenzar')) {
    return analysis.signals.urgencyDetected || /(mes|semana|ano|anos|largo plazo|corto plazo|pronto)/.test(fullText);
  }
  if (questionText.includes('presupuesto')) {
    return analysis.signals.budgetDetected;
  }
  return false;
}

export function skillAnalyzeContext(history: ConversationMessage[], nextUserText: string) {
  return analyzeLeadContext(historyText(history, nextUserText));
}

export function skillRetrieveApprovedKnowledge(nextUserText: string) {
  return answerFromApprovedContent(nextUserText);
}

export function skillSelectDiscoveryQuestion(input: {
  questions: DiscoveryQuestion[];
  segment: Lead['segment'];
  history: ConversationMessage[];
  nextUserText: string;
  analysis: ReturnType<typeof analyzeLeadContext>;
}) {
  const candidates = input.questions
    .filter((question) => question.active && (question.segment === input.segment || question.segment === 'UNDETERMINED'))
    .sort((a, b) => a.order - b.order);
  const fullText = historyText(input.history, input.nextUserText).join(' ');
  return candidates.find((question) => !wasQuestionAsked(question, input.history) && !hasAnsweredQuestion(question, fullText, input.analysis));
}

export function skillSummarizeConversation(input: {
  profile: UserProfile;
  history: ConversationMessage[];
  nextUserText: string;
  analysis: ReturnType<typeof analyzeLeadContext>;
}) {
  const userMessages = historyText(input.history, input.nextUserText).slice(-6);
  const interests = input.analysis.signals.interestTags.length > 0 ? input.analysis.signals.interestTags.join(', ') : 'sin intereses definidos';
  const objections =
    input.analysis.signals.objections.length > 0 ? ` Objeciones: ${input.analysis.signals.objections.join(', ')}.` : ' Sin objeciones explicitas.';
  return `${input.profile.name}: ${userMessages.join(' | ')}. Intereses detectados: ${interests}.${objections}`;
}

export function skillApplySafetyPolicy(text: string, hasCitations: boolean) {
  const banned = /(garantiz(a|o)|rentabilidad asegurada|sin riesgo|debes invertir|compra este producto|recomiendo comprar)/i;
  const disclaimer = 'Esto es contenido educativo y no reemplaza asesoria personalizada.';
  let safeText = text.replace(banned, 'no puedo afirmar eso con seguridad');
  if (!hasCitations && /inversion|financ|riesgo|producto|rentabilidad|jubilacion/i.test(safeText)) {
    safeText =
      'No encontre contenido aprobado suficiente para responder con seguridad. Puedo ayudarte con objetivos, presupuesto, riesgo, diversificacion o derivar la pregunta a revision humana.';
  }
  if (!safeText.includes(disclaimer) && /inversion|financ|riesgo|producto|rentabilidad|jubilacion/i.test(safeText)) {
    safeText = `${safeText}\n\n${disclaimer}`;
  }
  return safeText;
}

export const agentSkills = [
  'skillAnalyzeContext',
  'skillRetrieveApprovedKnowledge',
  'skillSelectDiscoveryQuestion',
  'skillSummarizeConversation',
  'skillApplySafetyPolicy',
] as const;
