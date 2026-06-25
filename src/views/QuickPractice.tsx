import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Category, CATEGORIES, Question, HistoryRecord } from '../types';
import { getQuestionsByCategory, updateQuestionStats } from '../utils/questionBank';
import { aiEvaluate } from '../services/aiService';
import { saveHistoryRecord } from '../utils/storage';
import '../styles/QuickPractice.css';

type PracticeState = 'select' | 'practice' | 'summary';

interface PracticeSession {
  category: Category;
  questions: Question[];
  currentIndex: number;
  answers: Map<string, string>;
  results: Map<string, { score: number; comment: string; referenceAnswer: string }>;
  skipped: Set<string>;
}

const QuickPractice = () => {
  const [state, setState] = useState<PracticeState>('select');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationProgress, setEvaluationProgress] = useState(0); // 0-100 用于圆环形进度条
  const [currentResult, setCurrentResult] = useState<{ score: number; comment: string; referenceAnswer: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── 状态持久化：恢复之前的练习会话 ──
  useEffect(() => {
    const savedSession = localStorage.getItem('quick-practice-session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        // 检查保存时间是否在 30 分钟内
        const isRecent = Date.now() - parsed.timestamp < 30 * 60 * 1000;
        if (isRecent && parsed.state === 'practice' && parsed.session) {
          // 恢复会话状态
          setState('practice');
          setSelectedCategory(parsed.session.category);
          setSession({
            ...parsed.session,
            answers: new Map(parsed.session.answers),
            results: new Map(parsed.session.results),
            skipped: new Set(parsed.session.skipped),
          });
          setCurrentAnswer(parsed.currentAnswer || '');
          setCurrentResult(parsed.currentResult || null);
          // 清除保存的状态，避免重复恢复
          localStorage.removeItem('quick-practice-session');
        }
      } catch (e) {
        console.error('恢复练习会话失败:', e);
      }
    }
  }, []);

  const startPractice = useCallback(() => {
    if (!selectedCategory) return;

    // 从题库获取该类别的题目
    const categoryQuestions = getQuestionsByCategory(selectedCategory);
    
    if (categoryQuestions.length === 0) {
      setError('该类别暂无题目');
      return;
    }

    // 随机抽取10道不重复的题目
    const shuffled = [...categoryQuestions].sort(() => Math.random() - 0.5);
    const selectedQuestions = shuffled.slice(0, Math.min(10, categoryQuestions.length));

    setSession({
      category: selectedCategory,
      questions: selectedQuestions,
      currentIndex: 0,
      answers: new Map(),
      results: new Map(),
      skipped: new Set(),
    });
    setCurrentAnswer('');
    setCurrentResult(null);
    setState('practice');
  }, [selectedCategory]);

  const currentQuestion = session?.questions[session.currentIndex];
  const progress = session ? ((session.currentIndex) / session.questions.length) * 100 : 0;

  // 延迟函数
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleSubmit = async () => {
    if (!session || !currentQuestion || !currentAnswer.trim()) return;

    setIsEvaluating(true);
    setEvaluationProgress(0);
    setError(null);

    try {
      // 模拟AI思考进度
      const progressInterval = setInterval(() => {
        setEvaluationProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          const increment = Math.random() * 15 + 5;
          return Math.min(prev + increment, 90); // 确保不超过90
        });
      }, 200);

      const result = await aiEvaluate(currentQuestion.text, currentAnswer);
      
      clearInterval(progressInterval);
      setEvaluationProgress(100);
      await delay(300);

      setCurrentResult(result);

      // 保存历史记录
      const record: HistoryRecord = {
        id: uuidv4(),
        timestamp: Date.now(),
        mode: 'quick',
        category: session.category,
        questionText: currentQuestion.text,
        userAnswer: currentAnswer,
        score: result.score,
        comment: result.comment,
        referenceAnswer: result.referenceAnswer,
        isWrong: result.score < 7,
      };
      saveHistoryRecord(record);

      // 更新题库中的题目统计
      updateQuestionStats(currentQuestion.id, result.score);

      // 更新session中的答案和结果
      setSession(prev => {
        if (!prev) return prev;
        const newAnswers = new Map(prev.answers);
        newAnswers.set(currentQuestion.id, currentAnswer);
        const newResults = new Map(prev.results);
        newResults.set(currentQuestion.id, result);
        return { ...prev, answers: newAnswers, results: newResults };
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI评价失败，请稍后重试');
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleSkip = () => {
    if (!session) return;

    setSession(prev => {
      if (!prev) return prev;
      const newSkipped = new Set(prev.skipped);
      newSkipped.add(prev.questions[prev.currentIndex].id);
      return { ...prev, skipped: newSkipped };
    });

    goToNext();
  };

  const goToNext = () => {
    if (!session) return;

    const nextIndex = session.currentIndex + 1;
    if (nextIndex >= session.questions.length) {
      setState('summary');
      // 练习完成，清除保存的状态
      localStorage.removeItem('quick-practice-session');
    } else {
      setSession(prev => prev ? { ...prev, currentIndex: nextIndex } : null);
      setCurrentAnswer('');
      setCurrentResult(null);
      setError(null);
    }
  };

  // ── 保存练习会话状态 ──
  useEffect(() => {
    if (session && state === 'practice') {
      localStorage.setItem('quick-practice-session', JSON.stringify({
        state,
        session: {
          ...session,
          answers: Array.from(session.answers.entries()),
          results: Array.from(session.results.entries()),
          skipped: Array.from(session.skipped),
        },
        currentAnswer,
        currentResult,
        timestamp: Date.now(),
      }));
    }
  }, [session, state, currentAnswer, currentResult]);

  const handleRestart = () => {
    setState('select');
    setSession(null);
    setCurrentAnswer('');
    setCurrentResult(null);
    setError(null);
  };

  // 计算统计
  const getStats = () => {
    if (!session) return { passed: 0, failed: 0, skipped: 0 };
    
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    session.questions.forEach(q => {
      if (session.skipped.has(q.id)) {
        skipped++;
      } else {
        const result = session.results.get(q.id);
        if (result) {
          if (result.score >= 7) passed++;
          else failed++;
        }
      }
    });

    return { passed, failed, skipped };
  };

  return (
    <div>
      {state === 'select' && (
        <div className="practice-card">
          <div className="back-button-container">
            <button className="back-btn" onClick={() => window.history.back()}>
              ← 返回
            </button>
          </div>
          <div className="category-section">
            <div className="category-label">选择类别：</div>
            <div className="category-buttons">
              {CATEGORIES.map((cat) => {
                const count = getQuestionsByCategory(cat).length;
                return (
                  <button
                    key={cat}
                    className={`category-btn ${selectedCategory === cat ? 'primary' : 'outline'}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat} <span className="category-count">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="divider" />
          <div className="start-section">
            <button
              className="start-btn"
              onClick={startPractice}
              disabled={!selectedCategory}
            >
              开始练习
            </button>
          </div>
        </div>
      )}

      {state === 'practice' && session && currentQuestion && (
        <div>
          <div className="practice-card">
            <div className="back-button-container">
              <button 
                className="back-btn" 
                onClick={() => {
                  if (window.confirm('确定要退出练习吗？当前进度将被保存。')) {
                    handleRestart();
                    window.history.back();
                  }
                }}
              >
                ← 返回
              </button>
            </div>
            <div className="progress-section">
              <div className="progress-info">
                <span className="progress-current">{session.currentIndex + 1}</span>
                <span className="progress-divider">/</span>
                <span className="progress-total">{session.questions.length}</span>
                <span className="progress-label">题目</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="question-card">
              <div className="question-header">
                <span className="question-badge">{session.category}</span>
              </div>
              <div className="question-text">{currentQuestion.text}</div>

              <div className="answer-area">
                <div className="answer-label">请输入你的回答：</div>
                <textarea
                  className="answer-textarea"
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  disabled={isEvaluating || !!currentResult}
                  placeholder="请输入你的回答..."
                />
              </div>

              {error && (
                <div style={{ color: 'var(--color-error)', marginTop: 12, fontSize: 13 }}>
                  {error}
                </div>
              )}

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

              {currentResult && (
                <div className="result-card">
                  <div className="result-header">
                    <div className={`score-badge ${currentResult.score >= 7 ? 'pass' : 'fail'}`}>
                      {currentResult.score}
                    </div>
                    <span className="result-label">
                      {currentResult.score >= 7 ? '回答正确' : '回答不正确'}
                    </span>
                  </div>
                  <div className="result-comment">
                    <div className="result-label-small">AI 评语</div>
                    <div className="result-text">{currentResult.comment}</div>
                  </div>
                  <div className="result-comment" style={{ marginTop: 12 }}>
                    <div className="result-label-small">参考答案</div>
                    <div className="result-text">{currentResult.referenceAnswer}</div>
                  </div>
                </div>
              )}

              <div className="action-buttons">
                {!currentResult ? (
                  <>
                    <button
                      className="btn btn-primary"
                      onClick={handleSubmit}
                      disabled={!currentAnswer.trim() || isEvaluating}
                    >
                      {isEvaluating ? 'AI思考中...' : '提交回答'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={handleSkip}
                      disabled={isEvaluating}
                    >
                      换一题
                    </button>
                  </>
                ) : (
                  <button className="btn btn-primary" onClick={goToNext}>
                    {session.currentIndex + 1 >= session.questions.length ? '查看结果' : '下一题'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {state === 'summary' && session && (
        <div className="summary-card">
          <h2 className="summary-title">本轮练习完成</h2>
          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-value pass">{getStats().passed}</span>
              <span className="stat-label">通过 (≥7分)</span>
            </div>
            <div className="stat-item">
              <span className="stat-value fail">{getStats().failed}</span>
              <span className="stat-label">错题 (&lt;7分)</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{getStats().skipped}</span>
              <span className="stat-label">跳过</span>
            </div>
          </div>
          <div className="summary-actions">
            <button className="summary-btn primary" onClick={handleRestart}>
              重新练习
            </button>
            <button 
              className="summary-btn secondary" 
              onClick={() => window.location.href = '/history'}
            >
              查看错题本
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuickPractice;