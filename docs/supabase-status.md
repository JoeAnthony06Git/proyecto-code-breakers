# Estado De Supabase

## Cumple En Codigo

- Registro de usuarios: implementado con Supabase Auth cuando `USE_SUPABASE=true`.
- Inicio de sesion: implementado con Supabase Auth.
- Cierre de sesion: implementado con Supabase Auth desde backend.
- Recuperacion de sesion: implementada con access token de Supabase.
- Identificacion del usuario autenticado: `/api/me` valida el token con Supabase Auth.
- Recuperacion de contrasena: implementada con Supabase Auth.
- Gestion segura de contrasenas: delegada a Supabase Auth cuando `USE_SUPABASE=true`.
- Perfiles: tabla esperada `profiles`, usada por SDK, con id, nombre, correo, rol, estado, onboarding y fechas.
- Leads: tabla esperada `leads`, usada por SDK.
- Oportunidades: tabla esperada `opportunities`, usada por SDK.
- Conversaciones: tablas esperadas `conversations` y `conversation_messages`, usadas por SDK.
- Consentimientos: campo `consent_status` en `leads`.
- Evaluaciones del tutor / quiz: tabla esperada `quiz_results`, usada por SDK.
- Seguimientos: tabla esperada `proposed_actions`, usada por SDK.
- Preguntas configurables: tabla esperada `discovery_questions`, usada por SDK.
- Documentos autorizados: tabla esperada `approved_content`, usada por SDK.
- Metricas basicas: calculadas en backend desde tablas Supabase.

## Parcial

- Contactos: actualmente `profiles` funciona como contacto base. Si se requiere contacto comercial separado, crear `contacts` desde Table Editor.
- Configuracion de scoring: actualmente los pesos viven en codigo. Si se requiere administrarlos desde Supabase, crear `scoring_config` desde Table Editor y conectar un adaptador de lectura.
- Supabase Storage: no es necesario para el MVP actual porque los documentos RAG estan en tabla. Si se cargan PDFs o archivos, usar Storage.

## Bloqueo Actual

- `USE_SUPABASE=false`.
- La anon key conecta correctamente.
- La `SUPABASE_SERVICE_ROLE_KEY` configurada no es valida: Supabase responde `Invalid API key`.

Hasta corregir la service role key y crear las tablas desde Dashboard/Table Editor, la app debe permanecer en modo demo local.

Nota: el modo demo local existe solo para poder presentar la app sin infraestructura lista. Para cumplir estrictamente el criterio de no desarrollar un sistema propio de contrasenas, la demo final debe ejecutarse con `USE_SUPABASE=true`.

## Restriccion Aplicada

- No hay archivos `.sql`.
- No hay migraciones SQL.
- No hay `seed.sql`.
- No hay consultas SQL manuales dentro del codigo.
- La integracion usa Supabase SDK y adaptador `src/server/store/supabaseStore.ts`.
- La service role key solo se usa en backend y no se expone al frontend.
