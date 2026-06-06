import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { HistoryRecord } from '../types';

// 格式化日期
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

// 导出为 Word 文档
export const exportToWord = (records: HistoryRecord[]): void => {
  const children: Paragraph[] = [];

  // 标题
  children.push(
    new Paragraph({
      text: 'AI 面试模拟器 - 历史记录',
      heading: HeadingLevel.TITLE,
    })
  );

  // 导出时间
  children.push(
    new Paragraph({
      text: `导出时间：${formatDate(Date.now())}`,
      spacing: { after: 400 },
    })
  );

  // 统计信息
  const totalRecords = records.length;
  const correctRecords = records.filter(r => r.score >= 7).length;
  const wrongRecords = totalRecords - correctRecords;
  const avgScore = totalRecords > 0 
    ? Math.round(records.reduce((sum, r) => sum + r.score, 0) / totalRecords) 
    : 0;

  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: '统计概览', bold: true, size: 28 }),
      ],
      spacing: { before: 400, after: 200 },
    })
  );

  children.push(new Paragraph({ text: `总记录数：${totalRecords}` }));
  children.push(new Paragraph({ text: `正确数：${correctRecords}` }));
  children.push(new Paragraph({ text: `错误数：${wrongRecords}` }));
  children.push(new Paragraph({ text: `平均分：${avgScore}分` }));

  children.push(new Paragraph({ text: '', spacing: { after: 400 } }));

  // 记录详情
  records.forEach((record, index) => {
    // 记录分隔
    children.push(
      new Paragraph({
        text: `【记录 ${index + 1}】`,
        heading: HeadingLevel.HEADING_2,
        pageBreakBefore: index > 0,
      })
    );

    // 基本信息
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: '模式：', bold: true }),
          new TextRun(record.mode === 'quick' ? '快速练习' : '针对性练习'),
        ],
      })
    );

    if (record.category) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '类别：', bold: true }),
            new TextRun(record.category),
          ],
        })
      );
    }

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: '得分：', bold: true }),
          new TextRun({
            text: `${record.score}分`,
            color: record.score >= 7 ? '008000' : 'FF0000',
          }),
        ],
      })
    );

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: '时间：', bold: true }),
          new TextRun(formatDate(record.timestamp)),
        ],
      })
    );

    children.push(new Paragraph({ text: '', spacing: { after: 200 } }));

    // 题目
    children.push(
      new Paragraph({
        children: [new TextRun({ text: '题目：', bold: true })],
      })
    );
    children.push(
      new Paragraph({
        text: record.questionText,
        spacing: { after: 200 },
      })
    );

    // 我的回答
    children.push(
      new Paragraph({
        children: [new TextRun({ text: '我的回答：', bold: true })],
      })
    );
    children.push(
      new Paragraph({
        text: record.userAnswer,
        spacing: { after: 200 },
      })
    );

    // AI 评语
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'AI 评语：', bold: true })],
      })
    );
    children.push(
      new Paragraph({
        text: record.comment,
        spacing: { after: 200 },
      })
    );

    // 参考答案
    children.push(
      new Paragraph({
        children: [new TextRun({ text: '参考答案：', bold: true })],
      })
    );
    children.push(
      new Paragraph({
        text: record.referenceAnswer,
        spacing: { after: 400 },
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
    a.download = `interview-history-${new Date().toISOString().slice(0, 10)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
};

// 导出为 JSON
export const exportToJSON = (records: HistoryRecord[]): void => {
  const dataStr = JSON.stringify(records, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `interview-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// 导出类型
export type ExportFormat = 'json' | 'word';

// 统一导出函数
export const exportHistoryRecords = (records: HistoryRecord[], format: ExportFormat): void => {
  switch (format) {
    case 'word':
      exportToWord(records);
      break;
    case 'json':
    default:
      exportToJSON(records);
      break;
  }
};