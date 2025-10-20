import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Share,
  Modal,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Bot, History as HistoryIcon, Sparkles } from 'lucide-react-native';
import Constants from 'expo-constants';

import { buildSimulationPayload, extractRawJson } from '@/lib/simulation';
import type { ApiSimulationResponse } from '@/lib/simulation';
import {
  HttpError,
  JsonParseError,
  isAbortError,
  isNetworkError,
  postJson,
} from '@/lib/http';
import {
  loadSimulationHistory,
  saveSimulationToHistory,
  MAX_HISTORY_ENTRIES,
} from '@/lib/history';
import type { SimulationHistoryEntry } from '@/types/simulation';

type ChatMessage = {
  id: string;
  role: 'bot' | 'user';
  text: string;
};

type ChatStep = {
  id: string;
  prompt: string;
  section: string;
  label?: string;
  type?: 'info' | 'question';
  options?: string[];
  shouldAsk?: (answers: Record<string, string>) => boolean;
};

const calculateAge = (birthDate: Date, referenceDate: Date = new Date()): number => {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDifference = referenceDate.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age < 0 ? 0 : age;
};

const toComparable = (value?: string): string =>
  (value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2019']/g, '')
    .replace(/[()]/g, '')
    .toLowerCase();

const formatPersonName = (value?: string): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed.length) {
    return null;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const isYes = (value?: string): boolean => toComparable(value) === 'oui';

const isCouple = (answers: Record<string, string>): boolean =>
  toComparable(answers['living-arrangement']) === 'en couple';

const wantsAdult2Details = (answers: Record<string, string>): boolean =>
  isCouple(answers) && toComparable(answers['adult2-intent']) === 'oui';

const hasDependents = (answers: Record<string, string>): boolean => isYes(answers['dependents-any']);

const receivesAdult1Unemployment = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult1-unemployment-benefits']).startsWith('oui');

const receivesAdult2Unemployment = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult2-unemployment-benefits']).startsWith('oui');

const receivesAdult1PrimeActivity = (answers: Record<string, string>): boolean =>
  isYes(answers['adult1-prime-activity']);

const receivesAdult1Rsa = (answers: Record<string, string>): boolean => isYes(answers['adult1-rsa']);

const receivesAdult1HousingBenefits = (answers: Record<string, string>): boolean =>
  isYes(answers['adult1-housing-benefits']);

const receivesAdult1FamilyAllowances = (answers: Record<string, string>): boolean =>
  isYes(answers['adult1-family-allowances']);

const receivesAdult1Aah = (answers: Record<string, string>): boolean => isYes(answers['adult1-aah']);

const receivesAdult1InvalidityPension = (answers: Record<string, string>): boolean =>
  isYes(answers['adult1-invalidity-pension']);

const receivesAdult2PrimeActivity = (answers: Record<string, string>): boolean =>
  isYes(answers['adult2-prime-activity']);

const receivesAdult2Rsa = (answers: Record<string, string>): boolean => isYes(answers['adult2-rsa']);

const receivesAdult2HousingBenefits = (answers: Record<string, string>): boolean =>
  isYes(answers['adult2-housing-benefits']);

const receivesAdult2FamilyAllowances = (answers: Record<string, string>): boolean =>
  isYes(answers['adult2-family-allowances']);

const receivesAdult2Aah = (answers: Record<string, string>): boolean => isYes(answers['adult2-aah']);

const receivesAdult2InvalidityPension = (answers: Record<string, string>): boolean =>
  isYes(answers['adult2-invalidity-pension']);

const isAdult1Independent = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult1-situation']) === 'travailleur independant / auto-entrepreneur';

const isAdult2Independent = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult2-situation']) === 'travailleur independant / auto-entrepreneur';

const isAdult1Rqth = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult1-disability-recognition']).includes('rqth');

const isAdult2Rqth = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult2-disability-recognition']).includes('rqth');

const wantsAdult2RqthDetails = (answers: Record<string, string>): boolean =>
  wantsAdult2Details(answers) && isAdult2Rqth(answers);

const isAdult1Employee = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult1-situation']) === 'salariee';

const isAdult2Employee = (answers: Record<string, string>): boolean =>
  toComparable(answers['adult2-situation']) === 'salariee';

const tenantStatuses = new Set([
  'locataire vide',
  'locataire meuble',
  'colocation',
  'logement social',
  'logement etudiant',
]);

const isTenantStatus = (answers: Record<string, string>): boolean =>
  tenantStatuses.has(toComparable(answers['housing-status']));

const isColocationStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'colocation';

const isSocialHousingStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'logement social';

const isOwnerStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'proprietaire';

const isHostedStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'heberge gratuitement';

const isStudentHousingStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'logement etudiant';

const isEmergencyHousingStatus = (answers: Record<string, string>): boolean =>
  toComparable(answers['housing-status']) === 'hebergement durgence / sans domicile';

const receivesHousingAid = (answers: Record<string, string>): boolean => {
  const normalized = toComparable(answers['housing-housing-aid']);
  return Boolean(normalized.length) && normalized !== 'aucune' && normalized !== 'non applicable';
};

const hasMortgagePayments = (answers: Record<string, string>): boolean =>
  isOwnerStatus(answers) && toComparable(answers['housing-loan-type']) !== 'aucun pret en cours';

const ownsRealEstate = (answers: Record<string, string>): boolean =>
  isYes(answers['realestate-ownership']);

const hasRentedRealEstate = (answers: Record<string, string>): boolean =>
  ownsRealEstate(answers) && isYes(answers['realestate-rental-status']);

const CHAT_PLAN_STEPS: ChatStep[] = [
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
    shouldAsk: (answers) =>
      wantsAdult2Details(answers) && (isAdult2Employee(answers) || isAdult2Independent(answers)),
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
    prompt: 'Indiquez le montant mensuel net perçu par votre conjoint(e) pour la prime d’activité.',
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
    prompt: 'Indiquez le montant mensuel net perçu par votre conjoint(e) pour le RSA.',
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
    prompt: 'Indiquez le montant mensuel net perçu par votre conjoint(e) pour l’aide au logement.',
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
    prompt: 'Indiquez le montant mensuel net perçu par votre conjoint(e) pour les allocations familiales.',
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
    prompt: 'Indiquez le montant mensuel net perçu par votre conjoint(e) pour l’AAH.',
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
    prompt: 'Indiquez le montant mensuel net perçu par votre conjoint(e) pour la pension d’invalidité.',
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

const formatHistoryDate = (isoString: string): string => {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return 'Date inconnue';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} à ${hours}h${minutes}`;
};

export default function ChatScreen() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGuidedAssistant, setShowGuidedAssistant] = useState(false);

  const [guidedAnswers, setGuidedAnswers] = useState<Record<string, string>>({});
  const [postalCodeCities, setPostalCodeCities] = useState<string[]>([]);
  const [lastPostalCodeLookup, setLastPostalCodeLookup] = useState<string>('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentChatStep, setCurrentChatStep] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatFinished, setIsChatFinished] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [pendingBirthDate, setPendingBirthDate] = useState<Date | null>(null);

  const chatScrollRef = useRef<ScrollView | null>(null);

  const chatSteps = useMemo(() => CHAT_PLAN_STEPS, []);
  const activeChatStep = chatSteps[currentChatStep] ?? null;
  const activeChatOptions = useMemo(() => {
    if (!activeChatStep) {
      return [] as string[];
    }

    if (activeChatStep.id === 'housing-city' && postalCodeCities.length > 0) {
      return postalCodeCities;
    }

    return activeChatStep.options ?? [];
  }, [activeChatStep, postalCodeCities]);

  const replaceAdultPlaceholders = useCallback(
    (text: string, answers: Record<string, string>): string => {
      if (!text) {
        return text;
      }

      let result = text;
      const primaryName = formatPersonName(answers['primary-first-name']);
      const spouseName = formatPersonName(answers['spouse-first-name']);

      if (primaryName) {
        result = result.replace(/adulte 1/gi, primaryName);
      }

      if (spouseName) {
        result = result.replace(/adulte 2/gi, spouseName);
      }

      return result;
    },
    [],
  );

  const getStepPrompt = useCallback(
    (step: ChatStep, answers: Record<string, string>): string =>
      replaceAdultPlaceholders(step.prompt, answers),
    [replaceAdultPlaceholders],
  );

  const getStepLabel = useCallback(
    (step: ChatStep, answers: Record<string, string>): string =>
      replaceAdultPlaceholders(step.label ?? step.prompt, answers),
    [replaceAdultPlaceholders],
  );

  const shouldDisplayStep = useCallback((step: ChatStep, answers: Record<string, string>): boolean => {
    if (step.shouldAsk) {
      try {
        return step.shouldAsk(answers);
      } catch (err) {
        console.warn('Évaluation conditionnelle impossible pour', step.id, err);
        return false;
      }
    }

    return true;
  }, []);

  const minimumBirthDate = useMemo(() => new Date(1900, 0, 1), []);
  const maximumBirthDate = useMemo(() => new Date(), []);
  const defaultBirthDate = useMemo(() => {
    const today = new Date();
    return new Date(today.getFullYear() - 30, today.getMonth(), today.getDate());
  }, []);

  const isBirthDateQuestion = useMemo(() => {
    if (!activeChatStep || activeChatStep.type === 'info') {
      return false;
    }

    const normalizedText = `${activeChatStep.label ?? ''} ${activeChatStep.prompt}`.toLowerCase();
    return activeChatStep.id.includes('birth-date') || normalizedText.includes('date de naissance');
  }, [activeChatStep]);

  const parseBirthDateInput = useCallback((value: string): Date | null => {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) {
      return null;
    }

    const day = Number.parseInt(match[1], 10);
    const month = Number.parseInt(match[2], 10) - 1;
    const year = Number.parseInt(match[3], 10);

    const candidate = new Date(year, month, day);
    if (
      candidate.getFullYear() !== year ||
      candidate.getMonth() !== month ||
      candidate.getDate() !== day
    ) {
      return null;
    }

    return candidate;
  }, []);

  const formatBirthDate = useCallback((date: Date): string => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }, []);

  const handleBirthDateSelected = useCallback(
    (date: Date) => {
      const clampedTime = Math.min(
        Math.max(date.getTime(), minimumBirthDate.getTime()),
        maximumBirthDate.getTime(),
      );
      const clampedDate = new Date(clampedTime);
      setChatInput(formatBirthDate(clampedDate));
      setChatError(null);
    },
    [formatBirthDate, maximumBirthDate, minimumBirthDate],
  );

  const handleDatePickerChange = useCallback(
    (_event: DateTimePickerEvent, selectedDate?: Date) => {
      if (Platform.OS === 'ios') {
        if (selectedDate) {
          setPendingBirthDate(selectedDate);
        }
      }
    },
    [],
  );

  const handleDatePickerCancel = useCallback(() => {
    setIsDatePickerVisible(false);
  }, []);

  const handleDatePickerConfirm = useCallback(() => {
    if (pendingBirthDate) {
      handleBirthDateSelected(pendingBirthDate);
    }
    setIsDatePickerVisible(false);
  }, [handleBirthDateSelected, pendingBirthDate]);

  const handleOpenBirthDatePicker = useCallback(() => {
    if (!isBirthDateQuestion) {
      return;
    }

    const initialDate = parseBirthDateInput(chatInput) ?? pendingBirthDate ?? defaultBirthDate;

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initialDate,
        mode: 'date',
        display: 'calendar',
        maximumDate: maximumBirthDate,
        minimumDate: minimumBirthDate,
        onChange: (event: DateTimePickerEvent, selectedDate?: Date) => {
          if (event.type === 'set' && selectedDate) {
            handleBirthDateSelected(selectedDate);
          }
        },
      });
      return;
    }

    if (Platform.OS === 'ios') {
      setPendingBirthDate(initialDate);
      setIsDatePickerVisible(true);
    }
  }, [
    chatInput,
    defaultBirthDate,
    handleBirthDateSelected,
    isBirthDateQuestion,
    maximumBirthDate,
    minimumBirthDate,
    parseBirthDateInput,
    pendingBirthDate,
  ]);

  useEffect(() => {
    if (!isBirthDateQuestion) {
      setIsDatePickerVisible(false);
      setPendingBirthDate(null);
    }
  }, [isBirthDateQuestion]);

  const fetchCitiesForPostalCode = useCallback(
    async (postalCode: string) => {
      const sanitized = postalCode.replace(/\s+/g, '');

      if (!/^\d{5}$/.test(sanitized)) {
        setPostalCodeCities([]);
        setLastPostalCodeLookup('');
        return;
      }

      if (sanitized === lastPostalCodeLookup) {
        return;
      }

      setLastPostalCodeLookup(sanitized);

      try {
        const response = await fetch(
          `https://geo.api.gouv.fr/communes?codePostal=${sanitized}&fields=nom&format=json&geometry=centre`,
        );

        if (!response.ok) {
          throw new Error(`status ${response.status}`);
        }

        const payload = (await response.json()) as Array<{ nom?: string }>;
        const cityNames = payload
          .map((item) => item.nom?.trim())
          .filter((name): name is string => Boolean(name && name.length))
          .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

        setPostalCodeCities(cityNames);

        setChatMessages((current) => [
          ...current,
          {
            id: `bot-postal-${Date.now()}`,
            role: 'bot',
            text:
              cityNames.length > 0
                ? `Communes correspondantes pour ${sanitized} : ${cityNames.join(', ')}. Sélectionnez la commune correspondante ci-dessous.`
                : `Aucune commune trouvée pour le code postal ${sanitized}.`,
          },
        ]);
      } catch (postalLookupError) {
        console.warn('Recherche de communes impossible', postalLookupError);
        setPostalCodeCities([]);
        setChatMessages((current) => [
          ...current,
          {
            id: `bot-postal-error-${Date.now()}`,
            role: 'bot',
            text:
              "Impossible de récupérer les communes associées à ce code postal pour le moment. Vous pouvez saisir la commune manuellement.",
          },
        ]);
      }
    },
    [lastPostalCodeLookup],
  );

  const appendNextPrompts = useCallback(
    (
      baseMessages: ChatMessage[],
      startIndex: number,
      answersOverride?: Record<string, string>,
    ) => {
      const messages = [...baseMessages];
      let index = startIndex;
      const answers = answersOverride ?? guidedAnswers;

      while (index < chatSteps.length) {
        const step = chatSteps[index];

        if (!shouldDisplayStep(step, answers)) {
          index += 1;
          continue;
        }

        const promptText = getStepPrompt(step, answers);

        messages.push({
          id: `bot-${step.id}-${index}-${messages.length}`,
          role: 'bot',
          text: promptText,
        });

        if (step.type !== 'info') {
          return { messages, nextIndex: index, finished: false } as const;
        }

        index += 1;
      }

      return { messages, nextIndex: chatSteps.length, finished: true } as const;
    },
    [chatSteps, getStepPrompt, guidedAnswers, shouldDisplayStep],
  );

  const resetChatAnswers = useCallback(() => {
    setGuidedAnswers({});
    setPostalCodeCities([]);
    setLastPostalCodeLookup('');
  }, []);

  const startChat = useCallback(() => {
    resetChatAnswers();
    if (chatSteps.length === 0) {
      return;
    }

    const introMessages: ChatMessage[] = [
      {
        id: 'bot-intro',
        role: 'bot',
        text:
          'Bonjour ! Je vais vous poser une série de questions structurées pour constituer la trame complète de votre simulation.',
      },
    ];

    const { messages, nextIndex, finished } = appendNextPrompts(introMessages, 0, {});

    setChatMessages(messages);
    setCurrentChatStep(nextIndex);
    setChatInput('');
    setChatError(null);
    setIsChatFinished(finished);
  }, [appendNextPrompts, chatSteps.length, resetChatAnswers]);

  useEffect(() => {
    if (showGuidedAssistant && chatMessages.length === 0) {
      startChat();
    }
  }, [showGuidedAssistant, chatMessages.length, startChat]);

  useEffect(() => {
    if (!chatScrollRef.current) {
      return;
    }

    chatScrollRef.current.scrollToEnd({ animated: true });
  }, [chatMessages]);

  const { generateEndpoint, simulateEndpoint } = useMemo(() => {
    const defaultBaseUrl = 'https://facilaide-plus-backend.onrender.com';
    const configBaseUrl =
      (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
      process.env.EXPO_PUBLIC_API_BASE_URL ??
      defaultBaseUrl;

    const normalizedBaseUrl = configBaseUrl.replace(/\/+$/, '');

    return {
      baseUrl: normalizedBaseUrl,
      generateEndpoint: `${normalizedBaseUrl}/api/generate-json`,
      simulateEndpoint: `${normalizedBaseUrl}/api/simulate`,
    } as const;
  }, []);

  const [historyEntries, setHistoryEntries] = useState<SimulationHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const entries = await loadSimulationHistory();
      setHistoryEntries(entries);
      setHistoryError(null);
    } catch (historyLoadError) {
      console.warn("Erreur lors du chargement de l'historique", historyLoadError);
      setHistoryError("Impossible de charger l'historique des simulations.");
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      const load = async () => {
        setIsHistoryLoading(true);
        try {
          const entries = await loadSimulationHistory();
          if (isActive) {
            setHistoryEntries(entries);
            setHistoryError(null);
          }
        } catch (historyLoadError) {
          console.warn("Erreur lors du chargement de l'historique", historyLoadError);
          if (isActive) {
            setHistoryError("Impossible de charger l'historique des simulations.");
          }
        } finally {
          if (isActive) {
            setIsHistoryLoading(false);
          }
        }
      };

      load();

      return () => {
        isActive = false;
      };
    }, []),
  );

  const guidedSummary = useMemo(() => {
    if (!Object.keys(guidedAnswers).length) {
      return '';
    }

    const sectionLines = new Map<string, string[]>();

    chatSteps.forEach((step) => {
      if (step.type === 'info') {
        return;
      }

      if (!shouldDisplayStep(step, guidedAnswers)) {
        return;
      }

      const answer = guidedAnswers[step.id];
      if (!answer || !answer.trim().length) {
        return;
      }

      const label = getStepLabel(step, guidedAnswers);
      const lines = sectionLines.get(step.section) ?? [];
      lines.push(`${label}: ${answer.trim()}`);
      sectionLines.set(step.section, lines);
    });

    return Array.from(sectionLines.entries())
      .map(([sectionTitle, lines]) => `${sectionTitle}\n${lines.map((line) => `• ${line}`).join('\n')}`)
      .join('\n\n');
  }, [chatSteps, getStepLabel, guidedAnswers, shouldDisplayStep]);

  const handleApplyGuidedSummary = useCallback(() => {
    if (!guidedSummary.trim().length) {
      return;
    }

    setMessage(guidedSummary.trim());
  }, [guidedSummary]);

  const handleChatSubmit = useCallback(
    (answerOverride?: string) => {
      if (isChatFinished) {
        return;
      }

      const step = chatSteps[currentChatStep];
      if (!step || step.type === 'info') {
        return;
      }

      const rawAnswer = (answerOverride ?? chatInput).trim();
      if (!rawAnswer.length) {
        setChatError('Veuillez saisir une réponse.');
        return;
      }

      const isBirthDateStep =
        step.id.includes('birth-date') ||
        `${step.label ?? ''} ${step.prompt}`.toLowerCase().includes('date de naissance');

      let normalizedAnswer = rawAnswer;
      const additionalMessages: ChatMessage[] = [];

      if (isBirthDateStep) {
        const parsedBirthDate = parseBirthDateInput(rawAnswer);
        if (!parsedBirthDate) {
          setChatError('Veuillez saisir une date valide au format JJ/MM/AAAA.');
          return;
        }

        if (
          parsedBirthDate.getTime() < minimumBirthDate.getTime() ||
          parsedBirthDate.getTime() > maximumBirthDate.getTime()
        ) {
          setChatError(
            `Veuillez saisir une date comprise entre ${formatBirthDate(minimumBirthDate)} et ${formatBirthDate(maximumBirthDate)}.`,
          );
          return;
        }

        normalizedAnswer = formatBirthDate(parsedBirthDate);
        const age = calculateAge(parsedBirthDate, new Date());
        const ageLabel = age > 1 ? 'ans' : 'an';

        additionalMessages.push({
          id: `bot-age-${Date.now()}-${currentChatStep}`,
          role: 'bot',
          text: `Âge calculé : ${age} ${ageLabel}.`,
        });
      }

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}-${currentChatStep}`,
        role: 'user',
        text: normalizedAnswer,
      };
      const messagesAfterReply = [...chatMessages, userMessage, ...additionalMessages];

      setChatError(null);

      const answersWithCurrent = {
        ...guidedAnswers,
        [step.id]: normalizedAnswer,
      };

      setGuidedAnswers(answersWithCurrent);

      const { messages, nextIndex, finished } = appendNextPrompts(
        messagesAfterReply,
        currentChatStep + 1,
        answersWithCurrent,
      );

      const finalMessages: ChatMessage[] = finished
        ? [
            ...messages,
            {
              id: `bot-finish-${Date.now()}`,
              role: 'bot',
              text:
                'Merci pour toutes ces précisions. Consultez le résumé généré ci-dessous puis cliquez sur « Utiliser ce résumé ».',
            },
          ]
        : messages;

      setChatMessages(finalMessages);
      setCurrentChatStep(nextIndex);
      setChatInput('');
      setIsChatFinished(finished);

      if (step.id === 'housing-postal-code') {
        void fetchCitiesForPostalCode(normalizedAnswer);
      }
    },
    [
      appendNextPrompts,
      chatInput,
      chatMessages,
      chatSteps,
      currentChatStep,
      formatBirthDate,
      guidedAnswers,
      isChatFinished,
      fetchCitiesForPostalCode,
      maximumBirthDate,
      minimumBirthDate,
      parseBirthDateInput,
    ],
  );

  const handleOptionSelect = useCallback(
    (option: string) => {
      if (isChatFinished) {
        return;
      }

      setChatInput(option);
      handleChatSubmit(option);
    },
    [handleChatSubmit, isChatFinished],
  );

  const handleChatRestart = useCallback(() => {
    startChat();
  }, [startChat]);

  const handleShareHistory = useCallback(() => {
    if (!historyEntries.length) {
      return;
    }

    const latest = historyEntries[0];
    const benefitsPreview = latest.results.availableBenefits
      .slice(0, 3)
      .map(
        (benefit) =>
          `• ${benefit.label} (${benefit.period}) : ${benefit.amount.toLocaleString('fr-FR', {
            minimumFractionDigits: 0,
          })} €`,
      )
      .join('\n');

    const summary = [
      'Dernière simulation FacilAide+',
      `Saisie utilisateur : ${latest.message}`,
      benefitsPreview,
    ]
      .filter(Boolean)
      .join('\n\n');

    Share.share({
      title: 'Simulation FacilAide+',
      message: summary,
    }).catch((shareError) => {
      console.warn('Partage impossible', shareError);
    });
  }, [historyEntries]);

  const handleSimulate = async () => {
    if (!message.trim()) {
      setError('Veuillez décrire votre situation');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const requestTimeoutMs = 5 * 60 * 1000;

      const generateResponse = await postJson<unknown>(
        generateEndpoint,
        { message: message.trim() },
        { timeoutMs: requestTimeoutMs }
      );

      const rawJson = extractRawJson(generateResponse);

      if (!rawJson) {
        const parseError = new Error(
          "La génération de la situation a échoué. Réessayez dans quelques instants."
        );
        (parseError as Error & { isUserFacing?: boolean }).isUserFacing = true;
        throw parseError;
      }

      const openFiscaPayload = { json: rawJson } as const;

      const simulateResponse = await postJson<ApiSimulationResponse>(
        simulateEndpoint,
        openFiscaPayload,
        { timeoutMs: requestTimeoutMs }
      );

      const simulationPayload = buildSimulationPayload(
        (simulateResponse ?? {}) as ApiSimulationResponse,
        rawJson
      );

      let serializedResults = '';
      try {
        serializedResults = JSON.stringify(simulationPayload);
      } catch (serializationError) {
        console.error('Erreur lors de la sérialisation des résultats:', serializationError);
        const userError = new Error(
          'La simulation a réussi mais les résultats sont trop volumineux pour être affichés.'
        );
        (userError as Error & { isUserFacing?: boolean }).isUserFacing = true;
        throw userError;
      }

      await saveSimulationToHistory({
        message: message.trim(),
        results: simulationPayload,
      });

      refreshHistory().catch((historyRefreshError) => {
        console.warn("Impossible de rafraîchir l'historique", historyRefreshError);
      });

      router.push({
        pathname: '/(tabs)/result',
        params: { results: serializedResults },
      });
    } catch (err: unknown) {
      console.error('Error during simulation:', err);

      if (isAbortError(err)) {
        setError('La requête a pris trop de temps. Veuillez réessayer.');
        return;
      }

      if (isNetworkError(err)) {
        setError(
          [
            'Impossible de contacter le serveur.',
            "Vérifiez votre connexion et que l'API Render est bien démarrée en ouvrant https://facilaide-plus-backend.onrender.com dans un navigateur.",
          ].join(' ')
        );
        return;
      }

      if (err instanceof HttpError) {
        if (
          [502, 503, 504, 522, 524].includes(err.status) ||
          err.body.toLowerCase().includes('render')
        ) {
          setError(
            [
              'Le serveur met un peu de temps à se réveiller.',
              'Patientez quelques secondes puis relancez la simulation.',
            ].join(' '),
          );
          return;
        }

        if (err.status === 429) {
          setError('Trop de demandes successives. Réessayez dans une minute.');
          return;
        }

        const serverMessage = (() => {
          if (err.body && err.body.trim().length) {
            return err.body.trim();
          }
          if (err.statusText && err.statusText.trim().length) {
            return err.statusText.trim();
          }
          return `code ${err.status}`;
        })();

        setError(`Erreur du serveur (${err.status}) : ${serverMessage}`);
        return;
      }

      if (err instanceof JsonParseError) {
        setError(err.message);
        return;
      }

      if (err instanceof Error) {
        if ((err as Error & { isUserFacing?: boolean }).isUserFacing) {
          setError(err.message);
        } else {
          setError('Une erreur est survenue. Veuillez réessayer.');
        }
        return;
      }

      setError('Une erreur est survenue. Veuillez réessayer.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Bot size={48} color="#4ba3c3" />
          <Text style={styles.title}>FacilAide+</Text>
          <Text style={styles.subtitle}>
            Simulez vos aides sociales en quelques mots
          </Text>
        </View>

        <View style={styles.content}>
          <View style={styles.guidedSection}>
            <TouchableOpacity
              style={styles.guidedToggle}
              onPress={() => setShowGuidedAssistant((previous) => !previous)}>
              <View style={styles.guidedToggleHeader}>
                <Sparkles size={20} color="#4ba3c3" />
                <Text style={styles.guidedToggleTitle}>Assistant conversationnel</Text>
              </View>
              <Text style={styles.guidedToggleSubtitle}>
                Répondez au chatbot pour collecter toutes les informations nécessaires à la simulation OpenFisca.
              </Text>
            </TouchableOpacity>

            {showGuidedAssistant && (
              <View style={styles.guidedContent}>
                <View style={styles.chatContainer}>
                  <ScrollView
                    ref={chatScrollRef}
                    style={styles.chatMessages}
                    contentContainerStyle={styles.chatMessagesContainer}
                    keyboardShouldPersistTaps="handled">
                    {chatMessages.map((chatMessage) => (
                      <View
                        key={chatMessage.id}
                        style={[
                          styles.chatBubble,
                          chatMessage.role === 'bot'
                            ? styles.chatBubbleBot
                            : styles.chatBubbleUser,
                        ]}>
                        <Text
                          style={[
                            styles.chatBubbleText,
                            chatMessage.role === 'bot'
                              ? styles.chatBubbleTextBot
                              : styles.chatBubbleTextUser,
                          ]}>
                          {chatMessage.text}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>

                  {activeChatOptions.length > 0 && (
                    <View style={styles.chatOptionsContainer}>
                      {activeChatOptions.map((option) => {
                        const isSelected = chatInput.trim() === option;
                        return (
                          <TouchableOpacity
                            key={option}
                            style={[
                              styles.chatOptionButton,
                              isSelected && styles.chatOptionButtonSelected,
                              isChatFinished && styles.chatOptionButtonDisabled,
                            ]}
                            onPress={() => handleOptionSelect(option)}
                            disabled={isChatFinished}>
                            <Text
                              style={[
                                styles.chatOptionButtonText,
                                isSelected && styles.chatOptionButtonTextSelected,
                              ]}>
                              {option}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <View style={styles.chatInputRow}>
                    <TextInput
                      style={styles.chatInput}
                      placeholder={isChatFinished ? 'Relancez le chatbot pour modifier les réponses' : 'Votre réponse...'}
                      value={chatInput}
                      onChangeText={setChatInput}
                      editable={!isChatFinished}
                      multiline
                      numberOfLines={2}
                    />
                    <TouchableOpacity
                      style={[
                        styles.chatSendButton,
                        (isChatFinished || !chatInput.trim().length) && styles.chatSendButtonDisabled,
                      ]}
                      onPress={() => handleChatSubmit()}
                      disabled={isChatFinished || !chatInput.trim().length}>
                      <Text style={styles.chatSendButtonText}>Envoyer</Text>
                    </TouchableOpacity>
                  </View>

                  {isBirthDateQuestion && Platform.OS !== 'web' && (
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={handleOpenBirthDatePicker}
                      activeOpacity={0.85}>
                      <Text style={styles.datePickerButtonText}>Sélectionner dans le calendrier</Text>
                    </TouchableOpacity>
                  )}

                  {chatError && <Text style={styles.chatError}>{chatError}</Text>}

                  <View style={styles.chatActions}>
                    <TouchableOpacity
                      style={styles.chatActionButton}
                      onPress={handleChatRestart}>
                      <Text style={styles.chatActionButtonText}>Relancer le chatbot</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.chatActionButtonPrimary,
                        !guidedSummary.trim().length && styles.chatActionButtonPrimaryDisabled,
                      ]}
                      onPress={handleApplyGuidedSummary}
                      disabled={!guidedSummary.trim().length}>
                      <Text style={styles.chatActionButtonPrimaryText}>Utiliser ce résumé</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.guidedPreviewBox}>
                    <Text style={styles.guidedPreviewTitle}>Aperçu généré</Text>
                    <Text style={styles.guidedPreviewText}>
                      {guidedSummary.trim().length
                        ? guidedSummary
                        : 'Répondez aux questions pour générer automatiquement un résumé complet.'}
                    </Text>
                </View>

                {Platform.OS === 'ios' && (
                  <Modal
                    transparent
                    animationType="fade"
                    visible={isDatePickerVisible}
                    onRequestClose={handleDatePickerCancel}>
                    <View style={styles.datePickerModalBackdrop}>
                      <View style={styles.datePickerModalContent}>
                        <Text style={styles.datePickerModalTitle}>Sélectionnez une date de naissance</Text>
                        <DateTimePicker
                          value={pendingBirthDate ?? parseBirthDateInput(chatInput) ?? defaultBirthDate}
                          mode="date"
                          display="spinner"
                          locale="fr-FR"
                          maximumDate={maximumBirthDate}
                          minimumDate={minimumBirthDate}
                          onChange={handleDatePickerChange}
                        />
                        <View style={styles.datePickerModalActions}>
                          <TouchableOpacity
                            style={styles.datePickerModalActionButton}
                            onPress={handleDatePickerCancel}>
                            <Text style={styles.datePickerModalActionText}>Annuler</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.datePickerModalPrimaryButton}
                            onPress={handleDatePickerConfirm}>
                            <Text style={styles.datePickerModalPrimaryButtonText}>Valider</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </Modal>
                )}
              </View>
            </View>
          )}
        </View>

          <Text style={styles.label}>Décrivez votre situation :</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Exemple : Je vis seule avec deux enfants, je gagne 1200 € par mois et paie un loyer de 500 €."
            placeholderTextColor="#999"
            multiline
            numberOfLines={6}
            value={message}
            onChangeText={setMessage}
            textAlignVertical="top"
            editable={!isLoading}
          />

          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleSimulate}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Simuler mes aides</Text>
            )}
          </TouchableOpacity>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Mentionnez votre situation familiale, vos revenus, votre logement et vos événements de vie pour obtenir une simulation complète.
            </Text>
          </View>

          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <HistoryIcon size={20} color="#4ba3c3" />
              <View style={styles.historyHeaderText}>
                <Text style={styles.historyTitle}>Dernières simulations</Text>
                <Text style={styles.historySubtitle}>
                  Jusqu'à {MAX_HISTORY_ENTRIES} scénarios sont conservés sur cet appareil.
                </Text>
              </View>
            </View>

            {isHistoryLoading ? (
              <ActivityIndicator color="#4ba3c3" style={styles.historyLoader} />
            ) : historyError ? (
              <Text style={styles.historyError}>{historyError}</Text>
            ) : historyEntries.length === 0 ? (
              <Text style={styles.historyEmpty}>
                Vos simulations apparaîtront ici pour être relancées en un geste.
              </Text>
            ) : (
              <>
                {historyEntries.map((entry) => {
                  const topBenefit = entry.results.availableBenefits[0];
                  const secondBenefit = entry.results.availableBenefits[1];
                  return (
                    <View key={entry.id} style={styles.historyCard}>
                      <Text style={styles.historyDate}>{formatHistoryDate(entry.createdAt)}</Text>
                      <Text style={styles.historyMessage} numberOfLines={3}>
                        {entry.message}
                      </Text>

                      <View style={styles.historyBenefits}>
                        {topBenefit ? (
                          <Text style={styles.historyBenefit}>
                            • {topBenefit.label} ({topBenefit.period})
                          </Text>
                        ) : (
                          <Text style={styles.historyBenefit}>Aucune aide calculée.</Text>
                        )}
                        {secondBenefit && (
                          <Text style={styles.historyBenefit}>
                            • {secondBenefit.label} ({secondBenefit.period})
                          </Text>
                        )}
                      </View>

                      <View style={styles.historyActions}>
                        <TouchableOpacity
                          style={[styles.historyButton, styles.historySecondaryButton]}
                          onPress={() => setMessage(entry.message)}>
                          <Text style={styles.historyButtonTextSecondary}>Pré-remplir</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.historyButton, styles.historyPrimaryButton]}
                          onPress={() =>
                            router.push({
                              pathname: '/(tabs)/result',
                              params: { results: JSON.stringify(entry.results) },
                            })
                          }>
                          <Text style={styles.historyButtonTextPrimary}>Voir le détail</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}

                <TouchableOpacity
                  style={[styles.historyButton, styles.historyShareButton]}
                  onPress={handleShareHistory}>
                  <Text style={styles.historyShareText}>Partager le dernier résumé</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 30,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4ba3c3',
    marginTop: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  guidedSection: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  guidedToggle: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  guidedToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  guidedToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  guidedToggleSubtitle: {
    fontSize: 13,
    color: '#637085',
    lineHeight: 18,
  },
  guidedContent: {
    padding: 16,
  },
  chatContainer: {
    backgroundColor: '#f5f9fc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d8e6f2',
  },
  chatMessages: {
    maxHeight: 320,
  },
  chatMessagesContainer: {
    paddingVertical: 8,
    gap: 8,
  },
  chatOptionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chatOptionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4ba3c3',
    backgroundColor: '#fff',
  },
  chatOptionButtonSelected: {
    backgroundColor: '#4ba3c3',
  },
  chatOptionButtonDisabled: {
    opacity: 0.5,
  },
  chatOptionButtonText: {
    fontSize: 14,
    color: '#4ba3c3',
    fontWeight: '500',
  },
  chatOptionButtonTextSelected: {
    color: '#fff',
  },
  chatBubble: {
    maxWidth: '90%',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  chatBubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: '#e8f4fb',
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#4ba3c3',
  },
  chatBubbleText: {
    fontSize: 14,
    lineHeight: 20,
  },
  chatBubbleTextBot: {
    color: '#2c3e50',
  },
  chatBubbleTextUser: {
    color: '#fff',
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  chatInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cddfed',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#2c3e50',
  },
  chatSendButton: {
    backgroundColor: '#4ba3c3',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  chatSendButtonDisabled: {
    backgroundColor: '#aacfe0',
  },
  chatSendButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  datePickerButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#4ba3c3',
    backgroundColor: '#f0f8fc',
  },
  datePickerButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
    fontSize: 13,
  },
  chatError: {
    color: '#c0392b',
    fontSize: 13,
    marginTop: 8,
  },
  chatActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chatActionButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cddfed',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  chatActionButtonText: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  chatActionButtonPrimary: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#4ba3c3',
  },
  chatActionButtonPrimaryDisabled: {
    backgroundColor: '#aacfe0',
  },
  chatActionButtonPrimaryText: {
    color: '#fff',
    fontWeight: '600',
  },
  guidedPreviewBox: {
    backgroundColor: '#f1f7fb',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
  },
  guidedPreviewTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 6,
  },
  guidedPreviewText: {
    fontSize: 13,
    color: '#34495e',
    lineHeight: 18,
  },
  datePickerModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  datePickerModalContent: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  datePickerModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 12,
    textAlign: 'center',
  },
  datePickerModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  datePickerModalActionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#ecf5fa',
  },
  datePickerModalActionText: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  datePickerModalPrimaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#4ba3c3',
  },
  datePickerModalPrimaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#333',
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  errorContainer: {
    backgroundColor: '#fee',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  errorText: {
    color: '#c0392b',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#4ba3c3',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    shadowColor: '#4ba3c3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#eaf6fb',
    borderRadius: 10,
    padding: 12,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#4ba3c3',
  },
  infoText: {
    color: '#2c3e50',
    fontSize: 13,
    lineHeight: 18,
  },
  historySection: {
    marginTop: 28,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  historyHeaderText: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  historySubtitle: {
    fontSize: 12,
    color: '#637085',
    marginTop: 2,
  },
  historyLoader: {
    marginTop: 12,
  },
  historyError: {
    color: '#c0392b',
    fontSize: 14,
  },
  historyEmpty: {
    fontSize: 13,
    color: '#637085',
  },
  historyCard: {
    borderWidth: 1,
    borderColor: '#e0e9f1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#f9fbfd',
  },
  historyDate: {
    fontSize: 12,
    color: '#637085',
    marginBottom: 8,
  },
  historyMessage: {
    fontSize: 13,
    color: '#2c3e50',
    marginBottom: 10,
  },
  historyBenefits: {
    marginBottom: 12,
  },
  historyBenefit: {
    fontSize: 12,
    color: '#2c3e50',
    marginBottom: 4,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  historyButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  historySecondaryButton: {
    borderColor: '#cddfed',
    backgroundColor: '#fff',
  },
  historyPrimaryButton: {
    borderColor: '#4ba3c3',
    backgroundColor: '#4ba3c3',
  },
  historyButtonTextSecondary: {
    color: '#2c3e50',
    fontWeight: '600',
  },
  historyButtonTextPrimary: {
    color: '#fff',
    fontWeight: '600',
  },
  historyShareButton: {
    borderColor: '#4ba3c3',
    backgroundColor: '#fff',
    marginTop: 8,
  },
  historyShareText: {
    color: '#4ba3c3',
    fontWeight: '600',
  },
});
