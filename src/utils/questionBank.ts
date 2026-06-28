import { QuestionBankItem, PracticeProgress, CustomQuestionInput, Category, QuestionFilter, CATEGORIES } from '../types';
import { questionsData } from '../data/questions';
import { v4 as uuidv4 } from 'uuid';

const QUESTION_BANK_KEY = 'ai_interview_question_bank';
const CUSTOM_QUESTIONS_KEY = 'ai_interview_custom_questions';
const QUESTION_BANK_VERSION_KEY = 'ai_interview_question_bank_version';
const CURRENT_VERSION = '3.1'; // 更新版本号以触发数据更新（3.1: 确保全部10个分类加载）

// 内存缓存，避免每次 JSON.parse
let cachedBank: QuestionBankItem[] | null = null;

// 初始化题库数据
const initializeQuestionBank = (): QuestionBankItem[] => {
  // 命中内存缓存则直接返回
  if (cachedBank) return cachedBank;

  const stored = localStorage.getItem(QUESTION_BANK_KEY);
  const storedVersion = localStorage.getItem(QUESTION_BANK_VERSION_KEY);
  
  // 如果没有存储数据或版本不匹配，重新初始化
  if (!stored || storedVersion !== CURRENT_VERSION) {
    const initialBank: QuestionBankItem[] = [];
    questionsData.forEach(category => {
      category.questions.forEach(question => {
        initialBank.push({
          ...question,
          category: category.name as Category,
          source: 'builtin',
          difficulty: 'medium',
          createdAt: Date.now(),
          totalAttempts: 0,
          correctAttempts: 0,
          correctRate: 0
        });
      });
    });

    localStorage.setItem(QUESTION_BANK_KEY, JSON.stringify(initialBank));
    localStorage.setItem(QUESTION_BANK_VERSION_KEY, CURRENT_VERSION);
    cachedBank = initialBank;
    return initialBank;
  }

  const parsed: QuestionBankItem[] = JSON.parse(stored);
  cachedBank = parsed;
  return parsed;
};

// 使缓存失效（写操作后调用）
const invalidateCache = () => { cachedBank = null; };

// 写入 localStorage 并使缓存失效
const saveBank = (data: QuestionBankItem[]) => {
  localStorage.setItem(QUESTION_BANK_KEY, JSON.stringify(data));
  invalidateCache();
  cachedBank = data;
};

// 获取所有题目
export const getAllQuestions = (): QuestionBankItem[] => {
  return initializeQuestionBank();
};

// 根据筛选条件获取题目（支持多类别）
export const getFilteredQuestions = (filter: QuestionFilter): QuestionBankItem[] => {
  const allQuestions = getAllQuestions();
  
  return allQuestions.filter(question => {
    // 支持多类别筛选：检查 category 和 categories 字段
    if (filter.category) {
      const matchCategory = question.category === filter.category || 
                           (question.categories && question.categories.includes(filter.category));
      if (!matchCategory) return false;
    }
    if (filter.source && question.source !== filter.source) return false;
    if (filter.difficulty && question.difficulty !== filter.difficulty) return false;
    if (filter.isWrong !== undefined && question.isWrong !== filter.isWrong) return false;
    if (filter.searchKeyword) {
      const keyword = filter.searchKeyword.toLowerCase();
      return question.text.toLowerCase().includes(keyword) ||
             question.referenceAnswer.toLowerCase().includes(keyword);
    }
    return true;
  });
};

// 根据ID获取题目
export const getQuestionById = (id: string): QuestionBankItem | undefined => {
  const allQuestions = getAllQuestions();
  return allQuestions.find(q => q.id === id);
};

// 添加自定义题目
export const addCustomQuestion = (input: CustomQuestionInput): QuestionBankItem => {
  const allQuestions = getAllQuestions();
  const newQuestion: QuestionBankItem = {
    id: `custom-${uuidv4()}`,
    text: input.text,
    keyPoints: input.keyPoints,
    referenceAnswer: input.referenceAnswer,
    category: input.category,
    source: 'custom',
    difficulty: input.difficulty,
    createdAt: Date.now(),
    totalAttempts: 0,
    correctAttempts: 0,
    correctRate: 0,
    isWrong: false
  };

  allQuestions.push(newQuestion);
  saveBank(allQuestions);
  
  return newQuestion;
};

