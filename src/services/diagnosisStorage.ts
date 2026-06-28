import type { CognitiveDiagnosis, AgentEvaluation } from './diagnosisService';
import type { AnswerRecord } from './resumeRoastService';

const STORAGE_KEY = 'ai-interview-coach-diagnoses';
const MAX_DIAGNOSES = 20;

export interface SavedDiagnosis {
  id: string;
  savedAt: number; // timestamp
  prepId?: string;
  sessionId?: string; // 面试会话 ID，用于闭环
  isPrepDriven: boolean;
  difficulty: string;
  questionCount: number;
  diagnosis: CognitiveDiagnosis;
  answers: AnswerRecord[];
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

export const saveDiagnosis = (data: Omit<SavedDiagnosis, 'id' | 'savedAt'>): { entry: SavedDiagnosis; trimmed: boolean } => {
  const diagnoses = getDiagnoses();
  const id = `diag_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const entry: SavedDiagnosis = {
    ...data,
    id,
    savedAt: Date.now(),
  };
  diagnoses.unshift(entry); // newest first
  const trimmed = diagnoses.length > MAX_DIAGNOSES;
  // Keep last MAX_DIAGNOSES reports
  const sliced = diagnoses.slice(0, MAX_DIAGNOSES);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sliced));
  return { entry, trimmed };
};

export const deleteDiagnosis = (id: string): void => {
  const diagnoses = getDiagnoses().filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(diagnoses));
};
