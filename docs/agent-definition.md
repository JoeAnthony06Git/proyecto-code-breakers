# Definicion del Agente Comercial IA

El chat usa una memoria RAG aprobada como fuente principal. Gemini es opcional y liviano: solo mejora la redaccion del borrador generado por el backend. La decision critica no queda en texto libre. Antes de llamar a Gemini, el backend ejecuta skills deterministas:

- `skillAnalyzeContext`: detecta contexto, interes, presupuesto, encaje, urgencia, objeciones y segmento interno B2B/B2C/UNDETERMINED.
- `skillRetrieveApprovedKnowledge`: recupera solo contenido aprobado de Futuro Academy o de la base empresarial ficticia y devuelve fuentes.
- `skillSelectDiscoveryQuestion`: elige preguntas configurables y evita repetir preguntas ya respondidas.
- `skillSummarizeConversation`: mantiene continuidad del historial con resumen interno.
- `skillApplySafetyPolicy`: bloquea promesas, recomendaciones personalizadas y respuestas sin soporte aprobado.

## Reglas

- El usuario nunca debe ver score, prioridad, breakdown, B2B/B2C, rationale interno, fuentes RAG ni la memoria RAG completa.
- El admin si puede ver esos datos dentro del CRM.
- B2B/B2C no se pregunta literalmente. Se infiere con preguntas naturales:
  - `Buscas esta solucion para ti o para una organizacion?`
  - `Cuantas personas participarian?`
  - `Cual es el objetivo principal?`
  - `Cuando te gustaria comenzar?`
- Si no hay suficiente informacion, la clasificacion queda como `UNDETERMINED`.
- Las acciones comerciales no se envian automaticamente. Siempre quedan pendientes de supervision humana.
- El tutor financiero solo responde con fuentes aprobadas o se niega de forma segura.
- La base empresarial ficticia de Ecuador vive como memoria RAG aprobada: 10 documentos, uno por empresa, con sector como categoria. Sus cifras son simuladas de cierre 2025 y no representan empresas reales.

## Gemini

Modo recomendado para hackathon:

- Modelo: `gemini-flash-lite-latest`.
- Temperatura baja: `0.2`.
- Salida corta: maximo 420 tokens.
- Entrada reducida: borrador, fuentes RAG, resumen breve y senales internas no revelables.

Coloca la clave en `.env`:

```bash
GEMINI_API_KEY=tu_api_key_de_gemini
GEMINI_MODEL=gemini-flash-lite-latest
```

Si no hay clave, el MVP funciona con respuestas deterministas basadas en RAG. Si hay clave, Gemini usa un modelo liviano para reescribir el borrador validado por la memoria RAG y las reglas de seguridad. No calcula scoring ni inventa informacion externa.
