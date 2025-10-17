import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
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

const LIFE_EVENT_OPTIONS = [
  { id: 'single-parent', label: 'Parent isolé' },
  { id: 'disabled', label: 'Reconnu handicapé' },
  { id: 'pregnant', label: 'Grossesse en cours' },
  { id: 'student', label: 'Étudiant' },
];

const YES_NO_OPTIONS = ['oui', 'non'] as const;

const PROFESSIONAL_STATUS_OPTIONS = [
  { id: 'salarie', label: 'salarié' },
  { id: 'profession-liberale', label: 'profession libérale, entrepreneur' },
  { id: 'responsable-exploitation', label: "responsable d'exploitation agricole" },
  { id: 'micro-entrepreneur', label: 'micro-entrepreneur' },
  { id: 'auto-entrepreneur', label: 'auto-entrepreneur' },
  { id: 'apprenti', label: 'apprenti' },
  { id: 'stagiaire-hors-formation', label: 'stagiaire hors formation professionnelle' },
  { id: 'stagiaire-formation', label: 'stagiaire de formation professionnelle' },
  { id: 'boursier-sup', label: "boursier de l'enseignement supérieur" },
  { id: 'boursier-recherche', label: 'boursier de recherche' },
  { id: 'chomage-partiel', label: 'salarié en chômage partiel ou technique' },
  { id: 'demandeur-emploi', label: "demandeur d'emploi indemnisé" },
  { id: 'prime-activite', label: "bénéficiaire de la prime d'activité" },
  {
    id: 'allocation-securisation',
    label: "bénéficiaire de l'allocation de sécurisation professionnelle",
  },
  {
    id: 'indemnite-licenciement',
    label: "bénéficiaire d'une indemnité de licenciement, rupture, fin de CDD, congés payés...",
  },
  {
    id: 'prime-reprise-activite',
    label: "bénéficiaire d'une prime forfaitaire mensuelle pour la reprise d'activité",
  },
  {
    id: 'adefip',
    label: "bénéficiaire de l'Aide départementale Financière d'Insertion Personnalisée (AdeFIP)",
  },
  { id: 'pre-retraite', label: 'pré-retraité' },
] as const;

const INCOME_GROUPS = [
  {
    id: 'activity',
    label: "Revenus d'activité",
    options: [
      { id: 'salaires', label: 'salaires, primes, heures supplémentaires' },
      { id: 'independants', label: 'revenus des indépendants (BIC/BNC)' },
      { id: 'agricoles', label: 'revenus agricoles' },
      { id: 'micro-ca', label: 'chiffre d’affaires micro-entrepreneur' },
    ],
  },
  {
    id: 'indemnities',
    label: 'Indemnités',
    options: [
      { id: 'maladie', label: 'indemnités journalières maladie' },
      { id: 'maternite', label: 'indemnités journalières maternité, paternité ou adoption' },
      { id: 'accident-travail', label: 'indemnités maladie professionnelle ou accident du travail' },
      { id: 'volontariat', label: 'indemnités de volontariat' },
      {
        id: 'travailleur-independant',
        label: 'indemnités journalières travailleur indépendant et exploitant agricole',
      },
      { id: 'amiante', label: 'indemnisations pour victimes de l’amiante' },
    ],
  },
  {
    id: 'pensions',
    label: 'Pensions ou rentes',
    options: [
      { id: 'invalidite', label: "pension d'invalidité" },
      { id: 'retraite', label: 'pension (retraite, réversion, de combattant) ou rente' },
      { id: 'accident-travail-rente', label: 'rente accident du travail, ATEXA' },
    ],
  },
  {
    id: 'pensions-alimentaires',
    label: 'Pensions alimentaires, charges et frais',
    options: [
      { id: 'alimentaires-recues', label: 'pensions alimentaires reçues' },
      { id: 'alimentaires-versees', label: 'pensions alimentaires versées' },
      { id: 'prestations-compensatoires', label: 'prestations compensatoires reçues' },
      { id: 'autres-charges', label: 'autres charges à déduire du revenu' },
      { id: 'frais-deductibles', label: 'frais déductibles' },
    ],
  },
  {
    id: 'allocations',
    label: 'Allocations',
    options: [
      { id: 'allocations-familiales', label: 'allocations familiales' },
      { id: 'complement-familial', label: 'complément familial' },
      { id: 'allocation-soutien', label: 'allocation de soutien familial' },
      { id: 'cmg', label: 'complément de libre choix mode de garde (CMG)' },
      { id: 'paje-base', label: "prestation d'accueil du jeune enfant (PAJE) - Allocation de base" },
      { id: 'prepare', label: "prestation partagée d'éducation de l'enfant (PREPARE)" },
      { id: 'allocations-logement', label: 'allocations logement' },
      { id: 'aeeh', label: "allocation d'éducation de l'enfant handicapé (AEEH)" },
      { id: 'allocation-ressources', label: 'allocation de ressources (CR)' },
      { id: 'mva', label: 'majoration pour la vie autonome (MVA)' },
      { id: 'pch', label: 'prestation de compensation du handicap (PCH)' },
      { id: 'rsa', label: 'revenu de solidarité active (RSA)' },
      { id: 'aspa', label: 'allocation de solidarité aux personnes âgées (ASPA)' },
      { id: 'apa', label: 'allocation personnalisée d’autonomie à domicile (APA)' },
      { id: 'asi', label: 'allocation supplémentaire d’invalidité (ASI)' },
    ],
  },
  {
    id: 'patrimonial',
    label: 'Revenus patrimoniaux ou gains',
    options: [
      { id: 'revenus-locatifs', label: 'revenus locatifs (terrains, appartements, SCI, ...)' },
      { id: 'revenus-capital', label: 'revenus du capital (intérêts, plus-values, dividendes, ...)' },
      {
        id: 'plus-values',
        label: 'montant des plus-values utilisé pour le montant total de revenus du capital',
      },
      { id: 'gains-exceptionnels', label: 'gains exceptionnels (dons, gains aux jeux, héritage)' },
    ],
  },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  options: ReadonlyArray<{ id: string; label: string }>;
}>;

