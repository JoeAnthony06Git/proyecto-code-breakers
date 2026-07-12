# Supabase Sin SQL

Esta guia cumple la restriccion del proyecto: no usar archivos SQL, migraciones SQL, `seed.sql`, consultas SQL manuales ni configuracion directa de PostgreSQL.

Toda configuracion debe hacerse con:

- Supabase Dashboard
- Supabase Auth
- Supabase Table Editor
- Supabase Storage, cuando se agreguen documentos cargados por archivo
- Supabase Row Level Security desde la interfaz visual
- Supabase SDK desde la aplicacion
- Adaptadores de infraestructura, como `src/server/store/supabaseStore.ts`

## Estado Del MVP

La aplicacion ya tiene un adaptador Supabase por SDK para:

- Registro de usuarios: Supabase Auth Admin API
- Inicio de sesion: Supabase Auth
- Gestion de sesiones: token de Supabase Auth
- Perfiles: `profiles`
- Leads: `leads`
- Oportunidades: `opportunities`
- Conversaciones: `conversations` y `conversation_messages`
- Consentimientos: campo `consent_status` en `leads`
- Evaluaciones del tutor y quiz: `quiz_results`
- Seguimientos: `proposed_actions`
- Preguntas configurables: `discovery_questions`
- Documentos autorizados: `approved_content`
- Metricas basicas: calculadas desde tablas Supabase en el backend

Pendiente de completar en Dashboard/Table Editor:

- Crear tabla `contacts` si se quiere separar contacto comercial de perfil de autenticacion.
- Crear tabla `scoring_config` si se quiere modificar pesos de scoring desde Supabase en lugar de mantenerlos en codigo.
- Activar `USE_SUPABASE=true` solo cuando las tablas y RLS esten listas.

## Tablas A Crear Con Table Editor

Crea estas tablas desde Supabase Dashboard > Table Editor. Usa nombres de columnas en snake_case.

### profiles

- `id`: uuid, primary key, relacionado con usuario Auth
- `name`: text
- `email`: text, unique
- `role`: text
- `status`: text
- `onboarding_completed`: boolean
- `created_at`: timestamptz
- `updated_at`: timestamptz

### contacts

- `id`: text, primary key
- `user_id`: uuid
- `name`: text
- `email`: text
- `source`: text
- `created_at`: timestamptz
- `updated_at`: timestamptz

### conversations

- `id`: text, primary key
- `user_id`: uuid
- `title`: text
- `created_at`: timestamptz
- `updated_at`: timestamptz

### conversation_messages

- `id`: text, primary key
- `conversation_id`: text
- `user_id`: uuid
- `role`: text
- `content`: text
- `citations`: jsonb
- `metadata`: jsonb
- `created_at`: timestamptz

### leads

- `id`: text, primary key
- `user_id`: uuid
- `segment`: text
- `score`: integer
- `priority`: text
- `status`: text
- `consent_status`: text
- `signals`: jsonb
- `score_breakdown`: jsonb
- `conversation_summary`: text
- `created_at`: timestamptz
- `updated_at`: timestamptz

### opportunities

- `id`: text, primary key
- `user_id`: uuid
- `lead_id`: text
- `title`: text
- `status`: text
- `value_estimate`: numeric, nullable
- `created_at`: timestamptz
- `updated_at`: timestamptz

### proposed_actions

- `id`: text, primary key
- `user_id`: uuid
- `lead_id`: text
- `type`: text
- `title`: text
- `rationale`: text
- `draft`: text
- `status`: text
- `reviewed_by`: uuid, nullable
- `reviewed_at`: timestamptz, nullable
- `created_at`: timestamptz
- `updated_at`: timestamptz

### quiz_results

- `id`: text, primary key
- `user_id`: uuid
- `score`: integer
- `total`: integer
- `answers`: jsonb
- `created_at`: timestamptz

### discovery_questions

- `id`: text, primary key
- `segment`: text
- `text`: text
- `active`: boolean
- `display_order`: integer

### approved_content

- `id`: text, primary key
- `title`: text
- `module`: text
- `section`: text
- `content`: text
- `tags`: text array
- `approved`: boolean

### scoring_config

- `id`: text, primary key
- `interest_weight`: integer
- `budget_weight`: integer
- `fit_weight`: integer
- `urgency_weight`: integer
- `high_priority_threshold`: integer
- `medium_priority_threshold`: integer
- `active`: boolean
- `updated_at`: timestamptz

## Datos Iniciales Sin Seed SQL

No uses seed SQL. Hay dos opciones permitidas:

1. Insertar filas desde Supabase Table Editor.
2. Dejar que el backend inserte contenido aprobado y preguntas configurables con Supabase SDK cuando arranca `USE_SUPABASE=true`.

El backend ya hace `upsert` con Supabase SDK para:

- `approved_content`
- `discovery_questions`

## Row Level Security

Configura RLS desde Dashboard > Authentication/Policies.

Regla funcional esperada:

- Usuarios normales leen solo sus propios perfiles, conversaciones, leads, quiz y acciones visibles.
- Admin, executive y super admin pueden leer CRM, leads, oportunidades, seguimientos, documentos y metricas.
- Solo backend con service role debe crear acciones comerciales sensibles.

## Activacion

Cuando las tablas existan y la service role key sea valida:

```bash
USE_SUPABASE=true
```

Luego reinicia `npm run dev`.

## Seguridad De Auth

- El frontend nunca importa `@supabase/supabase-js` ni recibe `SUPABASE_SERVICE_ROLE_KEY`.
- La service role key solo vive en `.env` del backend.
- El registro, login, logout, recuperacion de sesion, usuario autenticado y recuperacion de contrasena pasan por endpoints backend que usan Supabase Auth.
- Las contrasenas no se guardan en tablas propias cuando `USE_SUPABASE=true`; Supabase Auth administra hash, sesiones y recuperacion.
