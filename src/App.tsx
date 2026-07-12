import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  RefreshCcw,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { api, clearToken, getToken, setToken } from './client/api';
import { actionTypeLabel, detectedProfileLabel, summarizeDetectedNeed } from './domain/commercialFollowUp';
import type {
  AdminDashboardPayload,
  AuthSession,
  ConversationMessage,
  DiscoveryQuestion,
  Lead,
  ProposedAction,
  QuizQuestion,
  WorkspacePayload,
} from './shared/types';

type Screen = 'landing' | 'auth' | 'workspace';
type AuthMode = 'login' | 'register';
type WorkspaceView = 'chat' | 'academy' | 'crm' | 'supervision' | 'content';

const blankRegister = { name: '', email: '', password: '', confirm: '' };
const blankLogin = { email: '', password: '' };

export function App() {
  const [screen, setScreen] = useState<Screen>('landing');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [user, setUser] = useState<AuthSession['user'] | null>(null);
  const [workspace, setWorkspace] = useState<WorkspacePayload | null>(null);
  const [admin, setAdmin] = useState<AdminDashboardPayload | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>('chat');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadWorkspace(currentUser = user) {
    const nextWorkspace = await api.workspace();
    setWorkspace(nextWorkspace);
    if (currentUser?.role === 'ADMIN' || currentUser?.role === 'EXECUTIVE' || currentUser?.role === 'SUPER_ADMIN') {
      setAdmin(await api.adminDashboard());
    }
  }

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    api
      .me()
      .then(async ({ user: nextUser }) => {
        setUser(nextUser);
        setScreen('workspace');
        await loadWorkspace(nextUser);
      })
      .catch(() => {
        clearToken();
        setScreen('landing');
      });
  }, []);

  async function handleAuth(session: AuthSession) {
    setToken(session.token);
    setUser(session.user);
    setScreen('workspace');
    await loadWorkspace(session.user);
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      // Local cleanup still protects the browser session if the server token is already expired.
    }
    clearToken();
    setUser(null);
    setWorkspace(null);
    setAdmin(null);
    setScreen('landing');
    setActiveView('chat');
  }

  if (screen === 'landing') {
    return (
      <Landing
        onLogin={() => {
          setAuthMode('login');
          setScreen('auth');
        }}
        onRegister={() => {
          setAuthMode('register');
          setScreen('auth');
        }}
      />
    );
  }

  if (screen === 'auth') {
    return (
      <AuthScreen
        mode={authMode}
        setMode={setAuthMode}
        onBack={() => setScreen('landing')}
        onDone={handleAuth}
        busy={busy}
        setBusy={setBusy}
        error={error}
        setError={setError}
      />
    );
  }

  return (
    <Workspace
      user={user}
      workspace={workspace}
      admin={admin}
      activeView={activeView}
      setActiveView={setActiveView}
      onRefresh={() => loadWorkspace()}
      onLogout={logout}
      onUserChange={setUser}
      onWorkspaceChange={setWorkspace}
      onAdminChange={setAdmin}
    />
  );
}

function Landing({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <div className="landing">
      <header className="landing-header">
        <Brand />
        <button className="button ghost" onClick={onLogin}>
          Iniciar sesion
        </button>
      </header>
      <main className="hero">
        <section className="hero-copy">
          <span className="pill">Hackathon Track 1 · Inteligencia conversacional</span>
          <h1>
            Un agente que <em>escucha</em>, califica y educa con supervision humana.
          </h1>
          <p>
            Agente comercial y Tutor Financiero de Futuro Academy en una sola conversacion. Deteccion natural del perfil,
            scoring explicable y contenido educativo con fuentes verificadas.
          </p>
          <div className="hero-actions">
            <button className="button primary" onClick={onRegister}>
              Empezar ahora
              <ChevronRight size={18} />
            </button>
            <button className="button secondary" onClick={onLogin}>
              Ver demo admin
            </button>
          </div>
        </section>
        <section className="chat-preview" aria-label="Vista previa de conversacion">
          <div className="bubble user-bubble">
            <span>Usuario</span>
            Estoy pensando en invertir para mi jubilacion, pero no se por donde empezar.
          </div>
          <div className="bubble assistant-bubble">
            <span>Asistente</span>
            Buena decision. Primero definamos objetivo, horizonte y liquidez. Respondo solo con material aprobado y puedo
            preparar contacto humano si lo autorizas.
            <small>Fuente: Modulo 1 · Seccion 2 - Futuro Academy</small>
          </div>
        </section>
      </main>
      <section className="landing-cards">
        <InfoCard title="Deteccion natural" text="El sistema infiere contexto empresa/persona sin pedir B2B o B2C al usuario." />
        <InfoCard title="Scoring explicable" text="Interes, presupuesto, encaje y urgencia con formula auditable 30/25/25/20." />
        <InfoCard title="Educacion sin alucinacion" text="El tutor responde con documentos aprobados, fuentes y negativa segura si no hay soporte." />
      </section>
    </div>
  );
}

