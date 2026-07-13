import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { approvedContent, defaultDiscoveryQuestions } from '../../domain/approvedContent';
import type {
  AdminDashboardPayload,
  ApprovedContentChunk,
  AuthSession,
  ClientRequest,
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

interface StoredUser extends UserProfile {
  passwordHash: string;
  passwordSalt: string;
}

interface SessionRecord {
  token: string;
  userId: string;
  expiresAt: string;
}

interface DemoDb {
  users: StoredUser[];
  sessions: SessionRecord[];
  conversations: Conversation[];
  messages: ConversationMessage[];
  leads: Lead[];
  opportunities: Opportunity[];
  proposedActions: ProposedAction[];
  clientRequests: ClientRequest[];
  quizResults: QuizResult[];
  discoveryQuestions: DiscoveryQuestion[];
  content: ApprovedContentChunk[];
}

const defaultDataPath = path.resolve(process.cwd(), 'data', 'demo-db.json');

function now() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const passwordHash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return { passwordHash, passwordSalt: salt };
}

function verifyPassword(password: string, user: StoredUser) {
  const candidate = hashPassword(password, user.passwordSalt).passwordHash;
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(user.passwordHash, 'hex'));
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

function publicUser(user: StoredUser): UserProfile {
  const { passwordHash: _passwordHash, passwordSalt: _passwordSalt, ...profile } = user;
  return profile;
}

export class FileStore implements AppStore {
  private db: DemoDb | null = null;

  constructor(private readonly filePath = defaultDataPath) {}

