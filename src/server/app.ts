import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { createAssistantTurn } from '../domain/conversationOrchestrator';
import { gradeQuiz, quizQuestions } from '../domain/quiz';
import type { ConversationMessage, Lead, ProposedAction, Role, UserProfile } from '../shared/types';
import type { AssistantTurnOutput } from '../domain/conversationOrchestrator';
import { config } from './config';
import type { AppStore } from './store/types';

type AuthedRequest = Request & { user: UserProfile };

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = authSchema.extend({
  name: z.string().min(2).max(80),
});

const passwordResetSchema = z.object({
  email: z.string().email(),
});

const messageSchema = z.object({
  message: z.string().min(1).max(2500),
});

const consentSchema = z.object({
  consent: z.enum(['GRANTED', 'REJECTED']),
});

const quizSchema = z.object({
  answers: z.array(z.number().int().min(0)).length(3),
});

const actionReviewSchema = z.object({
  status: z.enum(['APPROVED', 'EDITED', 'REJECTED']),
  draft: z.string().max(1200).optional(),
});

const questionPatchSchema = z.object({
  text: z.string().min(10).max(300).optional(),
  active: z.boolean().optional(),
  order: z.number().int().min(1).max(100).optional(),
});

function cleanMessage(message: string) {
  return message.trim();
}

function hasAdminAccess(role: Role) {
  return role === 'ADMIN' || role === 'EXECUTIVE' || role === 'SUPER_ADMIN';
}

function zeroScoreBecauseNoConsent(lead: Lead, segment: Lead['segment']): Pick<Lead, 'score' | 'priority' | 'scoreBreakdown'> {
  return {
    score: 0,
    priority: 'LOW',
    scoreBreakdown: {
      interest: 0,
      budget: 0,
      fit: segment === 'UNDETERMINED' ? 0 : 10,
      urgency: 0,
      total: 0,
      priority: 'LOW',
      explanation: [
        lead.consentStatus === 'REJECTED'
          ? 'El usuario rechazo registrar intereses comerciales.'
          : 'Esperando consentimiento para registrar intereses comerciales.',
      ],
    },
  };
}

function publicSignalsWithoutCommercialData(signals: AssistantTurnOutput['signals']) {
  return {
    ...signals,
    interestTags: [],
    budgetDetected: false,
    budgetText: undefined,
    urgencyDetected: false,
    urgencyText: undefined,
    objections: [],
    commercialIntent: false,
  };
}

function redactLeadForUser(lead: Lead): Lead {
  return {
    ...lead,
    segment: 'UNDETERMINED',
    score: 0,
    priority: 'LOW',
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
      explanation: ['Tu conversacion se usa para personalizar la respuesta. La calificacion comercial solo es visible para el equipo autorizado.'],
    },
    conversationSummary: '',
  };
}

function redactMessageForUser(message: ConversationMessage): ConversationMessage {
  const metadata = message.metadata
    ? {
        usedGemini: message.metadata.usedGemini,
        consentPrompt: message.metadata.consentPrompt,
      }
    : undefined;
  return { ...message, metadata };
}

function redactActionForUser(action: ProposedAction): ProposedAction {
  return {
    ...action,
    rationale: 'Pendiente de revision humana.',
    draft: '',
  };
}

function redactWorkspaceForRole<T extends { lead: Lead; messages: ConversationMessage[]; proposedActions: ProposedAction[] }>(
  workspace: T,
  role: Role,
): T {
  if (hasAdminAccess(role)) return workspace;
  return {
    ...workspace,
    lead: redactLeadForUser(workspace.lead),
    messages: workspace.messages.map(redactMessageForUser),
    proposedActions: workspace.proposedActions.map(redactActionForUser),
  };
}

