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
  mode: 'quick' | 'targeted';
  category?: string;
  questionText: string;
  userAnswer: string;
  score: number;
  comment: string;
  referenceAnswer: string;
  isWrong: boolean;
  jdText?: string;
}

export interface AIEvaluation {
  score: number;
  comment: string;
  referenceAnswer: string;
}

export type Category = '前端' | '计网' | '算法' | 'AI Coding' | '定制';

export const CATEGORIES: Category[] = ['前端', '计网', '算法', 'AI Coding', '定制'];

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