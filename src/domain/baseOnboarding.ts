import type { ObsidianNote } from "../types";

export type BaseEpistemicStatus = "CONFIRMADO" | "HIPÓTESE" | "PENDENTE";

export interface BaseOnboardingQuestion {
  id: string;
  label: string;
  prompt: string;
}

export interface BaseOnboardingSection {
  id: string;
  title: string;
  fileTitle: string;
  description: string;
  questions: readonly BaseOnboardingQuestion[];
}

export interface BaseOnboardingAnswer {
  value: string;
  status: BaseEpistemicStatus;
}

export interface BaseOnboardingDraft {
  version: 1;
  currentSectionId: string;
  answers: Record<string, BaseOnboardingAnswer>;
  skippedSectionIds: string[];
  updatedAt: string;
}

export interface BaseDocumentPlan {
  sectionId: string;
  title: string;
  path: string;
  content: string;
  frontmatter: Record<string, unknown>;
  epistemicStatus: BaseEpistemicStatus;
}

export interface BaseReadiness {
  expectedPaths: string[];
  existingPaths: string[];
  missingSectionIds: string[];
  pendingPaths: string[];
  structurallyComplete: boolean;
  complete: boolean;
}

export const BASE_ONBOARDING_STORAGE_KEY = "nisti_base_onboarding_draft_v1";
export const BASE_FOLDER = "00_Base";

export const BASE_ONBOARDING_SECTIONS: readonly BaseOnboardingSection[] = [
  {
    id: "empresa",
    title: "Empresa",
    fileTitle: "Empresa",
    description: "O que a empresa é, para quem trabalha e qual realidade operacional precisa ser respeitada.",
    questions: [
      { id: "empresa.nome", label: "Nome da empresa", prompt: "Qual é o nome comercial que deve aparecer nos materiais?" },
      { id: "empresa.descricao", label: "O que a empresa faz", prompt: "Descreva objetivamente o que a empresa vende ou entrega." },
      { id: "empresa.atuacao", label: "Área de atuação", prompt: "Onde e para quais mercados ou regiões a empresa atua hoje?" },
    ],
  },
  {
    id: "publico",
    title: "Público",
    fileTitle: "Publico",
    description: "Pessoas e organizações que realmente compram, influenciam ou precisam ser alcançadas.",
    questions: [
      { id: "publico.principal", label: "Público principal", prompt: "Quem compra ou contrata com maior frequência hoje?" },
      { id: "publico.dores", label: "Problemas e necessidades", prompt: "Quais problemas reais esse público tenta resolver?" },
      { id: "publico.decisao", label: "Contexto de decisão", prompt: "O que costuma pesar na escolha, quando essa informação é conhecida?" },
    ],
  },
  {
    id: "posicionamento",
    title: "Posicionamento",
    fileTitle: "Posicionamento",
    description: "Como a empresa quer ser entendida e qual promessa consegue sustentar.",
    questions: [
      { id: "posicionamento.proposta", label: "Proposta de valor", prompt: "Que valor a empresa entrega de forma objetiva?" },
      { id: "posicionamento.percepcao", label: "Percepção desejada", prompt: "Como a empresa quer ser reconhecida pelo público?" },
    ],
  },
  {
    id: "produtos",
    title: "Produtos e serviços",
    fileTitle: "Produtos",
    description: "Oferta que o marketing pode promover sem inventar catálogo, preço ou disponibilidade.",
    questions: [
      { id: "produtos.principais", label: "Produtos ou serviços principais", prompt: "Liste as ofertas que existem hoje." },
      { id: "produtos.prioridades", label: "Prioridades comerciais", prompt: "Quais ofertas devem receber mais atenção agora, se houver prioridade definida?" },
    ],
  },
  {
    id: "diferenciais",
    title: "Diferenciais",
    fileTitle: "Diferenciais",
    description: "Vantagens que podem ser comunicadas e as evidências que sustentam essas alegações.",
    questions: [
      { id: "diferenciais.lista", label: "Diferenciais declarados", prompt: "O que a empresa faz de maneira diferente ou melhor?" },
      { id: "diferenciais.provas", label: "Evidências disponíveis", prompt: "Quais provas, processos, números ou exemplos sustentam esses diferenciais?" },
    ],
  },
  {
    id: "tom-de-voz",
    title: "Tom de voz",
    fileTitle: "Tom-de-Voz",
    description: "Padrões de linguagem que devem orientar textos, roteiros e atendimento.",
    questions: [
      { id: "tom.estilo", label: "Como a marca deve falar", prompt: "Descreva o estilo de comunicação desejado." },
      { id: "tom.evitar", label: "O que evitar", prompt: "Quais palavras, tons ou comportamentos não combinam com a marca?" },
    ],
  },
  {
    id: "canais",
    title: "Canais",
    fileTitle: "Canais",
    description: "Canais realmente usados ou aprovados para comunicação e aquisição.",
    questions: [
      { id: "canais.ativos", label: "Canais ativos", prompt: "Quais canais são usados atualmente?" },
      { id: "canais.prioridades", label: "Prioridades de canal", prompt: "Existe algum canal prioritário ou isso ainda está em definição?" },
    ],
  },
  {
    id: "concorrentes",
    title: "Concorrentes e referências",
    fileTitle: "Concorrentes",
    description: "Referências conhecidas sem assumir informação que ainda não foi pesquisada.",
    questions: [
      { id: "concorrentes.lista", label: "Concorrentes ou referências", prompt: "Quais empresas ou perfis são reconhecidos como concorrentes ou referências?" },
      { id: "concorrentes.diferencas", label: "Diferenças conhecidas", prompt: "Que diferenças são realmente conhecidas hoje?" },
    ],
  },
  {
    id: "objetivos",
    title: "Objetivos",
    fileTitle: "Objetivos",
    description: "Resultados de marketing ou negócio que precisam orientar priorização.",
    questions: [
      { id: "objetivos.principais", label: "Objetivos atuais", prompt: "O que o marketing precisa ajudar a alcançar nos próximos meses?" },
      { id: "objetivos.metricas", label: "Métricas ou metas já definidas", prompt: "Quais metas numéricas existem de verdade? Se não houver, deixe como pendente." },
    ],
  },
] as const;

