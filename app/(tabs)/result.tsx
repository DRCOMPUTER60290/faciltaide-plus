import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, ArrowLeft, Euro } from 'lucide-react-native';

import type { AvailableBenefit, SimulationResultPayload } from '@/types/simulation';

const PERIOD_MONTH_REGEX = /^\d{4}-\d{2}$/;
const PERIOD_YEAR_REGEX = /^\d{4}$/;

const ENTITY_LABELS: Record<string, string> = {
  individu: 'Individu',
  famille: 'Famille',
  menage: 'Ménage',
};

const isAvailableBenefit = (value: unknown): value is AvailableBenefit => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.label === 'string' &&
    typeof candidate.entity === 'string' &&
    typeof candidate.period === 'string' &&
    typeof candidate.amount === 'number'
  );
};

const isSimulationResultPayload = (value: unknown): value is SimulationResultPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<SimulationResultPayload> & Record<string, unknown>;

  if (!Array.isArray(candidate.availableBenefits)) {
    return false;
  }

  if (candidate.explanation !== null && typeof candidate.explanation !== 'string') {
    return false;
  }

  if (typeof candidate.generatedAt !== 'string') {
    return false;
  }

  return candidate.availableBenefits.every(isAvailableBenefit);
};

const safeStringify = (value: unknown): string | null => {
  try {
    if (value === undefined) {
      return null;
    }

    return JSON.stringify(value, null, 2);
  } catch (error) {
    console.warn('Impossible de sérialiser les données de simulation:', error);
    return null;
  }
};

const formatEntityLabel = (entity: string) => {
  return ENTITY_LABELS[entity] ?? entity;
};

const formatCurrency = (amount: number): string => {
  const sign = amount < 0 ? '-' : '';
  const absolute = Math.abs(amount);
  const [integerPart, decimalPart] = absolute.toFixed(2).split('.');
  const withSeparators = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  return `${sign}${withSeparators},${decimalPart} €`;
};

const formatAmountWithPeriod = (amount: number, period: string): string => {
  if (PERIOD_MONTH_REGEX.test(period)) {
    return `${formatCurrency(amount)} / mois`;
  }
  if (PERIOD_YEAR_REGEX.test(period)) {
    return `${formatCurrency(amount)} / an`;
  }
  return `${formatCurrency(amount)} (période ${period})`;
};

const formatBenefitMeta = (benefit: AvailableBenefit): string => {
  if (PERIOD_MONTH_REGEX.test(benefit.period)) {
    return `${formatEntityLabel(benefit.entity)} · période ${benefit.period}`;
  }
  if (PERIOD_YEAR_REGEX.test(benefit.period)) {
    return `${formatEntityLabel(benefit.entity)} · année ${benefit.period}`;
  }
  return `${formatEntityLabel(benefit.entity)} · période ${benefit.period}`;
};

