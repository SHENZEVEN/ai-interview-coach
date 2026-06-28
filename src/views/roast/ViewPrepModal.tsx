import type { SavedPrep } from '../../services/prepStorage';
import { CYAN, GREEN, DIM, BORDER } from '../../theme/colors';

interface ViewPrepModalProps {
  prep: SavedPrep;
  isLoading: boolean;
  onClose: () => void;
  onUsePrep: (prep: SavedPrep) => void;
}

const ViewPrepModal = ({ prep, isLoading, onClose, onUsePrep }: ViewPrepModalProps) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        background: '#0a0e14', border: `1px solid ${CYAN}`,
        borderRadius: 12, padding: 0, maxWidth: 720, width: '95%',
        maxHeight: '85vh', display: 'flex', flexDirection: 'column',
        boxShadow: `0 0 30px ${CYAN}40`,
      }}
    >
      {/* 头部 */}
      <div style={{
        padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <h3 style={{ margin: 0, color: CYAN, fontSize: 16 }}>
            👁 面试准备文档预览
          </h3>
          <div style={{ fontSize: 12, color: DIM, marginTop: 4 }}>
            {prep.meta.role_name} @ {prep.meta.company_name || '未知公司'}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: '4px 12px', background: 'transparent',
            border: `1px solid ${DIM}`, color: DIM,
            borderRadius: 6, fontSize: 11, cursor: 'pointer',
          }}
        >
          ✕ 关闭
        </button>
      </div>

      {/* 内容滚动区 */}
      <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
        {/* 基本信息 */}
        <div style={{
          background: 'rgba(0,240,255,0.05)', border: `1px solid ${CYAN}30`,
          borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#ddd',
        }}>
          <div><strong style={{ color: CYAN }}>岗位：</strong>{prep.meta.role_name}</div>
          <div><strong style={{ color: CYAN }}>公司：</strong>{prep.meta.company_name || '未指定'}</div>
          <div><strong style={{ color: CYAN }}>方向：</strong>{prep.meta.direction === 'E' ? 'AI产品' : 'AI全栈开发'}</div>
          <div><strong style={{ color: CYAN }}>难度：</strong>{prep.meta.difficulty}</div>
          <div><strong style={{ color: CYAN }}>生成时间：</strong>{prep.meta.generated_at}</div>
        </div>

        {/* 公司调研 */}
        {prep.company_research && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>一、公司调研</h4>
            <div style={{ fontSize: 12, color: '#ddd', lineHeight: 1.7, marginBottom: 8 }}>
              <strong>公司概况：</strong>{prep.company_research.company_overview || '暂无'}
            </div>
            {prep.company_research.key_focus_areas && prep.company_research.key_focus_areas.length > 0 && (
              <div style={{ fontSize: 12, color: '#ddd', marginBottom: 8 }}>
                <strong>重点关注：</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {prep.company_research.key_focus_areas.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* JD 分析 */}
        {prep.jd_analysis && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>二、JD 分析</h4>
            {prep.jd_analysis.core_requirements && prep.jd_analysis.core_requirements.length > 0 && (
              <div style={{ fontSize: 12, color: '#ddd', marginBottom: 8 }}>
                <strong>核心要求：</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {prep.jd_analysis.core_requirements.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 自我介绍 */}
        {prep.self_intro && prep.self_intro.script && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>三、自我介绍（{prep.self_intro.duration_seconds || 90}秒）</h4>
            <div style={{
              background: 'rgba(0,240,255,0.04)', border: `1px solid ${CYAN}30`,
              borderRadius: 6, padding: 10, fontSize: 12, color: '#ddd',
              lineHeight: 1.7, whiteSpace: 'pre-wrap', fontStyle: 'italic',
            }}>
              {prep.self_intro.script}
            </div>
          </div>
        )}

        {/* 高频题 */}
        {prep.predicted_questions && prep.predicted_questions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>四、高频题预测（{prep.predicted_questions.length}题）</h4>
            <ol style={{ fontSize: 12, color: '#ddd', lineHeight: 1.7, paddingLeft: 20 }}>
              {prep.predicted_questions.slice(0, 10).map((q, i) => (
                <li key={i} style={{ marginBottom: 4 }}>
                  {q.question}
                  {q.category && <span style={{ color: DIM, marginLeft: 6 }}>[{q.category}]</span>}
                </li>
              ))}
              {prep.predicted_questions.length > 10 && (
                <li style={{ color: DIM, fontStyle: 'italic' }}>
                  ...还有 {prep.predicted_questions.length - 10} 题
                </li>
              )}
            </ol>
          </div>
        )}

        {/* Gap 分析 */}
        {prep.gap_analysis && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>五、差距分析</h4>
            {prep.gap_analysis.weaknesses && prep.gap_analysis.weaknesses.length > 0 && (
              <div style={{ fontSize: 12, color: '#ddd', marginBottom: 8 }}>
                <strong style={{ color: '#ff8888' }}>薄弱点：</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {prep.gap_analysis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
            {prep.gap_analysis.mitigation_strategies && prep.gap_analysis.mitigation_strategies.length > 0 && (
              <div style={{ fontSize: 12, color: '#ddd' }}>
                <strong style={{ color: GREEN }}>应对策略：</strong>
                <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                  {prep.gap_analysis.mitigation_strategies.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 反问清单 */}
        {prep.ask_back_questions && prep.ask_back_questions.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>六、反问问题清单</h4>
            <ol style={{ fontSize: 12, color: '#ddd', lineHeight: 1.7, paddingLeft: 20 }}>
              {prep.ask_back_questions.map((q, i) => <li key={i} style={{ marginBottom: 4 }}>{q}</li>)}
            </ol>
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div style={{
        padding: '12px 20px', borderTop: `1px solid ${BORDER}`,
        display: 'flex', gap: 8, justifyContent: 'flex-end',
      }}>
        <button
          onClick={() => { onClose(); onUsePrep(prep); }}
          disabled={isLoading}
          style={{
            padding: '8px 16px', background: GREEN, border: 'none',
            color: '#000', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          🚀 使用此文档
        </button>
      </div>
    </div>
  </div>
);

export default ViewPrepModal;
