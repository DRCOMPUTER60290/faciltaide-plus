export type ChatStep = {
  id: string;
  prompt: string;
  section: string;
  label?: string;
  type?: 'info' | 'question';
  options?: string[];
  shouldAsk?: (answers: Record<string, string>) => boolean;
};

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

export const receivesAdult1Unemployment = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult1-unemployment-benefits']).startsWith('oui');

export const receivesAdult2Unemployment = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult2-unemployment-benefits']).startsWith('oui');

export const receivesAdult1PrimeActivity = (answers: Record<string, string>): boolean =>
  isYes(answers['adult1-prime-activity']);

export const receivesAdult1Rsa = (answers: Record<string, string>): boolean => isYes(answers['adult1-rsa']);

export const receivesAdult1HousingBenefits = (answers: Record<string, string>): boolean =>
  isYes(answers['adult1-housing-benefits']);

export const receivesAdult1FamilyAllowances = (answers: Record<string, string>): boolean =>
  isYes(answers['adult1-family-allowances']);

export const receivesAdult1Aah = (answers: Record<string, string>): boolean => isYes(answers['adult1-aah']);

export const receivesAdult1InvalidityPension = (answers: Record<string, string>): boolean =>
  isYes(answers['adult1-invalidity-pension']);

export const receivesAdult2PrimeActivity = (answers: Record<string, string>): boolean =>
  isYes(answers['adult2-prime-activity']);

export const receivesAdult2Rsa = (answers: Record<string, string>): boolean => isYes(answers['adult2-rsa']);

export const receivesAdult2HousingBenefits = (answers: Record<string, string>): boolean =>
  isYes(answers['adult2-housing-benefits']);

export const receivesAdult2FamilyAllowances = (answers: Record<string, string>): boolean =>
  isYes(answers['adult2-family-allowances']);

export const receivesAdult2Aah = (answers: Record<string, string>): boolean => isYes(answers['adult2-aah']);

export const receivesAdult2InvalidityPension = (answers: Record<string, string>): boolean =>
  isYes(answers['adult2-invalidity-pension']);

export const isAdult1Independent = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult1-situation']) === 'travailleur independant / auto-entrepreneur';

export const isAdult2Independent = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult2-situation']) === 'travailleur independant / auto-entrepreneur';

export const isAdult1Rqth = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult1-disability-recognition']).includes('rqth');

export const isAdult2Rqth = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult2-disability-recognition']).includes('rqth');

export const wantsAdult2RqthDetails = (answers: Record<string, string>): boolean =>
  wantsAdult2Details(answers) && isAdult2Rqth(answers);

export const isAdult1Employee = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult1-situation']) === 'salariee';

