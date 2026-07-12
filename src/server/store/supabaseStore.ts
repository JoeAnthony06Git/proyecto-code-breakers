import crypto from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { approvedContent, defaultDiscoveryQuestions } from '../../domain/approvedContent';
import type {
  AdminDashboardPayload,
  ApprovedContentChunk,
  AuthSession,
  Conversation,
  ConversationMessage,
  DiscoveryQuestion,
  Lead,
  LeadSignals,
  Opportunity,
  ProposedAction,
  QuizResult,
  ScoreBreakdown,
  UserProfile,
} from '../../shared/types';
import type { AppStore } from './types';

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function emptySignals(): LeadSignals {
  return {
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
  };
}

function emptyBreakdown(): ScoreBreakdown {
  return {
    interest: 0,
    budget: 0,
    fit: 0,
    urgency: 0,
    total: 0,
    priority: 'LOW',
    explanation: ['Esperando conversacion y consentimiento para registrar intereses comerciales.'],
  };
}

function makeLead(userId: string): Lead {
  const timestamp = now();
  return {
    id: id('lead'),
    userId,
    segment: 'UNDETERMINED',
    score: 0,
    priority: 'LOW',
    status: 'NEW',
    consentStatus: 'PENDING',
    signals: emptySignals(),
    scoreBreakdown: emptyBreakdown(),
    conversationSummary: 'Sin resumen todavia.',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function profileFrom(row: any): UserProfile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status ?? 'ACTIVE',
    onboardingCompleted: row.onboarding_completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function profileToRow(profile: UserProfile) {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    onboarding_completed: profile.onboardingCompleted,
    created_at: profile.createdAt,
    updated_at: profile.updatedAt,
  };
}

function conversationFrom(row: any): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function messageFrom(row: any): ConversationMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    userId: row.user_id,
    role: row.role,
    content: row.content,
    citations: row.citations ?? [],
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
  };
}

