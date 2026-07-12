import { approvedContent } from './approvedContent';
import { findRelevantChunks } from '../server/ai/gemini';
import type { ApprovedContentChunk, Citation } from '../shared/types';

const financeIntentTerms = [
  'ahorro',
  'invertir',
  'inversion',
  'jubilacion',
  'riesgo',
  'presupuesto',
  'fondo',
  'emergencia',
  'interes',
  'producto',
  'rentabilidad',
  'liquidez',
  'diversificacion',
  'objetivo',
  'horizonte',
  'empresa',
  'equipo',
  'capacitacion',
  'futuro',
  'academy',
  'plataforma',
  'bienvenida',
  'servicio',
  'programa',
  'consiste',
  'acompanamiento',
  'orientacion',
  'especialista',
];

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

export function hasFinancialIntent(text: string) {
  const normalized = normalize(text);
  return financeIntentTerms.some((term) => normalized.includes(normalize(term)));
}

export function retrieveApprovedContent(query: string, limit = 3, chunks: ApprovedContentChunk[] = approvedContent) {
  const tokens = new Set(tokenize(query));
  return chunks
    .filter((chunk) => chunk.approved)
    .map((chunk) => {
      const haystack = tokenize(`${chunk.title} ${chunk.module} ${chunk.section} ${chunk.tags.join(' ')} ${chunk.content}`);
      const score = haystack.reduce((total, token) => total + (tokens.has(token) ? 1 : 0), 0);
      return { chunk, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.chunk);
}

export async function retrieveApprovedContentSemantic(
  query: string,
  limit = 3,
  chunks: ApprovedContentChunk[] = approvedContent,
): Promise<ApprovedContentChunk[]> {
  if (!hasFinancialIntent(query)) return [];

  const approved = chunks.filter((c) => c.approved);
  const items = approved.map((c) => ({
    id: c.id,
    text: `${c.title} ${c.module} ${c.section} ${c.tags.join(' ')} ${c.content}`,
  }));

  const relevantIds = await findRelevantChunks(query, items, limit);
  if (relevantIds.length === 0) return retrieveApprovedContent(query, limit, chunks);

  const idOrder = new Map(relevantIds.map((id, i) => [id, i]));
  return approved
    .filter((c) => idOrder.has(c.id))
    .sort((a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0));
}

export function citationsFromChunks(chunks: ApprovedContentChunk[]): Citation[] {
  return chunks.map((chunk) => ({
    chunkId: chunk.id,
    title: chunk.title,
    module: chunk.module,
    section: chunk.section,
  }));
}

export function answerFromApprovedContent(query: string, chunks: ApprovedContentChunk[] = approvedContent) {
  const retrieved = retrieveApprovedContent(query, 2, chunks);
  if (!hasFinancialIntent(query)) {
    return {
      answer: '',
      citations: [] as Citation[],
      grounded: false,
    };
  }

  if (retrieved.length === 0) {
    return {
      answer:
        'No encontre contenido aprobado suficiente para responder con seguridad. Puedo registrar la pregunta para revision humana o ayudarte con otro tema de Futuro Academy.',
      citations: [] as Citation[],
      grounded: false,
    };
  }

  const asksForRecommendation = normalize(query).match(/(recomienda|debo comprar|en que invierto|que producto|me conviene)/);
  const sourceSummary = retrieved
    .map((chunk) => {
      const firstSentence = chunk.content.split('. ')[0].trim();
      return `- ${firstSentence}.`;
    })
    .join('\n');

  const safetyLine = asksForRecommendation
    ? 'No puedo recomendar un producto especifico ni reemplazar asesoria personalizada. Si quieres, un especialista puede revisar tu caso con consentimiento previo.'
    : 'Esto es contenido educativo y no reemplaza asesoria personalizada.';

  return {
    answer: `${sourceSummary}\n\n${safetyLine}`,
    citations: citationsFromChunks(retrieved),
    grounded: true,
  };
}

export async function answerFromApprovedContentSemantic(
  query: string,
  chunks: ApprovedContentChunk[] = approvedContent,
) {
  if (!hasFinancialIntent(query)) {
    return { answer: '', citations: [] as Citation[], grounded: false };
  }

  const retrieved = await retrieveApprovedContentSemantic(query, 2, chunks);

  if (retrieved.length === 0) {
    return {
      answer:
        'No encontre contenido aprobado suficiente para responder con seguridad. Puedo registrar la pregunta para revision humana o ayudarte con otro tema de Futuro Academy.',
      citations: [] as Citation[],
      grounded: false,
    };
  }

  const sourceText = retrieved
    .map((chunk) => chunk.content)
    .join('\n\n');

  return {
    answer: sourceText,
    citations: citationsFromChunks(retrieved),
    grounded: true,
  };
}
