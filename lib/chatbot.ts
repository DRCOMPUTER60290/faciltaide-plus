import { JsonParseError, HttpError } from './http';

type PlainObject = Record<string, unknown>;

const isPlainObject = (value: unknown): value is PlainObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const cloneAnswerValue = (value: ChatbotAnswerValue): ChatbotAnswerValue => {
  if (Array.isArray(value)) {
    return [...value];
  }

  return value;
};

export type ChatbotQuestionType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'boolean'
  | 'multi_select';

export interface ChatbotQuestion {
  id: string;
  baseId: string;
  type: ChatbotQuestionType;
  label: string;
  required: boolean;
  options?: unknown[];
  unit: string | null;
  validation?: PlainObject;
  metadata?: {
    internalKey: string | null;
    openfisca?: unknown;
  };
  section?: {
    id: string;
    title: string | null;
  };
  parentGroupIds?: string[];
  repeatContext?: Record<string, number>;
}

export type ChatbotAnswerValue = string | number | boolean | string[] | null;

export interface ChatbotNextResponse {
  question: ChatbotQuestion | null;
  completed: boolean;
}

export interface ChatbotQuestionnaireDefinition {
  meta: PlainObject;
  sections: unknown[];
  startQuestionId: string | null;
}

interface ChatbotNextApiResponse {
  question: unknown;
  completed?: unknown;
}

const toStringOrNull = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  return null;
};

const toStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const normalized = value
    .map((entry) => {
      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        return trimmed.length ? trimmed : null;
      }

      if (isPlainObject(entry)) {
        const label = toStringOrNull(entry.label);
        const normalizedValue = toStringOrNull(entry.value);

        if (normalizedValue) {
          return normalizedValue;
        }

        if (label) {
          return label;
        }

        return null;
      }

      return null;
    })
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);

  return normalized.length ? normalized : undefined;
};

const toStringId = (value: unknown): string => {
  if (typeof value === 'string' && value.trim().length) {
    return value;
  }

  return '';
};

export const normalizeChatbotQuestion = (value: unknown): ChatbotQuestion | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  const id = toStringOrNull(value.id);
  const baseId = toStringOrNull(value.baseId);
  const type = toStringOrNull(value.type) as ChatbotQuestionType | null;
  const label = toStringOrNull(value.label);

  if (!id || !baseId || !type || !label) {
    return null;
  }

  const required = Boolean(value.required);
  const options = toStringArray(value.options);
  const unit = toStringOrNull(value.unit);
  const validation = isPlainObject(value.validation) ? value.validation : undefined;

  let metadata: ChatbotQuestion['metadata'] = undefined;
  if (isPlainObject(value.metadata)) {
    metadata = {
      internalKey: toStringOrNull(value.metadata.internalKey),
      openfisca: value.metadata.openfisca,
    };
  }

  let section: ChatbotQuestion['section'] = undefined;
  if (isPlainObject(value.section)) {
    section = {
      id: toStringId(value.section.id),
      title: toStringOrNull(value.section.title),
    };
  }

  const parentGroupIds = Array.isArray(value.parentGroupIds)
    ? value.parentGroupIds.filter((entry): entry is string => typeof entry === 'string')
    : undefined;

  const repeatContext = isPlainObject(value.repeatContext)
    ? Object.fromEntries(
        Object.entries(value.repeatContext).filter(([, entry]) => typeof entry === 'number'),
      )
    : undefined;

  return {
    id,
    baseId,
    type,
    label,
    required,
    options,
    unit: unit ?? null,
    validation,
    metadata,
    section,
    parentGroupIds,
    repeatContext,
  };
};

export async function fetchChatbotNext(
  endpoint: string,
  answers: Record<string, ChatbotAnswerValue>,
): Promise<ChatbotNextResponse> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ answers }),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, rawText, response);
  }

  if (!rawText.trim().length) {
    return { question: null, completed: true };
  }

  let payload: ChatbotNextApiResponse;

  try {
    payload = JSON.parse(rawText) as ChatbotNextApiResponse;
  } catch (error) {
    throw new JsonParseError(rawText, error);
  }

  const normalizedQuestion =
    payload.question === null || payload.question === undefined
      ? null
      : normalizeChatbotQuestion(payload.question);

  if (payload.question && !normalizedQuestion) {
    throw new JsonParseError(rawText);
  }

  return {
    question: normalizedQuestion,
    completed: Boolean(payload.completed),
  };
}

