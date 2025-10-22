export type ChatMultiSelectOption = {
  label: string;
  group?: string;
  description?: string;
};

export type ChatStep = {
  id: string;
  prompt: string;
  section: string;
  label?: string;
  type?: 'info' | 'question';
  options?: string[];
  multiSelectOptions?: ChatMultiSelectOption[];
  multiSelectHint?: string;
  shouldAsk?: (answers: Record<string, string>) => boolean;
};

export const MULTI_SELECT_SEPARATOR = ' ; ';

const splitMultiSelectValues = (value?: string): string[] => {
  if (!value) {
    return [];
  }

  return value
    .split(';')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const includesMultiSelectValue = (value: string | undefined, expected: string): boolean => {
  const normalizedExpected = toComparable(expected);

  return splitMultiSelectValues(value).some((entry) => toComparable(entry) === normalizedExpected);
};

const joinMultiSelectAnswers = (
  answers: Record<string, string>,
  keys: string[],
): string | undefined => {
  const values = keys
    .map((key) => answers[key])
    .filter((value) => value && value.length > 0);

  if (values.length === 0) {
    return undefined;
  }

  return values.join(MULTI_SELECT_SEPARATOR);
};

const getAdult1SituationsAnswer = (answers: Record<string, string>): string | undefined =>
  joinMultiSelectAnswers(answers, ['adult1-situation-activite', 'adult1-situation-accompagnement']);

export const toComparable = (value?: string): string =>
  (value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019']/g, '')
    .replace(/[()]/g, '')
    .toLowerCase();

export const isYes = (value?: string): boolean => toComparable(value) === 'oui';

export const isCouple = (answers: Record<string, string>): boolean =>
  toComparable(answers['living-arrangement']) === 'en couple';

export const wantsAdult2Details = (answers: Record<string, string>): boolean =>
  isCouple(answers) && toComparable(answers['adult2-intent']) === 'oui';

export const hasDependents = (answers: Record<string, string>): boolean => isYes(answers['dependents-any']);

const hasDisabledDependents = (answers: Record<string, string>): boolean =>
  hasDependents(answers) && isYes(answers['dependents-disability']);

export const isAdult1Independent = (answers: Record<string, string>): boolean =>
  includesMultiSelectValue(
    getAdult1SituationsAnswer(answers),
    'Travailleur indépendant / auto-entrepreneur',
  );

export const isAdult1ReturningToWork = (answers: Record<string, string>): boolean =>
  includesMultiSelectValue(getAdult1SituationsAnswer(answers), 'En reprise d’activité');

export const isAdult2Independent = (answers: Record<string, string>): boolean =>
  includesMultiSelectValue(answers['adult2-situation'], 'Travailleur indépendant / auto-entrepreneur');

export const isAdult2ReturningToWork = (answers: Record<string, string>): boolean =>
  includesMultiSelectValue(answers['adult2-situation'], 'En reprise d’activité');

export const isAdult1DisabilitySituation = (answers: Record<string, string>): boolean =>
  includesMultiSelectValue(getAdult1SituationsAnswer(answers), 'En situation de handicap');

export const isAdult2DisabilitySituation = (answers: Record<string, string>): boolean =>
  includesMultiSelectValue(answers['adult2-situation'], 'En situation de handicap');

export const isAdult1Rqth = (answers: Record<string, string>): boolean =>
  includesMultiSelectValue(getAdult1SituationsAnswer(answers), 'En situation de handicap') ||
  toComparable(answers['adult1-disability-recognition']).includes('rqth');

export const isAdult2Rqth = (answers: Record<string, string>): boolean =>
  includesMultiSelectValue(answers['adult2-situation'], 'En situation de handicap') ||
  toComparable(answers['adult2-disability-recognition']).includes('rqth');

export const wantsAdult2RqthDetails = (answers: Record<string, string>): boolean =>
  wantsAdult2Details(answers) && isAdult2Rqth(answers);

export const isAdult1Employee = (answers: Record<string, string>): boolean =>
  includesMultiSelectValue(getAdult1SituationsAnswer(answers), 'Salarié(e)');

export const isAdult2Employee = (answers: Record<string, string>): boolean =>
  includesMultiSelectValue(answers['adult2-situation'], 'Salarié(e)');

const hasAdult1Situation = (answers: Record<string, string>, label: string): boolean =>
  includesMultiSelectValue(getAdult1SituationsAnswer(answers), label);

const hasAdult2Situation = (answers: Record<string, string>, label: string): boolean =>
  includesMultiSelectValue(answers['adult2-situation'], label);

const isAdult1ReturnToWorkType = (
  answers: Record<string, string>,
  expected: string,
): boolean =>
  isAdult1ReturningToWork(answers) && toComparable(answers['adult1-return-to-work-type']) === toComparable(expected);

const isAdult2ReturnToWorkType = (
  answers: Record<string, string>,
  expected: string,
): boolean =>
  isAdult2ReturningToWork(answers) && toComparable(answers['adult2-return-to-work-type']) === toComparable(expected);

export const isAdult1ReturnToWorkFormation = (answers: Record<string, string>): boolean =>
  isAdult1ReturnToWorkType(answers, 'Formation');

export const isAdult1ReturnToWorkCdd = (answers: Record<string, string>): boolean =>
  isAdult1ReturnToWorkType(answers, 'CDD');

export const isAdult1ReturnToWorkCdi = (answers: Record<string, string>): boolean =>
  isAdult1ReturnToWorkType(answers, 'CDI');

export const isAdult2ReturnToWorkFormation = (answers: Record<string, string>): boolean =>
  wantsAdult2Details(answers) && isAdult2ReturnToWorkType(answers, 'Formation');

export const isAdult2ReturnToWorkCdd = (answers: Record<string, string>): boolean =>
  wantsAdult2Details(answers) && isAdult2ReturnToWorkType(answers, 'CDD');

export const isAdult2ReturnToWorkCdi = (answers: Record<string, string>): boolean =>
  wantsAdult2Details(answers) && isAdult2ReturnToWorkType(answers, 'CDI');

export const isAdult1JobSeeker = (answers: Record<string, string>): boolean =>
  hasAdult1Situation(answers, 'Demandeur d’emploi');

export const isAdult2JobSeeker = (answers: Record<string, string>): boolean =>
  hasAdult2Situation(answers, 'Demandeur d’emploi');

export const isAdult1JournalistGroup = (answers: Record<string, string>): boolean =>
  hasAdult1Situation(answers, 'Journaliste, assistant maternel ou familial');

export const isAdult2JournalistGroup = (answers: Record<string, string>): boolean =>
  hasAdult2Situation(answers, 'Journaliste, assistant maternel ou familial');

export const isAdult1Student = (answers: Record<string, string>): boolean =>
  hasAdult1Situation(answers, 'Étudiant(e)');

export const isAdult2Student = (answers: Record<string, string>): boolean =>
  hasAdult2Situation(answers, 'Étudiant(e)');

const hasAdult1IncomeSelection = (answers: Record<string, string>, label: string): boolean =>
  includesMultiSelectValue(answers['adult1-income-types'], label);

const hasAdult2IncomeSelection = (answers: Record<string, string>, label: string): boolean =>
  includesMultiSelectValue(answers['adult2-income-types'], label);

const ADULT1_INCOME_LABELS = {
  salary: 'Salaires (adulte 1)',
  independent: 'Revenus indépendants (adulte 1)',
  unemployment: 'Allocations chômage (adulte 1)',
  primeActivity: 'Prime d’activité (adulte 1)',
  rsa: 'Revenu de solidarité active (adulte 1)',
  housingBenefits: 'Aides au logement (adulte 1)',
  familyAllowances: 'Allocations familiales (adulte 1)',
  aah: 'Allocation aux adultes handicapés (adulte 1)',
  invalidityPension: 'Pension d’invalidité (adulte 1)',
  pensions: 'Pensions alimentaires / retraites / rentes (adulte 1)',
  other: 'Autres ressources (adulte 1)',
} as const;

const ADULT2_INCOME_LABELS = {
  salary: 'Salaires (adulte 2)',
  independent: 'Revenus indépendants (adulte 2)',
  unemployment: 'Allocations chômage (adulte 2)',
  primeActivity: 'Prime d’activité (adulte 2)',
  rsa: 'Revenu de solidarité active (adulte 2)',
  housingBenefits: 'Aides au logement (adulte 2)',
  familyAllowances: 'Allocations familiales (adulte 2)',
  aah: 'Allocation aux adultes handicapés (adulte 2)',
  invalidityPension: 'Pension d’invalidité (adulte 2)',
  pensions: 'Pensions alimentaires / retraites / rentes (adulte 2)',
  other: 'Autres ressources (adulte 2)',
} as const;

export const receivesAdult1PrimeActivity = (answers: Record<string, string>): boolean =>
  hasAdult1IncomeSelection(answers, ADULT1_INCOME_LABELS.primeActivity);

export const receivesAdult1Rsa = (answers: Record<string, string>): boolean =>
  hasAdult1IncomeSelection(answers, ADULT1_INCOME_LABELS.rsa);

export const receivesAdult1HousingBenefits = (answers: Record<string, string>): boolean =>
  hasAdult1IncomeSelection(answers, ADULT1_INCOME_LABELS.housingBenefits);

export const receivesAdult1FamilyAllowances = (answers: Record<string, string>): boolean =>
  hasAdult1IncomeSelection(answers, ADULT1_INCOME_LABELS.familyAllowances);

export const receivesAdult1Aah = (answers: Record<string, string>): boolean =>
  hasAdult1IncomeSelection(answers, ADULT1_INCOME_LABELS.aah);

export const receivesAdult1InvalidityPension = (answers: Record<string, string>): boolean =>
  hasAdult1IncomeSelection(answers, ADULT1_INCOME_LABELS.invalidityPension);

export const receivesAdult2PrimeActivity = (answers: Record<string, string>): boolean =>
  hasAdult2IncomeSelection(answers, ADULT2_INCOME_LABELS.primeActivity);

export const receivesAdult2Rsa = (answers: Record<string, string>): boolean =>
  hasAdult2IncomeSelection(answers, ADULT2_INCOME_LABELS.rsa);

export const receivesAdult2HousingBenefits = (answers: Record<string, string>): boolean =>
  hasAdult2IncomeSelection(answers, ADULT2_INCOME_LABELS.housingBenefits);

export const receivesAdult2FamilyAllowances = (answers: Record<string, string>): boolean =>
  hasAdult2IncomeSelection(answers, ADULT2_INCOME_LABELS.familyAllowances);

export const receivesAdult2Aah = (answers: Record<string, string>): boolean =>
  hasAdult2IncomeSelection(answers, ADULT2_INCOME_LABELS.aah);

export const receivesAdult2InvalidityPension = (answers: Record<string, string>): boolean =>
  hasAdult2IncomeSelection(answers, ADULT2_INCOME_LABELS.invalidityPension);

const tenantStatuses = new Set([
  'locataire vide',
  'locataire meuble',
  'colocation',
  'logement social',
  'logement etudiant',
]);

export const isTenantStatus = (answers: Record<string, string>): boolean =>
  tenantStatuses.has(toComparable(answers['housing-status']));

export const isColocationStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'colocation';

export const isSocialHousingStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'logement social';

export const isOwnerStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'proprietaire';

export const isHostedStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'heberge gratuitement';

export const isStudentHousingStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'logement etudiant';

export const isEmergencyHousingStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'hebergement durgence / sans domicile';

export const receivesHousingAid = (answers: Record<string, string>): boolean => {
  const normalized = toComparable(answers['housing-housing-aid']);
  return Boolean(normalized.length) && normalized !== 'aucune' && normalized !== 'non applicable';
};

export const hasMortgagePayments = (answers: Record<string, string>): boolean =>
  isOwnerStatus(answers) && toComparable(answers['housing-loan-type']) !== 'aucun pret en cours';

export const ownsRealEstate = (answers: Record<string, string>): boolean => isYes(answers['realestate-ownership']);

export const hasRentedRealEstate = (answers: Record<string, string>): boolean =>
  ownsRealEstate(answers) && isYes(answers['realestate-rental-status']);

export const CHAT_PLAN_STEPS: ChatStep[] = [
  {
    id: 'section1-intro',
    type: 'info',
    section: 'Section 1 – Composition du foyer',
    prompt: '🔷 SECTION 1 – COMPOSITION DU FOYER',
  },
  {
    id: 'primary-first-name',
    section: 'Section 1 – Composition du foyer',
    label: 'Prénom',
    prompt: '1. Quel est votre prénom ?',
  },
  {
    id: 'primary-birth-date',
    section: 'Section 1 – Composition du foyer',
    label: 'Date de naissance',
    prompt: '2. Quelle est votre date de naissance ? (JJ/MM/AAAA)',
  },
  {
    id: 'primary-sex',
    section: 'Section 1 – Composition du foyer',
    label: 'Sexe',
    prompt: '3. Quel est votre sexe ? (Masculin / Féminin)',
    options: ['Masculin', 'Féminin'],
  },
  {
    id: 'living-arrangement',
    section: 'Section 1 – Composition du foyer',
    label: 'Vous vivez',
    prompt: '4. Vivez-vous : Seul(e) ou En couple ? Indiquez « Seul(e) » ou « En couple ».',
    options: ['Seul(e)', 'En couple'],
  },
  {
    id: 'spouse-first-name',
    section: 'Section 1 – Composition du foyer',
    label: 'Prénom du conjoint',
    prompt:
      '5. Si vous vivez en couple, quel est le prénom de votre conjoint(e) ? Répondez « Non applicable » si vous vivez seul(e).',
    shouldAsk: isCouple,
  },
  {
    id: 'spouse-birth-date',
    section: 'Section 1 – Composition du foyer',
    label: 'Date de naissance du conjoint',
    prompt:
      '6. Si vous vivez en couple, quelle est sa date de naissance ? (JJ/MM/AAAA) Répondez « Non applicable » si vous vivez seul(e).',
    shouldAsk: isCouple,
  },
  {
    id: 'spouse-sex',
    section: 'Section 1 – Composition du foyer',
    label: 'Sexe du conjoint',
    prompt:
      '7. Si vous vivez en couple, quel est son sexe ? Répondez « Non applicable » si vous vivez seul(e).',
    options: ['Masculin', 'Féminin', 'Non applicable'],
    shouldAsk: isCouple,
  },
  {
    id: 'conjugal-status',
    section: 'Section 1 – Composition du foyer',
    label: 'Statut conjugal',
    prompt:
      '8. Quel est votre statut conjugal ? (Marié(e), Pacsé(e), Union libre, etc.) Indiquez « Non applicable » si vous vivez seul(e).',
    options: [
      'Marié(e)',
      'Pacsé(e)',
      'Union libre',
      'Divorcé(e)',
      'Séparé(e)',
      'Veuf(ve)',
      'Non applicable',
    ],
  },
  {
    id: 'dependents-any',
    section: 'Section 1 – Composition du foyer',
    label: 'Enfants ou personnes à charge',
    prompt:
      '9. Avez-vous des enfants ou des personnes à charge vivant avec vous ? (Oui / Non)',
    options: ['Oui', 'Non'],
  },
  {
    id: 'dependents-count',
    section: 'Section 1 – Composition du foyer',
    label: "Nombre d'enfants / personnes à charge",
    prompt: '9 bis. Combien d’enfants ou de personnes à charge vivent avec vous ? Indiquez le nombre.',
    shouldAsk: hasDependents,
  },
  {
    id: 'dependents-names',
    section: 'Section 1 – Composition du foyer',
    label: 'Prénoms des enfants / personnes à charge',
    prompt:
      '10. Pour chaque enfant ou personne à charge, indiquez le prénom. Répondez « Aucun » si personne ne vit avec vous.',
    shouldAsk: hasDependents,
  },
  {
    id: 'dependents-birth-dates',
    section: 'Section 1 – Composition du foyer',
    label: 'Dates de naissance des enfants / personnes à charge',
    prompt:
      '11. Pour chacun, précisez la date de naissance (JJ/MM/AAAA). Répondez « Non applicable » si aucun.',
    shouldAsk: hasDependents,
  },
  {
    id: 'dependents-sexes',
    section: 'Section 1 – Composition du foyer',
    label: 'Sexe des enfants / personnes à charge',
    prompt:
      '12. Pour chaque enfant ou personne à charge, indiquez le sexe.',
    options: ['Féminin', 'Masculin', 'Non binaire', 'Non précisé', 'Non applicable'],
    shouldAsk: hasDependents,
  },
  {
    id: 'dependents-schooling',
    section: 'Section 1 – Composition du foyer',
    label: 'Scolarité des enfants / personnes à charge',
    prompt:
      '13. Pour chaque enfant ou personne à charge, précisez la situation scolaire (Non scolarisé, Maternelle, Élémentaire, Collège, Lycée, Études supérieures, Apprentissage, Enseignement spécialisé, Autre). Indiquez « Non applicable » si aucun.',
    options: [
      'Non scolarisé',
      'Maternelle',
      'Élémentaire',
      'Collège',
      'Lycée',
      'Études supérieures',
      'Apprentissage',
      'Enseignement spécialisé',
      'Autre',
      'Non applicable',
    ],
    shouldAsk: hasDependents,
  },
  {
    id: 'dependents-shared-custody',
    section: 'Section 1 – Composition du foyer',
    label: 'Garde alternée',
    prompt:
      '14. La garde est-elle alternée (Oui/Non) pour chacun des enfants ou personnes à charge ?',
    options: ['Oui', 'Non'],
    shouldAsk: hasDependents,
  },
  {
    id: 'dependents-disability',
    section: 'Section 1 – Composition du foyer',
    label: 'Enfants en situation de handicap',
    prompt:
      '14 bis. Certains de vos enfants ou personnes à charge sont-ils en situation de handicap reconnue ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: hasDependents,
  },
  {
    id: 'dependents-disability-rate',
    section: 'Section 1 – Composition du foyer',
    label: 'Taux d’incapacité des enfants',
    prompt:
      '14 ter. Pour chaque enfant en situation de handicap, indiquez le taux d’incapacité reconnu (Moins de 50 %, Entre 50 % et 80 %, Plus de 80 %). Mentionnez le prénom et le taux pour chacun ou « Non applicable » si aucun.',
    shouldAsk: hasDisabledDependents,
  },
  {
    id: 'dependents-disability-restriction',
    section: 'Section 1 – Composition du foyer',
    label: 'Restriction substantielle d’accès à l’emploi',
    prompt:
      '14 quater. Pour chacun des enfants concernés, précisez si une restriction substantielle et durable d’accès à l’emploi est reconnue par la CDAPH (Oui / Non). Indiquez le prénom et la réponse, ou « Non applicable » si aucun enfant n’est concerné.',
    shouldAsk: hasDisabledDependents,
  },
  {
    id: 'dependents-disability-placement',
    section: 'Section 1 – Composition du foyer',
    label: 'Placement spécialisé ou famille d’accueil',
    prompt:
      '14 quinquies. Un placement en structure spécialisée ou en famille d’accueil est-il prévu pour l’un de ces enfants ? Indiquez le prénom et répondez Oui / Non pour chacun, ou « Non applicable » si aucun.',
    shouldAsk: hasDisabledDependents,
  },
  {
    id: 'dependents-additional-info',
    section: 'Section 1 – Composition du foyer',
    label: 'Informations complémentaires',
    prompt:
      '15. Souhaitez-vous ajouter d’autres informations utiles concernant les enfants ou personnes à charge ?',
    shouldAsk: hasDependents,
  },
  {
    id: 'section2-intro',
    type: 'info',
    section: 'Section 2 – Situation professionnelle et personnelle',
    prompt: '🔶 SECTION 2 – SITUATION PROFESSIONNELLE ET PERSONNELLE',
  },
  {
    id: 'adult1-situation-activite',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Situations professionnelles (adulte 1)',
    prompt:
      '16. Pour vous (adulte 1), quelles situations professionnelles s’appliquent actuellement ? Vous pouvez sélectionner plusieurs cas.',
    multiSelectHint: 'Sélectionnez toutes les situations qui correspondent à votre parcours.',
    multiSelectOptions: [
      { label: 'Salarié(e)', group: 'Activité professionnelle' },
      {
        label: 'Travailleur indépendant / auto-entrepreneur',
        group: 'Activité professionnelle',
      },
      { label: 'En reprise d’activité', group: 'Activité professionnelle' },
      { label: 'En congé parental', group: 'Situation familiale' },
      { label: 'Demandeur d’emploi', group: 'Accompagnement vers l’emploi' },
      { label: 'En CER ou en PPAE', group: 'Accompagnement vers l’emploi' },
      {
        label: 'Journaliste, assistant maternel ou familial',
        group: 'Professions spécifiques',
      },
      { label: 'Étudiant(e)', group: 'Études' },
      { label: 'En situation de handicap', group: 'Situation de santé' },
      { label: 'Inapte au travail', group: 'Situation de santé' },
      { label: 'En situation d’invalidité', group: 'Situation de santé' },
      { label: 'Régime Alsace Moselle', group: 'Régimes particuliers' },
      { label: 'Sans activité / au foyer', group: 'Autres situations' },
      { label: 'Retraité(e)', group: 'Autres situations' },
    ],
  },
  {
    id: 'adult1-situation-accompagnement',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Accompagnement vers l’emploi (adulte 1)',
    prompt:
      '16 bis. Bénéficiez-vous d’un accompagnement vers l’emploi ? Vous pouvez sélectionner plusieurs cas.',
    multiSelectHint: 'Sélectionnez toutes les situations qui correspondent à votre parcours.',
    multiSelectOptions: [
      { label: 'Demandeur d’emploi', group: 'Accompagnement vers l’emploi' },
      { label: 'En CER ou en PPAE', group: 'Accompagnement vers l’emploi' },
      { label: 'Aucun accompagnement', group: 'Accompagnement vers l’emploi' },
    ],
  },
  {
    id: 'adult1-return-to-work-type',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Vous reprenez votre activité en',
    prompt: 'Si vous êtes en reprise d’activité, précisez la forme que prend cette reprise.',
    options: ['Formation', 'CDD', 'CDI', 'Création ou reprise d’entreprise'],
    shouldAsk: isAdult1ReturningToWork,
  },
  {
    id: 'adult1-return-to-work-formation-duration',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Durée de la formation (en mois)',
    prompt: 'Indiquez la durée de votre formation (en nombre de mois).',
    shouldAsk: isAdult1ReturnToWorkFormation,
  },
  {
    id: 'adult1-return-to-work-cdd-duration',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Durée du CDD (en mois)',
    prompt: 'Indiquez la durée prévue de votre CDD (en nombre de mois).',
    shouldAsk: isAdult1ReturnToWorkCdd,
  },
  {
    id: 'adult1-return-to-work-cdi-working-time',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Durée de travail',
    prompt: 'Pour un CDI, précisez votre durée de travail hebdomadaire.',
    options: ['Temps plein', 'Temps partiel d’au moins 15h par semaine'],
    shouldAsk: isAdult1ReturnToWorkCdi,
  },
  {
    id: 'adult1-jobseeker-details',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Demandeur d’emploi – précisions',
    prompt:
      'Date de fin de votre dernier contrat de travail (jj/mm/aaaa). Si vous n’avez jamais eu de contrat de travail, laissez ce champ vide.',
    shouldAsk: isAdult1JobSeeker,
  },
  {
    id: 'adult1-jobseeker-seniority',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Expérience professionnelle (adulte 1)',
    prompt:
      'Avez-vous travaillé au moins 5 ans entre décembre 2013 et décembre 2023 ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: isAdult1JobSeeker,
  },
  {
    id: 'adult1-jobseeker-unemployment-date',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Début d’indemnisation chômage (adulte 1)',
    prompt:
      'Date de début d’indemnisation chômage (jj/mm/aaaa). Si vous ne percevez pas d’allocation chômage, laissez ce champ vide.',
    shouldAsk: isAdult1JobSeeker,
  },
  {
    id: 'adult1-journalist-role',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Vous exercez en tant que',
    prompt: 'Précisez si vous exercez en tant que journaliste, assistant maternel ou assistant familial.',
    options: ['Journaliste', 'Assistant maternel', 'Assistant familial'],
    shouldAsk: isAdult1JournalistGroup,
  },
  {
    id: 'adult1-journalist-months',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Nombre de mois dans cette activité depuis septembre 2024',
    prompt: 'Indiquez le nombre de mois où vous avez exercé cette activité depuis septembre 2024.',
    shouldAsk: isAdult1JournalistGroup,
  },
  {
    id: 'adult1-student-scholarship',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Boursier(ère)',
    prompt: 'En tant qu’étudiant(e), êtes-vous boursier(ère) ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: isAdult1Student,
  },
  {
    id: 'adult1-contract-type',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Type de contrat (adulte 1)',
    prompt:
      '17. Quel est votre type de contrat actuel ? (CDI, CDD, Intérim, Fonction publique, Alternance, Autre).',
    options: [
      'CDI',
      'CDD',
      'Intérim',
      'Fonction publique',
      'Alternance / apprentissage',
      'Travail indépendant',
      'Autre',
      'Non applicable',
    ],
    shouldAsk: (answers) => isAdult1Employee(answers) || isAdult1Independent(answers),
  },
  {
    id: 'adult1-working-time',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Temps de travail (adulte 1)',
    prompt:
      '18. Quel est votre temps de travail ? (Temps plein, Temps partiel, Travail de nuit, Travail saisonnier, Autre).',
    options: [
      'Temps plein',
      'Temps partiel',
      'Travail de nuit',
      'Travail posté / en horaires décalés',
      'Travail saisonnier',
      'Autre',
      'Non applicable',
    ],
    shouldAsk: isAdult1Employee,
  },
  {
    id: 'adult1-contract-dates',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Dates clés du contrat (adulte 1)',
    prompt:
      '19. Disposez-vous de dates importantes à communiquer pour cet emploi ? (Date de début, date de fin, renouvellement, période d’essai).',
    options: [
      'Date de début connue',
      'Date de fin connue',
      'Renouvellement prévu',
      'En période d’essai',
      'Contrat sans date de fin',
      'Non applicable',
    ],
    shouldAsk: isAdult1Employee,
  },
  {
    id: 'adult1-self-employed-status',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Statut d’indépendant (adulte 1)',
    prompt:
      '22. Si vous êtes travailleur indépendant ou auto-entrepreneur, quel est votre statut ? (Micro-entreprise, Profession libérale, Artisan / commerçant, Autre).',
    options: [
      'Micro-entreprise',
      'Profession libérale',
      'Artisan / commerçant',
      'Agriculteur',
      'Autre',
      'Non applicable',
    ],
    shouldAsk: isAdult1Independent,
  },
  {
    id: 'adult1-disability-recognition',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Reconnaissance handicap (adulte 1)',
    prompt:
      '23. Disposez-vous d’une reconnaissance de handicap ? (RQTH, Autre reconnaissance, Demande en cours, Non).',
    options: [
      'Oui, RQTH',
      'Oui, autre reconnaissance',
      'Demande en cours',
      'Non',
      'Non applicable',
    ],
    shouldAsk: isAdult1DisabilitySituation,
  },
  {
    id: 'adult1-disability-rate',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Taux de handicap (adulte 1)',
    prompt:
      '23 bis. Quel est le taux de handicap reconnu pour votre RQTH ? (Moins de 50 %, Entre 50 % et 80 %, Plus de 80 %).',
    options: ['Moins de 50 %', 'Entre 50 % et 80 %', 'Plus de 80 %'],
    shouldAsk: isAdult1Rqth,
  },
  {
    id: 'adult1-disability-restriction',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Restriction substantielle (adulte 1)',
    prompt:
      'Disposez-vous d’une restriction substantielle et durable d’accès à l’emploi reconnue par la CDAPH ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: isAdult1DisabilitySituation,
  },
  {
    id: 'adult1-disability-aah',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Perception de l’AAH (adulte 1)',
    prompt:
      '23 ter. Percevez-vous l’Allocation aux adultes handicapés (AAH) ? (Oui, En cours d’instruction, Non).',
    options: ['Oui', 'En cours d’instruction', 'Non', 'Non applicable'],
    shouldAsk: isAdult1Rqth,
  },
  {
    id: 'adult1-social-aids',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Aides sociales perçues (adulte 1)',
    prompt:
      '24. Percevez-vous d’autres aides sociales liées à votre situation professionnelle ? (Prime d’activité, Aides CAF, Aides régionales, Autre).',
    options: [
      'Prime d’activité',
      'Aides CAF',
      'Aides régionales / départementales',
      'Aides de l’employeur',
      'Autre',
      'Aucune',
      'Non applicable',
    ],
  },
  {
    id: 'adult1-retirement-date',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Date de retraite (adulte 1)',
    prompt:
      '25. Êtes-vous déjà à la retraite ou avez-vous une date de départ prévue ? (Déjà retraité(e), Départ prévu, Pas encore prévu).',
    options: [
      'Déjà retraité(e)',
      'Départ prévu dans l’année',
      'Départ prévu au-delà d’un an',
      'Pas encore prévu',
      'Non applicable',
    ],
  },
  {
    id: 'adult2-intent',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Souhaitez-vous renseigner le conjoint',
    prompt:
      '34. Souhaitez-vous renseigner la situation de votre conjoint(e) ? (Oui / Non / Non applicable).',
    options: ['Oui', 'Non', 'Non applicable'],
    shouldAsk: isCouple,
  },
  {
    id: 'adult2-situation',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Situation actuelle (adulte 2)',
    prompt:
      '35. Si oui, quelles situations s’appliquent à votre conjoint(e) ? Sélectionnez toutes les réponses pertinentes ou « Non applicable » le cas échéant.',
    multiSelectHint:
      'Sélectionnez l’ensemble des situations correspondant à votre conjoint(e) ou « Non applicable » si vous ne souhaitez pas répondre.',
    multiSelectOptions: [
      { label: 'Salarié(e)', group: 'Activité professionnelle' },
      {
        label: 'Travailleur indépendant / auto-entrepreneur',
        group: 'Activité professionnelle',
      },
      { label: 'En reprise d’activité', group: 'Activité professionnelle' },
      { label: 'En congé parental', group: 'Situation familiale' },
      { label: 'Demandeur d’emploi', group: 'Accompagnement vers l’emploi' },
      { label: 'En CER ou en PPAE', group: 'Accompagnement vers l’emploi' },
      {
        label: 'Journaliste, assistant maternel ou familial',
        group: 'Professions spécifiques',
      },
      { label: 'Étudiant(e)', group: 'Études' },
      { label: 'En situation de handicap', group: 'Situation de santé' },
      { label: 'Inapte au travail', group: 'Situation de santé' },
      { label: 'En situation d’invalidité', group: 'Situation de santé' },
      { label: 'Régime Alsace Moselle', group: 'Régimes particuliers' },
      { label: 'Sans activité / au foyer', group: 'Autres situations' },
      { label: 'Retraité(e)', group: 'Autres situations' },
      { label: 'Non applicable', group: 'Autres situations' },
    ],
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-return-to-work-type',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Votre conjoint(e) reprend son activité en',
    prompt: 'Si votre conjoint(e) est en reprise d’activité, précisez la forme que prend cette reprise.',
    options: ['Formation', 'CDD', 'CDI', 'Création ou reprise d’entreprise'],
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2ReturningToWork(answers),
  },
  {
    id: 'adult2-return-to-work-formation-duration',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Durée de la formation (en mois)',
    prompt: 'Indiquez la durée de la formation de votre conjoint(e) (en nombre de mois).',
    shouldAsk: isAdult2ReturnToWorkFormation,
  },
  {
    id: 'adult2-return-to-work-cdd-duration',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Durée du CDD (en mois)',
    prompt: 'Indiquez la durée prévue du CDD de votre conjoint(e) (en nombre de mois).',
    shouldAsk: isAdult2ReturnToWorkCdd,
  },
  {
    id: 'adult2-return-to-work-cdi-working-time',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Durée de travail',
    prompt: 'Pour un CDI, précisez la durée de travail hebdomadaire de votre conjoint(e).',
    options: ['Temps plein', 'Temps partiel d’au moins 15h par semaine'],
    shouldAsk: isAdult2ReturnToWorkCdi,
  },
  {
    id: 'adult2-jobseeker-details',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Demandeur d’emploi – précisions (conjoint)',
    prompt:
      'Date de fin du dernier contrat de travail (jj/mm/aaaa). Si votre conjoint(e) n’a jamais eu de contrat de travail, laissez ce champ vide.',
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2JobSeeker(answers),
  },
  {
    id: 'adult2-jobseeker-seniority',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Expérience professionnelle (conjoint)',
    prompt:
      'Votre conjoint(e) a-t-il(elle) travaillé au moins 5 ans entre décembre 2013 et décembre 2023 ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2JobSeeker(answers),
  },
  {
    id: 'adult2-jobseeker-unemployment-date',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Début d’indemnisation chômage (conjoint)',
    prompt:
      'Date de début d’indemnisation chômage (jj/mm/aaaa). Si aucune allocation chômage n’est perçue, laissez ce champ vide.',
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2JobSeeker(answers),
  },
  {
    id: 'adult2-journalist-role',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Votre conjoint(e) exerce en tant que',
    prompt: 'Votre conjoint(e) exerce-t-il(elle) comme journaliste, assistant maternel ou assistant familial ?',
    options: ['Journaliste', 'Assistant maternel', 'Assistant familial'],
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2JournalistGroup(answers),
  },
  {
    id: 'adult2-journalist-months',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Nombre de mois dans cette activité depuis septembre 2024',
    prompt:
      'Indiquez le nombre de mois où votre conjoint(e) a exercé cette activité depuis septembre 2024.',
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2JournalistGroup(answers),
  },
  {
    id: 'adult2-student-scholarship',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Boursier(ère)',
    prompt: 'Votre conjoint(e) étudiant(e) est-il(elle) boursier(ère) ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2Student(answers),
  },
  {
    id: 'adult2-contract-type',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Type de contrat (adulte 2)',
    prompt:
      '36. Quel est le type de contrat actuel de votre conjoint(e) ? (CDI, CDD, Intérim, Fonction publique, Alternance, Autre). Répondez « Non applicable » si nécessaire.',
    options: [
      'CDI',
      'CDD',
      'Intérim',
      'Fonction publique',
      'Alternance / apprentissage',
      'Travail indépendant',
      'Autre',
      'Non applicable',
    ],
    shouldAsk: (answers) => wantsAdult2Details(answers) && (isAdult2Employee(answers) || isAdult2Independent(answers)),
  },
  {
    id: 'adult2-working-time',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Temps de travail (adulte 2)',
    prompt:
      '37. Quel est le temps de travail de votre conjoint(e) ? (Temps plein, Temps partiel, Travail de nuit, Travail saisonnier, Autre). Répondez « Non applicable » si nécessaire.',
    options: [
      'Temps plein',
      'Temps partiel',
      'Travail de nuit',
      'Travail posté / en horaires décalés',
      'Travail saisonnier',
      'Autre',
      'Non applicable',
    ],
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2Employee(answers),
  },
  {
    id: 'adult2-contract-dates',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Dates clés du contrat (adulte 2)',
    prompt:
      '38. Disposez-vous de dates importantes à communiquer pour le contrat de votre conjoint(e) ? (Date de début, date de fin, renouvellement, période d’essai).',
    options: [
      'Date de début connue',
      'Date de fin connue',
      'Renouvellement prévu',
      'En période d’essai',
      'Contrat sans date de fin',
      'Non applicable',
    ],
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2Employee(answers),
  },
  {
    id: 'adult2-self-employed-status',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Statut d’indépendant (adulte 2)',
    prompt:
      '41. Si votre conjoint(e) est travailleur indépendant ou auto-entrepreneur, quel est son statut ? (Micro-entreprise, Profession libérale, Artisan / commerçant, Autre). Répondez « Non applicable » si nécessaire.',
    options: [
      'Micro-entreprise',
      'Profession libérale',
      'Artisan / commerçant',
      'Agriculteur',
      'Autre',
      'Non applicable',
    ],
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2Independent(answers),
  },
  {
    id: 'adult2-disability-recognition',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Reconnaissance handicap (adulte 2)',
    prompt:
      '42. Votre conjoint(e) dispose-t-il(elle) d’une reconnaissance de handicap ? (RQTH, Autre reconnaissance, Demande en cours, Non).',
    options: [
      'Oui, RQTH',
      'Oui, autre reconnaissance',
      'Demande en cours',
      'Non',
      'Non applicable',
    ],
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2DisabilitySituation(answers),
  },
  {
    id: 'adult2-disability-rate',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Taux de handicap (adulte 2)',
    prompt:
      '42 bis. Quel est le taux de handicap reconnu pour la RQTH de votre conjoint(e) ? (Moins de 50 %, Entre 50 % et 80 %, Plus de 80 %).',
    options: ['Moins de 50 %', 'Entre 50 % et 80 %', 'Plus de 80 %'],
    shouldAsk: wantsAdult2RqthDetails,
  },
  {
    id: 'adult2-disability-restriction',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Restriction substantielle (adulte 2)',
    prompt:
      'Votre conjoint(e) dispose-t-il(elle) d’une restriction substantielle et durable d’accès à l’emploi reconnue par la CDAPH ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: (answers) => wantsAdult2Details(answers) && isAdult2DisabilitySituation(answers),
  },
  {
    id: 'adult2-disability-aah',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Perception de l’AAH (adulte 2)',
    prompt:
      '42 ter. Votre conjoint(e) perçoit-il(elle) l’Allocation aux adultes handicapés (AAH) ? (Oui, En cours d’instruction, Non).',
    options: ['Oui', 'En cours d’instruction', 'Non', 'Non applicable'],
    shouldAsk: wantsAdult2RqthDetails,
  },
  {
    id: 'adult2-social-aids',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Aides sociales perçues (adulte 2)',
    prompt:
      '43. Votre conjoint(e) perçoit-il(elle) d’autres aides sociales liées à sa situation professionnelle ? (Prime d’activité, Aides CAF, Aides régionales, Autre).',
    options: [
      'Prime d’activité',
      'Aides CAF',
      'Aides régionales / départementales',
      'Aides de l’employeur',
      'Autre',
      'Aucune',
      'Non applicable',
    ],
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-retirement-date',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Date de retraite (adulte 2)',
    prompt:
      '44. Votre conjoint(e) est-il(elle) déjà à la retraite ou a-t-il(elle) une date de départ prévue ? (Déjà retraité(e), Départ prévu, Pas encore prévu).',
    options: [
      'Déjà retraité(e)',
      'Départ prévu dans l’année',
      'Départ prévu au-delà d’un an',
      'Pas encore prévu',
      'Non applicable',
    ],
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'pregnancy-info',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Grossesse',
    prompt:
      '45. Pour chaque femme du foyer âgée de 15 à 50 ans (vous et/ou votre conjoint[e]), indiquez si une grossesse est en cours et depuis combien de mois (moins de 3 mois, 3-6 mois, plus de 6 mois). Répondez « Non » ou « Non applicable » si aucune grossesse.',
    options: [
      'Moins de 3 mois',
      '3-6 mois',
      'Plus de 6 mois',
      'Non',
      'Non applicable',
    ],
  },
  {
    id: 'section3-intro',
    type: 'info',
    section: 'Section 3 – Logement',
    prompt: '🔷 SECTION 3 – LOGEMENT',
  },
  {
    id: 'housing-postal-code',
    section: 'Section 3 – Logement',
    label: 'Code postal',
    prompt: '1. Quel est votre code postal de résidence principale ?',
  },
  {
    id: 'housing-city',
    section: 'Section 3 – Logement',
    label: 'Commune',
    prompt: '2. Quelle est la commune correspondante ? (si possible, précisez parmi les communes associées)',
  },
  {
    id: 'housing-status',
    section: 'Section 3 – Logement',
    label: 'Statut d’occupation',
    prompt:
      '3. Quel est votre statut d’occupation ? (Locataire vide, Locataire meublé, Colocation, Logement social, Propriétaire, Hébergé gratuitement, Logement étudiant, Hébergement d’urgence / sans domicile).',
    options: [
      'Locataire vide',
      'Locataire meublé',
      'Colocation',
      'Logement social',
      'Propriétaire',
      'Hébergé gratuitement',
      'Logement étudiant',
      'Hébergement d’urgence / sans domicile',
    ],
  },
  {
    id: 'housing-rent-amount',
    section: 'Section 3 – Logement',
    label: 'Loyer mensuel hors charges',
    prompt:
      '4. Quel est votre loyer mensuel hors charges ? Indiquez le montant en euros ou « Non applicable » si vous ne payez pas de loyer.',
    shouldAsk: isTenantStatus,
  },
  {
    id: 'housing-charges-amount',
    section: 'Section 3 – Logement',
    label: 'Montant des charges mensuelles',
    prompt:
      '5. Quel est le montant mensuel des charges liées au logement (eau, chauffage, copropriété) ? Indiquez le montant en euros ou « Non applicable » si aucune charge.',
    shouldAsk: isTenantStatus,
  },
  {
    id: 'housing-bail-type',
    section: 'Section 3 – Logement',
    label: 'Type de bail',
    prompt: '6. Quel type de bail avez-vous pour ce logement ?',
    options: [
      'Bail classique (3 ou 6 ans)',
      'Bail mobilité',
      'Bail étudiant',
      'Bail précaire / dérogatoire',
      'Je ne sais pas',
      'Non applicable',
    ],
    shouldAsk: isTenantStatus,
  },
  {
    id: 'housing-colocation-structure',
    section: 'Section 3 – Logement',
    label: 'Forme de colocation',
    prompt: '7. Quel est le cadre de votre colocation ?',
    options: [
      'Colocation déclarée (bail commun)',
      'Colocation avec baux individuels',
      'Chambre chez l’habitant',
      'Autre situation de colocation',
      'Non applicable',
    ],
    shouldAsk: isColocationStatus,
  },
  {
    id: 'housing-social-type',
    section: 'Section 3 – Logement',
    label: 'Type de logement social',
    prompt: '8. Pour un logement social, précisez le type de structure.',
    options: [
      'Logement HLM',
      'Logement conventionné',
      'Résidence sociale / foyer',
      'Autre type de logement social',
      'Je ne sais pas',
    ],
    shouldAsk: isSocialHousingStatus,
  },
  {
    id: 'housing-housing-aid',
    section: 'Section 3 – Logement',
    label: 'Aides logement perçues',
    prompt: '9. Percevez-vous une aide au logement ?',
    options: [
      'APL (aide personnalisée au logement)',
      'ALF (allocation de logement familiale)',
      'ALS (allocation de logement sociale)',
      'Autre aide logement',
      'Aucune',
      'Non applicable',
    ],
    shouldAsk: (answers) =>
      isTenantStatus(answers) ||
      isOwnerStatus(answers) ||
      isHostedStatus(answers) ||
      isStudentHousingStatus(answers) ||
      isEmergencyHousingStatus(answers),
  },
  {
    id: 'housing-housing-aid-amount',
    section: 'Section 3 – Logement',
    label: 'Montant des aides logement',
    prompt: '10. Quel est le montant mensuel des aides au logement perçues ? Indiquez le montant en euros.',
    shouldAsk: receivesHousingAid,
  },
  {
    id: 'housing-loan-type',
    section: 'Section 3 – Logement',
    label: 'Type de prêt immobilier',
    prompt: '11. Quel type de prêt immobilier finance votre logement ?',
    options: [
      'Prêt amortissable classique',
      'Prêt à taux zéro (PTZ)',
      'Prêt relais',
      'Aucun prêt en cours',
      'Autre type de prêt',
    ],
    shouldAsk: isOwnerStatus,
  },
  {
    id: 'housing-loan-monthly',
    section: 'Section 3 – Logement',
    label: 'Mensualités de prêt',
    prompt:
      '12. Quel est le montant mensuel de vos remboursements de prêt immobilier ? Indiquez le montant en euros ou « Non applicable » si aucun prêt.',
    shouldAsk: hasMortgagePayments,
  },
  {
    id: 'housing-free-host-type',
    section: 'Section 3 – Logement',
    label: 'Type d’hébergement gratuit',
    prompt: '13. Qui vous héberge gratuitement ?',
    options: [
      'Famille (parents, enfants)',
      'Ami(e)s / proches',
      'Foyer ou association',
      'Autre',
    ],
    shouldAsk: isHostedStatus,
  },
  {
    id: 'housing-free-contribution',
    section: 'Section 3 – Logement',
    label: 'Contribution aux charges',
    prompt:
      '14. Si vous participez aux charges de ce logement gratuit, indiquez le montant mensuel ou précisez « Non ».',
    shouldAsk: isHostedStatus,
  },
  {
    id: 'housing-student-type',
    section: 'Section 3 – Logement',
    label: 'Type de logement étudiant',
    prompt: '15. Quel type de logement étudiant occupez-vous ?',
    options: [
      'Résidence universitaire CROUS',
      'Résidence étudiante privée',
      'Studio / appartement individuel',
      'Chambre en colocation',
      'Autre logement étudiant',
    ],
    shouldAsk: isStudentHousingStatus,
  },
  {
    id: 'housing-emergency-type',
    section: 'Section 3 – Logement',
    label: 'Type d’hébergement d’urgence',
    prompt: '16. Quel type d’hébergement d’urgence utilisez-vous ?',
    options: [
      'Centre d’hébergement d’urgence',
      'Hôtel social',
      'Structure associative',
      'Autre situation d’urgence',
    ],
    shouldAsk: isEmergencyHousingStatus,
  },
  {
    id: 'housing-people',
    section: 'Section 3 – Logement',
    label: 'Personnes dans le logement',
    prompt: '17. Combien de personnes vivent dans ce logement (adultes + enfants, vous compris) ?',
  },
  {
    id: 'housing-charges',
    section: 'Section 3 – Logement',
    label: 'Répartition des charges',
    prompt: '18. Êtes-vous uniquement responsable des charges ou les partagez-vous ?',
    options: ['Je suis seul(e) responsable', 'Les charges sont partagées'],
  },
  {
    id: 'housing-continue',
    section: 'Section 3 – Logement',
    label: 'Continuer vers les revenus',
    prompt: '19. Souhaitez-vous continuer vers les ressources et revenus ? (Oui / Non)',
    options: ['Oui', 'Non'],
  },
  {
    id: 'section4-intro',
    type: 'info',
    section: 'Section 4 – Ressources et revenus',
    prompt: '🔷 SECTION 4 – RESSOURCES ET REVENUS',
  },
  {
    id: 'adult1-income-types',
    section: 'Section 4 – Ressources et revenus',
    label: 'Catégories de revenus (adulte 1)',
    prompt:
      'Sélectionnez les catégories de revenus perçues par l’adulte 1 au cours des 12 derniers mois, puis indiquez les montants correspondants dans les questions suivantes.',
    multiSelectHint: 'Cochez toutes les catégories applicables puis validez.',
    multiSelectOptions: [
      { label: ADULT1_INCOME_LABELS.salary, group: 'Revenus d’activité' },
      { label: ADULT1_INCOME_LABELS.independent, group: 'Revenus d’activité' },
      { label: ADULT1_INCOME_LABELS.unemployment, group: 'Revenus de remplacement' },
      { label: ADULT1_INCOME_LABELS.primeActivity, group: 'Prestations sociales' },
      { label: ADULT1_INCOME_LABELS.rsa, group: 'Prestations sociales' },
      { label: ADULT1_INCOME_LABELS.housingBenefits, group: 'Prestations sociales' },
      { label: ADULT1_INCOME_LABELS.familyAllowances, group: 'Prestations sociales' },
      { label: ADULT1_INCOME_LABELS.aah, group: 'Prestations sociales' },
      { label: ADULT1_INCOME_LABELS.invalidityPension, group: 'Prestations sociales' },
      { label: ADULT1_INCOME_LABELS.pensions, group: 'Pensions et rentes' },
      { label: ADULT1_INCOME_LABELS.other, group: 'Autres ressources' },
    ],
  },
  {
    id: 'salary-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Salaires adulte 1',
    prompt:
      'Pour les salaires perçus par l’adulte 1, précisez le montant net mensuel moyen (sur les 3 derniers mois) et détaillez primes, heures supplémentaires ou indemnités.',
    shouldAsk: (answers) => hasAdult1IncomeSelection(answers, ADULT1_INCOME_LABELS.salary),
  },
  {
    id: 'independent-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Revenus indépendants adulte 1',
    prompt:
      'Pour les revenus d’activité indépendante de l’adulte 1, indiquez le chiffre d’affaires mensuel moyen et le revenu net estimé après charges.',
    shouldAsk: (answers) => hasAdult1IncomeSelection(answers, ADULT1_INCOME_LABELS.independent),
  },
  {
    id: 'unemployment-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Allocation chômage adulte 1',
    prompt:
      'Indiquez le montant mensuel net de l’allocation chômage (ARE) perçue par l’adulte 1 et précisez la période couverte si nécessaire.',
    shouldAsk: (answers) => hasAdult1IncomeSelection(answers, ADULT1_INCOME_LABELS.unemployment),
  },
  {
    id: 'adult1-prime-activity-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant prime d’activité adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour la prime d’activité (adulte 1).',
    shouldAsk: receivesAdult1PrimeActivity,
  },
  {
    id: 'adult1-rsa-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant RSA adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour le RSA (adulte 1).',
    shouldAsk: receivesAdult1Rsa,
  },
  {
    id: 'adult1-housing-benefits-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant aide au logement adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour les aides au logement (adulte 1).',
    shouldAsk: receivesAdult1HousingBenefits,
  },
  {
    id: 'adult1-family-allowances-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant allocations familiales adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour les allocations familiales (adulte 1).',
    shouldAsk: receivesAdult1FamilyAllowances,
  },
  {
    id: 'adult1-aah-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant AAH adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour l’AAH (adulte 1).',
    shouldAsk: receivesAdult1Aah,
  },
  {
    id: 'adult1-invalidity-pension-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant pension d’invalidité adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour la pension d’invalidité (adulte 1).',
    shouldAsk: receivesAdult1InvalidityPension,
  },
  {
    id: 'pensions-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Pensions et rentes adulte 1',
    prompt:
      'Précisez les montants mensuels pour les pensions alimentaires, pensions de retraite ou rentes perçues par l’adulte 1.',
    shouldAsk: (answers) => hasAdult1IncomeSelection(answers, ADULT1_INCOME_LABELS.pensions),
  },
  {
    id: 'other-resources-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Autres ressources adulte 1',
    prompt:
      'Pour les autres ressources de l’adulte 1 (capitaux mobiliers, revenus locatifs, revenus exceptionnels, aides familiales, activités non déclarées), détaillez les montants et leur nature.',
    shouldAsk: (answers) => hasAdult1IncomeSelection(answers, ADULT1_INCOME_LABELS.other),
  },
  {
    id: 'adult2-income-types',
    section: 'Section 4 – Ressources et revenus',
    label: 'Catégories de revenus (adulte 2)',
    prompt:
      'Sélectionnez les catégories de revenus perçues par votre conjoint(e) au cours des 12 derniers mois, puis indiquez les montants correspondants dans les questions suivantes.',
    multiSelectHint: 'Cochez toutes les catégories applicables puis validez.',
    multiSelectOptions: [
      { label: ADULT2_INCOME_LABELS.salary, group: 'Revenus d’activité' },
      { label: ADULT2_INCOME_LABELS.independent, group: 'Revenus d’activité' },
      { label: ADULT2_INCOME_LABELS.unemployment, group: 'Revenus de remplacement' },
      { label: ADULT2_INCOME_LABELS.primeActivity, group: 'Prestations sociales' },
      { label: ADULT2_INCOME_LABELS.rsa, group: 'Prestations sociales' },
      { label: ADULT2_INCOME_LABELS.housingBenefits, group: 'Prestations sociales' },
      { label: ADULT2_INCOME_LABELS.familyAllowances, group: 'Prestations sociales' },
      { label: ADULT2_INCOME_LABELS.aah, group: 'Prestations sociales' },
      { label: ADULT2_INCOME_LABELS.invalidityPension, group: 'Prestations sociales' },
      { label: ADULT2_INCOME_LABELS.pensions, group: 'Pensions et rentes' },
      { label: ADULT2_INCOME_LABELS.other, group: 'Autres ressources' },
    ],
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-salary-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Salaires adulte 2',
    prompt:
      'Pour les salaires perçus par votre conjoint(e), précisez le montant net mensuel moyen (sur les 3 derniers mois) et détaillez primes, heures supplémentaires ou indemnités.',
    shouldAsk: (answers) =>
      wantsAdult2Details(answers) && hasAdult2IncomeSelection(answers, ADULT2_INCOME_LABELS.salary),
  },
  {
    id: 'adult2-independent-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Revenus indépendants adulte 2',
    prompt:
      'Pour les revenus d’activité indépendante de votre conjoint(e), indiquez le chiffre d’affaires mensuel moyen et le revenu net estimé après charges.',
    shouldAsk: (answers) =>
      wantsAdult2Details(answers) && hasAdult2IncomeSelection(answers, ADULT2_INCOME_LABELS.independent),
  },
  {
    id: 'adult2-unemployment-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Allocation chômage adulte 2',
    prompt:
      'Indiquez le montant mensuel net de l’allocation chômage (ARE) perçue par votre conjoint(e) et précisez la période couverte si nécessaire.',
    shouldAsk: (answers) =>
      wantsAdult2Details(answers) && hasAdult2IncomeSelection(answers, ADULT2_INCOME_LABELS.unemployment),
  },
  {
    id: 'adult2-prime-activity-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant prime d’activité adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour la prime d’activité (adulte 2).',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2PrimeActivity(answers),
  },
  {
    id: 'adult2-rsa-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant RSA adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour le RSA (adulte 2).',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2Rsa(answers),
  },
  {
    id: 'adult2-housing-benefits-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant aide au logement adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour les aides au logement (adulte 2).',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2HousingBenefits(answers),
  },
  {
    id: 'adult2-family-allowances-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant allocations familiales adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour les allocations familiales (adulte 2).',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2FamilyAllowances(answers),
  },
  {
    id: 'adult2-aah-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant AAH adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour l’AAH (adulte 2).',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2Aah(answers),
  },
  {
    id: 'adult2-invalidity-pension-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant pension d’invalidité adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour la pension d’invalidité (adulte 2).',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2InvalidityPension(answers),
  },
  {
    id: 'adult2-pensions-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Pensions et rentes adulte 2',
    prompt:
      'Précisez les montants mensuels pour les pensions alimentaires, pensions de retraite ou rentes perçues par votre conjoint(e).',
    shouldAsk: (answers) =>
      wantsAdult2Details(answers) && hasAdult2IncomeSelection(answers, ADULT2_INCOME_LABELS.pensions),
  },
  {
    id: 'adult2-other-resources-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Autres ressources adulte 2',
    prompt:
      'Pour les autres ressources de votre conjoint(e) (capitaux mobiliers, revenus locatifs, revenus exceptionnels, aides familiales, activités non déclarées), détaillez les montants et leur nature.',
    shouldAsk: (answers) =>
      wantsAdult2Details(answers) && hasAdult2IncomeSelection(answers, ADULT2_INCOME_LABELS.other),
  },
  {
    id: 'children-income-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Revenus des enfants',
    prompt:
      '23-25. L’un de vos enfants âgé de 16 ans ou plus perçoit-il un revenu ? Si oui, détaillez pour chaque enfant (type de revenu : job étudiant, apprentissage, stage rémunéré, autre + montant mensuel net) ou indiquez « Non ».',
  },
  {
    id: 'resources-continue',
    section: 'Section 4 – Ressources et revenus',
    label: 'Continuer vers le patrimoine',
    prompt: 'Souhaitez-vous continuer vers la section patrimoine ? (Oui / Non)',
    options: ['Oui', 'Non'],
  },
  {
    id: 'section5-intro',
    type: 'info',
    section: 'Section 5 – Patrimoine',
    prompt: '🔷 SECTION 5 – PATRIMOINE',
  },
  {
    id: 'savings-info',
    section: 'Section 5 – Patrimoine',
    label: 'Épargne et placements',
    prompt:
      '1-3. Disposez-vous d’une épargne ou de placements financiers ? Indiquez le montant total estimé et la part bloquée/imposable le cas échéant.',
  },
  {
    id: 'realestate-ownership',
    section: 'Section 5 – Patrimoine',
    label: 'Propriété immobilière',
    prompt: '4. Êtes-vous propriétaire d’un ou plusieurs biens immobiliers ? (Oui / Non)',
    options: ['Oui', 'Non'],
  },
  {
    id: 'realestate-property-type',
    section: 'Section 5 – Patrimoine',
    label: 'Type de bien possédé',
    prompt:
      '5. Quel(s) type(s) de bien possédez-vous ? Sélectionnez l’option qui correspond le mieux (Résidence principale, Résidence secondaire, Bien locatif, Terrain ou autre).',
    options: [
      'Résidence principale',
      'Résidence secondaire',
      'Bien locatif',
      'Terrain ou autre bien immobilier',
    ],
    shouldAsk: ownsRealEstate,
  },
  {
    id: 'realestate-rental-status',
    section: 'Section 5 – Patrimoine',
    label: 'Bien loué',
    prompt: '6. L’un de vos biens est-il actuellement loué ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: ownsRealEstate,
  },
  {
    id: 'realestate-rent-amount',
    section: 'Section 5 – Patrimoine',
    label: 'Montant du loyer perçu',
    prompt:
      '6 bis. Indiquez le montant mensuel net du loyer perçu pour ce(s) bien(s). Précisez « Non applicable » si aucun loyer.',
    shouldAsk: hasRentedRealEstate,
  },
  {
    id: 'realestate-mortgage',
    section: 'Section 5 – Patrimoine',
    label: 'Prêt immobilier en cours',
    prompt: '7. Avez-vous un prêt immobilier en cours pour ce(s) bien(s) ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: ownsRealEstate,
  },
  {
    id: 'capital-info',
    section: 'Section 5 – Patrimoine',
    label: 'Capitaux récents',
    prompt:
      '8. Disposez-vous d’un capital reçu récemment (héritage, indemnité, donation importante) ? Indiquez le montant et la date approximative ou « Non ».',
  },
  {
    id: 'valuable-assets-info',
    section: 'Section 5 – Patrimoine',
    label: 'Biens de valeur',
    prompt:
      '9. Possédez-vous des biens de valeur importants (œuvre d’art, véhicule de collection, cryptomonnaies significatives, etc.) ? Précisez leur nature et estimation ou indiquez « Non ».',
  },
  {
    id: 'patrimony-sharing-info',
    section: 'Section 5 – Patrimoine',
    label: 'Répartition du patrimoine',
    prompt:
      'Précisez si le patrimoine est commun avec votre conjoint ou s’il existe des biens propres au conjoint. Détaillez le patrimoine propre le cas échéant.',
  },
  {
    id: 'final-choice',
    section: 'Section finale – Récapitulatif et confirmation',
    label: 'Dernier choix',
    prompt:
      'Souhaitez-vous vérifier vos réponses avant de lancer la simulation ou lancer directement le calcul ? (Vérifier mes réponses / Lancer directement la simulation)',
    options: ['Vérifier mes réponses', 'Lancer directement la simulation'],
  },
];
