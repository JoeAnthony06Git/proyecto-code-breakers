import { defaultDiscoveryQuestions } from './approvedContent';
import { analyzeLeadContext } from './leadScoring';
import {
  skillAnalyzeContext,
  skillApplySafetyPolicy,
  skillRetrieveApprovedKnowledge,
  skillRetrieveApprovedKnowledgeSemantic,
  skillSelectDiscoveryQuestion,
  skillSummarizeConversation,
} from './agentSkills';
import { recommendCommercialAction } from './commercialFollowUp';
import { generateAssistantResponse, generateConversationSummary } from '../server/ai/gemini';
import type {
  ConsentStatus,
  ConversationMessage,
  Citation,
  DiscoveryQuestion,
  Lead,
  ProposedAction,
  ScoreBreakdown,
  UserProfile,
} from '../shared/types';

export interface AssistantTurnInput {
  profile: UserProfile;
  lead: Lead;
  userText: string;
  history: ConversationMessage[];
  discoveryQuestions?: DiscoveryQuestion[];
}

export interface AssistantTurnOutput {
  assistantText: string;
  citations: Citation[];
  scoreBreakdown: ScoreBreakdown;
  signals: ReturnType<typeof analyzeLeadContext>['signals'];
  consentPrompt: boolean;
  proposedAction?: Omit<ProposedAction, 'id' | 'createdAt' | 'updatedAt'>;
  shouldCreateOpportunity: boolean;
  conversationSummary: string;
  usedSkills: string[];
}

function consentAllowsCommercialUse(status: ConsentStatus) {
  return status === 'GRANTED';
}

export async function createAssistantTurn(input: AssistantTurnInput): Promise<AssistantTurnOutput> {
  const analysis = skillAnalyzeContext(input.history, input.userText);
  const semanticRag = await skillRetrieveApprovedKnowledgeSemantic(input.userText);
  const rag = semanticRag.grounded ? semanticRag : skillRetrieveApprovedKnowledge(input.userText);
  const questions = input.discoveryQuestions ?? defaultDiscoveryQuestions;
  const selectedQuestion = skillSelectDiscoveryQuestion({
    questions,
    segment: analysis.signals.segment,
    history: input.history,
    nextUserText: input.userText,
    analysis,
  });
  const needsConsent = analysis.signals.commercialIntent && input.lead.consentStatus === 'PENDING';
  const commercialAllowed = consentAllowsCommercialUse(input.lead.consentStatus);

  const geminiSummary = await generateConversationSummary({
    profile: input.profile,
    history: input.history,
    userText: input.userText,
    signals: analysis.signals,
  });
  const conversationSummary = geminiSummary || skillSummarizeConversation({
    profile: input.profile,
    history: input.history,
    nextUserText: input.userText,
    analysis,
  });

  const geminiResponse = await generateAssistantResponse({
    userText: input.userText,
    history: input.history,
    profile: input.profile,
    ragContent: rag.answer || '',
    ragCitations: rag.citations,
    signals: {
      segment: analysis.signals.segment,
      educationalIntent: analysis.signals.educationalIntent,
      commercialIntent: analysis.signals.commercialIntent,
      objections: analysis.signals.objections,
      contactRequested: analysis.signals.contactRequested,
      interestTags: analysis.signals.interestTags,
    },
    discoveryQuestion: selectedQuestion?.text ?? null,
    conversationSummary,
  });

  let assistantText: string;
  let citations: Citation[];
  let usedGemini: boolean;

  if (geminiResponse.usedGemini) {
    assistantText = skillApplySafetyPolicy(geminiResponse.text, rag.citations.length > 0, false);
    citations = geminiResponse.citations;
    usedGemini = true;
  } else {
    const parts: string[] = [];
    if (rag.answer) parts.push(rag.answer);

    if (analysis.signals.educationalIntent && !rag.answer) {
      parts.push('Puedo ayudarte con educacion financiera usando solo contenido aprobado. Dime si quieres revisar objetivos, presupuesto, riesgo, diversificacion o productos financieros.');
    }

    if (analysis.signals.commercialIntent && !commercialAllowed) {
      parts.push('Puedo conversar sobre tus necesidades, pero no registrare intereses comerciales hasta que autorices ese registro.');
    }

    if (analysis.signals.objections.length > 0) {
      parts.push(
        `Entiendo la preocupacion sobre ${analysis.signals.objections.join(', ')}. Puedo aclararla con informacion educativa y, si corresponde, dejar una nota para revision humana.`,
      );
    }

    if (selectedQuestion) parts.push(selectedQuestion.text);

    if (analysis.signals.contactRequested) {
      parts.push('Puedo preparar una propuesta de contacto para que un administrador la revise. Nada se envia automaticamente.');
    }

    if (parts.length === 0) {
      parts.push(`Hola ${input.profile.name}. Puedo ayudarte a aprender sobre finanzas y, si lo autorizas, registrar intereses para que un especialista revise tu caso.`);
      if (selectedQuestion) parts.push(selectedQuestion.text);
    }

    assistantText = skillApplySafetyPolicy(parts.join('\n\n'), rag.citations.length > 0);
    citations = rag.citations;
    usedGemini = false;
  }

  const shouldCreateOpportunity =
    commercialAllowed && (analysis.breakdown.total >= 65 || analysis.signals.contactRequested) && analysis.signals.commercialIntent;

  const proposedAction = commercialAllowed
    ? recommendCommercialAction({
        profile: input.profile,
        lead: input.lead,
        signals: analysis.signals,
        scoreBreakdown: analysis.breakdown,
        conversationSummary,
      })
    : undefined;

  return {
    assistantText,
    citations,
    scoreBreakdown: analysis.breakdown,
    signals: analysis.signals,
    consentPrompt: needsConsent,
    proposedAction,
    shouldCreateOpportunity,
    conversationSummary,
    usedSkills: [
      'skillAnalyzeContext',
      'skillRetrieveApprovedKnowledge',
      'skillSelectDiscoveryQuestion',
      'skillSummarizeConversation',
      'skillApplySafetyPolicy',
      ...(usedGemini ? ['geminiConversationEngine'] : []),
    ],
  };
}
