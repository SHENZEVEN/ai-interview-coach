import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  generatePrepStream,
  refinePrep,
  getPrep,
  PrepDocument,
  ROLE_DIRECTIONS,
  DIFFICULTY_OPTIONS,
  PredictedQuestion,
} from '../services/prepService';
import { savePrep, getPreps as getSavedPreps, exportPrepToJSON, exportPrepToMarkdown } from '../services/prepStorage';
import { getDiagnoses, type SavedDiagnosis } from '../services/diagnosisStorage';
import { parseDocument } from '../utils/documentParser';
import { saveHistoryRecord } from '../utils/storage';
import { v4 as uuidv4 } from 'uuid';
import { API_BASE } from '../services/aiService';
import { CYAN, MAGENTA, GREEN, YELLOW, RED, DIM, BG, CARD, BORDER } from '../theme/colors';
import ResumeMatcher from './ResumeMatcher';

// ── 文件导入拖拽区（独立组件，避免渲染内嵌套 hooks）──
function FileDropZone({ label, accept, onFile, isImported, hint }: {
  label: string; accept: string; onFile: (file: File) => void; isImported: boolean; hint?: string;
}) {
  const [dragover, setDragover] = useState(false);
  const inputId = `file-${label.replace(/[^a-zA-Z0-9]/g, '')}`;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragover(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragover(true); }}
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragover(true); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragover(false); }}
      onDrop={handleDrop}
      onClick={() => document.getElementById(inputId)?.click()}
      style={{
        border: `1.5px dashed ${dragover ? CYAN : isImported ? `${GREEN}80` : `${BORDER}`}`,
        borderRadius: 10,
        padding: isImported ? '8px 14px' : '14px 14px',
        background: dragover ? 'rgba(0,240,255,0.06)' : isImported ? 'rgba(34,255,34,0.04)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'center' as const,
        transition: 'all 0.2s',
        minHeight: isImported ? undefined : 42,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span style={{ fontSize: 12, color: isImported ? GREEN : dragover ? CYAN : DIM, fontWeight: isImported ? 600 : 400 }}>
        {isImported ? `✅ ${label} (已导入)` : dragover ? `📥 释放文件` : `📂 ${label}`}
      </span>
      {hint && !isImported && !dragover && (
        <span style={{ fontSize: 10, color: DIM, marginLeft: 8 }}>{hint}</span>
      )}
      <input
        id={inputId}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

type Stage = 'input' | 'generating' | 'preview' | 'refining';
type PageMode = 'prep' | 'match';

const InterviewPrep = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as { prepId?: string; sessionId?: string; diagnosisCompleted?: boolean; diagnosisData?: any } | null;

  // ── 处理从诊断报告页跳转的闭环 ──
  useEffect(() => {
    if (navState?.diagnosisCompleted && navState?.diagnosisData) {
      setSavedDiagnosisData(navState.diagnosisData);
      setImportedDiagnosisSource('saved');
      setPageMode('prep');
      if (navState.prepId) {
        const savedPreps = getSavedPreps();
        const localPrep = savedPreps.find(p => p.meta.prep_id === navState.prepId);
        if (localPrep) {
          setPrep(localPrep as any);
          setImportedPrepSource('saved');
          setStage('input'); // 停在 input，让闭环面板显示
        } else {
          getPrep(navState.prepId).then(p => {
            setPrep(p);
            setImportedPrepSource('saved');
            setStage('input');
          }).catch(() => {
            setError('面试准备文档未找到，请从闭环面板选择或导入文档');
            setStage('input');
          });
        }
      } else {
        setStage('input');
      }
      window.history.replaceState({}, document.title);
    }
  }, []);

  // ── 输入状态 ──
  const [stage, setStage] = useState<Stage>('input');
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [prepMode, setPrepMode] = useState<'rapid' | 'standard' | 'deep'>('standard');
  const [difficulty, setDifficulty] = useState('mid');

  // ── 状态持久化：恢复之前的生成状态 ──
  useEffect(() => {
    const savedState = localStorage.getItem('interview-prep-state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // 只恢复正在生成中的状态
        if (parsed.stage === 'generating' && parsed.resumeText) {
          setResumeText(parsed.resumeText);
          setJdText(parsed.jdText || '');
          setCompanyName(parsed.companyName || '');
          setRoleName(parsed.roleName || '');
          setDirection(parsed.direction || 'E');
          setDifficulty(parsed.difficulty || 'mid');
          setPrepMode(parsed.prepMode || 'standard');
          setStreamStatus(parsed.streamStatus || '🚀 正在连接服务器...');
          setStreamContent(parsed.streamContent || '');
          setStage('generating');
          // 清除保存的状态，避免重复恢复
          localStorage.removeItem('interview-prep-state');
        }
      } catch (e) {
        console.error('恢复状态失败:', e);
      }
    }
  }, []);

  // ── 逐题练习状态 ──
  const [practiceMode, setPracticeMode] = useState(false);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [practiceAnswer, setPracticeAnswer] = useState('');
  const [practiceResult, setPracticeResult] = useState<{score: number; comment: string} | null>(null);
  const [isPracticing, setIsPracticing] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [roleName, setRoleName] = useState('');
  const [direction, setDirection] = useState('E');
  const [isDraggingResume, setIsDraggingResume] = useState(false);
  const [isDraggingJd, setIsDraggingJd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── 模式切换：完整准备 / 简历匹配 ──
  const [pageMode, setPageMode] = useState<PageMode>('match');

  // ── 流式生成状态 ──
  const [streamStatus, setStreamStatus] = useState('');
  const [streamContent, setStreamContent] = useState('');
  const [streamProgress, setStreamProgress] = useState(5);

  // ── 结果状态 ──
  const [prep, setPrep] = useState<PrepDocument | null>(null);
  const [expandedSection, setExpandedSection] = useState<Set<string>>(new Set(['jd', 'questions', 'gap', 'askback']));
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedDiagnosisData, setSavedDiagnosisData] = useState<any>(null); // 从已保存诊断报告携带的诊断数据
  const [isStartingInterview, setIsStartingInterview] = useState(false);

  // ── 外部文件导入（闭环优化面板）──
  const [importedPrepSource, setImportedPrepSource] = useState<'saved' | 'file' | null>(null);
  const [importedPrepText, setImportedPrepText] = useState<string | null>(null);
  const [importedPrepFileName, setImportedPrepFileName] = useState('');
  const [importedDiagnosisSource, setImportedDiagnosisSource] = useState<'saved' | 'file' | null>(null);
  const [importedDiagnosisText, setImportedDiagnosisText] = useState<string | null>(null);
  const [importedDiagnosisFileName, setImportedDiagnosisFileName] = useState('');

  /** 校验是否为 PrepDocument JSON */
  const validatePrepJSON = (data: any): data is PrepDocument => {
    if (!data || typeof data !== 'object') return false;
    // 至少包含 meta 或 predicted_questions
    if (data.meta && (data.meta.prep_id || data.meta.company_name)) return true;
    if (Array.isArray(data.predicted_questions)) return true;
    return false;
  };

  /** 校验是否为诊断报告 JSON（兼容 SavedDiagnosis 封装格式和原始 CognitiveDiagnosis） */
  const validateAndUnwrapDiagnosis = (data: any): { valid: boolean; diagnosis?: any; sessionId?: string; prepId?: string } => {
    if (!data || typeof data !== 'object') return { valid: false };
    // 格式1：SavedDiagnosis 封装（应用导出的标准格式）→ diagnosis 嵌套在内
    if (data.diagnosis && typeof data.diagnosis === 'object' && typeof data.diagnosis.overall_score === 'number') {
      return { valid: true, diagnosis: data.diagnosis, sessionId: data.sessionId, prepId: data.prepId };
    }
    // 格式2：原始 CognitiveDiagnosis（顶层有 overall_score / weaknesses / knowledge_map）
    if (typeof data.overall_score === 'number') return { valid: true, diagnosis: data };
    if (Array.isArray(data.weaknesses)) return { valid: true, diagnosis: data };
    if (Array.isArray(data.knowledge_map)) return { valid: true, diagnosis: data };
    return { valid: false };
  };

  /** 导入外部准备文档 */
  const handlePrepFileImport = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['json', 'md', 'docx'].includes(ext || '')) {
      setError('仅支持 .json / .md / .docx 格式的准备文档');
      return;
    }
    setError(null);
    setImportedPrepFileName(file.name);
    try {
      if (ext === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!validatePrepJSON(data)) {
          setError('文件格式不符，请确认是面试准备文档（需包含 meta 或 predicted_questions）');
          return;
        }
        // 确保有基本 meta
        if (!data.meta) data.meta = {
          prep_id: `ext-${Date.now()}`,
          company_name: file.name.replace(/\.json$/i, ''),
          role_name: '导入文档',
          direction: 'E',
          direction_label: 'AI产品',
          difficulty: 'mid',
          prep_mode: 'standard',
          generated_at: new Date().toISOString(),
          has_web_search: false,
          source_count: 0,
        };
        if (!data.meta.prep_id) data.meta.prep_id = `ext-${Date.now()}`;
        if (!data.meta.company_name) data.meta.company_name = file.name.replace(/\.json$/i, '');
        setPrep(data as PrepDocument);
        setImportedPrepSource('file');
        setImportedPrepText(null);
        // 留在 input stage，等用户继续选诊断报告
      } else {
        // .md / .docx → 提取文本
        let text: string;
        if (ext === 'docx') {
          text = await parseDocument(file);
        } else {
          text = await file.text();
        }
        if (!text.trim()) {
          setError('文件内容为空');
          return;
        }
        setImportedPrepText(text);
        setImportedPrepSource('file');
        // 从文本中尝试提取基本 meta 信息（用于显示）
        const nameGuess = file.name.replace(/\.(md|docx)$/i, '');
        setPrep({
          meta: {
            prep_id: `ext-${Date.now()}`,
            company_name: nameGuess,
            role_name: '',
            direction: 'E', direction_label: 'AI产品/AI全栈',
            difficulty: 'mid', prep_mode: 'standard',
            generated_at: new Date().toISOString(),
            has_web_search: false, source_count: 0,
          },
        } as any);
        // 留在 input stage，等用户继续选诊断报告
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('JSON 解析失败，请检查文件格式');
      } else {
        setError(err instanceof Error ? err.message : '文件读取失败');
      }
    }
  };

  /** 导入外部诊断报告 */
  const handleDiagnosisFileImport = async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['json', 'md', 'docx'].includes(ext || '')) {
      setError('仅支持 .json / .md / .docx 格式的诊断报告');
      return;
    }
    setError(null);
    setImportedDiagnosisFileName(file.name);
    try {
      if (ext === 'json') {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = validateAndUnwrapDiagnosis(data);
        if (!result.valid) {
          setError('文件格式不符，请确认是诊断报告（支持应用导出的 .json 诊断文件或原始诊断数据）');
          return;
        }
        setSavedDiagnosisData(result.diagnosis);
        setSessionId(result.sessionId || data.session_id || data.sessionId || null);
        setImportedDiagnosisSource('file');
        setImportedDiagnosisText(null);
      } else {
        // .md / .docx → 提取文本
        let text: string;
        if (ext === 'docx') {
          text = await parseDocument(file);
        } else {
          text = await file.text();
        }
        if (!text.trim()) {
          setError('文件内容为空');
          return;
        }
        setImportedDiagnosisText(text);
        setSavedDiagnosisData({ _raw: true }); // 占位，让 Step 3 按钮显示
        setSessionId(null);
        setImportedDiagnosisSource('file');
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('JSON 解析失败，请检查文件格式');
      } else {
        setError(err instanceof Error ? err.message : '文件读取失败');
      }
    }
  };

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
    setStreamStatus('🚀 正在连接服务器...');
    setStreamContent('');
    setStage('generating');
    setImportedPrepSource(null);

    // 保存当前状态到 localStorage，以便页面刷新后恢复
    localStorage.setItem('interview-prep-state', JSON.stringify({
      stage: 'generating',
      resumeText,
      jdText,
      companyName,
      roleName,
      direction,
      difficulty,
      prepMode,
      streamStatus: '🚀 正在连接服务器...',
      streamContent: '',
      timestamp: Date.now(),
    }));

    try {
      const result = await generatePrepStream({
        resume_text: resumeText,
        jd_text: jdText || undefined,
        company_name: companyName,
        role_name: roleName,
        direction,
        difficulty,
        prep_mode: prepMode,
      }, (progress) => {
        setStreamStatus(progress.status);
        setStreamContent(progress.content);
        if (progress.progress !== undefined && progress.progress > 0) {
          setStreamProgress(progress.progress);
        }
        // 实时更新保存的状态
        const savedState = JSON.parse(localStorage.getItem('interview-prep-state') || '{}');
        localStorage.setItem('interview-prep-state', JSON.stringify({
          ...savedState,
          streamStatus: progress.status,
          streamContent: progress.content,
        }));
      });

      setPrep(result);
      setStage('preview');
      // 生成完成，清除保存的状态
      localStorage.removeItem('interview-prep-state');
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败');
      setStage('input');
      // 生成失败，清除保存的状态
      localStorage.removeItem('interview-prep-state');
    }
  };

  // ── 开始面试拷打（进入准备驱动模式）──
  const handleStartInterview = async () => {
    if (!prep || !prep.meta?.prep_id) {
      setError('面试准备文档无效');
      return;
    }
    try { savePrep(prep); } catch {}
    setIsStartingInterview(true);
    setError(null);
    try {
      // 保存准备文档数据到 localStorage，供 ResumeRoast 使用
      localStorage.setItem('prep-document-for-roast', JSON.stringify({
        prepId: prep.meta.prep_id,
        prepData: prep,
        resumeText: resumeText,
      }));
      // 导航到简历拷打页面，进入准备驱动模式（不直接开始面试）
      navigate('/roast', {
        state: {
          prepId: prep.meta.prep_id,
          isPrepDriven: true,
          mode: 'prep-select', // 进入准备驱动选择模式
        },
      });
      setIsStartingInterview(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动面试失败');
      setIsStartingInterview(false);
    }
  };

  // ── 闭环：用诊断更新面试准备（纯前端数据，不依赖后端 session）──
  const handleRefine = async () => {
    if (!prep) return;
    if (!savedDiagnosisData && !importedDiagnosisText) {
      setError('请先选择或导入诊断报告');
      return;
    }
    setStage('refining');
    setError(null);
    try {
      const reqPayload: any = {
        prep_id: prep.meta.prep_id,
        // 不传 session_id，直接用前端已有的完整数据
        prep_data: importedPrepSource === 'file' && importedPrepText ? undefined : (prep as any),
        prep_text: importedPrepSource === 'file' && importedPrepText ? importedPrepText : undefined,
        diagnosis_data: importedDiagnosisSource === 'file' && importedDiagnosisText ? undefined : savedDiagnosisData,
        diagnosis_text: importedDiagnosisSource === 'file' && importedDiagnosisText ? importedDiagnosisText : undefined,
      };
      const updated = await refinePrep(reqPayload);
      setPrep(updated);
      try { savePrep(updated); } catch {}
      // 清除闭环状态
      setSessionId(null);
      setSavedDiagnosisData(null);
      setImportedPrepSource(null);
      setImportedPrepText(null);
      setImportedPrepFileName('');
      setImportedDiagnosisSource(null);
      setImportedDiagnosisText(null);
      setImportedDiagnosisFileName('');
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
      setStage('input');
    }
  };

  // ── Section toggle ──
  const toggleSection = (key: string) => {
    const next = new Set(expandedSection);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedSection(next);
  };


  // ── 渲染辅助 ──

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
              style={{
                padding: '8px 20px', background: 'rgba(0,240,255,0.08)', color: CYAN,
                border: `1px solid ${CYAN}`, borderRadius: '8px 0 0 8px',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                minWidth: 100,
              }}
            >
              🔍 简历匹配
            </button>
            <button
              onClick={() => setPageMode('prep')}
              style={{
                padding: '8px 20px', background: 'transparent', color: DIM,
                border: `1px solid ${BORDER}`, borderRadius: '0 8px 8px 0',
                cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                minWidth: 100,
              }}
            >
              📋 完整准备
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
            onClick={() => setPageMode('match')}
            style={{
              padding: '8px 20px', background: (pageMode as PageMode) === 'match' ? 'rgba(0,240,255,0.08)' : 'transparent', color: (pageMode as PageMode) === 'match' ? CYAN : DIM,
              border: `1px solid ${(pageMode as PageMode) === 'match' ? CYAN : BORDER}`, borderRadius: '8px 0 0 8px',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              minWidth: 100,
            }}
          >
            🔍 简历匹配
          </button>
          <button
            onClick={() => setPageMode('prep')}
            style={{
              padding: '8px 20px', background: (pageMode as PageMode) === 'prep' ? 'rgba(0,240,255,0.08)' : 'transparent', color: (pageMode as PageMode) === 'prep' ? CYAN : DIM,
              border: `1px solid ${(pageMode as PageMode) === 'prep' ? CYAN : BORDER}`, borderRadius: '0 8px 8px 0',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              minWidth: 100,
            }}
          >
            📋 完整准备
          </button>
        </div>



        <h1 style={{ fontSize: 22, marginBottom: 8 }}>📋 面试准备</h1>
        <p style={{ color: DIM, fontSize: 13, marginBottom: 20 }}>
          对标 interview-prep skill — 生成个性化面试准备文档，再一键启动针对性面试拷打
        </p>

        {/* ── 闭环优化 — 两个独立卡片：准备文档 + 诊断报告（始终显示）── */}
        {(() => {
          const sp = getSavedPreps();
          const allDiags = getDiagnoses().filter(d => d.isPrepDriven);
          // 配套判断仅对已保存文档生效，文件导入不限配套
          const matchingDiags = importedPrepSource === 'file'
            ? allDiags  // 外部导入文档 → 显示全部已保存诊断
            : importedPrepSource === 'saved' && prep?.meta?.prep_id
              ? allDiags.filter(d => d.prepId === prep.meta.prep_id) // 已保存文档 → 只显示配套的
              : allDiags; // 未选择来源 → 显示全部

          return (
            <div style={{ display: 'flex', gap: 16, marginBottom: 4, flexWrap: 'wrap' }}>

              {/* ═══ 卡片 A：准备文档 ═══ */}
              <div style={{
                flex: '1 1 280px', minWidth: 260,
                background: 'rgba(0,240,255,0.03)', border: `1.5px solid ${prep ? `${GREEN}50` : `${CYAN}30`}`,
                borderRadius: 12, padding: 16,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: prep ? GREEN : CYAN, marginBottom: 10 }}>
                  📋 准备文档 {prep && <span style={{ fontSize: 11, color: GREEN }}>✓ 已选择</span>}
                </div>

                {/* 已选中指示 */}
                {prep && (
                  <div style={{
                    padding: '8px 12px', background: importedPrepSource === 'file' ? `${CYAN}12` : `${GREEN}12`,
                    border: `1px solid ${importedPrepSource === 'file' ? `${CYAN}40` : `${GREEN}40`}`,
                    borderRadius: 8, fontSize: 12, color: importedPrepSource === 'file' ? CYAN : GREEN, marginBottom: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span>
                      {importedPrepSource === 'file' ? '📂 ' : '💾 '}
                      {importedPrepSource === 'file' ? importedPrepFileName : (prep.meta.role_name || '面试准备文档') + ' @ ' + (prep.meta.company_name || '未知')}
                      {importedPrepSource === 'file' && importedPrepText ? ' (文本)' : ''}
                    </span>
                    <button
                      onClick={() => { setPrep(null); setImportedPrepSource(null); setImportedPrepText(null); setImportedPrepFileName(''); setSavedDiagnosisData(null); setImportedDiagnosisSource(null); }}
                      style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 13, padding: 0 }}
                    >✕</button>
                  </div>
                )}

                {/* 已保存文档快捷选择 */}
                {sp.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>已保存文档</div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {sp.slice(0, 3).map(p => (
                        <button
                          key={p.meta.prep_id}
                          onClick={() => {
                            setPrep(p as any);
                            setImportedPrepSource('saved');
                            setImportedPrepText(null);
                            setImportedPrepFileName('');
                            setSessionId(null);
                            setSavedDiagnosisData(null);
                            setImportedDiagnosisSource(null);
                          }}
                          style={{
                            padding: '5px 10px', fontSize: 11,
                            background: prep?.meta?.prep_id === p.meta.prep_id && importedPrepSource === 'saved' ? `${GREEN}25` : CARD,
                            border: `1px solid ${prep?.meta?.prep_id === p.meta.prep_id && importedPrepSource === 'saved' ? GREEN : BORDER}`,
                            borderRadius: 6, color: prep?.meta?.prep_id === p.meta.prep_id && importedPrepSource === 'saved' ? GREEN : '#bbb',
                            cursor: 'pointer', textAlign: 'left' as const,
                          }}
                        >
                          {p.meta.role_name || '文档'} @ {p.meta.company_name || '?'}
                        </button>
                      ))}
                    </div>
                    {sp.length > 3 && <span style={{ fontSize: 10, color: DIM }}>+{sp.length - 3} 份</span>}
                  </div>
                )}

                {/* 文件导入 */}
                <FileDropZone
                  label="从文件导入准备文档"
                  accept=".json,.md,.docx"
                  onFile={handlePrepFileImport}
                  isImported={importedPrepSource === 'file'}
                  hint=".json / .md / .docx"
                />
              </div>

              {/* ═══ 卡片 B：诊断报告 ═══ */}
              <div style={{
                flex: '1 1 280px', minWidth: 260,
                background: 'rgba(255,0,255,0.03)', border: `1.5px solid ${savedDiagnosisData ? `${MAGENTA}50` : `${MAGENTA}25`}`,
                borderRadius: 12, padding: 16,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: savedDiagnosisData ? MAGENTA : '#aaa', marginBottom: 10 }}>
                  🧠 诊断报告 {savedDiagnosisData && <span style={{ fontSize: 11, color: MAGENTA }}>✓ 已选择</span>}
                </div>

                {/* 已选中指示 */}
                {savedDiagnosisData && (
                  <div style={{
                    padding: '8px 12px', background: `${MAGENTA}12`,
                    border: `1px solid ${MAGENTA}40`,
                    borderRadius: 8, fontSize: 12, color: MAGENTA, marginBottom: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span>
                      {importedDiagnosisSource === 'file' ? '📂 ' : '💾 '}
                      {importedDiagnosisSource === 'file'
                        ? importedDiagnosisFileName
                        : `诊断 ${savedDiagnosisData.overall_score}分`}
                      {importedDiagnosisText ? ' (文本)' : ''}
                    </span>
                    <button
                      onClick={() => { setSavedDiagnosisData(null); setImportedDiagnosisSource(null); setImportedDiagnosisText(null); setImportedDiagnosisFileName(''); }}
                      style={{ background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 13, padding: 0 }}
                    >✕</button>
                  </div>
                )}

                {/* 已保存诊断列表 */}
                {matchingDiags.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>
                      配套诊断（{matchingDiags.length} 份）
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {matchingDiags.slice(0, 3).map(d => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setSessionId(d.sessionId || null);
                            setSavedDiagnosisData(d.diagnosis);
                            setImportedDiagnosisSource('saved');
                            setImportedDiagnosisText(null);
                            setImportedDiagnosisFileName('');
                          }}
                          style={{
                            padding: '5px 10px', fontSize: 11,
                            background: savedDiagnosisData === d.diagnosis && importedDiagnosisSource === 'saved' ? `${MAGENTA}25` : CARD,
                            border: `1px solid ${savedDiagnosisData === d.diagnosis && importedDiagnosisSource === 'saved' ? MAGENTA : BORDER}`,
                            borderRadius: 6, color: savedDiagnosisData === d.diagnosis && importedDiagnosisSource === 'saved' ? MAGENTA : '#bbb',
                            cursor: 'pointer',
                          }}
                        >
                          🧠 {d.diagnosis.overall_score}分·{d.questionCount}题
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {allDiags.length > 0 && matchingDiags.length === 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: DIM, marginBottom: 4 }}>
                      全部已保存诊断（{allDiags.length} 份）
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {allDiags.slice(0, 3).map(d => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setSessionId(d.sessionId || null);
                            setSavedDiagnosisData(d.diagnosis);
                            setImportedDiagnosisSource('saved');
                            setImportedDiagnosisText(null);
                            setImportedDiagnosisFileName('');
                          }}
                          style={{
                            padding: '5px 10px', fontSize: 11,
                            background: savedDiagnosisData === d.diagnosis && importedDiagnosisSource === 'saved' ? `${MAGENTA}25` : CARD,
                            border: `1px solid ${savedDiagnosisData === d.diagnosis && importedDiagnosisSource === 'saved' ? MAGENTA : BORDER}`,
                            borderRadius: 6, color: savedDiagnosisData === d.diagnosis && importedDiagnosisSource === 'saved' ? MAGENTA : '#bbb',
                            cursor: 'pointer',
                          }}
                        >
                          🧠 {d.diagnosis.overall_score}分·{d.questionCount}题
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 文件导入 */}
                <FileDropZone
                  label="从文件导入诊断报告"
                  accept=".json,.md,.docx"
                  onFile={handleDiagnosisFileImport}
                  isImported={importedDiagnosisSource === 'file'}
                  hint=".json / .md / .docx"
                />
              </div>
            </div>
          );
        })()}

        {/* ── 执行优化按钮（两个卡片都选中后）── */}
        {prep && savedDiagnosisData && (
          <button
            onClick={handleRefine}
            style={{
              width: '100%', padding: '12px 0', marginBottom: 4,
              background: `linear-gradient(135deg, ${MAGENTA}, ${MAGENTA}80)`,
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              // no animation
            }}
          >
            🚀 执行闭环优化 — 更新 Gap 清单 + 生成针对性新题
          </button>
        )}
        {prep && !savedDiagnosisData && (
          <div style={{
            padding: '8px 14px', marginBottom: 4,
            background: 'rgba(255,255,0,0.05)',
            border: `1px dashed ${YELLOW}30`, borderRadius: 8,
            fontSize: 11, color: YELLOW,
          }}>
            ⏳ 请导入或选择一份诊断报告
          </div>
        )}

        {error && <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${RED}`, padding: 12, borderRadius: 8, marginBottom: 16, color: RED, fontSize: 13 }}>{error}</div>}

        <div style={{ borderTop: `1px solid ${BORDER}`, margin: '24px 0', paddingTop: 16 }}>
          <p style={{ color: DIM, fontSize: 12, marginBottom: 16, textAlign: 'center' }}>
            ── 或者，从头生成新的面试准备文档 ──
          </p>
        </div>

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
            onDragOver={e => { e.preventDefault(); setIsDraggingResume(true); }}
            onDragLeave={() => setIsDraggingResume(false)}
            onDrop={e => { e.preventDefault(); setIsDraggingResume(false); const f = e.dataTransfer.files[0]; if (f) processFile(f, 'resume'); }}
            style={{
              border: `1px dashed ${isDraggingResume ? CYAN : BORDER}`, borderRadius: 8, padding: 12, textAlign: 'center',
              color: DIM, fontSize: 12, marginTop: 8, cursor: 'pointer', background: isDraggingResume ? 'rgba(0,240,255,0.05)' : 'transparent',
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
            placeholder="粘贴岗位描述，或拖拽文件到下方..."
            rows={4}
            style={{ width: '100%', background: CARD, border: `1px solid ${BORDER}`, color: '#fff', padding: 12, borderRadius: 8, fontSize: 13, resize: 'vertical', fontFamily: 'monospace' }}
          />
          <div
            onDragOver={e => { e.preventDefault(); setIsDraggingJd(true); }}
            onDragLeave={() => setIsDraggingJd(false)}
            onDrop={e => { e.preventDefault(); setIsDraggingJd(false); const f = e.dataTransfer.files[0]; if (f) processFile(f, 'jd'); }}
            style={{
              border: `1px dashed ${isDraggingJd ? CYAN : BORDER}`, borderRadius: 8, padding: 12, textAlign: 'center',
              color: DIM, fontSize: 12, marginTop: 8, cursor: 'pointer', background: isDraggingJd ? 'rgba(0,240,255,0.05)' : 'transparent',
            }}
            onClick={() => document.getElementById('jdFileInput')?.click()}
          >
            📎 拖拽 JD 文件（PDF/DOCX/图片/TXT）或点击上传
            <input id="jdFileInput" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt,.md" hidden onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f, 'jd'); }} />
          </div>
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
          marginBottom: 12,
        }}>
          🚀 生成面试准备文档
        </button>

      </div>
    );
  }

  // ── 生成中 ──
  if (stage === 'generating') {
    // 优先使用后端传来的 progress，否则根据 streamStatus 的阶段文字估算
    const statusText = streamStatus || '正在连接服务器...';
    let estimatedPct = streamProgress;
    if (estimatedPct <= 5) {
      if (statusText.includes('简历')) estimatedPct = 15;
      else if (statusText.includes('公司') || statusText.includes('调研')) estimatedPct = 30;
      else if (statusText.includes('JD') || statusText.includes('解读')) estimatedPct = 45;
      else if (statusText.includes('介绍')) estimatedPct = 55;
      else if (statusText.includes('项目')) estimatedPct = 65;
      else if (statusText.includes('题目') || statusText.includes('预测')) estimatedPct = 75;
      else if (statusText.includes('指导') || statusText.includes('建议')) estimatedPct = 85;
      else if (statusText.includes('反问')) estimatedPct = 92;
      else if (statusText.includes('Gap') || statusText.includes('清单')) estimatedPct = 97;
      else if (statusText.includes('完成')) estimatedPct = 100;
    }
    const blocks = 20;
    const filledBlocks = Math.floor(estimatedPct / (100 / blocks));
    const bar = '█'.repeat(filledBlocks) + '░'.repeat(blocks - filledBlocks);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
        <p style={{ color: CYAN, fontSize: 14, fontWeight: 600 }}>
          🤖 {statusText}
        </p>
        <div style={{
          fontFamily: 'monospace', fontSize: 16, letterSpacing: 1,
          color: CYAN, lineHeight: 1.4,
        }}>
          [{bar}] {estimatedPct}%
        </div>
        <p style={{ color: DIM, fontSize: 12 }}>
          {streamContent ? `已生成 ${streamContent.length.toLocaleString()} 字符` : '初始化中...'}
        </p>

        {/* 实时内容预览 */}
        <div style={{
          width: '100%', maxWidth: 600,
          background: CARD, border: `1px solid ${BORDER}`,
          borderRadius: 12, padding: 16, maxHeight: 300, overflow: 'auto',
        }}>
          <p style={{ color: DIM, fontSize: 12, marginBottom: 8 }}>📝 实时生成内容预览：</p>
          {streamContent ? (
            <pre style={{
              color: '#fff', fontSize: 11, fontFamily: 'monospace',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              margin: 0, lineHeight: 1.6,
            }}>
              {streamContent.length > 2000 ? '...' + streamContent.slice(-2000) : streamContent}
            </pre>
          ) : (
            <p style={{ color: DIM, fontSize: 11, fontStyle: 'italic' }}>
              等待 AI 开始生成...
            </p>
          )}
        </div>
      </div>
    );
  }

  if (stage === 'refining') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, gap: 16 }}>
        <p style={{ color: MAGENTA, fontSize: 14, fontWeight: 600 }}>
          🔄 正在用诊断结果优化面试准备...
        </p>
        <p style={{ color: DIM, fontSize: 12 }}>
          分析薄弱领域 → 更新Gap清单 → 生成针对性新题
        </p>
      </div>
    );
  }

  // ── 预览阶段 ──
  if (!prep) return null;

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
      {/* ── 闭环优化版标识（紧凑单行）── */}
      {prep.meta.diagnosis_feedback && (
        <div style={{
          background: 'rgba(255,0,255,0.06)',
          borderLeft: `3px solid ${MAGENTA}`,
          borderRadius: 6, padding: '8px 14px', marginBottom: 12,
          fontSize: 12, color: DIM, lineHeight: 1.6,
        }}>
          <span style={{ color: MAGENTA, fontWeight: 700 }}>🔄 闭环优化版</span>
          <span style={{ margin: '0 8px', color: BORDER }}>|</span>
          诊断评分 {prep.meta.diagnosis_feedback.overall_score}
          <span style={{ margin: '0 8px', color: BORDER }}>|</span>
          薄弱项 {prep.meta.diagnosis_feedback.weaknesses?.length || 0} 个
          {prep.meta.diagnosis_feedback.weaknesses?.length > 0 && (
            <span style={{ marginLeft: 6 }}>
              ({prep.meta.diagnosis_feedback.weaknesses.slice(0, 3).join(', ')}{prep.meta.diagnosis_feedback.weaknesses.length > 3 ? '...' : ''})
            </span>
          )}
          <span style={{ margin: '0 8px', color: BORDER }}>|</span>
          {prep.meta.diagnosis_feedback.applied_at ? new Date(prep.meta.diagnosis_feedback.applied_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未知'}
          {prep.meta.refined_from && (
            <>
              <span style={{ margin: '0 8px', color: BORDER }}>|</span>
              源文档 {prep.meta.refined_from.slice(0, 12)}...
            </>
          )}
          {prep.meta.refine_summary && (
            <>
              <br />
              <span style={{ color: '#aaa', fontStyle: 'italic' }}>优化摘要：{prep.meta.refine_summary}</span>
            </>
          )}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 4 }}>
            {prep.meta.diagnosis_feedback ? '🔄' : '📋'} {prep.meta.role_name || '面试准备'} @ {prep.meta.company_name || '目标公司'}
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
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* 保存到本地 */}
          <button
            onClick={() => {
              savePrep(prep);
              alert('面试准备文档已保存到本地！');
            }}
            style={{
              padding: '10px 16px', background: 'transparent', color: GREEN, border: `1px solid ${GREEN}`,
              borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,255,34,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            💾 保存
          </button>
          {/* 导出为 JSON */}
          <button
            onClick={() => exportPrepToJSON(prep)}
            style={{
              padding: '10px 16px', background: 'transparent', color: CYAN, border: `1px solid ${CYAN}`,
              borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,240,255,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            📄 JSON
          </button>
          {/* 导出为 Markdown */}
          <button
            onClick={() => exportPrepToMarkdown(prep)}
            style={{
              padding: '10px 16px', background: 'transparent', color: YELLOW, border: `1px solid ${YELLOW}`,
              borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            📝 MD
          </button>
          {/* 开始面试拷打 */}
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
      </div>

      {/* ── 闭环优化入口：点击回到 input 阶段的闭环模块 ── */}
      {!prep?.meta?.diagnosis_feedback && (
        <button
          onClick={() => setStage('input')}
          style={{
            width: '100%', padding: '10px 0', marginBottom: 20,
            background: 'rgba(255,0,255,0.06)', border: `1.5px solid ${MAGENTA}40`,
            borderRadius: 10, color: MAGENTA, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', textAlign: 'center' as const,
          }}
        >
          🔄 闭环优化 — 选择准备文档 + 诊断报告，反馈强化 →
        </button>
      )}

      {error && <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${RED}`, padding: 12, borderRadius: 8, marginBottom: 16, color: RED, fontSize: 13 }}>{error}</div>}

      {/* ── 一、公司调研 ── */}
      {prep.company_research && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader title="一、公司与产品调研" sectionKey="research" />
          {expandedSection.has('research') && (
            <div style={{ padding: 16 }}>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: '#ccc' }}>{prep.company_research.company_overview || [prep.company_research.company_profile, prep.company_research.tech_stack_focus].filter(Boolean).join('\n\n') || '暂无'}</p>
              {prep.company_research.tech_culture && <p style={{ fontSize: 12, color: DIM, marginTop: 8 }}>🔧 技术文化：{Array.isArray(prep.company_research.tech_culture) ? prep.company_research.tech_culture.join('；') : prep.company_research.tech_culture}</p>}
              {(Array.isArray(prep.company_research.key_focus_areas) && prep.company_research.key_focus_areas.length > 0) && (
                <div style={{ marginTop: 8 }}>
                  <span style={{ fontSize: 12, color: CYAN }}>🎯 重点关注领域：</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {(prep.company_research.key_focus_areas as string[]).map((area, idx) => (
                      <span key={idx} style={{ padding: '4px 10px', background: 'rgba(0,240,255,0.08)', border: `1px solid ${CYAN}40`, borderRadius: 4, fontSize: 11, color: CYAN }}>
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {(!Array.isArray(prep.company_research.key_focus_areas) && prep.company_research.tech_stack_focus) && (
                <p style={{ fontSize: 12, color: DIM, marginTop: 8 }}>🎯 技术方向：{prep.company_research.tech_stack_focus}</p>
              )}
              {prep.company_research.why_xiaohongshu_for_ai && <p style={{ fontSize: 12, color: DIM, marginTop: 8 }}>🎯 选择理由：{prep.company_research.why_xiaohongshu_for_ai}</p>}
            </div>
          )}
        </div>
      )}

      {/* ── 二、JD 深度解读 ── */}
      {prep.jd_analysis && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader title="二、JD 深度解读 + 逐条匹配" sectionKey="jd" />
          {expandedSection.has('jd') && (
            <div style={{ padding: 16 }}>
              {Array.isArray(prep.jd_analysis.core_requirements) && prep.jd_analysis.core_requirements.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: CYAN, marginBottom: 6, fontWeight: 600 }}>🎯 核心要求</div>
                  {prep.jd_analysis.core_requirements.map((req: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: 4, fontSize: 12, color: '#ccc', paddingLeft: 12 }}>
                      {idx + 1}. {typeof req === 'object' ? JSON.stringify(req) : req}
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(prep.jd_analysis.preferred_qualifications) && prep.jd_analysis.preferred_qualifications.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: GREEN, marginBottom: 6, fontWeight: 600 }}>⭐ 加分项</div>
                  {prep.jd_analysis.preferred_qualifications.map((qual: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: 4, fontSize: 12, color: '#ccc', paddingLeft: 12 }}>
                      {idx + 1}. {typeof qual === 'object' ? JSON.stringify(qual) : qual}
                    </div>
                  ))}
                </div>
              )}
              {Array.isArray(prep.jd_analysis.gap_identification) && prep.jd_analysis.gap_identification.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: YELLOW, marginBottom: 6, fontWeight: 600 }}>⚠️ 差距识别</div>
                  {prep.jd_analysis.gap_identification.map((gap: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: 4, fontSize: 12, color: '#ccc', paddingLeft: 12 }}>
                      {idx + 1}. {typeof gap === 'object' ? JSON.stringify(gap) : gap}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 三、定制版自我介绍 ── */}
      {prep.self_intro && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader title="三、定制版自我介绍" sectionKey="intro" badge={`${prep.self_intro.duration_seconds || 90}秒`} />
          {expandedSection.has('intro') && (
            <div style={{ padding: 16 }}>
              {Array.isArray(prep.self_intro.key_highlights) && prep.self_intro.key_highlights.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: DIM, marginBottom: 6, fontWeight: 600 }}>重点亮点：</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {prep.self_intro.key_highlights.map((highlight, idx) => (
                      <span key={idx} style={{ padding: '4px 10px', background: 'rgba(0,240,255,0.08)', border: `1px solid ${CYAN}40`, borderRadius: 4, fontSize: 11, color: CYAN }}>
                        {highlight}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ background: 'rgba(0,240,255,0.04)', border: `1px solid ${CYAN}30`, borderRadius: 8, padding: 14, fontSize: 14, lineHeight: 1.8, color: '#ddd', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                {prep.self_intro.script || prep.self_intro.script_draft || prep.self_intro.structure || '暂无'}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 四、项目深挖问答 ── */}
      {prep.star_stories && prep.star_stories.length > 0 && (
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
                  {s.follow_up_questions && s.follow_up_questions.length > 0 && (
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
      {prep.predicted_questions && prep.predicted_questions.length > 0 && (
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
                        // 保存历史记录
                        try {
                          saveHistoryRecord({
                            id: uuidv4(),
                            timestamp: Date.now(),
                            mode: 'prep_drill',
                            category: prep.predicted_questions[practiceIndex].category || '综合',
                            questionText: prep.predicted_questions[practiceIndex].question,
                            userAnswer: practiceAnswer,
                            score: data.score,
                            comment: data.comment,
                            referenceAnswer: prep.predicted_questions[practiceIndex].key_points.join('；'),
                            isWrong: data.score < 6,
                            prepId: prep.meta.prep_id,
                            prepTitle: `${prep.meta.role_name} @ ${prep.meta.company_name || '未知公司'}`,
                          });
                        } catch {}
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
                {q.key_points && q.key_points.length > 0 && (
                  <div style={{ fontSize: 11, color: DIM }}>
                    考察：{q.key_points.join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      )}

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
      {prep.gap_analysis && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, marginBottom: 12, overflow: 'hidden' }}>
          <SectionHeader title="附、Gap 清单（差距分析）" sectionKey="gap" />
          {expandedSection.has('gap') && (
            <div style={{ padding: 16 }}>
              {/* 优势：从 strengths/strengths_vs_jd 或 priority_2 */}
              {(() => {
                const strengths = prep.gap_analysis.strengths || prep.gap_analysis.strengths_vs_jd;
                const p2Items = (prep.gap_analysis.priority_2_should_fix || []).map((item: any) => typeof item === 'string' ? { gap: item, action: '' } : item);
                // 只用一种来源，避免重复
                const allStrengths: { gap: string; action?: string }[] = (strengths && strengths.length > 0) ? strengths.map((s: string) => ({ gap: s, action: '' })) : p2Items;
                return allStrengths.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: GREEN, marginBottom: 8 }}>✅ 优势</div>
                    {allStrengths.map((s, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: 'rgba(34,255,34,0.06)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                        <span style={{ color: '#ccc' }}>🎯 {s.gap}</span>
                        {s.action && <div style={{ color: DIM, fontSize: 11, marginTop: 4, paddingLeft: 16 }}>→ {s.action}</div>}
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              {/* 劣势：从 weaknesses/weaknesses_vs_jd 或 priority_1 */}
              {(() => {
                const weaknesses = prep.gap_analysis.weaknesses || prep.gap_analysis.weaknesses_vs_jd;
                const p1Items = (prep.gap_analysis.priority_1_must_fix || []).map((item: any) => typeof item === 'string' ? { gap: item, action: '' } : item);
                // 只用一种来源，避免重复
                const allWeaknesses: { gap: string; action?: string }[] = (weaknesses && weaknesses.length > 0) ? weaknesses.map((w: string) => ({ gap: w, action: '' })) : p1Items;
                return allWeaknesses.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: RED, marginBottom: 8 }}>⚠️ 劣势</div>
                    {allWeaknesses.map((w, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: 'rgba(255,68,68,0.06)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                        <span style={{ color: '#ccc' }}>❌ {w.gap}</span>
                        {w.action && <div style={{ color: DIM, fontSize: 11, marginTop: 4, paddingLeft: 16 }}>→ {w.action}</div>}
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              {/* 应对策略：从 mitigation_strategies 或 priority_3 */}
              {(() => {
                const strategies = prep.gap_analysis.mitigation_strategies;
                const p3Items = (prep.gap_analysis.priority_3_nice_to_have || []).map((item: any) => typeof item === 'string' ? { gap: item, action: '' } : item);
                // 只用一种来源，避免重复
                const allStrategies: { gap: string; action?: string }[] = (strategies && strategies.length > 0) ? strategies.map((s: string) => ({ gap: s, action: '' })) : p3Items;
                return allStrategies.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: CYAN, marginBottom: 8 }}>💡 应对策略</div>
                    {allStrategies.map((s, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: 'rgba(0,240,255,0.06)', borderRadius: 8, marginBottom: 4, fontSize: 12 }}>
                        <span style={{ color: '#ccc' }}>→ {s.gap}</span>
                        {s.action && <div style={{ color: DIM, fontSize: 11, marginTop: 4, paddingLeft: 16 }}>💡 {s.action}</div>}
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}
              {/* 空状态 */}
              {(() => {
                const hasAny = (prep.gap_analysis.strengths || prep.gap_analysis.strengths_vs_jd || prep.gap_analysis.priority_2_should_fix)?.length
                  || (prep.gap_analysis.weaknesses || prep.gap_analysis.weaknesses_vs_jd || prep.gap_analysis.priority_1_must_fix)?.length
                  || (prep.gap_analysis.mitigation_strategies || prep.gap_analysis.priority_3_nice_to_have)?.length;
                return !hasAny ? (
                  <div style={{ fontSize: 12, color: DIM, textAlign: 'center', padding: 12 }}>
                    Gap清单为空
                  </div>
                ) : null;
              })()}
            </div>
          )}
        </div>
      )}

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
