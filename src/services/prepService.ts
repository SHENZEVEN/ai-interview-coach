import { API_BASE, OFFLINE_MODE, fetchWithTimeout, buildHeaders } from './aiService';

const BACKEND_OFFLINE_MSG = '后端未部署，这是作品展示版本。克隆仓库并本地运行可体验完整功能。';
const PREP_TIMEOUT_MS = 300000; // 面试准备需要更长时间（5分钟）
const AGENT_TIMEOUT_MS = 180000; // Agent 面试启动需要较长时间（3分钟，后端 LLM 调用可能耗时）

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

export interface RequirementMatch {
  requirement: string;
  resume_evidence: string;
  match_level: string;
  gap_risk: string;
  strategy: string;
}

export interface CompanyResearch {
  company_overview: string;
  tech_culture: string;
  key_focus_areas: string[];
  why_xiaohongshu_for_ai: string;
  why_this_company?: string;
}

export interface JDAnalysis {
  core_requirements: string[];
  preferred_qualifications: string[];
  gap_identification: string[];
}

export interface GapAnalysis {
  strengths: string[];
  weaknesses: string[];
  mitigation_strategies: string[];
}

export interface SelfIntro {
  duration_seconds: number;
  script: string;
  key_highlights: string[];
}

export interface PrepDocument {
  meta: PrepMeta;
  company_research: CompanyResearch;
  jd_analysis: JDAnalysis;
  self_intro: SelfIntro;
  star_stories: StarStory[];
  predicted_questions: PredictedQuestion[];
  gap_analysis: GapAnalysis;
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
  prep_data?: Record<string, unknown>; // 完整 prep 文档（绕过内存存储）
  diagnosis_data?: Record<string, unknown>; // 完整诊断数据（绕过内存存储）
  prep_text?: string;       // 原始准备文档文本（.md/.docx 导入，后端 LLM 解析）
  diagnosis_text?: string;  // 原始诊断报告文本（.md/.docx 导入，后端 LLM 解析）
}

