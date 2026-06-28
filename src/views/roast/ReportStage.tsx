import { useState } from 'react';
import type { CognitiveDiagnosis } from '../../services/diagnosisService';
import type { AnswerRecord, DifficultyLevel } from '../../services/resumeRoastService';
import { exportDiagnosisToWord, exportDiagnosisToJSON } from '../../services/resumeRoastService';
import { RadarChart, Timeline, ScoreBox } from '../Diagnosis';
import { CYAN, MAGENTA, GREEN, YELLOW, BG } from '../../theme/colors';

interface ReportStageProps {
  diagnosis: CognitiveDiagnosis;
  answers: AnswerRecord[];
  isPrepDriven: boolean;
  prepId: string | null;
  parsedSummary: string;
  difficulty: DifficultyLevel;
  onSaveDiagnosis: () => void;
  onBackToPrep: () => void;
  onRestart: () => void;
}

const getScoreColor = (score: number) => {
  if (score >= 80) return 'score-excellent';
  if (score >= 60) return 'score-good';
  if (score >= 40) return 'score-average';
  return 'score-poor';
};
const getScoreLabel = (score: number) => {
  if (score >= 80) return '优秀';
  if (score >= 60) return '良好';
  if (score >= 40) return '一般';
  return '较差';
};

const ReportStage = ({
  diagnosis, answers, isPrepDriven, prepId, parsedSummary,
  difficulty, onSaveDiagnosis, onBackToPrep, onRestart,
}: ReportStageProps) => {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const toggleExpand = (id: string) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
  <div className="stage-card report-stage">
    <div className="report-header">
      <h2>🧠 认知诊断报告{isPrepDriven && <span style={{ color: MAGENTA, fontSize: 12, marginLeft: 8 }}>（面试准备驱动）</span>}</h2>
      <div className="report-actions">
        {isPrepDriven && prepId?.startsWith('ext-') && (
          <div style={{
            padding: '6px 12px', background: 'rgba(255,0,255,0.06)', borderRadius: 6,
            border: `1px solid ${MAGENTA}40`, fontSize: 11, color: MAGENTA, maxWidth: 320, lineHeight: 1.5,
          }}>
            💡 外部文档导入模式 — 将诊断结果带回 Claude Code，用诊断暴露的弱项重新调整 Skill 的面试准备文档，实现人工闭环。
            {parsedSummary && <div style={{ marginTop: 4, color: '#555' }}>📋 {parsedSummary}</div>}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={onSaveDiagnosis}
            style={{ padding: '10px 16px', background: 'transparent', color: GREEN, border: `1px solid ${GREEN}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,255,34,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >💾 保存诊断</button>
          <button onClick={() => exportDiagnosisToJSON(diagnosis, answers, difficulty)}
            style={{ padding: '10px 16px', background: 'transparent', color: CYAN, border: `1px solid ${CYAN}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,240,255,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >📄 导出JSON</button>
          <button onClick={() => exportDiagnosisToWord(diagnosis, answers, difficulty)}
            style={{ padding: '10px 16px', background: 'transparent', color: YELLOW, border: `1px solid ${YELLOW}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >📝 导出Word</button>
          <button onClick={onRestart}
            style={{ padding: '10px 16px', background: 'transparent', color: '#ccc', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >🔄 重新开始</button>
        </div>
      </div>
    </div>

    {/* 总分 */}
    <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center' }}>
      <ScoreBox label="总分" value={diagnosis.overall_score} max={100} color={CYAN} />
      <ScoreBox label="逻辑" value={diagnosis.logic_score} max={10} color={MAGENTA} />
      <ScoreBox label="表达" value={diagnosis.communication_score} max={10} color={YELLOW} />
      <ScoreBox label="深度" value={diagnosis.depth_score} max={10} color={GREEN} />
    </div>

    {/* 雷达 + 知识覆盖 */}
    <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'center' }}>
      <div style={{ border: '1px solid #333', padding: 12, background: BG, borderRadius: 4 }}>
        <h3 style={{ color: CYAN, fontSize: 14, marginBottom: 8, fontFamily: 'monospace' }}>📡 知识雷达</h3>
        <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11, fontFamily: 'monospace' }}>
          <span style={{ color: CYAN }}>── 覆盖度</span>
          <span style={{ color: MAGENTA }}>- - 深度</span>
        </div>
        <RadarChart data={diagnosis.radar_data} />
      </div>

      <div style={{ flex: 1, minWidth: 260 }}>
        <h3 style={{ color: CYAN, fontSize: 14, marginBottom: 8, fontFamily: 'monospace' }}>📋 知识覆盖详情</h3>
        {diagnosis.knowledge_map.map(kp => (
          <div key={kp.name} style={{ marginBottom: 10, border: '1px solid #333', padding: 8, background: BG, borderRadius: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontFamily: 'monospace' }}>
              <span style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{kp.name}</span>
              <span style={{ fontSize: 11 }}>
                <span style={{ color: CYAN }}>覆盖 {Math.round(kp.coverage * 100)}%</span>
                <span style={{ margin: '0 6px', color: '#555' }}>|</span>
                <span style={{ color: MAGENTA }}>深度 {kp.depth_score}</span>
              </span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <div style={{ flex: 1, height: 4, background: '#222' }}>
                <div style={{ width: `${kp.coverage * 100}%`, height: 4, background: CYAN }} />
              </div>
              <div style={{ flex: 1, height: 4, background: '#222' }}>
                <div style={{ width: `${(kp.depth_score / 10) * 100}%`, height: 4, background: MAGENTA }} />
              </div>
            </div>
            {kp.missing_concepts.length > 0 && (
              <div style={{ fontSize: 11, color: '#ff6666', fontFamily: 'monospace' }}>
                ⚠ 缺失：{kp.missing_concepts.join('、')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>

    {/* 时间线 */}
    <div style={{ border: '1px solid #333', padding: 12, marginBottom: 24, background: BG, borderRadius: 4 }}>
      <h3 style={{ color: CYAN, fontSize: 14, marginBottom: 8, fontFamily: 'monospace' }}>📈 得分时间线</h3>
      <div style={{ display: 'flex', gap: 16, fontSize: 11, marginBottom: 8, fontFamily: 'monospace' }}>
        <span style={{ color: CYAN }}>── 总分</span>
        <span style={{ color: MAGENTA }}>- - 逻辑</span>
        <span style={{ color: YELLOW }}>- - 表达</span>
      </div>
      <Timeline data={diagnosis.timeline_data} />
    </div>

    {/* 优劣势 + 改进 */}
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 180, border: '1px solid #333', padding: 12, background: BG, borderRadius: 4 }}>
        <h3 style={{ color: GREEN, fontSize: 14, marginBottom: 8, fontFamily: 'monospace' }}>✅ 优势</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, fontFamily: 'monospace', color: '#ccc' }}>
          {diagnosis.strengths.map((s, i) => <li key={i}>{s}</li>)}
        </ul>
      </div>
      <div style={{ flex: 1, minWidth: 180, border: '1px solid #333', padding: 12, background: BG, borderRadius: 4 }}>
        <h3 style={{ color: '#ff6666', fontSize: 14, marginBottom: 8, fontFamily: 'monospace' }}>❌ 短板</h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, fontFamily: 'monospace', color: '#ccc' }}>
          {diagnosis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      </div>
      <div style={{ flex: 1, minWidth: 180, border: '1px solid #333', padding: 12, background: BG, borderRadius: 4 }}>
        <h3 style={{ color: YELLOW, fontSize: 14, marginBottom: 8, fontFamily: 'monospace' }}>💡 改进路径</h3>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8, fontFamily: 'monospace', color: '#ccc' }}>
          {diagnosis.improvement_plan.map((s, i) => <li key={i}>{s}</li>)}
        </ol>
      </div>
    </div>

    {/* 每题详情 */}
    <div style={{ marginTop: 24, border: '1px solid #333', padding: 12, background: BG, borderRadius: 4 }}>
      <h3 style={{ color: CYAN, fontSize: 14, marginBottom: 12, fontFamily: 'monospace' }}>📝 每题详细</h3>
      {answers.map((a, i) => {
        const isExpanded = expandedQuestions.has(a.questionId);
        return (
        <div key={a.questionId} style={{ marginBottom: 16, padding: 10, border: '1px solid #222', borderRadius: 2, background: '#0d0d0d' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fff', fontSize: 13 }}>Q{i + 1}</span>
            <span className={`q-score-tag ${getScoreColor(a.evaluation.score)}`}
              style={{ fontFamily: 'monospace', fontSize: 12, padding: '2px 8px', borderRadius: 2 }}>
              {a.evaluation.score}分 {getScoreLabel(a.evaluation.score)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 6, fontFamily: 'monospace' }}>
            {isExpanded ? a.questionText : a.questionText.slice(0, 200) + (a.questionText.length > 200 ? '...' : '')}
            {a.questionText.length > 200 && (
              <button onClick={() => toggleExpand(a.questionId)} style={{ marginLeft: 6, background: 'none', border: 'none', color: CYAN, cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}>
                {isExpanded ? '收起' : '展开'}
              </button>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#ccc', marginBottom: 6, fontFamily: 'monospace' }}>
            <span style={{ color: '#888' }}>你的回答：</span>
            {isExpanded ? a.answer : a.answer.slice(0, 300) + (a.answer.length > 300 ? '...' : '')}
            {a.answer.length > 300 && (
              <button onClick={() => toggleExpand(a.questionId)} style={{ marginLeft: 6, background: 'none', border: 'none', color: CYAN, cursor: 'pointer', fontSize: 11, fontFamily: 'monospace' }}>
                {isExpanded ? '收起' : '展开'}
              </button>
            )}
          </div>
          <div style={{ fontSize: 11, color: CYAN, fontFamily: 'monospace' }}>💬 {a.evaluation.comment || (a.evaluation.score < 60 ? '回答不够完善，建议深入准备此话题' : '回答基本合格')}</div>
        </div>
        );
      })}
    </div>

    {/* 闭环优化按钮 - 底部 */}
    {isPrepDriven && !prepId?.startsWith('ext-') && (
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={onBackToPrep}
          title="将诊断暴露的薄弱项反馈到面试准备文档，更新 Gap 清单并生成新题"
          style={{
            padding: '10px 16px', background: 'transparent', color: MAGENTA, border: `1px solid ${MAGENTA}`,
            borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,0,255,0.1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          🔄 闭环优化面试准备
        </button>
      </div>
    )}
  </div>
  );
};

export default ReportStage;