  async init() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      this.db = JSON.parse(raw) as DemoDb;
      this.migrateInMemoryDb();
    } catch {
      const timestamp = now();
      const adminPassword = hashPassword('Admin123!');
      this.db = {
        users: [
          {
            id: 'user_admin',
            name: 'Admin Agentic',
            email: 'admin@agentic.scale',
            role: 'ADMIN',
            status: 'ACTIVE',
            onboardingCompleted: false,
            createdAt: timestamp,
            updatedAt: timestamp,
            ...adminPassword,
          },
        ],
        sessions: [],
        conversations: [],
        messages: [],
        leads: [],
        opportunities: [],
        proposedActions: [],
        clientRequests: [],
        quizResults: [],
        discoveryQuestions: defaultDiscoveryQuestions,
        content: approvedContent,
      };
      await this.persist();
    }
  }

  private migrateInMemoryDb() {
    for (const lead of this.data.leads) {
      lead.signals = { ...emptySignals(), ...lead.signals, objections: lead.signals?.objections ?? [] };
      lead.conversationSummary = lead.conversationSummary ?? 'Sin resumen todavia.';
    }
    for (const user of this.data.users) {
      user.status = user.status ?? 'ACTIVE';
    }
    this.data.discoveryQuestions = this.data.discoveryQuestions ?? [];
    for (const question of defaultDiscoveryQuestions) {
      if (!this.data.discoveryQuestions.some((item) => item.id === question.id)) {
        this.data.discoveryQuestions.push(question);
      }
    }
    this.data.content = this.data.content ?? [];
    this.data.clientRequests = this.data.clientRequests ?? [];
    for (const chunk of approvedContent) {
      if (!this.data.content.some((item) => item.id === chunk.id)) {
        this.data.content.push(chunk);
      }
    }
    for (const chunk of this.data.content) {
      chunk.approved = chunk.approved ?? true;
    }
  }

  private get data() {
    if (!this.db) throw new Error('Store not initialized');
    return this.db;
  }

  private async persist() {
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
  }

  async registerUser(input: { name: string; email: string; password: string }): Promise<AuthSession> {
    const email = input.email.toLowerCase().trim();
    if (this.data.users.some((user) => user.email === email)) {
      throw Object.assign(new Error('El correo ya esta registrado.'), { status: 409 });
    }
    const timestamp = now();
    const user: StoredUser = {
      id: id('user'),
      name: input.name.trim(),
      email,
      role: 'USER',
      status: 'ACTIVE',
      onboardingCompleted: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      ...hashPassword(input.password),
    };
    this.data.users.push(user);
    this.data.leads.push(makeLead(user.id));
    await this.persist();
    return this.createSession(user);
  }

  async login(input: { email: string; password: string }): Promise<AuthSession> {
    const user = this.data.users.find((item) => item.email === input.email.toLowerCase().trim());
    if (!user || user.status !== 'ACTIVE' || !verifyPassword(input.password, user)) {
      throw Object.assign(new Error('Credenciales invalidas.'), { status: 401 });
    }
    return this.createSession(user);
  }

  async logout(token: string) {
    this.data.sessions = this.data.sessions.filter((session) => session.token !== token);
    await this.persist();
  }

  async requestPasswordReset(_email: string) {
    await this.persist();
  }

  private async createSession(user: StoredUser): Promise<AuthSession> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    this.data.sessions.push({ token, userId: user.id, expiresAt });
    await this.persist();
    return { token, user: publicUser(user) };
  }

  async verifyToken(token: string): Promise<UserProfile | null> {
    const session = this.data.sessions.find((item) => item.token === token);
    if (!session || new Date(session.expiresAt).getTime() < Date.now()) return null;
    const user = this.data.users.find((item) => item.id === session.userId);
    return user ? publicUser(user) : null;
  }

  async getProfile(userId: string) {
    const user = this.data.users.find((item) => item.id === userId);
    return user ? publicUser(user) : null;
  }

  async completeOnboarding(userId: string) {
    const user = this.data.users.find((item) => item.id === userId);
    if (!user) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
    user.onboardingCompleted = true;
    user.updatedAt = now();
    await this.persist();
    return publicUser(user);
  }

  async getOrCreateConversation(userId: string) {
    let conversation = this.data.conversations.find((item) => item.userId === userId);
    if (!conversation) {
      const timestamp = now();
      conversation = {
        id: id('conv'),
        userId,
        title: 'Conversacion principal',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.data.conversations.push(conversation);
      await this.persist();
    }
    return conversation;
  }

  async listMessages(conversationId: string) {
    return this.data.messages.filter((message) => message.conversationId === conversationId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async addMessage(input: Omit<ConversationMessage, 'id' | 'createdAt'>) {
    const message: ConversationMessage = { ...input, id: id('msg'), createdAt: now() };
    this.data.messages.push(message);
    const conversation = this.data.conversations.find((item) => item.id === input.conversationId);
    if (conversation) conversation.updatedAt = message.createdAt;
    await this.persist();
    return message;
  }

  async clearConversation(userId: string) {
    const conversation = await this.getOrCreateConversation(userId);
    this.data.messages = this.data.messages.filter((message) => message.conversationId !== conversation.id);
    conversation.updatedAt = now();
    await this.persist();
  }

  async getOrCreateLead(userId: string) {
    let lead = this.data.leads.find((item) => item.userId === userId);
    if (!lead) {
      lead = makeLead(userId);
      this.data.leads.push(lead);
      await this.persist();
    }
    return lead;
  }

  async updateLead(lead: Lead) {
    const index = this.data.leads.findIndex((item) => item.id === lead.id);
    if (index < 0) throw Object.assign(new Error('Lead no encontrado.'), { status: 404 });
    const updated = { ...lead, updatedAt: now() };
    this.data.leads[index] = updated;
    await this.persist();
    return updated;
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
    const quizResults = this.data.quizResults.filter((result) => result.userId === userId);
    const proposedActions = this.data.proposedActions.filter((action) => action.userId === userId);
    const clientRequests = this.data.clientRequests
      .filter((request) => request.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      profile,
      conversation,
      messages,
      lead,
      quizResults,
      content: this.data.content,
      proposedActions,
      clientRequests,
    };
  }

  async createClientRequest(input: Pick<ClientRequest, 'userId' | 'subject' | 'message'>) {
    const timestamp = now();
    const request: ClientRequest = {
      ...input,
      id: id('req'),
      status: 'OPEN',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.data.clientRequests.push(request);
    await this.persist();
    return request;
  }

  async updateClientRequest(idValue: string, reviewerId: string, input: { status: ClientRequest['status']; response?: string }) {
    const request = this.data.clientRequests.find((item) => item.id === idValue);
    if (!request) throw Object.assign(new Error('Solicitud no encontrada.'), { status: 404 });
    request.status = input.status;
    if (input.response !== undefined) {
      request.response = input.response;
      request.respondedBy = reviewerId;
      request.respondedAt = now();
    }
    request.updatedAt = now();
    await this.persist();
    return request;
  }

  async createQuizResult(input: Omit<QuizResult, 'id' | 'createdAt'>) {
    const result: QuizResult = { ...input, id: id('quiz'), createdAt: now() };
    this.data.quizResults.push(result);
    await this.persist();
    return result;
  }

  async createOpportunity(input: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>) {
    const existing = this.data.opportunities.find((item) => item.leadId === input.leadId && item.status === 'OPEN');
    if (existing) return existing;
    const timestamp = now();
    const opportunity: Opportunity = { ...input, id: id('opp'), createdAt: timestamp, updatedAt: timestamp };
    this.data.opportunities.push(opportunity);
    await this.persist();
    return opportunity;
  }

  async createProposedAction(input: Omit<ProposedAction, 'id' | 'createdAt' | 'updatedAt'>) {
    const existing = this.data.proposedActions.find(
      (item) => item.leadId === input.leadId && item.type === input.type && item.status === 'PENDING',
    );
    if (existing) return existing;
    const timestamp = now();
    const action: ProposedAction = { ...input, id: id('act'), createdAt: timestamp, updatedAt: timestamp };
    this.data.proposedActions.push(action);
    await this.persist();
    return action;
  }

  async getDiscoveryQuestions() {
    return this.data.discoveryQuestions.sort((a, b) => a.order - b.order);
  }

  async updateDiscoveryQuestion(idValue: string, patch: Partial<Pick<DiscoveryQuestion, 'text' | 'active' | 'order'>>) {
    const question = this.data.discoveryQuestions.find((item) => item.id === idValue);
    if (!question) throw Object.assign(new Error('Pregunta no encontrada.'), { status: 404 });
    Object.assign(question, patch);
    await this.persist();
    return question;
  }

  async getAdminDashboard(): Promise<AdminDashboardPayload> {
    const users = this.data.users.map(publicUser);
    const userMap = new Map(users.map((user) => [user.id, user]));
    const averageScore =
      this.data.leads.length === 0 ? 0 : Math.round(this.data.leads.reduce((total, lead) => total + lead.score, 0) / this.data.leads.length);
    return {
      users,
      leads: this.data.leads,
      conversations: this.data.conversations.map((conversation) => {
        const user = userMap.get(conversation.userId);
        const lastMessage = this.data.messages
          .filter((message) => message.conversationId === conversation.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.content;
        return {
          ...conversation,
          userName: user?.name ?? 'Desconocido',
          userEmail: user?.email ?? 'sin correo',
          lastMessage,
        };
      }),
      quizResults: this.data.quizResults.map((result) => {
        const user = userMap.get(result.userId);
        return {
          ...result,
          userName: user?.name ?? 'Desconocido',
          userEmail: user?.email ?? 'sin correo',
        };
      }),
      proposedActions: this.data.proposedActions.map((action) => {
        const user = userMap.get(action.userId);
        return {
          ...action,
          userName: user?.name ?? 'Desconocido',
          userEmail: user?.email ?? 'sin correo',
        };
      }),
      clientRequests: this.data.clientRequests.map((request) => {
        const user = userMap.get(request.userId);
        return {
          ...request,
          userName: user?.name ?? 'Desconocido',
          userEmail: user?.email ?? 'sin correo',
        };
      }),
      opportunities: this.data.opportunities,
      discoveryQuestions: this.data.discoveryQuestions,
      content: this.data.content,
      metrics: {
        totalUsers: users.length,
        highPriorityLeads: this.data.leads.filter((lead) => lead.priority === 'HIGH').length,
        pendingActions: this.data.proposedActions.filter((action) => action.status === 'PENDING').length,
        averageScore,
        grantedConsent: this.data.leads.filter((lead) => lead.consentStatus === 'GRANTED').length,
      },
    };
  }

  async reviewAction(idValue: string, reviewerId: string, input: { status: ProposedAction['status']; draft?: string }) {
    const action = this.data.proposedActions.find((item) => item.id === idValue);
    if (!action) throw Object.assign(new Error('Accion no encontrada.'), { status: 404 });
    action.status = input.status;
    if (input.draft) action.draft = input.draft;
    action.reviewedBy = reviewerId;
    action.reviewedAt = now();
    action.updatedAt = action.reviewedAt;
    await this.persist();
    return action;
  }

  async deleteFollowUp(leadId: string) {
    const lead = this.data.leads.find((item) => item.id === leadId);
    if (!lead) throw Object.assign(new Error('Lead no encontrado.'), { status: 404 });
    return this.updateLead({ ...lead, status: 'CLOSED' });
  }
}
