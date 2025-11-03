import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

import {
  ChatbotAnswerValue,
  ChatbotMessage,
  ChatbotQuestion,
  ChatbotSummaryEntry,
  buildChatbotSummary,
  cloneAnswers,
  cloneSummaryEntries,
  fetchChatbotNext,
  fetchChatbotQuestionnaire,
} from '@/lib/chatbot';
import { HttpError, JsonParseError, isAbortError, isNetworkError } from '@/lib/http';

type ChatbotAssistantProps = {
  questionnaireEndpoint: string;
  nextEndpoint: string;
  onApplySummary?: (summary: string) => void;
};

type ChatbotSnapshot = {
  messages: ChatbotMessage[];
  answers: Record<string, ChatbotAnswerValue>;
  answeredQuestions: ChatbotSummaryEntry[];
  currentQuestion: ChatbotQuestion | null;
  completed: boolean;
};

type NormalizedOption = { label: string; value: string };

const buildMessageId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const createSnapshot = (snapshot: ChatbotSnapshot): ChatbotSnapshot => ({
  messages: snapshot.messages.map((message) => ({ ...message })),
  answers: cloneAnswers(snapshot.answers),
  answeredQuestions: cloneSummaryEntries(snapshot.answeredQuestions),
  currentQuestion: snapshot.currentQuestion,
  completed: snapshot.completed,
});

const toNormalizedOptions = (question: ChatbotQuestion | null): NormalizedOption[] => {
  if (!question || !Array.isArray(question.options)) {
    return [];
  }

  return question.options
    .map((option) => {
      if (typeof option === 'string') {
        const trimmed = option.trim();
        if (!trimmed.length) {
          return null;
        }
        return { label: trimmed, value: trimmed } satisfies NormalizedOption;
      }

      if (option && typeof option === 'object') {
        const label = typeof (option as { label?: unknown }).label === 'string'
          ? ((option as { label: string }).label.trim() ?? '')
          : null;
        const valueCandidate = typeof (option as { value?: unknown }).value === 'string'
          ? ((option as { value: string }).value.trim() ?? '')
          : null;

        const value = valueCandidate && valueCandidate.length ? valueCandidate : label;
        const normalizedLabel = label && label.length ? label : value;

        if (!value || !normalizedLabel) {
          return null;
        }

        return { label: normalizedLabel, value } satisfies NormalizedOption;
      }

      return null;
    })
    .filter((entry): entry is NormalizedOption => Boolean(entry));
};

const parseIsoDate = (value: string | null | undefined): Date | null => {
  if (!value) {
    return null;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10) - 1;
  const day = Number.parseInt(match[3], 10);

  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
};

