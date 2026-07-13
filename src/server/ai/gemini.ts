import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.js';
import type { Citation, ConversationMessage, UserProfile } from '../../shared/types';

let genAI: GoogleGenerativeAI | null = null;
const embeddingCache = new Map<string, number[]>();

function getGenAI() {
  if (!genAI && config.geminiApiKey) {
    genAI = new GoogleGenerativeAI(config.geminiApiKey);
  }
  return genAI;
}

export async function generateAssistantResponse(input: {
  userText: string;
  history: ConversationMessage[];
  profile: UserProfile;
  ragContent: string;
  ragCitations: Citation[];
  signals: {
    segment: string;
    educationalIntent: boolean;
    commercialIntent: boolean;
    objections: string[];
    contactRequested: boolean;
    interestTags: string[];
  };
  discoveryQuestion: string | null;
  conversationSummary: string;
}): Promise<{ text: string; citations: Citation[]; usedGemini: boolean }> {
  const ai = getGenAI();
  if (!ai) {
    return { text: '', citations: input.ragCitations, usedGemini: false };
  }

  try {
    const model = ai.getGenerativeModel({
      model: config.geminiModel,
      generationConfig: {
        temperature: 0.5,
        topP: 0.9,
        maxOutputTokens: 600,
      },
    });

    const prompt = buildConversationPrompt(input);
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    if (!text || text.length < 10) {
      return { text: '', citations: input.ragCitations, usedGemini: false };
    }

    return { text, citations: input.ragCitations, usedGemini: true };
  } catch {
    return { text: '', citations: input.ragCitations, usedGemini: false };
  }
}

