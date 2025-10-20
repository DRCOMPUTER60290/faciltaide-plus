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

import {
  CHAT_PLAN_STEPS,
  MULTI_SELECT_SEPARATOR,
  type ChatMultiSelectOption,
  type ChatStep,
} from '@/lib/chat-plan';
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

const calculateAge = (birthDate: Date, referenceDate: Date = new Date()): number => {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const monthDifference = referenceDate.getMonth() - birthDate.getMonth();

  if (monthDifference < 0 || (monthDifference === 0 && referenceDate.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age < 0 ? 0 : age;
};

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
  const [multiSelectSelections, setMultiSelectSelections] = useState<string[]>([]);
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

    if (activeChatStep.multiSelectOptions?.length) {
      return [] as string[];
    }

    if (activeChatStep.id === 'housing-city' && postalCodeCities.length > 0) {
      return postalCodeCities;
    }

    return activeChatStep.options ?? [];
  }, [activeChatStep, postalCodeCities]);

  const activeMultiSelectOptions = useMemo<ChatMultiSelectOption[]>(
    () => activeChatStep?.multiSelectOptions ?? [],
    [activeChatStep],
  );

  const parseMultiSelectAnswer = useCallback((value?: string): string[] => {
    if (!value) {
      return [];
    }

    return value
      .split(';')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }, []);

  const groupedMultiSelectOptions = useMemo(
    () =>
      activeMultiSelectOptions.reduce(
        (groups, option) => {
          const groupLabel = option.group ?? 'Autres';
          const existingGroup = groups.find((group) => group.label === groupLabel);

          if (existingGroup) {
            existingGroup.options.push(option);
          } else {
            groups.push({ label: groupLabel, options: [option] });
          }

          return groups;
        },
        [] as { label: string; options: ChatMultiSelectOption[] }[],
      ),
    [activeMultiSelectOptions],
  );

  useEffect(() => {
    if (!activeChatStep?.multiSelectOptions?.length) {
      setMultiSelectSelections([]);
      return;
    }

    const existingAnswer = guidedAnswers[activeChatStep.id];
    setMultiSelectSelections(parseMultiSelectAnswer(existingAnswer));
  }, [activeChatStep, guidedAnswers, parseMultiSelectAnswer]);

  const toggleMultiSelectOption = useCallback(
    (label: string) => {
      const normalizedLabel = label.trim();
      setMultiSelectSelections((current) => {
        if (current.includes(normalizedLabel)) {
          return current.filter((value) => value !== normalizedLabel);
        }

        const orderedLabels = activeMultiSelectOptions.map((option) => option.label.trim());
        const updated = [...current, normalizedLabel];
        return updated.sort((a, b) => orderedLabels.indexOf(a) - orderedLabels.indexOf(b));
      });
    },
    [activeMultiSelectOptions],
  );

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

  const handleMultiSelectSubmit = useCallback(() => {
    if (isChatFinished) {
      return;
    }

    if (!activeMultiSelectOptions.length) {
      return;
    }

    if (!multiSelectSelections.length) {
      setChatError('Veuillez sélectionner au moins une option.');
      return;
    }

    const formattedAnswer = multiSelectSelections.join(MULTI_SELECT_SEPARATOR);
    handleChatSubmit(formattedAnswer);
    setMultiSelectSelections([]);
  }, [
    activeMultiSelectOptions,
    handleChatSubmit,
    isChatFinished,
    multiSelectSelections,
  ]);

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

                  {activeMultiSelectOptions.length > 0 && (
                    <View style={styles.multiSelectContainer}>
                      {activeChatStep?.multiSelectHint ? (
                        <Text style={styles.multiSelectHintText}>{activeChatStep.multiSelectHint}</Text>
                      ) : null}
                      {groupedMultiSelectOptions.map((group) => (
                        <View key={group.label} style={styles.multiSelectGroup}>
                          {group.label.trim().length > 0 && (
                            <Text style={styles.multiSelectGroupLabel}>{group.label}</Text>
                          )}
                          {group.options.map((option) => {
                            const isSelected = multiSelectSelections.includes(option.label);
                            return (
                              <TouchableOpacity
                                key={option.label}
                                style={[
                                  styles.multiSelectOption,
                                  isSelected && styles.multiSelectOptionSelected,
                                  isChatFinished && styles.multiSelectOptionDisabled,
                                ]}
                                onPress={() => toggleMultiSelectOption(option.label)}
                                disabled={isChatFinished}>
                                <Text
                                  style={[
                                    styles.multiSelectOptionText,
                                    isSelected && styles.multiSelectOptionTextSelected,
                                  ]}>
                                  {option.label}
                                </Text>
                                {option.description ? (
                                  <Text style={styles.multiSelectOptionDescription}>{option.description}</Text>
                                ) : null}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      ))}
                      <TouchableOpacity
                        style={[
                          styles.multiSelectSubmitButton,
                          (isChatFinished || multiSelectSelections.length === 0) &&
                            styles.multiSelectSubmitButtonDisabled,
                        ]}
                        onPress={handleMultiSelectSubmit}
                        disabled={isChatFinished || multiSelectSelections.length === 0}>
                        <Text
                          style={[
                            styles.multiSelectSubmitButtonText,
                            (isChatFinished || multiSelectSelections.length === 0) &&
                              styles.multiSelectSubmitButtonTextDisabled,
                          ]}>
                          Valider la sélection
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

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
  multiSelectContainer: {
    marginBottom: 12,
    backgroundColor: '#e8f4fb',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d0e4f1',
  },
  multiSelectHintText: {
    fontSize: 13,
    color: '#2d6a7a',
    marginBottom: 8,
  },
  multiSelectGroup: {
    marginBottom: 12,
  },
  multiSelectGroupLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2d6a7a',
    marginBottom: 6,
  },
  multiSelectOption: {
    borderWidth: 1,
    borderColor: '#4ba3c3',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  multiSelectOptionSelected: {
    backgroundColor: '#4ba3c3',
    borderColor: '#4ba3c3',
  },
  multiSelectOptionDisabled: {
    opacity: 0.6,
  },
  multiSelectOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2d6a7a',
  },
  multiSelectOptionTextSelected: {
    color: '#fff',
  },
  multiSelectOptionDescription: {
    fontSize: 12,
    color: '#2d6a7a',
    marginTop: 4,
  },
  multiSelectSubmitButton: {
    marginTop: 4,
    backgroundColor: '#4ba3c3',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  multiSelectSubmitButtonDisabled: {
    backgroundColor: '#aacfe0',
  },
  multiSelectSubmitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  multiSelectSubmitButtonTextDisabled: {
    color: '#e6f4f9',
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