// 批量添加题目
export const addQuestions = (questions: QuestionBankItem[]): void => {
  const allQuestions = getAllQuestions();
  allQuestions.push(...questions);
  saveBank(allQuestions);
};

// 添加AI生成的题目（支持多类别）
export const addAIQuestion = (
  text: string,
  keyPoints: string[],
  referenceAnswer: string,
  categories: Category[] // 改为数组，支持多类别
): QuestionBankItem => {
  const allQuestions = getAllQuestions();
  
  // 主类别取第一个，如果包含"定制"则取其他类别作为主类别
  let primaryCategory = categories[0];
  if (categories.includes('定制') && categories.length > 1) {
    primaryCategory = categories.find(c => c !== '定制') || '定制';
  }
  
  const newQuestion: QuestionBankItem = {
    id: `ai-${uuidv4()}`,
    text,
    keyPoints,
    referenceAnswer,
    category: primaryCategory,
    categories: categories, // 存储所有类别
    source: 'ai',
    difficulty: 'medium',
    createdAt: Date.now(),
    totalAttempts: 0,
    correctAttempts: 0,
    correctRate: 0,
    isWrong: false
  };

  allQuestions.push(newQuestion);
  saveBank(allQuestions);
  
  console.log('AI题目已添加到题库:', newQuestion);
  return newQuestion;
};

// 更新题目
export const updateQuestion = (id: string, updates: Partial<QuestionBankItem>): boolean => {
  const allQuestions = getAllQuestions();
  const index = allQuestions.findIndex(q => q.id === id);
  
  if (index === -1) return false;
  
  allQuestions[index] = { ...allQuestions[index], ...updates };
  saveBank(allQuestions);
  
  return true;
};

// 删除题目
export const deleteQuestion = (id: string): boolean => {
  const allQuestions = getAllQuestions();
  const filtered = allQuestions.filter(q => q.id !== id);
  
  if (filtered.length === allQuestions.length) return false;
  
  saveBank(filtered);
  return true;
};

// 更新题目练习统计
export const updateQuestionStats = (questionId: string, score: number): void => {
  const allQuestions = getAllQuestions();
  const index = allQuestions.findIndex(q => q.id === questionId);
  
  if (index === -1) return;
  
  const question = allQuestions[index];
  question.totalAttempts += 1;
  if (score >= 7) {
    question.correctAttempts += 1;
  }
  question.correctRate = Math.round((question.correctAttempts / question.totalAttempts) * 100);
  question.isWrong = score < 7;
  
  saveBank(allQuestions);
};

// 获取练习进度统计（支持多类别）
export const getPracticeProgress = (): PracticeProgress[] => {
  const allQuestions = getAllQuestions();
  
  return CATEGORIES.map(category => {
    // 支持多类别：检查主类别和categories字段
    const categoryQuestions = allQuestions.filter(q => 
      q.category === category || 
      (q.categories && q.categories.includes(category))
    );
    const total = categoryQuestions.length;
    const completed = categoryQuestions.filter(q => q.totalAttempts > 0).length;
    const mastered = categoryQuestions.filter(q => (q.correctRate ?? 0) >= 70).length;
    const totalAttempts = categoryQuestions.reduce((sum, q) => sum + q.totalAttempts, 0);
    const correctAttempts = categoryQuestions.reduce((sum, q) => sum + q.correctAttempts, 0);
    const correctRate = totalAttempts > 0 ? Math.round((correctAttempts / totalAttempts) * 100) : 0;
    
    return {
      category,
      total,
      completed,
      mastered,
      correctRate
    };
  });
};

// 根据类别获取题目（用于快速练习，支持多类别）
export const getQuestionsByCategory = (category: Category): QuestionBankItem[] => {
  const allQuestions = getAllQuestions();
  return allQuestions.filter(q => 
    q.category === category || 
    (q.categories && q.categories.includes(category))
  );
};

// 获取错题
export const getWrongQuestions = (): QuestionBankItem[] => {
  const allQuestions = getAllQuestions();
  return allQuestions.filter(q => q.isWrong === true);
};

// 获取未掌握的题目（正确率<70%）
export const getUnmasteredQuestions = (): QuestionBankItem[] => {
  const allQuestions = getAllQuestions();
  return allQuestions.filter(q => q.totalAttempts > 0 && (q.correctRate ?? 0) < 70);
};