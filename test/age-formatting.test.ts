import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatAnswerWithCalculatedAge } from '../lib/age';

describe('formatAnswerWithCalculatedAge', () => {
  it('appends the computed age for a single birth date', () => {
    const formatted = formatAnswerWithCalculatedAge(
      'dependents-birth-dates',
      '14/07/2022',
      new Date('2025-07-14T12:00:00Z'),
    );

    assert.equal(formatted, '14/07/2022 (Âge calculé : 3 ans)');
  });

  it('appends the computed age for each date in a list', () => {
    const formatted = formatAnswerWithCalculatedAge(
      'dependents-birth-dates',
      '14/07/2022 ; 01/02/2020',
      new Date('2025-07-14T12:00:00Z'),
    );

    assert.equal(
      formatted,
      '14/07/2022 (Âge calculé : 3 ans) ; 01/02/2020 (Âge calculé : 5 ans)',
    );
  });

  it('keeps the original answer when it is not a birth date question', () => {
    const formatted = formatAnswerWithCalculatedAge('other-step', 'Réponse libre', new Date());
    assert.equal(formatted, 'Réponse libre');
  });
});
