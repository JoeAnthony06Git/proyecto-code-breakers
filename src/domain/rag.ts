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
  'empresarial',
  'ficticia',
  'simulado',
  'ecuador',
  'sector',
  'ingresos',
  'ventas',
  'activos',
  'pasivos',
  'patrimonio',
  'utilidad',
  'nomina',
  'empleados',
  'trabajadores',
  'contratos',
  'riesgos',
  'operaciones',
  'logistica',
  'agroindustria',
  'alimentos',
  'tecnologia',
  'construccion',
  'infraestructura',
  'retail',
  'supermercados',
  'sierraverde',
  'pacifico cacao',
  'andina hogar',
  'costacentro',
  'nubecondor',
  'dataparamo',
  'horizonte vial',
  'urbanica',
  'rutapacifico',
  'andescargo',
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

const stopWords = new Set([
  'como',
  'cual',
  'cuales',
  'cuanto',
  'cuantos',
  'para',
  'por',
  'con',
  'los',
  'las',
  'una',
  'uno',
  'unos',
  'unas',
  'del',
  'que',
  'fue',
  'son',
  'sus',
  'mas',
  'mis',
  'tus',
  'tiene',
  'tuvo',
  'sobre',
  'dame',
  'info',
  'informacion',
]);

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(value: string) {
  return normalize(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

export function hasFinancialIntent(text: string) {
  const normalized = normalize(text);
  return financeIntentTerms.some((term) => normalized.includes(normalize(term)));
}

export function retrieveApprovedContent(query: string, limit = 3, chunks: ApprovedContentChunk[] = approvedContent) {
  const tokens = new Set(tokenize(query));
  const scored = chunks
    .filter((chunk) => chunk.approved)
    .map((chunk) => {
      const haystack = tokenize(`${chunk.title} ${chunk.module} ${chunk.section} ${chunk.tags.join(' ')} ${chunk.content}`);
      const titleScore = tokenize(chunk.title).reduce((total, token) => total + (tokens.has(token) ? 1 : 0), 0);
      const score = haystack.reduce((total, token) => total + (tokens.has(token) ? 1 : 0), 0);
      return { chunk, score, titleScore };
    })
    .filter((item) => item.score > 0);
  const titleMatches = scored.filter((item) => item.titleScore > 0);
  return (titleMatches.length > 0 ? titleMatches : scored)
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

function excerptFromChunk(query: string, chunk: ApprovedContentChunk) {
  const queryTokens = new Set(tokenize(query));
  const titleTokens = new Set(tokenize(chunk.title));
  const lowValueTokens = new Set(['cual', 'cuales', 'cuanto', 'cuantos', 'dame', 'datos', 'info', 'informacion', 'sobre', 'tuvo', 'tiene']);
  const focusTokens = [...queryTokens].filter((token) => !titleTokens.has(token) && !lowValueTokens.has(token));
  const tokensToScore = focusTokens.length > 0 ? new Set(focusTokens) : queryTokens;

  const paragraphs = chunk.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0 && !normalize(paragraph).startsWith('criterios comunes'));

  const scored = paragraphs.map((paragraph, index) => {
    const score = tokenize(paragraph).reduce((total, token) => total + (tokensToScore.has(token) ? 1 : 0), 0);
    return { paragraph, score, index };
  });
  const best = scored
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.paragraph;
  const fallback = paragraphs.find((paragraph) => !normalize(paragraph).startsWith('base de conocimiento ficticia')) ?? paragraphs[0] ?? chunk.content;
  const excerpt = best ?? fallback;
  const compact = excerpt.length > 520 ? `${excerpt.slice(0, 517).trimEnd()}...` : excerpt;
  const fictionalNote = chunk.module.includes('Base empresarial ficticia') && !normalize(compact).includes('fictici')
    ? ' Datos ficticios y simulados; no representan empresas reales.'
    : '';
  return `- ${compact}${fictionalNote}`;
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
  const hasFictitiousBusinessContent = retrieved.some((chunk) => chunk.module.includes('Base empresarial ficticia'));
  const sourceSummary = retrieved
    .map((chunk) => excerptFromChunk(query, chunk))
    .join('\n');

  const safetyLine = asksForRecommendation
    ? 'No puedo recomendar un producto especifico ni reemplazar asesoria personalizada. Si quieres, un especialista puede revisar tu caso con consentimiento previo.'
    : hasFictitiousBusinessContent
      ? 'Estos datos son ficticios y simulados para la memoria RAG; no representan empresas reales.'
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
