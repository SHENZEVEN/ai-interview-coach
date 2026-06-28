import { API_BASE, OFFLINE_MODE, fetchWithTimeout, buildHeaders } from './aiService';

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

// ── Mock 数据（离线模式降级）──

const MOCK_QUESTIONS: AgentQuestion[] = [
  { id: 'mock-q1', text: '请介绍一下你最有代表性的项目经历，包括你在其中承担的角色和最终成果。', category: '项目经验', difficulty: 'mid', target_knowledge: ['项目深度', '表达能力'] },
  { id: 'mock-q2', text: '你在技术选型时最看重哪些因素？请结合实际案例说明。', category: '架构设计', difficulty: 'mid', target_knowledge: ['技术视野', '架构思维'] },
  { id: 'mock-q3', text: '描述一次你解决复杂技术问题的过程，包括排查思路和最终方案。', category: '技术深度', difficulty: 'mid', target_knowledge: ['调试能力', '问题拆解'] },
  { id: 'mock-q4', text: '你对React的Fiber架构了解多少？它解决了什么问题？', category: '基础能力', difficulty: 'mid', target_knowledge: ['React原理', '调度机制'] },
  { id: 'mock-q5', text: '如果让你从零设计一个前端监控体系，你会怎么做？', category: '架构设计', difficulty: 'senior', target_knowledge: ['系统设计', '监控体系'] },
  { id: 'mock-q6', text: '请解释HTTP/2的多路复用与HTTP/1.1的长连接有什么区别？', category: '基础能力', difficulty: 'mid', target_knowledge: ['网络协议', '性能优化'] },
  { id: 'mock-q7', text: '你在团队协作中遇到过哪些沟通困难？如何解决的？', category: '综合素质', difficulty: 'mid', target_knowledge: ['沟通能力', '团队协作'] },
  { id: 'mock-q8', text: '请谈谈你对前端性能优化的理解，从指标到手段。', category: '技术深度', difficulty: 'senior', target_knowledge: ['性能指标', '优化策略'] },
];

// Mock 状态存储（离线模式下模拟会话）
interface MockSession {
  questions: AgentQuestion[];
  answers: { questionId: string; answer: string }[];
}
const mockSessions = new Map<string, MockSession>();

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 简单的 mock 评分逻辑
const mockEvaluateAnswer = (answer: string, questionIndex: number): AgentEvaluation => {
  const len = answer.trim().length;
  let score = 40;
  if (len > 30) score = 50;
  if (len > 80) score = 60;
  if (len > 150) score = 70;
  if (len > 300) score = 80;
  // 随机波动 ±10
  score = Math.max(20, Math.min(95, score + Math.floor(Math.random() * 20 - 10)));

  const comments = [
    '回答过于简短，缺乏具体细节和案例支撑。',
    '回答基本覆盖了要点，但深度不够，建议补充实际经验。',
    '回答较为完整，逻辑清晰，可以更深入一些。',
    '回答详细且有深度，体现了扎实的技术功底和丰富的实践经验。',
  ];
  const commentIndex = Math.min(Math.floor((score - 20) / 20), comments.length - 1);

  return {
    score,
    comment: comments[commentIndex],
    reference_answer: '这是一个 mock 参考答案。在线模式下将显示AI生成的专业标准答案。',
    knowledge_hits: score > 60 ? ['基础知识', '项目经验'] : ['基础知识'],
    knowledge_gaps: score < 70 ? ['深度理解', '实际应用'] : [],
    logic_feedback: score > 60 ? '逻辑较清晰' : '回答缺乏逻辑层次',
  };
};

