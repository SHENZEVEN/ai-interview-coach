import { AIEvaluation, Question, Category } from '../types';

// 生成题目返回类型（包含题目和类别）
export interface GeneratedQuestion {
  text: string;
  categories: Category[];
}

export const API_KEY = import.meta.env.VITE_AGNES_API_KEY || '';
export const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';
export const AGNES_API_BASE = 'https://apihub.agnes-ai.com/v1'; // Agnes 直连（简历拷打用）

// Vercel 部署时后端不在 → 优雅降级，不弹红色报错
const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

const TIMEOUT_MS = 30000;
const MAX_RETRIES = isVercel ? 0 : 3;  // Vercel 上不重试，直接走降级
const RETRY_DELAY_MS = 1000;

export const buildHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`
});

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 带超时的 fetch（支持自定义超时时间）
export const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = TIMEOUT_MS): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI响应超时，请重试');
    }
    throw error;
  }
};

// 带重试的 fetch
export const fetchWithRetry = async (url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetchWithTimeout(url, options);
      
      // 如果是 4xx 错误（客户端错误），不重试
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      
      // 如果是 5xx 错误或网络错误，重试
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('未知错误');
      
      // 如果不是最后一次重试，等待后继续
      if (i < retries - 1) {
        console.warn(`API请求失败，第 ${i + 1} 次重试...`, lastError.message);
        await delay(RETRY_DELAY_MS * (i + 1)); // 指数退避
      }
    }
  }
  
  throw lastError || new Error('请求失败，请稍后重试');
};

export const generateQuestion = async (jdText: string, difficulty: 'intern' | 'junior' | 'mid' | 'senior' | 'lead' = 'mid'): Promise<GeneratedQuestion> => {
  if (!API_KEY) {
    throw new Error('未配置 API Key，请检查环境变量');
  }

  try {
    const response = await fetchWithRetry(`${API_BASE}/generate-question`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jd_text: jdText,
        difficulty: difficulty,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.detail || errorData.error?.message || `服务异常 (${response.status})`;
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const validCategories: Category[] = ['前端', '计网', '算法', 'AI Coding'];
    const categories = (data.categories || ['前端'])
      .map((c: string) => validCategories.includes(c as Category) ? c : null)
      .filter(Boolean) as Category[];

    return {
      text: data.text || '未能生成题目',
      categories: categories.length > 0 ? categories : ['前端', '定制'],
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('AI生成题目失败，请稍后重试');
  }
};

export const evaluateAnswer = async (
  question: Question | string,
  userAnswer: string,
  context?: string
): Promise<AIEvaluation> => {
  if (!API_KEY) {
    throw new Error('未配置 API Key，请检查环境变量');
  }

  try {
    const referenceAnswer = typeof question === 'string' ? '' : question.referenceAnswer;

    const response = await fetchWithRetry(`${API_BASE}/evaluate-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: typeof question === 'string' ? question : question.text,
        user_answer: userAnswer,
        reference_answer: referenceAnswer,
        context: context || '',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.detail || errorData.error?.message || `服务异常 (${response.status})`;
      throw new Error(errorMsg);
    }

    const data = await response.json();

    return {
      score: Math.min(10, Math.max(1, data.score || 5)),
      comment: data.comment || '评估完成',
      referenceAnswer: data.reference_answer || referenceAnswer || '参考答案请查看相关资料',
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('AI评价失败，请稍后重试');
  }
};

// ── 面经提取题目 ──

export interface ExtractedQuestion {
  question: string;
  category: string;
  source: string;
  key_points: string[];
  reference_answer: string;
}

export interface ExtractQuestionsResult {
  questions: ExtractedQuestion[];
}

export const extractQuestionsFromText = async (text: string, category: string = '前端'): Promise<ExtractQuestionsResult> => {
  if (!API_KEY) {
    throw new Error('未配置 API Key，请检查环境变量');
  }

  try {
    const response = await fetchWithRetry(`${API_BASE}/extract-questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        category,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.detail || `服务异常 (${response.status})`;
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('题目提取失败，请稍后重试');
  }
};

// 模拟AI评价（开发阶段使用）
export const mockEvaluate = async (
  question: Question | string,
  userAnswer: string
): Promise<AIEvaluation> => {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const questionText = typeof question === 'string' ? question : question.text;
  const referenceAnswer = typeof question === 'string' ? '' : question.referenceAnswer;
  
  // 简单的模拟评分逻辑
  const length = userAnswer.trim().length;
  let score = 5;
  
  if (length < 10) {
    score = 2;
  } else if (length < 30) {
    score = 4;
  } else if (length < 50) {
    score = 6;
  } else if (length < 100) {
    score = 7;
  } else if (length < 200) {
    score = 8;
  } else {
    score = 9;
  }

  const comments = [
    '回答过于简短，建议补充更多细节',
    '回答基本覆盖要点，可以更详细一些',
    '回答较为完整，继续保持',
    '回答非常详细，表现优秀'
  ];
  
  const commentIndex = Math.min(Math.floor(score / 3), comments.length - 1);

  return {
    score,
    comment: comments[commentIndex],
    referenceAnswer: referenceAnswer || '参考答案：见下方参考答案区域'
  };
};

// 模拟生成题目（开发阶段使用）
export const mockGenerateQuestion = async (jdText: string): Promise<GeneratedQuestion> => {
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const questions = [
    { text: `请解释你在${jdText.slice(0, 20)}相关技术上的经验？`, category: '前端' },
    { text: `根据上述JD，描述一个你最相关的项目经历？`, category: '前端' },
    { text: `如何在团队中推动技术创新？请举例说明？`, category: '算法' },
    { text: `遇到技术难题时，你的解决思路是什么？`, category: '计网' },
    { text: `请谈谈对${jdText.slice(0, 10)}技术发展趋势的理解？`, category: 'AI Coding' },
  ];
  
  const selected = questions[Math.floor(Math.random() * questions.length)];
  return {
    text: selected.text,
    categories: [selected.category as Category, '定制']
  };
};

// ── 离线模式 / 模拟服务 ──
const USE_MOCK = !API_KEY;
export const OFFLINE_MODE = USE_MOCK || isVercel;

// 统一降级包装：后端不可用时走 mock，不抛错
export const safeBackendCall = async <T>(call: () => Promise<T>, fallback: T): Promise<T & { offline?: boolean }> => {
  if (OFFLINE_MODE) return { ...fallback, offline: true };
  try {
    const result = await call();
    return { ...result, offline: false };
  } catch {
    return { ...fallback, offline: true };
  }
};

export const aiGenerateQuestion = (jdText: string, difficulty: 'intern' | 'junior' | 'mid' | 'senior' | 'lead' = 'mid') =>
  USE_MOCK ? mockGenerateQuestion(jdText) : generateQuestion(jdText, difficulty);
export const aiEvaluate = USE_MOCK ? mockEvaluate : evaluateAnswer;
