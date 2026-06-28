import { useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { HistoryRecord, Category } from '../types';
import { aiGenerateQuestion, aiEvaluate, GeneratedQuestion } from '../services/aiService';
import { DIFFICULTY_CONFIG, type DifficultyLevel } from '../services/resumeRoastService';
import { saveHistoryRecord } from '../utils/storage';
import { addAIQuestion, updateQuestionStats } from '../utils/questionBank';
import { parseDocument } from '../utils/documentParser';
import '../styles/TargetedPractice.css';

const SAMPLE_JD = `岗位：高级前端工程师
职责：
1. 负责公司核心产品的前端架构设计与开发
2. 主导前端技术选型，制定开发规范
3. 优化前端性能，提升用户体验
4. 带领团队解决复杂技术问题
要求：
1. 5年以上前端开发经验，熟练掌握React/Vue
2. 精通TypeScript，熟悉Webpack/Vite配置
3. 有良好的代码规范和架构设计能力
4. 具备团队管理经验优先`;

const TargetedPractice = () => {
  const [jdText, setJdText] = useState('');
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]); // 生成的5道题目（包含类别）
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentQuestionIds, setCurrentQuestionIds] = useState<string[]>([]); // 题目ID列表
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{ score: number; comment: string; referenceAnswer: string } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0); // 像素进度条
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationProgress, setEvaluationProgress] = useState(0); // 圆环形进度条
  const [error, setError] = useState<string | null>(null);
  const [generateCount, setGenerateCount] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [answers, setAnswers] = useState<Map<string, { answer: string; result: { score: number; comment: string; referenceAnswer: string } }>>(new Map());
  
  // 难度等级
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('mid');
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 组件卸载时清理 interval
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, []);

  const handleGenerate = async () => {
    if (!jdText.trim()) return;

    setIsGenerating(true);
    setError(null);
    setQuestions([]);
    setResult(null);
    setAnswer('');
    setCurrentQuestionIds([]);
    setCurrentQuestionIndex(0);
    setAnswers(new Map());
    setGenerateProgress(0);

    try {
      const generatedQuestions: GeneratedQuestion[] = [];
      const generatedIds: string[] = [];
      
      // 生成5道题目
      for (let i = 0; i < 5; i++) {
        // 更新进度
        setGenerateProgress((i + 1) * 20);
        
        await delay(300);
        const newQuestion = await aiGenerateQuestion(jdText, difficulty);
        generatedQuestions.push(newQuestion);
        
        // 自动将AI生成的题目添加到题库，使用多类别
        const questionData = await addAIQuestion(
          newQuestion.text,
          ['根据JD/面经生成', '针对性练习'],
          '请参考AI评价结果',
          newQuestion.categories // 使用AI返回的类别数组
        );
        generatedIds.push(questionData.id);
      }
      
      setQuestions(generatedQuestions);
      setCurrentQuestionIds(generatedIds);
      setGenerateCount(prev => prev + 5);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成题目失败，请稍后重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFillSample = () => {
    setJdText(SAMPLE_JD);
  };

  const handleClear = () => {
    setJdText('');
    setQuestions([]);
    setResult(null);
    setAnswer('');
    setError(null);
    setGenerateCount(0);
    setCurrentQuestionIds([]);
    setCurrentQuestionIndex(0);
    setAnswers(new Map());
  };

  // 处理文档上传
  const processFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '')) {
      setError('错误：仅支持 PDF、DOCX 和图片格式');
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const text = await parseDocument(file);
      setJdText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取文档失败');
    } finally {
      setIsImporting(false);
      setIsDragging(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  // 拖拽事件处理
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX <= rect.left || clientX >= rect.right || clientY <= rect.top || clientY >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  };

  // 延迟函数
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSubmit = async () => {
    if (questions.length === 0 || !answer.trim()) return;

    const currentQuestion = questions[currentQuestionIndex];
    const currentQuestionId = currentQuestionIds[currentQuestionIndex];

    setIsEvaluating(true);
    setEvaluationProgress(0);
    setError(null);

    try {
      // 模拟AI思考进度
      progressIntervalRef.current = setInterval(() => {
        setEvaluationProgress(prev => {
          if (prev >= 90) {
            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            return 90;
          }
          const increment = Math.random() * 15 + 5;
          return Math.min(prev + increment, 90); // 确保不超过90
        });
      }, 200);

      const evalResult = await aiEvaluate(currentQuestion.text, answer);
      
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setEvaluationProgress(100);
      await delay(300);

      setResult(evalResult);

      // 保存答案和结果
      setAnswers(prev => {
        const newMap = new Map(prev);
        newMap.set(currentQuestionId, { answer, result: evalResult });
        return newMap;
      });

      // 保存历史记录，使用第一个类别作为主类别
      const primaryCategory = currentQuestion.categories.find(c => c !== '定制') || '定制';
      const record: HistoryRecord = {
        id: uuidv4(),
        timestamp: Date.now(),
        mode: 'targeted',
        category: primaryCategory,
        questionText: currentQuestion.text,
        userAnswer: answer,
        score: evalResult.score,
        comment: evalResult.comment,
        referenceAnswer: evalResult.referenceAnswer,
        isWrong: evalResult.score < 7,
        jdText: jdText.slice(0, 200),
      };
      saveHistoryRecord(record);

      // 更新题库中的题目统计
      if (currentQuestionId) {
        updateQuestionStats(currentQuestionId, evalResult.score);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI评价失败，请稍后重试');
    } finally {
      setIsEvaluating(false);
    }
  };

  const [showSummary, setShowSummary] = useState(false);

  const handleNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setAnswer('');
      setResult(null);
      setError(null);
    } else {
      // 所有题目完成，显示总结报告
      setShowSummary(true);
    }
  };

  const handleRestart = () => {
    setQuestions([]);
    setResult(null);
    setAnswer('');
    setError(null);
    setCurrentQuestionIds([]);
    setCurrentQuestionIndex(0);
    setAnswers(new Map());
    setShowSummary(false);
  };

  // 检测生成次数，显示提示
  useEffect(() => {
    if (generateCount >= 10) {
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [generateCount]);

  return (
    <div>
      <div className="td-practice-card">
        <div className="jd-section">
          <div className="jd-label">粘贴 JD / 面经：</div>
          
          {/* 拖拽上传区域 */}
          <div
            className={`file-upload-area ${isDragging ? 'dragover' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <textarea
              className="jd-textarea"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="请粘贴职位描述或面经内容，AI将根据内容生成面试题...

也可以直接拖拽 PDF、Word 文档或图片到此处上传"
              disabled={isGenerating}
            />
            {isDragging && (
              <div className="drop-overlay">
                <span className="drop-icon">📁</span>
                <span className="drop-text">松开以上传文件</span>
              </div>
            )}
          </div>
          
          {/* 难度选择 */}
          <div className="difficulty-selector">
            <div className="difficulty-label">选择难度</div>
            <div className="difficulty-options">
              {(Object.entries(DIFFICULTY_CONFIG) as [DifficultyLevel, { label: string; description: string }][]).map(([value, { label, description }]) => (
                <button
                  key={value}
                  className={`difficulty-btn ${difficulty === value ? 'active' : ''}`}
                  onClick={() => setDifficulty(value)}
                  disabled={isGenerating}
                >
                  <div className="difficulty-btn-label">{label}</div>
                  <div className="difficulty-btn-desc">{description.slice(0, 4)}</div>
                </button>
              ))}
            </div>
          </div>
          
          <div className="jd-actions">
            <button
              className="jd-btn secondary"
              onClick={handleFillSample}
              disabled={isGenerating}
            >
              填充示例
            </button>
            <button
              className="jd-btn secondary"
              onClick={handleClear}
              disabled={isGenerating}
            >
              清空
            </button>
            <label className="jd-btn secondary file-upload-btn">
              <input
                type="file"
                accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                onChange={handleFileUpload}
                disabled={isGenerating || isImporting}
                className="file-input"
              />
              {isImporting ? '导入中...' : '📄 导入文档/图片'}
            </label>
            <button
              className="jd-btn primary"
              onClick={handleGenerate}
              disabled={!jdText.trim() || isGenerating}
            >
              {isGenerating ? '生成中...' : '生成题目'}
            </button>
            <span className="generate-count">
              本会话已生成 {generateCount} 道
            </span>
          </div>
        </div>

        {error && <div className="error-text">{error}</div>}
      </div>

      {showToast && (
        <div className="toast">
          已生成 10 道以上题目，建议适当休息后继续
        </div>
      )}

      <div style={{ marginTop: 24 }}>
        {isGenerating ? (
          <div className="question-card">
            <div className="question-badge">针对性练习</div>
            <h3 style={{ textAlign: 'center', marginBottom: '16px' }}>正在生成面试题目...</h3>
            
            {/* 像素风格进度条 */}
            <div className="pixel-progress-container">
              <div className="pixel-progress-bar">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`pixel-block ${generateProgress >= (i + 1) * 10 ? 'filled-generate' : 'empty'}`}
                  />
                ))}
              </div>
              <span className="progress-text">{generateProgress}%</span>
            </div>
            <p style={{ textAlign: 'center', color: 'var(--color-text-sub)', marginTop: '12px' }}>
              正在生成第 {Math.ceil(generateProgress / 20)} / 5 道题目
            </p>
          </div>
        ) : questions.length > 0 ? (
          <div className="question-card">
            {/* 题目进度显示 */}
            <div className="progress-section">
              <div className="progress-info">
                <span className="progress-current">{currentQuestionIndex + 1}</span>
                <span className="progress-divider">/</span>
                <span className="progress-total">{questions.length}</span>
                <span className="progress-label">题目</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }} />
              </div>
            </div>

            {/* 已回答题目 */}
            {answers.size > 0 && (
              <div className="answered-section">
                {currentQuestionIds.map((id, i) => {
                  const answered = answers.get(id);
                  if (!answered) return null;
                  return (
                    <span key={id} className={`answered-badge ${answered.result.score >= 7 ? 'pass' : 'fail'}`}>
                      Q{i + 1}: {answered.result.score}分
                    </span>
                  );
                })}
              </div>
            )}

            {/* 多类别标签 */}
            <div className="category-tags">
              {questions[currentQuestionIndex].categories.map((cat, i) => (
                <span key={i} className={`question-badge ${cat === '定制' ? 'custom' : 'domain'}`}>
                  {cat}
                </span>
              ))}
            </div>
            <div className="question-text">{questions[currentQuestionIndex].text}</div>

            <div className="answer-area">
              <div className="answer-label">请输入你的回答：</div>
              <textarea
                className="answer-textarea"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={isEvaluating || !!result}
                placeholder="请输入你的回答..."
              />
            </div>

            {/* AI评判中显示圆环形进度条 */}
            {isEvaluating && (
              <div className="evaluating-overlay">
                <div className="circular-progress">
                  <svg className="progress-ring" viewBox="0 0 100 100">
                    <circle
                      className="progress-ring-bg"
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="6"
                    />
                    <circle
                      className="progress-ring-fill"
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="var(--color-cta)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${evaluationProgress * 2.83} 283`}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="progress-text">{Math.round(evaluationProgress)}%</div>
                </div>
                <p className="evaluating-text">AI正在评判中...</p>
              </div>
            )}

            {result && (
              <div className="result-card">
                <div className="result-header">
                  <div className={`score-badge ${result.score >= 7 ? 'pass' : 'fail'}`}>
                    {result.score}
                  </div>
                  <span className="result-label">
                    {result.score >= 7 ? '回答正确' : '回答不正确'}
                  </span>
                </div>
                <div className="result-comment">
                  <div className="result-label-small">AI 评语</div>
                  <div className="result-text">{result.comment}</div>
                </div>
                <div className="result-comment" style={{ marginTop: 12 }}>
                  <div className="result-label-small">参考答案</div>
                  <div className="result-text">{result.referenceAnswer}</div>
                </div>
              </div>
            )}

            <div className="action-buttons">
              {!result ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={!answer.trim() || isEvaluating}
                  >
                    {isEvaluating ? 'AI思考中...' : '提交回答'}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={handleRestart}
                    disabled={isEvaluating}
                  >
                    重新生成
                  </button>
                </>
              ) : (
                <>
                  <button className="btn btn-primary" onClick={handleNextQuestion}>
                    {currentQuestionIndex + 1 >= questions.length ? '查看总结' : '下一题'}
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={() => window.location.href = '/history'}
                  >
                    查看错题本
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}

        {/* ── 练习总结 ── */}
        {showSummary && questions.length > 0 && (
          <div className="td-practice-card" style={{ marginTop: 20 }}>
            <h2 style={{ textAlign: 'center', marginBottom: 20 }}>练习总结</h2>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ textAlign: 'center', padding: 12, background: '#111', borderRadius: 8, minWidth: 100 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#00f0ff' }}>{questions.length}</div>
                <div style={{ fontSize: 12, color: '#888' }}>总题数</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: '#111', borderRadius: 8, minWidth: 100 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#22ff22' }}>
                  {Array.from(answers.values()).filter(a => a.result.score >= 60).length}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>及格数</div>
              </div>
              <div style={{ textAlign: 'center', padding: 12, background: '#111', borderRadius: 8, minWidth: 100 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#ffff00' }}>
                  {answers.size > 0 ? Math.round(Array.from(answers.values()).reduce((sum, a) => sum + a.result.score, 0) / answers.size) : 0}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>平均分</div>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              {questions.map((q, i) => {
                const a = answers.get(currentQuestionIds[i]);
                return (
                  <div key={i} style={{ marginBottom: 8, padding: 10, border: '1px solid #222', borderRadius: 4, background: '#0d0d0d' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: '#fff' }}>Q{i + 1}</span>
                      <span style={{ fontSize: 12, color: a && a.result.score >= 60 ? '#22ff22' : '#ff4444' }}>
                        {a ? `${a.result.score}分` : '未答'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#999' }}>{q.text.slice(0, 100)}...</div>
                    {a && <div style={{ fontSize: 11, color: '#00f0ff', marginTop: 4 }}>💬 {a.result.comment.slice(0, 80)}</div>}
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => { setShowSummary(false); handleGenerate(); }}>
                🔄 再来5题
              </button>
              <button className="btn btn-secondary" onClick={handleRestart}>
                重新开始
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TargetedPractice;