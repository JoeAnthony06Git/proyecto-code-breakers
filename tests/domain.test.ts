import { describe, expect, it } from 'vitest';
import { defaultDiscoveryQuestions } from '../src/domain/approvedContent';
import { actionTypeLabel, recommendCommercialAction } from '../src/domain/commercialFollowUp';
import { createAssistantTurn } from '../src/domain/conversationOrchestrator';
import { analyzeLeadContext } from '../src/domain/leadScoring';
import { answerFromApprovedContent, retrieveApprovedContent } from '../src/domain/rag';
import { gradeQuiz } from '../src/domain/quiz';
import type { Lead, UserProfile } from '../src/shared/types';

describe('lead scoring', () => {
  it('detecta contexto B2B sin pedirlo explicitamente', () => {
    const analysis = analyzeLeadContext([
      'Trabajo en una empresa y queremos capacitar a 40 colaboradores este mes. Tenemos presupuesto mensual.',
    ]);

    expect(analysis.signals.segment).toBe('B2B');
    expect(analysis.breakdown.total).toBeGreaterThanOrEqual(75);
    expect(analysis.breakdown.priority).toBe('HIGH');
  });

  it('mantiene UNDETERMINED cuando faltan senales suficientes', () => {
    const analysis = analyzeLeadContext(['Hola, quiero conversar.']);
    expect(analysis.signals.segment).toBe('UNDETERMINED');
    expect(analysis.breakdown.total).toBeLessThan(50);
  });

  it('identifica objeciones y las incorpora al analisis interno', () => {
    const analysis = analyzeLeadContext(['Me interesa, pero me parece muy caro y debo consultarlo con gerencia.']);
    expect(analysis.signals.objections).toEqual(expect.arrayContaining(['precio', 'autoridad']));
    expect(analysis.breakdown.explanation.join(' ')).toContain('Objeciones detectadas');
  });

  it('detecta preocupacion por costo como objecion de precio', () => {
    const analysis = analyzeLeadContext(['Somos una empresa y nos preocupa el costo del programa.']);
    expect(analysis.signals.objections).toContain('precio');
  });
});

describe('agent discovery skills', () => {
  const profile: UserProfile = {
    id: 'user_1',
    name: 'Demo',
    email: 'demo@example.com',
    role: 'USER',
    status: 'ACTIVE',
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const lead: Lead = {
    id: 'lead_1',
    userId: 'user_1',
    segment: 'UNDETERMINED',
    score: 0,
    priority: 'LOW',
    status: 'NEW',
    consentStatus: 'GRANTED',
    signals: {
      segment: 'UNDETERMINED',
      interestTags: [],
      budgetDetected: false,
      urgencyDetected: false,
      objections: [],
      contactRequested: false,
      educationalIntent: false,
      commercialIntent: false,
      companyContext: false,
      personalContext: false,
    },
    scoreBreakdown: {
      interest: 0,
      budget: 0,
      fit: 0,
      urgency: 0,
      total: 0,
      priority: 'LOW',
      explanation: [],
    },
    conversationSummary: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('evita repetir preguntas que ya fueron contestadas', async () => {
    const turn = await createAssistantTurn({
      profile,
      lead,
      userText: 'Es para mi empresa, participarian 40 personas y queremos empezar esta semana.',
      history: [],
      discoveryQuestions: defaultDiscoveryQuestions,
    });

    expect(turn.signals.segment).toBe('B2B');
    expect(turn.assistantText).not.toContain('Cuantas personas participarian');
    expect(turn.assistantText).not.toContain('para ti, para tu familia o para un equipo');
    expect(turn.usedSkills).toContain('skillSelectDiscoveryQuestion');
  });

  it('propone una accion comercial pendiente sin enviarla automaticamente', async () => {
    const turn = await createAssistantTurn({
      profile,
      lead,
      userText: 'Somos una empresa de 40 personas, tenemos presupuesto y queremos una reunion esta semana.',
      history: [],
      discoveryQuestions: defaultDiscoveryQuestions,
    });

    expect(turn.proposedAction?.status).toBe('PENDING');
    expect(actionTypeLabel(turn.proposedAction!.type)).toMatch(/Agendar|Marcar/);
    expect(turn.proposedAction?.draft).toMatch(/revis/i);
  });

  it('recomienda solicitar informacion cuando faltan presupuesto o perfil', () => {
    const action = recommendCommercialAction({
      profile,
      lead,
      signals: {
        ...lead.signals,
        educationalIntent: true,
        interestTags: ['educacion financiera'],
      },
      scoreBreakdown: {
        interest: 20,
        budget: 0,
        fit: 10,
        urgency: 0,
        total: 30,
        priority: 'LOW',
        explanation: [],
      },
      conversationSummary: 'Quiere aprender, pero falta contexto comercial.',
    });

    expect(action.type).toBe('REQUEST_MORE_INFO');
    expect(action.status).toBe('PENDING');
  });
});

describe('rag guardrails', () => {
  it('responde con fuentes aprobadas para educacion financiera', () => {
    const answer = answerFromApprovedContent('Como empiezo a invertir para mi jubilacion?');
    expect(answer.grounded).toBe(true);
    expect(answer.citations.length).toBeGreaterThan(0);
    expect(answer.answer).toContain('contenido educativo');
  });

  it('rechaza cuando no hay contenido financiero aprobado relevante', () => {
    const answer = answerFromApprovedContent('Cual es la capital de Islandia?');
    expect(answer.grounded).toBe(false);
    expect(answer.citations).toHaveLength(0);
  });

  it('solo recupera chunks aprobados', () => {
    const chunks = retrieveApprovedContent('riesgo diversificacion', 3, [
      {
        id: 'bad',
        title: 'No aprobado',
        module: 'X',
        section: 'Y',
        content: 'riesgo diversificacion',
        tags: ['riesgo'],
        approved: false,
      },
    ]);
    expect(chunks).toHaveLength(0);
  });

  it('usa la base empresarial ficticia como memoria RAG aprobada', () => {
    const chunks = retrieveApprovedContent('ingresos de NubeCondor Tech en 2025', 1);
    const answer = answerFromApprovedContent('Cuales fueron los ingresos de NubeCondor Tech en 2025?');

    expect(chunks[0]?.title).toBe('NubeCóndor Tech S.A.S.');
    expect(answer.grounded).toBe(true);
    expect(answer.citations[0]?.title).toBe('NubeCóndor Tech S.A.S.');
    expect(answer.answer).toContain('21,8 millones');
    expect(answer.answer).toContain('Datos ficticios y simulados');
  });
});

describe('quiz', () => {
  it('califica tres preguntas financieras', () => {
    const result = gradeQuiz([1, 2, 0]);
    expect(result.score).toBe(3);
    expect(result.passed).toBe(true);
  });
});