export async function fetchChatbotQuestionnaire(
  endpoint: string,
): Promise<ChatbotQuestionnaireDefinition> {
  const response = await fetch(endpoint);
  const rawText = await response.text();

  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, rawText, response);
  }

  if (!rawText.trim().length) {
    throw new JsonParseError('');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new JsonParseError(rawText, error);
  }

  const meta = isPlainObject((parsed as PlainObject).meta) ? ((parsed as PlainObject).meta as PlainObject) : {};
  const startQuestionId = toStringOrNull((parsed as PlainObject).startQuestionId);
  const sections = Array.isArray((parsed as PlainObject).sections)
    ? ((parsed as PlainObject).sections as unknown[])
    : [];

  return {
    meta,
    sections,
    startQuestionId: startQuestionId ?? null,
  };
}

const formatIsoDateToFrench = (value: string): string | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
};

const formatNumber = (value: number): string => {
  return Number.isFinite(value)
    ? value.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
    : String(value);
};

const formatAnswerValue = (question: ChatbotQuestion, answer: ChatbotAnswerValue): string | null => {
  if (answer === null || answer === undefined) {
    return null;
  }

  if (typeof answer === 'string') {
    const trimmed = answer.trim();
    if (!trimmed.length) {
      return null;
    }

    if (question.type === 'date') {
      return formatIsoDateToFrench(trimmed) ?? trimmed;
    }

    return trimmed;
  }

  if (typeof answer === 'number') {
    return formatNumber(answer);
  }

  if (typeof answer === 'boolean') {
    return answer ? 'Oui' : 'Non';
  }

  if (Array.isArray(answer)) {
    const normalized = answer.filter((entry) => typeof entry === 'string' && entry.trim().length);
    if (!normalized.length) {
      return null;
    }
    return normalized.join(', ');
  }

  return null;
};

export interface ChatbotSummaryEntry {
  question: ChatbotQuestion;
  answer: ChatbotAnswerValue;
}

export const buildChatbotSummary = (entries: ChatbotSummaryEntry[]): string => {
  const lines: string[] = [];
  let lastSectionKey: string | null = null;

  entries.forEach((entry) => {
    const formatted = formatAnswerValue(entry.question, entry.answer);
    if (!formatted) {
      return;
    }

    const sectionId = entry.question.section?.id ?? null;
    const sectionTitle = entry.question.section?.title ?? null;

    if (sectionTitle && sectionTitle.trim().length) {
      const sectionKey = sectionId ?? sectionTitle;
      if (sectionKey !== lastSectionKey) {
        lines.push(sectionTitle.trim());
        lastSectionKey = sectionKey;
      }
    }

    const questionLabel = entry.question.label.trim();
    const unit = entry.question.unit && entry.question.unit.trim().length ? ` ${entry.question.unit.trim()}` : '';
    lines.push(`- ${questionLabel}${unit ? ' :' : ':'} ${formatted}${unit}`);
  });

  return lines.join('\n').trim();
};

export const cloneSummaryEntries = (entries: ChatbotSummaryEntry[]): ChatbotSummaryEntry[] => {
  return entries.map((entry) => ({
    question: entry.question,
    answer: cloneAnswerValue(entry.answer),
  }));
};

export const cloneAnswers = (
  answers: Record<string, ChatbotAnswerValue>,
): Record<string, ChatbotAnswerValue> => {
  return Object.fromEntries(
    Object.entries(answers).map(([key, value]) => [key, cloneAnswerValue(value)]),
  );
};

export type ChatbotMessageRole = 'bot' | 'user' | 'system';

export interface ChatbotMessage {
  id: string;
  role: ChatbotMessageRole;
  text: string;
  sectionTitle?: string | null;
}

