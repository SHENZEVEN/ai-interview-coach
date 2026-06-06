import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { 
  QuestionBankItem, 
  PracticeProgress, 
  QuestionFilter, 
  Category,
  CustomQuestionInput 
} from '../types';
import {
  getAllQuestions,
  getFilteredQuestions,
  getQuestionById,
  addCustomQuestion,
  updateQuestion,
  deleteQuestion,
  getPracticeProgress,
  addQuestions
} from '../utils/questionBank';
import { CATEGORIES } from '../types';
import { parseDocument, extractQuestions, questionsToBankItems } from '../utils/documentParser';
import '../styles/QuestionBank.css';

const QuestionBank = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<QuestionBankItem[]>([]);
  const [progress, setProgress] = useState<PracticeProgress[]>([]);
  const [filter, setFilter] = useState<QuestionFilter>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [jumpToPage, setJumpToPage] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionBankItem | null>(null);
  const [editKeyPointInput, setEditKeyPointInput] = useState(''); // 编辑时的关键点输入
  const [newQuestion, setNewQuestion] = useState<CustomQuestionInput>({
    text: '',
    keyPoints: [],
    referenceAnswer: '',
    category: '前端',
    difficulty: 'medium'
  });
  const [keyPointInput, setKeyPointInput] = useState('');
  const [importCategory, setImportCategory] = useState<Category>('前端');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // 加载数据
  const loadData = useCallback(() => {
    const filteredQuestions = getFilteredQuestions(filter);
    setQuestions(filteredQuestions);
    setProgress(getPracticeProgress());
    setCurrentPage(1);
  }, [filter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 处理筛选变化
  const handleFilterChange = (key: keyof QuestionFilter, value: any) => {
    setFilter(prev => ({ ...prev, [key]: value }));
  };

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpToPage('');
    }
  };

  const handleJumpKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJumpToPage();
    }
  };

  // 分页数据
  const paginatedQuestions = questions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const totalPages = Math.ceil(questions.length / pageSize);

  // 开始练习
  const startPractice = (questionId: string) => {
    const question = getQuestionById(questionId);
    if (question) {
      // 存储要练习的题目ID，跳转到快速练习页面
      localStorage.setItem('practice_question_id', questionId);
      navigate('/quick');
    }
  };

  // 添加关键点
  const addKeyPoint = () => {
    if (keyPointInput.trim()) {
      setNewQuestion(prev => ({
        ...prev,
        keyPoints: [...prev.keyPoints, keyPointInput.trim()]
      }));
      setKeyPointInput('');
    }
  };

  // 删除关键点
  const removeKeyPoint = (index: number) => {
    setNewQuestion(prev => ({
      ...prev,
      keyPoints: prev.keyPoints.filter((_, i) => i !== index)
    }));
  };

  // 编辑时添加关键点
  const addEditKeyPoint = () => {
    if (editKeyPointInput.trim() && editingQuestion) {
      setEditingQuestion(prev => prev ? {
        ...prev,
        keyPoints: [...prev.keyPoints, editKeyPointInput.trim()]
      } : null);
      setEditKeyPointInput('');
    }
  };

  // 编辑时删除关键点
  const removeEditKeyPoint = (index: number) => {
    if (editingQuestion) {
      setEditingQuestion(prev => prev ? {
        ...prev,
        keyPoints: prev.keyPoints.filter((_, i) => i !== index)
      } : null);
    }
  };

  // 提交新题目
  const handleSubmitNewQuestion = () => {
    if (!newQuestion.text.trim() || !newQuestion.referenceAnswer.trim()) {
      alert('请填写完整题目信息');
      return;
    }

    addCustomQuestion(newQuestion);
    setShowAddModal(false);
    setNewQuestion({
      text: '',
      keyPoints: [],
      referenceAnswer: '',
      category: '前端',
      difficulty: 'medium'
    });
    loadData();
  };

  // 编辑题目
  const handleEditQuestion = () => {
    if (!editingQuestion) return;

    updateQuestion(editingQuestion.id, editingQuestion);
    setShowEditModal(false);
    setEditingQuestion(null);
    setEditKeyPointInput('');
    loadData();
  };

  // 删除题目
  const handleDeleteQuestion = (questionId: string) => {
    if (window.confirm('确定要删除这道题目吗？')) {
      deleteQuestion(questionId);
      loadData();
    }
  };

  // 处理文档上传
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '')) {
      setImportResult('错误：仅支持 PDF、DOCX 和图片格式');
      return;
    }

    setImporting(true);
    setImportResult('');

    try {
      const text = await parseDocument(file);
      const parsedQuestions = extractQuestions(text, importCategory);
      
      if (parsedQuestions.length === 0) {
        setImportResult('未识别到题目，请检查文档格式');
        return;
      }

      const bankItems = questionsToBankItems(parsedQuestions);
      addQuestions(bankItems);
      
      setImportResult(`成功导入 ${parsedQuestions.length} 道题目`);
      loadData();
    } catch (error) {
      setImportResult(`导入失败：${(error as Error).message}`);
    } finally {
      setImporting(false);
    }
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
    
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(extension || '')) {
      setImportResult('错误：仅支持 PDF、DOCX 和图片格式');
      return;
    }

    setImporting(true);
    setImportResult('');

    parseDocument(file)
      .then(text => {
        const parsedQuestions = extractQuestions(text, importCategory);
        
        if (parsedQuestions.length === 0) {
          setImportResult('未识别到题目，请检查文档格式');
          return;
        }

        const bankItems = questionsToBankItems(parsedQuestions);
        addQuestions(bankItems);
        
        setImportResult(`成功导入 ${parsedQuestions.length} 道题目`);
        loadData();
      })
      .catch(error => {
        setImportResult(`导入失败：${(error as Error).message}`);
      })
      .finally(() => {
        setImporting(false);
      });
  };

  // 获取难度标签样式
  const getDifficultyClass = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy': return 'difficulty-easy';
      case 'medium': return 'difficulty-medium';
      case 'hard': return 'difficulty-hard';
      default: return 'difficulty-medium';
    }
  };

  // 获取来源标签样式
  const getSourceClass = (source: string) => {
    switch (source) {
      case 'builtin': return 'source-builtin';
      case 'ai': return 'source-ai';
      case 'custom': return 'source-custom';
      default: return 'source-builtin';
    }
  };

  return (
    <div className="question-bank">
      {/* 进度统计区域 */}
      <div className="progress-section">
        <h2 className="section-title">练习进度</h2>
        <div className="progress-cards">
          {progress.map(stat => (
            <div key={stat.category} className="progress-card">
              <div className="progress-header">
                <span className="progress-category">{stat.category}</span>
                <span className="progress-rate">{stat.correctRate}%</span>
              </div>
              <div className="progress-stats">
                <div className="stat-item">
                  <span className="stat-value">{stat.total}</span>
                  <span className="stat-label">总题数</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stat.completed}</span>
                  <span className="stat-label">已练习</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{stat.mastered}</span>
                  <span className="stat-label">已掌握</span>
                </div>
              </div>
              <div className="progress-bar-container">
                <div 
                  className="progress-bar-fill"
                  style={{ width: `${stat.total > 0 ? (stat.completed / stat.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 筛选区域 */}
      <div className="filter-section">
        <div className="filter-row">
          <div className="filter-group">
            <label>类别</label>
            <select 
              value={filter.category || 'all'}
              onChange={(e) => handleFilterChange('category', e.target.value === 'all' ? undefined : e.target.value)}
            >
              <option value="all">全部</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          
          <div className="filter-group">
            <label>来源</label>
            <select 
              value={filter.source || 'all'}
              onChange={(e) => handleFilterChange('source', e.target.value === 'all' ? undefined : e.target.value)}
            >
              <option value="all">全部</option>
              <option value="builtin">内置</option>
              <option value="ai">AI生成</option>
              <option value="custom">自定义</option>
            </select>
          </div>

          <div className="filter-group">
            <label>难度</label>
            <select 
              value={filter.difficulty || 'all'}
              onChange={(e) => handleFilterChange('difficulty', e.target.value === 'all' ? undefined : e.target.value)}
            >
              <option value="all">全部</option>
              <option value="easy">简单</option>
              <option value="medium">中等</option>
              <option value="hard">困难</option>
            </select>
          </div>

          <div className="filter-group">
            <label>状态</label>
            <select 
              value={filter.isWrong === undefined ? 'all' : filter.isWrong ? 'wrong' : 'correct'}
              onChange={(e) => handleFilterChange('isWrong', e.target.value === 'all' ? undefined : e.target.value === 'wrong')}
            >
              <option value="all">全部</option>
              <option value="wrong">错题</option>
              <option value="correct">正确</option>
            </select>
          </div>

          <div className="filter-group search-group">
            <label>搜索</label>
            <input 
              type="text"
              placeholder="搜索题目内容..."
              value={filter.searchKeyword || ''}
              onChange={(e) => handleFilterChange('searchKeyword', e.target.value)}
            />
          </div>

          <button 
            className="btn btn-primary add-btn"
            onClick={() => setShowAddModal(true)}
          >
            + 添加题目
          </button>
          <button 
            className="btn btn-secondary import-btn"
            onClick={() => setShowImportModal(true)}
          >
            📄 导入文档/图片
          </button>
        </div>
      </div>

      {/* 题目列表 */}
      <div className="questions-list">
        {paginatedQuestions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📚</div>
            <div className="empty-text">暂无符合条件的题目</div>
          </div>
        ) : (
          paginatedQuestions.map(question => (
            <div key={question.id} className="question-item">
              <div className="question-header">
                <div className="question-badges">
                  <span className={`badge category-badge`}>{question.category}</span>
                  <span className={`badge ${getSourceClass(question.source)}`}>
                    {question.source === 'builtin' ? '内置' : question.source === 'ai' ? 'AI生成' : '自定义'}
                  </span>
                  <span className={`badge ${getDifficultyClass(question.difficulty)}`}>
                    {question.difficulty === 'easy' ? '简单' : question.difficulty === 'medium' ? '中等' : '困难'}
                  </span>
                  {question.isWrong && <span className="badge wrong-badge">错题</span>}
                </div>
                <div className="question-stats">
                  <span className="stat">正确率: {question.correctRate}%</span>
                  <span className="stat">练习: {question.totalAttempts}次</span>
                </div>
              </div>
              
              <div className="question-content">
                <h3 className="question-title">{question.text}</h3>
                <p className="question-answer">参考答案: {question.referenceAnswer}</p>
              </div>

              <div className="question-actions">
                <button 
                  className="btn btn-primary"
                  onClick={() => startPractice(question.id)}
                >
                  开始练习
                </button>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingQuestion(question);
                    setEditKeyPointInput('');
                    setShowEditModal(true);
                  }}
                >
                  编辑
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={() => handleDeleteQuestion(question.id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            className="pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(prev => prev - 1)}
          >
            上一页
          </button>
          <span className="pagination-info">
            第 {currentPage} / {totalPages} 页
          </span>
          <button 
            className="pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            下一页
          </button>
          <div className="pagination-jump">
            <input
              type="number"
              className="jump-input"
              placeholder="页码"
              value={jumpToPage}
              onChange={(e) => setJumpToPage(e.target.value)}
              onKeyPress={handleJumpKeyPress}
              min="1"
              max={totalPages}
            />
            <button 
              className="pagination-btn jump-btn"
              onClick={handleJumpToPage}
            >
              跳转
            </button>
          </div>
        </div>
      )}

      {/* 添加题目模态框 */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">添加自定义题目</h3>
            
            <div className="form-group">
              <label>题目内容</label>
              <textarea
                value={newQuestion.text}
                onChange={(e) => setNewQuestion(prev => ({ ...prev, text: e.target.value }))}
                placeholder="请输入题目内容..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>关键点</label>
              <div className="key-points-input">
                <input
                  type="text"
                  value={keyPointInput}
                  onChange={(e) => setKeyPointInput(e.target.value)}
                  placeholder="输入关键点后按回车添加"
                  onKeyPress={(e) => e.key === 'Enter' && addKeyPoint()}
                />
                <button onClick={addKeyPoint}>添加</button>
              </div>
              <div className="key-points-list">
                {newQuestion.keyPoints.map((point, index) => (
                  <span key={index} className="key-point-tag">
                    {point}
                    <button onClick={() => removeKeyPoint(index)}>×</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>参考答案</label>
              <textarea
                value={newQuestion.referenceAnswer}
                onChange={(e) => setNewQuestion(prev => ({ ...prev, referenceAnswer: e.target.value }))}
                placeholder="请输入参考答案..."
                rows={4}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>类别</label>
                <select
                  value={newQuestion.category}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, category: e.target.value as Category }))}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>难度</label>
                <select
                  value={newQuestion.difficulty}
                  onChange={(e) => setNewQuestion(prev => ({ ...prev, difficulty: e.target.value as any }))}
                >
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSubmitNewQuestion}>
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑题目模态框 */}
      {showEditModal && editingQuestion && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">编辑题目</h3>
            
            <div className="form-group">
              <label>题目内容</label>
              <textarea
                value={editingQuestion.text}
                onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, text: e.target.value } : null)}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>关键点</label>
              <div className="key-points-input">
                <input
                  type="text"
                  value={editKeyPointInput}
                  onChange={(e) => setEditKeyPointInput(e.target.value)}
                  placeholder="输入关键点后按回车添加"
                  onKeyPress={(e) => e.key === 'Enter' && addEditKeyPoint()}
                />
                <button onClick={addEditKeyPoint}>添加</button>
              </div>
              <div className="key-points-list">
                {editingQuestion.keyPoints.map((point, index) => (
                  <span key={index} className="key-point-tag">
                    {point}
                    <button onClick={() => removeEditKeyPoint(index)}>×</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>参考答案</label>
              <textarea
                value={editingQuestion.referenceAnswer}
                onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, referenceAnswer: e.target.value } : null)}
                rows={4}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>类别</label>
                <select
                  value={editingQuestion.category}
                  onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, category: e.target.value as Category } : null)}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>难度</label>
                <select
                  value={editingQuestion.difficulty}
                  onChange={(e) => setEditingQuestion(prev => prev ? { ...prev, difficulty: e.target.value as any } : null)}
                >
                  <option value="easy">简单</option>
                  <option value="medium">中等</option>
                  <option value="hard">困难</option>
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleEditQuestion}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 导入文档模态框 */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h3 className="modal-title">📄 导入文档题库</h3>
            
            <div className="form-group">
              <label>目标类别</label>
              <select
                value={importCategory}
                onChange={(e) => setImportCategory(e.target.value as Category)}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>上传文件</label>
              <div 
                className={`file-upload-area ${isDragging ? 'dragover' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".pdf,.docx,.jpg,.jpeg,.png,.gif,.bmp,.webp"
                  onChange={handleFileUpload}
                  disabled={importing}
                  className="file-input"
                />
                <div className="file-upload-hint">
                  <span className="upload-icon">📁</span>
                  <span>点击或拖拽上传 PDF、Word 文档或图片</span>
                </div>
                {isDragging && (
                  <div className="drop-overlay">
                    <span className="drop-icon">📄</span>
                    <span className="drop-text">松开上传文件</span>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>文档格式要求</label>
              <div className="format-tips">
                <p>• 题目需以数字序号开头（如：1.、2.、3、1、一、二）</p>
                <p>• 答案需包含"答案"、"参考答案"或"解析"关键字</p>
                <p>• 示例：</p>
                <pre>
1. TCP的三次握手过程是什么？
答案：第一次...

2. 什么是HTTP缓存？
参考答案：...
                </pre>
              </div>
            </div>

            {importResult && (
              <div className={`import-result ${importResult.includes('成功') ? 'success' : 'error'}`}>
                {importResult}
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowImportModal(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionBank;