import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { parseDocument } from '../utils/documentParser';
import { startAgentInterview, submitAgentAnswer, fetchDiagnosis, keepSessionAlive, SessionNotFoundError } from '../services/diagnosisService';
import type { StartFromExternalDocResult } from '../services/prepService';
import { startFromExternalDoc, startFromPrep } from '../services/prepService';
import { getPreps, deletePrep, updatePrepLastUsed, exportPrepToMarkdown, type SavedPrep } from '../services/prepStorage';
import { saveDiagnosis as saveDiagnosisToStorage, getDiagnoses, deleteDiagnosis, type SavedDiagnosis } from '../services/diagnosisStorage';
import { saveHistoryRecord } from '../utils/storage';
import type { AgentQuestion, CognitiveDiagnosis } from '../services/diagnosisService';
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
const MAX_QUESTIONS = 15;    // 硬上限
const TARGET_QUESTIONS = 8;  // 目标题数（进度条基准）
const CYAN = '#00f0ff';
const MAGENTA = '#ff00ff';
const GREEN = '#22ff22';
const YELLOW = '#ffff00';
const RED = '#ff4444';
const DIM = '#555';
const BG = '#0a0a0a';
const CARD = '#111';
const BORDER = '#222';

type Stage = 'upload' | 'analyzing' | 'interviewing' | 'reporting';

