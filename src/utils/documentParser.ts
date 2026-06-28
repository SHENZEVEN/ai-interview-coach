import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';
import type { Category, QuestionBankItem } from '../types';
import { parseImage, isImageFile } from './imageParser';

// 默认类别
const DEFAULT_CATEGORY: Category = '前端';

export interface ParsedQuestion {
  text: string;
  referenceAnswer?: string;
  category?: Category;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export const parsePDF = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdfParse = new PDFParse({ data: arrayBuffer });
  const result = await pdfParse.getText();
  return result.text;
};

export const parseWord = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

export const parseDocument = async (file: File): Promise<string> => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  
  if (extension === 'pdf') {
    return parsePDF(file);
  } else if (extension === 'docx') {
    return parseWord(file);
  } else if (isImageFile(file)) {
    return parseImage(file);
  } else if (extension === 'txt' || extension === 'md') {
    return file.text();
  } else {
    throw new Error('不支持的文件格式');
  }
};

// 获取支持的文件格式
export const getSupportedFormats = (): string => {
  return '.pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt,.md';
};

export const extractQuestions = (text: string, category: Category): ParsedQuestion[] => {
  const questions: ParsedQuestion[] = [];
  const lines = text.split('\n').filter(line => line.trim());
  
  let currentQuestion: ParsedQuestion | null = null;
  let currentAnswer = '';
  let inAnswer = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.match(/^\d+[\.\uff0e、]\s*/)) {
      if (currentQuestion) {
        if (currentAnswer.trim()) {
          currentQuestion.referenceAnswer = currentAnswer.trim();
        }
        questions.push(currentQuestion);
      }
      
      const questionText = trimmedLine.replace(/^\d+[\.\uff0e、]\s*/, '').trim();
      currentQuestion = { text: questionText, category };
      currentAnswer = '';
      inAnswer = false;
    } else if (trimmedLine.includes('答案') || trimmedLine.includes('参考答案') || trimmedLine.includes('解析')) {
      inAnswer = true;
      currentAnswer += trimmedLine.replace(/(答案|参考答案|解析)[：:]?\s*/, '').trim() + ' ';
    } else if (inAnswer && currentQuestion) {
      currentAnswer += trimmedLine + ' ';
    } else if (currentQuestion && !inAnswer && !trimmedLine.match(/^\d+[\.\uff0e、]/)) {
      currentQuestion.text += ' ' + trimmedLine;
    }
  }
  
  if (currentQuestion) {
    if (currentAnswer.trim()) {
      currentQuestion.referenceAnswer = currentAnswer.trim();
    }
    questions.push(currentQuestion);
  }
  
  return questions;
};

export const questionsToBankItems = (questions: ParsedQuestion[]): QuestionBankItem[] => {
  return questions.map((q, index) => ({
    id: `doc-${Date.now()}-${index}`,
    text: q.text,
    keyPoints: [],
    referenceAnswer: q.referenceAnswer || '',
    category: q.category || DEFAULT_CATEGORY,
    difficulty: q.difficulty || 'medium',
    source: 'custom' as const,
    createdAt: Date.now(),
    totalAttempts: 0,
    correctAttempts: 0,
    isWrong: false,
  }));
};