import type {
  ApiGenerateResponse,
  ApiSimulationRequest,
  ApiSimulationResponse,
  AvailableBenefit,
  SimulationResultPayload,
} from '../types/simulation';

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseJsonSafely = (value: unknown): Record<string, unknown> | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return isRecord(parsed) ? parsed : null;
    } catch (error) {
      console.warn('Impossible de parser la chaîne JSON renvoyée par /generate-json', error);
      return null;
    }
  }

  return isRecord(value) ? value : null;
};

export const extractRawJson = (data: unknown): Record<string, unknown> | null => {
  if (isRecord(data) && 'json' in data) {
    return parseJsonSafely((data as ApiGenerateResponse).json ?? null);
  }

  const rootObject = parseJsonSafely(data);
  if (rootObject && Object.keys(rootObject).length) {
    return rootObject;
  }

  return null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const normalized = Number(value);
    return Number.isFinite(normalized) ? normalized : null;
  }

  return null;
};

export const normalizeAvailableBenefits = (value: unknown): AvailableBenefit[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }

      const { id, label, entity, period, amount } = entry as Record<string, unknown>;
      const normalizedAmount = toNumber(amount);

      if (
        typeof id === 'string' &&
        typeof label === 'string' &&
        typeof entity === 'string' &&
        typeof period === 'string' &&
        normalizedAmount !== null
      ) {
        return {
          id,
          label,
          entity,
          period,
          amount: normalizedAmount,
        } as AvailableBenefit;
      }

      return null;
    })
    .filter((benefit): benefit is AvailableBenefit => benefit !== null);
};

export const buildSimulationPayload = (
  apiResponse: ApiSimulationResponse,
  rawJson: ApiSimulationRequest['json']
): SimulationResultPayload => {
  const explanation =
    typeof apiResponse.explanation === 'string' && apiResponse.explanation.trim().length
      ? apiResponse.explanation.trim()
      : null;

  return {
    availableBenefits: normalizeAvailableBenefits(apiResponse.availableBenefits),
    explanation,
    payload: isRecord(apiResponse.payload) || Array.isArray(apiResponse.payload)
      ? apiResponse.payload
      : apiResponse.payload ?? null,
    result: isRecord(apiResponse.result) || Array.isArray(apiResponse.result)
      ? apiResponse.result
      : apiResponse.result ?? null,
    rawJson,
    generatedAt: new Date().toISOString(),
  };
};

export type {
  ApiGenerateResponse,
  ApiSimulationRequest,
  ApiSimulationResponse,
  AvailableBenefit,
  SimulationResultPayload,
};
