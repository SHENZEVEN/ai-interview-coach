import { API_BASE, OFFLINE_MODE } from './aiService';

const BACKEND_OFFLINE_MSG = '后端未部署，这是作品展示版本。克隆仓库并本地运行可体验完整功能。';

// ── 面试准备文档类型 ──

export interface PrepMeta {
  prep_id: string;
  company_name: string;
  role_name: string;
  direction: string;
  direction_label: string;
  difficulty: string;
  prep_mode: string;
  generated_at: string;
  has_web_search: boolean;
  source_count: number;
  diagnosis_feedback?: {
    overall_score: number;
    weaknesses: string[];
    applied_at: string;
  };
}

export interface RequirementMatch {
  requirement: string;
  resume_evidence: string;
  match_level: string;
  gap_risk: string;
  strategy: string;
}

export interface JDPlainLanguage {
  original: string;
  plain: string;
}

export interface PredictedQuestion {
  question: string;
  category: string;
  source: string;
  key_points: string[];
}

export interface StarStory {
  project_name: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  follow_up_questions: string[];
}

export interface GapItem {
  gap: string;
  action: string;
  time_estimate?: string;
}

export interface CompanyResearch {
  overview: string;
  product_features: string;
  competitors: string;
  ai_strategy: string;
  recent_news: string;
  culture_signals: string;
  sources: string[];
}

export interface JDAnalysis {
  core_intent: string;
  plain_language: JDPlainLanguage[];
  requirement_matching: RequirementMatch[];
}

export interface GapAnalysis {
  priority_1_must_fix: GapItem[];
  priority_2_should_fix: GapItem[];
  priority_3_nice_to_have: GapItem[];
}

export interface PrepDocument {
  meta: PrepMeta;
  company_research: CompanyResearch;
  jd_analysis: JDAnalysis;
  self_intro: string;
  star_stories: StarStory[];
  predicted_questions: PredictedQuestion[];
  gap_analysis: GapAnalysis;
  focus_areas: string[];
  prep_summary: string;
  coaching_tips: string[];
  ask_back_questions: string[];
}

export interface PrepGenerateRequest {
  resume_text: string;
  jd_text?: string;
  company_name: string;
  role_name: string;
  direction: string;
  difficulty: string;
  prep_mode: 'rapid' | 'standard' | 'deep';
}

export interface PrepRefineRequest {
  prep_id: string;
  session_id: string;
}

export interface StartFromPrepRequest {
  prep_id: string;
  resume_text?: string;
  difficulty?: string;
}

export interface StartFromPrepResult {
  session_id: string;
  prep_id: string;
  first_question: {
    id: string;
    text: string;
    category: string;
    difficulty?: string;
    agent_reasoning?: string;
  };
  prep_context_used: string[];
}

// ── API 调用 ──

export const generatePrep = async (req: PrepGenerateRequest): Promise<PrepDocument> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetch(`${API_BASE}/prep/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `生成失败 (${response.status})`);
  }
  return response.json();
};

export const getPrep = async (prepId: string): Promise<PrepDocument> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetch(`${API_BASE}/prep/${prepId}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `获取失败 (${response.status})`);
  }
  return response.json();
};

export const refinePrep = async (req: PrepRefineRequest): Promise<PrepDocument> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetch(`${API_BASE}/prep/refine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `更新失败 (${response.status})`);
  }
  return response.json();
};

export const startFromPrep = async (req: StartFromPrepRequest): Promise<StartFromPrepResult> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetch(`${API_BASE}/agent/start-from-prep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `启动失败 (${response.status})`);
  }
  return response.json();
};

// ── 外部文档导入 ──

export interface StartFromExternalDocRequest {
  resume_text: string;
  external_doc_text: string;
  difficulty?: string;
  direction?: string;
}

export interface StartFromExternalDocResult {
  session_id: string;
  first_question: {
    id: string;
    text: string;
    category: string;
    difficulty?: string;
    agent_reasoning?: string;
  };
  prep_context_used: string[];
  parsed_summary: string;
}

export const startFromExternalDoc = async (req: StartFromExternalDocRequest): Promise<StartFromExternalDocResult> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetch(`${API_BASE}/agent/start-from-external-doc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `外部文档导入失败 (${response.status})`);
  }
  return response.json();
};

// ── 岗位方向映射 ──

export const ROLE_DIRECTIONS: Record<string, string> = {
  A: '产品经理（PM）',
  B: '增长/数据产品',
  C: '产品运营',
  D: '商业策略/BD',
  E: 'AI产品经理/AI产品实习',
  F: 'AI全栈开发/AI应用开发实习',
  G: '其他',
};

export const DIFFICULTY_OPTIONS = [
  { value: 'intern', label: '实习生' },
  { value: 'junior', label: '初级' },
  { value: 'mid', label: '中级' },
  { value: 'senior', label: '高级' },
  { value: 'lead', label: '专家/组长' },
];

// ── 简历-岗位匹配度 ──

export interface MatchRequest {
  resume_text: string;
  jd_text: string;
}

export interface MatchResponse {
  match_score: number;
  core_intent: string;
  requirement_matching: RequirementMatch[];
  covered: string[];
  diggable: string[];
  missing: string[];
  mismatched: string[];
  prep_suggestions: string[];
}

export const matchResumeToJd = async (req: MatchRequest): Promise<MatchResponse> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetch(`${API_BASE}/match/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `匹配分析失败 (${response.status})`);
  }
  return response.json();
};
