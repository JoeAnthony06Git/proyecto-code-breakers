import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import type { Citation } from '../../shared/types';

export async function enhanceWithGemini(input: {
  draft: string;
  citations: Citation[];
  conversationSummary: string;
  internalSignals: {
    objections: string[];
    contactRequested: boolean;
    educationalIntent: boolean;
    commercialIntent: boolean;
  };
  usedSkills: string[];
}) {
  if (!config.geminiApiKey || input.citations.length === 0) {
    return { text: input.draft, usedGemini: false };
  }

  try {
    const genAI = new GoogleGenerativeAI(config.geminiApiKey);
    const model = genAI.getGenerativeModel({
      model: config.geminiModel,
      generationConfig: {
        temperature: 0.2,
        topP: 0.8,
        maxOutputTokens: 420,
      },
    });
    const prompt = [
      'Reescribe el borrador de forma natural, breve y completa.',
      'Usa solo el borrador y las fuentes RAG permitidas.',
      'No inventes datos, precios, productos ni promesas.',
      'No reveles score, prioridad, B2B/B2C ni parametros internos.',
      'No des asesoria financiera personalizada.',
      'Haz maximo una pregunta de seguimiento.',
      'No cortes frases a la mitad.',
      `Fuentes permitidas: ${input.citations.map((citation) => `${citation.module} ${citation.section}: ${citation.title}`).join('; ')}`,
      `Memoria breve: ${input.conversationSummary.slice(0, 700)}`,
      `Senales internas: ${JSON.stringify(input.internalSignals)}`,
      'Borrador:',
      input.draft,
    ].join('\n');
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const looksTruncated = text.length < 100 && input.draft.length > 180;
    const endsAbruptly = text.length > 0 && !/[.!?]$/.test(text);
    if (looksTruncated || endsAbruptly) {
      return { text: input.draft, usedGemini: false };
    }
    return { text: text || input.draft, usedGemini: true };
  } catch {
    return { text: input.draft, usedGemini: false };
  }
}