const formatDateForAnswer = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function ChatbotAssistant({
  questionnaireEndpoint,
  nextEndpoint,
  onApplySummary,
}: ChatbotAssistantProps) {
  const [metaDescription, setMetaDescription] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [answers, setAnswers] = useState<Record<string, ChatbotAnswerValue>>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<ChatbotSummaryEntry[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<ChatbotQuestion | null>(null);
  const [history, setHistory] = useState<ChatbotSnapshot[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [textInputValue, setTextInputValue] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedBoolean, setSelectedBoolean] = useState<boolean | null>(null);
  const [selectedMultiOptions, setSelectedMultiOptions] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [pendingDate, setPendingDate] = useState<Date | null>(null);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  const scrollRef = useRef<ScrollView | null>(null);

  const normalizedOptions = useMemo(() => toNormalizedOptions(currentQuestion), [currentQuestion]);

  const summary = useMemo(() => buildChatbotSummary(answeredQuestions), [answeredQuestions]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const resetInputStates = useCallback(() => {
    setTextInputValue('');
    setSelectedOption(null);
    setSelectedBoolean(null);
    setSelectedMultiOptions([]);
    setSelectedDate(null);
    setPendingDate(null);
    setIsDatePickerVisible(false);
  }, []);

  useEffect(() => {
    if (!currentQuestion) {
      resetInputStates();
      return;
    }

    const existingAnswer = answers[currentQuestion.id];

    if (typeof existingAnswer === 'string') {
      setTextInputValue(existingAnswer);
    } else {
      setTextInputValue('');
    }

    if (typeof existingAnswer === 'number') {
      setTextInputValue(String(existingAnswer));
    }

    if (typeof existingAnswer === 'boolean') {
      setSelectedBoolean(existingAnswer);
    } else {
      setSelectedBoolean(null);
    }

    if (Array.isArray(existingAnswer)) {
      setSelectedMultiOptions(existingAnswer.filter((entry): entry is string => typeof entry === 'string'));
    } else {
      setSelectedMultiOptions([]);
    }

    if (typeof existingAnswer === 'string') {
      setSelectedOption(existingAnswer);
    } else {
      setSelectedOption(null);
    }

    const parsedDate =
      typeof existingAnswer === 'string' ? parseIsoDate(existingAnswer) : null;
    setSelectedDate(parsedDate);
    setPendingDate(parsedDate);
  }, [answers, currentQuestion, resetInputStates]);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof JsonParseError) {
      setError(err.message);
      return;
    }

    if (err instanceof HttpError) {
      setError('Le service chatbot est momentanément indisponible.');
      return;
    }

    if (isNetworkError(err)) {
      setError('Connexion réseau impossible. Vérifiez votre accès à Internet.');
      return;
    }

    if (isAbortError(err)) {
      setError('La requête a été interrompue. Réessayez.');
      return;
    }

    if (err instanceof Error) {
      setError(err.message);
      return;
    }

    setError('Une erreur inattendue est survenue.');
  }, []);

  const startChatbot = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const definition = await fetchChatbotQuestionnaire(questionnaireEndpoint).catch((definitionError) => {
        console.warn('Impossible de récupérer la définition du questionnaire', definitionError);
        return null;
      });

      const description = definition?.meta?.description;
      setMetaDescription(typeof description === 'string' ? description : null);

      const next = await fetchChatbotNext(nextEndpoint, {});

      const introMessages: ChatbotMessage[] = [
        {
          id: buildMessageId('system-intro'),
          role: 'system',
          text:
            "Je vais vous poser quelques questions pour préparer votre simulation. Vous pouvez revenir en arrière ou passer une question optionnelle.",
        },
      ];

      if (definition?.meta?.title && typeof definition.meta.title === 'string') {
        introMessages.unshift({
          id: buildMessageId('system-title'),
          role: 'system',
          text: definition.meta.title,
        });
      }

      const questionMessages = next.question
        ? [
            ...introMessages,
            {
              id: buildMessageId('bot-question'),
              role: 'bot',
              text: next.question.label,
              sectionTitle: next.question.section?.title ?? null,
            } satisfies ChatbotMessage,
          ]
        : introMessages;

      setMessages(questionMessages);
      setAnswers({});
      setAnsweredQuestions([]);
      setCurrentQuestion(next.question);
      setIsCompleted(next.completed);
      setHistory([
        createSnapshot({
          messages: questionMessages,
          answers: {},
          answeredQuestions: [],
          currentQuestion: next.question,
          completed: next.completed,
        }),
      ]);
      setInitialized(true);
    } catch (err) {
      handleError(err);
      setInitialized(false);
    } finally {
      setIsLoading(false);
    }
  }, [handleError, nextEndpoint, questionnaireEndpoint]);

  useEffect(() => {
    void startChatbot();
  }, [startChatbot]);

  const submitAnswer = useCallback(
    async (value: ChatbotAnswerValue, displayValue: string) => {
      if (!currentQuestion) {
        return;
      }

      const previousMessages = messages;
      const previousAnswers = answers;
      const previousEntries = answeredQuestions;
      const previousHistory = history;
      const previousQuestion = currentQuestion;
      const previousCompleted = isCompleted;

      const userMessage: ChatbotMessage = {
        id: buildMessageId('user-answer'),
        role: 'user',
        text: displayValue,
      };

      const messagesAfterUser = [...messages, userMessage];
      const updatedAnswers = { ...answers, [currentQuestion.id]: value };
      const updatedEntries = [
        ...answeredQuestions.filter((entry) => entry.question.id !== currentQuestion.id),
        { question: currentQuestion, answer: value },
      ];

      setMessages(messagesAfterUser);
      setAnswers(updatedAnswers);
      setAnsweredQuestions(updatedEntries);
      setError(null);
      setIsLoading(true);

      try {
        const result = await fetchChatbotNext(nextEndpoint, updatedAnswers);

        if (result.question) {
          const questionMessage: ChatbotMessage = {
            id: buildMessageId('bot-question'),
            role: 'bot',
            text: result.question.label,
            sectionTitle: result.question.section?.title ?? null,
          };

          const newMessages = [...messagesAfterUser, questionMessage];
          const snapshot = createSnapshot({
            messages: newMessages,
            answers: updatedAnswers,
            answeredQuestions: updatedEntries,
            currentQuestion: result.question,
            completed: false,
          });

          setMessages(newMessages);
          setCurrentQuestion(result.question);
          setIsCompleted(false);
          setHistory((previous) => [...previous, snapshot]);
        } else {
          const completionMessage: ChatbotMessage = {
            id: buildMessageId('bot-complete'),
            role: 'bot',
            text: 'Merci pour vos réponses. Vous pouvez désormais utiliser le résumé généré ou relancer le chatbot.',
          };

          const newMessages = [...messagesAfterUser, completionMessage];
          const snapshot = createSnapshot({
            messages: newMessages,
            answers: updatedAnswers,
            answeredQuestions: updatedEntries,
            currentQuestion: null,
            completed: true,
          });

          setMessages(newMessages);
          setCurrentQuestion(null);
          setIsCompleted(true);
          setHistory((previous) => [...previous, snapshot]);
        }
      } catch (err) {
        setMessages(previousMessages);
        setAnswers(previousAnswers);
        setAnsweredQuestions(previousEntries);
        setHistory(previousHistory);
        setCurrentQuestion(previousQuestion);
        setIsCompleted(previousCompleted);
        handleError(err);
      } finally {
        setIsLoading(false);
      }
    },
    [answers, answeredQuestions, currentQuestion, handleError, history, isCompleted, messages, nextEndpoint],
  );

  const handleValidationError = useCallback((message: string) => {
    setError(message);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!currentQuestion) {
      return;
    }

    if (currentQuestion.type === 'text') {
      const trimmed = textInputValue.trim();
      if (!trimmed.length) {
        if (currentQuestion.required) {
          handleValidationError('Veuillez renseigner une réponse.');
          return;
        }
        void submitAnswer(null, "Je passe cette question.");
        return;
      }

      const pattern = typeof currentQuestion.validation?.pattern === 'string'
        ? currentQuestion.validation.pattern
        : null;

      if (pattern) {
        try {
          const regex = new RegExp(pattern);
          if (!regex.test(trimmed)) {
            const message = typeof currentQuestion.validation?.message === 'string'
              ? currentQuestion.validation.message
              : 'La réponse ne respecte pas le format attendu.';
            handleValidationError(message);
            return;
          }
        } catch (regexError) {
          console.warn('Expression régulière invalide pour la question du chatbot', regexError);
        }
      }

      void submitAnswer(trimmed, trimmed);
      return;
    }

    if (currentQuestion.type === 'number') {
      const trimmed = textInputValue.trim();
      if (!trimmed.length) {
        if (currentQuestion.required) {
          handleValidationError('Veuillez saisir une valeur numérique.');
          return;
        }
        void submitAnswer(null, "Je passe cette question.");
        return;
      }

      const parsed = Number(trimmed.replace(',', '.'));
      if (!Number.isFinite(parsed)) {
        handleValidationError('Veuillez saisir un nombre valide.');
        return;
      }

      const min = typeof currentQuestion.validation?.min === 'number'
        ? currentQuestion.validation.min
        : undefined;
      const max = typeof currentQuestion.validation?.max === 'number'
        ? currentQuestion.validation.max
        : undefined;

      if (min !== undefined && parsed < min) {
        handleValidationError(`La valeur doit être supérieure ou égale à ${min}.`);
        return;
      }

      if (max !== undefined && parsed > max) {
        handleValidationError(`La valeur doit être inférieure ou égale à ${max}.`);
        return;
      }

      void submitAnswer(parsed, `${parsed}${currentQuestion.unit ? ` ${currentQuestion.unit}` : ''}`.trim());
      return;
    }

    if (currentQuestion.type === 'select') {
      if (!selectedOption) {
        handleValidationError('Veuillez sélectionner une option.');
        return;
      }

      void submitAnswer(selectedOption, selectedOption);
      return;
    }

    if (currentQuestion.type === 'boolean') {
      if (selectedBoolean === null) {
        handleValidationError('Veuillez sélectionner Oui ou Non.');
        return;
      }

      void submitAnswer(selectedBoolean, selectedBoolean ? 'Oui' : 'Non');
      return;
    }

    if (currentQuestion.type === 'multi_select') {
      if (!selectedMultiOptions.length) {
        if (currentQuestion.required) {
          handleValidationError('Veuillez choisir au moins une option.');
          return;
        }

        void submitAnswer([], 'Aucune sélection.');
        return;
      }

      const displayValue = selectedMultiOptions.join(', ');
      void submitAnswer([...selectedMultiOptions], displayValue);
      return;
    }

    if (currentQuestion.type === 'date') {
      if (!selectedDate) {
        if (currentQuestion.required) {
          handleValidationError('Veuillez choisir une date.');
          return;
        }

        void submitAnswer(null, "Je passe cette question.");
        return;
      }

      const answerValue = formatDateForAnswer(selectedDate);
      const displayValue = formatDateForDisplay(selectedDate);
      void submitAnswer(answerValue, displayValue);
      return;
    }
  }, [currentQuestion, handleValidationError, selectedBoolean, selectedDate, selectedMultiOptions, selectedOption, submitAnswer, textInputValue]);

  const handleSkipQuestion = useCallback(() => {
    if (!currentQuestion || currentQuestion.required) {
      return;
    }

    void submitAnswer(null, "Je passe cette question.");
  }, [currentQuestion, submitAnswer]);

  const handleGoBack = useCallback(() => {
    if (history.length <= 1 || isLoading) {
      return;
    }

    const newHistory = history.slice(0, -1);
    const previousSnapshot = newHistory[newHistory.length - 1];

    setHistory(newHistory);
    setMessages(previousSnapshot.messages);
    setAnswers(previousSnapshot.answers);
    setAnsweredQuestions(previousSnapshot.answeredQuestions);
    setCurrentQuestion(previousSnapshot.currentQuestion);
    setIsCompleted(previousSnapshot.completed);
    setError(null);
  }, [history, isLoading]);

  const handleRestart = useCallback(() => {
    if (isLoading) {
      return;
    }

    setHistory([]);
    void startChatbot();
  }, [isLoading, startChatbot]);

  const openDatePicker = useCallback(() => {
    if (!currentQuestion || currentQuestion.type !== 'date') {
      return;
    }

    const referenceDate = selectedDate ?? new Date();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: referenceDate,
        mode: 'date',
        display: 'calendar',
        onChange: (event: DateTimePickerEvent, chosen?: Date) => {
          if (event.type === 'set' && chosen) {
            setSelectedDate(chosen);
            setPendingDate(chosen);
            setError(null);
          }
        },
      });
      return;
    }

    if (Platform.OS === 'ios') {
      setPendingDate(referenceDate);
      setIsDatePickerVisible(true);
    }
  }, [currentQuestion, selectedDate]);

  const handleDateChange = useCallback((event: DateTimePickerEvent, chosen?: Date) => {
    if (Platform.OS === 'ios' && event.type === 'set' && chosen) {
      setPendingDate(chosen);
    }
  }, []);

  const handleCancelDate = useCallback(() => {
    setIsDatePickerVisible(false);
  }, []);

  const handleConfirmDate = useCallback(() => {
    if (pendingDate) {
      setSelectedDate(pendingDate);
      setError(null);
    }
    setIsDatePickerVisible(false);
  }, [pendingDate]);

  const handleApplySummary = useCallback(() => {
    if (!onApplySummary || !summary.trim().length) {
      return;
    }

    onApplySummary(summary);
  }, [onApplySummary, summary]);

  const renderOptions = () => {
    if (!currentQuestion) {
      return null;
    }

    if (currentQuestion.type === 'select') {
      return (
        <View style={styles.optionsContainer}>
          {normalizedOptions.map((option) => {
            const isActive = selectedOption === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, isActive && styles.optionButtonActive]}
                onPress={() => {
                  setSelectedOption(option.value);
                  setError(null);
                }}
                disabled={isLoading}
              >
                <Text style={[styles.optionButtonText, isActive && styles.optionButtonTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    if (currentQuestion.type === 'multi_select') {
      return (
        <View style={styles.optionsContainer}>
          {normalizedOptions.map((option) => {
            const isActive = selectedMultiOptions.includes(option.value);
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.optionButton, styles.multiSelectOption, isActive && styles.optionButtonActive]}
                onPress={() => {
                  setSelectedMultiOptions((previous) => {
                    if (previous.includes(option.value)) {
                      return previous.filter((value) => value !== option.value);
                    }
                    return [...previous, option.value];
                  });
                  setError(null);
                }}
                disabled={isLoading}
              >
                <Text style={[styles.optionButtonText, isActive && styles.optionButtonTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    if (currentQuestion.type === 'boolean') {
      return (
        <View style={styles.optionsContainer}>
          <TouchableOpacity
            style={[styles.optionButton, selectedBoolean === true && styles.optionButtonActive]}
            onPress={() => {
              setSelectedBoolean(true);
              setError(null);
            }}
            disabled={isLoading}
          >
            <Text style={[styles.optionButtonText, selectedBoolean === true && styles.optionButtonTextActive]}>Oui</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.optionButton, selectedBoolean === false && styles.optionButtonActive]}
            onPress={() => {
              setSelectedBoolean(false);
              setError(null);
            }}
            disabled={isLoading}
          >
            <Text style={[styles.optionButtonText, selectedBoolean === false && styles.optionButtonTextActive]}>Non</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (currentQuestion.type === 'date') {
      return (
        <View style={styles.dateContainer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={openDatePicker} disabled={isLoading}>
            <Text style={styles.secondaryButtonText}>Choisir une date</Text>
          </TouchableOpacity>
          {selectedDate ? (
            <Text style={styles.datePreview}>Date sélectionnée : {formatDateForDisplay(selectedDate)}</Text>
          ) : null}
        </View>
      );
    }

    return null;
  };

  const renderInput = () => {
    if (!currentQuestion || isCompleted) {
      return null;
    }

    const isTextual = currentQuestion.type === 'text' || currentQuestion.type === 'number';

    return (
      <View style={styles.inputSection}>
        {isTextual ? (
          <TextInput
            style={styles.input}
            placeholder="Écrivez votre réponse ici"
            placeholderTextColor="#777"
            value={textInputValue}
            onChangeText={(value) => {
              setTextInputValue(value);
              setError(null);
            }}
            editable={!isLoading}
            keyboardType={currentQuestion.type === 'number' ? 'decimal-pad' : 'default'}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        ) : null}

        {renderOptions()}

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}

        <View style={styles.actionsRow}>
          {!currentQuestion.required ? (
            <TouchableOpacity
              style={[styles.secondaryButton, styles.skipButton]}
              onPress={handleSkipQuestion}
              disabled={isLoading}
            >
              <Text style={styles.secondaryButtonText}>Passer</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>Valider</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const canGoBack = history.length > 1 && !isLoading;

  return (
    <View style={styles.container}>
      {metaDescription ? (
        <View style={styles.metaBox}>
          <Text style={styles.metaText}>{metaDescription}</Text>
        </View>
      ) : null}

      <View style={styles.chatContainer}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.chatContent} keyboardShouldPersistTaps="handled">
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.role === 'user' ? styles.messageBubbleUser : styles.messageBubbleBot,
              ]}
            >
              {message.sectionTitle ? (
                <Text
                  style={[
                    styles.sectionLabel,
                    message.role === 'user' ? styles.sectionLabelUser : styles.sectionLabelBot,
                  ]}
                >
                  {message.sectionTitle}
                </Text>
              ) : null}
              <Text
                style={[
                  styles.messageText,
                  message.role === 'user' ? styles.messageTextUser : styles.messageTextBot,
                ]}
              >
                {message.text}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {renderInput()}

      {isCompleted ? (
        <View style={styles.summarySection}>
          {summary ? (
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Résumé des réponses</Text>
              <Text style={styles.summaryContent}>{summary}</Text>
              {onApplySummary ? (
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleApplySummary}
                  disabled={isLoading}
                >
                  <Text style={styles.primaryButtonText}>Utiliser ce résumé</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : (
            <Text style={styles.summaryEmpty}>Aucun résumé disponible.</Text>
          )}

          <TouchableOpacity style={styles.secondaryButton} onPress={handleRestart} disabled={isLoading}>
            <Text style={styles.secondaryButtonText}>Relancer le chatbot</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.footerActions}>
        <TouchableOpacity
          style={[styles.secondaryButton, !canGoBack && styles.secondaryButtonDisabled]}
          onPress={handleGoBack}
          disabled={!canGoBack}
        >
          <Text style={styles.secondaryButtonText}>Question précédente</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleRestart} disabled={isLoading}>
          <Text style={styles.secondaryButtonText}>Réinitialiser</Text>
        </TouchableOpacity>
      </View>

      {!initialized && !isLoading && error ? (
        <TouchableOpacity style={styles.primaryButton} onPress={handleRestart}>
          <Text style={styles.primaryButtonText}>Réessayer</Text>
        </TouchableOpacity>
      ) : null}

      {isLoading ? (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="small" color="#fff" />
        </View>
      ) : null}

      <Modal visible={isDatePickerVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <DateTimePicker
              value={pendingDate ?? new Date()}
              mode="date"
              display="spinner"
              onChange={handleDateChange}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleCancelDate}>
                <Text style={styles.secondaryButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleConfirmDate}>
                <Text style={styles.primaryButtonText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  metaBox: {
    backgroundColor: '#eef6fb',
    padding: 12,
    borderRadius: 12,
  },
  metaText: {
    color: '#2b5c72',
    fontSize: 14,
    lineHeight: 20,
  },
  chatContainer: {
    maxHeight: 320,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d3e2ea',
    overflow: 'hidden',
  },
  chatContent: {
    padding: 16,
    gap: 12,
  },
  messageBubble: {
    maxWidth: '90%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleBot: {
    alignSelf: 'flex-start',
    backgroundColor: '#f2f8fb',
  },
  messageBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#4ba3c3',
  },
  sectionLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  sectionLabelBot: {
    color: '#2b5c72',
    fontWeight: '600',
  },
  sectionLabelUser: {
    color: '#cce9f3',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextBot: {
    color: '#1c3f4f',
  },
  messageTextUser: {
    color: '#fff',
  },
  inputSection: {
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#c2d9e2',
    borderRadius: 12,
    padding: 12,
    minHeight: 96,
    fontSize: 15,
    color: '#1c3f4f',
    backgroundColor: '#fff',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4ba3c3',
    backgroundColor: '#fff',
  },
  optionButtonActive: {
    backgroundColor: '#4ba3c3',
  },
  optionButtonText: {
    color: '#2b5c72',
    fontSize: 14,
  },
  optionButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  multiSelectOption: {
    minWidth: '45%',
  },
  dateContainer: {
    gap: 8,
  },
  datePreview: {
    color: '#2b5c72',
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#4ba3c3',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    flexGrow: 1,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#4ba3c3',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    flexGrow: 1,
    backgroundColor: '#fff',
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: '#2b5c72',
    fontWeight: '600',
    fontSize: 15,
  },
  skipButton: {
    flexGrow: 0,
  },
  errorText: {
    color: '#d9534f',
    fontSize: 14,
  },
  summarySection: {
    gap: 12,
  },
  summaryBox: {
    backgroundColor: '#f2f8fb',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  summaryTitle: {
    fontWeight: '700',
    fontSize: 16,
    color: '#2b5c72',
  },
  summaryContent: {
    color: '#1c3f4f',
    fontSize: 14,
    lineHeight: 20,
  },
  summaryEmpty: {
    color: '#2b5c72',
    fontStyle: 'italic',
    fontSize: 14,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    maxWidth: 360,
    gap: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
});

