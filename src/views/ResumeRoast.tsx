import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { parseDocument } from '../utils/documentParser';
import { startAgentInterview, submitAgentAnswer, fetchDiagnosis, SessionNotFoundError } from '../services/diagnosisService';
import type { PrepDocument, StartFromExternalDocResult } from '../services/prepService';
import { startFromExternalDoc } from '../services/prepService';
import type { AgentQuestion, CognitiveDiagnosis, AgentEvaluation } from '../services/diagnosisService';
import {
  exportDiagnosisToWord,
  exportDiagnosisToJSON,
  DIFFICULTY_CONFIG,
  AnswerRecord,
  DifficultyLevel,
} from '../services/resumeRoastService';
import { RadarChart, Timeline, ScoreBox } from './Diagnosis';
import QuickPractice from './QuickPractice';
import '../styles/ResumeRoast.css';

type RoastMode = 'light' | 'agent' | 'prep';

// ── 常量 ──
const MAX_QUESTIONS = 15;
const CYAN = '#00f0ff';
const MAGENTA = '#ff00ff';
const GREEN = '#22ff22';
const YELLOW = '#ffff00';
const DIM = '#555';
const BG = '#0a0a0a';
const CARD = '#111';
const BORDER = '#222';

type Stage = 'upload' | 'analyzing' | 'interviewing' | 'reporting';