const HOUSING_OPTIONS: Array<{
  id: 'locataire' | 'proprietaire' | 'heberge';
  label: string;
}> = [
  { id: 'locataire', label: 'Locataire' },
  { id: 'proprietaire', label: 'Propriétaire' },
  { id: 'heberge', label: 'Hébergé gratuitement' },
];

type IncomeSelection = Record<string, Record<string, string>>;

const createEmptyIncomeSelection = (): IncomeSelection => {
  return INCOME_GROUPS.reduce<IncomeSelection>((acc, group) => {
    acc[group.id] = {};
    return acc;
  }, {});
};

type AdultSituation = {
  mdphRecognition: 'oui' | 'non' | null;
  hasRqth: 'oui' | 'non' | null;
  perceivesAah: 'oui' | 'non' | null;
  aahAmount: string;
  employmentStatuses: string[];
  incomes: IncomeSelection;
};

const createEmptyAdultSituation = (): AdultSituation => ({
  mdphRecognition: null,
  hasRqth: null,
  perceivesAah: null,
  aahAmount: '',
  employmentStatuses: [],
  incomes: createEmptyIncomeSelection(),
});

const formatCurrencyFromInput = (rawValue: string): string | null => {
  const sanitized = rawValue.replace(/[^0-9,.-]/g, '').replace(',', '.');
  if (!sanitized.trim().length) {
    return null;
  }

  const value = Number(sanitized);
  if (!Number.isFinite(value)) {
    return rawValue.trim();
  }

  try {
    return `${
      value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    } €`;
  } catch (error) {
    console.warn('Impossible de formater le montant', error);
    return `${value} €`;
  }
};

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
  const [householdAdults, setHouseholdAdults] = useState('1');
  const [householdChildren, setHouseholdChildren] = useState('0');
  const [disabledChildrenCount, setDisabledChildrenCount] = useState('');
  const [disabledChildrenDetails, setDisabledChildrenDetails] = useState('');
  const [childrenMdphRecognition, setChildrenMdphRecognition] = useState<'oui' | 'non' | null>(null);
  const [disabledAdultsCount, setDisabledAdultsCount] = useState('');
  const [adultSituations, setAdultSituations] = useState<AdultSituation[]>([
    createEmptyAdultSituation(),
  ]);
  const [housingType, setHousingType] = useState<'locataire' | 'proprietaire' | 'heberge'>('locataire');
  const [rentAmount, setRentAmount] = useState('');
  const [otherResources, setOtherResources] = useState('');
  const [selectedLifeEvents, setSelectedLifeEvents] = useState<string[]>([]);
  const [historyEntries, setHistoryEntries] = useState<SimulationHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    const parsedAdults = Number.parseInt(householdAdults, 10);

    if (!Number.isFinite(parsedAdults) || parsedAdults <= 0) {
      setAdultSituations([]);
      return;
    }

    setAdultSituations((current) => {
      if (current.length === parsedAdults) {
        return current;
      }

      if (current.length > parsedAdults) {
        return current.slice(0, parsedAdults);
      }

      return [
        ...current,
        ...Array.from({ length: parsedAdults - current.length }, () =>
          createEmptyAdultSituation(),
        ),
      ];
    });
  }, [householdAdults]);

  const { generateEndpoint, simulateEndpoint } = useMemo(() => {
    const defaultBaseUrl = 'https://facilaide-plus-backend.onrender.com';
    const configBaseUrl =
      (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)
        ?.apiBaseUrl ??
      process.env.EXPO_PUBLIC_API_BASE_URL ??
      defaultBaseUrl;

    const normalizedBaseUrl = configBaseUrl.replace(/\/+$/, '');

    return {
      baseUrl: normalizedBaseUrl,
      generateEndpoint: `${normalizedBaseUrl}/api/generate-json`,
      simulateEndpoint: `${normalizedBaseUrl}/api/simulate`,
    } as const;
  }, []);

  const refreshHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    try {
      const entries = await loadSimulationHistory();
      setHistoryEntries(entries);
      setHistoryError(null);
    } catch (historyLoadError) {
      console.warn('Erreur lors du chargement de l\'historique', historyLoadError);
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
          console.warn('Erreur lors du chargement de l\'historique', historyLoadError);
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

  const toggleLifeEvent = useCallback((eventId: string) => {
    setSelectedLifeEvents((previous) => {
      if (previous.includes(eventId)) {
        return previous.filter((value) => value !== eventId);
      }
      return [...previous, eventId];
    });
  }, []);

  const setAdultSituationField = useCallback(
    (
      adultIndex: number,
      field: keyof AdultSituation,
      value: AdultSituation[keyof AdultSituation],
    ) => {
      setAdultSituations((current) => {
        if (adultIndex < 0 || adultIndex >= current.length) {
          return current;
        }

        const next = [...current];
        const updatedAdult: AdultSituation = { ...next[adultIndex], [field]: value };

        if (field === 'perceivesAah' && value !== 'oui') {
          updatedAdult.aahAmount = '';
        }

        next[adultIndex] = updatedAdult;
        return next;
      });
    },
    [],
  );

  const toggleAdultEmploymentStatus = useCallback((adultIndex: number, statusId: string) => {
    setAdultSituations((current) => {
      if (adultIndex < 0 || adultIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const adult = next[adultIndex];
      const currentStatuses = adult.employmentStatuses;
      const hasStatus = currentStatuses.includes(statusId);
      const updatedStatuses = hasStatus
        ? currentStatuses.filter((id) => id !== statusId)
        : [...currentStatuses, statusId];

      next[adultIndex] = { ...adult, employmentStatuses: updatedStatuses };
      return next;
    });
  }, []);

  const toggleAdultIncomeOption = useCallback(
    (adultIndex: number, groupId: string, optionId: string) => {
      setAdultSituations((current) => {
        if (adultIndex < 0 || adultIndex >= current.length) {
          return current;
        }

        const next = [...current];
        const adult = next[adultIndex];
        const currentGroup = adult.incomes[groupId] ?? {};
        const updatedGroup = { ...currentGroup };

        if (optionId in updatedGroup) {
          delete updatedGroup[optionId];
        } else {
          updatedGroup[optionId] = '';
        }

        next[adultIndex] = {
          ...adult,
          incomes: {
            ...adult.incomes,
            [groupId]: updatedGroup,
          },
        };

        return next;
      });
    },
    [],
  );

  const setAdultIncomeAmount = useCallback(
    (adultIndex: number, groupId: string, optionId: string, amount: string) => {
      setAdultSituations((current) => {
        if (adultIndex < 0 || adultIndex >= current.length) {
          return current;
        }

        const next = [...current];
        const adult = next[adultIndex];
        const currentGroup = adult.incomes[groupId] ?? {};

        if (!(optionId in currentGroup)) {
          return current;
        }

        const updatedGroup = {
          ...currentGroup,
          [optionId]: amount,
        };

        next[adultIndex] = {
          ...adult,
          incomes: {
            ...adult.incomes,
            [groupId]: updatedGroup,
          },
        };

        return next;
      });
    },
    [],
  );

  const guidedSummary = useMemo(() => {
    const segments: string[] = [];

    const adultsCount = Number.parseInt(householdAdults, 10);
    const childrenCount = Number.parseInt(householdChildren, 10);
    if (Number.isFinite(adultsCount) && adultsCount > 0) {
      segments.push(
        adultsCount === 1 ? 'Je vis seul(e).' : `Nous sommes ${adultsCount} adultes dans le foyer.`,
      );
    }

    if (Number.isFinite(childrenCount) && childrenCount >= 0) {
      if (childrenCount === 0) {
        segments.push("Je n'ai pas d'enfant à charge.");
      } else if (childrenCount === 1) {
        segments.push("J'ai un enfant à charge.");
      } else {
        segments.push(`J'ai ${childrenCount} enfants à charge.`);
      }
    }

    const disabledChildrenValue = Number.parseInt(disabledChildrenCount, 10);
    if (Number.isFinite(disabledChildrenValue) && disabledChildrenValue >= 0) {
      if (disabledChildrenValue === 0) {
        segments.push("Aucun enfant n'est en situation de handicap dans le foyer.");
      } else if (disabledChildrenValue === 1) {
        segments.push("Un enfant du foyer est en situation de handicap.");
      } else {
        segments.push(`${disabledChildrenValue} enfants du foyer sont en situation de handicap.`);
      }
    }

    if (childrenMdphRecognition === 'oui') {
      segments.push('Les enfants concernés sont reconnus par la MDPH.');
    } else if (childrenMdphRecognition === 'non') {
      segments.push("Les enfants concernés ne sont pas reconnus par la MDPH.");
    }

    if (disabledChildrenDetails.trim().length > 0) {
      segments.push(disabledChildrenDetails.trim());
    }

    const disabledAdultsValue = Number.parseInt(disabledAdultsCount, 10);
    if (Number.isFinite(disabledAdultsValue) && disabledAdultsValue >= 0) {
      if (disabledAdultsValue === 0) {
        segments.push("Aucun adulte du foyer n'est en situation de handicap.");
      } else if (disabledAdultsValue === 1) {
        segments.push('Un adulte du foyer est en situation de handicap.');
      } else {
        segments.push(`${disabledAdultsValue} adultes du foyer sont en situation de handicap.`);
      }
    }

    const adultCount = adultSituations.length;
    const mdphYesCount = adultSituations.filter((adult) => adult.mdphRecognition === 'oui').length;
    const mdphNoCount = adultSituations.filter((adult) => adult.mdphRecognition === 'non').length;

    if (mdphYesCount > 0) {
      if (adultCount === 1) {
        segments.push("L'adulte du foyer est reconnu par la MDPH.");
      } else if (mdphYesCount === adultCount) {
        segments.push('Les adultes concernés sont reconnus par la MDPH.');
      } else if (mdphYesCount === 1) {
        segments.push('Un adulte du foyer est reconnu par la MDPH.');
      } else {
        segments.push(`${mdphYesCount} adultes du foyer sont reconnus par la MDPH.`);
      }
    } else if (mdphNoCount === adultCount && adultCount > 0) {
      segments.push("Aucun adulte du foyer n'est reconnu par la MDPH.");
    }

    const rqthYesCount = adultSituations.filter((adult) => adult.hasRqth === 'oui').length;
    const rqthNoCount = adultSituations.filter((adult) => adult.hasRqth === 'non').length;

    if (rqthYesCount > 0) {
      if (adultCount === 1) {
        segments.push("L'adulte du foyer est titulaire d'une RQTH.");
      } else if (rqthYesCount === adultCount) {
        segments.push("Tous les adultes du foyer sont titulaires d'une RQTH.");
      } else if (rqthYesCount === 1) {
        segments.push("Un adulte du foyer est titulaire d'une RQTH.");
      } else {
        segments.push(`${rqthYesCount} adultes du foyer sont titulaires d'une RQTH.`);
      }
    } else if (rqthNoCount === adultCount && adultCount > 0) {
      segments.push("Personne dans le foyer n'est titulaire d'une RQTH.");
    }

    const adultsWithAah = adultSituations
      .map((adult, index) => ({ adult, index }))
      .filter(({ adult }) => adult.perceivesAah === 'oui');

    if (adultsWithAah.length > 0) {
      if (adultCount === 1) {
        segments.push("L'adulte du foyer perçoit l'AAH.");
      } else if (adultsWithAah.length === adultCount) {
        segments.push("Tous les adultes du foyer perçoivent l'AAH.");
      } else if (adultsWithAah.length === 1) {
        segments.push("Un adulte du foyer perçoit l'AAH.");
      } else {
        segments.push(`${adultsWithAah.length} adultes du foyer perçoivent l'AAH.`);
      }

      adultsWithAah.forEach(({ adult, index }) => {
        const formattedAah = formatCurrencyFromInput(adult.aahAmount);
        if (!formattedAah) {
          return;
        }

        if (adultCount === 1) {
          segments.push(`Le montant mensuel de l'AAH est d'environ ${formattedAah}.`);
        } else {
          segments.push(`L'adulte ${index + 1} perçoit environ ${formattedAah} d'AAH par mois.`);
        }
      });
    } else if (
      adultCount > 0 &&
      adultSituations.every((adult) => adult.perceivesAah === 'non')
    ) {
      segments.push("Personne ne perçoit l'AAH dans le foyer.");
    }

    adultSituations.forEach((adult, index) => {
      const statusLabels = adult.employmentStatuses
        .map((statusId) =>
          PROFESSIONAL_STATUS_OPTIONS.find((option) => option.id === statusId)?.label,
        )
        .filter((label): label is string => Boolean(label));

      if (statusLabels.length > 0) {
        if (adultCount === 1) {
          segments.push(`Ma situation professionnelle : ${statusLabels.join(', ')}.`);
        } else {
          segments.push(
            `L'adulte ${index + 1} a pour situation professionnelle : ${statusLabels.join(', ')}.`,
          );
        }
      }

      INCOME_GROUPS.forEach((group) => {
        const groupIncomes = adult.incomes[group.id];
        if (!groupIncomes) {
          return;
        }

        Object.entries(groupIncomes).forEach(([optionId, amount]) => {
          const optionLabel = group.options.find((option) => option.id === optionId)?.label;
          if (!optionLabel) {
            return;
          }

          const formattedAmount = formatCurrencyFromInput(amount);

          if (adultCount === 1) {
            segments.push(
              formattedAmount
                ? `Je perçois ${optionLabel} pour environ ${formattedAmount} par mois.`
                : `Je perçois ${optionLabel}.`,
            );
          } else {
            segments.push(
              formattedAmount
                ? `L'adulte ${index + 1} perçoit ${optionLabel} pour environ ${formattedAmount} par mois.`
                : `L'adulte ${index + 1} perçoit ${optionLabel}.`,
            );
          }
        });
      });
    });

    if (selectedLifeEvents.includes('single-parent')) {
      segments.push('Je suis parent isolé.');
    }
    if (selectedLifeEvents.includes('disabled')) {
      segments.push('Je suis reconnu(e) en situation de handicap.');
    }
    if (selectedLifeEvents.includes('pregnant')) {
      segments.push('Une grossesse est en cours dans le foyer.');
    }
    if (selectedLifeEvents.includes('student')) {
      segments.push('Je suis étudiant(e).');
    }

    segments.push(
      {
        locataire: 'Je suis locataire de mon logement.',
        proprietaire: 'Je suis propriétaire de mon logement.',
        heberge: "Je suis hébergé(e) gratuitement.",
      }[housingType],
    );

    const formattedRent = formatCurrencyFromInput(rentAmount);
    if (formattedRent && housingType === 'locataire') {
      segments.push(`Mon loyer mensuel (charges comprises) est de ${formattedRent}.`);
    }

    if (otherResources.trim().length > 0) {
      segments.push(otherResources.trim());
    }

    return segments.join(' ');
  }, [
    householdAdults,
    householdChildren,
    selectedLifeEvents,
    disabledChildrenCount,
    disabledChildrenDetails,
    childrenMdphRecognition,
    disabledAdultsCount,
    adultSituations,
    housingType,
    rentAmount,
    otherResources,
  ]);

  const handleApplyGuidedSummary = useCallback(() => {
    if (!guidedSummary.trim().length) {
      return;
    }

    setMessage(guidedSummary.trim());
  }, [guidedSummary]);

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
        console.warn('Impossible de rafraîchir l\'historique', historyRefreshError);
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
                <Text style={styles.guidedToggleTitle}>Assistant de saisie</Text>
              </View>
              <Text style={styles.guidedToggleSubtitle}>
                Renseignez quelques informations clés et générez automatiquement un texte structuré.
              </Text>
            </TouchableOpacity>

            {showGuidedAssistant && (
              <View style={styles.guidedContent}>
                <Text style={styles.guidedLabel}>Composition du foyer</Text>
                <View style={styles.guidedRow}>
                  <View style={styles.guidedField}>
                    <Text style={styles.guidedFieldLabel}>Nombre d'adultes</Text>
                    <TextInput
                      style={styles.guidedInput}
                      keyboardType="number-pad"
                      value={householdAdults}
                      onChangeText={setHouseholdAdults}
                    />
                  </View>
                  <View style={[styles.guidedField, styles.guidedFieldLast]}>
                    <Text style={styles.guidedFieldLabel}>Enfants à charge</Text>
                    <TextInput
                      style={styles.guidedInput}
                      keyboardType="number-pad"
                      value={householdChildren}
                      onChangeText={setHouseholdChildren}
                    />
                  </View>
                </View>

                <Text style={styles.guidedLabel}>Handicap dans le foyer</Text>
                <View style={styles.guidedRow}>
                  <View style={styles.guidedField}>
                    <Text style={styles.guidedFieldLabel}>
                      Enfants en situation de handicap
                    </Text>
                    <TextInput
                      style={styles.guidedInput}
                      keyboardType="number-pad"
                      placeholder="Ex : 1"
                      value={disabledChildrenCount}
                      onChangeText={setDisabledChildrenCount}
                    />
                  </View>
                  <View style={[styles.guidedField, styles.guidedFieldLast]}>
                    <Text style={styles.guidedFieldLabel}>
                      Adultes en situation de handicap
                    </Text>
                    <TextInput
                      style={styles.guidedInput}
                      keyboardType="number-pad"
                      placeholder="Ex : 1"
                      value={disabledAdultsCount}
                      onChangeText={setDisabledAdultsCount}
                    />
                  </View>
                </View>

                <Text style={styles.guidedFieldLabel}>
                  Enfants concernés reconnus par la MDPH ?
                </Text>
                <View style={styles.chipRow}>
                  {YES_NO_OPTIONS.map((option) => {
                    const isSelected = childrenMdphRecognition === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() =>
                          setChildrenMdphRecognition((current) =>
                            current === option ? null : option,
                          )
                        }>
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {option === 'oui' ? 'Oui' : 'Non'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.guidedFieldLabel}>Précisions sur les enfants concernés</Text>
                <TextInput
                  style={[styles.guidedInput, styles.guidedInputMultiline]}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                  placeholder="Ex : Léa (10 ans) et Marc (7 ans)."
                  value={disabledChildrenDetails}
                  onChangeText={setDisabledChildrenDetails}
                />

                {adultSituations.length > 0 && (
                  <>
                    <Text style={styles.guidedLabel}>Situation des adultes</Text>
                    {adultSituations.map((adult, index) => {
                      const showAdultTitle = adultSituations.length > 1;
                      return (
                        <View key={`adult-${index}`} style={styles.adultSection}>
                          {showAdultTitle && (
                            <Text style={styles.adultSectionTitle}>Adulte {index + 1}</Text>
                          )}

                          <Text style={styles.guidedFieldLabel}>Reconnu par la MDPH ?</Text>
                          <View style={styles.chipRow}>
                            {YES_NO_OPTIONS.map((option) => {
                              const isSelected = adult.mdphRecognition === option;
                              return (
                                <TouchableOpacity
                                  key={option}
                                  style={[styles.chip, isSelected && styles.chipSelected]}
                                  onPress={() =>
                                    setAdultSituationField(
                                      index,
                                      'mdphRecognition',
                                      isSelected ? null : option,
                                    )
                                  }>
                                  <Text
                                    style={[styles.chipText, isSelected && styles.chipTextSelected]}
                                  >
                                    {option === 'oui' ? 'Oui' : 'Non'}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          <Text style={styles.guidedFieldLabel}>Titulaire d'une RQTH ?</Text>
                          <View style={styles.chipRow}>
                            {YES_NO_OPTIONS.map((option) => {
                              const isSelected = adult.hasRqth === option;
                              return (
                                <TouchableOpacity
                                  key={option}
                                  style={[styles.chip, isSelected && styles.chipSelected]}
                                  onPress={() =>
                                    setAdultSituationField(
                                      index,
                                      'hasRqth',
                                      isSelected ? null : option,
                                    )
                                  }>
                                  <Text
                                    style={[styles.chipText, isSelected && styles.chipTextSelected]}
                                  >
                                    {option === 'oui' ? 'Oui' : 'Non'}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          <Text style={styles.guidedFieldLabel}>Perçoit l'AAH ?</Text>
                          <View style={styles.chipRow}>
                            {YES_NO_OPTIONS.map((option) => {
                              const isSelected = adult.perceivesAah === option;
                              return (
                                <TouchableOpacity
                                  key={option}
                                  style={[styles.chip, isSelected && styles.chipSelected]}
                                  onPress={() =>
                                    setAdultSituationField(
                                      index,
                                      'perceivesAah',
                                      isSelected ? null : option,
                                    )
                                  }>
                                  <Text
                                    style={[styles.chipText, isSelected && styles.chipTextSelected]}
                                  >
                                    {option === 'oui' ? 'Oui' : 'Non'}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          {adult.perceivesAah === 'oui' && (
                            <>
                              <Text style={styles.guidedFieldLabel}>Montant mensuel de l'AAH</Text>
                              <TextInput
                                style={styles.guidedInput}
                                keyboardType="decimal-pad"
                                placeholder="Ex : 300"
                                value={adult.aahAmount}
                                onChangeText={(value) =>
                                  setAdultSituationField(index, 'aahAmount', value)
                                }
                              />
                            </>
                          )}

                          <Text style={styles.guidedFieldLabel}>Situation professionnelle</Text>
                          <View style={styles.optionList}>
                            {PROFESSIONAL_STATUS_OPTIONS.map((status) => {
                              const isSelected = adult.employmentStatuses.includes(status.id);
                              return (
                                <TouchableOpacity
                                  key={status.id}
                                  style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                                  onPress={() => toggleAdultEmploymentStatus(index, status.id)}>
                                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]} />
                                  <Text
                                    style={[styles.optionText, isSelected && styles.optionTextSelected]}
                                  >
                                    {status.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          <Text style={styles.guidedFieldLabel}>Revenus et ressources</Text>
                          <View style={styles.incomeGroups}>
                            {INCOME_GROUPS.map((group) => {
                              const groupIncomes = adult.incomes[group.id] ?? {};
                              return (
                                <View key={group.id} style={styles.incomeGroup}>
                                  <Text style={styles.incomeGroupTitle}>{group.label}</Text>
                                  {group.options.map((option) => {
                                    const isSelected = option.id in groupIncomes;
                                    return (
                                      <View key={option.id} style={styles.incomeOption}>
                                        <TouchableOpacity
                                          style={[styles.optionRow, isSelected && styles.optionRowSelected]}
                                          onPress={() =>
                                            toggleAdultIncomeOption(index, group.id, option.id)
                                          }>
                                          <View
                                            style={[styles.checkbox, isSelected && styles.checkboxSelected]}
                                          />
                                          <Text
                                            style={[styles.optionText, isSelected && styles.optionTextSelected]}
                                          >
                                            {option.label}
                                          </Text>
                                        </TouchableOpacity>
                                        {isSelected && (
                                          <TextInput
                                            style={styles.incomeAmountInput}
                                            keyboardType="decimal-pad"
                                            placeholder="Montant mensuel"
                                            value={groupIncomes[option.id] ?? ''}
                                            onChangeText={(value) =>
                                              setAdultIncomeAmount(index, group.id, option.id, value)
                                            }
                                          />
                                        )}
                                      </View>
                                    );
                                  })}
                                </View>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </>
                )}

                <Text style={styles.guidedLabel}>Logement</Text>
                <View style={styles.chipRow}>
                  {HOUSING_OPTIONS.map((option) => {
                    const isSelected = housingType === option.id;
                    return (
                      <TouchableOpacity
                        key={option.id}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => setHousingType(option.id)}>
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {housingType === 'locataire' && (
                  <>
                    <Text style={styles.guidedLabel}>Loyer mensuel (charges comprises)</Text>
                    <TextInput
                      style={styles.guidedInput}
                      keyboardType="decimal-pad"
                      placeholder="Ex : 650"
                      value={rentAmount}
                      onChangeText={setRentAmount}
                    />
                  </>
                )}

                <Text style={styles.guidedLabel}>Événements de vie</Text>
                <View style={styles.chipRow}>
                  {LIFE_EVENT_OPTIONS.map((event) => {
                    const isSelected = selectedLifeEvents.includes(event.id);
                    return (
                      <TouchableOpacity
                        key={event.id}
                        style={[styles.chip, isSelected && styles.chipSelected]}
                        onPress={() => toggleLifeEvent(event.id)}>
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {event.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.guidedLabel}>Informations complémentaires</Text>
                <TextInput
                  style={[styles.guidedInput, styles.guidedInputMultiline]}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  placeholder="Ex : Je perçois une pension alimentaire de 200 €."
                  value={otherResources}
                  onChangeText={setOtherResources}
                />

                <View style={styles.guidedPreviewBox}>
                  <Text style={styles.guidedPreviewTitle}>Aperçu généré</Text>
                  <Text style={styles.guidedPreviewText}>
                    {guidedSummary.trim().length
                      ? guidedSummary
                      : 'Complétez les champs pour générer automatiquement un message.'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.guidedButton,
                    !guidedSummary.trim().length && styles.buttonDisabled,
                  ]}
                  onPress={handleApplyGuidedSummary}
                  disabled={!guidedSummary.trim().length}>
                  <Text style={styles.buttonText}>Utiliser cet aperçu</Text>
                </TouchableOpacity>
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
              💡 Mentionnez votre situation familiale, vos revenus, votre loyer et
              le nombre d'enfants pour obtenir une simulation complète.
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
                          style={[
                            styles.historyButton,
                            styles.historyButtonLast,
                            styles.historyPrimaryButton,
                          ]}
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
                  style={[styles.historyButton, styles.historyButtonLast, styles.historyShareButton]}
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
  },
  guidedToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
    marginLeft: 8,
  },
  guidedToggleSubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  guidedContent: {
    padding: 16,
    backgroundColor: '#fbfdff',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  guidedLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#34495e',
    marginBottom: 8,
  },
  guidedRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  guidedField: {
    flex: 1,
    marginRight: 12,
  },
  guidedFieldLast: {
    marginRight: 0,
  },
  guidedFieldLabel: {
    fontSize: 13,
    color: '#555',
    marginBottom: 6,
  },
  guidedInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d6e0eb',
    padding: 10,
    fontSize: 15,
    color: '#2c3e50',
    marginBottom: 16,
  },
  adultSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e3ebf5',
    padding: 12,
    marginBottom: 16,
  },
  adultSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 8,
  },
  guidedInputMultiline: {
    minHeight: 80,
  },
  optionList: {
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d6e0eb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  optionRowSelected: {
    borderColor: '#4ba3c3',
    backgroundColor: '#f0f7fb',
  },
  optionText: {
    flex: 1,
    fontSize: 13,
    color: '#2c3e50',
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#2c3e50',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#b0c4d4',
    marginRight: 10,
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#4ba3c3',
    borderColor: '#4ba3c3',
  },
  incomeGroups: {
    marginBottom: 16,
  },
  incomeGroup: {
    marginBottom: 12,
  },
  incomeGroupTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2c3e50',
    marginBottom: 6,
  },
  incomeOption: {
    marginBottom: 8,
  },
  incomeAmountInput: {
    marginTop: 6,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d6e0eb',
    padding: 10,
    fontSize: 14,
    color: '#2c3e50',
  },
  guidedPreviewBox: {
    backgroundColor: '#f1f7fb',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
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
  guidedButton: {
    marginTop: 0,
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
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoBox: {
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#6ad49b',
  },
  infoText: {
    color: '#2e7d32',
    fontSize: 14,
    lineHeight: 20,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d6e0eb',
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#4ba3c3',
    borderColor: '#4ba3c3',
  },
  chipText: {
    fontSize: 13,
    color: '#2c3e50',
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  historySection: {
    marginTop: 32,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historyHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2c3e50',
  },
  historySubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  historyLoader: {
    marginTop: 12,
  },
  historyError: {
    color: '#c0392b',
    fontSize: 13,
  },
  historyEmpty: {
    fontSize: 13,
    color: '#666',
  },
  historyCard: {
    borderWidth: 1,
    borderColor: '#edf2f7',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fdfefe',
  },
  historyDate: {
    fontSize: 12,
    color: '#7f8c8d',
    marginBottom: 6,
  },
  historyMessage: {
    fontSize: 13,
    color: '#2c3e50',
    marginBottom: 8,
    lineHeight: 18,
  },
  historyBenefits: {
    marginBottom: 12,
  },
  historyBenefit: {
    fontSize: 12,
    color: '#4b5563',
    lineHeight: 16,
  },
  historyActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 12,
  },
  historyPrimaryButton: {
    backgroundColor: '#4ba3c3',
  },
  historySecondaryButton: {
    borderWidth: 1,
    borderColor: '#4ba3c3',
  },
  historyButtonLast: {
    marginRight: 0,
  },
  historyButtonTextPrimary: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  historyButtonTextSecondary: {
    color: '#4ba3c3',
    fontWeight: '600',
    fontSize: 14,
  },
  historyShareButton: {
    marginTop: 4,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9acfe0',
    paddingVertical: 10,
  },
  historyShareText: {
    color: '#2c3e50',
    fontSize: 13,
    fontWeight: '600',
  },
});
