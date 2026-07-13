# Pruebas manuales

## Usuario

1. Registrar una cuenta con nombre, correo, contrasena y confirmacion.
2. Completar onboarding de usuario.
3. Enviar: `Estoy pensando en invertir para mi jubilacion, pero no se por donde empezar.`
4. Verificar que el asistente responda con fuente de Futuro Academy y aviso educativo.
5. Enviar: `Cuales fueron los ingresos de NubeCondor Tech en 2025?`
6. Verificar que el usuario no vea la tarjeta de fuentes ni el contenido completo de la memoria RAG.
7. Enviar una solicitud debajo de la conversacion y confirmar la alerta: `Hemos recibido tu solicitud. Te responderemos en un plazo máximo de 24 horas.`
8. Verificar que aparece en `Mis solicitudes` como pendiente.
9. Usar `Limpiar chat`, confirmar la accion y verificar que los mensajes desaparecen.
10. Rechazar consentimiento y enviar: `Quiero que un especialista me contacte esta semana.`
11. Verificar que no se cree accion comercial porque no hay consentimiento.
12. Autorizar consentimiento y repetir solicitud de contacto.
13. Verificar que aparece accion comercial pendiente, no enviada automaticamente.
14. Completar el quiz de tres preguntas y revisar progreso.

## Administrador

1. Entrar con `admin@agentic.scale` / `Admin123!` en modo local.
2. Completar onboarding admin.
3. Abrir CRM y confirmar usuarios, conversaciones, score, clasificacion interna y consentimiento.
4. En `Seguimiento comercial`, revisar por lead: necesidad, perfil detectado, clasificacion interna, intereses, presupuesto, urgencia, objeciones, etapa, score, desglose, prioridad, quiz, accion recomendada y mensaje propuesto.
5. Exportar el seguimiento comercial a CSV y abrirlo en Excel.
6. Usar `Enviar correo` en un seguimiento y confirmar que abre el cliente de correo con destinatario.
7. Eliminar un seguimiento no relevante y confirmar que deja de verse en la lista.
8. Abrir el apartado admin `Solicitudes`, escribir una respuesta interna, enviarla y confirmar que el usuario la ve en `Mis solicitudes`.
9. Abrir Supervision y aprobar, editar o rechazar una accion pendiente.
10. Confirmar que ninguna comunicacion comercial se envia automaticamente al usuario.
11. Abrir Contenido y editar una pregunta configurable.
12. Intentar llamar `/api/admin/dashboard` con token de usuario y confirmar respuesta `403`.

## Supabase

1. Crear las tablas desde Supabase Dashboard/Table Editor siguiendo `docs/supabase-dashboard-setup.md`.
2. Copiar `.env.example` a `.env`, completar `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y poner `USE_SUPABASE=true`.
3. Registrar un usuario desde la app.
4. Para crear admin, cambiar el campo `role` del perfil desde Supabase Table Editor.
5. Reiniciar API y validar el panel admin.
