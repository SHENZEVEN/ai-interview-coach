import type { PrepDocument } from './prepService';

const STORAGE_KEY = 'ai-interview-coach-preps';

export interface SavedPrep extends PrepDocument {
  savedAt: number;
  lastUsedAt?: number;
}

export const savePrep = (prep: PrepDocument): void => {
  const preps = getPreps();
  const existingIndex = preps.findIndex(p => p.meta.prep_id === prep.meta.prep_id);
  
  const savedPrep: SavedPrep = {
    ...prep,
    savedAt: Date.now(),
    lastUsedAt: Date.now(),
  };
  
  if (existingIndex >= 0) {
    preps[existingIndex] = savedPrep;
  } else {
    preps.unshift(savedPrep);
    // 最多保存10个文档
    if (preps.length > 10) {
      preps.pop();
    }
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preps));
};

export const getPreps = (): SavedPrep[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const getPrep = (prepId: string): SavedPrep | undefined => {
  const preps = getPreps();
  return preps.find(p => p.meta.prep_id === prepId);
};

export const deletePrep = (prepId: string): void => {
  const preps = getPreps().filter(p => p.meta.prep_id !== prepId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(preps));
};

export const updatePrepLastUsed = (prepId: string): void => {
  const preps = getPreps();
  const index = preps.findIndex(p => p.meta.prep_id === prepId);
  if (index >= 0) {
    preps[index].lastUsedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preps));
  }
};

export const exportPrepToJSON = (prep: PrepDocument): void => {
  const dataStr = JSON.stringify(prep, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `面试准备_${prep.meta.role_name}_${prep.meta.company_name || '未知公司'}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const exportPrepToMarkdown = (prep: PrepDocument): void => {
  let md = `# 面试准备文档\n\n`;
  md += `## 基本信息\n`;
  md += `- 岗位：${prep.meta.role_name}\n`;
  md += `- 公司：${prep.meta.company_name || '未指定'}\n`;
  md += `- 方向：${prep.meta.direction === 'E' ? 'AI产品' : 'AI全栈开发'}\n`;
  md += `- 难度：${prep.meta.difficulty}\n`;
  md += `- 生成时间：${new Date(prep.meta.generated_at).toLocaleString('zh-CN')}\n\n`;

  if (prep.company_research) {
    md += `## 一、公司调研\n`;
    md += `### 公司概况\n`;
    md += `${prep.company_research.company_overview || '暂无'}\n\n`;
    md += `### 技术文化\n`;
    md += `${prep.company_research.tech_culture || '暂无'}\n\n`;
    if (prep.company_research.key_focus_areas && prep.company_research.key_focus_areas.length > 0) {
      md += `### 重点关注领域\n`;
      prep.company_research.key_focus_areas.forEach((area, idx) => {
        md += `${idx + 1}. ${area}\n`;
      });
      md += '\n';
    }
    md += `### 选择理由\n`;
    md += `${prep.company_research.why_xiaohongshu_for_ai || prep.company_research.why_this_company || '暂无'}\n\n`;
  }

  if (prep.jd_analysis) {
    md += `## 二、JD分析\n`;
    if (prep.jd_analysis.core_requirements && prep.jd_analysis.core_requirements.length > 0) {
      md += `### 核心要求\n`;
      prep.jd_analysis.core_requirements.forEach((req, idx) => {
        md += `${idx + 1}. ${req}\n`;
      });
      md += '\n';
    }
    if (prep.jd_analysis.preferred_qualifications && prep.jd_analysis.preferred_qualifications.length > 0) {
      md += `### 加分项\n`;
      prep.jd_analysis.preferred_qualifications.forEach((qual, idx) => {
        md += `${idx + 1}. ${qual}\n`;
      });
      md += '\n';
    }
    if (prep.jd_analysis.gap_identification && prep.jd_analysis.gap_identification.length > 0) {
      md += `### 差距识别\n`;
      prep.jd_analysis.gap_identification.forEach((gap, idx) => {
        md += `${idx + 1}. ${gap}\n`;
      });
      md += '\n';
    }
  }

  if (prep.self_intro) {
    md += `## 三、自我介绍\n`;
    md += `### 时长建议\n`;
    md += `${prep.self_intro.duration_seconds || 90}秒\n\n`;
    md += `### 脚本内容\n`;
    md += `${prep.self_intro.script || '暂无'}\n\n`;
    if (prep.self_intro.key_highlights && prep.self_intro.key_highlights.length > 0) {
      md += `### 重点亮点\n`;
      prep.self_intro.key_highlights.forEach((highlight, idx) => {
        md += `${idx + 1}. ${highlight}\n`;
      });
      md += '\n';
    }
  }

  if (prep.star_stories && prep.star_stories.length > 0) {
    md += `## 四、项目深挖（STAR）\n`;
    prep.star_stories.forEach((story, idx) => {
      md += `### ${idx + 1}. ${story.project_name || `项目${idx + 1}`}\n`;
      md += `**Situation（背景）**：${story.situation || ''}\n\n`;
      md += `**Task（任务）**：${story.task || ''}\n\n`;
      md += `**Action（行动）**：${story.action || ''}\n\n`;
      md += `**Result（结果）**：${story.result || ''}\n\n`;
      if (story.follow_up_questions && story.follow_up_questions.length > 0) {
        md += `**追问问题**：\n`;
        story.follow_up_questions.forEach((q, qIdx) => {
          md += `   ${qIdx + 1}. ${q}\n`;
        });
        md += '\n';
      }
    });
  }

  if (prep.predicted_questions && prep.predicted_questions.length > 0) {
    md += `## 五、高频问题预测\n`;
    prep.predicted_questions.forEach((q, idx) => {
      md += `${idx + 1}. [${q.category || '综合'}] ${q.question || ''}\n`;
      if (q.key_points && q.key_points.length > 0) {
        md += `   考察要点：${q.key_points.join('、')}\n`;
      }
      md += '\n';
    });
  }

  if (prep.gap_analysis) {
    md += `## 六、差距分析\n`;
    if (prep.gap_analysis.strengths && prep.gap_analysis.strengths.length > 0) {
      md += `### 优势\n`;
      prep.gap_analysis.strengths.forEach((strength, idx) => {
        md += `${idx + 1}. ${strength}\n`;
      });
      md += '\n';
    }
    if (prep.gap_analysis.weaknesses && prep.gap_analysis.weaknesses.length > 0) {
      md += `### 劣势\n`;
      prep.gap_analysis.weaknesses.forEach((weakness, idx) => {
        md += `${idx + 1}. ${weakness}\n`;
      });
      md += '\n';
    }
    if (prep.gap_analysis.mitigation_strategies && prep.gap_analysis.mitigation_strategies.length > 0) {
      md += `### 应对策略\n`;
      prep.gap_analysis.mitigation_strategies.forEach((strategy, idx) => {
        md += `${idx + 1}. ${strategy}\n`;
      });
      md += '\n';
    }
  }

  if (prep.coaching_tips && prep.coaching_tips.length > 0) {
    md += `## 七、备考建议\n`;
    prep.coaching_tips.forEach((tip, idx) => {
      md += `${idx + 1}. ${tip}\n`;
    });
    md += '\n';
  }

  if (prep.ask_back_questions && prep.ask_back_questions.length > 0) {
    md += `## 八、反问问题清单\n`;
    prep.ask_back_questions.forEach((q, idx) => {
      md += `${idx + 1}. ${q}\n`;
    });
  }

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `面试准备_${prep.meta.role_name}_${prep.meta.company_name || '未知公司'}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};