import { API_KEY, API_BASE, buildHeaders, fetchWithRetry } from './aiService';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

// 格式化日期
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 导出面试报告为Word文档
export const exportInterviewReportToWord = (result: InterviewResult): void => {
  const children: Paragraph[] = [];

  // 标题
  children.push(
    new Paragraph({
      text: 'AI 面试模拟器 - 简历拷打报告',
      heading: HeadingLevel.TITLE,
    })
  );

  // 导出时间
  children.push(
    new Paragraph({
      text: `生成时间：${formatDate(Date.now())}`,
      spacing: { after: 400 },
    })
  );

  // 总分
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '总分：', bold: true, size: 28 }),
        new TextRun({ 
          text: `${result.totalScore}分`, 
          size: 32, 
          bold: true,
          color: result.totalScore >= 60 ? '008000' : 'FF0000'
        }),
      ],
      spacing: { before: 400, after: 200 },
    })
  );

  // 各类别分数
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '各类别评分', bold: true, size: 28 }),
      ],
      spacing: { before: 400, after: 200 },
    })
  );

  result.categoryScores.forEach((cat) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${cat.category}：`, bold: true }),
          new TextRun({ text: `${cat.score}分` }),
          new TextRun({ text: ` (权重${cat.weight}%)`, italics: true, size: 20 }),
        ],
      })
    );
  });

  children.push(new Paragraph({ text: '', spacing: { after: 400 } }));

  // 整体评价
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '整体评价', bold: true, size: 28 }),
      ],
      spacing: { before: 400, after: 200 },
    })
  );
  children.push(
    new Paragraph({
      text: result.overallComment,
      spacing: { after: 400 },
    })
  );

  // 优点
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '优点', bold: true, size: 28 }),
      ],
      spacing: { before: 400, after: 200 },
    })
  );
  result.strengths.forEach((s) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: '✅ ' }),
          new TextRun({ text: s }),
        ],
      })
    );
  });

  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  // 缺点
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '缺点', bold: true, size: 28 }),
      ],
      spacing: { before: 400, after: 200 },
    })
  );
  result.weaknesses.forEach((w) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: '❌ ' }),
          new TextRun({ text: w }),
        ],
      })
    );
  });

  children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

  // 改进建议
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '改进建议', bold: true, size: 28 }),
      ],
      spacing: { before: 400, after: 200 },
    })
  );
  result.suggestions.forEach((s, i) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. ` }),
          new TextRun({ text: s }),
        ],
      })
    );
  });

  // 创建文档
  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  // 导出
  Packer.toBlob(doc).then((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interview-report-${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
};

// 导出面试报告为JSON
export const exportInterviewReportToJSON = (result: InterviewResult): void => {
  const dataStr = JSON.stringify(result, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `interview-report-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 简历分析结果
export interface EducationInfo {
  school?: string;
  major?: string;
  degree?: string;
  period?: string;
  status?: string;
}

export interface ResumeAnalysis {
  name?: string;
  education?: string | EducationInfo;
  workExperience?: string[];
  skills?: string[];
  projects?: string[];
  summary: string;
}

// 面试问题
export interface InterviewQuestion {
  id: number;
  question: string;
  category: '基础能力' | '项目经验' | '技术深度' | '架构设计' | '综合素质';
  keyPoints: string[];
}

// 回答评估
export interface AnswerEvaluation {
  score: number;
  strengths: string[];
  weaknesses: string[];
  improvement: string;
}

// 面试总分
export interface InterviewResult {
  totalScore: number;
  categoryScores: {
    category: string;
    score: number;
    weight: number;
  }[];
  overallComment: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

// 验证API Key
const validateAPIKey = () => {
  if (!API_KEY) {
    throw new Error('未配置 API Key，请检查环境变量');
  }
};

// 解析简历
export const analyzeResume = async (resumeText: string): Promise<ResumeAnalysis> => {
  validateAPIKey();
  const prompt = `你是一个专业的简历分析师。请分析以下简历内容，提取关键信息。

简历内容：
${resumeText}

请以JSON格式返回分析结果，包含以下字段：
- name: 姓名（如果有）
- education: 学历背景
- workExperience: 工作经历列表
- skills: 技能列表
- projects: 项目经验列表
- summary: 简历整体评价（2-3句话）

只返回JSON，不要有其他内容。`;

  try {
    const response = await fetchWithRetry(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 提取JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      summary: '简历分析完成'
    };
  } catch (error) {
    console.error('简历解析失败:', error);
    throw error;
  }
};

// 生成面试问题
export const generateInterviewQuestions = async (
  resumeAnalysis: ResumeAnalysis,
  questionCount: number = 5
): Promise<InterviewQuestion[]> => {
  validateAPIKey();
  const prompt = `你是一个严厉的面试官，正在对候选人进行"拷打"式面试。

候选人简历分析：
- 姓名：${resumeAnalysis.name || '未知'}
- 学历：${typeof resumeAnalysis.education === 'object' 
    ? `${resumeAnalysis.education.degree || ''} ${resumeAnalysis.education.school || ''} ${resumeAnalysis.education.major || ''}`.trim() || '未知'
    : resumeAnalysis.education || '未知'}
- 工作经历：${resumeAnalysis.workExperience?.join('；') || '未知'}
- 技能：${resumeAnalysis.skills?.join('、') || '未知'}
- 项目经验：${resumeAnalysis.projects?.join('；') || '未知'}

请生成${questionCount}道面试问题，这些问题要：
1. 严格基于简历内容，挖掘细节
2. 具有挑战性，考察真实能力
3. 涵盖不同方面：基础能力、项目经验、技术深度、架构设计、综合素质
4. 语气要犀利、专业、严格

以JSON数组格式返回，每道问题包含：
- id: 序号
- question: 问题内容
- category: 问题类别（基础能力/项目经验/技术深度/架构设计/综合素质）
- keyPoints: 评判要点数组（3-5个）

只返回JSON数组，不要有其他内容。`;

  try {
    const response = await fetchWithRetry(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 提取JSON数组
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // 验证并转换数据格式
      if (Array.isArray(parsed)) {
        return parsed.map((q: any, index: number) => ({
          id: typeof q.id === 'number' ? q.id : index + 1,
          question: typeof q.question === 'string' ? q.question : '未知问题',
          category: typeof q.category === 'string' ? q.category : '综合素质',
          keyPoints: Array.isArray(q.keyPoints) 
            ? q.keyPoints.map((k: any) => typeof k === 'string' ? k : JSON.stringify(k))
            : []
        }));
      }
    }
    
    return [];
  } catch (error) {
    console.error('生成面试问题失败:', error);
    throw error;
  }
};

// 评估回答
export const evaluateAnswer = async (
  question: InterviewQuestion,
  answer: string,
  resumeContext: string
): Promise<AnswerEvaluation> => {
  validateAPIKey();
  const prompt = `你是一个严厉的面试官，正在评估候选人的回答。

问题：${question.question}
评判要点：${question.keyPoints.join('、')}

候选人回答：
${answer}

简历背景：
${resumeContext}

请严格评估这个回答，给出：
- score: 0-100的分数（60分以下说明回答很差）
- strengths: 回答的优点（最多3点）
- weaknesses: 回答的严重问题（最多3点）
- improvement: 改进建议

语气要严厉、直接，不要客套。

以JSON格式返回，不要有其他内容。`;

  try {
    const response = await fetchWithRetry(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 提取JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // 验证并转换数据格式
      return {
        score: typeof parsed.score === 'number' ? parsed.score : 50,
        strengths: Array.isArray(parsed.strengths) 
          ? parsed.strengths.map((s: any) => typeof s === 'string' ? s : JSON.stringify(s))
          : [],
        weaknesses: Array.isArray(parsed.weaknesses) 
          ? parsed.weaknesses.map((w: any) => typeof w === 'string' ? w : JSON.stringify(w))
          : [],
        improvement: typeof parsed.improvement === 'string' ? parsed.improvement : '请重新回答'
      };
    }
    
    return {
      score: 50,
      strengths: [],
      weaknesses: ['评估失败'],
      improvement: '请重新回答'
    };
  } catch (error) {
    console.error('评估回答失败:', error);
    throw error;
  }
};

// 生成最终面试报告
export const generateInterviewReport = async (
  questions: InterviewQuestion[],
  answers: { questionId: number; answer: string; evaluation: AnswerEvaluation }[],
  resumeAnalysis: ResumeAnalysis
): Promise<InterviewResult> => {
  validateAPIKey();
  const answersSummary = answers.map(a => {
    const q = questions.find(q => q.id === a.questionId);
    return `问题：${q?.question}\n回答：${a.answer}\n评分：${a.evaluation.score}分`;
  }).join('\n\n');

  const prompt = `你是一个资深面试官，正在对候选人进行最终评估。

候选人信息：
- 姓名：${resumeAnalysis.name || '未知'}
- 学历：${typeof resumeAnalysis.education === 'object' 
    ? `${resumeAnalysis.education.degree || ''} ${resumeAnalysis.education.school || ''} ${resumeAnalysis.education.major || ''}`.trim() || '未知'
    : resumeAnalysis.education || '未知'}
- 技能：${resumeAnalysis.skills?.join('、') || '未知'}

面试问答情况：
${answersSummary}

请根据所有问答情况，给出综合评估：

1. 计算各类别的平均分：
   - 基础能力（25%权重）
   - 项目经验（25%权重）
   - 技术深度（25%权重）
   - 架构设计（15%权重）
   - 综合素质（10%权重）

2. 计算总分（满分100分）

3. 给出：
   - overallComment: 整体评价（一针见血地指出问题）
   - strengths: 优点列表（3-5条）
   - weaknesses: 缺点列表（3-5条，要尖锐）
   - suggestions: 改进建议（3-5条，要具体可执行）

语气要严厉、客观、直接，不要留情面。评估要基于实际表现，不要虚假夸奖。

以JSON格式返回，包含：
- totalScore: 总分
- categoryScores: 各类别评分和权重
- overallComment: 整体评价
- strengths: 优点列表
- weaknesses: 缺点列表
- suggestions: 建议列表

只返回JSON，不要有其他内容。`;

  try {
    const response = await fetchWithRetry(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: buildHeaders(),
      body: JSON.stringify({
        model: 'agnes-2.0-flash',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.5
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // 提取JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      
      // 验证并转换数据格式
      const result: InterviewResult = {
        totalScore: typeof parsed.totalScore === 'number' ? parsed.totalScore : 60,
        categoryScores: Array.isArray(parsed.categoryScores) 
          ? parsed.categoryScores.map((cat: any) => ({
              category: typeof cat.category === 'string' ? cat.category : '未知类别',
              score: typeof cat.score === 'number' ? cat.score : 60,
              weight: typeof cat.weight === 'number' ? cat.weight : 20
            }))
          : [],
        overallComment: typeof parsed.overallComment === 'string' ? parsed.overallComment : '评估完成',
        strengths: Array.isArray(parsed.strengths) 
          ? parsed.strengths.map((s: any) => typeof s === 'string' ? s : JSON.stringify(s))
          : [],
        weaknesses: Array.isArray(parsed.weaknesses) 
          ? parsed.weaknesses.map((w: any) => typeof w === 'string' ? w : JSON.stringify(w))
          : [],
        suggestions: Array.isArray(parsed.suggestions) 
          ? parsed.suggestions.map((s: any) => typeof s === 'string' ? s : JSON.stringify(s))
          : []
      };
      
      return result;
    }
    
    return {
      totalScore: 60,
      categoryScores: [],
      overallComment: '评估失败',
      strengths: [],
      weaknesses: ['评估生成失败'],
      suggestions: ['请重试']
    };
  } catch (error) {
    console.error('生成面试报告失败:', error);
    throw error;
  }
};