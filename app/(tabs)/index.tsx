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
};

const calculateAge = (birthDate: Date, referenceDate: Date = new Date()): number => {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDifference = referenceDate.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age < 0 ? 0 : age;
};

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
  },
  {
    id: 'living-arrangement',
    section: 'Section 1 – Composition du foyer',
    label: 'Vous vivez',
    prompt: '4. Vivez-vous : Seul(e) ou En couple ? Indiquez « Seul(e) » ou « En couple ».',
  },
  {
    id: 'spouse-first-name',
    section: 'Section 1 – Composition du foyer',
    label: 'Prénom du conjoint',
    prompt:
      '5. Si vous vivez en couple, quel est le prénom de votre conjoint(e) ? Répondez « Non applicable » si vous vivez seul(e).',
  },
  {
    id: 'spouse-birth-date',
    section: 'Section 1 – Composition du foyer',
    label: 'Date de naissance du conjoint',
    prompt:
      '6. Si vous vivez en couple, quelle est sa date de naissance ? (JJ/MM/AAAA) Répondez « Non applicable » si vous vivez seul(e).',
  },
  {
    id: 'spouse-sex',
    section: 'Section 1 – Composition du foyer',
    label: 'Sexe du conjoint',
    prompt:
      '7. Si vous vivez en couple, quel est son sexe ? Répondez « Non applicable » si vous vivez seul(e).',
  },
  {
    id: 'conjugal-status',
    section: 'Section 1 – Composition du foyer',
    label: 'Statut conjugal',
    prompt:
      '8. Quel est votre statut conjugal ? (Marié(e), Pacsé(e), Union libre, etc.) Indiquez « Non applicable » si vous vivez seul(e).',
  },
  {
    id: 'dependents-any',
    section: 'Section 1 – Composition du foyer',
    label: 'Enfants ou personnes à charge',
    prompt:
      '9. Avez-vous des enfants ou des personnes à charge vivant avec vous ? (Oui / Non)',
  },
  {
    id: 'dependents-names',
    section: 'Section 1 – Composition du foyer',
    label: 'Prénoms des enfants / personnes à charge',
    prompt:
      '10. Pour chaque enfant ou personne à charge, indiquez le prénom. Répondez « Aucun » si personne ne vit avec vous.',
  },
  {
    id: 'dependents-birth-dates',
    section: 'Section 1 – Composition du foyer',
    label: 'Dates de naissance des enfants / personnes à charge',
    prompt:
      '11. Pour chacun, précisez la date de naissance (JJ/MM/AAAA). Répondez « Non applicable » si aucun.',
  },
  {
    id: 'dependents-sexes',
    section: 'Section 1 – Composition du foyer',
    label: 'Sexe des enfants / personnes à charge',
    prompt:
      '12. Pour chaque enfant ou personne à charge, indiquez le sexe.',
  },
  {
    id: 'dependents-schooling',
    section: 'Section 1 – Composition du foyer',
    label: 'Scolarité des enfants / personnes à charge',
    prompt:
      '13. Pour chaque enfant ou personne à charge, précisez la situation scolaire (Non scolarisé, Maternelle, Élémentaire, Collège, Lycée, Études supérieures, Apprentissage, Enseignement spécialisé, Autre). Indiquez « Non applicable » si aucun.',
  },
  {
    id: 'dependents-shared-custody',
    section: 'Section 1 – Composition du foyer',
    label: 'Garde alternée',
    prompt:
      '14. La garde est-elle alternée (Oui/Non) pour chacun des enfants ou personnes à charge ?',
  },
  {
    id: 'dependents-additional-info',
    section: 'Section 1 – Composition du foyer',
    label: 'Informations complémentaires',
    prompt:
      '15. Souhaitez-vous ajouter d’autres informations utiles concernant les enfants ou personnes à charge ?',
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
  },
  {
    id: 'adult1-details',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Détails situation adulte 1',
    prompt:
      '17-33. Précisez toutes les informations liées à cette situation (type de contrat, temps de travail, dates, allocations chômage et montants, statut d’indépendant, reconnaissance handicap, aides sociales, date de retraite, etc.). Indiquez « Non applicable » si aucune précision.',
  },
  {
    id: 'adult2-intent',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Souhaitez-vous renseigner le conjoint',
    prompt:
      '34. Souhaitez-vous renseigner la situation de votre conjoint(e) ? (Oui / Non / Non applicable).',
  },
  {
    id: 'adult2-situation',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Situation actuelle (adulte 2)',
    prompt:
      '35. Si oui, quelle est sa situation actuelle ? (Même liste que pour vous). Répondez « Non applicable » si vous n’êtes pas en couple ou ne souhaitez pas renseigner.',
  },
  {
    id: 'adult2-details',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Détails situation adulte 2',
    prompt:
      '36. Précisez les informations complémentaires pour votre conjoint(e) (type de contrat, dates, allocations, aides, etc.) ou indiquez « Non applicable ».',
  },
  {
    id: 'pregnancy-info',
    section: 'Section 2 – Situation professionnelle et personnelle',
    label: 'Grossesse',
    prompt:
      '35-36. Pour chaque femme du foyer âgée de 15 à 50 ans (vous et/ou votre conjoint[e]), indiquez si une grossesse est en cours et depuis combien de mois (moins de 3 mois, 3-6 mois, plus de 6 mois). Répondez « Non » ou « Non applicable » si aucune grossesse.',
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
  },
  {
    id: 'housing-details',
    section: 'Section 3 – Logement',
    label: 'Détails logement et montants',
    prompt:
      '4-22. Précisez les informations liées à votre statut : loyer hors charges, charges, bail, logement conventionné, colocation, montant des aides logement déjà perçues, mensualités de prêt, type d’hébergement gratuit et contributions, type de logement étudiant, type d’hébergement d’urgence, etc. Indiquez « Non applicable » pour les éléments qui ne vous concernent pas.',
  },
  {
    id: 'housing-people',
    section: 'Section 3 – Logement',
    label: 'Personnes dans le logement',
    prompt: '23. Combien de personnes vivent dans ce logement (adultes + enfants, vous compris) ?',
  },
  {
    id: 'housing-charges',
    section: 'Section 3 – Logement',
    label: 'Répartition des charges',
    prompt: '24. Êtes-vous uniquement responsable des charges ou les partagez-vous ?',
  },
  {
    id: 'housing-continue',
    section: 'Section 3 – Logement',
    label: 'Continuer vers les revenus',
    prompt: 'Souhaitez-vous continuer vers les ressources et revenus ? (Oui / Non)',
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
    id: 'social-benefits-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Prestations sociales adulte 1',
    prompt:
      '9-14. Détaillez les prestations sociales perçues (prime d’activité, RSA, aides logement, allocations familiales, AAH, pension d’invalidité) avec les montants mensuels, ou indiquez « Aucune ».',
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
    id: 'partner-resources-info',
    section: 'Section 4 – Ressources et revenus',
    label: 'Revenus du conjoint',
    prompt:
      'Répétez les informations précédentes pour votre conjoint(e) si vous êtes en couple (salaires, indépendants, chômage, prestations, pensions, autres ressources). Indiquez « Non applicable » si vous vivez seul(e).',
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
    id: 'realestate-info',
    section: 'Section 5 – Patrimoine',
    label: 'Patrimoine immobilier',
    prompt:
      '4-7. Êtes-vous propriétaire d’un ou plusieurs biens immobiliers ? Précisez le type de bien (résidence principale, secondaire, locatif, terrain/other), s’il est loué (montant du loyer perçu) et l’existence d’un prêt immobilier en cours.',
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

  const appendNextPrompts = useCallback(
    (baseMessages: ChatMessage[], startIndex: number) => {
      const messages = [...baseMessages];
      let index = startIndex;

      while (index < chatSteps.length) {
        const step = chatSteps[index];
        messages.push({
          id: `bot-${step.id}-${index}-${messages.length}`,
          role: 'bot',
          text: step.prompt,
        });

        if (step.type !== 'info') {
          return { messages, nextIndex: index, finished: false } as const;
        }

        index += 1;
      }

      return { messages, nextIndex: chatSteps.length, finished: true } as const;
    },
    [chatSteps],
  );

  const resetChatAnswers = useCallback(() => {
    setGuidedAnswers({});
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

    const { messages, nextIndex, finished } = appendNextPrompts(introMessages, 0);

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

      const answer = guidedAnswers[step.id];
      if (!answer || !answer.trim().length) {
        return;
      }

      const label = step.label ?? step.prompt;
      const lines = sectionLines.get(step.section) ?? [];
      lines.push(`${label}: ${answer.trim()}`);
      sectionLines.set(step.section, lines);
    });

    return Array.from(sectionLines.entries())
      .map(([sectionTitle, lines]) => `${sectionTitle}\n${lines.map((line) => `• ${line}`).join('\n')}`)
      .join('\n\n');
  }, [chatSteps, guidedAnswers]);

  const handleApplyGuidedSummary = useCallback(() => {
    if (!guidedSummary.trim().length) {
      return;
    }

    setMessage(guidedSummary.trim());
  }, [guidedSummary]);

  const handleChatSubmit = useCallback(() => {
    if (isChatFinished) {
      return;
    }

    const step = chatSteps[currentChatStep];
    if (!step || step.type === 'info') {
      return;
    }

    const rawAnswer = chatInput.trim();
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

      if (parsedBirthDate.getTime() < minimumBirthDate.getTime() || parsedBirthDate.getTime() > maximumBirthDate.getTime()) {
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

    setGuidedAnswers((current) => ({
      ...current,
      [step.id]: normalizedAnswer,
    }));

    const { messages, nextIndex, finished } = appendNextPrompts(
      messagesAfterReply,
      currentChatStep + 1,
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
  }, [
    appendNextPrompts,
    chatInput,
    chatMessages,
    chatSteps,
    currentChatStep,
    formatBirthDate,
    isChatFinished,
    maximumBirthDate,
    minimumBirthDate,
    parseBirthDateInput,
  ]);

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
                      onPress={handleChatSubmit}
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
