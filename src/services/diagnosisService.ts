import { API_BASE, OFFLINE_MODE, fetchWithTimeout } from './aiService';

const DIAGNOSIS_TIMEOUT_MS = 180000; // 诊断式面试需要更长时间（3分钟）

const BACKEND_OFFLINE_MSG = '后端未部署，这是作品展示版本。克隆仓库并本地运行可体验完整功能。';

// ── 错误类型 ──

export class SessionNotFoundError extends Error {
  constructor(sessionId: string) {
    super(`面试会话已过期（服务器可能已重启），请重新开始面试。`);
    this.name = 'SessionNotFoundError';
  }
}

// ── Agent 出题 ──

export interface AgentQuestion {
  id: string;
  text: string;
  category: string;
  difficulty?: string;
  target_knowledge?: string[];
  agent_reasoning?: string;
}

// ── 单题评估 ──

export interface AgentEvaluation {
  score: number;
  comment: string;
  reference_answer?: string;
  knowledge_hits: string[];
  knowledge_gaps: string[];
  logic_feedback?: string;
}

// ── 提交回答的完整返回 ──

export interface SubmitAnswerResult {
  evaluation: AgentEvaluation;
  next_question: AgentQuestion | null;
  is_finished: boolean;
  cumulative_diagnosis: CognitiveDiagnosis | null;
}

// ── 认知诊断报告类型 ──

export interface KnowledgePoint {
  name: string;
  coverage: number;
  depth_score: number;
  keywords_mentioned: string[];
  missing_concepts: string[];
}

export interface TimelinePoint {
  question_id: string;
  question_short: string;
  category: string;
  score: number;
  logic_score: number;
  communication_score: number;
}

export interface RadarEntry {
  coverage: number;
  depth: number;
}

export interface CognitiveDiagnosis {
  session_id: string;
  overall_score: number;
  knowledge_map: KnowledgePoint[];
  logic_score: number;
  communication_score: number;
  depth_score: number;
  strengths: string[];
  weaknesses: string[];
  improvement_plan: string[];
  radar_data: Record<string, RadarEntry>;
  timeline_data: TimelinePoint[];
}

// ── 开始面试返回 ──

export interface StartInterviewResult {
  session_id: string;
  first_question: AgentQuestion;
  agent_plan?: string;
}

// ── API 调用 ──

export const fetchDiagnosis = async (sessionId: string): Promise<CognitiveDiagnosis> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetchWithTimeout(`${API_BASE}/agent/diagnosis/${sessionId}`, {}, DIAGNOSIS_TIMEOUT_MS);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    if (err.detail?.includes('不存在')) throw new SessionNotFoundError(sessionId);
    throw new Error(err.detail || `请求失败 (${response.status})`);
  }
  return response.json();
};

export const startAgentInterview = async (
  resumeText: string,
  difficulty: string = 'mid',
  jdText?: string,
  focusAreas?: string[]
): Promise<StartInterviewResult> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetchWithTimeout(`${API_BASE}/agent/start-interview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      resume_text: resumeText,
      jd_text: jdText || '',
      difficulty,
      focus_areas: focusAreas || [],
    }),
  }, DIAGNOSIS_TIMEOUT_MS);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `请求失败 (${response.status})`);
  }
  return response.json();
};

export const submitAgentAnswer = async (
  sessionId: string,
  questionId: string,
  userAnswer: string
): Promise<SubmitAnswerResult> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetchWithTimeout(`${API_BASE}/agent/submit-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      question_id: questionId,
      user_answer: userAnswer,
    }),
  }, DIAGNOSIS_TIMEOUT_MS);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    if (err.detail?.includes('不存在')) throw new SessionNotFoundError(sessionId);
    throw new Error(err.detail || `请求失败 (${response.status})`);
  }
  return response.json();
};

export const keepSessionAlive = async (sessionId: string): Promise<{ success: boolean; message: string }> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetch(`${API_BASE}/agent/keep-alive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `请求失败 (${response.status})`);
  }
  return response.json();
};