function AuthScreen(props: {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  onBack: () => void;
  onDone: (session: AuthSession) => Promise<void>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
}) {
  const [login, setLogin] = useState(blankLogin);
  const [register, setRegister] = useState(blankRegister);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    props.setError(null);
    setNotice(null);
    props.setBusy(true);
    try {
      if (props.mode === 'login') {
        await props.onDone(await api.login(login));
      } else {
        if (register.password !== register.confirm) throw new Error('Las contrasenas no coinciden.');
        await props.onDone(await api.register({ name: register.name, email: register.email, password: register.password }));
      }
    } catch (error) {
      props.setError(error instanceof Error ? error.message : 'No se pudo autenticar.');
    } finally {
      props.setBusy(false);
    }
  }

  async function recoverPassword() {
    props.setError(null);
    setNotice(null);
    if (!login.email) {
      props.setError('Escribe tu correo para enviarte instrucciones.');
      return;
    }
    props.setBusy(true);
    try {
      const response = await api.requestPasswordReset(login.email);
      setNotice(response.message);
    } catch (error) {
      props.setError(error instanceof Error ? error.message : 'No se pudo solicitar recuperacion.');
    } finally {
      props.setBusy(false);
    }
  }

  return (
    <div className="auth-layout">
      <aside className="auth-aside">
        <Brand dark />
        <div>
          <h1>
            Conversacion que <em>entiende</em>, califica y educa.
          </h1>
          <p>Un solo asistente. Deteccion natural del perfil. Contenido educativo con fuentes. Revision humana obligatoria.</p>
        </div>
        <button className="button subtle" onClick={props.onBack}>
          Volver
        </button>
      </aside>
      <main className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <h2>{props.mode === 'login' ? 'Inicia sesion' : 'Crea tu cuenta'}</h2>
          <p>{props.mode === 'login' ? 'Accede a tu conversacion y progreso.' : 'Solo necesitamos lo basico. El resto lo descubrimos hablando.'}</p>
          {props.error ? <div className="alert danger">{props.error}</div> : null}
          {notice ? <div className="alert success">{notice}</div> : null}
          {props.mode === 'register' ? (
            <label>
              Nombre
              <input value={register.name} onChange={(event) => setRegister({ ...register, name: event.target.value })} required />
            </label>
          ) : null}
          <label>
            Correo
            <input
              type="email"
              value={props.mode === 'login' ? login.email : register.email}
              onChange={(event) =>
                props.mode === 'login'
                  ? setLogin({ ...login, email: event.target.value })
                  : setRegister({ ...register, email: event.target.value })
              }
              required
            />
          </label>
          <label>
            Contrasena
            <input
              type="password"
              minLength={8}
              value={props.mode === 'login' ? login.password : register.password}
              onChange={(event) =>
                props.mode === 'login'
                  ? setLogin({ ...login, password: event.target.value })
                  : setRegister({ ...register, password: event.target.value })
              }
              required
            />
          </label>
          {props.mode === 'register' ? (
            <label>
              Confirmar contrasena
              <input
                type="password"
                minLength={8}
                value={register.confirm}
                onChange={(event) => setRegister({ ...register, confirm: event.target.value })}
                required
              />
            </label>
          ) : null}
          <button className="button primary full" disabled={props.busy}>
            {props.busy ? 'Procesando...' : props.mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
          {props.mode === 'login' ? (
            <button type="button" className="link-button" onClick={recoverPassword}>
              Olvide mi contrasena
            </button>
          ) : null}
          <button type="button" className="link-button" onClick={() => props.setMode(props.mode === 'login' ? 'register' : 'login')}>
            {props.mode === 'login' ? 'No tienes cuenta? Registrate' : 'Ya tengo cuenta. Iniciar sesion'}
          </button>
        </form>
      </main>
    </div>
  );
}

