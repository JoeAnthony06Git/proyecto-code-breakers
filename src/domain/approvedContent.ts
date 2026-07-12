import type { ApprovedContentChunk, DiscoveryQuestion } from '../shared/types';

export const approvedContent: ApprovedContentChunk[] = [
  {
    id: 'fa-001',
    title: 'Objetivos y horizonte temporal',
    module: 'Modulo 1',
    section: 'Seccion 2',
    approved: true,
    tags: ['objetivo', 'horizonte', 'jubilacion', 'plazo', 'meta', 'tiempo'],
    content:
      'Antes de elegir un producto financiero, la persona debe definir su objetivo y horizonte temporal. Una meta de corto plazo prioriza liquidez y estabilidad. Una meta de largo plazo puede tolerar mas variacion, siempre que exista educacion, seguimiento y diversificacion.',
  },
  {
    id: 'fa-002',
    title: 'Riesgo y diversificacion',
    module: 'Modulo 2',
    section: 'Seccion 1',
    approved: true,
    tags: ['riesgo', 'diversificacion', 'inversion', 'portafolio', 'volatilidad'],
    content:
      'El riesgo financiero es la posibilidad de que el resultado sea distinto al esperado. La diversificacion distribuye el dinero entre instrumentos, sectores o plazos para reducir dependencia de una sola fuente de retorno. Diversificar no elimina el riesgo, pero ayuda a gestionarlo.',
  },
  {
    id: 'fa-003',
    title: 'Presupuesto y fondo de emergencia',
    module: 'Modulo 1',
    section: 'Seccion 4',
    approved: true,
    tags: ['presupuesto', 'emergencia', 'ahorro', 'gasto', 'liquidez'],
    content:
      'Un presupuesto ordena ingresos, gastos, ahorro y deudas. Antes de asumir compromisos de inversion, se recomienda construir un fondo de emergencia acorde con gastos esenciales. El fondo ayuda a evitar decisiones apresuradas ante imprevistos.',
  },
  {
    id: 'fa-004',
    title: 'Interes compuesto',
    module: 'Modulo 3',
    section: 'Seccion 2',
    approved: true,
    tags: ['interes compuesto', 'rendimiento', 'largo plazo', 'capitalizacion'],
    content:
      'El interes compuesto ocurre cuando los rendimientos se reinvierten y tambien generan rendimientos. Su efecto depende del tiempo, la constancia, los costos y la disciplina. No garantiza ganancias, pero permite entender por que comenzar temprano puede ser relevante.',
  },
  {
    id: 'fa-005',
    title: 'Evaluacion de productos financieros',
    module: 'Modulo 4',
    section: 'Seccion 3',
    approved: true,
    tags: ['producto', 'comisiones', 'rentabilidad', 'asesoria', 'comparar'],
    content:
      'Para comparar productos financieros se deben revisar objetivo, plazo, riesgo, costos, liquidez, restricciones y entidad responsable. Una decision informada evita enfocarse solo en rentabilidad historica. El contenido educativo no reemplaza asesoria personalizada.',
  },
  {
    id: 'fa-006',
    title: 'Educacion financiera para equipos',
    module: 'Modulo Empresas',
    section: 'Seccion 1',
    approved: true,
    tags: ['empresa', 'equipo', 'colaboradores', 'capacitacion', 'bienestar financiero'],
    content:
      'En organizaciones, la educacion financiera puede apoyar bienestar, planificacion y toma de decisiones responsables. Un programa para equipos debe considerar numero de participantes, objetivos, nivel inicial, medicion de avance y acompanamiento humano.',
  },
];

export const defaultDiscoveryQuestions: DiscoveryQuestion[] = [
  {
    id: 'dq-undetermined-1',
    segment: 'UNDETERMINED',
    text: 'Para orientarte mejor, cuentame si esto lo estas explorando para ti, para tu familia o para un equipo.',
    active: true,
    order: 1,
  },
  {
    id: 'dq-b2c-1',
    segment: 'B2C',
    text: 'Cual es el objetivo principal que quieres ordenar primero: ahorro, inversion, jubilacion o control de gastos?',
    active: true,
    order: 2,
  },
  {
    id: 'dq-b2c-2',
    segment: 'B2C',
    text: 'Tienes un horizonte aproximado para ese objetivo: meses, pocos anos o largo plazo?',
    active: true,
    order: 3,
  },
  {
    id: 'dq-any-urgency',
    segment: 'UNDETERMINED',
    text: 'Cuando te gustaria comenzar o tener una primera orientacion?',
    active: true,
    order: 4,
  },
  {
    id: 'dq-b2b-1',
    segment: 'B2B',
    text: 'Cuantas personas participarian y que resultado esperaria la organizacion al finalizar el acompanamiento?',
    active: true,
    order: 5,
  },
  {
    id: 'dq-b2b-2',
    segment: 'B2B',
    text: 'El interes principal es capacitacion, bienestar financiero, soporte comercial o seguimiento de clientes?',
    active: true,
    order: 6,
  },
];
