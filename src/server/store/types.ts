import type {
  AdminDashboardPayload,
  ApprovedContentChunk,
  AuthSession,
  ClientRequest,
  Conversation,
  ConversationMessage,
  DiscoveryQuestion,
  Lead,
  Opportunity,
  ProposedAction,
  QuizResult,
  UserProfile,
} from '../../shared/types';

export interface AppStore {
  init(): Promise<void>;
  registerUser(input: { name: string; email: string; password: string }): Promise<AuthSession>;
  login(input: { email: string; password: string }): Promise<AuthSession>;
  logout(token: string): Promise<void>;
  requestPasswordReset(email: string): Promise<void>;
  verifyToken(token: string): Promise<UserProfile | null>;
  completeOnboarding(userId: string): Promise<UserProfile>;
  getProfile(userId: string): Promise<UserProfile | null>;
  getOrCreateConversation(userId: string): Promise<Conversation>;
  listMessages(conversationId: string): Promise<ConversationMessage[]>;
  addMessage(input: Omit<ConversationMessage, 'id' | 'createdAt'>): Promise<ConversationMessage>;
  clearConversation(userId: string): Promise<void>;
  getOrCreateLead(userId: string): Promise<Lead>;
  updateLead(lead: Lead): Promise<Lead>;
  updateConsent(userId: string, consentStatus: Lead['consentStatus']): Promise<Lead>;
  getWorkspace(userId: string): Promise<{
    profile: UserProfile;
    conversation: Conversation;
    messages: ConversationMessage[];
    lead: Lead;
    quizResults: QuizResult[];
    content: ApprovedContentChunk[];
    proposedActions: ProposedAction[];
    clientRequests: ClientRequest[];
  }>;
  createClientRequest(input: Pick<ClientRequest, 'userId' | 'subject' | 'message'>): Promise<ClientRequest>;
  updateClientRequest(
    id: string,
    reviewerId: string,
    input: { status: ClientRequest['status']; response?: string },
  ): Promise<ClientRequest>;
  createQuizResult(input: Omit<QuizResult, 'id' | 'createdAt'>): Promise<QuizResult>;
  createOpportunity(input: Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt'>): Promise<Opportunity>;
  createProposedAction(input: Omit<ProposedAction, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProposedAction>;
  getDiscoveryQuestions(): Promise<DiscoveryQuestion[]>;
  updateDiscoveryQuestion(id: string, patch: Partial<Pick<DiscoveryQuestion, 'text' | 'active' | 'order'>>): Promise<DiscoveryQuestion>;
  getAdminDashboard(): Promise<AdminDashboardPayload>;
  deleteFollowUp(leadId: string): Promise<Lead>;
  reviewAction(
    id: string,
    reviewerId: string,
    input: { status: ProposedAction['status']; draft?: string },
  ): Promise<ProposedAction>;
}
