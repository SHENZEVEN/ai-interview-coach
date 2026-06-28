import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
  DIFFICULTY_CONFIG,
  AnswerRecord,
  DifficultyLevel,
} from '../services/resumeRoastService';
import QuickPractice from './QuickPractice';
import ReportStage from './roast/ReportStage';
import ImportConfirmDialog from './roast/ImportConfirmDialog';
import ViewPrepModal from './roast/ViewPrepModal';
import ViewDiagnosisModal from './roast/ViewDiagnosisModal';
import '../styles/ResumeRoast.css';

type RoastMode = 'light' | 'agent' | 'prep';

// ── 常量 ──
import { CYAN, MAGENTA, GREEN, YELLOW, RED, DIM, BG, CARD, BORDER } from '../theme/colors';
const MIN_QUESTIONS = 6;   // 最少题数
const MAX_QUESTIONS = 10;  // 最多题数

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
    mode?: string;
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
          // 验证后端 session 是否仍然有效
          keepSessionAlive(parsed.sessionId).then((res) => {
            if (res.success) {
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
            } else {
              // session 已过期，清除旧状态
              console.warn('面试会话已过期，清除旧状态');
            }
            localStorage.removeItem('resume-roast-state');
          }).catch(() => {
            // keep-alive 失败，session 不存在
            console.warn('面试会话已失效，清除旧状态');
            localStorage.removeItem('resume-roast-state');
          });
          return; // 跳过默认的 prepState 处理
        }
      } catch (e) {
        console.error('恢复面试状态失败:', e);
      }
    }

    // ── 处理 Prep 上下文 ──
    if (prepState?.sessionId && prepState?.firstQuestion) {
      // 直接进入面试（有 sessionId 和 firstQuestion）
      setSessionId(prepState.sessionId ?? null);
      setCurrentQuestion(prepState.firstQuestion ?? null);
      setPrepId(prepState.prepId || null);
      setIsPrepDriven(prepState.isPrepDriven || true);
      setRoastMode('prep');
      setQuestionCount(1);
      setAnswers([]);
      setCurrentAnswer('');
      setDiagnosis(null);
      setStage('interviewing');
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
      window.history.replaceState({}, document.title);
    } else if (prepState?.mode === 'prep-select' && prepState?.prepId) {
      // 进入准备驱动模式选择页面（不直接开始面试）
      // 从 localStorage 读取准备文档数据
      const savedPrepData = localStorage.getItem('prep-document-for-roast');
      if (savedPrepData) {
        try {
          const parsed = JSON.parse(savedPrepData);
          setPrepId(parsed.prepId || prepState.prepId);
          setIsPrepDriven(true);
          setRoastMode('prep');
          if (parsed.resumeText) {
            setResumeText(parsed.resumeText);
          }
          // 自动进入表单模式（已有准备文档，只需选择简历）
          setPrepImportStage('form');
        } catch (e) {
          console.error('读取准备文档数据失败:', e);
        }
      }
      window.history.replaceState({}, document.title);
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
        prep_data: prep,
      });

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
      const { trimmed } = saveDiagnosisToStorage({
        prepId: prepId || undefined,
        sessionId: sessionId || undefined,
        isPrepDriven,
        difficulty,
        questionCount: answers.length,
        diagnosis,
        answers: answers.map(a => ({
          questionId: a.questionId,
          questionText: a.questionText,
          answer: a.answer,
          evaluation: a.evaluation,
        })),
      });
      setSavedDiagnoses(getDiagnoses());
      const msg = trimmed
        ? '✅ 诊断报告已保存（旧报告已达上限，最早的已被移除）'
        : '✅ 诊断报告已保存（可在准备驱动页查看）';
      showToast(msg, 'success');
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
          <p className="stage-hint">支持 PDF、DOCX、图片、TXT、MD 格式</p>
          <div className={`upload-area ${isDraggingResume ? 'dragover' : ''}`}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <textarea className="resume-input" value={resumeText}
              onChange={e => setResumeText(e.target.value)}
              placeholder="粘贴简历内容到此处，或直接拖拽简历文件到此处..." disabled={isLoading} />
            {isDraggingResume && <div className="drop-overlay"><span className="drop-icon">📄</span><span className="drop-text">松开上传简历</span></div>}
          </div>
          {/* 文件上传区域 */}
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
              borderRadius: 8, padding: 12, textAlign: 'center', marginTop: 8, marginBottom: 8,
              color: DIM, fontSize: 12, cursor: 'pointer',
              background: isDraggingResume ? 'rgba(0,240,255,0.05)' : 'transparent',
              transition: 'border-color 0.2s',
            }}
            onClick={() => document.getElementById('resumeFileInputAgent')?.click()}
          >
            📎 拖拽简历文件（PDF/DOCX/图片/TXT/MD）或点击上传
            <input
              id="resumeFileInputAgent"
              type="file"
              accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt,.md"
              hidden
              onChange={handleFileUpload}
            />
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
              <input type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt,.md"
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
                              保存于 {new Date(prep.savedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
                            {d.isPrepDriven ? '🎯准备驱动' : '🤖Agent'} · {new Date(d.savedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
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
                
                {/* 如果已有准备文档（从 InterviewPrep 跳转过来），显示已选择的文档 */}
                {prepId && !externalDocText.trim() && (
                  <div style={{
                    padding: '12px 16px', background: 'rgba(34,255,34,0.04)',
                    border: `1px solid ${GREEN}`, borderRadius: 8, marginBottom: 8,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ color: GREEN, fontSize: 13, fontWeight: 600 }}>✅ 已选择面试准备文档</div>
                      <div style={{ color: DIM, fontSize: 11, marginTop: 2 }}>
                        从面试准备页面跳转，文档已就绪
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setPrepId(null);
                        setIsPrepDriven(false);
                        setRoastMode('prep');
                      }}
                      style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${RED}`, borderRadius: 4, fontSize: 11, color: RED, cursor: 'pointer' }}
                    >
                      更换文档
                    </button>
                  </div>
                )}
                
                {/* 文档上传区域（仅在没有 prepId 或已选择更换时显示） */}
                {!prepId && (
                  <>
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
                          e.target.value = '';
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
                  </>
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
              {prepId ? (
                // 已有准备文档（从 InterviewPrep 跳转），直接开始面试
                <button
                  onClick={async () => {
                    // 从 localStorage 读取完整的准备文档数据
                    const savedPrepData = localStorage.getItem('prep-document-for-roast');
                    if (!savedPrepData) {
                      showToast('❌ 未找到准备文档数据，请返回面试准备页面重新生成', 'error');
                      return;
                    }
                    
                    try {
                      const parsed = JSON.parse(savedPrepData);
                      const prepData = parsed.prepData;
                      if (!prepData) {
                        showToast('❌ 准备文档数据格式错误', 'error');
                        return;
                      }
                      
                      setIsLoading(true);
                      // 直接调用 startFromPrep API
                      const result = await startFromPrep({
                        prep_id: prepData.meta.prep_id,
                        resume_text: resumeText.trim() || parsed.resumeText || '',
                        prep_data: prepData,
                      });
                      
                      setSessionId(result.session_id);
                      setCurrentQuestion(result.first_question);
                      setIsPrepDriven(true);
                      setQuestionCount(1);
                      setAnswers([]);
                      setCurrentAnswer('');
                      setDiagnosis(null);
                      if (resumeText.trim()) {
                        setResumeText(resumeText.trim());
                      }
                      
                      await delay(400);
                      setStage('interviewing');
                      
                      // 保存面试状态
                      localStorage.setItem('resume-roast-state', JSON.stringify({
                        stage: 'interviewing',
                        sessionId: result.session_id,
                        currentQuestion: result.first_question,
                        currentAnswer: '',
                        answers: [],
                        questionCount: 1,
                        prepId: prepData.meta.prep_id,
                        isPrepDriven: true,
                        roastMode: 'prep',
                        resumeText: resumeText.trim() || parsed.resumeText || '',
                        jdText: '',
                        timestamp: Date.now(),
                      }));
                      
                      showToast('✅ 面试已启动', 'success');
                    } catch (e) {
                      showToast(`❌ 启动失败: ${e instanceof Error ? e.message : '未知错误'}`, 'error');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                  style={{
                    width: '100%', padding: '14px 0',
                    background: isLoading ? DIM : CYAN,
                    color: isLoading ? '#666' : '#000',
                    border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isLoading ? '⏳ 启动面试...' : '🚀 开始准备驱动面试'}
                </button>
              ) : (
                // 普通外部文档导入流程
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
              )}
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
              📝 第 {answers.length + 1} 题
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
        <ReportStage
          diagnosis={diagnosis}
          answers={answers}
          isPrepDriven={isPrepDriven}
          prepId={prepId}
          parsedSummary={parsedSummary}
          difficulty={difficulty}
          onSaveDiagnosis={handleSaveDiagnosis}
          onBackToPrep={handleBackToPrep}
          onRestart={handleRestart}
        />
      )}

      {/* ── 导入确认对话框 ── */}
      {importConfirmPrep && (
        <ImportConfirmDialog
          prep={importConfirmPrep}
          isLoading={isLoading}
          onConfirm={handleUseSavedPrep}
          onCancel={() => setImportConfirmPrep(null)}
        />
      )}

      {/* ── 查看面试准备文档模态框 ── */}
      {viewingPrep && (
        <ViewPrepModal
          prep={viewingPrep}
          isLoading={isLoading}
          onClose={() => setViewingPrep(null)}
          onUsePrep={(prep) => setImportConfirmPrep(prep)}
        />
      )}

      {/* ── 查看诊断报告弹窗 ── */}
      {viewingDiagnosis && (
        <ViewDiagnosisModal
          diagnosis={viewingDiagnosis}
          onClose={() => setViewingDiagnosis(null)}
        />
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
