import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CHAT_PLAN_STEPS } from '../lib/chat-plan';

describe('guided assistant flow', () => {
  it('presents a coherent question sequence for the Benjamin & Nina scenario', () => {
    const scenarioAnswers: Record<string, string> = {
      'primary-first-name': 'Benjamin',
      'primary-birth-date': '27/04/1994',
      'primary-sex': 'Masculin',
      'living-arrangement': 'En couple',
      'spouse-first-name': 'Nina',
      'spouse-birth-date': '19/07/2003',
      'spouse-sex': 'Féminin',
      'conjugal-status': 'Pacsé(e)',
      'dependents-any': 'Oui',
      'dependents-count': '1',
      'dependents-names': 'Cedrick',
      'dependents-birth-dates': '14/07/2022',
      'dependents-sexes': 'Masculin',
      'dependents-schooling': 'Maternelle',
      'dependents-shared-custody': 'Non',
      'dependents-additional-info': 'Non',
      'adult1-situation-activite': 'Travailleur indépendant / auto-entrepreneur',
      'adult1-situation-accompagnement': 'Aucun accompagnement',
      'adult1-income-types': 'Revenus indépendants (adulte 1)',
      'adult1-contract-type': 'Travail indépendant',
      'adult1-self-employed-status': 'Micro-entreprise',
      'adult1-social-aids': 'Aucune',
      'adult1-retirement-date': 'Pas encore prévu',
      'adult2-intent': 'Oui',
      'adult2-situation': 'En situation de handicap ; Travailleur indépendant / auto-entrepreneur',
      'adult2-contract-type': 'Travail indépendant',
      'adult2-income-types':
        'Revenus indépendants (adulte 2) ; Allocation aux adultes handicapés (adulte 2)',
      'adult2-self-employed-status': 'Micro-entreprise',
      'adult2-disability-recognition': 'Oui, RQTH',
      'adult2-disability-rate': 'Entre 50 % et 80 %',
      'adult2-disability-restriction': 'Oui',
      'adult2-disability-aah': 'Oui',
      'adult2-social-aids': 'Aucune',
      'adult2-retirement-date': 'Pas encore prévu',
      'pregnancy-info': 'Non',
      'housing-postal-code': '60290',
      'housing-city': 'Laigneville',
      'housing-status': 'Propriétaire',
      'housing-housing-aid': 'Aucune',
      'housing-loan-type': 'Aucun prêt en cours',
      'housing-people': '3',
      'housing-charges': 'Les charges sont partagées',
      'housing-continue': 'Oui',
      'salary-info': 'Non',
      'independent-info': '0',
      'pensions-info': 'Non',
      'other-resources-info': 'Non',
      'adult2-salary-info': '0',
      'adult2-independent-info': 'P',
      'adult2-aah-amount': '1033',
      'adult2-pensions-info': 'Non',
      'adult2-other-resources-info': 'Non',
      'children-income-info': 'Non',
      'resources-continue': 'Oui',
      'savings-info': '10000',
      'realestate-ownership': 'Oui',
      'realestate-property-type': 'Résidence principale',
      'realestate-rental-status': 'Non',
      'realestate-mortgage': 'Non',
      'capital-info': 'Non',
      'valuable-assets-info': 'Non',
      'patrimony-sharing-info': 'Non',
      'final-choice': 'Lancer directement la simulation',
    };

    const collectedAnswers: Record<string, string> = {};
    const askedStepIds: string[] = [];

    for (const step of CHAT_PLAN_STEPS) {
      if (step.shouldAsk && !step.shouldAsk(collectedAnswers)) {
        continue;
      }

      askedStepIds.push(step.id);

      if (step.type !== 'info') {
        const answer = scenarioAnswers[step.id];
        assert.ok(answer, `missing answer for ${step.id}`);
        collectedAnswers[step.id] = answer;
      }
    }

    const expectedStepIds = [
      'section1-intro',
      'primary-first-name',
      'primary-birth-date',
      'primary-sex',
      'living-arrangement',
      'spouse-first-name',
      'spouse-birth-date',
      'spouse-sex',
      'conjugal-status',
      'dependents-any',
      'dependents-count',
      'dependents-names',
      'dependents-birth-dates',
      'dependents-sexes',
      'dependents-schooling',
      'dependents-shared-custody',
      'dependents-additional-info',
      'section2-intro',
      'adult1-situation-activite',
      'adult1-situation-accompagnement',
      'adult1-contract-type',
      'adult1-self-employed-status',
      'adult1-social-aids',
      'adult1-retirement-date',
      'adult2-intent',
      'adult2-situation',
      'adult2-contract-type',
      'adult2-self-employed-status',
      'adult2-disability-recognition',
      'adult2-disability-rate',
      'adult2-disability-restriction',
      'adult2-disability-aah',
      'adult2-social-aids',
      'adult2-retirement-date',
      'pregnancy-info',
      'section3-intro',
      'housing-postal-code',
      'housing-city',
      'housing-status',
      'housing-housing-aid',
      'housing-loan-type',
      'housing-people',
      'housing-charges',
      'housing-continue',
      'section4-intro',
      'adult1-income-types',
      'independent-info',
      'adult2-income-types',
      'adult2-independent-info',
      'adult2-aah-amount',
      'children-income-info',
      'resources-continue',
      'section5-intro',
      'savings-info',
      'realestate-ownership',
      'realestate-property-type',
      'realestate-rental-status',
      'realestate-mortgage',
      'capital-info',
      'valuable-assets-info',
      'patrimony-sharing-info',
      'final-choice',
    ];

    assert.deepEqual(askedStepIds, expectedStepIds);
  });
});
