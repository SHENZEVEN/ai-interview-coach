import type { CognitiveDiagnosis, AgentEvaluation } from './diagnosisService';

const STORAGE_KEY = 'ai-interview-coach-diagnoses';

export interface SavedDiagnosis {
  id: string;
  savedAt: number; // timestamp
  prepId?: string;
  sessionId?: string; // 面试会话 ID，用于闭环
  isPrepDriven: boolean;
  difficulty: string;
  questionCount: number;
  diagnosis: CognitiveDiagnosis;
  answers: {
    questionText: string;
    answer: string;
    evaluation: AgentEvaluation;
  }[];
}

export const getDiagnoses = (): SavedDiagnosis[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const getDiagnosis = (id: string): SavedDiagnosis | undefined => {
  return getDiagnoses().find(d => d.id === id);
};

export const saveDiagnosis = (data: Omit<SavedDiagnosis, 'id' | 'savedAt'>): SavedDiagnosis => {
  const diagnoses = getDiagnoses();
  const id = `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: SavedDiagnosis = {
    ...data,
    id,
    savedAt: Date.now(),
  };
  diagnoses.unshift(entry); // newest first
  // Keep last 20 reports
  const trimmed = diagnoses.slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  return entry;
};

export const deleteDiagnosis = (id: string): void => {
  const diagnoses = getDiagnoses().filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(diagnoses));
};
