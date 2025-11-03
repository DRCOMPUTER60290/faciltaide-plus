import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildChatbotSummary,
  normalizeChatbotQuestion,
  type ChatbotQuestion,
  type ChatbotSummaryEntry,
} from '../lib/chatbot';

describe('chatbot helpers', () => {
  it('normalizes chatbot questions with heterogeneous options', () => {
    const question = normalizeChatbotQuestion({
      id: 'q1',
      baseId: 'q1',
      type: 'select',
      label: 'Quelle est votre situation ?',
      required: true,
      options: [
        'Option A',
        { label: 'Option B', value: 'b' },
        { label: 'Sans valeur' },
        '',
      ],
      section: { id: 'section', title: 'Section test' },
    });

    assert.ok(question);
    assert.equal(question?.options?.length, 3);
    assert.deepEqual(question?.options, ['Option A', 'b', 'Sans valeur']);
  });

  it('builds a grouped summary from answered questions', () => {
    const questionA: ChatbotQuestion = {
      id: 'nom',
      baseId: 'nom',
      type: 'text',
      label: 'Nom',
      required: true,
      unit: null,
      options: undefined,
      section: { id: 'identite', title: 'Identité' },
    };

    const questionB: ChatbotQuestion = {
      id: 'naissance',
      baseId: 'naissance',
      type: 'date',
      label: 'Date de naissance',
      required: true,
      unit: null,
      options: undefined,
      section: { id: 'identite', title: 'Identité' },
    };

    const questionC: ChatbotQuestion = {
      id: 'revenus',
      baseId: 'revenus',
      type: 'number',
      label: 'Revenus mensuels',
      required: false,
      unit: '€',
      options: undefined,
      section: { id: 'ressources', title: 'Ressources' },
    };

    const questionD: ChatbotQuestion = {
      id: 'statut',
      baseId: 'statut',
      type: 'boolean',
      label: 'Demandeur d\'emploi',
      required: false,
      unit: null,
      options: undefined,
      section: { id: 'ressources', title: 'Ressources' },
    };

    const entries: ChatbotSummaryEntry[] = [
      { question: questionA, answer: 'Dupont' },
      { question: questionB, answer: '1990-01-12' },
      { question: questionC, answer: 1250.5 },
      { question: questionD, answer: true },
    ];

    const summary = buildChatbotSummary(entries);

    assert.equal(
      summary,
      ['Identité', '- Nom: Dupont', '- Date de naissance: 12/01/1990', 'Ressources', '- Revenus mensuels : 1\u202f250,5 €', '- Demandeur d\'emploi: Oui'].join('\n'),
    );
  });
});
