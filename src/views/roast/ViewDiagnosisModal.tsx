import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { CognitiveDiagnosis } from '../../services/diagnosisService';
import type { SavedDiagnosis } from '../../services/diagnosisStorage';
import { exportDiagnosisToWord, exportDiagnosisToJSON } from '../../services/resumeRoastService';
import { ScoreBox } from '../Diagnosis';
import { CYAN, MAGENTA, GREEN, YELLOW, RED, DIM } from '../../theme/colors';

interface ViewDiagnosisModalProps {
  diagnosis: SavedDiagnosis;
  onClose: () => void;
}

const ViewDiagnosisModal = ({ diagnosis: d, onClose }: ViewDiagnosisModalProps) => {
  const navigate = useNavigate();
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const toggleExpand = (idx: number) => {
    setExpandedQuestions(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.8)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0a0e14', border: `1px solid ${CYAN}`,
          borderRadius: 12, padding: 0, maxWidth: 700, width: '95%',
          maxHeight: '85vh', display: 'flex', flexDirection: 'column',
          boxShadow: `0 0 30px ${CYAN}40`,
        }}
      >
        {/* 头部 */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #222',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, color: CYAN, fontSize: 16 }}>🧠 认知诊断报告</h3>
            <div style={{ fontSize: 12, color: DIM, marginTop: 2 }}>
              {d.isPrepDriven ? '🎯 准备驱动' : '🤖 Agent模式'} · {d.questionCount}题 · 保存于 {new Date(d.savedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => exportDiagnosisToJSON(d.diagnosis, d.answers, d.difficulty)} style={{
              padding: '4px 10px', background: 'transparent', border: `1px solid ${CYAN}`,
              color: CYAN, borderRadius: 6, fontSize: 10, cursor: 'pointer',
            }}>📄 JSON</button>
            <button onClick={() => exportDiagnosisToWord(d.diagnosis, d.answers, d.difficulty)} style={{
              padding: '4px 10px', background: 'transparent', border: `1px solid ${GREEN}`,
              color: GREEN, borderRadius: 6, fontSize: 10, cursor: 'pointer',
            }}>📝 Word</button>
            <button onClick={onClose} style={{
              padding: '4px 12px', background: 'transparent', border: `1px solid ${DIM}`,
              color: DIM, borderRadius: 6, fontSize: 11, cursor: 'pointer',
            }}>✕ 关闭</button>
          </div>
        </div>

        {/* 内容 */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {/* 总分 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <ScoreBox label="总分" value={d.diagnosis.overall_score} max={100} color={CYAN} />
            <ScoreBox label="逻辑" value={d.diagnosis.logic_score} max={10} color={MAGENTA} />
            <ScoreBox label="表达" value={d.diagnosis.communication_score} max={10} color={YELLOW} />
            <ScoreBox label="深度" value={d.diagnosis.depth_score} max={10} color={GREEN} />
          </div>

          {/* 优势 / 短板 */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div style={{ flex: 1, minWidth: 180, border: `1px solid ${GREEN}40`, padding: 12, background: 'rgba(34,255,34,0.03)', borderRadius: 8 }}>
              <h4 style={{ color: GREEN, fontSize: 13, margin: '0 0 8px' }}>✅ 优势</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#ccc', lineHeight: 1.7 }}>
                {d.diagnosis.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div style={{ flex: 1, minWidth: 180, border: `1px solid ${RED}40`, padding: 12, background: 'rgba(255,68,68,0.03)', borderRadius: 8 }}>
              <h4 style={{ color: RED, fontSize: 13, margin: '0 0 8px' }}>❌ 短板</h4>
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#ccc', lineHeight: 1.7 }}>
                {d.diagnosis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          </div>

          {/* 改进路径 */}
          <div style={{ border: `1px solid ${YELLOW}40`, padding: 12, background: 'rgba(255,255,0,0.03)', borderRadius: 8, marginBottom: 16 }}>
            <h4 style={{ color: YELLOW, fontSize: 13, margin: '0 0 8px' }}>💡 改进路径</h4>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#ccc', lineHeight: 1.8 }}>
              {d.diagnosis.improvement_plan.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </div>

          {/* 知识覆盖 */}
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: CYAN, fontSize: 13, margin: '0 0 8px' }}>📋 知识覆盖</h4>
            {d.diagnosis.knowledge_map.map(kp => (
              <div key={kp.name} style={{ marginBottom: 8, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: '#fff' }}>{kp.name}</span>
                  <span style={{ color: DIM }}>
                    覆盖 {Math.round(kp.coverage * 100)}% · 深度 {kp.depth_score}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div style={{ flex: 1, height: 4, background: '#222' }}>
                    <div style={{ width: `${kp.coverage * 100}%`, height: 4, background: CYAN }} />
                  </div>
                  <div style={{ flex: 1, height: 4, background: '#222' }}>
                    <div style={{ width: `${(kp.depth_score / 10) * 100}%`, height: 4, background: MAGENTA }} />
                  </div>
                </div>
                {kp.missing_concepts.length > 0 && (
                  <div style={{ fontSize: 11, color: '#ff6666', marginTop: 2 }}>
                    ⚠ {kp.missing_concepts.join('、')}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 每题详情 */}
          <div>
            <h4 style={{ color: CYAN, fontSize: 13, margin: '0 0 8px' }}>📝 每题详情</h4>
            {d.answers.map((a, i) => {
              const isExpanded = expandedQuestions.has(i);
              return (
              <div key={i} style={{ marginBottom: 10, padding: 8, border: '1px solid #222', borderRadius: 4, background: '#0d0d0d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Q{i + 1} · {a.evaluation.score}分</span>
                  <span style={{ fontSize: 10, color: DIM }}>
                    {isExpanded ? a.questionText : a.questionText.slice(0, 60) + (a.questionText.length > 60 ? '...' : '')}
                    {a.questionText.length > 60 && (
                      <button onClick={() => toggleExpand(i)} style={{ marginLeft: 4, background: 'none', border: 'none', color: CYAN, cursor: 'pointer', fontSize: 10 }}>
                        {isExpanded ? '收起' : '展开'}
                      </button>
                    )}
                  </span>
                </div>
                {isExpanded && (
                  <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>
                    <span style={{ color: '#888' }}>你的回答：</span>{a.answer}
                  </div>
                )}
                <div style={{ fontSize: 11, color: CYAN }}>💬 {a.evaluation.comment}</div>
              </div>
              );
            })}
          </div>

          {/* 闭环操作 */}
          {d.isPrepDriven && (
            <div style={{
              marginTop: 16, padding: 14, background: 'rgba(255,0,255,0.06)',
              border: `2px solid ${MAGENTA}60`, borderRadius: 10, fontSize: 12, color: '#ccc',
              lineHeight: 1.6,
            }}>
              <div style={{ color: MAGENTA, fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
                🔄 闭环优化
              </div>
              <p style={{ margin: '0 0 12px', color: '#ccc' }}>
                将诊断暴露的薄弱项反馈到面试准备文档：更新 Gap 清单、生成针对性新题、优化自我介绍。
              </p>
              <button
                onClick={() => {
                  onClose();
                  navigate('/prep', {
                    state: {
                      prepId: d.prepId,
                      sessionId: d.sessionId,
                      diagnosisCompleted: true,
                      diagnosisData: d.diagnosis,
                    },
                  });
                }}
                style={{
                  width: '100%', padding: '10px 0', background: MAGENTA, color: '#fff',
                  border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                🔄 闭环优化面试准备
              </button>
              {!d.prepId && (
                <p style={{ color: DIM, fontSize: 10, margin: '8px 0 0' }}>
                  ⚠ 此诊断缺少关联的 prepId，无法定位面试准备文档。
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewDiagnosisModal;
