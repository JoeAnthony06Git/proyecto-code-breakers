export type Role = 'USER' | 'ADMIN' | 'EXECUTIVE' | 'SUPER_ADMIN';
export type Segment = 'B2B' | 'B2C' | 'UNDETERMINED';
export type ConsentStatus = 'PENDING' | 'GRANTED' | 'REJECTED';
export type LeadPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type LeadStatus = 'NEW' | 'QUALIFYING' | 'OPPORTUNITY' | 'HUMAN_REVIEW' | 'CLOSED';
export type MessageRole = 'user' | 'assistant' | 'system';
export type ActionStatus = 'PENDING' | 'APPROVED' | 'EDITED' | 'REJECTED';
export type OpportunityStatus = 'OPEN' | 'WON' | 'LOST' | 'ON_HOLD';
export type ProfileStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface Citation {
  chunkId: string;
  title: string;
  module: string;
  section: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: ProfileStatus;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  user: UserProfile;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: MessageRole;
  content: string;
  citations: Citation[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface LeadSignals {
  segment: Segment;
  interestTags: string[];
  budgetDetected: boolean;
  budgetText?: string;
  urgencyDetected: boolean;
  urgencyText?: string;
  objections: string[];
  contactRequested: boolean;
  educationalIntent: boolean;
  commercialIntent: boolean;
  companyContext: boolean;
  personalContext: boolean;
}

export interface ScoreBreakdown {
  interest: number;
  budget: number;
  fit: number;
  urgency: number;
  total: number;
  priority: LeadPriority;
  explanation: string[];
}

export interface Lead {
  id: string;
  userId: string;
  segment: Segment;
  score: number;
  priority: LeadPriority;
  status: LeadStatus;
  consentStatus: ConsentStatus;
  signals: LeadSignals;
  scoreBreakdown: ScoreBreakdown;
  conversationSummary: string;
  createdAt: string;
  updatedAt: string;
}

export interface Opportunity {
  id: string;
  userId: string;
  leadId: string;
  title: string;
  status: OpportunityStatus;
  valueEstimate: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposedAction {
  id: string;
  userId: string;
  leadId: string;
  type:
    | 'SCHEDULE_CALL'
    | 'SEND_EDUCATIONAL_MATERIAL'
    | 'NURTURE_USER'
    | 'ASSIGN_SPECIALIST'
    | 'REQUEST_MORE_INFO'
    | 'MARK_PRIORITY_OPPORTUNITY'
    | 'SEND_SUMMARY'
    | 'ASSIGN_EXECUTIVE';
  title: string;
  rationale: string;
  draft: string;
  status: ActionStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovedContentChunk {
  id: string;
  title: string;
  module: string;
  section: string;
  content: string;
  tags: string[];
  approved: boolean;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctOption: number;
  explanation: string;
  sourceChunkId: string;
}

export interface QuizResult {
  id: string;
  userId: string;
  score: number;
  total: number;
  answers: number[];
  createdAt: string;
}

export interface DiscoveryQuestion {
  id: string;
  segment: Segment;
  text: string;
  active: boolean;
  order: number;
}

export interface WorkspacePayload {
  profile: UserProfile;
  conversation: Conversation;
  messages: ConversationMessage[];
  lead: Lead;
  quizQuestions: QuizQuestion[];
  quizResults: QuizResult[];
  content: ApprovedContentChunk[];
  proposedActions: ProposedAction[];
}

export interface AdminDashboardPayload {
  users: UserProfile[];
  leads: Lead[];
  conversations: Array<Conversation & { userName: string; userEmail: string; lastMessage?: string }>;
  quizResults: Array<QuizResult & { userName: string; userEmail: string }>;
  proposedActions: Array<ProposedAction & { userName: string; userEmail: string }>;
  opportunities: Opportunity[];
  discoveryQuestions: DiscoveryQuestion[];
  content: ApprovedContentChunk[];
  metrics: {
    totalUsers: number;
    highPriorityLeads: number;
    pendingActions: number;
    averageScore: number;
    grantedConsent: number;
  };
}
