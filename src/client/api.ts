import type { AdminDashboardPayload, AuthSession, WorkspacePayload } from '../shared/types';

const TOKEN_KEY = 'agentic_scale_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error ?? 'No se pudo completar la operacion.');
  }
  return payload as T;
}

export const api = {
  register(input: { name: string; email: string; password: string }) {
    return request<AuthSession>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) });
  },
  login(input: { email: string; password: string }) {
    return request<AuthSession>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) });
  },
  logout() {
    return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
  },
  requestPasswordReset(email: string) {
    return request<{ ok: boolean; message: string }>('/api/auth/password-reset', { method: 'POST', body: JSON.stringify({ email }) });
  },
  me() {
    return request<{ user: AuthSession['user'] }>('/api/me');
  },
  completeOnboarding() {
    return request<{ user: AuthSession['user'] }>('/api/onboarding/complete', { method: 'POST' });
  },
  workspace() {
    return request<WorkspacePayload>('/api/workspace');
  },
  sendMessage(message: string) {
    return request<{
      userMessage: WorkspacePayload['messages'][number];
      assistantMessage: WorkspacePayload['messages'][number];
      lead: WorkspacePayload['lead'];
      consentPrompt: boolean;
    }>('/api/conversations/message', { method: 'POST', body: JSON.stringify({ message }) });
  },
  updateConsent(consent: 'GRANTED' | 'REJECTED') {
    return request<{ lead: WorkspacePayload['lead'] }>('/api/consent', { method: 'POST', body: JSON.stringify({ consent }) });
  },
  submitQuiz(answers: number[]) {
    return request<{ result: WorkspacePayload['quizResults'][number]; grade: unknown }>('/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
  },
  adminDashboard() {
    return request<AdminDashboardPayload>('/api/admin/dashboard');
  },
  reviewAction(id: string, input: { status: 'APPROVED' | 'EDITED' | 'REJECTED'; draft?: string }) {
    return request('/api/admin/actions/' + id + '/review', { method: 'POST', body: JSON.stringify(input) });
  },
  updateQuestion(id: string, input: { text?: string; active?: boolean; order?: number }) {
    return request('/api/admin/discovery-questions/' + id, { method: 'PATCH', body: JSON.stringify(input) });
  },
};
