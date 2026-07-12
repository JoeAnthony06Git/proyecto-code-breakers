import type { LeadPriority, LeadSignals, ScoreBreakdown, Segment } from '../shared/types';

const b2bTerms = [
  'empresa',
  'organizacion',
  'equipo',
  'colaboradores',
  'empleados',
  'clientes',
  'negocio',
  'compania',
  'startup',
  'area comercial',
  'capacitacion',
  'corporativo',
  'institucion',
  'organizacion',
  'personas participarian',
  'participantes',
  'para una organizacion',
];

const b2cTerms = [
  'yo',
  'mi jubilacion',
  'mis finanzas',
  'mi ahorro',
  'mi familia',
  'quiero invertir',
  'quiero aprender',
  'para mi',
  'personal',
  'deudas',
  'para mi',
  'para mi familia',
  'solucion para mi',
];

const commercialTerms = [
  'precio',
  'costo',
  'contratar',
  'asesor',
  'especialista',
  'demo',
  'reunion',
  'llamada',
  'contacto',
  'plan',
  'servicio',
  'programa',
];

const educationalTerms = [
  'aprender',
  'explica',
  'explicame',
  'que es',
  'como funciona',
  'financiero',
  'inversion',
  'ahorro',
  'jubilacion',
  'riesgo',
  'presupuesto',
  'fondo',
  'interes',
  'diversificacion',
];

const urgentTerms = ['urgente', 'pronto', 'esta semana', 'este mes', 'ahora', 'lo antes', 'inmediato'];

const objectionPatterns = [
  {
    label: 'precio',
    terms: ['muy caro', 'caro', 'costo', 'costos', 'preocupa el costo', 'presupuesto limitado', 'no tengo presupuesto', 'se sale del presupuesto'],
  },
  { label: 'tiempo', terms: ['no tengo tiempo', 'mas adelante', 'despues', 'no es prioridad', 'aun no'] },
  { label: 'confianza', terms: ['no confio', 'me preocupa', 'nos preocupa', 'dudas', 'no estoy seguro', 'riesgoso'] },
  { label: 'autoridad', terms: ['debo consultarlo', 'necesito aprobarlo', 'lo revisa mi jefe', 'lo decide gerencia'] },
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(normalize(term)));
}

function extractBudget(text: string) {
  const amountMatch = text.match(/(\$|usd|dolares|presupuesto|invertir|mensualidad|mensual|pagar)\s?[\d.,]+|[\d.,]+\s?(\$|usd|dolares|mensuales|al mes)/i);
  if (amountMatch) return amountMatch[0];
  if (includesAny(text, ['presupuesto', 'cuanto cuesta', 'mensual', 'pagar', 'invertir'])) return 'presupuesto mencionado';
  return undefined;
}

function detectObjections(text: string) {
  return objectionPatterns
    .filter((pattern) => includesAny(text, pattern.terms))
    .map((pattern) => pattern.label);
}

function detectSegment(text: string): Segment {
  const companyContext = includesAny(text, b2bTerms);
  const personalContext = includesAny(text, b2cTerms);
  if (companyContext && !personalContext) return 'B2B';
  if (personalContext && !companyContext) return 'B2C';
  if (companyContext && personalContext) return 'B2B';
  return 'UNDETERMINED';
}

function priorityFromScore(total: number): LeadPriority {
  if (total >= 75) return 'HIGH';
  if (total >= 50) return 'MEDIUM';
  return 'LOW';
}

export function analyzeLeadContext(messages: string[]): { signals: LeadSignals; breakdown: ScoreBreakdown } {
  const text = normalize(messages.join(' '));
  const budgetText = extractBudget(text);
  const segment = detectSegment(text);
  const educationalIntent = includesAny(text, educationalTerms);
  const commercialIntent = includesAny(text, commercialTerms);
  const companyContext = includesAny(text, b2bTerms);
  const personalContext = includesAny(text, b2cTerms);
  const urgencyText = urgentTerms.find((term) => text.includes(normalize(term)));
  const objections = detectObjections(text);
  const contactRequested = includesAny(text, ['contacto', 'especialista', 'asesor', 'reunion', 'llamada', 'agenda']);
  const interestTags = [
    ...new Set(
      [
        educationalIntent ? 'educacion financiera' : undefined,
        commercialIntent ? 'interes comercial' : undefined,
        companyContext ? 'contexto empresa' : undefined,
        personalContext ? 'contexto personal' : undefined,
        text.includes('jubilacion') ? 'jubilacion' : undefined,
        text.includes('riesgo') ? 'riesgo' : undefined,
        text.includes('presupuesto') ? 'presupuesto' : undefined,
        objections.length > 0 ? `objecion: ${objections.join(', ')}` : undefined,
      ].filter(Boolean) as string[],
    ),
  ];

  const interest = Math.min(30, (educationalIntent ? 14 : 0) + (commercialIntent ? 10 : 0) + (interestTags.length >= 2 ? 6 : 0));
  const budget = budgetText ? (budgetText === 'presupuesto mencionado' ? 15 : 25) : 0;
  const fit = segment === 'UNDETERMINED' ? (educationalIntent || commercialIntent ? 10 : 0) : companyContext || personalContext ? 25 : 15;
  const urgency = urgencyText ? 20 : contactRequested ? 14 : 0;
  const objectionPenalty = Math.min(10, objections.length * 5);
  const total = Math.max(0, interest + budget + fit + urgency - objectionPenalty);

  const explanation = [
    `Interes ${interest}/30 por senales educativas o comerciales.`,
    `Presupuesto ${budget}/25 ${budgetText ? `por "${budgetText}".` : 'sin senal suficiente.'}`,
    `Encaje ${fit}/25 con clasificacion interna ${segment}.`,
    `Urgencia ${urgency}/20 ${urgencyText ? `por "${urgencyText}".` : contactRequested ? 'por solicitud de contacto.' : 'sin urgencia explicita.'}`,
    objections.length > 0 ? `Objeciones detectadas: ${objections.join(', ')}. Ajuste -${objectionPenalty}.` : 'Sin objeciones explicitas detectadas.',
  ];

  return {
    signals: {
      segment,
      interestTags,
      budgetDetected: Boolean(budgetText),
      budgetText,
      urgencyDetected: Boolean(urgencyText),
      urgencyText,
      objections,
      contactRequested,
      educationalIntent,
      commercialIntent,
      companyContext,
      personalContext,
    },
    breakdown: {
      interest,
      budget,
      fit,
      urgency,
      total,
      priority: priorityFromScore(total),
      explanation,
    },
  };
}
