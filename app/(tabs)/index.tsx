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

const HOUSING_OPTIONS: Array<{
  id: 'locataire' | 'proprietaire' | 'heberge';
  label: string;
}> = [
  { id: 'locataire', label: 'Locataire' },
  { id: 'proprietaire', label: 'Propriétaire' },
  { id: 'heberge', label: 'Hébergé gratuitement' },
];

const MARITAL_STATUS_OPTIONS = [
  { id: 'single', label: 'célibataire' },
  { id: 'couple', label: 'en couple' },
  { id: 'married', label: 'marié(e)' },
  { id: 'pacsed', label: 'pacsé(e)' },
  { id: 'separated', label: 'séparé(e) ou divorcé(e)' },
  { id: 'widowed', label: 'veuf/veuve' },
] as const;

type ChatMessage = {
  id: string;
  role: 'bot' | 'user';
  text: string;
};

const normalizeText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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

  const [householdAdults, setHouseholdAdults] = useState('');
  const [adultIdentities, setAdultIdentities] = useState('');
  const [maritalStatus, setMaritalStatus] = useState<string | null>(null);
  const [householdChildren, setHouseholdChildren] = useState('');
  const [childrenDetails, setChildrenDetails] = useState('');
  const [disabilityDetails, setDisabilityDetails] = useState('');
  const [professionalDetails, setProfessionalDetails] = useState('');
  const [incomeDetails, setIncomeDetails] = useState('');
  const [housingType, setHousingType] = useState<'locataire' | 'proprietaire' | 'heberge'>('locataire');
  const [hasHousingAnswer, setHasHousingAnswer] = useState(false);
  const [rentAmount, setRentAmount] = useState('');
  const [selectedLifeEvents, setSelectedLifeEvents] = useState<string[]>([]);
  const [lifeEventNotes, setLifeEventNotes] = useState('');
  const [otherResources, setOtherResources] = useState('');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentChatStep, setCurrentChatStep] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatFinished, setIsChatFinished] = useState(false);

  const chatScrollRef = useRef<ScrollView | null>(null);

  const chatSteps = useMemo(
    () => [
      {
        id: 'adultCount',
        prompt: "Combien d'adultes composent votre foyer ?",
      },
      {
        id: 'adultIdentities',
        prompt:
          "Pouvez-vous indiquer le prénom et l'âge de chaque adulte du foyer (ex : Marie 35 ans, Paul 38 ans) ?",
      },
      {
        id: 'maritalStatus',
        prompt: `Quelle est la situation matrimoniale du foyer ? (${MARITAL_STATUS_OPTIONS.map((option) => option.label).join(', ')})`,
      },
      {
        id: 'childrenCount',
        prompt: "Combien d'enfants ou de personnes à charge vivent dans le foyer ? (indiquez 0 si aucun)",
      },
      {
        id: 'childrenDetails',
        prompt:
          `Pouvez-vous préciser les prénoms et les âges des enfants ou indiquer "aucun" si vous n'en avez pas ?`,
      },
      {
        id: 'disability',
        prompt:
          `Certaines personnes du foyer sont-elles en situation de handicap ou reconnues par la MDPH ? (détaillez ou répondez "non")`,
      },
      {
        id: 'professional',
        prompt:
          `Pouvez-vous décrire la situation professionnelle de chaque adulte (emploi, chômage, études, formation...) ?`,
      },
      {
        id: 'income',
        prompt:
          `Quels sont les revenus mensuels nets du foyer (salaires, allocations, pensions, indemnités...) ?`,
      },
      {
        id: 'housingType',
        prompt: `Quel est votre statut de logement ? (${HOUSING_OPTIONS.map((option) => option.label).join(', ')})`,
      },
      {
        id: 'rent',
        prompt:
          `Quel est le montant du loyer mensuel charges comprises ? Répondez "non applicable" si vous n'êtes pas locataire.`,
      },
      {
        id: 'lifeEvents',
        prompt: `Y a-t-il des événements de vie à signaler ? Indiquez les numéros ou les intitulés : ${LIFE_EVENT_OPTIONS.map((event, index) => `${index + 1}. ${event.label}`).join(' | ')}. Répondez "aucun" si rien à signaler.`,
      },
      {
        id: 'otherResources',
        prompt:
          `Souhaitez-vous ajouter d'autres informations utiles (pensions alimentaires, dettes, projets...) ?`,
      },
    ],
    [],
  );

  const resetChatAnswers = useCallback(() => {
    setHouseholdAdults('');
    setAdultIdentities('');
    setMaritalStatus(null);
    setHouseholdChildren('');
    setChildrenDetails('');
    setDisabilityDetails('');
    setProfessionalDetails('');
    setIncomeDetails('');
    setHousingType('locataire');
    setHasHousingAnswer(false);
    setRentAmount('');
    setSelectedLifeEvents([]);
    setLifeEventNotes('');
    setOtherResources('');
  }, []);

  const startChat = useCallback(() => {
    resetChatAnswers();
    if (chatSteps.length === 0) {
      return;
    }

    setChatMessages([
      {
        id: 'bot-intro',
        role: 'bot',
        text:
          'Bonjour ! Je vais vous poser quelques questions pour préparer une simulation OpenFisca complète.',
      },
      { id: `bot-${chatSteps[0].id}`, role: 'bot', text: chatSteps[0].prompt },
    ]);
    setCurrentChatStep(0);
    setChatInput('');
    setChatError(null);
    setIsChatFinished(false);
  }, [chatSteps, resetChatAnswers]);

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
    const segments: string[] = [];

    const adultCount = Number.parseInt(householdAdults, 10);
    if (Number.isFinite(adultCount) && adultCount >= 0) {
      if (adultCount === 0) {
        segments.push("Le foyer ne compte pas d'adulte.");
      } else if (adultCount === 1) {
        segments.push("Le foyer est composé d'un adulte.");
      } else {
        segments.push(`Le foyer est composé de ${adultCount} adultes.`);
      }
    }

    if (adultIdentities.trim().length > 0) {
      segments.push(`Adultes : ${adultIdentities.trim()}.`);
    }

    if (maritalStatus) {
      segments.push(`Situation matrimoniale : ${maritalStatus}.`);
    }

    const childrenCount = Number.parseInt(householdChildren, 10);
    if (Number.isFinite(childrenCount) && childrenCount >= 0) {
      if (childrenCount === 0) {
        segments.push("Il n'y a pas d'enfant ou de personne à charge.");
      } else {
        segments.push(`Nombre d'enfants ou personnes à charge : ${childrenCount}.`);
      }
    }

    if (childrenDetails.trim().length > 0) {
      segments.push(`Détails sur les enfants : ${childrenDetails.trim()}.`);
    }

    if (disabilityDetails.trim().length > 0) {
      const detail = disabilityDetails.trim();
      segments.push(/[.!?…]$/.test(detail) ? detail : `${detail}.`);
    }

    if (professionalDetails.trim().length > 0) {
      segments.push(`Situation professionnelle : ${professionalDetails.trim()}.`);
    }

    if (incomeDetails.trim().length > 0) {
      segments.push(`Revenus mensuels : ${incomeDetails.trim()}.`);
    }

    if (hasHousingAnswer) {
      const housingLabel = HOUSING_OPTIONS.find((option) => option.id === housingType)?.label;
      if (housingLabel) {
        segments.push(`Logement : ${housingLabel}.`);
      }
    }

    if (rentAmount.trim().length > 0 && housingType === 'locataire') {
      const formattedRent = formatCurrencyFromInput(rentAmount);
      if (formattedRent) {
        segments.push(`Loyer mensuel charges comprises : ${formattedRent}.`);
      }
    }

    if (selectedLifeEvents.length > 0) {
      const labels = LIFE_EVENT_OPTIONS.filter((event) => selectedLifeEvents.includes(event.id)).map(
        (event) => event.label,
      );
      if (labels.length > 0) {
        segments.push(`Événements de vie : ${labels.join(', ')}.`);
      }
    }

    if (lifeEventNotes.trim().length > 0) {
      segments.push(`Autres événements : ${lifeEventNotes.trim()}.`);
    }

    if (otherResources.trim().length > 0) {
      segments.push(`Autres informations : ${otherResources.trim()}.`);
    }

    return segments.join(' ').trim();
  }, [
    adultIdentities,
    disabilityDetails,
    hasHousingAnswer,
    householdAdults,
    householdChildren,
    housingType,
    incomeDetails,
    lifeEventNotes,
    maritalStatus,
    otherResources,
    professionalDetails,
    rentAmount,
    selectedLifeEvents,
    childrenDetails,
  ]);

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
    if (!step) {
      return;
    }

    const rawAnswer = chatInput.trim();
    if (!rawAnswer.length) {
      setChatError('Veuillez saisir une réponse.');
      return;
    }

    const normalizedAnswer = normalizeText(rawAnswer);

    switch (step.id) {
      case 'adultCount': {
        const value = Number.parseInt(rawAnswer, 10);
        if (!Number.isFinite(value) || value <= 0) {
          setChatError("Indiquez un nombre d'adultes valide (ex : 1, 2...).");
          return;
        }
        setHouseholdAdults(String(value));
        break;
      }
      case 'adultIdentities': {
        setAdultIdentities(rawAnswer);
        break;
      }
      case 'maritalStatus': {
        const matched = MARITAL_STATUS_OPTIONS.find((option) => {
          const normalizedLabel = normalizeText(option.label);
          return (
            normalizedLabel === normalizedAnswer ||
            normalizedLabel.includes(normalizedAnswer) ||
            normalizedAnswer.includes(normalizedLabel)
          );
        });

        if (!matched) {
          setChatError("Choisissez parmi les situations proposées (célibataire, en couple, marié...).");
          return;
        }

        setMaritalStatus(matched.label);
        break;
      }
      case 'childrenCount': {
        const value = Number.parseInt(rawAnswer, 10);
        if (!Number.isFinite(value) || value < 0) {
          setChatError("Indiquez un nombre d'enfants valide (0, 1, 2...).");
          return;
        }
        setHouseholdChildren(String(value));
        if (value === 0) {
          setChildrenDetails('');
        }
        break;
      }
      case 'childrenDetails': {
        if (
          normalizedAnswer === 'aucun' ||
          normalizedAnswer === 'aucune' ||
          normalizedAnswer === 'non' ||
          normalizedAnswer === '0'
        ) {
          setChildrenDetails('');
        } else {
          setChildrenDetails(rawAnswer);
        }
        break;
      }
      case 'disability': {
        if (
          normalizedAnswer === 'non' ||
          normalizedAnswer === 'aucun' ||
          normalizedAnswer === 'aucune' ||
          normalizedAnswer.includes('pas')
        ) {
          setDisabilityDetails("Personne dans le foyer n'est en situation de handicap ou reconnue par la MDPH.");
        } else {
          setDisabilityDetails(rawAnswer);
        }
        break;
      }
      case 'professional': {
        setProfessionalDetails(rawAnswer);
        break;
      }
      case 'income': {
        setIncomeDetails(rawAnswer);
        break;
      }
      case 'housingType': {
        const matched = HOUSING_OPTIONS.find((option) => {
          const normalizedLabel = normalizeText(option.label);
          const normalizedId = normalizeText(option.id);
          return (
            normalizedLabel === normalizedAnswer ||
            normalizedId === normalizedAnswer ||
            normalizedAnswer.includes(normalizedLabel) ||
            normalizedAnswer.includes(normalizedId)
          );
        });

        if (!matched) {
          setChatError('Indiquez si vous êtes locataire, propriétaire ou hébergé gratuitement.');
          return;
        }

        setHousingType(matched.id);
        setHasHousingAnswer(true);
        break;
      }
      case 'rent': {
        if (
          normalizedAnswer === 'non' ||
          normalizedAnswer === 'non applicable' ||
          normalizedAnswer === 'aucun' ||
          normalizedAnswer === '0' ||
          normalizedAnswer === 'zero'
        ) {
          setRentAmount('');
        } else {
          setRentAmount(rawAnswer);
        }
        break;
      }
      case 'lifeEvents': {
        if (
          normalizedAnswer === 'aucun' ||
          normalizedAnswer === 'aucune' ||
          normalizedAnswer === 'non' ||
          normalizedAnswer === 'rien'
        ) {
          setSelectedLifeEvents([]);
          setLifeEventNotes('');
          break;
        }

        const tokens = rawAnswer
          .split(/[;,/]/)
          .map((token) => token.trim())
          .filter((token) => token.length > 0);

        if (tokens.length === 0) {
          setSelectedLifeEvents([]);
          setLifeEventNotes('');
          break;
        }

        const recognized = new Set<string>();
        const unknown: string[] = [];

        tokens.forEach((token) => {
          const normalizedToken = normalizeText(token);
          const asIndex = Number.parseInt(normalizedToken, 10);
          if (
            Number.isFinite(asIndex) &&
            asIndex > 0 &&
            asIndex <= LIFE_EVENT_OPTIONS.length
          ) {
            recognized.add(LIFE_EVENT_OPTIONS[asIndex - 1].id);
            return;
          }

          const byId = LIFE_EVENT_OPTIONS.find((event) => normalizeText(event.id) === normalizedToken);
          if (byId) {
            recognized.add(byId.id);
            return;
          }

          const byLabel = LIFE_EVENT_OPTIONS.find((event) =>
            normalizeText(event.label).includes(normalizedToken) ||
            normalizedToken.includes(normalizeText(event.label)),
          );

          if (byLabel) {
            recognized.add(byLabel.id);
            return;
          }

          unknown.push(token);
        });

        const recognizedArray = Array.from(recognized);
        if (recognizedArray.length === 0) {
          setSelectedLifeEvents([]);
          setLifeEventNotes(rawAnswer);
        } else {
          setSelectedLifeEvents(recognizedArray);
          setLifeEventNotes(unknown.join(', '));
        }
        break;
      }
      case 'otherResources': {
        if (
          normalizedAnswer === 'non' ||
          normalizedAnswer === 'aucun' ||
          normalizedAnswer === 'aucune' ||
          normalizedAnswer === 'rien'
        ) {
          setOtherResources('');
        } else {
          setOtherResources(rawAnswer);
        }
        break;
      }
      default: {
        break;
      }
    }

    const nextStepIndex = currentChatStep + 1;

    setChatMessages((current) => {
      const updated: ChatMessage[] = [
        ...current,
        { id: `user-${Date.now()}`, role: 'user', text: rawAnswer },
      ];

      if (nextStepIndex < chatSteps.length) {
        const nextStep = chatSteps[nextStepIndex];
        updated.push({
          id: `bot-${nextStep.id}-${Date.now()}`,
          role: 'bot',
          text: nextStep.prompt,
        });
      } else {
        updated.push({
          id: 'bot-finish',
          role: 'bot',
          text:
            'Merci pour toutes ces précisions. Consultez le résumé généré ci-dessous puis cliquez sur « Utiliser ce résumé ».',
        });
      }

      return updated;
    });

    setCurrentChatStep(nextStepIndex);
    setChatInput('');
    setChatError(null);

    if (nextStepIndex >= chatSteps.length) {
      setIsChatFinished(true);
    }
  }, [chatInput, chatSteps, currentChatStep, isChatFinished]);

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
