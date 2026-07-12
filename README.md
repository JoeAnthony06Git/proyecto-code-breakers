# Agentic Scale Track 1 MVP

SPA full-stack para el Track 1: Inteligencia Conversacional para Ventas y Gestion de Clientes.

Incluye un agente comercial IA, tutor financiero IA para Futuro Academy, CRM con adaptador Supabase, Supabase Auth cuando se configuran credenciales, scoring automatico, registro de conversaciones, consentimiento, RAG con contenido aprobado, quiz financiero, panel administrativo, supervision humana de acciones comerciales, pruebas y mecanismos antialucinacion.

## Inicio rapido

```bash
npm install
npm run dev
```

Abre `http://127.0.0.1:5173`.

Credenciales demo locales:

- Admin: `admin@agentic.scale` / `Admin123!`
- Usuario: crea una cuenta desde la pantalla de registro.

Si `USE_SUPABASE=false`, la API usa persistencia local en `data/demo-db.json`. Si `USE_SUPABASE=true`, usa Supabase Auth y tablas creadas desde Supabase Dashboard/Table Editor. No se usan migraciones SQL ni archivos SQL; la guia esta en `docs/supabase-dashboard-setup.md`.

## Scripts

- `npm run dev`: API Express y SPA Vite.
- `npm run test`: pruebas automatizadas de dominio y autorizacion.
- `npm run build`: typecheck y build frontend.

## Variables

Copia `.env.example` a `.env` y completa solo las credenciales necesarias. No subas `.env`.

Para activar Gemini:

```bash
GEMINI_API_KEY=tu_api_key_de_gemini
GEMINI_MODEL=gemini-flash-lite-latest
```

El agente esta definido en `docs/agent-definition.md`. La memoria RAG es la fuente principal para evitar alucinaciones; Gemini queda como capa liviana de redaccion. El backend calcula contexto, preguntas, objeciones, resumen y seguridad. El usuario normal no recibe score, prioridad ni B2B/B2C desde la API.

## Flujo demostrable

1. Registrar usuario con nombre, correo y contrasena.
2. Completar onboarding.
3. Conversar sobre un objetivo financiero o una necesidad de empresa.
4. Aceptar o rechazar consentimiento para registrar intereses comerciales.
5. Revisar respuesta educativa con fuentes aprobadas.
6. Ejecutar el quiz de tres preguntas.
7. Solicitar contacto humano.
8. Iniciar sesion como admin y aprobar, editar o rechazar acciones propuestas.

La clasificacion B2B/B2C es interna y solo aparece en CRM para administradores.
