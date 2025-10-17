export interface AvailableBenefit {
  id: string;
  label: string;
  entity: string;
  period: string;
  amount: number;
}

export interface SimulationResultPayload {
  availableBenefits: AvailableBenefit[];
  explanation: string | null;
  payload: unknown;
  result: unknown;
  rawJson: unknown;
  generatedAt: string;
}

export interface SimulationHistoryEntry {
  id: string;
  createdAt: string;
  message: string;
  results: SimulationResultPayload;
}

export interface ApiGenerateResponse {
  json?: unknown;
}

export interface ApiSimulationRequest {
  json: Record<string, unknown>;
}

export interface ApiSimulationResponse {
  availableBenefits?: unknown;
  explanation?: unknown;
  payload?: unknown;
  result?: unknown;
}
