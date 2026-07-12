import type { Lead, LeadSignals, ProposedAction, ScoreBreakdown, UserProfile } from '../shared/types';

type ActionDraft = Omit<ProposedAction, 'id' | 'createdAt' | 'updatedAt'>;

function readableList(values: string[], fallback: string) {
  return values.length > 0 ? values.join(', ') : fallback;
}

export function summarizeDetectedNeed(signals: LeadSignals, conversationSummary: string) {
  if (signals.companyContext) return 'Necesidad organizacional o de equipo detectada durante la conversacion.';
  if (signals.personalContext) return 'Necesidad personal de educacion o planificacion financiera detectada.';
  if (signals.educationalIntent) return 'Busca orientacion educativa financiera antes de tomar decisiones.';
  return conversationSummary && conversationSummary !== 'Sin resumen todavia.'
    ? conversationSummary.slice(0, 180)
    : 'Necesidad pendiente de clarificar.';
}

export function detectedProfileLabel(signals: LeadSignals) {
  if (signals.companyContext) return 'Organizacion, empresa o equipo';
  if (signals.personalContext) return 'Persona natural o familia';
  return 'Perfil por determinar';
}

export function actionTypeLabel(type: ProposedAction['type']) {
  const labels: Record<ProposedAction['type'], string> = {
    SCHEDULE_CALL: 'Agendar una reunion',
    SEND_EDUCATIONAL_MATERIAL: 'Enviar material educativo',
    NURTURE_USER: 'Continuar nutriendo al usuario',
    ASSIGN_SPECIALIST: 'Derivar a un especialista',
    REQUEST_MORE_INFO: 'Solicitar mas informacion',
    MARK_PRIORITY_OPPORTUNITY: 'Marcar como oportunidad prioritaria',
    SEND_SUMMARY: 'Enviar resumen',
    ASSIGN_EXECUTIVE: 'Asignar ejecutivo',
  };
  return labels[type];
}

export function recommendCommercialAction(input: {
  profile: UserProfile;
  lead: Lead;
  signals: LeadSignals;
  scoreBreakdown: ScoreBreakdown;
  conversationSummary: string;
}): ActionDraft {
  const { profile, lead, signals, scoreBreakdown, conversationSummary } = input;
  const interests = readableList(signals.interestTags, 'intereses por confirmar');
  const budget = signals.budgetText ?? 'presupuesto no confirmado';
  const urgency = signals.urgencyText ?? (signals.contactRequested ? 'solicitud de contacto' : 'sin urgencia explicita');
  const objections = readableList(signals.objections, 'sin objeciones explicitas');
  const need = summarizeDetectedNeed(signals, conversationSummary);
  const baseRationale = `Score ${scoreBreakdown.total}/100 (${scoreBreakdown.priority}). Necesidad: ${need} Intereses: ${interests}. Presupuesto: ${budget}. Urgencia: ${urgency}. Objeciones: ${objections}.`;

  if (scoreBreakdown.total >= 80 && signals.budgetDetected && (signals.urgencyDetected || signals.contactRequested)) {
    return {
      userId: profile.id,
      leadId: lead.id,
      type: 'MARK_PRIORITY_OPPORTUNITY',
      title: 'Marcar como oportunidad prioritaria',
      rationale: baseRationale,
      draft: `Revisar a ${profile.name} como oportunidad prioritaria. Validar objetivo, alcance, presupuesto y siguiente paso humano antes de cualquier comunicacion externa.`,
      status: 'PENDING',
    };
  }

  if (signals.contactRequested || signals.urgencyDetected) {
    return {
      userId: profile.id,
      leadId: lead.id,
      type: 'SCHEDULE_CALL',
      title: 'Agendar reunion revisada por humano',
      rationale: baseRationale,
      draft: `Hola ${profile.name}, gracias por compartir tu contexto. Podemos coordinar una reunion breve con un especialista para entender mejor tu objetivo y resolver dudas. Este mensaje debe revisarse antes de enviarse.`,
      status: 'PENDING',
    };
  }

  if (signals.objections.length > 0) {
    return {
      userId: profile.id,
      leadId: lead.id,
      type: 'ASSIGN_SPECIALIST',
      title: 'Derivar a especialista por objeciones',
      rationale: baseRationale,
      draft: `Asignar un especialista para revisar las objeciones de ${profile.name}: ${signals.objections.join(', ')}. Preparar respuesta educativa, sin promesas ni recomendacion personalizada.`,
      status: 'PENDING',
    };
  }

  if (!signals.budgetDetected || lead.segment === 'UNDETERMINED') {
    return {
      userId: profile.id,
      leadId: lead.id,
      type: 'REQUEST_MORE_INFO',
      title: 'Solicitar mas informacion',
      rationale: baseRationale,
      draft: `Hola ${profile.name}, para orientarte mejor me ayudaria confirmar objetivo principal, horizonte, si lo revisas para ti o para una organizacion, y si existe un presupuesto aproximado.`,
      status: 'PENDING',
    };
  }

  if (signals.educationalIntent) {
    return {
      userId: profile.id,
      leadId: lead.id,
      type: 'SEND_EDUCATIONAL_MATERIAL',
      title: 'Enviar material educativo aprobado',
      rationale: baseRationale,
      draft: `Enviar a ${profile.name} material educativo aprobado de Futuro Academy relacionado con ${interests}. No incluir recomendaciones personalizadas ni promesas de resultado.`,
      status: 'PENDING',
    };
  }

  return {
    userId: profile.id,
    leadId: lead.id,
    type: 'NURTURE_USER',
    title: 'Continuar nutriendo al usuario',
    rationale: baseRationale,
    draft: `Mantener seguimiento educativo con ${profile.name}. Esperar mas senales de necesidad, presupuesto o urgencia antes de proponer una reunion comercial.`,
    status: 'PENDING',
  };
}