// ── 像素风进度条组件 ──
const PixelProgress = ({ label, sublabel, startedAt }: { label: string; sublabel?: string; startedAt?: number }) => {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(t);
  }, [startedAt]);

  // 根据耗时估算进度（LLM 调用通常 30-120 秒，大致线性增长到 95%，完成前不达 100%）
  const estimatedPct = Math.min(95, Math.floor(elapsed / 2)); // 每秒约 2%，上限 95%
  const blocks = 20; // 像素块数量
  const filledBlocks = Math.floor(estimatedPct / (100 / blocks));
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(blocks - filledBlocks);

  return (
    <div style={{ textAlign: 'center', marginTop: 12 }}>
      <div style={{ color: CYAN, fontSize: 13, marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {sublabel && <div style={{ color: DIM, fontSize: 11, marginBottom: 8 }}>{sublabel}</div>}
      <div style={{
        fontFamily: 'monospace', fontSize: 16, letterSpacing: 1,
        color: CYAN, lineHeight: 1.4,
      }}>
        [{bar}] {estimatedPct}%
      </div>
      <div style={{ color: DIM, fontSize: 10, marginTop: 4 }}>
        {elapsed}s 已耗时
      </div>
    </div>
  );
};

// ── 评估进度条 ──
const EvaluationProgress = () => (
  <PixelProgress label="🤖 AI 正在评估你的回答..." startedAt={Date.now()} />
);

// ── 启动分析进度条 ──
const AnalyzingProgress = ({ isPrepDriven }: { isPrepDriven: boolean }) => (
  <div className="stage-card analyzing-stage">
    <div style={{ textAlign: 'center' }}>
      <h2 style={{ marginBottom: 8 }}>
        {isPrepDriven ? '📋 正在解析文档并启动面试...' : '🤖 Agent 正在分析简历...'}
      </h2>
      <PixelProgress
        label={isPrepDriven ? '提取预测题目 + Gap清单' : '认知诊断引擎启动中'}
        sublabel={isPrepDriven ? 'AI 解析文档并生成针对性首题' : 'AI 分析简历结构并生成首道题'}
        startedAt={Date.now()}
      />
    </div>
  </div>
);

const ResumeRoast = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const prepState = location.state as {
    prepId?: string;
    sessionId?: string;
    firstQuestion?: AgentQuestion;
    prepContextUsed?: string[];
    isPrepDriven?: boolean;
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
  const [prepImportStage, setPrepImportStage] = useState<'select' | 'form'>('select');
  const [parsedSummary, setParsedSummary] = useState('');

  // ── 已保存文档列表 ──
  const [savedPreps, setSavedPreps] = useState<SavedPrep[]>([]);
  const [showSavedPreps, setShowSavedPreps] = useState(false);
  const [savedDiagnoses, setSavedDiagnoses] = useState<SavedDiagnosis[]>([]);
  const [viewingDiagnosis, setViewingDiagnosis] = useState<SavedDiagnosis | null>(null);
  const [viewingPrep, setViewingPrep] = useState<SavedPrep | null>(null);
  const [importConfirmPrep, setImportConfirmPrep] = useState<SavedPrep | null>(null);
  const [dialogResumeText, setDialogResumeText] = useState(''); // 弹窗内临时简历输入
  const [dialogResumeFile, setDialogResumeFile] = useState(''); // 弹窗内简历文件名
  const [isDraggingDialogResume, setIsDraggingDialogResume] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // ── JD 导入状态 ──
  const [jdText, setJdText] = useState('');
  const [jdFileName, setJdFileName] = useState('');

  // 加载与错误
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 区分各拖拽区，避免互相干扰
  const [isDraggingResume, setIsDraggingResume] = useState(false);
  const [isDraggingJd, setIsDraggingJd] = useState(false);
  const [isDraggingDoc, setIsDraggingDoc] = useState(false);

  // ── 状态持久化：恢复之前的面试状态 ──
  useEffect(() => {
    const savedState = localStorage.getItem('resume-roast-state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.stage === 'interviewing' && parsed.sessionId && parsed.currentQuestion) {
          setStage('interviewing');
          setSessionId(parsed.sessionId);
          setCurrentQuestion(parsed.currentQuestion);
          setCurrentAnswer(parsed.currentAnswer || '');
          setAnswers(parsed.answers || []);
          setQuestionCount(parsed.questionCount || 1);
          setPrepId(parsed.prepId || null);
          setIsPrepDriven(parsed.isPrepDriven || false);
          setRoastMode(parsed.roastMode || 'agent');
          setResumeText(parsed.resumeText || '');
          setJdText(parsed.jdText || '');
          localStorage.removeItem('resume-roast-state');
          return; // 跳过默认的 prepState 处理
        }
      } catch (e) {
        console.error('恢复面试状态失败:', e);
      }
    }

    // ── 处理 Prep 上下文 ──
    if (prepState?.sessionId && prepState?.firstQuestion) {
      // 确保状态完全重置后再设置新状态
      setSessionId(null);
      setCurrentQuestion(null);
      setQuestionCount(0);
      setAnswers([]);
      setCurrentAnswer('');
      setDiagnosis(null);
      
      // 使用 setTimeout 确保状态重置完成
      setTimeout(() => {
        setSessionId(prepState.sessionId ?? null);
        setCurrentQuestion(prepState.firstQuestion ?? null);
        setPrepId(prepState.prepId || null);
        setIsPrepDriven(prepState.isPrepDriven || true);
        setRoastMode('prep');
        setQuestionCount(1);
        setStage('interviewing');
        // 保存面试状态到 localStorage
        localStorage.setItem('resume-roast-state', JSON.stringify({
          stage: 'interviewing',
          sessionId: prepState.sessionId ?? null,
          currentQuestion: prepState.firstQuestion ?? null,
          currentAnswer: '',
          answers: [],
          questionCount: 1,
          prepId: prepState.prepId || null,
          isPrepDriven: prepState.isPrepDriven || true,
          roastMode: 'prep',
          resumeText: '',
          jdText: '',
          timestamp: Date.now(),
        }));
        // 清除 location state 避免重复触发
        window.history.replaceState({}, document.title);
      }, 50);
    }
  }, [prepState?.sessionId, prepState?.firstQuestion]);

  // ── 会话保活机制 ──
  useEffect(() => {
    if (!sessionId || stage !== 'interviewing') return;

    // 每30秒发送保活请求
    const interval = setInterval(async () => {
      try {
        await keepSessionAlive(sessionId);
      } catch (err) {
        console.warn('会话保活失败:', err);
        // 保活失败不中断面试，继续尝试
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [sessionId, stage]);

  // ── 加载已保存文档列表 ──
  useEffect(() => {
    if (stage === 'upload' && roastMode === 'prep') {
      setSavedPreps(getPreps());
      setSavedDiagnoses(getDiagnoses());
    }
  }, [stage, roastMode]);

  // ── 使用已保存文档开始面试 ──
  const handleUseSavedPrep = async (prep: SavedPrep, resumeOverride?: string) => {
    // 简历是可选的：使用已保存文档时不强求
    // 但如果提供了简历，会让后端生成更精准的问题
    const effectiveResume = (resumeOverride !== undefined ? resumeOverride : resumeText).trim();

    setIsLoading(true);
    setError(null);
    try {
      // 更新文档的最后使用时间
      updatePrepLastUsed(prep.meta.prep_id);

      // 调用 startFromPrep API，传完整文档数据绕过内存存储
      const result = await startFromPrep({
        prep_id: prep.meta.prep_id,
        resume_text: effectiveResume,
        prep_data: prep as unknown as Record<string, unknown>,
      } as any);

      setSessionId(result.session_id);
      setCurrentQuestion(result.first_question);
      setPrepId(prep.meta.prep_id);
      setIsPrepDriven(true);
      setQuestionCount(1);
      setAnswers([]);
      setCurrentAnswer('');
      setDiagnosis(null);
      if (effectiveResume) {
        setResumeText(effectiveResume);
      }
      await delay(400);
      setStage('interviewing');

      // 关闭确认对话框
      setImportConfirmPrep(null);

      // 显示成功提示
      showToast(`✅ 已成功导入"${prep.meta.role_name} @ ${prep.meta.company_name || '未知公司'}"面试准备`, 'success');

      // 保存面试状态到 localStorage
      localStorage.setItem('resume-roast-state', JSON.stringify({
        stage: 'interviewing',
        sessionId: result.session_id,
        currentQuestion: result.first_question,
        currentAnswer: '',
        answers: [],
        questionCount: 1,
        prepId: prep.meta.prep_id,
        isPrepDriven: true,
        roastMode: 'prep',
        resumeText: effectiveResume,
        jdText,
        timestamp: Date.now(),
      }));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '启动面试失败';
      showToast(`❌ 启动失败: ${errorMsg}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Toast 提示（用 ref 保存定时器以便卸载时清理）──
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  };

  // ── 跳转到面试准备页面 ──
  const handleGoToFullPrep = () => {
    navigate('/prep');
  };

  // ── 文件处理 ──
  const processFile = async (file: File, target: 'resume' | 'jd' | 'webPrep' = 'resume'): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'txt', 'md'].includes(ext || '')) {
      setError('错误：仅支持 PDF、DOCX、图片格式和文本文件');
      return '';
    }
    setIsLoading(true);
    setError(null);
    try {
      const text = await parseDocument(file);
      if (target === 'webPrep') {
        setResumeText(text);
      } else if (target === 'jd') {
        setJdText(text);
        setJdFileName(file.name);
      } else {
        setResumeText(text);
      }
      return text;
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取文档失败');
      return '';
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // 允许重新上传同名文件
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingResume(true); };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX <= rect.left || clientX >= rect.right || clientY <= rect.top || clientY >= rect.bottom) {
      setIsDraggingResume(false);
    }
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDraggingResume(false);
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
      const result = await startAgentInterview(resumeText, difficulty, jdText);
      setSessionId(result.session_id);
      setCurrentQuestion(result.first_question);
      setQuestionCount(1);
      setAnswers([]);
      setCurrentAnswer('');
      setDiagnosis(null);
      await delay(400);
      setStage('interviewing');
      // 保存面试状态到 localStorage
      localStorage.setItem('resume-roast-state', JSON.stringify({
        stage: 'interviewing',
        sessionId: result.session_id,
        currentQuestion: result.first_question,
        currentAnswer: '',
        answers: [],
        questionCount: 1,
        prepId: null,
        isPrepDriven: false,
        roastMode: 'agent',
        resumeText,
        jdText,
        timestamp: Date.now(),
      }));
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

      // 保存历史记录
      try {
        saveHistoryRecord({
          id: uuidv4(),
          timestamp: Date.now(),
          mode: 'roast',
          category: currentQuestion.category,
          questionText: currentQuestion.text,
          userAnswer: currentAnswer,
          score: result.evaluation.score,
          comment: result.evaluation.comment,
          referenceAnswer: result.evaluation.reference_answer || '',
          isWrong: result.evaluation.score < 60,
          sessionId: sessionId,
          knowledgeHits: result.evaluation.knowledge_hits || [],
          knowledgeGaps: result.evaluation.knowledge_gaps || [],
        });
      } catch {}

      if (result.is_finished && result.cumulative_diagnosis) {
        // Agent 结束面试
        setDiagnosis(result.cumulative_diagnosis);
        setStage('reporting');
      } else if (result.next_question) {
        // 继续下一题
        setCurrentQuestion(result.next_question);
        setCurrentAnswer('');
        const nextCount = questionCount + 1;
        setQuestionCount(nextCount);

        // 安全上限
        if (nextCount >= MAX_QUESTIONS) {
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
    setJdText('');
    setJdFileName('');
  };

  // ── 返回面试准备（闭环）──
  const handleBackToPrep = () => {
    navigate('/prep', {
      state: {
        prepId,
        sessionId,
        diagnosisCompleted: true,
        diagnosisData: diagnosis, // 携带完整诊断数据，防止后端会话过期
      },
    });
  };

  // ── 保存诊断报告 ──
  const handleSaveDiagnosis = () => {
    if (!diagnosis) return;
    try {
      saveDiagnosisToStorage({
        prepId: prepId || undefined,
        sessionId: sessionId || undefined,
        isPrepDriven,
        difficulty,
        questionCount: answers.length,
        diagnosis,
        answers: answers.map(a => ({
          questionText: a.questionText,
          answer: a.answer,
          evaluation: a.evaluation,
        })),
      });
      setSavedDiagnoses(getDiagnoses());
      showToast('✅ 诊断报告已保存（可在准备驱动页查看）', 'success');
    } catch {
      showToast('❌ 保存失败', 'error');
    }
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
    if (!externalDocText.trim()) { setError('请先导入面试准备文档（.md）'); return; }
    // 简历是可选的：文档已包含完整预测题库和 Gap 清单
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
      // 保存面试状态到 localStorage
      localStorage.setItem('resume-roast-state', JSON.stringify({
        stage: 'interviewing',
        sessionId: result.session_id,
        currentQuestion: result.first_question,
        currentAnswer: '',
        answers: [],
        questionCount: 1,
        prepId: `ext-${result.session_id}`,
        isPrepDriven: true,
        roastMode: 'prep',
        resumeText,
        jdText,
        timestamp: Date.now(),
      }));
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
          <div className={`upload-area ${isDraggingResume ? 'dragover' : ''}`}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <textarea className="resume-input" value={resumeText}
              onChange={e => setResumeText(e.target.value)}
              placeholder="粘贴简历内容到此处，或直接拖拽简历文件到此处..." disabled={isLoading} />
            {isDraggingResume && <div className="drop-overlay"><span className="drop-icon">📄</span><span className="drop-text">松开上传简历</span></div>}
          </div>

          {/* JD 导入区域 */}
          <div className="jd-upload-section" style={{ marginTop: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: MAGENTA, marginBottom: 8 }}>📋 导入岗位 JD（可选）</h3>
            <textarea
              value={jdText}
              onChange={e => setJdText(e.target.value)}
              placeholder="粘贴岗位 JD 内容，或拖拽文件到下方..."
              rows={3}
              disabled={isLoading}
              style={{
                width: '100%', background: '#111', border: '1px solid #222',
                color: '#fff', padding: 10, borderRadius: 8, fontSize: 13, resize: 'vertical',
                fontFamily: 'monospace', boxSizing: 'border-box',
              }}
            />
            <div
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingJd(true); }}
              onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingJd(false); }}
              onDrop={e => {
                e.preventDefault(); e.stopPropagation(); setIsDraggingJd(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  const ext = file.name.split('.').pop()?.toLowerCase();
                  if (ext === 'pdf' || ext === 'docx' || ext === 'txt' || ext === 'md') {
                    processFile(file).then(text => {
                      setJdText(text);
                      setJdFileName(file.name);
                    });
                  }
                }
              }}
              style={{
                border: `1px dashed ${isDraggingJd ? MAGENTA : '#222'}`,
                borderRadius: 8, padding: 10, textAlign: 'center', marginTop: 8,
                color: '#555', fontSize: 11, cursor: 'pointer',
                background: isDraggingJd ? 'rgba(255,0,255,0.05)' : 'transparent',
                transition: 'border-color 0.2s',
              }}
              onClick={() => document.getElementById('jdFileInput')?.click()}
            >
              {jdText ? (
                <span style={{ color: '#22ff22' }}>✅ 已加载：{jdFileName || 'JD 内容'}（{jdText.length.toLocaleString()} 字符）</span>
              ) : (
                <span>📎 拖拽 JD 文件（PDF/DOCX/TXT）到此处，或点击上传</span>
              )}
              <input
                id="jdFileInput"
                type="file"
                accept=".pdf,.docx,.txt,.md"
                hidden
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = ''; // 允许重新上传同名文件
                  if (file) {
                    processFile(file).then(text => {
                      setJdText(text);
                      setJdFileName(file.name);
                    });
                  }
                }}
              />
            </div>
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
            /* ── 准备驱动入口 ── */
            <div>
              <h2 style={{ marginBottom: 8 }}>🎯 准备驱动模式</h2>
              <p className="stage-hint" style={{ marginBottom: 20 }}>
                面试准备驱动模式让你先有一份高质量的面试准备文档，再针对性模拟面试，精准打击弱点。
              </p>

              {/* 第一次使用提示：带跳转按钮 */}
              <div style={{
                background: 'rgba(0,240,255,0.06)', border: `1px solid ${CYAN}40`,
                borderRadius: 10, padding: 16, marginBottom: 20, fontSize: 12, color: '#ddd', lineHeight: 1.7,
              }}>
                <div style={{ marginBottom: 10 }}>
                  💡 <strong style={{ color: CYAN }}>第一次使用？</strong>请先生成一份面试准备文档：
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button
                    onClick={handleGoToFullPrep}
                    style={{
                      padding: '8px 14px', background: CYAN, color: '#000', border: 'none',
                      borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 700,
                    }}
                  >
                    📋 跳转完整面试准备 →
                  </button>
                  <div style={{
                    padding: '8px 14px', background: 'rgba(255,0,255,0.06)',
                    border: `1px solid ${MAGENTA}40`, borderRadius: 6, fontSize: 12, color: '#ccc',
                    display: 'flex', alignItems: 'center',
                  }}>
                    🤖 或在 Claude Code 中用 <code style={{ color: MAGENTA, fontWeight: 600, margin: '0 4px' }}>interview-prep</code> skill 生成 .md 文档
                  </div>
                </div>
              </div>

              {/* 单一入口：导入文档 + 简历 */}
              <div
                onClick={() => setPrepImportStage('form')}
                style={{
                  background: CARD, border: `1px solid ${CYAN}60`, borderRadius: 10, padding: 20,
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s', marginBottom: 20,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = CYAN; e.currentTarget.style.background = 'rgba(0,240,255,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${CYAN}60`; e.currentTarget.style.background = CARD; }}
              >
                <div style={{ fontSize: 32, marginBottom: 10 }}>📥</div>
                <div style={{ fontWeight: 700, color: CYAN, fontSize: 14, marginBottom: 6 }}>导入文档 + 简历，启动针对性面试</div>
                <div style={{ fontSize: 11, color: DIM, lineHeight: 1.6 }}>
                  支持 .json（Web 准备文档） / .md（Skill 文档） / 粘贴文本<br />
                  再上传简历，一键启动基于文档题库的针对性面试
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: GREEN, fontWeight: 600 }}>点击进入 →</div>
              </div>

              {/* 已保存文档列表 */}
              {savedPreps.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: GREEN }}>💾 已保存的面试准备文档</h3>
                    <button
                      onClick={() => setShowSavedPreps(!showSavedPreps)}
                      style={{
                        padding: '4px 12px', background: 'transparent', border: `1px solid ${GREEN}`,
                        borderRadius: 6, fontSize: 11, color: GREEN, cursor: 'pointer',
                      }}
                    >
                      {showSavedPreps ? '收起 ▾' : `展开 (${savedPreps.length}) ▸`}
                    </button>
                  </div>
                  
                  {showSavedPreps && (
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                      {savedPreps.map((prep) => (
                        <div
                          key={prep.meta.prep_id}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '12px 16px', borderBottom: `1px solid ${BORDER}`,
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#fff' }}>
                              📋 {prep.meta.role_name} @ {prep.meta.company_name || '未知公司'}
                            </div>
                            <div style={{ fontSize: 11, color: DIM, marginTop: 2 }}>
                              {prep.meta.direction === 'E' ? 'AI产品' : 'AI全栈开发'} · {prep.meta.difficulty}
                              <span style={{ margin: '0 6px', color: BORDER }}>|</span>
                              保存于 {new Date(prep.savedAt).toLocaleDateString('zh-CN')}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => setViewingPrep(prep)}
                              style={{
                                padding: '6px 10px', background: 'transparent', border: `1px solid ${CYAN}`,
                                borderRadius: 6, fontSize: 11, color: CYAN, cursor: 'pointer',
                              }}
                            >
                              查看
                            </button>
                            <button
                              onClick={() => exportPrepToMarkdown(prep)}
                              style={{
                                padding: '6px 10px', background: 'transparent', border: `1px solid ${YELLOW}`,
                                borderRadius: 6, fontSize: 11, color: YELLOW, cursor: 'pointer',
                              }}
                            >
                              导出
                            </button>
                            <button
                              onClick={() => setImportConfirmPrep(prep)}
                              style={{
                                padding: '6px 12px', background: GREEN, color: '#000', border: 'none',
                                borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                              }}
                            >
                              使用
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`确定要删除 "${prep.meta.role_name}" 的面试准备文档吗？`)) {
                                  deletePrep(prep.meta.prep_id);
                                  setSavedPreps(getPreps());
                                }
                              }}
                              style={{
                                padding: '6px 12px', background: 'transparent', border: `1px solid ${RED}`,
                                borderRadius: 6, fontSize: 11, color: RED, cursor: 'pointer',
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 已保存诊断报告列表 */}
              {savedDiagnoses.length > 0 && (
                <div style={{ marginBottom: 16, marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: MAGENTA }}>📊 已保存诊断报告 ({savedDiagnoses.length})</h3>
                  </div>
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                    {savedDiagnoses.slice(0, 5).map((d) => (
                      <div key={d.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 12,
                      }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ color: '#fff', fontWeight: 600 }}>
                            🧠 总分 {d.diagnosis.overall_score} · {d.questionCount}题
                          </span>
                          <span style={{ color: DIM, marginLeft: 8 }}>
                            {d.isPrepDriven ? '🎯准备驱动' : '🤖Agent'} · {new Date(d.savedAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => setViewingDiagnosis(d)}
                            style={{
                              padding: '4px 10px', background: 'transparent', border: `1px solid ${CYAN}`,
                              borderRadius: 4, fontSize: 10, color: CYAN, cursor: 'pointer',
                            }}
                          >
                            查看
                          </button>
                          <button
                            onClick={() => {
                              if (confirm('确定删除此诊断报告？')) {
                                deleteDiagnosis(d.id);
                                setSavedDiagnoses(getDiagnoses());
                              }
                            }}
                            style={{
                              padding: '4px 10px', background: 'transparent', border: `1px solid ${RED}`,
                              borderRadius: 4, fontSize: 10, color: RED, cursor: 'pointer',
                            }}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
          ) : prepImportStage === 'form' ? (
            /* ── 统一文档导入 + 简历上传表单 ── */
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>📥 导入文档 + 简历</h2>
                <button
                  onClick={() => {
                    setPrepImportStage('select');
                    setExternalDocText('');
                    setExternalDocFileName('');
                    setParsedSummary('');
                  }}
                  style={{ padding: '4px 12px', background: 'transparent', border: `1px solid ${DIM}`, color: DIM, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}
                >
                  ← 返回选择
                </button>
              </div>

              <p className="stage-hint" style={{ marginBottom: 16 }}>
                导入面试准备文档（提供题库和策略），再上传简历（让 Agent 了解你的背景），即可启动针对性面试。
              </p>

              {/* Step 1: 文档导入（统一支持 JSON + MD） */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8, color: CYAN }}>
                  Step 1 — 导入面试准备文档 <span style={{ fontSize: 11, color: DIM, fontWeight: 400 }}>（必填）</span>
                </label>
                <div
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingDoc(true); }}
                  onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingDoc(false); }}
                  onDrop={e => {
                    e.preventDefault(); e.stopPropagation(); setIsDraggingDoc(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleExternalDocFile(file);
                  }}
                  style={{
                    border: `1px dashed ${isDraggingDoc ? CYAN : externalDocText ? GREEN : BORDER}`,
                    borderRadius: 10, padding: 18, textAlign: 'center', marginBottom: 8,
                    background: externalDocText ? 'rgba(34,255,34,0.04)' : 'transparent',
                    cursor: 'pointer', transition: 'border-color 0.2s',
                  }}
                  onClick={() => document.getElementById('prepDocInput')?.click()}
                >
                  {externalDocText ? (
                    <div>
                      <span style={{ fontSize: 20 }}>✅</span>
                      <div style={{ color: GREEN, fontSize: 12, marginTop: 4 }}>
                        已加载：{externalDocFileName || '粘贴文本'}（{externalDocText.length.toLocaleString()} 字符）
                      </div>
                      <div style={{ color: DIM, fontSize: 10, marginTop: 2 }}>点击重新上传</div>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: 24 }}>📄</span>
                      <div style={{ color: DIM, fontSize: 12, marginTop: 4 }}>
                        拖拽 .json / .md / .markdown / .txt 到此处，或点击上传
                      </div>
                    </div>
                  )}
                  <input
                    id="prepDocInput"
                    type="file"
                    accept=".json,.md,.markdown,.txt"
                    hidden
                    onChange={e => {
                      const file = e.target.files?.[0];
                      e.target.value = ''; // 允许重新上传同名文件
                      if (file) handleExternalDocFile(file);
                    }}
                  />
                </div>
                {/* 也支持直接粘贴 */}
                <textarea
                  value={externalDocText}
                  onChange={e => {
                    setExternalDocText(e.target.value);
                    if (e.target.value.trim()) setExternalDocFileName('粘贴文本');
                    else setExternalDocFileName('');
                  }}
                  placeholder="或者直接粘贴文档内容到此处（支持 JSON / Markdown / 纯文本）..."
                  rows={3}
                  style={{
                    width: '100%', background: CARD, border: `1px solid ${BORDER}`,
                    color: '#fff', padding: 10, borderRadius: 8, fontSize: 12, resize: 'vertical',
                    fontFamily: 'monospace', boxSizing: 'border-box',
                  }}
                />
                {/* 解析摘要反馈 */}
                {parsedSummary && (
                  <div style={{
                    marginTop: 8, padding: 10, background: 'rgba(0,240,255,0.04)',
                    border: `1px solid ${CYAN}30`, borderRadius: 6, fontSize: 11, color: '#ccc',
                    lineHeight: 1.6,
                  }}>
                    <div style={{ color: CYAN, fontWeight: 600, marginBottom: 4 }}>📊 解析摘要</div>
                    {parsedSummary}
                  </div>
                )}
              </div>

              {/* Step 2: 简历内容 */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 8, color: CYAN }}>
                  Step 2 — 简历内容 <span style={{ fontSize: 11, color: DIM, fontWeight: 400 }}>（可选，填写可获得更精准的题目匹配）</span>
                </label>
                <textarea
                  value={resumeText}
                  onChange={e => setResumeText(e.target.value)}
                  placeholder="粘贴简历内容，或拖拽文件到下方..."
                  rows={5}
                  style={{
                    width: '100%', background: CARD, border: `1px solid ${BORDER}`,
                    color: '#fff', padding: 10, borderRadius: 8, fontSize: 13, resize: 'vertical',
                    fontFamily: 'monospace', boxSizing: 'border-box',
                  }}
                />
                <div
                  onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingResume(true); }}
                  onDragLeave={e => {
                    e.preventDefault(); e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const { clientX, clientY } = e;
                    if (clientX <= rect.left || clientX >= rect.right || clientY <= rect.top || clientY >= rect.bottom) {
                      setIsDraggingResume(false);
                    }
                  }}
                  onDrop={e => {
                    e.preventDefault(); e.stopPropagation(); setIsDraggingResume(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) processFile(file);
                  }}
                  style={{
                    border: `1px dashed ${isDraggingResume ? CYAN : BORDER}`,
                    borderRadius: 8, padding: 12, textAlign: 'center', marginBottom: 8,
                    color: DIM, fontSize: 12, cursor: 'pointer',
                    background: isDraggingResume ? 'rgba(0,240,255,0.05)' : 'transparent',
                    transition: 'border-color 0.2s',
                  }}
                  onClick={() => document.getElementById('resumeFileInputForPrep')?.click()}
                >
                  📎 拖拽简历文件（PDF/DOCX/图片/TXT/MD）或点击上传
                  <input
                    id="resumeFileInputForPrep"
                    type="file"
                    accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt,.md"
                    hidden
                    onChange={handleFileUpload}
                  />
                </div>
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

              {/* 文档解析提示 */}
              {externalDocText && (
                <div style={{
                  marginBottom: 16, padding: 10, background: 'rgba(0,240,255,0.04)',
                  border: `1px solid ${CYAN}30`, borderRadius: 8, fontSize: 11, color: DIM,
                  lineHeight: 1.6,
                }}>
                  📋 文档将交由后端 LLM 自动解析：提取预测题目、Gap 清单、JD 核心意图等关键信息。
                  解析结果用于驱动面试 Agent 针对你的弱项出题。
                </div>
              )}

              {/* 提交 */}
              <button
                onClick={handleStartFromExternalDoc}
                disabled={isImportingDoc || !externalDocText.trim()}
                style={{
                  width: '100%', padding: '14px 0',
                  background: (externalDocText.trim() && !isImportingDoc) ? CYAN : DIM,
                  color: externalDocText.trim() ? '#000' : '#666',
                  border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                  cursor: externalDocText.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                {isImportingDoc ? '⏳ 解析文档并启动面试...' : '🚀 导入文档并开始面试'}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* ═══ analyzing ═══ */}
      {stage === 'analyzing' && (
        <AnalyzingProgress isPrepDriven={isPrepDriven || roastMode === 'prep'} />
      )}

      {/* ═══ interviewing ═══ */}
      {stage === 'interviewing' && currentQuestion && (
        <div className="stage-card interview-stage">
          <div className="interview-progress" style={{ textAlign: 'center' }}>
            <span style={{ color: CYAN, fontSize: 14, fontFamily: 'monospace', fontWeight: 700 }}>
              📝 {answers.length} / {TARGET_QUESTIONS}
            </span>
          </div>

          <div className="current-question">
            <span className="question-category">[{currentQuestion.category}]</span>
            <h3 style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.7, maxHeight: 'none', overflow: 'visible' }}>
              {currentQuestion.text}
            </h3>
          </div>

          <div className="answer-section">
            <textarea className="answer-input" value={currentAnswer}
              onChange={e => setCurrentAnswer(e.target.value)}
              placeholder="请输入你的回答..." rows={6} disabled={isLoading}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmitAnswer(); }} />
            {isLoading ? (
              <EvaluationProgress />
            ) : (
              <button className="submit-btn" onClick={handleSubmitAnswer}
                disabled={!currentAnswer.trim() || isLoading}>
                提交回答 (Ctrl+Enter)
              </button>
            )}
          </div>

          {answers.length > 0 && (
            <div className="answered-questions">
              <h4>已回答问题</h4>
              <div className="answers-list">
                {answers.map((a, i) => (
                  <div key={a.questionId} className="answered-item">
                    <span className="q-badge">Q{i + 1}</span>
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
                  onClick={handleBackToPrep}
                  title="将诊断暴露的薄弱项反馈到面试准备文档，更新 Gap 清单并生成新题"
                  style={{
                    background: `linear-gradient(135deg, ${MAGENTA}30, ${MAGENTA}10)`,
                    border: `2px solid ${MAGENTA}`, color: MAGENTA,
                    padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', animation: 'pulse 2s ease-in-out infinite',
                  }}
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
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="export-btn" onClick={handleSaveDiagnosis}
                  style={{ background: `${GREEN}20`, borderColor: GREEN, color: GREEN, fontSize: 11, padding: '6px 12px' }}>💾 保存</button>
                <button className="export-btn" onClick={() => exportDiagnosisToJSON(diagnosis, answers, difficulty)}
                  style={{ fontSize: 11, padding: '6px 12px' }}>📄 JSON</button>
                <button className="export-btn" onClick={() => exportDiagnosisToWord(diagnosis, answers, difficulty)}
                  style={{ fontSize: 11, padding: '6px 12px' }}>📝 Word</button>
                <button className="restart-btn-small" onClick={handleRestart}
                  style={{ fontSize: 11, padding: '6px 12px' }}>🔄 重新开始</button>
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

      {/* ── 导入确认对话框 ── */}
      {importConfirmPrep && (
        <div
          onClick={() => { setImportConfirmPrep(null); setDialogResumeText(''); setDialogResumeFile(''); }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
            overflow: 'auto',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0a0e14', border: `1px solid ${GREEN}`,
              borderRadius: 12, padding: 24, maxWidth: 540, width: '95%',
              maxHeight: '90vh', overflow: 'auto',
              boxShadow: `0 0 30px ${GREEN}40`,
            }}
          >
            <h3 style={{ margin: '0 0 16px', color: GREEN, fontSize: 16 }}>
              📥 确认导入面试准备文档
            </h3>
            <div style={{
              background: 'rgba(34,255,34,0.05)', border: `1px solid ${GREEN}30`,
              borderRadius: 8, padding: 14, marginBottom: 16,
            }}>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: 8, fontSize: 14 }}>
                📋 {importConfirmPrep.meta.role_name} @ {importConfirmPrep.meta.company_name || '未知公司'}
              </div>
              <div style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
                <div>📅 生成于：{new Date(importConfirmPrep.meta.generated_at).toLocaleString('zh-CN')}</div>
                <div>🎯 方向：{importConfirmPrep.meta.direction === 'E' ? 'AI产品' : 'AI全栈开发'}</div>
                <div>📊 难度：{importConfirmPrep.meta.difficulty}</div>
                <div>💾 保存于：{new Date(importConfirmPrep.savedAt).toLocaleDateString('zh-CN')}</div>
              </div>
            </div>
            <p style={{ color: '#ccc', fontSize: 13, lineHeight: 1.6, margin: '0 0 16px' }}>
              确认使用此文档启动针对性面试？系统将基于该文档的预测题库和 Gap 清单出题。
            </p>

            {/* ── 简历导入区（可选）── */}
            <div style={{
              background: 'rgba(0,240,255,0.03)', border: `1px solid ${CYAN}25`,
              borderRadius: 10, padding: 16, marginBottom: 16,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: CYAN }}>
                  📄 是否导入简历？<span style={{ fontSize: 11, color: DIM, fontWeight: 400 }}>（可选，可提升题目匹配精准度）</span>
                </label>
                {dialogResumeText && (
                  <button
                    onClick={() => { setDialogResumeText(''); setDialogResumeFile(''); }}
                    style={{
                      padding: '2px 8px', background: 'transparent', border: `1px solid ${DIM}`,
                      color: DIM, borderRadius: 4, fontSize: 10, cursor: 'pointer',
                    }}
                  >
                    清除
                  </button>
                )}
              </div>
              <textarea
                value={dialogResumeText}
                onChange={e => { setDialogResumeText(e.target.value); if (e.target.value.trim()) setDialogResumeFile('粘贴文本'); else setDialogResumeFile(''); }}
                placeholder="粘贴简历内容（可选）..."
                rows={3}
                style={{
                  width: '100%', background: CARD, border: `1px solid ${BORDER}`,
                  color: '#fff', padding: 10, borderRadius: 8, fontSize: 12, resize: 'vertical',
                  fontFamily: 'monospace', boxSizing: 'border-box',
                }}
              />
              <div
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingDialogResume(true); }}
                onDragLeave={e => { e.preventDefault(); e.stopPropagation(); setIsDraggingDialogResume(false); }}
                onDrop={e => {
                  e.preventDefault(); e.stopPropagation(); setIsDraggingDialogResume(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) {
                    processFile(file).then(text => {
                      setDialogResumeText(text);
                      setDialogResumeFile(file.name);
                    });
                  }
                }}
                style={{
                  border: `1px dashed ${isDraggingDialogResume ? CYAN : dialogResumeText ? GREEN : BORDER}`,
                  borderRadius: 8, padding: 8, textAlign: 'center', marginTop: 8,
                  color: DIM, fontSize: 11, cursor: 'pointer',
                  background: isDraggingDialogResume ? 'rgba(0,240,255,0.05)' : dialogResumeText ? 'rgba(34,255,34,0.03)' : 'transparent',
                  transition: 'border-color 0.2s',
                }}
                onClick={() => document.getElementById('dialogResumeFileInput')?.click()}
              >
                {dialogResumeText ? (
                  <span style={{ color: GREEN }}>✅ 已加载：{dialogResumeFile}（{dialogResumeText.length.toLocaleString()} 字符）</span>
                ) : (
                  <span>📎 拖拽简历文件（PDF/DOCX/图片/TXT）或点击上传 — 可跳过</span>
                )}
                <input
                  id="dialogResumeFileInput"
                  type="file"
                  accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt,.md"
                  hidden
                  onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) {
                      processFile(file).then(text => {
                        setDialogResumeText(text);
                        setDialogResumeFile(file.name);
                      });
                    }
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setImportConfirmPrep(null); setDialogResumeText(''); setDialogResumeFile(''); }}
                style={{
                  padding: '8px 16px', background: 'transparent',
                  border: `1px solid ${DIM}`, color: DIM,
                  borderRadius: 6, fontSize: 13, cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                onClick={() => {
                  const resumeToUse = dialogResumeText.trim();
                  setDialogResumeText('');
                  setDialogResumeFile('');
                  setImportConfirmPrep(null);
                  handleUseSavedPrep(importConfirmPrep, resumeToUse);
                }}
                disabled={isLoading}
                style={{
                  padding: '8px 16px', background: GREEN, border: 'none',
                  color: '#000', borderRadius: 6, fontSize: 13, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {isLoading ? '⏳ 启动中...' : dialogResumeText.trim() ? '✅ 导入简历并开始' : '⏭ 跳过简历，直接开始'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 查看面试准备文档模态框 ── */}
      {viewingPrep && (
        <div
          onClick={() => setViewingPrep(null)}
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
                  {viewingPrep.meta.role_name} @ {viewingPrep.meta.company_name || '未知公司'}
                </div>
              </div>
              <button
                onClick={() => setViewingPrep(null)}
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
                <div><strong style={{ color: CYAN }}>岗位：</strong>{viewingPrep.meta.role_name}</div>
                <div><strong style={{ color: CYAN }}>公司：</strong>{viewingPrep.meta.company_name || '未指定'}</div>
                <div><strong style={{ color: CYAN }}>方向：</strong>{viewingPrep.meta.direction === 'E' ? 'AI产品' : 'AI全栈开发'}</div>
                <div><strong style={{ color: CYAN }}>难度：</strong>{viewingPrep.meta.difficulty}</div>
                <div><strong style={{ color: CYAN }}>生成时间：</strong>{viewingPrep.meta.generated_at}</div>
              </div>

              {/* 公司调研 */}
              {viewingPrep.company_research && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>一、公司调研</h4>
                  <div style={{ fontSize: 12, color: '#ddd', lineHeight: 1.7, marginBottom: 8 }}>
                    <strong>公司概况：</strong>{viewingPrep.company_research.company_overview || '暂无'}
                  </div>
                  {viewingPrep.company_research.key_focus_areas && viewingPrep.company_research.key_focus_areas.length > 0 && (
                    <div style={{ fontSize: 12, color: '#ddd', marginBottom: 8 }}>
                      <strong>重点关注：</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {viewingPrep.company_research.key_focus_areas.map((a, i) => <li key={i}>{a}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* JD 分析 */}
              {viewingPrep.jd_analysis && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>二、JD 分析</h4>
                  {viewingPrep.jd_analysis.core_requirements && viewingPrep.jd_analysis.core_requirements.length > 0 && (
                    <div style={{ fontSize: 12, color: '#ddd', marginBottom: 8 }}>
                      <strong>核心要求：</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {viewingPrep.jd_analysis.core_requirements.map((r, i) => <li key={i}>{r}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 自我介绍 */}
              {viewingPrep.self_intro && viewingPrep.self_intro.script && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>三、自我介绍（{viewingPrep.self_intro.duration_seconds || 90}秒）</h4>
                  <div style={{
                    background: 'rgba(0,240,255,0.04)', border: `1px solid ${CYAN}30`,
                    borderRadius: 6, padding: 10, fontSize: 12, color: '#ddd',
                    lineHeight: 1.7, whiteSpace: 'pre-wrap', fontStyle: 'italic',
                  }}>
                    {viewingPrep.self_intro.script}
                  </div>
                </div>
              )}

              {/* 高频题 */}
              {viewingPrep.predicted_questions && viewingPrep.predicted_questions.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>四、高频题预测（{viewingPrep.predicted_questions.length}题）</h4>
                  <ol style={{ fontSize: 12, color: '#ddd', lineHeight: 1.7, paddingLeft: 20 }}>
                    {viewingPrep.predicted_questions.slice(0, 10).map((q, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {q.question}
                        {q.category && <span style={{ color: DIM, marginLeft: 6 }}>[{q.category}]</span>}
                      </li>
                    ))}
                    {viewingPrep.predicted_questions.length > 10 && (
                      <li style={{ color: DIM, fontStyle: 'italic' }}>
                        ...还有 {viewingPrep.predicted_questions.length - 10} 题
                      </li>
                    )}
                  </ol>
                </div>
              )}

              {/* Gap 分析 */}
              {viewingPrep.gap_analysis && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>五、差距分析</h4>
                  {viewingPrep.gap_analysis.weaknesses && viewingPrep.gap_analysis.weaknesses.length > 0 && (
                    <div style={{ fontSize: 12, color: '#ddd', marginBottom: 8 }}>
                      <strong style={{ color: '#ff8888' }}>薄弱点：</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {viewingPrep.gap_analysis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    </div>
                  )}
                  {viewingPrep.gap_analysis.mitigation_strategies && viewingPrep.gap_analysis.mitigation_strategies.length > 0 && (
                    <div style={{ fontSize: 12, color: '#ddd' }}>
                      <strong style={{ color: GREEN }}>应对策略：</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {viewingPrep.gap_analysis.mitigation_strategies.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* 反问清单 */}
              {viewingPrep.ask_back_questions && viewingPrep.ask_back_questions.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>六、反问问题清单</h4>
                  <ol style={{ fontSize: 12, color: '#ddd', lineHeight: 1.7, paddingLeft: 20 }}>
                    {viewingPrep.ask_back_questions.map((q, i) => <li key={i} style={{ marginBottom: 4 }}>{q}</li>)}
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
                onClick={() => { setViewingPrep(null); setImportConfirmPrep(viewingPrep); }}
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
      )}

      {/* ── 查看诊断报告弹窗 ── */}
      {viewingDiagnosis && (
        <div
          onClick={() => setViewingDiagnosis(null)}
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
              padding: '16px 20px', borderBottom: `1px solid ${BORDER}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <h3 style={{ margin: 0, color: CYAN, fontSize: 16 }}>🧠 认知诊断报告</h3>
                <div style={{ fontSize: 12, color: DIM, marginTop: 2 }}>
                  {viewingDiagnosis.isPrepDriven ? '🎯 准备驱动' : '🤖 Agent模式'} · {viewingDiagnosis.questionCount}题 · 保存于 {new Date(viewingDiagnosis.savedAt).toLocaleString('zh-CN')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => exportDiagnosisToJSON(viewingDiagnosis.diagnosis, viewingDiagnosis.answers, viewingDiagnosis.difficulty)} style={{
                  padding: '4px 10px', background: 'transparent', border: `1px solid ${CYAN}`,
                  color: CYAN, borderRadius: 6, fontSize: 10, cursor: 'pointer',
                }}>📄 JSON</button>
                <button onClick={() => exportDiagnosisToWord(viewingDiagnosis.diagnosis, viewingDiagnosis.answers, viewingDiagnosis.difficulty)} style={{
                  padding: '4px 10px', background: 'transparent', border: `1px solid ${GREEN}`,
                  color: GREEN, borderRadius: 6, fontSize: 10, cursor: 'pointer',
                }}>📝 Word</button>
                <button onClick={() => setViewingDiagnosis(null)} style={{
                  padding: '4px 12px', background: 'transparent', border: `1px solid ${DIM}`,
                  color: DIM, borderRadius: 6, fontSize: 11, cursor: 'pointer',
                }}>✕ 关闭</button>
              </div>
            </div>

            {/* 内容 */}
            <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
              {/* 总分 */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
                <ScoreBox label="总分" value={viewingDiagnosis.diagnosis.overall_score} max={100} color={CYAN} />
                <ScoreBox label="逻辑" value={viewingDiagnosis.diagnosis.logic_score} max={10} color={MAGENTA} />
                <ScoreBox label="表达" value={viewingDiagnosis.diagnosis.communication_score} max={10} color={YELLOW} />
                <ScoreBox label="深度" value={viewingDiagnosis.diagnosis.depth_score} max={10} color={GREEN} />
              </div>

              {/* 优势 / 短板 / 改进 */}
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 180, border: `1px solid ${GREEN}40`, padding: 12, background: 'rgba(34,255,34,0.03)', borderRadius: 8 }}>
                  <h4 style={{ color: GREEN, fontSize: 13, margin: '0 0 8px' }}>✅ 优势</h4>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#ccc', lineHeight: 1.7 }}>
                    {viewingDiagnosis.diagnosis.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div style={{ flex: 1, minWidth: 180, border: `1px solid ${RED}40`, padding: 12, background: 'rgba(255,68,68,0.03)', borderRadius: 8 }}>
                  <h4 style={{ color: RED, fontSize: 13, margin: '0 0 8px' }}>❌ 短板</h4>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#ccc', lineHeight: 1.7 }}>
                    {viewingDiagnosis.diagnosis.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>

              {/* 改进路径 */}
              <div style={{ border: `1px solid ${YELLOW}40`, padding: 12, background: 'rgba(255,255,0,0.03)', borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ color: YELLOW, fontSize: 13, margin: '0 0 8px' }}>💡 改进路径</h4>
                <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#ccc', lineHeight: 1.8 }}>
                  {viewingDiagnosis.diagnosis.improvement_plan.map((s, i) => <li key={i}>{s}</li>)}
                </ol>
              </div>

              {/* 知识覆盖 */}
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ color: CYAN, fontSize: 13, margin: '0 0 8px' }}>📋 知识覆盖</h4>
                {viewingDiagnosis.diagnosis.knowledge_map.map(kp => (
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
                {viewingDiagnosis.answers.map((a, i) => (
                  <div key={i} style={{ marginBottom: 10, padding: 8, border: '1px solid #222', borderRadius: 4, background: '#0d0d0d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 11, color: '#fff', fontWeight: 600 }}>Q{i + 1} · {a.evaluation.score}分</span>
                      <span style={{ fontSize: 10, color: DIM }}>{a.questionText.slice(0, 60)}...</span>
                    </div>
                    <div style={{ fontSize: 11, color: CYAN }}>💬 {a.evaluation.comment}</div>
                  </div>
                ))}
              </div>

              {/* 闭环操作 */}
              {viewingDiagnosis.isPrepDriven && (
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
                      setViewingDiagnosis(null);
                      navigate('/prep', {
                        state: {
                          prepId: viewingDiagnosis.prepId,
                          sessionId: viewingDiagnosis.sessionId,
                          diagnosisCompleted: true,
                          diagnosisData: viewingDiagnosis.diagnosis, // 携带完整诊断数据
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
                  {!viewingDiagnosis.prepId && (
                    <p style={{ color: DIM, fontSize: 10, margin: '8px 0 0' }}>
                      ⚠ 此诊断缺少关联的 prepId，无法定位面试准备文档。
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Toast 提示 ── */}
      {toast && (
        <div
          style={{
            position: 'fixed', top: 20, right: 20, zIndex: 2000,
            padding: '12px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: toast.type === 'success' ? 'rgba(34,255,34,0.15)' :
                        toast.type === 'error' ? 'rgba(255,80,80,0.15)' : 'rgba(0,240,255,0.15)',
            border: `1px solid ${toast.type === 'success' ? GREEN :
                                  toast.type === 'error' ? '#ff5050' : CYAN}`,
            color: toast.type === 'success' ? GREEN :
                   toast.type === 'error' ? '#ff8888' : CYAN,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            animation: 'fadeIn 0.3s ease',
            maxWidth: 400,
          }}
        >
          {toast.message}
        </div>
      )}

    </div>
  );
};

export default ResumeRoast;