export const isAdult2Employee = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult2-situation']) === 'salariee';

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
    id: 'adult1-situation',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Situation actuelle (adulte 1)',
    prompt:
      '16. Pour vous (adulte 1), quelle est votre situation actuelle ? (Salarié(e), Travailleur indépendant / auto-entrepreneur, Demandeur d’emploi indemnisé, Demandeur d’emploi non indemnisé, Étudiant(e), En situation de handicap, Sans activité / au foyer, Retraité(e)).',
    options: [
      'Salarié(e)',
      'Travailleur indépendant / auto-entrepreneur',
      'Demandeur d’emploi indemnisé',
      'Demandeur d’emploi non indemnisé',
      'Étudiant(e)',
      'En situation de handicap',
      'Sans activité / au foyer',
      'Retraité(e)',
    ],
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
    id: 'adult1-unemployment-benefits',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Allocations chômage (adulte 1)',
    prompt:
      '20. Percevez-vous des allocations chômage ? (Oui, en cours d’instruction, Non).',
    options: [
      'Oui, indemnisé(e)',
      'Oui, en cours d’instruction',
      'Non',
      'Non applicable',
    ],
  },
  {
    id: 'adult1-unemployment-amount',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Montant allocations chômage (adulte 1)',
    prompt:
      '21. Quel est le montant mensuel des allocations chômage perçues ? Indiquez le montant en euros ou « Non applicable ».',
    shouldAsk: receivesAdult1Unemployment,
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
  },
  {
    id: 'adult1-disability-rate',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Taux de handicap (adulte 1)',
    prompt:
      '23 bis. Quel est le taux de handicap reconnu pour votre RQTH ? (Moins de 50 %, 50 % à 79 %, 80 % et plus).',
    options: ['Moins de 50 %', '50 % à 79 %', '80 % et plus', 'Non communiqué'],
    shouldAsk: isAdult1Rqth,
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
      '35. Si oui, quelle est sa situation actuelle ? (Même liste que pour vous). Répondez « Non applicable » si vous n’êtes pas en couple ou ne souhaitez pas renseigner.',
    options: [
      'Salarié(e)',
      'Travailleur indépendant / auto-entrepreneur',
      'Demandeur d’emploi indemnisé',
      'Demandeur d’emploi non indemnisé',
      'Étudiant(e)',
      'En situation de handicap',
      'Sans activité / au foyer',
      'Retraité(e)',
      'Non applicable',
    ],
    shouldAsk: wantsAdult2Details,
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
    id: 'adult2-unemployment-benefits',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Allocations chômage (adulte 2)',
    prompt:
      '39. Votre conjoint(e) perçoit-il(elle) des allocations chômage ? (Oui, en cours d’instruction, Non).',
    options: [
      'Oui, indemnisé(e)',
      'Oui, en cours d’instruction',
      'Non',
      'Non applicable',
    ],
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-unemployment-amount',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Montant allocations chômage (adulte 2)',
    prompt:
      '40. Quel est le montant mensuel des allocations chômage perçues par votre conjoint(e) ? Indiquez le montant en euros ou « Non applicable ».',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2Unemployment(answers),
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
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-disability-rate',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Taux de handicap (adulte 2)',
    prompt:
      '42 bis. Quel est le taux de handicap reconnu pour la RQTH de votre conjoint(e) ? (Moins de 50 %, 50 % à 79 %, 80 % et plus).',
    options: ['Moins de 50 %', '50 % à 79 %', '80 % et plus', 'Non communiqué'],
    shouldAsk: wantsAdult2RqthDetails,
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
    id: 'salary-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Salaires adulte 1',
    prompt:
      '1-3. Au cours des 12 derniers mois, avez-vous perçu un salaire ? Si oui, indiquez le montant net mensuel moyen (3 derniers mois) et précisez primes/heures supplémentaires/indemnités. Indiquez « Non » si aucun salaire.',
  },
  {
    id: 'independent-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Revenus indépendants adulte 1',
    prompt:
      '4-6. Avez-vous des revenus d’activité indépendante ? Si oui, indiquez le chiffre d’affaires mensuel moyen et le revenu net estimé (après charges).',
  },
  {
    id: 'unemployment-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Allocation chômage adulte 1',
    prompt: '7-8. Percevez-vous une allocation chômage (ARE) ? Si oui, indiquez le montant mensuel net.',
  },
  {
    id: 'adult1-prime-activity',
    section: 'Section 4 – Ressources et revenus',
    label: 'Prime d’activité adulte 1',
    prompt: '9. Percevez-vous la prime d’activité ? (Oui / Non)',
    options: ['Oui', 'Non'],
  },
  {
    id: 'adult1-prime-activity-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant prime d’activité adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour la prime d’activité.',
    shouldAsk: receivesAdult1PrimeActivity,
  },
  {
    id: 'adult1-rsa',
    section: 'Section 4 – Ressources et revenus',
    label: 'RSA adulte 1',
    prompt: '10. Percevez-vous le Revenu de solidarité active (RSA) ? (Oui / Non)',
    options: ['Oui', 'Non'],
  },
  {
    id: 'adult1-rsa-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant RSA adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour le RSA.',
    shouldAsk: receivesAdult1Rsa,
  },
  {
    id: 'adult1-housing-benefits',
    section: 'Section 4 – Ressources et revenus',
    label: 'Aides au logement adulte 1',
    prompt: '11. Percevez-vous une aide au logement ? (Oui / Non)',
    options: ['Oui', 'Non'],
  },
  {
    id: 'adult1-housing-benefits-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant aide au logement adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour l’aide au logement.',
    shouldAsk: receivesAdult1HousingBenefits,
  },
  {
    id: 'adult1-family-allowances',
    section: 'Section 4 – Ressources et revenus',
    label: 'Allocations familiales adulte 1',
    prompt: '12. Percevez-vous des allocations familiales ? (Oui / Non)',
    options: ['Oui', 'Non'],
  },
  {
    id: 'adult1-family-allowances-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant allocations familiales adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour les allocations familiales.',
    shouldAsk: receivesAdult1FamilyAllowances,
  },
  {
    id: 'adult1-aah',
    section: 'Section 4 – Ressources et revenus',
    label: 'AAH adulte 1',
    prompt: '13. Percevez-vous l’Allocation aux adultes handicapés (AAH) ? (Oui / Non)',
    options: ['Oui', 'Non'],
  },
  {
    id: 'adult1-aah-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant AAH adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour l’AAH.',
    shouldAsk: receivesAdult1Aah,
  },
  {
    id: 'adult1-invalidity-pension',
    section: 'Section 4 – Ressources et revenus',
    label: 'Pension d’invalidité adulte 1',
    prompt: '14. Percevez-vous une pension d’invalidité ? (Oui / Non)',
    options: ['Oui', 'Non'],
  },
  {
    id: 'adult1-invalidity-pension-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant pension d’invalidité adulte 1',
    prompt: 'Indiquez le montant mensuel net perçu pour la pension d’invalidité.',
    shouldAsk: receivesAdult1InvalidityPension,
  },
  {
    id: 'pensions-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Pensions et rentes adulte 1',
    prompt:
      '15-17. Percevez-vous une pension alimentaire, une pension de retraite ou une rente/indemnité d’assurance ? Précisez les montants mensuels ou indiquez « Non ».',
  },
  {
    id: 'other-resources-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Autres ressources adulte 1',
    prompt:
      '18-22. Avez-vous des revenus de capitaux mobiliers, des revenus locatifs, des revenus exceptionnels, une aide financière régulière d’un proche ou des activités non déclarées générant un revenu ? Précisez les montants ou indiquez « Non ».',
  },
  {
    id: 'adult2-salary-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Salaires adulte 2',
    prompt:
      '1-3 bis. Concernant votre conjoint(e), a-t-il(elle) perçu un salaire au cours des 12 derniers mois ? Si oui, indiquez le montant net mensuel moyen (3 derniers mois) ainsi que primes/heures supplémentaires/indemnités. Indiquez « Non » si aucun salaire.',
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-independent-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Revenus indépendants adulte 2',
    prompt:
      '4-6 bis. Votre conjoint(e) a-t-il(elle) des revenus d’activité indépendante ? Si oui, indiquez le chiffre d’affaires mensuel moyen et le revenu net estimé (après charges).',
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-unemployment-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Allocation chômage adulte 2',
    prompt:
      '7-8 bis. Votre conjoint(e) perçoit-il(elle) une allocation chômage (ARE) ? Si oui, indiquez le montant mensuel net.',
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-prime-activity',
    section: 'Section 4 – Ressources et revenus',
    label: 'Prime d’activité adulte 2',
    prompt: '9 bis. Votre conjoint(e) perçoit-il(elle) la prime d’activité ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-prime-activity-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant prime d’activité adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour la prime d’activité.',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2PrimeActivity(answers),
  },
  {
    id: 'adult2-rsa',
    section: 'Section 4 – Ressources et revenus',
    label: 'RSA adulte 2',
    prompt: '10 bis. Votre conjoint(e) perçoit-il(elle) le Revenu de solidarité active (RSA) ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-rsa-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant RSA adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour le RSA.',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2Rsa(answers),
  },
  {
    id: 'adult2-housing-benefits',
    section: 'Section 4 – Ressources et revenus',
    label: 'Aides au logement adulte 2',
    prompt: '11 bis. Votre conjoint(e) perçoit-il(elle) une aide au logement ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-housing-benefits-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant aide au logement adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour l’aide au logement.',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2HousingBenefits(answers),
  },
  {
    id: 'adult2-family-allowances',
    section: 'Section 4 – Ressources et revenus',
    label: 'Allocations familiales adulte 2',
    prompt: '12 bis. Votre conjoint(e) perçoit-il(elle) des allocations familiales ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-family-allowances-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant allocations familiales adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour les allocations familiales.',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2FamilyAllowances(answers),
  },
  {
    id: 'adult2-aah',
    section: 'Section 4 – Ressources et revenus',
    label: 'AAH adulte 2',
    prompt: '13 bis. Votre conjoint(e) perçoit-il(elle) l’Allocation aux adultes handicapés (AAH) ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-aah-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant AAH adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour l’AAH.',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2Aah(answers),
  },
  {
    id: 'adult2-invalidity-pension',
    section: 'Section 4 – Ressources et revenus',
    label: 'Pension d’invalidité adulte 2',
    prompt: '14 bis. Votre conjoint(e) perçoit-il(elle) une pension d’invalidité ? (Oui / Non)',
    options: ['Oui', 'Non'],
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-invalidity-pension-amount',
    section: 'Section 4 – Ressources et revenus',
    label: 'Montant pension d’invalidité adulte 2',
    prompt: 'Indiquez le montant mensuel net perçu pour la pension d’invalidité.',
    shouldAsk: (answers) => wantsAdult2Details(answers) && receivesAdult2InvalidityPension(answers),
  },
  {
    id: 'adult2-pensions-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Pensions et rentes adulte 2',
    prompt:
      '15-17 bis. Votre conjoint(e) perçoit-il(elle) une pension alimentaire, une pension de retraite ou une rente/indemnité d’assurance ? Précisez les montants mensuels ou indiquez « Non ».',
    shouldAsk: wantsAdult2Details,
  },
  {
    id: 'adult2-other-resources-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Autres ressources adulte 2',
    prompt:
      '18-22 bis. Votre conjoint(e) dispose-t-il(elle) de revenus de capitaux mobiliers, de revenus locatifs, de revenus exceptionnels, d’une aide financière régulière d’un proche ou d’activités non déclarées générant un revenu ? Précisez les montants ou indiquez « Non ».',
    shouldAsk: wantsAdult2Details,
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