const ResumeRoast = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prepState = location.state as {
    prepId?: string;
    sessionId?: string;
    firstQuestion?: AgentQuestion;
    prepContextUsed?: string[];
  } | null;

  // ── 状态 ──
  const [stage, setStage] = useState<Stage>('upload');
  const [resumeText, setResumeText] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('mid');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<AgentQuestion | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [diagnosis, setDiagnosis] = useState<CognitiveDiagnosis | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [prepId, setPrepId] = useState<string | null>(null);
  const [isPrepDriven, setIsPrepDriven] = useState(false);
  const [roastMode, setRoastMode] = useState<RoastMode>('agent');

  // ── 外部文档导入状态 ──
  const [externalDocText, setExternalDocText] = useState('');
  const [externalDocFileName, setExternalDocFileName] = useState('');
  const [isImportingDoc, setIsImportingDoc] = useState(false);
  const [prepImportStage, setPrepImportStage] = useState<'select' | 'external'>('select');
  const [parsedSummary, setParsedSummary] = useState('');

  // 加载与错误
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ── 处理 Prep 上下文 ──
  useEffect(() => {
    if (prepState?.sessionId && prepState?.firstQuestion) {
      setSessionId(prepState.sessionId);
      setCurrentQuestion(prepState.firstQuestion);
      setPrepId(prepState.prepId || null);
      setIsPrepDriven(true);
      setRoastMode('prep');
      setQuestionCount(1);
      setStage('interviewing');
      // 清除 location state 避免重复触发
      window.history.replaceState({}, document.title);
    }
  }, []);

  // ── 文件处理 ──
  const processFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext || '')) {
      setError('错误：仅支持 PDF、DOCX 和图片格式');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const text = await parseDocument(file);
      setResumeText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取文档失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX <= rect.left || clientX >= rect.right || clientY <= rect.top || clientY >= rect.bottom) {
      setIsDragging(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  // ── 延迟 ──
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // ── 开始 Agent 面试 ──
  const handleStartInterview = async () => {
    if (!resumeText.trim()) { setError('请先上传简历或粘贴简历内容'); return; }
    setIsLoading(true); setError(null); setStage('analyzing');

    try {
      const result = await startAgentInterview(resumeText, difficulty);
      setSessionId(result.session_id);
      setCurrentQuestion(result.first_question);
      setQuestionCount(1);
      setAnswers([]);
      setCurrentAnswer('');
      setDiagnosis(null);
      await delay(400);
      setStage('interviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent 启动失败，请重试');
      setStage('upload');
    } finally {
      setIsLoading(false);
    }
  };

  // ── 提交回答 ──
  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim() || !sessionId || !currentQuestion) {
      setError('请输入你的回答'); return;
    }
    setIsLoading(true); setError(null);

    try {
      const result = await submitAgentAnswer(sessionId, currentQuestion.id, currentAnswer);

      // 记录回答
      const record: AnswerRecord = {
        questionId: currentQuestion.id,
        questionText: currentQuestion.text,
        answer: currentAnswer,
        evaluation: result.evaluation,
      };
      const updatedAnswers = [...answers, record];
      setAnswers(updatedAnswers);

      if (result.is_finished && result.cumulative_diagnosis) {
        // Agent 结束面试
        setDiagnosis(result.cumulative_diagnosis);
        setStage('reporting');
      } else if (result.next_question) {
        // 继续下一题
        setCurrentQuestion(result.next_question);
        setCurrentAnswer('');
        setQuestionCount(prev => prev + 1);

        // 安全上限
        if (questionCount >= MAX_QUESTIONS) {
          try {
            const diag = await fetchDiagnosis(sessionId);
            setDiagnosis(diag);
            setStage('reporting');
          } catch {
            setError('面试轮次已达上限，但无法获取诊断报告。请重新开始。');
          }
        }
      } else {
        // is_finished 但没 diagnosis — 手动获取
        try {
          const diag = await fetchDiagnosis(sessionId);
          setDiagnosis(diag);
          setStage('reporting');
        } catch {
          setError('面试已结束，但无法获取诊断报告。请重新开始。');
        }
      }
    } catch (err) {
      if (err instanceof SessionNotFoundError) {
        setError(err.message);
        setStage('upload');
      } else {
        setError(err instanceof Error ? err.message : '提交失败，请重试');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── 重新开始 ──
  const handleRestart = () => {
    setStage('upload');
    setSessionId(null);
    setCurrentQuestion(null);
    setCurrentAnswer('');
    setAnswers([]);
    setDiagnosis(null);
    setQuestionCount(0);
    setError(null);
    setIsPrepDriven(false);
    setPrepId(null);
    setPrepImportStage('select');
    setExternalDocText('');
    setExternalDocFileName('');
    setParsedSummary('');
  };

  // ── 返回面试准备（闭环）──
  const handleBackToPrep = () => {
    navigate('/prep', {
      state: {
        prepId,
        sessionId,
        diagnosisCompleted: true,
      },
    });
  };

  // ── 外部文档导入 ──
  const handleExternalDocFile = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'md' && ext !== 'markdown' && ext !== 'txt') {
      setError('仅支持 .md / .markdown / .txt 格式的面试准备文档');
      return;
    }
    setError(null);
    setExternalDocFileName(file.name);
    try {
      const text = await file.text();
      setExternalDocText(text);
    } catch {
      setError('读取文档失败');
    }
  };

  const handleStartFromExternalDoc = async () => {
    if (!resumeText.trim()) { setError('请先提供简历内容'); return; }
    if (!externalDocText.trim()) { setError('请先导入面试准备文档（.md）'); return; }
    setIsImportingDoc(true);
    setError(null);
    setStage('analyzing');
    try {
      const result: StartFromExternalDocResult = await startFromExternalDoc({
        resume_text: resumeText,
        external_doc_text: externalDocText,
        difficulty,
        direction: 'E', // 默认 AI 产品/AI 开发方向
      });
      setSessionId(result.session_id);
      setCurrentQuestion(result.first_question);
      setPrepId(`ext-${result.session_id}`); // 标记为外部文档导入
      setIsPrepDriven(true);
      setQuestionCount(1);
      setAnswers([]);
      setCurrentAnswer('');
      setDiagnosis(null);
      setParsedSummary(result.parsed_summary);
      await delay(400);
      setStage('interviewing');
    } catch (err) {
      setError(err instanceof Error ? err.message : '外部文档导入失败');
      setStage('upload');
    } finally {
      setIsImportingDoc(false);
    }
  };

  // ── 辅助 ──
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

  // ══════════════════════════════════════
  // 渲染
  // ══════════════════════════════════════

  // ── 轻量刷题模式 → 直接渲染 QuickPractice ──
  if (roastMode === 'light') {
    return (
      <div className="resume-roast-container">
        <div className="roast-header" style={{ flexDirection: 'column', gap: 8 }}>
          <h1 className="roast-title">🔥 面试拷打</h1>
          <div style={{ display: 'flex', gap: 4 }}>
            {([
              { key: 'light', label: '⚡ 轻量刷题', hint: '按类别随机10题，即时评分' },
              { key: 'agent', label: '🧠 Agent面试', hint: '简历驱动，自适应出题，认知诊断' },
              { key: 'prep', label: '🎯 准备驱动', hint: '从面试准备文档启动' },
            ] as const).map(m => (
              <button key={m.key} onClick={() => setRoastMode(m.key)}
                title={m.hint}
                style={{
                  padding: '6px 16px', border: 'none', borderBottom: `2px solid ${roastMode === m.key ? CYAN : 'transparent'}`,
                  background: 'transparent', color: roastMode === m.key ? CYAN : DIM, fontSize: 12,
                  fontWeight: roastMode === m.key ? 700 : 400, cursor: 'pointer',
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <QuickPractice />
      </div>
    );
  }

  return (
    <div className="resume-roast-container">
      <div className="roast-header" style={{ flexDirection: 'column', gap: 8 }}>
        <h1 className="roast-title">
          🔥 面试拷打{isPrepDriven ? ' · 准备驱动' : roastMode === 'agent' ? ' · Agent模式' : ''}
        </h1>
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { key: 'light', label: '⚡ 轻量刷题', hint: '按类别随机10题，即时评分' },
            { key: 'agent', label: '🧠 Agent面试', hint: '简历驱动，自适应出题，认知诊断' },
            { key: 'prep', label: '🎯 准备驱动', hint: '从面试准备文档启动' },
          ] as const).map(m => (
            <button key={m.key} onClick={() => { setRoastMode(m.key); if (m.key !== 'agent') handleRestart(); }}
              title={m.hint}
              style={{
                padding: '6px 16px', border: 'none', borderBottom: `2px solid ${roastMode === m.key ? CYAN : 'transparent'}`,
                background: 'transparent', color: roastMode === m.key ? CYAN : DIM, fontSize: 12,
                fontWeight: roastMode === m.key ? 700 : 400, cursor: 'pointer',
              }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* ═══ upload ═══ */}
      {stage === 'upload' && roastMode === 'agent' && (
        <div className="stage-card upload-stage">
          <h2>第一步：上传简历</h2>
          <p className="stage-hint">支持 PDF、Word 和图片格式</p>
          <div className={`upload-area ${isDragging ? 'dragover' : ''}`}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <textarea className="resume-input" value={resumeText}
              onChange={e => setResumeText(e.target.value)}
              placeholder="粘贴简历内容到此处，或直接拖拽简历文件到此处..." disabled={isLoading} />
            {isDragging && <div className="drop-overlay"><span className="drop-icon">📄</span><span className="drop-text">松开上传简历</span></div>}
          </div>

          <div className="difficulty-selector">
            <h3>选择面试难度</h3>
            <div className="difficulty-options">
              {(Object.keys(DIFFICULTY_CONFIG) as DifficultyLevel[]).map(level => (
                <button key={level}
                  className={`difficulty-option ${difficulty === level ? 'active' : ''}`}
                  onClick={() => setDifficulty(level)} disabled={isLoading}>
                  <span className="difficulty-label">{DIFFICULTY_CONFIG[level].label}</span>
                  <span className="difficulty-desc">{DIFFICULTY_CONFIG[level].description}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="upload-actions">
            <label className="upload-btn">
              <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                onChange={handleFileUpload} disabled={isLoading} />
              📎 选择文件
            </label>
            <button className="analyze-btn" onClick={handleStartInterview}
              disabled={!resumeText.trim() || isLoading}>
              {isLoading ? 'Agent 启动中...' : '开始拷打'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ upload（准备驱动模式）═══ */}
      {stage === 'upload' && roastMode === 'prep' && (
        <div className="stage-card upload-stage">
          {prepImportStage === 'select' ? (
            /* ── 准备驱动入口选择 ── */
            <div>
              <h2 style={{ marginBottom: 8 }}>🎯 准备驱动模式 — 选择文档来源</h2>
              <p className="stage-hint" style={{ marginBottom: 20 }}>
                面试准备驱动模式让你先有一份高质量的面试准备文档，再针对性模拟面试，精准打击弱点。
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* 选项 1：从 Web 面试准备 */}
                <div
                  onClick={() => navigate('/prep')}
                  style={{
                    background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20,
                    cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = CYAN)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
                >
                  <div style={{ fontSize: 32, marginBottom: 10 }}>🌐</div>
                  <div style={{ fontWeight: 700, color: CYAN, fontSize: 14, marginBottom: 6 }}>Web 面试准备</div>
                  <div style={{ fontSize: 11, color: DIM, lineHeight: 1.6 }}>
                    在应用中输入简历+JD<br />
                    生成面试准备文档<br />
                    再一键启动针对性面试
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: GREEN }}>点击前往面试准备页 →</div>
                </div>

                {/* 选项 2：导入 Skill 文档 */}
                <div
                  onClick={() => setPrepImportStage('external')}
                  style={{
                    background: CARD, border: `1px solid ${MAGENTA}60`, borderRadius: 10, padding: 20,
                    cursor: 'pointer', textAlign: 'center', transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = MAGENTA)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = `${MAGENTA}60`)}
                >
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
                  <div style={{ fontWeight: 700, color: MAGENTA, fontSize: 14, marginBottom: 6 }}>
                    导入 Skill 文档 <span style={{ fontSize: 10, color: YELLOW, marginLeft: 4 }}>推荐</span>
                  </div>
                  <div style={{ fontSize: 11, color: DIM, lineHeight: 1.6 }}>
                    在 Claude Code 中用 interview-prep skill<br />
                    生成高质量 .md 文档<br />
                    导入后直接启动针对性面试
                  </div>
                  <div style={{ marginTop: 10, fontSize: 11, color: MAGENTA }}>点击进入导入 →</div>
                </div>
              </div>

              {/* 也支持直接粘贴 resume 快速开始 agent 模式作为兜底 */}
              <div style={{ textAlign: 'center', marginTop: 16 }}>
                <button
                  onClick={() => { setRoastMode('agent'); }}
                  style={{ padding: '6px 14px', background: 'transparent', border: `1px solid ${DIM}`, color: DIM, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
                >
                  或者直接用 Agent 面试模式 →
                </button>
              </div>
            </div>
          ) : (
            /* ── 导入 Skill 文档表单 ── */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>📄 导入 Interview Prep Skill 文档</h2>
                <button
                  onClick={() => { setPrepImportStage('select'); setExternalDocText(''); setExternalDocFileName(''); }}
                  style={{ padding: '4px 12px', background: 'transparent', border: `1px solid ${DIM}`, color: DIM, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
                >
                  ← 返回选择
                </button>
              </div>

              <p className="stage-hint" style={{ marginBottom: 16 }}>
                将 interview-prep skill 生成的 .md 面试准备文档导入，后端 LLM 会自动解析题目、Gap 和 JD 意图，
                然后启动针对性面试。推荐搭配 Claude Code 的 interview-prep skill 使用。
              </p>

              {/* Step 1: 上传 Skill MD */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8, color: MAGENTA }}>
                  Step 1 — 导入 Skill 生成的 .md 文档
                </label>
                <div
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                  onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                  onDrop={e => {
                    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleExternalDocFile(file);
                  }}
                  style={{
                    border: `1px dashed ${isDragging ? MAGENTA : externalDocText ? GREEN : BORDER}`,
                    borderRadius: 10, padding: 20, textAlign: 'center', marginBottom: 10,
                    background: externalDocText ? 'rgba(34,255,34,0.04)' : 'transparent',
                    cursor: 'pointer', transition: 'border-color 0.2s',
                  }}
                  onClick={() => document.getElementById('skillMdInput')?.click()}
                >
                  {externalDocText ? (
                    <div>
                      <span style={{ fontSize: 20 }}>✅</span>
                      <div style={{ color: GREEN, fontSize: 12, marginTop: 4 }}>
                        已加载：{externalDocFileName}（{externalDocText.length.toLocaleString()} 字符）
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: 24 }}>📄</span>
                      <div style={{ color: DIM, fontSize: 12, marginTop: 4 }}>拖拽 .md 文件到此处，或点击上传</div>
                    </div>
                  )}
                  <input
                    id="skillMdInput"
                    type="file"
                    accept=".md,.markdown,.txt"
                    hidden
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleExternalDocFile(file);
                    }}
                  />
                </div>
                {/* 也支持直接粘贴 */}
                <textarea
                  value={externalDocText}
                  onChange={e => setExternalDocText(e.target.value)}
                  placeholder="或者直接粘贴 Markdown 文档内容到此处..."
                  rows={3}
                  style={{
                    width: '100%', background: CARD, border: `1px solid ${BORDER}`,
                    color: '#fff', padding: 10, borderRadius: 8, fontSize: 12, resize: 'vertical',
                    fontFamily: 'monospace', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Step 2: 简历 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8, color: CYAN }}>
                  Step 2 — 简历内容 *
                </label>
                <textarea
                  value={resumeText}
                  onChange={e => setResumeText(e.target.value)}
                  placeholder="粘贴简历内容到此处（必填）"
                  rows={5}
                  style={{
                    width: '100%', background: CARD, border: `1px solid ${BORDER}`,
                    color: '#fff', padding: 10, borderRadius: 8, fontSize: 13, resize: 'vertical',
                    fontFamily: 'monospace', boxSizing: 'border-box',
                  }}
                />
                <div style={{ marginTop: 8, fontSize: 11, color: DIM }}>面试 Agent 需要简历来分析你的背景，Skill 文档提供面试策略</div>
              </div>

              {/* Step 3: 难度 */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8, color: CYAN }}>
                  Step 3 — 面试难度
                </label>
                <div className="difficulty-options" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(Object.keys(DIFFICULTY_CONFIG) as DifficultyLevel[]).map(level => (
                    <button key={level}
                      style={{
                        padding: '8px 14px', border: `1px solid ${difficulty === level ? CYAN : BORDER}`,
                        borderRadius: 8, background: difficulty === level ? 'rgba(0,240,255,0.08)' : CARD,
                        color: difficulty === level ? CYAN : DIM, fontSize: 12, cursor: 'pointer',
                      }}
                      onClick={() => setDifficulty(level)} disabled={isImportingDoc}
                    >
                      {DIFFICULTY_CONFIG[level].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 文档预览提示 */}
              {externalDocText && (
                <div style={{
                  marginBottom: 16, padding: 10, background: 'rgba(255,0,255,0.04)',
                  border: `1px solid ${MAGENTA}30`, borderRadius: 8, fontSize: 11, color: DIM,
                }}>
                  📋 文档将交由后端 LLM 自动解析：提取预测题目、Gap 清单、JD 核心意图等关键信息。
                  解析结果用于驱动面试 Agent 针对你的弱项出题。
                </div>
              )}

              {/* 提交 */}
              <button
                onClick={handleStartFromExternalDoc}
                disabled={isImportingDoc || !resumeText.trim() || !externalDocText.trim()}
                style={{
                  width: '100%', padding: '14px 0',
                  background: (resumeText.trim() && externalDocText.trim() && !isImportingDoc) ? MAGENTA : DIM,
                  color: (resumeText.trim() && externalDocText.trim()) ? '#fff' : '#666',
                  border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                  cursor: (resumeText.trim() && externalDocText.trim()) ? 'pointer' : 'not-allowed',
                }}
              >
                {isImportingDoc ? '⏳ 解析文档 & 启动面试...' : '🚀 导入文档并开始面试'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ analyzing ═══ */}
      {stage === 'analyzing' && (
        <div className="stage-card analyzing-stage">
          <div className="loading-spinner">🤖</div>
          <h2>Agent 正在分析简历...</h2>
          <p>认知诊断引擎启动中，首道题即将生成</p>
          <div className="pixel-progress-container">
            <div className="pixel-progress-bar">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={`pixel-block ${i < 6 ? 'filled' : 'empty'}`} />
              ))}
            </div>
            <span className="progress-text">...</span>
          </div>
        </div>
      )}

      {/* ═══ interviewing ═══ */}
      {stage === 'interviewing' && currentQuestion && (
        <div className="stage-card interview-stage">
          <div className="interview-progress">
            <span>已回答 {answers.length} 题{questionCount >= MAX_QUESTIONS - 2 ? ` (上限 ${MAX_QUESTIONS})` : ''}</span>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${Math.min((answers.length / 8) * 100, 100)}%` }} />
            </div>
          </div>

          <div className="current-question">
            <span className="question-category">[{currentQuestion.category}]</span>
            <h3>{currentQuestion.text}</h3>
          </div>

          <div className="answer-section">
            <textarea className="answer-input" value={currentAnswer}
              onChange={e => setCurrentAnswer(e.target.value)}
              placeholder="请输入你的回答..." rows={6} disabled={isLoading}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmitAnswer(); }} />
            <button className="submit-btn" onClick={handleSubmitAnswer}
              disabled={!currentAnswer.trim() || isLoading}>
              {isLoading ? 'Agent 评估中...' : '提交回答 (Ctrl+Enter)'}
            </button>
          </div>

          {answers.length > 0 && (
            <div className="answered-questions">
              <h4>已回答问题</h4>
              <div className="answers-list">
                {answers.map((a, i) => (
                  <div key={a.questionId} className="answered-item">
                    <span className="q-badge">Q{i + 1}</span>
                    <span className="q-score-badge" style={{ color: a.evaluation.score >= 70 ? GREEN : '#ff6666' }}>
                      {a.evaluation.score}分
                    </span>
                    <span className="answered-check">✓</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══ reporting ═══ */}
      {stage === 'reporting' && diagnosis && (
        <div className="stage-card report-stage">
          <div className="report-header">
            <h2>🧠 认知诊断报告{isPrepDriven && <span style={{ color: MAGENTA, fontSize: 12, marginLeft: 8 }}>（面试准备驱动）</span>}</h2>
            <div className="report-actions">
              {isPrepDriven && !prepId?.startsWith('ext-') && (
                <button
                  className="export-btn"
                  onClick={handleBackToPrep}
                  style={{ background: `${MAGENTA}20`, borderColor: MAGENTA, color: MAGENTA }}
                >
                  🔄 闭环优化面试准备
                </button>
              )}
              {isPrepDriven && prepId?.startsWith('ext-') && (
                <div style={{
                  padding: '6px 12px', background: 'rgba(255,0,255,0.06)', borderRadius: 6,
                  border: `1px solid ${MAGENTA}40`, fontSize: 11, color: MAGENTA, maxWidth: 320, lineHeight: 1.5,
                }}>
                  💡 外部文档导入模式 — 将诊断结果带回 Claude Code，用诊断暴露的弱项重新调整 Skill 的面试准备文档，实现人工闭环。
                  {parsedSummary && <div style={{ marginTop: 4, color: DIM }}>📋 {parsedSummary}</div>}
                </div>
              )}
              <button className="export-btn" onClick={() => exportDiagnosisToJSON(diagnosis, answers, difficulty)}>📄 JSON</button>
              <button className="export-btn" onClick={() => exportDiagnosisToWord(diagnosis, answers, difficulty)}>📝 Word</button>
              <button className="restart-btn-small" onClick={handleRestart}>🔄 重新开始</button>
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
            {answers.map((a, i) => (
              <div key={a.questionId} style={{ marginBottom: 16, padding: 10, border: '1px solid #222', borderRadius: 2, background: '#0d0d0d' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#fff', fontSize: 13 }}>Q{i + 1}</span>
                  <span className={`q-score-tag ${getScoreColor(a.evaluation.score)}`}
                    style={{ fontFamily: 'monospace', fontSize: 12, padding: '2px 8px', borderRadius: 2 }}>
                    {a.evaluation.score}分 {getScoreLabel(a.evaluation.score)}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 6, fontFamily: 'monospace', maxHeight: 60, overflow: 'hidden' }}>
                  {a.questionText.slice(0, 200)}...
                </div>
                <div style={{ fontSize: 12, color: '#ccc', marginBottom: 6, fontFamily: 'monospace', maxHeight: 80, overflow: 'hidden' }}>
                  <span style={{ color: '#888' }}>你的回答：</span>{a.answer.slice(0, 300)}
                </div>
                <div style={{ fontSize: 11, color: CYAN, fontFamily: 'monospace' }}>💬 {a.evaluation.comment}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeRoast;