function leadFrom(row: any): Lead {
  return {
    id: row.id,
    userId: row.user_id,
    segment: row.segment,
    score: row.score,
    priority: row.priority,
    status: row.status,
    consentStatus: row.consent_status,
    signals: row.signals,
    scoreBreakdown: row.score_breakdown,
    conversationSummary: row.conversation_summary ?? 'Sin resumen todavia.',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function leadToRow(lead: Lead) {
  return {
    id: lead.id,
    user_id: lead.userId,
    segment: lead.segment,
    score: lead.score,
    priority: lead.priority,
    status: lead.status,
    consent_status: lead.consentStatus,
    signals: lead.signals,
    score_breakdown: lead.scoreBreakdown,
    conversation_summary: lead.conversationSummary,
    created_at: lead.createdAt,
    updated_at: lead.updatedAt,
  };
}

function actionFrom(row: any): ProposedAction {
  return {
    id: row.id,
    userId: row.user_id,
    leadId: row.lead_id,
    type: row.type,
    title: row.title,
    rationale: row.rationale,
    draft: row.draft,
    status: row.status,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function opportunityFrom(row: any): Opportunity {
  return {
    id: row.id,
    userId: row.user_id,
    leadId: row.lead_id,
    title: row.title,
    status: row.status,
    valueEstimate: row.value_estimate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function quizFrom(row: any): QuizResult {
  return {
    id: row.id,
    userId: row.user_id,
    score: row.score,
    total: row.total,
    answers: row.answers,
    createdAt: row.created_at,
  };
}

function questionFrom(row: any): DiscoveryQuestion {
  return {
    id: row.id,
    segment: row.segment,
    text: row.text,
    active: row.active,
    order: row.display_order,
  };
}

function contentFrom(row: any): ApprovedContentChunk {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    section: row.section,
    content: row.content,
    tags: row.tags,
    approved: row.approved,
  };
}

export class SupabaseStore implements AppStore {
  private service: SupabaseClient;
  private authClient: SupabaseClient;

  constructor(url: string, anonKey: string, serviceRoleKey: string) {
    this.service = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
    this.authClient = createClient(url, anonKey, { auth: { persistSession: false } });
  }

  async init() {
    await this.seedReferenceData();
  }

  private async seedReferenceData() {
    await this.service.from('approved_content').upsert(
      approvedContent.map((chunk) => ({
        id: chunk.id,
        title: chunk.title,
        module: chunk.module,
        section: chunk.section,
        content: chunk.content,
        tags: chunk.tags,
        approved: chunk.approved,
      })),
    );
    await this.service.from('discovery_questions').upsert(
      defaultDiscoveryQuestions.map((question) => ({
        id: question.id,
        segment: question.segment,
        text: question.text,
        active: question.active,
        display_order: question.order,
      })),
    );
  }

  async registerUser(input: { name: string; email: string; password: string }): Promise<AuthSession> {
    const { data, error } = await this.service.auth.admin.createUser({
      email: input.email.toLowerCase().trim(),
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name.trim() },
    });
    if (error || !data.user) throw Object.assign(new Error(error?.message ?? 'No se pudo crear el usuario.'), { status: 400 });
    const timestamp = now();
    await this.service.from('profiles').insert(
      profileToRow({
        id: data.user.id,
        name: input.name.trim(),
        email: input.email.toLowerCase().trim(),
        role: 'USER',
        status: 'ACTIVE',
        onboardingCompleted: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      }),
    );
    const lead = makeLead(data.user.id);
    await this.service.from('leads').insert(leadToRow(lead));
    return this.login({ email: input.email, password: input.password });
  }

  async login(input: { email: string; password: string }): Promise<AuthSession> {
    const { data, error } = await this.authClient.auth.signInWithPassword({
      email: input.email.toLowerCase().trim(),
      password: input.password,
    });
    if (error || !data.session || !data.user) throw Object.assign(new Error('Credenciales invalidas.'), { status: 401 });
    const profile = await this.getProfile(data.user.id);
    if (!profile) throw Object.assign(new Error('Perfil no encontrado.'), { status: 404 });
    if (profile.status !== 'ACTIVE') throw Object.assign(new Error('Perfil inactivo.'), { status: 403 });
    return { token: data.session.access_token, user: profile };
  }

  async logout(token: string) {
    const { error } = await this.service.auth.admin.signOut(token);
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
  }

  async requestPasswordReset(email: string) {
    const { error } = await this.authClient.auth.resetPasswordForEmail(email.toLowerCase().trim());
    if (error) throw Object.assign(new Error(error.message), { status: 400 });
  }

  async verifyToken(token: string) {
    const { data, error } = await this.service.auth.getUser(token);
    if (error || !data.user) return null;
    return this.getProfile(data.user.id);
  }

  async getProfile(userId: string) {
    const { data, error } = await this.service.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return data ? profileFrom(data) : null;
  }

  async completeOnboarding(userId: string) {
    const { data, error } = await this.service
      .from('profiles')
      .update({ onboarding_completed: true, updated_at: now() })
      .eq('id', userId)
      .select('*')
      .single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return profileFrom(data);
  }

  async getOrCreateConversation(userId: string) {
    const { data } = await this.service.from('conversations').select('*').eq('user_id', userId).maybeSingle();
    if (data) return conversationFrom(data);
    const timestamp = now();
    const row = { id: id('conv'), user_id: userId, title: 'Conversacion principal', created_at: timestamp, updated_at: timestamp };
    const { data: created, error } = await this.service.from('conversations').insert(row).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return conversationFrom(created);
  }

  async listMessages(conversationId: string) {
    const { data, error } = await this.service
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return (data ?? []).map(messageFrom);
  }

  async addMessage(input: Omit<ConversationMessage, 'id' | 'createdAt'>) {
    const timestamp = now();
    const row = {
      id: id('msg'),
      conversation_id: input.conversationId,
      user_id: input.userId,
      role: input.role,
      content: input.content,
      citations: input.citations,
      metadata: input.metadata ?? {},
      created_at: timestamp,
    };
    const { data, error } = await this.service.from('conversation_messages').insert(row).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    await this.service.from('conversations').update({ updated_at: timestamp }).eq('id', input.conversationId);
    return messageFrom(data);
  }

  async getOrCreateLead(userId: string) {
    const { data } = await this.service.from('leads').select('*').eq('user_id', userId).maybeSingle();
    if (data) return leadFrom(data);
    const lead = makeLead(userId);
    const { data: created, error } = await this.service.from('leads').insert(leadToRow(lead)).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return leadFrom(created);
  }

  async updateLead(lead: Lead) {
    const updated = { ...lead, updatedAt: now() };
    const { data, error } = await this.service.from('leads').update(leadToRow(updated)).eq('id', lead.id).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return leadFrom(data);
  }

  async updateConsent(userId: string, consentStatus: Lead['consentStatus']) {
    const lead = await this.getOrCreateLead(userId);
    return this.updateLead({ ...lead, consentStatus, status: consentStatus === 'GRANTED' ? 'QUALIFYING' : lead.status });
  }

  async getWorkspace(userId: string) {
    const profile = await this.getProfile(userId);
    if (!profile) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
    const conversation = await this.getOrCreateConversation(userId);
    const messages = await this.listMessages(conversation.id);
    const lead = await this.getOrCreateLead(userId);
    const { data: quizRows } = await this.service.from('quiz_results').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    const { data: contentRows } = await this.service.from('approved_content').select('*').eq('approved', true);
    const { data: actionRows } = await this.service.from('proposed_actions').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return {
      profile,
      conversation,
      messages,
      lead,
      quizResults: (quizRows ?? []).map(quizFrom),
      content: (contentRows ?? []).map(contentFrom),
      proposedActions: (actionRows ?? []).map(actionFrom),
    };
  }

  async createQuizResult(input: Omit<QuizResult, 'id' | 'createdAt'>) {
    const row = { id: id('quiz'), user_id: input.userId, score: input.score, total: input.total, answers: input.answers, created_at: now() };
    const { data, error } = await this.service.from('quiz_results').insert(row).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return quizFrom(data);
  }

  async createOpportunity(input: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>) {
    const { data: existing } = await this.service.from('opportunities').select('*').eq('lead_id', input.leadId).eq('status', 'OPEN').maybeSingle();
    if (existing) return opportunityFrom(existing);
    const timestamp = now();
    const row = {
      id: id('opp'),
      user_id: input.userId,
      lead_id: input.leadId,
      title: input.title,
      status: input.status,
      value_estimate: input.valueEstimate,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const { data, error } = await this.service.from('opportunities').insert(row).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return opportunityFrom(data);
  }

  async createProposedAction(input: Omit<ProposedAction, 'id' | 'createdAt' | 'updatedAt'>) {
    const { data: existing } = await this.service
      .from('proposed_actions')
      .select('*')
      .eq('lead_id', input.leadId)
      .eq('type', input.type)
      .eq('status', 'PENDING')
      .maybeSingle();
    if (existing) return actionFrom(existing);
    const timestamp = now();
    const row = {
      id: id('act'),
      user_id: input.userId,
      lead_id: input.leadId,
      type: input.type,
      title: input.title,
      rationale: input.rationale,
      draft: input.draft,
      status: input.status,
      created_at: timestamp,
      updated_at: timestamp,
    };
    const { data, error } = await this.service.from('proposed_actions').insert(row).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return actionFrom(data);
  }

  async getDiscoveryQuestions() {
    const { data, error } = await this.service.from('discovery_questions').select('*').order('display_order', { ascending: true });
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return (data ?? []).map(questionFrom);
  }

  async updateDiscoveryQuestion(idValue: string, patch: Partial<Pick<DiscoveryQuestion, 'text' | 'active' | 'order'>>) {
    const rowPatch = {
      ...(patch.text !== undefined ? { text: patch.text } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.order !== undefined ? { display_order: patch.order } : {}),
    };
    const { data, error } = await this.service.from('discovery_questions').update(rowPatch).eq('id', idValue).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return questionFrom(data);
  }

  async getAdminDashboard(): Promise<AdminDashboardPayload> {
    const [
      { data: profileRows },
      { data: leadRows },
      { data: conversationRows },
      { data: messageRows },
      { data: quizRows },
      { data: actionRows },
      { data: opportunityRows },
      { data: questionRows },
      { data: contentRows },
    ] = await Promise.all([
      this.service.from('profiles').select('*'),
      this.service.from('leads').select('*'),
      this.service.from('conversations').select('*'),
      this.service.from('conversation_messages').select('*').order('created_at', { ascending: false }),
      this.service.from('quiz_results').select('*').order('created_at', { ascending: false }),
      this.service.from('proposed_actions').select('*').order('created_at', { ascending: false }),
      this.service.from('opportunities').select('*'),
      this.service.from('discovery_questions').select('*'),
      this.service.from('approved_content').select('*'),
    ]);

    const users = (profileRows ?? []).map(profileFrom);
    const leads = (leadRows ?? []).map(leadFrom);
    const userMap = new Map(users.map((user) => [user.id, user]));
    const averageScore = leads.length === 0 ? 0 : Math.round(leads.reduce((total, lead) => total + lead.score, 0) / leads.length);

    return {
      users,
      leads,
      conversations: (conversationRows ?? []).map((row: any) => {
        const conversation = conversationFrom(row);
        const user = userMap.get(conversation.userId);
        return {
          ...conversation,
          userName: user?.name ?? 'Desconocido',
          userEmail: user?.email ?? 'sin correo',
          lastMessage: (messageRows ?? []).find((message: any) => message.conversation_id === conversation.id)?.content,
        };
      }),
      quizResults: (quizRows ?? []).map((row: any) => {
        const result = quizFrom(row);
        const user = userMap.get(result.userId);
        return { ...result, userName: user?.name ?? 'Desconocido', userEmail: user?.email ?? 'sin correo' };
      }),
      proposedActions: (actionRows ?? []).map((row: any) => {
        const action = actionFrom(row);
        const user = userMap.get(action.userId);
        return { ...action, userName: user?.name ?? 'Desconocido', userEmail: user?.email ?? 'sin correo' };
      }),
      opportunities: (opportunityRows ?? []).map(opportunityFrom),
      discoveryQuestions: (questionRows ?? []).map(questionFrom),
      content: (contentRows ?? []).map(contentFrom),
      metrics: {
        totalUsers: users.length,
        highPriorityLeads: leads.filter((lead) => lead.priority === 'HIGH').length,
        pendingActions: (actionRows ?? []).filter((action: any) => action.status === 'PENDING').length,
        averageScore,
        grantedConsent: leads.filter((lead) => lead.consentStatus === 'GRANTED').length,
      },
    };
  }

  async reviewAction(idValue: string, reviewerId: string, input: { status: ProposedAction['status']; draft?: string }) {
    const reviewedAt = now();
    const patch = {
      status: input.status,
      ...(input.draft ? { draft: input.draft } : {}),
      reviewed_by: reviewerId,
      reviewed_at: reviewedAt,
      updated_at: reviewedAt,
    };
    const { data, error } = await this.service.from('proposed_actions').update(patch).eq('id', idValue).select('*').single();
    if (error) throw Object.assign(new Error(error.message), { status: 500 });
    return actionFrom(data);
  }
}