export const BASE_PENDING_FILE_TITLE = "Pendencias";

function normalizePath(value: string): string {
  return String(value || "").replace(/\\/g, "/").replace(/^\/+/, "").trim().toLowerCase();
}

function answerFor(draft: BaseOnboardingDraft, questionId: string): BaseOnboardingAnswer {
  const stored = draft.answers[questionId];
  if (!stored) return { value: "", status: "PENDENTE" };
  return {
    value: String(stored.value || "").trim(),
    status: stored.status === "CONFIRMADO" || stored.status === "HIPÓTESE" ? stored.status : "PENDENTE",
  };
}

export function canonicalBasePath(section: BaseOnboardingSection): string {
  return `${BASE_FOLDER}/${section.fileTitle}.md`;
}

export function createEmptyBaseOnboardingDraft(now = new Date()): BaseOnboardingDraft {
  return {
    version: 1,
    currentSectionId: BASE_ONBOARDING_SECTIONS[0].id,
    answers: {},
    skippedSectionIds: [],
    updatedAt: now.toISOString(),
  };
}

export function isBaseAnswerReviewed(draft: BaseOnboardingDraft, questionId: string): boolean {
  const stored = draft.answers[questionId];
  if (!stored) return false;
  const answer = answerFor(draft, questionId);
  if (answer.status === "PENDENTE") return true;
  return Boolean(answer.value);
}

export function countUnreviewedBaseAnswers(draft: BaseOnboardingDraft): number {
  let count = 0;
  for (const section of BASE_ONBOARDING_SECTIONS) {
    if (draft.skippedSectionIds.includes(section.id)) continue;
    for (const question of section.questions) {
      if (!isBaseAnswerReviewed(draft, question.id)) count += 1;
    }
  }
  return count;
}

export function aggregateEpistemicStatus(answers: BaseOnboardingAnswer[]): BaseEpistemicStatus {
  if (answers.length === 0 || answers.some((answer) => !answer.value.trim() || answer.status === "PENDENTE")) {
    return "PENDENTE";
  }
  if (answers.some((answer) => answer.status === "HIPÓTESE")) return "HIPÓTESE";
  return "CONFIRMADO";
}

export function assessBaseReadiness(notes: ObsidianNote[]): BaseReadiness {
  const normalizedNotes = new Map(notes.map((note) => [normalizePath(note.path), note]));
  const expectedPaths = BASE_ONBOARDING_SECTIONS.map(canonicalBasePath);
  const existingPaths: string[] = [];
  const missingSectionIds: string[] = [];
  const pendingPaths: string[] = [];

  for (const section of BASE_ONBOARDING_SECTIONS) {
    const path = canonicalBasePath(section);
    const note = normalizedNotes.get(normalizePath(path));
    if (!note) {
      missingSectionIds.push(section.id);
      continue;
    }
    existingPaths.push(path);
    const epistemic = String(note.frontmatter?.epistemic_status || "").toUpperCase();
    if (epistemic !== "CONFIRMADO") pendingPaths.push(path);
  }

  const structurallyComplete = missingSectionIds.length === 0;
  return {
    expectedPaths,
    existingPaths,
    missingSectionIds,
    pendingPaths,
    structurallyComplete,
    complete: structurallyComplete && pendingPaths.length === 0,
  };
}

