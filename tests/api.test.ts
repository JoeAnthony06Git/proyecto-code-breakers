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
    expect(JSON.stringify(workspace.body.messages)).not.toContain('scoreBreakdown');
    expect(JSON.stringify(workspace.body.messages)).not.toContain('B2B');
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