const formatTimestamp = (isoString: string | undefined): string | null => {
  if (!isoString || typeof isoString !== 'string') {
    return null;
  }

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} à ${hours}h${minutes}`;
};

export default function ResultScreen() {
  const params = useLocalSearchParams();
  const [results, setResults] = useState<SimulationResultPayload | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  const [showResultData, setShowResultData] = useState(false);

  useEffect(() => {
    if (typeof params.results === 'string') {
      try {
        const parsed = JSON.parse(params.results);
        if (isSimulationResultPayload(parsed)) {
          setResults(parsed);
          setParseError(null);
        } else {
          setResults(null);
          setParseError('Le format des données de simulation est invalide.');
        }
      } catch (error) {
        console.error('Error parsing results:', error);
        setResults(null);
        setParseError('Impossible de lire les résultats renvoyés par le serveur.');
      }
    } else {
      setResults(null);
      setParseError(null);
    }
  }, [params.results]);

  useEffect(() => {
    setShowRawJson(false);
    setShowPayload(false);
    setShowResultData(false);
  }, [results?.generatedAt]);

  const handleNewSimulation = () => {
    router.push('/(tabs)/');
  };

  if (!results) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleNewSimulation}>
            <ArrowLeft size={24} color="#4ba3c3" />
          </TouchableOpacity>
          <Text style={styles.title}>Vos aides sociales</Text>
        </View>

        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {parseError ?? "Aucun résultat disponible. Effectuez une simulation d'abord."}
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleNewSimulation}>
            <Text style={styles.buttonText}>Nouvelle simulation</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const formattedTimestamp = useMemo(
    () => formatTimestamp(results.generatedAt),
    [results.generatedAt]
  );

  const benefitTotals = useMemo(() => {
    let monthlyTotal = 0;
    let yearlyTotal = 0;
    let monthlyCount = 0;
    let yearlyCount = 0;

    results.availableBenefits.forEach((benefit) => {
      if (PERIOD_MONTH_REGEX.test(benefit.period)) {
        monthlyTotal += benefit.amount;
        monthlyCount += 1;
        return;
      }

      if (PERIOD_YEAR_REGEX.test(benefit.period)) {
        yearlyTotal += benefit.amount;
        yearlyCount += 1;
      }
    });

    return { monthlyTotal, yearlyTotal, monthlyCount, yearlyCount };
  }, [results.availableBenefits]);

  const rawJsonString = useMemo(
    () => safeStringify(results.rawJson),
    [results.rawJson]
  );
  const payloadString = useMemo(
    () => safeStringify(results.payload),
    [results.payload]
  );
  const resultString = useMemo(
    () => safeStringify(results.result),
    [results.result]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleNewSimulation}>
          <ArrowLeft size={24} color="#4ba3c3" />
        </TouchableOpacity>
        <Text style={styles.title}>Vos aides sociales</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.successBanner}>
          <CheckCircle2 size={32} color="#6ad49b" />
          <Text style={styles.successText}>Simulation réussie !</Text>
        </View>

        {formattedTimestamp && (
          <View style={styles.metadataBox}>
            <Text style={styles.metadataText}>
              Simulation réalisée le {formattedTimestamp}
            </Text>
          </View>
        )}

        {results.explanation && (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationTitle}>Résumé personnalisé</Text>
            <Text style={styles.explanationText}>{results.explanation}</Text>
          </View>
        )}

        <View style={styles.aidesSection}>
          <Text style={styles.sectionTitle}>Aides calculées par l'API</Text>
          {results.availableBenefits.length > 0 ? (
            results.availableBenefits.map((benefit) => (
              <View
                key={`${benefit.id}-${benefit.period}`}
                style={styles.aideCard}>
                <View style={styles.aideHeader}>
                  <Euro size={20} color="#4ba3c3" />
                  <View style={styles.aideInfo}>
                    <Text style={styles.aideName}>{benefit.label}</Text>
                    <Text style={styles.aideMeta}>{formatBenefitMeta(benefit)}</Text>
                  </View>
                </View>
                <Text style={styles.aideMontant}>
                  {formatAmountWithPeriod(benefit.amount, benefit.period)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noAidesText}>
              Aucune aide supplémentaire n'a été calculée pour votre situation.
            </Text>
          )}
        </View>

        {(benefitTotals.monthlyCount > 0 || benefitTotals.yearlyCount > 0) && (
          <View style={styles.totalsWrapper}>
            {benefitTotals.monthlyCount > 0 && (
              <View
                style={[
                  styles.totalCard,
                  benefitTotals.yearlyCount > 0 && styles.totalCardSpacing,
                ]}>
                <Text style={styles.totalLabel}>Total mensuel estimé</Text>
                <Text style={styles.totalAmount}>
                  {formatCurrency(benefitTotals.monthlyTotal)}
                </Text>
                <Text style={styles.totalHint}>
                  Somme des aides dont la période est mensuelle.
                </Text>
              </View>
            )}

            {benefitTotals.yearlyCount > 0 && (
              <View style={styles.totalCard}>
                <Text style={styles.totalLabel}>Total annuel estimé</Text>
                <Text style={styles.totalAmount}>
                  {formatCurrency(benefitTotals.yearlyTotal)}
                </Text>
                <Text style={styles.totalHint}>
                  Somme des aides dont la période est annuelle.
                </Text>
              </View>
            )}
          </View>
        )}

        <TouchableOpacity
          style={styles.newSimulationButton}
          onPress={handleNewSimulation}>
          <Text style={styles.newSimulationText}>Nouvelle simulation</Text>
        </TouchableOpacity>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ Ces résultats sont des estimations. Pour connaître vos droits exacts,
            consultez les organismes compétents (CAF, Pôle Emploi, etc.).
          </Text>
        </View>

        <View style={styles.debugSection}>
          <Text style={styles.sectionTitle}>Détails techniques</Text>
          <Text style={styles.debugHint}>
            Ces informations facilitent le support en cas de problème.
          </Text>

          <TouchableOpacity
            style={styles.debugToggle}
            onPress={() => setShowRawJson((previous) => !previous)}>
            <Text style={styles.debugToggleText}>
              {showRawJson ? 'Masquer' : 'Afficher'} le JSON interprété à partir du texte utilisateur
            </Text>
          </TouchableOpacity>
          {showRawJson && (
            rawJsonString ? (
              <ScrollView
                horizontal
                style={styles.jsonScroll}
                nestedScrollEnabled>
                <Text style={styles.jsonText}>{rawJsonString}</Text>
              </ScrollView>
            ) : (
              <Text style={styles.debugEmpty}>
                Impossible d'afficher le JSON généré.
              </Text>
            )
          )}

          <TouchableOpacity
            style={styles.debugToggle}
            onPress={() => setShowPayload((previous) => !previous)}>
            <Text style={styles.debugToggleText}>
              {showPayload ? 'Masquer' : 'Afficher'} la requête envoyée à OpenFisca
            </Text>
          </TouchableOpacity>
          {showPayload && (
            payloadString ? (
              <ScrollView
                horizontal
                style={styles.jsonScroll}
                nestedScrollEnabled>
                <Text style={styles.jsonText}>{payloadString}</Text>
              </ScrollView>
            ) : (
              <Text style={styles.debugEmpty}>
                Aucune requête formatée disponible.
              </Text>
            )
          )}

          <TouchableOpacity
            style={styles.debugToggle}
            onPress={() => setShowResultData((previous) => !previous)}>
            <Text style={styles.debugToggleText}>
              {showResultData ? 'Masquer' : 'Afficher'} la réponse brute d'OpenFisca
            </Text>
          </TouchableOpacity>
          {showResultData && (
            resultString ? (
              <ScrollView
                horizontal
                style={styles.jsonScroll}
                nestedScrollEnabled>
                <Text style={styles.jsonText}>{resultString}</Text>
              </ScrollView>
            ) : (
              <Text style={styles.debugEmpty}>
                Impossible d'afficher la réponse OpenFisca.
              </Text>
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginLeft: 12,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#6ad49b',
  },
  successText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2e7d32',
    marginLeft: 12,
  },
  metadataBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  metadataText: {
    fontSize: 13,
    color: '#555',
  },
  explanationBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  explanationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  explanationText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  aidesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  aideCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  aideHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  aideInfo: {
    marginLeft: 12,
    flex: 1,
  },
  aideName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  aideMeta: {
    fontSize: 13,
    color: '#777',
    marginTop: 4,
  },
  aideMontant: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  noAidesText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  totalsWrapper: {
    marginBottom: 24,
  },
  totalCardSpacing: {
    marginBottom: 16,
  },
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ba3c3',
  },
  totalHint: {
    fontSize: 13,
    color: '#666',
    marginTop: 6,
  },
  newSimulationButton: {
    backgroundColor: '#4ba3c3',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#4ba3c3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  newSimulationText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  disclaimer: {
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f5c16c',
    marginBottom: 24,
  },
  disclaimerText: {
    fontSize: 13,
    color: '#8a6d3b',
    lineHeight: 18,
  },
  debugSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  debugHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  debugToggle: {
    backgroundColor: '#f0f4f8',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  debugToggleText: {
    fontSize: 14,
    color: '#2c3e50',
    fontWeight: '600',
  },
  debugEmpty: {
    fontSize: 13,
    color: '#999',
    marginBottom: 12,
  },
  jsonScroll: {
    maxHeight: 220,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#dce3eb',
    borderRadius: 8,
    backgroundColor: '#0b192e',
  },
  jsonText: {
    color: '#e6f0ff',
    fontSize: 12,
    padding: 12,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#4ba3c3',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
