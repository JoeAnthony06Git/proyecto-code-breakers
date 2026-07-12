import { approvedContent } from './approvedContent';
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
