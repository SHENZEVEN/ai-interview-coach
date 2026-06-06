import { AIEvaluation, Question, Category } from '../types';

// 生成题目返回类型（包含题目和类别）
export interface GeneratedQuestion {
  text: string;
  categories: Category[];
}

export const API_KEY = import.meta.env.VITE_AGNES_API_KEY || '';
export const API_BASE = 'https://apihub.agnes-ai.com/v1';

const TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export const buildHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`
});

// 延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 带超时的 fetch
const fetchWithTimeout = async (url: string, options: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  
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

export const generateQuestion = async (jdText: string): Promise<GeneratedQuestion> => {
  if (!API_KEY) {
    throw new Error('未配置 API Key，请检查环境变量');
  }

  try {
    const response = await fetchWithRetry(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [
          {
            role: 'system',
            content: `你是一个专业的面试官。根据提供的职位描述（JD）或面经，生成一道相关的技术面试题。

请判断题目主要属于哪个领域，可选领域：前端、计网、算法、AI Coding。
- 前端：涉及HTML/CSS/JavaScript/React/Vue/浏览器等
- 计网：涉及HTTP/TCP/IP/网络协议/网络安全等
- 算法：涉及数据结构/算法/复杂度分析等
- AI Coding：涉及AI工具使用/AI辅助编程/提示词工程等

请用JSON格式返回，格式如下：
{
  "question": "面试题内容",
  "category": "前端/计网/算法/AI Coding"
}`
          },
          {
            role: 'user',
            content: `根据以下JD/面经生成一道面试题：\n\n${jdText}`
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `AI服务异常 (${response.status})`;
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('AI返回内容为空，请重试');
    }

    // 尝试解析JSON响应
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      const result = JSON.parse(jsonStr);
      
      // 验证并转换类别
      const validCategories: Category[] = ['前端', '计网', '算法', 'AI Coding'];
      const category = validCategories.includes(result.category) ? result.category : '前端';
      
      return {
        text: result.question || content,
        categories: [category, '定制'] // 同时包含领域类别和定制标签
      };
    } catch {
      // JSON解析失败，返回原始内容，默认前端类别
      return {
        text: content,
        categories: ['前端', '定制']
      };
    }
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
    const questionText = typeof question === 'string' ? question : question.text;
    const referenceAnswer = typeof question === 'string' ? '' : question.referenceAnswer;

    const prompt = `你是一个专业的面试评价专家。请根据面试题和用户的回答给出评价。

面试题：${questionText}
${referenceAnswer ? `参考要点：${referenceAnswer}` : ''}

用户回答：${userAnswer}

请从以下几个方面评价：
1. 回答的完整性和准确性
2. 专业知识掌握程度
3. 表达能力和逻辑性

请用JSON格式返回评价，格式如下：
{
  "score": 分数(1-10整数),
  "comment": "简短的评语(50字以内)",
  "referenceAnswer": "参考答案要点"
}`;

    const response = await fetchWithRetry(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的面试评价专家。你需要根据面试题和用户的回答，给出1-10分的评分和简短的评语，以及参考答案。请严格按照要求的JSON格式返回。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error?.message || `AI服务异常 (${response.status})`;
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('AI返回内容为空，请重试');
    }

    // 尝试解析JSON响应
    try {
      // 提取JSON（可能在反引号中）
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
      const result = JSON.parse(jsonStr);
      
      return {
        score: Math.min(10, Math.max(1, parseInt(result.score) || 5)),
        comment: result.comment || '回答已收到',
        referenceAnswer: result.referenceAnswer || referenceAnswer || '参考答案请查看相关资料',
      };
    } catch {
      // 如果JSON解析失败，尝试从文本中提取分数
      const scoreMatch = content.match(/score["\s:]+(\d+)/i);
      const score = scoreMatch ? Math.min(10, Math.max(1, parseInt(scoreMatch[1]))) : 5;
      
      return {
        score,
        comment: 'AI评价完成',
        referenceAnswer: referenceAnswer || '参考答案请查看相关资料',
      };
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('AI评价失败，请稍后重试');
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

// 是否使用模拟服务
const USE_MOCK = !API_KEY;

export const aiGenerateQuestion = USE_MOCK ? mockGenerateQuestion : generateQuestion;
export const aiEvaluate = USE_MOCK ? mockEvaluate : evaluateAnswer;
