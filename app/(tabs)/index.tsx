import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Bot, History as HistoryIcon, Sparkles } from 'lucide-react-native';
import Constants from 'expo-constants';

import ChatbotAssistant from '@/components/ChatbotAssistant';
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
  MAX_HISTORY_ENTRIES,
  loadSimulationHistory,
  saveSimulationToHistory,
} from '@/lib/history';
import type { SimulationHistoryEntry } from '@/types/simulation';

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
  const [showChatbot, setShowChatbot] = useState(false);

  const [historyEntries, setHistoryEntries] = useState<SimulationHistoryEntry[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const endpoints = useMemo(() => {
    const defaultBaseUrl = 'https://facilaide-plus-backend.onrender.com';
    const configBaseUrl =
      (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
      process.env.EXPO_PUBLIC_API_BASE_URL ??
      defaultBaseUrl;

    const normalizedBaseUrl = configBaseUrl.replace(/\/+$/, '');

    return {
      generateEndpoint: `${normalizedBaseUrl}/api/generate-json`,
      simulateEndpoint: `${normalizedBaseUrl}/api/simulate`,
      chatbotQuestionnaireEndpoint: `${normalizedBaseUrl}/api/chatbot/questionnaire`,
      chatbotNextEndpoint: `${normalizedBaseUrl}/api/chatbot/next`,
    } as const;
  }, []);

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

  const handleApplyChatbotSummary = useCallback((summary: string) => {
    setMessage(summary);
    setShowChatbot(false);
  }, []);

  const handleSimulate = useCallback(async () => {
    if (!message.trim()) {
      setError('Veuillez décrire votre situation');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const requestTimeoutMs = 5 * 60 * 1000;

      const generateResponse = await postJson<unknown>(
        endpoints.generateEndpoint,
        { message: message.trim() },
        { timeoutMs: requestTimeoutMs },
      );

      const rawJson = extractRawJson(generateResponse);

      if (!rawJson) {
        const parseError = new Error(
          'La génération de la situation a échoué. Réessayez dans quelques instants.',
        );
        (parseError as Error & { isUserFacing?: boolean }).isUserFacing = true;
        throw parseError;
      }

      const simulateResponse = await postJson<ApiSimulationResponse>(
        endpoints.simulateEndpoint,
        { json: rawJson },
        { timeoutMs: requestTimeoutMs },
      );

      const simulationPayload = buildSimulationPayload(
        (simulateResponse ?? {}) as ApiSimulationResponse,
        rawJson,
      );

      let serializedResults = '';
      try {
        serializedResults = JSON.stringify(simulationPayload);
      } catch (serializationError) {
        console.error('Erreur lors de la sérialisation des résultats:', serializationError);
        const userError = new Error(
          'La simulation a réussi mais les résultats sont trop volumineux pour être affichés.',
        );
        (userError as Error & { isUserFacing?: boolean }).isUserFacing = true;
        throw userError;
      }

      await saveSimulationToHistory({
        message: message.trim(),
        results: simulationPayload,
      });

      await refreshHistory();

      router.push({
        pathname: '/(tabs)/result',
        params: { results: serializedResults },
      });
    } catch (err) {
      if (err instanceof JsonParseError) {
        setError(err.message);
        return;
      }

      if (err instanceof HttpError) {
        setError('Impossible de contacter le service de simulation. Veuillez réessayer.');
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
  }, [endpoints.generateEndpoint, endpoints.simulateEndpoint, message, refreshHistory]);

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
              onPress={() => setShowChatbot((previous) => !previous)}>
              <View style={styles.guidedToggleHeader}>
                <Sparkles size={20} color="#4ba3c3" />
                <Text style={styles.guidedToggleTitle}>Chatbot questionnaire</Text>
              </View>
              <Text style={styles.guidedToggleSubtitle}>
                Répondez pas à pas pour préparer automatiquement un résumé complet avant de lancer la simulation.
              </Text>
            </TouchableOpacity>

            {showChatbot ? (
              <View style={styles.guidedContent}>
                <ChatbotAssistant
                  questionnaireEndpoint={endpoints.chatbotQuestionnaireEndpoint}
                  nextEndpoint={endpoints.chatbotNextEndpoint}
                  onApplySummary={handleApplyChatbotSummary}
                />
              </View>
            ) : null}
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

          {error ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

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
                        {secondBenefit ? (
                          <Text style={styles.historyBenefit}>
                            • {secondBenefit.label} ({secondBenefit.period})
                          </Text>
                        ) : null}
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
    paddingBottom: 32,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 36,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2b5c72',
  },
  subtitle: {
    fontSize: 16,
    color: '#466b7b',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  content: {
    paddingHorizontal: 20,
    gap: 24,
  },
  guidedSection: {
    gap: 16,
  },
  guidedToggle: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d3e2ea',
    gap: 8,
  },
  guidedToggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guidedToggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2b5c72',
  },
  guidedToggleSubtitle: {
    fontSize: 14,
    color: '#466b7b',
    lineHeight: 20,
  },
  guidedContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d3e2ea',
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2b5c72',
  },
  textInput: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#ccdbe3',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff',
    fontSize: 15,
    color: '#1c3f4f',
  },
  errorContainer: {
    padding: 12,
    backgroundColor: '#fdecea',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  errorText: {
    color: '#b94a48',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#4ba3c3',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
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
    backgroundColor: '#eef6fb',
    borderRadius: 16,
    padding: 16,
  },
  infoText: {
    color: '#2b5c72',
    fontSize: 14,
    lineHeight: 20,
  },
  historySection: {
    gap: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyHeaderText: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2b5c72',
  },
  historySubtitle: {
    fontSize: 13,
    color: '#466b7b',
  },
  historyLoader: {
    paddingVertical: 24,
  },
  historyError: {
    color: '#b94a48',
    fontSize: 14,
  },
  historyEmpty: {
    color: '#466b7b',
    fontSize: 14,
    fontStyle: 'italic',
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d3e2ea',
    gap: 12,
  },
  historyDate: {
    color: '#466b7b',
    fontSize: 13,
  },
  historyMessage: {
    color: '#1c3f4f',
    fontSize: 15,
    lineHeight: 20,
  },
  historyBenefits: {
    gap: 4,
  },
  historyBenefit: {
    color: '#2b5c72',
    fontSize: 14,
  },
  historyActions: {
    flexDirection: 'row',
    gap: 12,
  },
  historyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  historyPrimaryButton: {
    backgroundColor: '#4ba3c3',
  },
  historySecondaryButton: {
    borderWidth: 1,
    borderColor: '#4ba3c3',
    backgroundColor: '#fff',
  },
  historyButtonTextPrimary: {
    color: '#fff',
    fontWeight: '600',
  },
  historyButtonTextSecondary: {
    color: '#2b5c72',
    fontWeight: '600',
  },
  historyShareButton: {
    borderWidth: 1,
    borderColor: '#4ba3c3',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  historyShareText: {
    color: '#2b5c72',
    fontWeight: '600',
  },
});
