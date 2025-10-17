import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SimulationHistoryEntry } from '@/types/simulation';

const STORAGE_KEY = 'facilaide-plus/history';
export const MAX_HISTORY_ENTRIES = 5;

const parseHistory = (rawValue: string | null): SimulationHistoryEntry[] => {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is SimulationHistoryEntry => {
      if (!entry || typeof entry !== 'object') {
        return false;
      }

      const candidate = entry as Partial<SimulationHistoryEntry> & Record<string, unknown>;
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.createdAt === 'string' &&
        typeof candidate.message === 'string' &&
        candidate.results !== undefined
      );
    });
  } catch (error) {
    console.warn('Historique de simulation corrompu : réinitialisation.', error);
    return [];
  }
};

export const loadSimulationHistory = async (): Promise<SimulationHistoryEntry[]> => {
  try {
    const storedValue = await AsyncStorage.getItem(STORAGE_KEY);
    return parseHistory(storedValue);
  } catch (error) {
    console.warn("Impossible de lire l'historique des simulations", error);
    return [];
  }
};

export interface SaveSimulationHistoryParams {
  message: string;
  results: SimulationHistoryEntry['results'];
}

export const saveSimulationToHistory = async (
  params: SaveSimulationHistoryParams,
): Promise<void> => {
  const { message, results } = params;
  const trimmedMessage = message.trim();
  if (!trimmedMessage) {
    return;
  }

  const newEntry: SimulationHistoryEntry = {
    id: `${Date.now()}`,
    createdAt: new Date().toISOString(),
    message: trimmedMessage,
    results,
  };

  try {
    const previousEntries = await loadSimulationHistory();
    const deduplicated = previousEntries.filter((entry) => entry.message !== trimmedMessage);
    const updatedEntries = [newEntry, ...deduplicated].slice(0, MAX_HISTORY_ENTRIES);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedEntries));
  } catch (error) {
    console.warn("Impossible d'enregistrer la simulation dans l'historique", error);
  }
};

export const clearSimulationHistory = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Impossible de réinitialiser l'historique des simulations", error);
  }
};