export interface StartFromPrepRequest {
  prep_id?: string;
  resume_text?: string;
  difficulty?: string;
  prep_data?: Record<string, unknown>;
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
  const response = await fetchWithTimeout(`${API_BASE}/prep/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  }, PREP_TIMEOUT_MS);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `生成失败 (${response.status})`);
  }
  return response.json();
};

// ── 流式生成面试准备文档 ──

export interface StreamProgress {
  status: string;      // 当前状态
  content: string;     // 生成的文本片段
  isComplete: boolean;  // 是否完成
  error?: string;      // 错误信息
}

export const generatePrepStream = async (
  req: PrepGenerateRequest,
  onProgress: (progress: StreamProgress) => void
): Promise<PrepDocument> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  
  const collectedContent: string[] = [];
  let currentEventType = '';
  
  try {
    // 使用 fetchWithTimeout 确保长连接不超时（面试准备可能需要 5+ 分钟）
    const response = await fetchWithTimeout(`${API_BASE}/prep/stream-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    }, PREP_TIMEOUT_MS);

    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
      throw new Error(err.detail || `生成失败 (${response.status})`);
    }

    // 读取 SSE 流
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('无法读取响应流');
    }

    let buffer = '';
    let finalContent: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // 处理 SSE 事件
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留未完成的行

      for (const line of lines) {
        if (line.startsWith('event:')) {
          currentEventType = line.slice(6).trim();
          continue;
        }
        
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim();
          
          if (data) {
            try {
              const parsed = JSON.parse(data);
              
              // 处理 done 事件 - 这里包含完整的 JSON 文档
              if (currentEventType === 'done') {
                console.log('📥 收到 done 事件，parsed keys:', Object.keys(parsed));
                if (parsed.content !== undefined) {
                  console.log('📦 done.content 长度:', parsed.content.length);
                  console.log('📦 done.content 前100字符:', parsed.content.substring(0, 100));
                  // 检查 content 是否是 JSON 字符串
                  if (typeof parsed.content === 'string' && parsed.content.trim().startsWith('{')) {
                    finalContent = parsed.content;
                  } else {
                    // 如果不是字符串，尝试 JSON 序列化
                    finalContent = JSON.stringify(parsed.content);
                  }
                }
              } else if (parsed.status) {
                onProgress({
                  status: parsed.status,
                  content: collectedContent.join(''),
                  isComplete: false,
                });
              } else if (parsed.content !== undefined) {
                collectedContent.push(parsed.content);
                onProgress({
                  status: '正在生成内容...',
                  content: collectedContent.join(''),
                  isComplete: false,
                });
              }
            } catch {
              // 如果不是 JSON，直接当作状态消息处理
              onProgress({
                status: data,
                content: collectedContent.join(''),
                isComplete: false,
              });
            }
          }
        }
      }
    }

    onProgress({
      status: '✅ 生成完成！正在解析...',
      content: collectedContent.join(''),
      isComplete: true,
    });

    // 使用 done 事件中的完整内容，如果没有则使用收集的内容
    let fullContent = finalContent || collectedContent.join('');
    if (!fullContent) {
      throw new Error('生成内容为空');
    }
    
    console.log('📦 准备解析生成的内容，长度:', fullContent.length);
    console.log('📄 内容前100字符:', fullContent.substring(0, 100));
    
    // 解析生成的 JSON
    let prepDoc;
    try {
      prepDoc = JSON.parse(fullContent);
      console.log('✅ JSON 解析成功，文档结构:', Object.keys(prepDoc));
      console.log('📋 meta 字段:', prepDoc.meta ? Object.keys(prepDoc.meta) : '缺失');
    } catch (parseError) {
      console.error('❌ JSON 解析失败:', parseError);
      console.error('📄 原始内容前500字符:', fullContent.substring(0, 500));
      // 尝试检查是否 content 字段需要二次解析
      try {
        const parsed = JSON.parse(fullContent);
        if (parsed.content && typeof parsed.content === 'string') {
          console.log('🔄 检测到 content 字段包含嵌套 JSON，尝试二次解析...');
          prepDoc = JSON.parse(parsed.content);
          console.log('✅ 二次解析成功，文档结构:', Object.keys(prepDoc));
        }
      } catch {
        throw parseError;
      }
    }
    
    return prepDoc;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '流式生成失败';
    onProgress({
      status: '❌ 生成失败',
      content: collectedContent.join(''),
      isComplete: false,
      error: errorMessage,
    });
    throw error;
  }
};

export const getPrep = async (prepId: string): Promise<PrepDocument> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetchWithTimeout(`${API_BASE}/prep/${prepId}`, {});
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `获取失败 (${response.status})`);
  }
  return response.json();
};

export const refinePrep = async (req: PrepRefineRequest): Promise<PrepDocument> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);

  let lastError: Error;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetchWithTimeout(`${API_BASE}/prep/refine`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(req),
      }, PREP_TIMEOUT_MS);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(err.detail || `更新失败 (${response.status})`);
      }
      return response.json();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < 2) {
        // 指数退避
        await new Promise(r => setTimeout(r, (attempt + 1) * 2000));
      }
    }
  }
  throw lastError!;
};

export const startFromPrep = async (req: StartFromPrepRequest): Promise<StartFromPrepResult> => {
  if (OFFLINE_MODE) throw new Error(BACKEND_OFFLINE_MSG);
  const response = await fetchWithTimeout(`${API_BASE}/agent/start-from-prep`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(req),
  }, AGENT_TIMEOUT_MS);
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
  const response = await fetchWithTimeout(`${API_BASE}/agent/start-from-external-doc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  }, AGENT_TIMEOUT_MS);
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
  const response = await fetchWithTimeout(`${API_BASE}/match/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  }, AGENT_TIMEOUT_MS);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `匹配分析失败 (${response.status})`);
  }
  return response.json();
};
