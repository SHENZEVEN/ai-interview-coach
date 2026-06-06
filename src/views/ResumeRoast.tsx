import { useState, useCallback } from 'react';
import { parseDocument } from '../utils/documentParser';
import {
  analyzeResume,
  generateInterviewQuestions,
  evaluateAnswer,
  generateInterviewReport,
  exportInterviewReportToWord,
  exportInterviewReportToJSON,
  ResumeAnalysis,
  InterviewQuestion,
  AnswerEvaluation,
  InterviewResult
} from '../services/resumeRoastService';
import '../styles/ResumeRoast.css';

interface AnswerRecord {
  questionId: number;
  answer: string;
  evaluation: AnswerEvaluation;
}

type Stage = 'upload' | 'analyzing' | 'ready' | 'interviewing' | 'reporting';

const ResumeRoast = () => {
  // 阶段状态
  const [stage, setStage] = useState<Stage>('upload');
  const [resumeText, setResumeText] = useState('');
  const [resumeAnalysis, setResumeAnalysis] = useState<ResumeAnalysis | null>(null);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [currentEvaluation, setCurrentEvaluation] = useState<AnswerEvaluation | null>(null);
  const [interviewResult, setInterviewResult] = useState<InterviewResult | null>(null);
  
  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0); // 0-100
  const [reportProgress, setReportProgress] = useState(0); // 0-100

  // 处理文件上传
  const processFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '')) {
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

  // 文件上传处理
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  // 拖拽处理
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

  // 开始分析简历
  const handleStartAnalysis = async () => {
    if (!resumeText.trim()) {
      setError('请先上传简历或粘贴简历内容');
      return;
    }

    setIsLoading(true);
    setError(null);
    setStage('analyzing');
    setAnalysisProgress(0);

    try {
      // 分析简历 (20%)
      await delay(500);
      setAnalysisProgress(20);
      const analysis = await analyzeResume(resumeText);
      
      // 分析完成 (40%)
      await delay(300);
      setAnalysisProgress(40);
      setResumeAnalysis(analysis);

      // 生成面试问题 (60%)
      await delay(500);
      setAnalysisProgress(60);
      const generatedQuestions = await generateInterviewQuestions(analysis, 5);
      
      // 问题生成完成 (80%)
      await delay(300);
      setAnalysisProgress(80);
      
      // 检查是否成功生成问题
      if (!generatedQuestions || generatedQuestions.length === 0) {
        throw new Error('未能生成面试问题，请重试');
      }
      
      // 准备完成 (100%)
      await delay(200);
      setAnalysisProgress(100);
      setQuestions(generatedQuestions);
      
      await delay(300);
      setStage('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析失败，请重试');
      setStage('upload');
    } finally {
      setIsLoading(false);
    }
  };

  // 延迟函数
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // 开始面试
  const handleStartInterview = () => {
    setStage('interviewing');
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setCurrentAnswer('');
  };

  // 提交回答（直接保存，不显示评估结果）
  const handleSubmitAnswer = async () => {
    if (!currentAnswer.trim()) {
      setError('请输入你的回答');
      return;
    }

    const currentQuestion = questions[currentQuestionIndex];
    if (!currentQuestion) return;

    setIsLoading(true);
    setError(null);

    try {
      // 评估回答（后台进行，不立即显示）
      const evaluation = await evaluateAnswer(
        currentQuestion,
        currentAnswer,
        resumeText
      );

      // 保存回答记录
      setAnswers(prev => [...prev, {
        questionId: currentQuestion.id,
        answer: currentAnswer,
        evaluation
      }]);

      // 直接进入下一题或生成报告
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(prev => prev + 1);
        setCurrentAnswer('');
      } else {
        // 面试结束，生成报告
        handleGenerateReport();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '评估失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 生成面试报告
  const handleGenerateReport = async () => {
    setIsLoading(true);
    setError(null);
    setStage('reporting');
    setReportProgress(0);

    try {
      // 汇总数据 (30%)
      await delay(300);
      setReportProgress(30);
      
      // 生成报告 (60%)
      await delay(500);
      setReportProgress(60);
      
      const result = await generateInterviewReport(questions, answers, resumeAnalysis!);
      
      // 完成 (100%)
      await delay(300);
      setReportProgress(100);
      
      await delay(200);
      setInterviewResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成报告失败，请重试');
      setStage('interviewing');
    } finally {
      setIsLoading(false);
    }
  };

  // 重新开始
  const handleRestart = () => {
    setStage('upload');
    setResumeText('');
    setResumeAnalysis(null);
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setCurrentAnswer('');
    setAnswers([]);
    setCurrentEvaluation(null);
    setInterviewResult(null);
    setError(null);
  };

  // 获取评分颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'score-excellent';
    if (score >= 60) return 'score-good';
    if (score >= 40) return 'score-average';
    return 'score-poor';
  };

  // 获取评分标签
  const getScoreLabel = (score: number) => {
    if (score >= 80) return '优秀';
    if (score >= 60) return '良好';
    if (score >= 40) return '一般';
    return '较差';
  };

  return (
    <div className="resume-roast-container">
      <div className="roast-header">
        <h1 className="roast-title">🔥 简历拷打</h1>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      {/* 上传阶段 */}
      {stage === 'upload' && (
        <div className="stage-card upload-stage">
          <h2>第一步：上传简历</h2>
          <p className="stage-hint">支持 PDF、Word 和图片格式</p>
          
          <div
            className={`upload-area ${isDragging ? 'dragover' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <textarea
              className="resume-input"
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="粘贴简历内容到此处，或直接拖拽简历文件到此处...

也可以点击下方按钮选择文件上传"
              disabled={isLoading}
            />
            {isDragging && (
              <div className="drop-overlay">
                <span className="drop-icon">📄</span>
                <span className="drop-text">松开上传简历</span>
              </div>
            )}
          </div>

          <div className="upload-actions">
            <label className="upload-btn">
              <input
                type="file"
                accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                onChange={handleFileUpload}
                disabled={isLoading}
              />
              📎 选择文件
            </label>
            <button
              className="analyze-btn"
              onClick={handleStartAnalysis}
              disabled={!resumeText.trim() || isLoading}
            >
              {isLoading ? '分析中...' : '开始拷打'}
            </button>
          </div>
        </div>
      )}

      {/* 分析阶段 */}
      {stage === 'analyzing' && (
        <div className="stage-card analyzing-stage">
          <div className="loading-spinner">🔥</div>
          <h2>正在分析你的简历...</h2>
          <p>面试官正在仔细阅读，准备发起灵魂拷问</p>
          
          {/* 像素风格进度条 */}
          <div className="pixel-progress-container">
            <div className="pixel-progress-bar">
              {Array.from({ length: 10 }).map((_, i) => (
                <div
                  key={i}
                  className={`pixel-block ${analysisProgress >= (i + 1) * 10 ? 'filled' : 'empty'}`}
                />
              ))}
            </div>
            <span className="progress-text">{analysisProgress}%</span>
          </div>
        </div>
      )}

      {/* 准备阶段 */}
      {stage === 'ready' && resumeAnalysis && (
        <div className="stage-card ready-stage">
          <h2>📋 简历分析完成</h2>
          
          <div className="analysis-card">
            <div className="analysis-item">
              <span className="analysis-label">姓名</span>
              <span className="analysis-value">{resumeAnalysis.name || '未知'}</span>
            </div>
            <div className="analysis-item">
              <span className="analysis-label">学历</span>
              <span className="analysis-value">
                {typeof resumeAnalysis.education === 'object' 
                  ? `${resumeAnalysis.education.degree || ''} ${resumeAnalysis.education.school || ''} ${resumeAnalysis.education.major || ''}`.trim() || '未知'
                  : resumeAnalysis.education || '未知'}
              </span>
            </div>
            <div className="analysis-item">
              <span className="analysis-label">技能</span>
              <span className="analysis-value">
                {resumeAnalysis.skills?.join('、') || '未知'}
              </span>
            </div>
            <div className="analysis-item full-width">
              <span className="analysis-label">简历评价</span>
              <span className="analysis-value">{resumeAnalysis.summary}</span>
            </div>
          </div>

          <div className="questions-preview">
            <h3>📝 面试问题预览（{questions.length}道）</h3>
            <ul>
              {questions.map((q, i) => (
                <li key={q.id}>
                  <span className="q-number">Q{i + 1}</span>
                  <span className="q-category">[{q.category}]</span>
                  {q.question}
                </li>
              ))}
            </ul>
          </div>

          <div className="ready-actions">
            <button className="restart-btn" onClick={handleRestart}>
              重新上传
            </button>
            <button className="start-btn" onClick={handleStartInterview}>
              开始面试
            </button>
          </div>
        </div>
      )}

      {/* 面试阶段 */}
      {stage === 'interviewing' && questions.length > 0 && (
        <div className="stage-card interview-stage">
          <div className="interview-progress">
            <span>问题 {currentQuestionIndex + 1} / {questions.length}</span>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="current-question">
            <span className="question-category">
              [{questions[currentQuestionIndex].category}]
            </span>
            <h3>{questions[currentQuestionIndex].question}</h3>
          </div>

          <div className="answer-section">
            <textarea
              className="answer-input"
              value={currentAnswer}
              onChange={(e) => setCurrentAnswer(e.target.value)}
              placeholder="请输入你的回答..."
              rows={6}
              disabled={isLoading}
            />

            <button
              className="submit-btn"
              onClick={handleSubmitAnswer}
              disabled={!currentAnswer.trim() || isLoading}
            >
              {isLoading ? '提交中...' : '提交回答'}
            </button>
          </div>

          {/* 已回答的问题 */}
          {answers.length > 0 && (
            <div className="answered-questions">
              <h4>已回答问题</h4>
              <div className="answers-list">
                {answers.map((a, i) => (
                  <div key={a.questionId} className="answered-item">
                    <span className="q-badge">Q{questions.findIndex(q => q.id === a.questionId) + 1}</span>
                    <span className="answered-check">✓</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 报告阶段 */}
      {stage === 'reporting' && (
        <div className="stage-card report-stage">
          {isLoading ? (
            <div className="generating-report">
              <h2>正在生成面试报告...</h2>
              <p>面试官正在写评语，请稍候</p>
              
              {/* 像素风格进度条 */}
              <div className="pixel-progress-container">
                <div className="pixel-progress-bar report">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`pixel-block ${reportProgress >= (i + 1) * 10 ? 'filled-report' : 'empty'}`}
                    />
                  ))}
                </div>
                <span className="progress-text">{reportProgress}%</span>
              </div>
            </div>
          ) : interviewResult ? (
            <>
              <div className="report-header">
                <h2>📋 面试评估报告</h2>
                <div className="report-actions">
                  <button className="export-btn" onClick={() => exportInterviewReportToJSON(interviewResult)}>
                    📄 JSON
                  </button>
                  <button className="export-btn" onClick={() => exportInterviewReportToWord(interviewResult)}>
                    📝 Word
                  </button>
                  <button className="restart-btn-small" onClick={handleRestart}>
                    🔄 重新开始
                  </button>
                </div>
              </div>

              {/* 总分 */}
              <div className="total-score-section">
                <div className={`total-score ${getScoreColor(interviewResult.totalScore)}`}>
                  <span className="score-number">{interviewResult.totalScore}</span>
                  <span className="score-unit">分</span>
                </div>
                <span className="total-label">{getScoreLabel(interviewResult.totalScore)}</span>
              </div>

              {/* 各类别分数 */}
              <div className="category-scores">
                {interviewResult.categoryScores.map((cat, i) => (
                  <div key={i} className="category-score-item">
                    <div className="cat-info">
                      <span className="cat-name">{cat.category}</span>
                      <span className="cat-weight">({cat.weight}%)</span>
                    </div>
                    <div className="cat-bar">
                      <div 
                        className={`cat-fill ${getScoreColor(cat.score)}`}
                        style={{ width: `${cat.score}%` }}
                      />
                    </div>
                    <span className={`cat-score ${getScoreColor(cat.score)}`}>{cat.score}分</span>
                  </div>
                ))}
              </div>

              {/* 整体评价 */}
              <div className="overall-comment">
                <h3>📝 整体评价</h3>
                <p>{interviewResult.overallComment}</p>
              </div>

              {/* 优缺点 */}
              <div className="sw-section">
                <div className="strengths-section">
                  <h3>✅ 优点</h3>
                  <ul>
                    {interviewResult.strengths.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div className="weaknesses-section">
                  <h3>❌ 缺点</h3>
                  <ul>
                    {interviewResult.weaknesses.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* 建议 */}
              <div className="suggestions-section">
                <h3>💡 改进建议</h3>
                <ol>
                  {interviewResult.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>

              {/* 每题详细评分 */}
              <div className="questions-detail-section">
                <h3>📝 每题详细评分</h3>
                <div className="questions-detail-list">
                  {questions.map((q, qIndex) => {
                    const answer = answers.find(a => a.questionId === q.id);
                    if (!answer) return null;
                    return (
                      <div key={q.id} className="question-detail-item">
                        <div className="q-header">
                          <span className="q-number">Q{qIndex + 1}</span>
                          <span className={`q-score ${getScoreColor(answer.evaluation.score)}`}>
                            {answer.evaluation.score}分
                          </span>
                          <span className="q-category">[{q.category}]</span>
                        </div>
                        <div className="q-content">
                          <div className="q-question">
                            <span className="label">题目：</span>
                            <span>{q.question}</span>
                          </div>
                          <div className="q-answer">
                            <span className="label">你的回答：</span>
                            <span>{answer.answer}</span>
                          </div>
                          {answer.evaluation.strengths.length > 0 && (
                            <div className="q-strengths">
                              <span className="label">✅ 优点：</span>
                              <span>{answer.evaluation.strengths.join('；')}</span>
                            </div>
                          )}
                          {answer.evaluation.weaknesses.length > 0 && (
                            <div className="q-weaknesses">
                              <span className="label">❌ 不足：</span>
                              <span>{answer.evaluation.weaknesses.join('；')}</span>
                            </div>
                          )}
                          <div className="q-improvement">
                            <span className="label">💡 建议：</span>
                            <span>{answer.evaluation.improvement}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default ResumeRoast;