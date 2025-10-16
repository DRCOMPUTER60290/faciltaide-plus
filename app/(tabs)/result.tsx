import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CheckCircle2, ArrowLeft, Euro } from 'lucide-react-native';

interface SimulationResult {
  aides: Array<{
    nom: string;
    montant: number;
  }>;
  explication?: string;
  total: number;
}

export default function ResultScreen() {
  const params = useLocalSearchParams();
  const [results, setResults] = useState<SimulationResult | null>(null);

  useEffect(() => {
    if (params.results && typeof params.results === 'string') {
      try {
        const parsedResults = JSON.parse(params.results);
        setResults(parsedResults);
      } catch (error) {
        console.error('Error parsing results:', error);
      }
    }
  }, [params.results]);

  const handleNewSimulation = () => {
    router.push('/(tabs)/');
  };

  if (!results) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>
          Aucun résultat disponible. Effectuez une simulation d'abord.
        </Text>
        <TouchableOpacity style={styles.button} onPress={handleNewSimulation}>
          <Text style={styles.buttonText}>Nouvelle simulation</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleNewSimulation}>
          <ArrowLeft size={24} color="#4ba3c3" />
        </TouchableOpacity>
        <Text style={styles.title}>Vos aides sociales</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.successBanner}>
          <CheckCircle2 size={32} color="#6ad49b" />
          <Text style={styles.successText}>Simulation réussie !</Text>
        </View>

        {results.explication && (
          <View style={styles.explanationBox}>
            <Text style={styles.explanationTitle}>Explication :</Text>
            <Text style={styles.explanationText}>{results.explication}</Text>
          </View>
        )}

        <View style={styles.aidesSection}>
          <Text style={styles.sectionTitle}>Détail de vos aides :</Text>
          {results.aides && results.aides.length > 0 ? (
            results.aides.map((aide, index) => (
              <View key={index} style={styles.aideCard}>
                <View style={styles.aideHeader}>
                  <Euro size={20} color="#4ba3c3" />
                  <Text style={styles.aideName}>{aide.nom}</Text>
                </View>
                <Text style={styles.aideMontant}>
                  {aide.montant.toFixed(2)} € / mois
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.noAidesText}>
              Aucune aide éligible détectée pour votre situation.
            </Text>
          )}
        </View>

        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Total mensuel</Text>
          <Text style={styles.totalAmount}>{results.total.toFixed(2)} €</Text>
        </View>

        <TouchableOpacity
          style={styles.newSimulationButton}
          onPress={handleNewSimulation}>
          <Text style={styles.newSimulationText}>Nouvelle simulation</Text>
        </TouchableOpacity>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ Ces résultats sont des estimations. Pour connaître vos droits
            exacts, consultez les organismes compétents (CAF, Pôle Emploi, etc.).
          </Text>
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
    marginBottom: 8,
  },
  aideName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  aideMontant: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4ba3c3',
    marginLeft: 28,
  },
  noAidesText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
  totalCard: {
    backgroundColor: '#4ba3c3',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#4ba3c3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  totalLabel: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8,
  },
  totalAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  newSimulationButton: {
    backgroundColor: '#6ad49b',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  newSimulationText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disclaimer: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 100,
    paddingHorizontal: 40,
  },
  button: {
    backgroundColor: '#4ba3c3',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 40,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