export function createApp(store: AppStore) {
  const app = express();
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  async function requireAuth(req: Request, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      res.status(401).json({ error: 'Sesion requerida.' });
      return;
    }
    const user = await store.verifyToken(token);
    if (!user) {
      res.status(401).json({ error: 'Sesion invalida o expirada.' });
      return;
    }
    (req as AuthedRequest).user = user;
    next();
  }

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const user = (req as AuthedRequest).user;
    if (!hasAdminAccess(user.role)) {
      res.status(403).json({ error: 'No autorizado para acceder al CRM administrativo.' });
      return;
    }
    next();
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, storage: config.useSupabase ? 'supabase' : 'local-demo', gemini: Boolean(config.geminiApiKey) });
  });

  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const input = registerSchema.parse(req.body);
      const session = await store.registerUser(input);
      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const input = authSchema.parse(req.body);
      const session = await store.login(input);
      res.json(session);
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/logout', requireAuth, async (req, res, next) => {
    try {
      const header = req.headers.authorization;
      const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
      await store.logout(token);
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/auth/password-reset', async (req, res, next) => {
    try {
      const input = passwordResetSchema.parse(req.body);
      await store.requestPasswordReset(input.email);
      res.json({ ok: true, message: 'Si el correo existe, recibira instrucciones de recuperacion.' });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/me', requireAuth, (req, res) => {
    res.json({ user: (req as AuthedRequest).user });
  });

  app.post('/api/onboarding/complete', requireAuth, async (req, res, next) => {
    try {
      const profile = await store.completeOnboarding((req as AuthedRequest).user.id);
      res.json({ user: profile });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/workspace', requireAuth, async (req, res, next) => {
    try {
      const user = (req as AuthedRequest).user;
      const workspace = await store.getWorkspace(user.id);
      res.json({ ...redactWorkspaceForRole(workspace, user.role), quizQuestions });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/consent', requireAuth, async (req, res, next) => {
    try {
      const input = consentSchema.parse(req.body);
      const user = (req as AuthedRequest).user;
      const lead = await store.updateConsent(user.id, input.consent);
      res.json({ lead: hasAdminAccess(user.role) ? lead : redactLeadForUser(lead) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/conversations/message', requireAuth, async (req, res, next) => {
    try {
      const { message } = messageSchema.parse(req.body);
      const user = (req as AuthedRequest).user;
      const conversation = await store.getOrCreateConversation(user.id);
      const previousMessages = await store.listMessages(conversation.id);
      const lead = await store.getOrCreateLead(user.id);
      const discoveryQuestions = await store.getDiscoveryQuestions();

      const userMessage = await store.addMessage({
        conversationId: conversation.id,
        userId: user.id,
        role: 'user',
        content: cleanMessage(message),
        citations: [],
      });

      const turn = await createAssistantTurn({
        profile: user,
        lead,
        userText: userMessage.content,
        history: previousMessages,
        discoveryQuestions,
      });
      const commercialStorageAllowed = lead.consentStatus === 'GRANTED';
      const leadScoring = commercialStorageAllowed
        ? { score: turn.scoreBreakdown.total, priority: turn.scoreBreakdown.priority, scoreBreakdown: turn.scoreBreakdown }
        : zeroScoreBecauseNoConsent(lead, turn.signals.segment);
      const updatedLead = await store.updateLead({
        ...lead,
        segment: turn.signals.segment,
        score: leadScoring.score,
        priority: leadScoring.priority,
        scoreBreakdown: leadScoring.scoreBreakdown,
        signals: commercialStorageAllowed ? turn.signals : publicSignalsWithoutCommercialData(turn.signals),
        conversationSummary: turn.conversationSummary,
        status: commercialStorageAllowed && turn.shouldCreateOpportunity ? 'HUMAN_REVIEW' : commercialStorageAllowed ? 'QUALIFYING' : lead.status,
      });

      if (commercialStorageAllowed && turn.shouldCreateOpportunity) {
        await store.createOpportunity({
          userId: user.id,
          leadId: lead.id,
          title: 'Oportunidad con supervision humana',
          status: 'OPEN',
          valueEstimate: null,
        });
      }

      const proposedAction =
        commercialStorageAllowed && turn.proposedAction ? await store.createProposedAction(turn.proposedAction) : undefined;
      const usedGemini = turn.usedSkills.includes('geminiConversationEngine');
      const assistantMessage = await store.addMessage({
        conversationId: conversation.id,
        userId: user.id,
        role: 'assistant',
        content: turn.assistantText,
        citations: turn.citations,
        metadata: {
          usedGemini,
          consentPrompt: turn.consentPrompt,
          scoreBreakdown: updatedLead.scoreBreakdown,
          segment: updatedLead.segment,
          usedSkills: turn.usedSkills,
        },
      });

      res.json({
        userMessage: hasAdminAccess(user.role) ? userMessage : redactMessageForUser(userMessage),
        assistantMessage: hasAdminAccess(user.role) ? assistantMessage : redactMessageForUser(assistantMessage),
        lead: hasAdminAccess(user.role) ? updatedLead : redactLeadForUser(updatedLead),
        consentPrompt: turn.consentPrompt,
        proposedAction: hasAdminAccess(user.role) ? proposedAction : undefined,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/quiz/submit', requireAuth, async (req, res, next) => {
    try {
      const input = quizSchema.parse(req.body);
      const grade = gradeQuiz(input.answers);
      const result = await store.createQuizResult({
        userId: (req as AuthedRequest).user.id,
        score: grade.score,
        total: grade.total,
        answers: input.answers,
      });
      res.json({ result, grade });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/dashboard', requireAuth, requireAdmin, async (_req, res, next) => {
    try {
      res.json(await store.getAdminDashboard());
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/actions/:id/review', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const input = actionReviewSchema.parse(req.body);
      const action = await store.reviewAction(String(req.params.id), (req as AuthedRequest).user.id, input);
      res.json({ action });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/admin/discovery-questions/:id', requireAuth, requireAdmin, async (req, res, next) => {
    try {
      const input = questionPatchSchema.parse(req.body);
      const question = await store.updateDiscoveryQuestion(String(req.params.id), input);
      res.json({ question });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Datos invalidos.', details: error.flatten() });
      return;
    }
    const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status: number }).status) : 500;
    const message = error instanceof Error ? error.message : 'Error interno.';
    res.status(status || 500).json({ error: message });
  });

  return app;
}
