import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/server/app';
import { FileStore } from '../src/server/store/fileStore';

describe('api authorization and workflow', () => {
  let filePath: string;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    filePath = path.join(os.tmpdir(), `agentic-scale-${Date.now()}-${Math.random()}.json`);
    const store = new FileStore(filePath);
    await store.init();
    app = createApp(store);
  });

  afterEach(async () => {
    await fs.rm(filePath, { force: true });
  });

  it('bloquea endpoints admin para usuarios USER', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Usuario Demo', email: `user-${Date.now()}@demo.com`, password: 'Password123!' })
      .expect(201);

    await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${register.body.token}`)
      .expect(403);
  });

  it('permite admin dashboard con rol ADMIN', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@agentic.scale', password: 'Admin123!' })
      .expect(200);

    const dashboard = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);

    expect(dashboard.body.metrics.totalUsers).toBeGreaterThan(0);
  });

  it('cierra sesion e invalida el token local', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Logout Demo', email: `logout-${Date.now()}@demo.com`, password: 'Password123!' })
      .expect(201);

    await request(app).get('/api/me').set('Authorization', `Bearer ${register.body.token}`).expect(200);
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${register.body.token}`).expect(200);
    await request(app).get('/api/me').set('Authorization', `Bearer ${register.body.token}`).expect(401);
  });

  it('acepta solicitud de recuperacion de contrasena con respuesta generica', async () => {
    const response = await request(app)
      .post('/api/auth/password-reset')
      .send({ email: `reset-${Date.now()}@demo.com` })
      .expect(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.message).toContain('Si el correo existe');
  });

  it('requiere consentimiento para registrar oportunidad y accion comercial', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Lead Demo', email: `lead-${Date.now()}@demo.com`, password: 'Password123!' })
      .expect(201);
    const token = register.body.token;

    const withoutConsent = await request(app)
      .post('/api/conversations/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Quiero que un especialista me contacte esta semana para invertir.' })
      .expect(200);

    expect(withoutConsent.body.proposedAction).toBeUndefined();
    expect(withoutConsent.body.lead.score).toBe(0);
    expect(withoutConsent.body.lead.segment).toBe('UNDETERMINED');

    await request(app).post('/api/consent').set('Authorization', `Bearer ${token}`).send({ consent: 'GRANTED' }).expect(200);

    const withConsent = await request(app)
      .post('/api/conversations/message')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Autorizo el registro y quiero una llamada con un especialista esta semana.' })
      .expect(200);

    expect(withConsent.body.proposedAction).toBeUndefined();
    expect(withConsent.body.lead.score).toBe(0);

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@agentic.scale', password: 'Admin123!' })
      .expect(200);
    const dashboard = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200);
    const storedLead = dashboard.body.leads.find((lead: { userId: string }) => lead.userId === register.body.user.id);
    expect(storedLead.score).toBeGreaterThan(0);
    expect(storedLead.conversationSummary).toContain('Lead Demo');
    expect(dashboard.body.proposedActions.some((action: { userId: string; status: string }) => action.userId === register.body.user.id && action.status === 'PENDING')).toBe(true);
  });

  it('redacta score, clasificacion y metadata interna para usuarios normales', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Privacidad Demo', email: `privacy-${Date.now()}@demo.com`, password: 'Password123!' })
      .expect(201);

    await request(app).post('/api/consent').set('Authorization', `Bearer ${register.body.token}`).send({ consent: 'GRANTED' }).expect(200);
    await request(app)
      .post('/api/conversations/message')
      .set('Authorization', `Bearer ${register.body.token}`)
      .send({ message: 'Soy de una empresa de 25 personas, tenemos presupuesto y queremos comenzar esta semana.' })
      .expect(200);

    const workspace = await request(app).get('/api/workspace').set('Authorization', `Bearer ${register.body.token}`).expect(200);

    expect(workspace.body.lead.score).toBe(0);
    expect(workspace.body.lead.segment).toBe('UNDETERMINED');
    expect(workspace.body.lead.conversationSummary).toBe('');
    expect(workspace.body.content).toEqual([]);
    expect(JSON.stringify(workspace.body.messages)).not.toContain('scoreBreakdown');
    expect(JSON.stringify(workspace.body.messages)).not.toContain('B2B');
  });

  it('redacta fuentes RAG para usuarios normales', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Fuentes Demo', email: `sources-${Date.now()}@demo.com`, password: 'Password123!' })
      .expect(201);

    const message = await request(app)
      .post('/api/conversations/message')
      .set('Authorization', `Bearer ${register.body.token}`)
      .send({ message: 'Cuales fueron los ingresos de NubeCondor Tech en 2025?' })
      .expect(200);

    const workspace = await request(app).get('/api/workspace').set('Authorization', `Bearer ${register.body.token}`).expect(200);

    expect(message.body.assistantMessage.citations).toEqual([]);
    expect(workspace.body.messages.every((item: { citations: unknown[] }) => item.citations.length === 0)).toBe(true);
  });

  it('permite enviar solicitudes de cliente y confirma plazo de respuesta', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Solicitud Demo', email: `request-${Date.now()}@demo.com`, password: 'Password123!' })
      .expect(201);

    const response = await request(app)
      .post('/api/client-requests')
      .set('Authorization', `Bearer ${register.body.token}`)
      .send({ message: 'Necesito que me contacten para revisar mi caso.' })
      .expect(201);

    expect(response.body.message).toBe('Hemos recibido tu solicitud. Te responderemos en un plazo máximo de 24 horas.');
    const userWorkspace = await request(app).get('/api/workspace').set('Authorization', `Bearer ${register.body.token}`).expect(200);
    expect(userWorkspace.body.clientRequests[0].message).toContain('contacten');

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@agentic.scale', password: 'Admin123!' })
      .expect(200);
    const dashboard = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200);

    const storedRequest = dashboard.body.clientRequests.find((item: { userId: string; message: string }) => item.userId === register.body.user.id && item.message.includes('contacten'));
    expect(storedRequest).toBeTruthy();

    await request(app)
      .patch(`/api/admin/client-requests/${storedRequest.id}`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({ status: 'ANSWERED', response: 'Gracias por escribirnos. Un especialista revisara tu caso hoy.' })
      .expect(200);

    const updatedDashboard = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200);
    const updatedRequest = updatedDashboard.body.clientRequests.find((item: { id: string }) => item.id === storedRequest.id);
    expect(updatedRequest.status).toBe('ANSWERED');
    expect(updatedRequest.response).toContain('Gracias por escribirnos');

    const updatedUserWorkspace = await request(app).get('/api/workspace').set('Authorization', `Bearer ${register.body.token}`).expect(200);
    expect(updatedUserWorkspace.body.clientRequests[0].response).toContain('Gracias por escribirnos');
  });

  it('limpia la conversacion actual del usuario', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Limpiar Demo', email: `clear-${Date.now()}@demo.com`, password: 'Password123!' })
      .expect(201);

    await request(app)
      .post('/api/conversations/message')
      .set('Authorization', `Bearer ${register.body.token}`)
      .send({ message: 'Quiero aprender sobre presupuesto.' })
      .expect(200);

    const before = await request(app).get('/api/workspace').set('Authorization', `Bearer ${register.body.token}`).expect(200);
    expect(before.body.messages.length).toBeGreaterThan(0);

    await request(app).delete('/api/conversations/current').set('Authorization', `Bearer ${register.body.token}`).expect(200);
    const after = await request(app).get('/api/workspace').set('Authorization', `Bearer ${register.body.token}`).expect(200);

    expect(after.body.messages).toHaveLength(0);
  });

  it('permite al admin eliminar un seguimiento comercial sin borrar el lead', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Seguimiento Demo', email: `follow-${Date.now()}@demo.com`, password: 'Password123!' })
      .expect(201);

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@agentic.scale', password: 'Admin123!' })
      .expect(200);

    const dashboard = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200);
    const lead = dashboard.body.leads.find((item: { userId: string }) => item.userId === register.body.user.id);

    await request(app)
      .delete(`/api/admin/follow-ups/${lead.id}`)
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200);

    const updatedDashboard = await request(app)
      .get('/api/admin/dashboard')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .expect(200);
    const updatedLead = updatedDashboard.body.leads.find((item: { id: string }) => item.id === lead.id);

    expect(updatedLead.status).toBe('CLOSED');
  });

  it('registra resultado del quiz', async () => {
    const register = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Quiz Demo', email: `quiz-${Date.now()}@demo.com`, password: 'Password123!' })
      .expect(201);

    const result = await request(app)
      .post('/api/quiz/submit')
      .set('Authorization', `Bearer ${register.body.token}`)
      .send({ answers: [1, 2, 0] })
      .expect(200);

    expect(result.body.result.score).toBe(3);
  });
});