function Workspace(props: {
  user: AuthSession['user'] | null;
  workspace: WorkspacePayload | null;
  admin: AdminDashboardPayload | null;
  activeView: WorkspaceView;
  setActiveView: (view: WorkspaceView) => void;
  onRefresh: () => Promise<void>;
  onLogout: () => void;
  onUserChange: (user: AuthSession['user']) => void;
  onWorkspaceChange: (workspace: WorkspacePayload) => void;
  onAdminChange: (admin: AdminDashboardPayload) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isAdmin = props.user?.role === 'ADMIN' || props.user?.role === 'EXECUTIVE' || props.user?.role === 'SUPER_ADMIN';

  async function completeOnboarding() {
    setBusy(true);
    try {
      const { user } = await api.completeOnboarding();
      props.onUserChange(user);
      await props.onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function refreshWithError() {
    setError(null);
    try {
      await props.onRefresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo actualizar.');
    }
  }

  if (!props.user || !props.workspace) {
    return (
      <div className="loading-screen">
        <Brand />
        <p>Cargando workspace...</p>
      </div>
    );
  }

  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <Brand dark />
        <nav>
          <NavButton active={props.activeView === 'chat'} icon={<MessageSquare size={18} />} label="Conversacion" onClick={() => props.setActiveView('chat')} />
          <NavButton active={props.activeView === 'academy'} icon={<GraduationCap size={18} />} label="Academia" onClick={() => props.setActiveView('academy')} />
          {isAdmin ? (
            <>
              <NavButton active={props.activeView === 'crm'} icon={<UsersRound size={18} />} label="CRM" onClick={() => props.setActiveView('crm')} />
              <NavButton
                active={props.activeView === 'supervision'}
                icon={<ClipboardCheck size={18} />}
                label="Supervision"
                onClick={() => props.setActiveView('supervision')}
              />
              <NavButton active={props.activeView === 'content'} icon={<FileText size={18} />} label="Contenido" onClick={() => props.setActiveView('content')} />
            </>
          ) : null}
        </nav>
        <div className="sidebar-footer">
          <button className="icon-button" title="Actualizar" onClick={refreshWithError}>
            <RefreshCcw size={18} />
          </button>
          <button className="icon-button" title="Cerrar sesion" onClick={props.onLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      <main className="workspace-main">
        <header className="topbar">
          <div>
            <span className="eyebrow">{props.user.role}</span>
            <h1>{isAdmin ? 'Panel operativo' : 'Tu asistente Futuro Academy'}</h1>
          </div>
          <div className="user-chip">
            <UserRound size={16} />
            {props.user.name}
          </div>
        </header>

        {error ? <div className="alert danger">{error}</div> : null}

        {props.activeView === 'chat' ? (
          <ChatWorkspace workspace={props.workspace} onWorkspaceChange={props.onWorkspaceChange} onRefresh={props.onRefresh} />
        ) : null}
        {props.activeView === 'academy' ? (
          <AcademyWorkspace workspace={props.workspace} onWorkspaceChange={props.onWorkspaceChange} onRefresh={props.onRefresh} />
        ) : null}
        {props.activeView === 'crm' && isAdmin && props.admin ? <CrmWorkspace dashboard={props.admin} /> : null}
        {props.activeView === 'supervision' && isAdmin && props.admin ? (
          <SupervisionWorkspace dashboard={props.admin} onAdminChange={props.onAdminChange} />
        ) : null}
        {props.activeView === 'content' && isAdmin && props.admin ? (
          <ContentWorkspace dashboard={props.admin} onAdminChange={props.onAdminChange} />
        ) : null}
      </main>

      {!props.user.onboardingCompleted ? (
        <OnboardingModal role={props.user.role} busy={busy} onComplete={completeOnboarding} />
      ) : null}
    </div>
  );
}

function ChatWorkspace({
  workspace,
  onWorkspaceChange,
  onRefresh,
}: {
  workspace: WorkspacePayload;
  onWorkspaceChange: (workspace: WorkspacePayload) => void;
  onRefresh: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    const draft = message;
    setMessage('');
    try {
      const response = await api.sendMessage(draft);
      onWorkspaceChange({
        ...workspace,
        messages: [...workspace.messages, response.userMessage, response.assistantMessage],
        lead: response.lead,
      });
      await onRefresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'No se pudo enviar.');
      setMessage(draft);
    } finally {
      setBusy(false);
    }
  }

  async function updateConsent(consent: 'GRANTED' | 'REJECTED') {
    const { lead } = await api.updateConsent(consent);
    onWorkspaceChange({ ...workspace, lead });
    await onRefresh();
  }

  return (
    <div className="workspace-grid">
      <section className="panel chat-panel">
        <PanelTitle icon={<MessageSquare size={18} />} title="Conversacion unificada" />
        <ConsentPanel lead={workspace.lead} onConsent={updateConsent} />
        <div className="messages">
          {workspace.messages.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={28} />
              <p>Empieza con una duda financiera o una necesidad comercial. El agente hara descubrimiento progresivo.</p>
            </div>
          ) : (
            workspace.messages.map((item) => <MessageBubble key={item.id} message={item} />)
          )}
        </div>
        {error ? <div className="alert danger">{error}</div> : null}
        <form className="composer" onSubmit={send}>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Escribe: quiero aprender sobre jubilacion, o buscamos capacitar a un equipo..."
          />
          <button className="button primary" disabled={busy}>
            {busy ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
      </section>

      <aside className="side-stack">
        <LeadCard lead={workspace.lead} userVisible />
        <SourcesCard messages={workspace.messages} />
        <ActionStatusCard actions={workspace.proposedActions} />
      </aside>
    </div>
  );
}

function AcademyWorkspace({
  workspace,
  onWorkspaceChange,
  onRefresh,
}: {
  workspace: WorkspacePayload;
  onWorkspaceChange: (workspace: WorkspacePayload) => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <div className="workspace-grid">
      <QuizCard questions={workspace.quizQuestions} results={workspace.quizResults} onWorkspaceChange={onWorkspaceChange} workspace={workspace} onRefresh={onRefresh} />
      <section className="panel">
        <PanelTitle icon={<BookOpen size={18} />} title="Contenido aprobado" />
        <div className="content-list">
          {workspace.content.map((chunk) => (
            <article className="content-item" key={chunk.id}>
              <div>
                <strong>{chunk.title}</strong>
                <span>
                  {chunk.module} · {chunk.section}
                </span>
              </div>
              <p>{chunk.content}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function CrmWorkspace({ dashboard }: { dashboard: AdminDashboardPayload }) {
  return (
    <div className="admin-stack">
      <div className="metric-grid">
        <Metric label="Usuarios" value={dashboard.metrics.totalUsers} />
        <Metric label="Leads alta prioridad" value={dashboard.metrics.highPriorityLeads} />
        <Metric label="Acciones pendientes" value={dashboard.metrics.pendingActions} />
        <Metric label="Score promedio" value={dashboard.metrics.averageScore} />
        <Metric label="Consentimientos" value={dashboard.metrics.grantedConsent} />
      </div>
      <CommercialFollowUpPanel dashboard={dashboard} />
      <section className="panel">
        <PanelTitle icon={<LayoutDashboard size={18} />} title="Leads y scoring" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Clasificacion</th>
                <th>Score</th>
                <th>Prioridad</th>
                <th>Consentimiento</th>
                <th>Intereses</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {dashboard.leads.map((lead) => {
                const user = dashboard.users.find((item) => item.id === lead.userId);
                return (
                  <tr key={lead.id}>
                    <td>{user?.name ?? lead.userId}</td>
                    <td>{lead.segment}</td>
                    <td>{lead.score}/100</td>
                    <td>{lead.priority}</td>
                    <td>{lead.consentStatus}</td>
                    <td>{lead.signals.interestTags.length > 0 ? lead.signals.interestTags.join(', ') : 'Sin registro'}</td>
                    <td>{lead.status}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={<MessageSquare size={18} />} title="Conversaciones registradas" />
        <div className="content-list">
          {dashboard.conversations.map((conversation) => (
            <article className="content-item" key={conversation.id}>
              <div>
                <strong>{conversation.userName}</strong>
                <span>{conversation.userEmail}</span>
              </div>
              <p>{conversation.lastMessage ?? 'Sin mensajes todavia.'}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={<ClipboardCheck size={18} />} title="Oportunidades" />
        <div className="content-list">
          {dashboard.opportunities.length === 0 ? (
            <div className="empty-state">
              <ClipboardCheck size={28} />
              <p>No hay oportunidades abiertas todavia.</p>
            </div>
          ) : (
            dashboard.opportunities.map((opportunity) => (
              <article className="content-item" key={opportunity.id}>
                <div>
                  <strong>{opportunity.title}</strong>
                  <span>{opportunity.status}</span>
                </div>
                <p>Lead: {opportunity.leadId}</p>
              </article>
            ))
          )}
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={<GraduationCap size={18} />} title="Resultados de quiz" />
        <div className="content-list">
          {dashboard.quizResults.length === 0 ? (
            <div className="empty-state">
              <GraduationCap size={28} />
              <p>Aun no hay resultados de quiz.</p>
            </div>
          ) : (
            dashboard.quizResults.map((result) => (
              <article className="content-item" key={result.id}>
                <div>
                  <strong>{result.userName}</strong>
                  <span>
                    {result.score}/{result.total}
                  </span>
                </div>
                <p>{result.userEmail}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function latestActionForLead(dashboard: AdminDashboardPayload, lead: Lead) {
  return [...dashboard.proposedActions]
    .filter((action) => action.leadId === lead.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function latestQuizForUser(dashboard: AdminDashboardPayload, userId: string) {
  return [...dashboard.quizResults].filter((result) => result.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function textOrPending(value: string | undefined | null, fallback = 'Pendiente') {
  return value && value.trim().length > 0 ? value : fallback;
}

function CommercialFollowUpPanel({ dashboard }: { dashboard: AdminDashboardPayload }) {
  const [openLeadId, setOpenLeadId] = useState<string | null>(dashboard.leads[0]?.id ?? null);

  return (
    <section className="panel">
      <PanelTitle icon={<ClipboardCheck size={18} />} title="Seguimiento comercial" />
      <div className="follow-up-list">
        {dashboard.leads.length === 0 ? (
          <div className="empty-state">
            <ClipboardCheck size={28} />
            <p>No hay leads para seguimiento todavia.</p>
          </div>
        ) : (
          dashboard.leads.map((lead) => {
            const user = dashboard.users.find((item) => item.id === lead.userId);
            const action = latestActionForLead(dashboard, lead);
            const quiz = latestQuizForUser(dashboard, lead.userId);
            const isOpen = openLeadId === lead.id;
            const recommendedAction = action
              ? actionTypeLabel(action.type)
              : lead.consentStatus === 'GRANTED'
                ? 'Pendiente de nueva senal conversacional'
                : 'Pendiente de consentimiento';
            return (
              <article className="follow-up-card" key={lead.id}>
                <button className="follow-up-summary" onClick={() => setOpenLeadId(isOpen ? null : lead.id)} aria-expanded={isOpen}>
                  <span className="accordion-icon">{isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                  <span className="lead-summary-main">
                    <strong>{user?.name ?? 'Usuario sin nombre'}</strong>
                    <small>{recommendedAction}</small>
                  </span>
                  <span className="lead-score">
                    <strong>{lead.score}</strong>
                    <small>/100</small>
                  </span>
                  <span className={'priority priority-' + lead.priority.toLowerCase()}>{lead.priority}</span>
                </button>
                {isOpen ? (
                  <div className="follow-up-body">
                    <div className="detail-grid">
                      <Detail label="Necesidad" value={summarizeDetectedNeed(lead.signals, lead.conversationSummary)} />
                      <Detail label="Perfil detectado" value={detectedProfileLabel(lead.signals)} />
                      <Detail label="Clasificacion interna" value={lead.segment} />
                      <Detail label="Intereses" value={lead.signals.interestTags.length > 0 ? lead.signals.interestTags.join(', ') : 'Sin intereses registrados'} />
                      <Detail label="Presupuesto" value={lead.signals.budgetText ?? 'No detectado'} />
                      <Detail label="Urgencia" value={lead.signals.urgencyText ?? (lead.signals.contactRequested ? 'Solicito contacto' : 'No detectada')} />
                      <Detail label="Objeciones" value={lead.signals.objections.length > 0 ? lead.signals.objections.join(', ') : 'Sin objeciones'} />
                      <Detail label="Etapa del embudo" value={lead.status} />
                      <Detail label="Puntuacion" value={`${lead.score}/100`} />
                      <Detail label="Nivel de prioridad" value={lead.priority} />
                      <Detail label="Resultado quiz" value={quiz ? `${quiz.score}/${quiz.total}` : 'Sin quiz'} />
                      <Detail label="Accion recomendada" value={recommendedAction} />
                      <Detail label="Estado accion" value={action?.status ?? 'Sin accion pendiente'} />
                    </div>
                    <div className="score-breakdown">
                      <strong>Desglose de puntuacion</strong>
                      {lead.scoreBreakdown.explanation.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                    <div className="proposed-message">
                      <strong>Mensaje propuesto</strong>
                      <p>{textOrPending(action?.draft, 'Sin mensaje propuesto. Se generara cuando exista una senal comercial suficiente y consentimiento.')}</p>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SupervisionWorkspace({
  dashboard,
  onAdminChange,
}: {
  dashboard: AdminDashboardPayload;
  onAdminChange: (dashboard: AdminDashboardPayload) => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  async function review(action: ProposedAction, status: 'APPROVED' | 'EDITED' | 'REJECTED') {
    setBusyId(action.id);
    try {
      await api.reviewAction(action.id, { status, draft: drafts[action.id] });
      onAdminChange(await api.adminDashboard());
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="panel">
      <PanelTitle icon={<ShieldCheck size={18} />} title="Supervision humana" />
      <div className="content-list">
        {dashboard.proposedActions.length === 0 ? (
          <div className="empty-state">
            <ClipboardCheck size={28} />
            <p>No hay acciones pendientes. Las comunicaciones comerciales quedan bloqueadas hasta aprobacion humana.</p>
          </div>
        ) : (
          dashboard.proposedActions.map((action) => (
            <article className="review-item" key={action.id}>
              <header>
                <div>
                  <strong>{action.title}</strong>
                  <span>
                    {action.userName} · {action.status}
                  </span>
                </div>
                <span className={'status status-' + action.status.toLowerCase()}>{action.status}</span>
              </header>
              <p>{action.rationale}</p>
              <textarea value={drafts[action.id] ?? action.draft} onChange={(event) => setDrafts({ ...drafts, [action.id]: event.target.value })} />
              {action.status === 'PENDING' ? (
                <div className="row-actions">
                  <button className="button secondary" disabled={busyId === action.id} onClick={() => review(action, 'APPROVED')}>
                    <Check size={16} />
                    Aprobar
                  </button>
                  <button className="button secondary" disabled={busyId === action.id} onClick={() => review(action, 'EDITED')}>
                    <FileText size={16} />
                    Guardar editada
                  </button>
                  <button className="button danger" disabled={busyId === action.id} onClick={() => review(action, 'REJECTED')}>
                    <X size={16} />
                    Rechazar
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function ContentWorkspace({
  dashboard,
  onAdminChange,
}: {
  dashboard: AdminDashboardPayload;
  onAdminChange: (dashboard: AdminDashboardPayload) => void;
}) {
  const [questions, setQuestions] = useState<Record<string, DiscoveryQuestion>>(() =>
    Object.fromEntries(dashboard.discoveryQuestions.map((question) => [question.id, question])),
  );

  async function saveQuestion(question: DiscoveryQuestion) {
    await api.updateQuestion(question.id, { text: question.text, active: question.active, order: question.order });
    onAdminChange(await api.adminDashboard());
  }

  return (
    <div className="workspace-grid">
      <section className="panel">
        <PanelTitle icon={<FileText size={18} />} title="Preguntas configurables" />
        <div className="content-list">
          {dashboard.discoveryQuestions.map((question) => {
            const draft = questions[question.id] ?? question;
            return (
              <article className="question-item" key={question.id}>
                <div className="question-meta">
                  <span>{question.segment}</span>
                  <label>
                    <input
                      type="checkbox"
                      checked={draft.active}
                      onChange={(event) => setQuestions({ ...questions, [question.id]: { ...draft, active: event.target.checked } })}
                    />
                    Activa
                  </label>
                </div>
                <textarea value={draft.text} onChange={(event) => setQuestions({ ...questions, [question.id]: { ...draft, text: event.target.value } })} />
                <button className="button secondary" onClick={() => saveQuestion(draft)}>
                  Guardar
                </button>
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <PanelTitle icon={<BookOpen size={18} />} title="Base RAG aprobada" />
        <div className="content-list">
          {dashboard.content.map((chunk) => (
            <article className="content-item" key={chunk.id}>
              <div>
                <strong>{chunk.title}</strong>
                <span>
                  {chunk.module} · {chunk.section}
                </span>
              </div>
              <p>{chunk.content}</p>
              <small>{chunk.tags.join(', ')}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function QuizCard({
  questions,
  results,
  workspace,
  onWorkspaceChange,
  onRefresh,
}: {
  questions: QuizQuestion[];
  results: WorkspacePayload['quizResults'];
  workspace: WorkspacePayload;
  onWorkspaceChange: (workspace: WorkspacePayload) => void;
  onRefresh: () => Promise<void>;
}) {
  const [answers, setAnswers] = useState<number[]>([-1, -1, -1]);
  const [busy, setBusy] = useState(false);
  const lastResult = results[0];

  async function submit() {
    setBusy(true);
    try {
      const { result } = await api.submitQuiz(answers);
      onWorkspaceChange({ ...workspace, quizResults: [result, ...workspace.quizResults] });
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <PanelTitle icon={<GraduationCap size={18} />} title="Quiz financiero" />
      {lastResult ? (
        <div className="score-banner">
          Ultimo resultado: {lastResult.score}/{lastResult.total}
        </div>
      ) : null}
      <div className="quiz-list">
        {questions.map((question, index) => (
          <fieldset key={question.id}>
            <legend>{question.question}</legend>
            {question.options.map((option, optionIndex) => (
              <label className="radio-row" key={option}>
                <input
                  type="radio"
                  name={question.id}
                  checked={answers[index] === optionIndex}
                  onChange={() => {
                    const next = [...answers];
                    next[index] = optionIndex;
                    setAnswers(next);
                  }}
                />
                {option}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <button className="button primary" disabled={busy || answers.some((answer) => answer < 0)} onClick={submit}>
        {busy ? 'Evaluando...' : 'Enviar respuestas'}
      </button>
    </section>
  );
}

function ConsentPanel({ lead, onConsent }: { lead: Lead; onConsent: (consent: 'GRANTED' | 'REJECTED') => Promise<void> }) {
  if (lead.consentStatus === 'GRANTED') {
    return (
      <div className="alert success">
        <ShieldCheck size={16} />
        Consentimiento activo para registrar intereses comerciales.
      </div>
    );
  }
  if (lead.consentStatus === 'REJECTED') {
    return (
      <div className="alert neutral">
        <span>No se registran intereses comerciales. Puedes seguir usando educacion financiera.</span>
        <button className="button secondary" onClick={() => onConsent('GRANTED')}>
          Autorizar ahora
        </button>
      </div>
    );
  }
  return (
    <div className="consent-box">
      <div>
        <strong>Registro de intereses</strong>
        <p>El chat educativo queda disponible. Para guardar senales comerciales en CRM necesitamos tu autorizacion.</p>
      </div>
      <div className="row-actions">
        <button className="button secondary" onClick={() => onConsent('GRANTED')}>
          Autorizar
        </button>
        <button className="button ghost" onClick={() => onConsent('REJECTED')}>
          Rechazar
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ConversationMessage }) {
  return (
    <article className={'message ' + message.role}>
      <span>{message.role === 'assistant' ? 'Asistente' : 'Usuario'}</span>
      <p>{message.content}</p>
      {message.citations.length > 0 ? (
        <div className="citation-list">
          {message.citations.map((citation) => (
            <small key={citation.chunkId}>
              {citation.module} · {citation.section} · {citation.title}
            </small>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function LeadCard({ lead, userVisible }: { lead: Lead; userVisible?: boolean }) {
  const explanation = userVisible ? lead.scoreBreakdown.explanation : lead.scoreBreakdown.explanation;

  return (
    <section className="panel compact">
      <PanelTitle icon={<LayoutDashboard size={18} />} title={userVisible ? 'Contexto de la conversacion' : 'Estado'} />
      {userVisible ? (
        <div className="conversation-status">
          <ShieldCheck size={28} />
          <strong>{lead.consentStatus === 'GRANTED' ? 'Consentimiento activo' : 'Chat educativo activo'}</strong>
          <span>La calificacion comercial es interna y solo la ve el equipo autorizado.</span>
        </div>
      ) : (
        <>
          <div className="score-ring">
            <strong>{lead.score}</strong>
            <span>/100</span>
          </div>
          <p>Clasificacion: {lead.segment}</p>
        </>
      )}
      <div className="breakdown">
        {explanation.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </section>
  );
}

function SourcesCard({ messages }: { messages: ConversationMessage[] }) {
  const citations = useMemo(() => messages.flatMap((message) => message.citations), [messages]);
  return (
    <section className="panel compact">
      <PanelTitle icon={<BookOpen size={18} />} title="Fuentes usadas" />
      {citations.length === 0 ? (
        <p>Aun no se han usado fuentes en esta conversacion.</p>
      ) : (
        <div className="citation-list vertical">
          {citations.map((citation) => (
            <small key={`${citation.chunkId}-${citation.title}`}>
              {citation.module} · {citation.section} · {citation.title}
            </small>
          ))}
        </div>
      )}
    </section>
  );
}

function ActionStatusCard({ actions }: { actions: ProposedAction[] }) {
  return (
    <section className="panel compact">
      <PanelTitle icon={<ClipboardCheck size={18} />} title="Acciones comerciales" />
      {actions.length === 0 ? (
        <p>Ninguna accion comercial ha sido propuesta.</p>
      ) : (
        actions.map((action) => (
          <div className="mini-action" key={action.id}>
            <strong>{action.title}</strong>
            <span>{action.status}</span>
          </div>
        ))
      )}
    </section>
  );
}

function OnboardingModal({ role, busy, onComplete }: { role: string; busy: boolean; onComplete: () => Promise<void> }) {
  const isAdmin = role === 'ADMIN' || role === 'EXECUTIVE' || role === 'SUPER_ADMIN';
  return (
    <div className="modal-backdrop">
      <section className="modal">
        <PanelTitle icon={<ShieldCheck size={18} />} title={isAdmin ? 'Onboarding administrador' : 'Onboarding'} />
        {isAdmin ? (
          <ul>
            <li>El CRM muestra usuarios, conversaciones, oportunidades, scoring y quiz.</li>
            <li>La prioridad se calcula con interes, presupuesto, encaje y urgencia.</li>
            <li>Toda accion comercial queda pendiente hasta aprobacion, edicion o rechazo humano.</li>
            <li>La comunicacion automatica esta bloqueada por diseno.</li>
          </ul>
        ) : (
          <ul>
            <li>El asistente puede educarte con contenido financiero aprobado.</li>
            <li>La informacion es educativa y no reemplaza asesoria personalizada.</li>
            <li>Puedes pedir contacto con un especialista.</li>
            <li>El registro de intereses comerciales requiere tu consentimiento.</li>
          </ul>
        )}
        <button className="button primary full" disabled={busy} onClick={onComplete}>
          {busy ? 'Guardando...' : 'Entendido'}
        </button>
      </section>
    </div>
  );
}

function Brand({ dark = false }: { dark?: boolean }) {
  return (
    <div className={'brand ' + (dark ? 'brand-dark' : '')}>
      <span />
      Agentic Scale
    </div>
  );
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="info-card">
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function NavButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className={'nav-button ' + (active ? 'active' : '')} onClick={onClick}>
      {icon}
      {label}
    </button>
  );
}

function PanelTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <header className="panel-title">
      {icon}
      <h2>{title}</h2>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <section className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </section>
  );
}
