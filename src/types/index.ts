export interface Question {
  id: string;
  text: string;
  keyPoints: string[];
  referenceAnswer: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  source?: 'builtin' | 'ai' | 'custom';
  correctRate?: number;
  totalAttempts?: number;
  correctAttempts?: number;
  isWrong?: boolean;
  createdAt?: number;
}

export interface QuestionCategory {
  name: string;
  questions: Question[];
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  mode: 'quick' | 'targeted' | 'roast' | 'prep_drill';
  category?: string;
  questionText: string;
  userAnswer: string;
  score: number;
  comment: string;
  referenceAnswer: string;
  isWrong: boolean;
  jdText?: string;
  // 面试拷打扩展字段
  sessionId?: string;
  knowledgeHits?: string[];
  knowledgeGaps?: string[];
  diagnosisScore?: number;
  // 面试准备扩展字段
  prepId?: string;
  prepTitle?: string;
}

export interface AIEvaluation {
  score: number;
  comment: string;
  referenceAnswer: string;
}

export type Category = '前端' | '计网' | '算法' | 'AI Coding' | '系统设计' | '数据库' | '操作系统' | 'AI基础' | '产品设计' | '定制';

export const CATEGORIES: Category[] = ['前端', '计网', '算法', 'AI Coding', '系统设计', '数据库', '操作系统', 'AI基础', '产品设计', '定制'];

// 岗位方向 → 题库分类映射
export const DIRECTION_CATEGORIES: Record<string, Category[]> = {
  A: ['产品设计', '定制'],
  B: ['产品设计', '定制'],
  C: ['产品设计', '定制'],
  D: ['产品设计', '定制'],
  E: ['AI基础', '产品设计', 'AI Coding', '定制'],
  F: ['前端', '计网', '算法', 'AI Coding', '系统设计', '数据库', '操作系统', 'AI基础'],
  G: ['前端', '计网', '算法', 'AI Coding', '系统设计', '数据库', '操作系统', 'AI基础', '产品设计', '定制'],
};

// 题库相关类型
export interface QuestionBankItem extends Question {
  category: Category; // 主类别
  categories?: Category[]; // 多类别支持（题目可同时属于多个类别）
  source: 'builtin' | 'ai' | 'custom';
  createdAt: number;
  totalAttempts: number;
  correctAttempts: number;
}

export interface PracticeProgress {
  category: Category;
  total: number;
  completed: number;
  mastered: number;
  correctRate: number;
}

export interface CustomQuestionInput {
  text: string;
  keyPoints: string[];
  referenceAnswer: string;
  category: Category;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuestionFilter {
  category?: Category;
  source?: 'builtin' | 'ai' | 'custom';
  difficulty?: 'easy' | 'medium' | 'hard';
  isWrong?: boolean;
  searchKeyword?: string;
}