export function collectPendingQuestions(draft: BaseOnboardingDraft): Array<{ sectionTitle: string; questionLabel: string }> {
  const pending: Array<{ sectionTitle: string; questionLabel: string }> = [];
  for (const section of BASE_ONBOARDING_SECTIONS) {
    if (draft.skippedSectionIds.includes(section.id)) continue;
    for (const question of section.questions) {
      const answer = answerFor(draft, question.id);
      if (!answer.value || answer.status === "PENDENTE") {
        pending.push({ sectionTitle: section.title, questionLabel: question.label });
      }
    }
  }
  return pending;
}

function buildSectionContent(section: BaseOnboardingSection, draft: BaseOnboardingDraft): string {
  const blocks = section.questions.map((question) => {
    const answer = answerFor(draft, question.id);
    const value = answer.value || "PENDENTE — informação ainda não fornecida.";
    return `## ${question.label}\n\n**Estado:** ${answer.status}\n\n${value}`;
  });
  return [`# ${section.title}`, section.description, ...blocks].join("\n\n");
}

export function buildBaseDocumentPlans(
  draft: BaseOnboardingDraft,
  notes: ObsidianNote[],
  now = new Date()
): BaseDocumentPlan[] {
  const normalizedExisting = new Set(notes.map((note) => normalizePath(note.path)));
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const plans: BaseDocumentPlan[] = [];

  for (const section of BASE_ONBOARDING_SECTIONS) {
    if (draft.skippedSectionIds.includes(section.id)) continue;
    const path = canonicalBasePath(section);
    if (normalizedExisting.has(normalizePath(path))) continue;
    const answers = section.questions.map((question) => answerFor(draft, question.id));
    const epistemicStatus = aggregateEpistemicStatus(answers);
    plans.push({
      sectionId: section.id,
      title: section.fileTitle,
      path,
      content: buildSectionContent(section, draft),
      epistemicStatus,
      frontmatter: {
        id: `base_${section.id}`,
        tipo: "Base Inicial",
        status: epistemicStatus === "CONFIRMADO" ? "OFICIAL" : "EM REVISÃO",
        epistemic_status: epistemicStatus,
        category: section.title,
        owner: "Nisti Marketing",
        created_at: date,
        updated_at: date,
        origem: "Onboarding da Base Inicial",
        onboarding_version: "1",
        tags: ["base-inicial", section.id],
      },
    });
  }

  const pending = collectPendingQuestions(draft);
  const pendingPath = `${BASE_FOLDER}/${BASE_PENDING_FILE_TITLE}.md`;
  if (!normalizedExisting.has(normalizePath(pendingPath))) {
    plans.push({
      sectionId: "pendencias",
      title: BASE_PENDING_FILE_TITLE,
      path: pendingPath,
      epistemicStatus: pending.length ? "PENDENTE" : "CONFIRMADO",
      content: [
        "# Pendências da Base Inicial",
        pending.length
          ? pending.map((item) => `- [ ] **${item.sectionTitle}:** ${item.questionLabel}`).join("\n")
          : "Nenhuma pendência foi identificada nas respostas revisadas deste onboarding.",
      ].join("\n\n"),
      frontmatter: {
        id: "base_pendencias",
        tipo: "Base Inicial",
        status: pending.length ? "EM REVISÃO" : "OFICIAL",
        epistemic_status: pending.length ? "PENDENTE" : "CONFIRMADO",
        category: "Pendências",
        owner: "Nisti Marketing",
        created_at: date,
        updated_at: date,
        origem: "Onboarding da Base Inicial",
        onboarding_version: "1",
        tags: ["base-inicial", "pendencias"],
      },
    });
  }

  return plans;
}

export function nextIncompleteSectionId(draft: BaseOnboardingDraft): string | null {
  for (const section of BASE_ONBOARDING_SECTIONS) {
    if (draft.skippedSectionIds.includes(section.id)) continue;
    const answers = section.questions.map((question) => answerFor(draft, question.id));
    if (answers.some((answer) => !answer.value || answer.status === "PENDENTE")) return section.id;
  }
  return null;
}
