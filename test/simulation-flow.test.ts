import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildSimulationPayload,
  extractRawJson,
  normalizeAvailableBenefits,
} from '../lib/simulation';

const SAMPLE_RAW_JSON = {
  salaire_de_base: 1200,
  nombre_enfants: 2,
  logement: {
    statut: 'locataire',
    loyer: 500,
  },
};

describe('extractRawJson', () => {
  it('returns parsed object when json string is provided', () => {
    const response = { json: JSON.stringify(SAMPLE_RAW_JSON) };
    const result = extractRawJson(response);
    assert.deepEqual(result, SAMPLE_RAW_JSON);
  });

  it('returns object when response is already parsed', () => {
    const result = extractRawJson({ ...SAMPLE_RAW_JSON });
    assert.deepEqual(result, SAMPLE_RAW_JSON);
  });

  it('returns null for invalid payloads', () => {
    assert.equal(extractRawJson(null), null);
    assert.equal(extractRawJson(undefined), null);
    assert.equal(extractRawJson('not-json'), null);
  });
});

describe('normalizeAvailableBenefits', () => {
  it('keeps only benefits with valid numeric amounts', () => {
    const normalized = normalizeAvailableBenefits([
      { id: 'rsa', label: 'RSA', entity: 'menage', period: '2024-09', amount: 512.5 },
      { id: 'aide', label: 'Aide', entity: 'famille', period: '2024', amount: '1000' },
      { id: 'bad', label: 'Bad', entity: 'famille', period: '2024-09', amount: 'oops' },
    ]);

    assert.equal(normalized.length, 2);
    assert.deepEqual(normalized[0], {
      id: 'rsa',
      label: 'RSA',
      entity: 'menage',
      period: '2024-09',
      amount: 512.5,
    });
    assert.deepEqual(normalized[1], {
      id: 'aide',
      label: 'Aide',
      entity: 'famille',
      period: '2024',
      amount: 1000,
    });
  });
});

describe('buildSimulationPayload', () => {
  it('constructs a normalized payload ready for the result screen', () => {
    const rawJson = SAMPLE_RAW_JSON;
    const apiResponse = {
      availableBenefits: [
        { id: 'rsa', label: 'RSA', entity: 'menage', period: '2024-09', amount: 600 },
      ],
      explanation: '  Montant estimé du RSA : 600 €.  ',
      payload: { key: 'value' },
      result: { rsa: { valeur: 600 } },
    };

    const payload = buildSimulationPayload(apiResponse, rawJson);

    assert.deepEqual(payload.availableBenefits, [
      { id: 'rsa', label: 'RSA', entity: 'menage', period: '2024-09', amount: 600 },
    ]);
    assert.equal(payload.explanation, 'Montant estimé du RSA : 600 €.');
    assert.deepEqual(payload.payload, apiResponse.payload);
    assert.deepEqual(payload.result, apiResponse.result);
    assert.equal(payload.rawJson, rawJson);
    assert.ok(typeof payload.generatedAt === 'string');
    assert.ok(Number.isFinite(Date.parse(payload.generatedAt)));
  });

  it('falls back to null when explanation is empty', () => {
    const payload = buildSimulationPayload({ explanation: '   ' }, SAMPLE_RAW_JSON);
    assert.equal(payload.explanation, null);
  });
});