// Mock 认知诊断生成
const buildMockDiagnosis = (sessionId: string, answers: { questionId: string; answer: string; evaluation: AgentEvaluation }[]): CognitiveDiagnosis => {
  const avgScore = answers.length > 0 ? Math.round(answers.reduce((sum, a) => sum + a.evaluation.score, 0) / answers.length) : 50;
  const avgLogic = Math.min(10, Math.round(avgScore / 10));
  const avgComm = Math.min(10, Math.round(avgScore / 10 + Math.random()));
  const avgDepth = Math.min(10, Math.round(avgScore / 12));

  return {
    session_id: sessionId,
    overall_score: avgScore,
    knowledge_map: [
      { name: '基础能力', coverage: 0.6 + Math.random() * 0.3, depth_score: avgDepth, keywords_mentioned: ['React', 'HTTP'], missing_concepts: avgScore < 70 ? ['底层原理'] : [] },
      { name: '项目经验', coverage: 0.5 + Math.random() * 0.3, depth_score: Math.max(3, avgDepth - 1), keywords_mentioned: ['项目', '团队'], missing_concepts: avgScore < 70 ? ['量化成果'] : [] },
      { name: '架构设计', coverage: 0.3 + Math.random() * 0.3, depth_score: Math.max(2, avgDepth - 2), keywords_mentioned: [], missing_concepts: ['系统设计', '技术选型'] },
      { name: '综合素质', coverage: 0.5 + Math.random() * 0.3, depth_score: avgDepth, keywords_mentioned: ['沟通'], missing_concepts: avgScore < 70 ? ['领导力'] : [] },
    ],
    logic_score: avgLogic,
    communication_score: avgComm,
    depth_score: avgDepth,
    strengths: avgScore > 60 ? ['有一定技术基础', '能结合实际经验回答', '回答态度认真'] : ['态度认真'],
    weaknesses: avgScore < 70 ? ['回答深度不足', '缺乏量化数据支撑', '架构设计能力待提升'] : ['部分领域覆盖不够深入'],
    improvement_plan: [
      '针对薄弱领域深入学习，补充底层原理知识',
      '整理项目经历，用STAR法则准备量化案例',
      '练习系统设计题，提升架构思维',
    ],
    radar_data: {
      '基础能力': { coverage: 0.6 + Math.random() * 0.3, depth: avgDepth / 10 },
      '项目经验': { coverage: 0.5 + Math.random() * 0.3, depth: Math.max(0.3, avgDepth / 10 - 0.1) },
      '架构设计': { coverage: 0.3 + Math.random() * 0.3, depth: Math.max(0.2, avgDepth / 10 - 0.2) },
      '综合素质': { coverage: 0.5 + Math.random() * 0.3, depth: avgDepth / 10 },
    },
    timeline_data: answers.map((a, i) => ({
      question_id: a.questionId,
      question_short: `Q${i + 1}`,
      category: MOCK_QUESTIONS[i % MOCK_QUESTIONS.length]?.category || '基础能力',
      score: a.evaluation.score,
      logic_score: Math.min(10, Math.round(a.evaluation.score / 10)),
      communication_score: Math.min(10, Math.round(a.evaluation.score / 10 + 1)),
    })),
  };
};

// ── API 调用 ──

export const fetchDiagnosis = async (sessionId: string): Promise<CognitiveDiagnosis> => {
  if (OFFLINE_MODE) {
    const session = mockSessions.get(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);
    // 构建 mock 诊断报告
    const answersWithEval = session.answers.map((a, i) => ({
      ...a,
      evaluation: mockEvaluateAnswer(a.answer, i),
    }));
    return buildMockDiagnosis(sessionId, answersWithEval);
  }
  const response = await fetchWithTimeout(`${API_BASE}/agent/diagnosis/${sessionId}`, {
    headers: buildHeaders(),
  }, DIAGNOSIS_TIMEOUT_MS);
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
  if (OFFLINE_MODE) {
    await delay(1500); // 模拟启动延迟
    const sessionId = `mock-session-${Date.now()}`;
    // 根据简历内容微调首题
    const firstQuestion: AgentQuestion = resumeText.length > 50
      ? { id: 'mock-q1', text: '根据你的简历，请详细介绍你最有代表性的项目经历，包括技术选型理由和最终成果。', category: '项目经验', difficulty, target_knowledge: ['项目深度', '技术选型'] }
      : { ...MOCK_QUESTIONS[0] };
    mockSessions.set(sessionId, { questions: [firstQuestion, ...MOCK_QUESTIONS.slice(1)], answers: [] });
    return { session_id: sessionId, first_question: firstQuestion };
  }
  const response = await fetchWithTimeout(`${API_BASE}/agent/start-interview`, {
    method: 'POST',
    headers: buildHeaders(),
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
  if (OFFLINE_MODE) {
    await delay(1000); // 模拟评估延迟
    const session = mockSessions.get(sessionId);
    if (!session) throw new SessionNotFoundError(sessionId);

    const questionIndex = session.questions.findIndex(q => q.id === questionId);
    const evaluation = mockEvaluateAnswer(userAnswer, questionIndex);
    session.answers.push({ questionId, answer: userAnswer });

    // 答完8题或所有题后结束
    const isFinished = session.answers.length >= 8 || session.answers.length >= session.questions.length;

    if (isFinished) {
      const answersWithEval = session.answers.map((a, i) => ({
        ...a,
        evaluation: mockEvaluateAnswer(a.answer, i),
      }));
      return {
        evaluation,
        next_question: null,
        is_finished: true,
        cumulative_diagnosis: buildMockDiagnosis(sessionId, answersWithEval),
      };
    }

    // 继续下一题
    const nextQ = session.questions[session.answers.length] || MOCK_QUESTIONS[session.answers.length % MOCK_QUESTIONS.length];
    return {
      evaluation,
      next_question: nextQ,
      is_finished: false,
      cumulative_diagnosis: null,
    };
  }
  const response = await fetchWithTimeout(`${API_BASE}/agent/submit-answer`, {
    method: 'POST',
    headers: buildHeaders(),
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
  if (OFFLINE_MODE) {
    return { success: true, message: 'Mock session alive' };
  }
  const response = await fetchWithTimeout(`${API_BASE}/agent/keep-alive`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({ session_id: sessionId }),
  }, 10000);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(err.detail || `请求失败 (${response.status})`);
  }
  return response.json();
};
