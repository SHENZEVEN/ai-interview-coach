import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  generatePrep,
  refinePrep,
  startFromPrep,
  getPrep,
  PrepDocument,
  ROLE_DIRECTIONS,
  DIFFICULTY_OPTIONS,
  GapItem,
  PredictedQuestion,
  RequirementMatch,
  MatchResponse,
} from '../services/prepService';
import { parseDocument } from '../utils/documentParser';
import { API_BASE } from '../services/aiService';
import ResumeMatcher from './ResumeMatcher';

// ── 颜色常量 ──
const CYAN = '#00f0ff';
const MAGENTA = '#ff00ff';
const GREEN = '#22ff22';
const YELLOW = '#ffff00';
const RED = '#ff4444';
const DIM = '#555';
const BG = '#0a0a0a';
const CARD = '#111';
const BORDER = '#222';

type Stage = 'input' | 'generating' | 'preview' | 'refining';

const InterviewPrep = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { prepId?: string; sessionId?: string; diagnosisCompleted?: boolean } | null;

  // ── 处理从面试拷打返回的闭环 ──
  useEffect(() => {
    if (navState?.prepId && navState?.sessionId && navState?.diagnosisCompleted) {
      // 从 ResumeRoast 返回，触发闭环更新
      setSessionId(navState.sessionId);
      // 尝试获取已有的 prep（如果还在内存中）并触发 refine
      getPrep(navState.prepId).then(p => {
        setPrep(p);
        setStage('preview');
      }).catch(() => {
        // 如果 prep 已被清除（服务器重启），静默失败
      });
      // 清除 location state
      window.history.replaceState({}, document.title);
    }
  }, []);

  // ── 输入状态 ──
  const [stage, setStage] = useState<Stage>('input');
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [prepMode, setPrepMode] = useState<'rapid' | 'standard' | 'deep'>('standard');
  const [difficulty, setDifficulty] = useState('mid');

  // ── 逐题练习状态 ──
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [practiceResult, setPracticeResult] = useState<{score: number; comment: string} | null>(null);
  const [isPracticing, setIsPracticing] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [direction, setDirection] = useState('E');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 模式切换：完整准备 / 简历匹配 ──
  const [pageMode, setPageMode] = useState<'prep' | 'match'>('prep');
  const [matchResult, setMatchResult] = useState<MatchResponse | null>(null);

  // ── 结果状态 ──
  const [prep, setPrep] = useState<PrepDocument | null>(null);
  const [expandedSection, setExpandedSection] = useState<Set<string>>(new Set(['jd', 'questions', 'gap', 'askback']));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isStartingInterview, setIsStartingInterview] = useState(false);

  // ── 文件处理 ──
  const processFile = async (file: File, target: 'resume' | 'jd') => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'txt', 'md'].includes(ext || '')) {
      setError('仅支持 PDF、DOCX、TXT、MD 和图片格式');
      return;
    }
    setError(null);
    try {
      const text = await parseDocument(file);
      if (target === 'resume') setResumeText(text);
      else setJdText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取文档失败');
    }
  };

  // ── 生成面试准备 ──
  const handleGenerate = async () => {
    if (!resumeText.trim()) {
      setError('请提供简历内容（粘贴或上传文件）');
      return;
    }
    setError(null);
    setStage('generating');
    try {
      const result = await generatePrep({
        resume_text: resumeText,
        jd_text: jdText || undefined,
        company_name: companyName,
        role_name: roleName,
        direction,
        difficulty,
        prep_mode: prepMode,
      });
      setPrep(result);
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
      setStage('input');
    }
  };

  // ── 开始面试拷打 ──
  const handleStartInterview = async () => {
    if (!prep) return;
    setIsStartingInterview(true);
    setError(null);
    try {
      const result = await startFromPrep({
        prep_id: prep.meta.prep_id,
        resume_text: resumeText,
      });
      setSessionId(result.session_id);
      // 导航到简历拷打页面，携带 prep 上下文
      navigate('/resume-roast', {
        state: {
          prepId: prep.meta.prep_id,
          sessionId: result.session_id,
          firstQuestion: result.first_question,
          prepContextUsed: result.prep_context_used,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动面试失败');
      setIsStartingInterview(false);
    }
  };

  // ── 闭环：用诊断更新面试准备 ──
  const handleRefine = async (diagSessionId: string) => {
    if (!prep) return;
    setStage('refining');
    setError(null);
    try {
      const updated = await refinePrep({
        prep_id: prep.meta.prep_id,
        session_id: diagSessionId,
      });
      setPrep(updated);
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
      setStage('preview');
    }
  };

  // ── Section toggle ──
  const toggleSection = (key: string) => {
    const next = new Set(expandedSection);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedSection(next);
  };

  // ── 渲染辅助 ──

  const MatchBadge = ({ level }: { level: string }) => {
    const map: Record<string, { bg: string; color: string; text: string }> = {
      '✅强': { bg: 'rgba(34,255,34,0.1)', color: GREEN, text: '强匹配' },
      '⚠️中': { bg: 'rgba(255,255,0,0.1)', color: YELLOW, text: '中匹配' },
      '❌弱': { bg: 'rgba(255,68,68,0.1)', color: RED, text: '弱匹配' },
      '-': { bg: 'rgba(85,85,85,0.1)', color: DIM, text: '无证据' },
    };
    const m = map[level] || map['-'];
    return <span style={{ background: m.bg, color: m.color, padding: '2px 8px', borderRadius: 4, fontSize: 11 }}>{m.text}</span>;
  };

  const SectionHeader = ({ title, sectionKey, badge }: { title: string; sectionKey: string; badge?: string }) => (
    <div
      onClick={() => toggleSection(sectionKey)}
      style={{
        padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', borderBottom: `1px solid ${BORDER}`, userSelect: 'none',
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 14 }}>
        {title} {badge && <span style={{ color: DIM, fontSize: 11 }}>({badge})</span>}
      </span>
      <span style={{ color: DIM }}>{expandedSection.has(sectionKey) ? '▾' : '▸'}</span>
    </div>
  );

  // ── 简历匹配模式 ──
  if (pageMode === 'match') {
    return (
      <div>
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 24px 0' }}>
          <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
            <button
              onClick={() => setPageMode('prep')}
              style={{
                padding: '8px 20px', background: 'transparent', color: DIM,
                border: `1px solid ${BORDER}`, borderRadius: '8px 0 0 8px',
                cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
              }}
            >
              📋 完整准备
            </button>
            <button
              style={{
                padding: '8px 20px', background: 'rgba(0,240,255,0.08)', color: CYAN,
                border: `1px solid ${CYAN}`, borderRadius: '0 8px 8px 0',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              }}
            >
              🔍 简历匹配
            </button>
          </div>
        </div>
        <ResumeMatcher
          onSwitchToPrep={(resume, jd) => {
            setResumeText(resume);
            setJdText(jd);
            setPageMode('prep');
          }}
        />
      </div>
    );
  }

  // ── 输入阶段 ──
  if (stage === 'input') {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        {/* 模式切换 */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
          <button
            style={{
              padding: '8px 20px', background: 'rgba(0,240,255,0.08)', color: CYAN,
              border: `1px solid ${CYAN}`, borderRadius: '8px 0 0 8px',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            }}
          >
            📋 完整准备
          </button>
          <button
            onClick={() => setPageMode('match')}
            style={{
              padding: '8px 20px', background: 'transparent', color: DIM,
              border: `1px solid ${BORDER}`, borderRadius: '0 8px 8px 0',
              cursor: 'pointer', fontSize: 13, fontFamily: 'inherit',
            }}
          >
            🔍 简历匹配
          </button>
        </div>

        {/* 桥接提示 */}
        {matchResult && (
          <div style={{
            background: 'rgba(0,240,255,0.05)', border: `1px solid ${CYAN}`, borderRadius: 8,
            padding: 10, marginBottom: 16, fontSize: 12, color: CYAN,
          }}>
            💡 已从简历匹配导入：匹配度 <strong>{matchResult.match_score}/100</strong>。Gap 清单已预分析，可快速生成备战文档。
          </div>
        )}

        <h1 style={{ fontSize: 22, marginBottom: 8 }}>📋 面试准备</h1>
        <p style={{ color: DIM, fontSize: 13, marginBottom: 24 }}>
          对标 interview-prep skill — 生成个性化面试准备文档，再一键启动针对性面试拷打
        </p>

        {error && <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${RED}`, padding: 12, borderRadius: 8, marginBottom: 16, color: RED, fontSize: 13 }}>{error}</div>}

        {/* 简历 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>简历 *</label>
          <textarea
            value={resumeText}
            onChange={e => setResumeText(e.target.value)}
            placeholder="粘贴简历内容，或拖拽文件到下方..."
            rows={6}
            style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, color: '#fff', padding: 12, borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'monospace' }}
          />
          <div
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={e => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f, 'resume'); }}
            style={{
              border: `1px dashed ${isDragging ? CYAN : BORDER}`, borderRadius: 8, padding: 12, textAlign: 'center',
              color: DIM, fontSize: 12, marginTop: 8, cursor: 'pointer', background: isDragging ? 'rgba(0,240,255,0.05)' : 'transparent',
            }}
            onClick={() => document.getElementById('resumeFileInput')?.click()}
          >
            📎 拖拽简历文件（PDF/DOCX/图片/TXT）或点击上传
            <input id="resumeFileInput" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt,.md" hidden onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f, 'resume'); }} />
          </div>
        </div>

        {/* JD */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>岗位 JD（可选）</label>
          <textarea
            value={jdText}
            onChange={e => setJdText(e.target.value)}
            placeholder="粘贴岗位描述..."
            rows={4}
            style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, color: '#fff', padding: 12, borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'monospace' }}
          />
        </div>

        {/* 公司 + 岗位 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>公司名称</label>
            <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="如：字节跳动" style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, color: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>岗位名称</label>
            <input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="如：AI产品经理实习" style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, color: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
        </div>

        {/* 方向 + 职级 + 准备深度 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>岗位方向</label>
            <select value={direction} onChange={e => setDirection(e.target.value)} style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, color: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
              {Object.entries(ROLE_DIRECTIONS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>目标职级</label>
            <select value={difficulty} onChange={e => setDifficulty(e.target.value)} style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, color: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
              {DIFFICULTY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
              准备深度
              <span style={{ fontSize: 10, color: DIM, marginLeft: 4 }}>
                {prepMode === 'rapid' ? '(≤2天面试)' : prepMode === 'deep' ? '(≥1周准备)' : '(3-7天)'}
              </span>
            </label>
            <select value={prepMode} onChange={e => setPrepMode(e.target.value as any)} style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, color: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: 13, boxSizing: 'border-box' }}>
              <option value="rapid">⚡ 速准版 (~3分钟)</option>
              <option value="standard">📋 标准版 (~8分钟)</option>
              <option value="deep">🔬 深研版 (~12分钟)</option>
            </select>
          </div>
        </div>

        <button onClick={handleGenerate} disabled={!resumeText.trim()} style={{
          width: '100%', padding: '14px 0', background: resumeText.trim() ? CYAN : DIM, color: resumeText.trim() ? '#000' : '#666',
          border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: resumeText.trim() ? 'pointer' : 'not-allowed',
        }}>
          🚀 生成面试准备文档
        </button>
      </div>
    );
  }

  // ── 生成中 ──
  if (stage === 'generating' || stage === 'refining') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
        <div style={{ width: 48, height: 48, border: `3px solid ${BORDER}`, borderTopColor: CYAN, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <p style={{ color: CYAN, fontSize: 14 }}>
          {stage === 'generating' ? '正在生成面试准备文档...' : '正在用诊断结果优化面试准备...'}
        </p>
        <p style={{ color: DIM, fontSize: 12 }}>
          {stage === 'generating' ? '调研公司信息 → 分析JD → 预测题目 → 识别Gap → 生成自我介绍' : '分析薄弱领域 → 更新Gap清单 → 生成针对性新题'}
        </p>
      </div>
    );
  }

  // ── 预览阶段 ──
  if (!prep) return null;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 4 }}>
            📋 {prep.meta.role_name || '面试准备'} @ {prep.meta.company_name || '目标公司'}
          </h1>
          <p style={{ color: DIM, fontSize: 12 }}>
            {ROLE_DIRECTIONS[prep.meta.direction]} · {DIFFICULTY_OPTIONS.find(o => o.value === prep.meta.difficulty)?.label}
            <span style={{ margin: '0 6px', color: BORDER }}>|</span>
            {prep.meta.prep_mode === 'rapid' ? '⚡速准' : prep.meta.prep_mode === 'deep' ? '🔬深研' : '📋标准'}模式
            <span style={{ margin: '0 6px', color: BORDER }}>|</span>
            {prep.meta.has_web_search ? (
              <span style={{ color: GREEN }}>🌐 已联网搜索 ({prep.meta.source_count}条来源)</span>
            ) : (
              <span style={{ color: DIM }}>📡 基于训练数据（速准模式跳过联网）</span>
            )}
            <span style={{ margin: '0 6px', color: BORDER }}>|</span>
            ID: {prep.meta.prep_id}
            {prep.meta.diagnosis_feedback && (
              <span style={{ color: MAGENTA, marginLeft: 8 }}>
                🔄 已闭环更新（综合评分: {prep.meta.diagnosis_feedback.overall_score}）
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleStartInterview}
          disabled={isStartingInterview}
          style={{
            padding: '12px 24px', background: CYAN, color: '#000', border: 'none',
            borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: isStartingInterview ? 'not-allowed' : 'pointer',
            opacity: isStartingInterview ? 0.5 : 1, whiteSpace: 'nowrap',
          }}
        >
          {isStartingInterview ? '⏳' : '⚡'} 开始面试拷打
        </button>
      </div>

      {/* 如果从面试拷打回来，显示闭环操作 */}
      {sessionId && (
        <div style={{ background: 'rgba(255,0,255,0.06)', border: `1px solid ${MAGENTA}40`, borderRadius: 10, padding: 14, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13, color: '#ccc' }}>
            🔄 <b>闭环就绪</b> — 面试会话 <code style={{ color: CYAN }}>{sessionId}</code> 已完成。用诊断报告反向优化面试准备？
          </span>
          <button onClick={() => handleRefine(sessionId)} style={{ padding: '8px 18px', background: MAGENTA, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            更新面试准备
          </button>
        </div>
      )}

      {error && <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${RED}`, padding: 12, borderRadius: 8, marginBottom: 16, color: RED, fontSize: 13 }}>{error}</div>}

      {/* ── 一、公司调研 ── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
        <SectionHeader title="一、公司与产品调研" sectionKey="research" />
        {expandedSection.has('research') && (
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: '#ccc' }}>{prep.company_research.overview}</p>
            {prep.company_research.product_features && <p style={{ fontSize: 12, color: DIM, marginTop: 8 }}>🏷 产品特征：{prep.company_research.product_features}</p>}
            {prep.company_research.competitors && <p style={{ fontSize: 12, color: DIM }}>⚔️ 竞品：{prep.company_research.competitors}</p>}
            {prep.company_research.ai_strategy && <p style={{ fontSize: 12, color: CYAN }}>🤖 AI战略：{prep.company_research.ai_strategy}</p>}
            {prep.company_research.recent_news && <p style={{ fontSize: 12, color: DIM }}>📰 近期：{prep.company_research.recent_news}</p>}
          </div>
        )}
      </div>

      {/* ── 二、JD 深度解读 ── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
        <SectionHeader title="二、JD 深度解读 + 逐条匹配" sectionKey="jd" />
        {expandedSection.has('jd') && (
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 13, color: CYAN, marginBottom: 12, lineHeight: 1.6 }}>
              💡 核心意图：{prep.jd_analysis.core_intent}
            </p>
            {prep.jd_analysis.plain_language.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                {prep.jd_analysis.plain_language.map((pl, i) => (
                  <div key={i} style={{ marginBottom: 6, fontSize: 12 }}>
                    <span style={{ color: DIM }}>JD：</span><span style={{ color: '#aaa' }}>{pl.original}</span>
                    <br />
                    <span style={{ color: GREEN }}>→ </span><span style={{ color: '#ccc' }}>{pl.plain}</span>
                  </div>
                ))}
              </div>
            )}
            {/* 匹配表 */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: DIM, fontWeight: 600 }}>JD 要求</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: DIM, fontWeight: 600 }}>简历依据</th>
                  <th style={{ textAlign: 'center', padding: '6px 8px', color: DIM, fontWeight: 600, width: 70 }}>匹配度</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', color: DIM, fontWeight: 600 }}>面试策略</th>
                </tr>
              </thead>
              <tbody>
                {prep.jd_analysis.requirement_matching.map((m: RequirementMatch, i: number) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${BORDER}` }}>
                    <td style={{ padding: '8px', color: '#ccc', verticalAlign: 'top' }}>{m.requirement}</td>
                    <td style={{ padding: '8px', color: m.resume_evidence.includes('未见') ? RED : '#aaa', verticalAlign: 'top', fontSize: 11 }}>{m.resume_evidence}</td>
                    <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}><MatchBadge level={m.match_level} /></td>
                    <td style={{ padding: '8px', color: '#aaa', verticalAlign: 'top', fontSize: 11 }}>{m.strategy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 三、定制版自我介绍 ── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
        <SectionHeader title="三、定制版自我介绍" sectionKey="intro" badge={`${prep.self_intro.length}字`} />
        {expandedSection.has('intro') && (
          <div style={{ padding: 16 }}>
            <div style={{ background: 'rgba(0,240,255,0.04)', border: `1px solid ${CYAN}30`, borderRadius: 8, padding: 14, fontSize: 14, lineHeight: 1.8, color: '#ddd', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
              {prep.self_intro}
            </div>
          </div>
        )}
      </div>

      {/* ── 四、项目深挖问答 ── */}
      {prep.star_stories.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader title="四、项目深挖问答（STAR）" sectionKey="star" badge={`${prep.star_stories.length}个项目`} />
          {expandedSection.has('star') && (
            <div style={{ padding: 16 }}>
              {prep.star_stories.map((s, i) => (
                <div key={i} style={{ marginBottom: 16, padding: 12, background: BG, borderRadius: 8 }}>
                  <div style={{ fontWeight: 700, color: YELLOW, marginBottom: 8, fontSize: 14 }}>📌 {s.project_name}</div>
                  <div style={{ display: 'grid', gap: 4, fontSize: 12 }}>
                    <div><span style={{ color: CYAN }}>S (背景)：</span><span style={{ color: '#ccc' }}>{s.situation}</span></div>
                    <div><span style={{ color: CYAN }}>T (任务)：</span><span style={{ color: '#ccc' }}>{s.task}</span></div>
                    <div><span style={{ color: CYAN }}>A (行动)：</span><span style={{ color: '#ccc' }}>{s.action}</span></div>
                    <div><span style={{ color: CYAN }}>R (结果)：</span><span style={{ color: '#ccc' }}>{s.result}</span></div>
                  </div>
                  {s.follow_up_questions.length > 0 && (
                    <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(255,255,0,0.05)', borderRadius: 6, fontSize: 11 }}>
                      <span style={{ color: YELLOW }}>⚠️ 可能的追问：</span>
                      {s.follow_up_questions.map((q, qi) => (
                        <div key={qi} style={{ color: DIM, marginTop: 2 }}>• {q}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 五、高频题预测 + 逐题练习 ── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
        <SectionHeader title="五、高频题预测" sectionKey="questions" badge={`${prep.predicted_questions.length}题`} />
        {expandedSection.has('questions') && (
          <div style={{ padding: 16 }}>
            {/* 练习模式切换 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: DIM }}>
                💡 逐题练习：在面试准备中直接练习预测题，即时 AI 评分
              </span>
              {!practiceMode ? (
                <button onClick={() => { setPracticeMode(true); setPracticeIndex(0); setPracticeAnswer(''); setPracticeResult(null); }} style={{
                  padding: '6px 14px', background: 'transparent', border: `1px solid ${GREEN}`, color: GREEN, borderRadius: 6, fontSize: 11, cursor: 'pointer',
                }}>
                  🎯 开始逐题练习
                </button>
              ) : (
                <button onClick={() => { setPracticeMode(false); setPracticeResult(null); }} style={{
                  padding: '6px 14px', background: 'transparent', border: `1px solid ${DIM}`, color: DIM, borderRadius: 6, fontSize: 11, cursor: 'pointer',
                }}>
                  退出练习
                </button>
              )}
            </div>

            {/* 练习区域 */}
            {practiceMode && prep.predicted_questions[practiceIndex] && (
              <div style={{ padding: 12, background: 'rgba(34,255,34,0.04)', border: `1px solid ${GREEN}30`, borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: GREEN, marginBottom: 8 }}>
                  🎯 练习第 {practiceIndex + 1}/{Math.min(prep.predicted_questions.length, 5)} 题
                  <span style={{ color: DIM, marginLeft: 8 }}>{prep.predicted_questions[practiceIndex].category}</span>
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, color: '#ddd', marginBottom: 8 }}>
                  {prep.predicted_questions[practiceIndex].question}
                </div>
                <textarea
                  value={practiceAnswer}
                  onChange={e => setPracticeAnswer(e.target.value)}
                  placeholder="输入你的回答..."
                  rows={4}
                  style={{ width: '100%', background: BG, border: `1px solid ${BORDER}`, color: '#fff', padding: 10, borderRadius: 6, fontSize: 12, resize: 'vertical', fontFamily: 'monospace', boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    onClick={async () => {
                      if (!practiceAnswer.trim()) return;
                      setIsPracticing(true);
                      try {
                        const resp = await fetch(`${API_BASE}/evaluate-answer`, {
                          method: 'POST', headers: {'Content-Type': 'application/json'},
                          body: JSON.stringify({
                            question: prep.predicted_questions[practiceIndex].question,
                            user_answer: practiceAnswer,
                            reference_answer: prep.predicted_questions[practiceIndex].key_points.join('；'),
                          }),
                        });
                        const data = await resp.json();
                        setPracticeResult({score: data.score, comment: data.comment});
                      } catch { setPracticeResult({score: 0, comment: '评估失败，请重试'}); }
                      setIsPracticing(false);
                    }}
                    disabled={isPracticing || !practiceAnswer.trim()}
                    style={{ padding: '6px 16px', background: GREEN, color: '#000', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: practiceAnswer.trim() ? 'pointer' : 'not-allowed', opacity: practiceAnswer.trim() ? 1 : 0.5 }}
                  >
                    {isPracticing ? '评估中...' : '提交评估'}
                  </button>
                  {practiceIndex < Math.min(prep.predicted_questions.length, 5) - 1 && (
                    <button onClick={() => { setPracticeIndex(i => i + 1); setPracticeAnswer(''); setPracticeResult(null); }} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${BORDER}`, color: '#ccc', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                      下一题 →
                    </button>
                  )}
                </div>
                {/* 评分结果 */}
                {practiceResult && (
                  <div style={{ marginTop: 10, padding: 10, background: BG, borderRadius: 6, borderLeft: `3px solid ${practiceResult.score >= 6 ? GREEN : YELLOW}` }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: practiceResult.score >= 6 ? GREEN : YELLOW }}>
                      评分：{practiceResult.score}/10
                    </span>
                    <span style={{ fontSize: 12, color: '#ccc', marginLeft: 12 }}>{practiceResult.comment}</span>
                  </div>
                )}
              </div>
            )}

            {/* 题目列表 */}
            {prep.predicted_questions.map((q: PredictedQuestion, i: number) => (
              <div key={i} style={{
                marginBottom: 10, padding: '10px 12px', background: BG, borderRadius: 8,
                borderLeft: `3px solid ${q.source === '面经预测' ? MAGENTA : q.source === 'JD推导' ? YELLOW : CYAN}`,
                opacity: practiceMode && i !== practiceIndex ? 0.4 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: '#ddd' }}>Q{i + 1}. {q.question}</span>
                  <span style={{ fontSize: 10, color: DIM, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }}>
                    {q.category} · {q.source}
                  </span>
                </div>
                {q.key_points.length > 0 && (
                  <div style={{ fontSize: 11, color: DIM }}>
                    考察：{q.key_points.join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 六、设计思考（如有） ── */}
      {prep.coaching_tips && prep.coaching_tips.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader title="六、针对性指导建议" sectionKey="coaching" />
          {expandedSection.has('coaching') && (
            <div style={{ padding: 16 }}>
              {prep.coaching_tips.map((tip, i) => (
                <div key={i} style={{ fontSize: 13, color: '#ccc', marginBottom: 6, padding: '8px 12px', background: BG, borderRadius: 6 }}>
                  💡 {tip}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 七、反问清单 ── */}
      {prep.ask_back_questions && prep.ask_back_questions.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader title="七、反问清单（向面试官提问）" sectionKey="askback" />
          {expandedSection.has('askback') && (
            <div style={{ padding: 16 }}>
              {prep.ask_back_questions.map((q, i) => (
                <div key={i} style={{ fontSize: 13, color: '#ccc', marginBottom: 8, padding: '10px 14px', background: BG, borderRadius: 6, borderLeft: `3px solid ${MAGENTA}` }}>
                  <span style={{ color: MAGENTA, fontWeight: 700, marginRight: 8 }}>Q{i + 1}.</span>
                  {q}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 附、Gap 清单 ── */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
        <SectionHeader title="附、Gap 清单（差距分析）" sectionKey="gap" />
        {expandedSection.has('gap') && (
          <div style={{ padding: 16 }}>
            {/* P1 */}
            {prep.gap_analysis.priority_1_must_fix.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: RED, marginBottom: 8 }}>🔴 优先级 1 — 必须补</div>
                {prep.gap_analysis.priority_1_must_fix.map((g: GapItem, i) => (
                  <div key={i} style={{ padding: '10px 12px', background: 'rgba(255,68,68,0.06)', borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
                    <div style={{ color: RED, fontWeight: 600, marginBottom: 4 }}>❌ {g.gap}</div>
                    <div style={{ color: '#ccc' }}>→ {g.action} {g.time_estimate && <span style={{ color: DIM }}>(预计: {g.time_estimate})</span>}</div>
                  </div>
                ))}
              </div>
            )}
            {/* P2 */}
            {prep.gap_analysis.priority_2_should_fix.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: YELLOW, marginBottom: 8 }}>🟡 优先级 2 — 争取补</div>
                {prep.gap_analysis.priority_2_should_fix.map((g: GapItem, i) => (
                  <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,255,0,0.04)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                    <span style={{ color: '#ccc' }}>⚠️ {g.gap} → {g.action}</span>
                  </div>
                ))}
              </div>
            )}
            {/* P3 */}
            {prep.gap_analysis.priority_3_nice_to_have.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: DIM, marginBottom: 8 }}>⚪ 优先级 3 — 了解即可</div>
                {prep.gap_analysis.priority_3_nice_to_have.map((g: GapItem, i) => (
                  <div key={i} style={{ padding: '6px 12px', fontSize: 11, color: DIM }}>
                    · {g.gap} → {g.action}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 底部操作 */}
      <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
        <button onClick={() => { setStage('input'); setPrep(null); }} style={{ padding: '10px 20px', background: 'transparent', border: `1px solid ${BORDER}`, color: DIM, borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
          ← 重新生成
        </button>
        <button onClick={handleStartInterview} disabled={isStartingInterview} style={{
          flex: 1, padding: '12px 0', background: CYAN, color: '#000', border: 'none',
          borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: isStartingInterview ? 'not-allowed' : 'pointer',
        }}>
          ⚡ 开始面试拷打（面试准备驱动）
        </button>
      </div>
    </div>
  );
};

export default InterviewPrep;
