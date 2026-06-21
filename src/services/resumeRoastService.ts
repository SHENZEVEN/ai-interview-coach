import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { CognitiveDiagnosis, AgentEvaluation } from './diagnosisService';

// ── 格式化日期 ──
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// ── 难度等级 ──
export type DifficultyLevel = 'intern' | 'junior' | 'mid' | 'senior' | 'lead';

export const DIFFICULTY_CONFIG: Record<DifficultyLevel, { label: string; description: string }> = {
  intern: { label: '实习生', description: '基础概念，注重学习能力和基础知识' },
  junior: { label: '初级', description: '基础应用，注重实际动手能力' },
  mid: { label: '中级', description: '深入理解，注重解决问题的能力' },
  senior: { label: '高级', description: '架构设计，注重系统优化和团队协作' },
  lead: { label: '专家/组长', description: '技术决策，注重技术选型和团队管理' },
};

// ── 面试回答记录 ──
export interface AnswerRecord {
  questionId: string;
  questionText: string;
  answer: string;
  evaluation: AgentEvaluation;
}

// ── 导出诊断报告为 JSON ──
export const exportDiagnosisToJSON = (
  diagnosis: CognitiveDiagnosis,
  answers: AnswerRecord[],
  difficulty: string
): void => {
  const exportData = {
    difficulty,
    overall_score: diagnosis.overall_score,
    logic_score: diagnosis.logic_score,
    communication_score: diagnosis.communication_score,
    depth_score: diagnosis.depth_score,
    strengths: diagnosis.strengths,
    weaknesses: diagnosis.weaknesses,
    improvement_plan: diagnosis.improvement_plan,
    knowledge_map: diagnosis.knowledge_map,
    radar_data: diagnosis.radar_data,
    timeline_data: diagnosis.timeline_data,
    answers: answers.map(a => ({
      question: a.questionText,
      answer: a.answer,
      score: a.evaluation.score,
      comment: a.evaluation.comment,
      knowledge_hits: a.evaluation.knowledge_hits,
      knowledge_gaps: a.evaluation.knowledge_gaps,
    })),
    exported_at: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ai-diagnosis-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── 导出诊断报告为 Word ──
export const exportDiagnosisToWord = (
  diagnosis: CognitiveDiagnosis,
  answers: AnswerRecord[],
  difficulty: string
): void => {
  const diffLabel = DIFFICULTY_CONFIG[difficulty as DifficultyLevel]?.label || difficulty;
  const children: Paragraph[] = [];

  // 标题
  children.push(new Paragraph({
    text: 'AI 面试 Agent — 认知诊断报告',
    heading: HeadingLevel.TITLE,
  }));
  children.push(new Paragraph({
    text: `难度：${diffLabel}  |  生成时间：${formatDate(Date.now())}`,
    spacing: { after: 400 },
  }));

  // ── 总分概览 ──
  children.push(new Paragraph({
    children: [
      new TextRun({ text: '总分：', bold: true, size: 28 }),
      new TextRun({ text: `${diagnosis.overall_score}分`, size: 32, bold: true,
        color: diagnosis.overall_score >= 60 ? '008000' : 'FF0000' }),
    ],
    spacing: { before: 400, after: 200 },
  }));
  children.push(new Paragraph({
    children: [
      new TextRun({ text: `逻辑连贯性：${diagnosis.logic_score}/10  |  ` }),
      new TextRun({ text: `表达清晰度：${diagnosis.communication_score}/10  |  ` }),
      new TextRun({ text: `回答深度：${diagnosis.depth_score}/10` }),
    ],
    spacing: { after: 400 },
  }));

  // ── 知识覆盖 ──
  children.push(new Paragraph({
    children: [new TextRun({ text: '知识覆盖', bold: true, size: 28 })],
    spacing: { before: 400, after: 200 },
  }));
  diagnosis.knowledge_map.forEach(kp => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${kp.name}：`, bold: true }),
        new TextRun({ text: `覆盖 ${Math.round(kp.coverage * 100)}%  |  深度 ${kp.depth_score}/10` }),
      ],
    }));
    if (kp.missing_concepts.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `  缺失概念：${kp.missing_concepts.join('、')}`, italics: true, size: 20 })],
      }));
    }
  });

  // ── 优势 ──
  children.push(new Paragraph({
    children: [new TextRun({ text: '✅ 优势', bold: true, size: 28 })],
    spacing: { before: 400, after: 200 },
  }));
  diagnosis.strengths.forEach(s => {
    children.push(new Paragraph({ children: [new TextRun({ text: `• ${s}` })] }));
  });

  // ── 短板 ──
  children.push(new Paragraph({
    children: [new TextRun({ text: '❌ 短板', bold: true, size: 28 })],
    spacing: { before: 400, after: 200 },
  }));
  diagnosis.weaknesses.forEach(w => {
    children.push(new Paragraph({ children: [new TextRun({ text: `• ${w}` })] }));
  });

  // ── 改进路径 ──
  children.push(new Paragraph({
    children: [new TextRun({ text: '💡 改进路径', bold: true, size: 28 })],
    spacing: { before: 400, after: 200 },
  }));
  diagnosis.improvement_plan.forEach((s, i) => {
    children.push(new Paragraph({ children: [new TextRun({ text: `${i + 1}. ${s}` })] }));
  });

  // ── 每题详细 ──
  children.push(new Paragraph({ text: '', spacing: { after: 400 } }));
  children.push(new Paragraph({
    children: [new TextRun({ text: '每题详细评分', bold: true, size: 28 })],
    spacing: { before: 400, after: 200 },
  }));

  answers.forEach((a, i) => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `Q${i + 1} `, bold: true, size: 24 }),
        new TextRun({ text: `${a.evaluation.score}分`, bold: true,
          color: a.evaluation.score >= 60 ? '008000' : 'FF0000' }),
      ],
      spacing: { before: 300, after: 100 },
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: '题目：', bold: true }), new TextRun({ text: a.questionText })],
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: '回答：', bold: true })],
    }));
    children.push(new Paragraph({ text: a.answer, spacing: { after: 100 } }));
    children.push(new Paragraph({
      children: [new TextRun({ text: `评语：${a.evaluation.comment}` })],
    }));
    if (a.evaluation.knowledge_hits.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `✅ 命中：${a.evaluation.knowledge_hits.join('；')}`, color: '22c55e' })],
      }));
    }
    if (a.evaluation.knowledge_gaps.length > 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `⚠ 缺口：${a.evaluation.knowledge_gaps.join('；')}`, color: 'ef4444' })],
      }));
    }
    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));
  });

  // 构建文档
  const doc = new Document({ sections: [{ properties: {}, children }] });
  Packer.toBlob(doc).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-diagnosis-${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
};