function buildConversationPrompt(input: {
  userText: string;
  history: ConversationMessage[];
  profile: UserProfile;
  ragContent: string;
  ragCitations: Citation[];
  signals: {
    segment: string;
    educationalIntent: boolean;
    commercialIntent: boolean;
    objections: string[];
    contactRequested: boolean;
    interestTags: string[];
  };
  discoveryQuestion: string | null;
  conversationSummary: string;
}): string {
  const recentHistory = input.history.slice(-10);
  const historyStr = recentHistory.length > 0
    ? recentHistory.map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`).join('\n')
    : 'No hay historial previo. Esta es la primera interaccion.';

  const contextLines: string[] = [];

  contextLines.push(`Eres "Asistente", el agente conversacional de Futuro Academy.`);
  contextLines.push('');
  contextLines.push('SOBRE FUTURO ACADEMY:');
  contextLines.push('Futuro Academy es una plataforma de educacion financiera que ofrece programas de aprendizaje sobre finanzas personales, inversion, ahorro, jubilacion y gestion financiera tanto para individuos como para empresas.');
  contextLines.push('Los usuarios pueden acceder a contenido educativo aprobado, realizar evaluaciones financieras, y recibir orientacion personalizada.');
  contextLines.push('Tambien ofrecemos programas corporativos de bienestar financiero para equipos y organizaciones.');
  contextLines.push('El objetivo es educar y facilitar la toma de decisiones financieras informadas, siempre con supervision humana en aspectos comerciales.');

  contextLines.push('');
  contextLines.push('TUS DOS ROLES:');
  contextLines.push('1. AGENTE COMERCIAL: Cuando el usuario muestra interes en los servicios de Futuro Academy, pregunta sobre programas, costos, o quiere contacto con un especialista. En este rol debes explicar los servicios disponibles, calificar su perfil (sin mencionar la puntuacion internamente), y ofrecer derivar a un humano.');
  contextLines.push('2. TUTOR IA: Cuando el usuario quiere aprender sobre finanzas personales, inversion, presupuesto, ahorro, jubilacion, riesgo, diversificacion, etc. En este rol debes usar el contenido educativo aprobado disponible y responder con fuentes verificadas.');
  contextLines.push('Elige el rol adecuado segun lo que el usuario necesite en cada mensaje. Puedes alternar entre roles durante la conversacion.');

  contextLines.push('');
  contextLines.push('REGLAS:');
  contextLines.push('- Responde de forma natural, conversacional, directa y en espanol.');
  contextLines.push('- No uses emojis, ni introducciones como "Claro" o "Por supuesto".');
  contextLines.push('- Si el usuario pregunta sobre Futuro Academy o sus servicios, responde con la informacion disponible sin inventar datos.');
  contextLines.push('- Si el usuario quiere aprender sobre finanzas, usa el contenido educativo aprobado cuando sea relevante.');
  contextLines.push('- Si el usuario pregunta por empresas ficticias, sectores, ingresos, empleados, activos, riesgos u otros datos empresariales, responde solo si aparecen en el contenido aprobado y aclara que son datos simulados.');
  contextLines.push('- Si el usuario pregunta sobre temas fuera del ambito financiero, Futuro Academy o la base empresarial aprobada, responde amablemente que no puedes ayudarle con ese tema.');
  contextLines.push('- No inventes datos, precios, productos financieros ni promesas de rentabilidad.');
  contextLines.push('- No des asesoria financiera personalizada ni recomiendes productos especificos.');
  contextLines.push('- No menciones puntuaciones, clasificaciones (B2B/B2C), ni datos internos del perfil.');
  contextLines.push('- Si el usuario pide contacto humano, indica que puedes dejar una solicitud para revision.');

  if (input.ragContent) {
    contextLines.push('');
    contextLines.push('CONTENIDO APROBADO DISPONIBLE:');
    contextLines.push(input.ragContent);
  }

  const notes: string[] = [];
  if (input.signals.educationalIntent) notes.push('El usuario muestra interes en educacion financiera.');
  if (input.signals.commercialIntent) notes.push('El usuario muestra interes comercial o de contacto.');
  if (input.signals.contactRequested) notes.push('El usuario ha solicitado contacto con un especialista.');
  if (input.signals.objections.length > 0) {
    notes.push(`El usuario ha expresado preocupaciones sobre: ${input.signals.objections.join(', ')}.`);
  }
  if (input.signals.interestTags.length > 0) {
    notes.push(`Intereses detectados: ${input.signals.interestTags.join(', ')}.`);
  }
  if (input.discoveryQuestion) {
    notes.push(`Haz esta pregunta de forma natural cuando sea oportuno: "${input.discoveryQuestion}"`);
  }

  if (notes.length > 0) {
    contextLines.push('');
    contextLines.push('CONTEXTO INTERNO:');
    contextLines.push(notes.join('\n'));
  }

  if (input.conversationSummary) {
    contextLines.push('');
    contextLines.push('RESUMEN DE LA CONVERSACION:');
    contextLines.push(input.conversationSummary);
  }

  const systemContext = contextLines.join('\n');

  return `${systemContext}\n\nHistorial:\n${historyStr}\n\nUsuario: ${input.userText}\n\nAsistente:`;
}

export async function generateConversationSummary(input: {
  profile: UserProfile;
  history: ConversationMessage[];
  userText: string;
  signals: { interestTags: string[]; objections: string[] };
}): Promise<string> {
  const ai = getGenAI();
  if (!ai) return '';

  try {
    const model = ai.getGenerativeModel({
      model: config.geminiModel,
      generationConfig: { temperature: 0.2, maxOutputTokens: 200 },
    });

    const recentMessages = input.history.slice(-6).map((m) => m.content).join(' | ');
    const prompt = [
      'Resume brevemente esta conversacion financiera para un agente comercial.',
      'Incluye nombre del usuario, temas tratados, intereses detectados y objeciones si las hay.',
      'Maximo 2 oraciones.',
      '',
      `Usuario: ${input.profile.name}`,
      `Mensajes: ${recentMessages} | ${input.userText}`,
      `Intereses: ${input.signals.interestTags.join(', ') || 'ninguno'}`,
      `Objeciones: ${input.signals.objections.join(', ') || 'ninguna'}`,
      '',
      'Resumen:',
    ].join('\n');

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return text || '';
  } catch {
    return '';
  }
}

export async function computeEmbedding(text: string): Promise<number[]> {
  const cached = embeddingCache.get(text);
  if (cached) return cached;

  const ai = getGenAI();
  if (!ai) throw new Error('Gemini API key no configurada');

  const model = ai.getGenerativeModel({ model: 'embedding-001' });
  const result = await model.embedContent(text);
  const values = result.embedding.values;
  embeddingCache.set(text, values);
  return values;
}

export async function findRelevantChunks(
  query: string,
  chunks: Array<{ id: string; text: string }>,
  topK = 3,
): Promise<string[]> {
  if (chunks.length === 0 || !getGenAI()) return [];

  try {
    const queryEmbedding = await computeEmbedding(query);
    const chunkEmbeddings = await Promise.all(chunks.map((c) => computeEmbedding(c.text)));

    const scored = chunks.map((chunk, i) => ({
      id: chunk.id,
      score: cosineSimilarity(queryEmbedding, chunkEmbeddings[i]),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.id);
  } catch {
    return [];
  }
}

export async function precomputeEmbeddings(texts: string[]): Promise<void> {
  const uncached = texts.filter((t) => !embeddingCache.has(t));
  if (uncached.length === 0) return;

  const ai = getGenAI();
  if (!ai) return;

  const model = ai.getGenerativeModel({ model: 'embedding-001' });
  await Promise.allSettled(
    uncached.map(async (text) => {
      try {
        const result = await model.embedContent(text);
        embeddingCache.set(text, result.embedding.values);
      } catch {
        // skip failed embeddings
      }
    }),
  );
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
