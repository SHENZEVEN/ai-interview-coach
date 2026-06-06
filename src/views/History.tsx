import { useState, useEffect, useCallback } from 'react';
import { HistoryRecord } from '../types';
import { 
  getHistoryRecords, 
  clearAllHistory,
  updateHistoryRecord
} from '../utils/storage';
import { exportHistoryRecords } from '../utils/exportHistory';
import '../styles/History.css';

type TabType = 'all' | 'wrong';
type ExportFormat = 'json' | 'word';

const History = () => {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedRecord, setSelectedRecord] = useState<HistoryRecord | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const loadRecords = useCallback(() => {
    const data = activeTab === 'wrong' 
      ? getHistoryRecords().filter(r => r.isWrong)
      : getHistoryRecords();
    setRecords(data.slice(0, 50)); // 显示最近50条
  }, [activeTab]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleExport = (format: ExportFormat) => {
    const allRecords = getHistoryRecords();
    exportHistoryRecords(allRecords, format);
    setShowExportMenu(false);
    showToastMessage('导出成功');
  };

  const handleClear = () => {
    clearAllHistory();
    setRecords([]);
    setShowClearConfirm(false);
    showToastMessage('历史记录已清空');
  };

  const handleRetry = (record: HistoryRecord) => {
    // 跳转到对应模式并携带题目信息
    if (record.mode === 'quick') {
      window.location.href = '/quick';
    } else {
      window.location.href = '/targeted';
    }
  };

  const showToastMessage = (message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const allRecords = getHistoryRecords();
  const wrongCount = allRecords.filter(r => r.isWrong).length;

  const displayedRecords = activeTab === 'wrong'
    ? allRecords.filter(r => r.isWrong).slice(0, 50)
    : allRecords.slice(0, 50);

  return (
    <div>
      <div className="history-card">
        <div className="history-header">
          <h2 className="history-title">历史记录</h2>
          <div className="history-actions">
            <div className="export-dropdown">
              <button 
                className="action-btn primary"
                onClick={() => setShowExportMenu(!showExportMenu)}
                disabled={allRecords.length === 0}
              >
                导出数据 ▾
              </button>
              {showExportMenu && (
                <div className="export-menu">
                  <button 
                    className="export-menu-item"
                    onClick={() => handleExport('json')}
                  >
                    📄 JSON 格式
                  </button>
                  <button 
                    className="export-menu-item"
                    onClick={() => handleExport('word')}
                  >
                    📝 Word 文档
                  </button>
                </div>
              )}
            </div>
            <button 
              className="action-btn danger" 
              onClick={() => setShowClearConfirm(true)}
              disabled={allRecords.length === 0}
            >
              清空全部
            </button>
          </div>
        </div>

        <div className="tabs">
          <button 
            className={`tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            全部记录
            <span className="tab-count">({allRecords.length})</span>
          </button>
          <button 
            className={`tab ${activeTab === 'wrong' ? 'active' : ''}`}
            onClick={() => setActiveTab('wrong')}
          >
            错题本
            <span className="tab-count">({wrongCount})</span>
          </button>
        </div>

        {displayedRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-text">
              {activeTab === 'all' ? '暂无历史记录' : '暂无错题记录'}
            </div>
          </div>
        ) : (
          <div className="record-list">
            {displayedRecords.map((record) => (
              <div 
                key={record.id} 
                className="record-item"
                onClick={() => setSelectedRecord(record)}
              >
                <div className="record-header">
                  <div className="record-badges">
                    <span className="record-badge mode">
                      {record.mode === 'quick' ? '快速练习' : '针对性练习'}
                    </span>
                    {record.category && (
                      <span className="record-badge category">{record.category}</span>
                    )}
                    {record.isWrong && (
                      <span className="record-badge wrong">错题</span>
                    )}
                  </div>
                  <span className={`record-score ${record.score >= 7 ? 'pass' : 'fail'}`}>
                    {record.score}分
                  </span>
                </div>
                <div className="record-question">{record.questionText}</div>
                <div className="record-meta">
                  <span>{formatDate(record.timestamp)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 详情弹窗 */}
      {selectedRecord && (
        <div className="detail-modal" onClick={() => setSelectedRecord(null)}>
          <div className="detail-card" onClick={e => e.stopPropagation()}>
            <div className="detail-header">
              <div className="detail-badges">
                <span className="record-badge mode">
                  {selectedRecord.mode === 'quick' ? '快速练习' : '针对性练习'}
                </span>
                {selectedRecord.category && (
                  <span className="record-badge category">{selectedRecord.category}</span>
                )}
                {selectedRecord.isWrong && (
                  <span className="record-badge wrong">错题</span>
                )}
              </div>
              <button 
                className="detail-close"
                onClick={() => setSelectedRecord(null)}
              >
                ×
              </button>
            </div>

            <div className="detail-section">
              <div className="detail-score">
                <div className={`detail-score-badge ${selectedRecord.score >= 7 ? 'pass' : 'fail'}`}>
                  {selectedRecord.score}
                </div>
                <span className="result-label">
                  {selectedRecord.score >= 7 ? '回答正确' : '回答不正确'}
                </span>
              </div>
            </div>

            <div className="detail-section">
              <div className="detail-label">题目</div>
              <div className="detail-text">{selectedRecord.questionText}</div>
            </div>

            <div className="detail-section">
              <div className="detail-label">我的回答</div>
              <div className="detail-text">{selectedRecord.userAnswer}</div>
            </div>

            <div className="detail-section">
              <div className="detail-label">AI 评语</div>
              <div className="detail-text">{selectedRecord.comment}</div>
            </div>

            <div className="detail-section">
              <div className="detail-label">参考答案</div>
              <div className="detail-text">{selectedRecord.referenceAnswer}</div>
            </div>

            {selectedRecord.jdText && (
              <div className="detail-section">
                <div className="detail-label">相关 JD（节选）</div>
                <div className="detail-text">{selectedRecord.jdText}</div>
              </div>
            )}

            <div className="detail-section">
              <div className="detail-label">作答时间</div>
              <div className="detail-text">{formatDate(selectedRecord.timestamp)}</div>
            </div>

            {selectedRecord.isWrong && (
              <div className="record-actions">
                <button 
                  className="record-btn primary"
                  onClick={() => handleRetry(selectedRecord)}
                >
                  再次挑战
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 确认清空弹窗 */}
      {showClearConfirm && (
        <div className="confirm-modal">
          <div className="confirm-card">
            <div className="confirm-title">确认清空全部历史记录？</div>
            <div className="confirm-text">
              此操作不可恢复，清空后所有练习记录将被删除。
            </div>
            <div className="confirm-actions">
              <button 
                className="confirm-btn cancel"
                onClick={() => setShowClearConfirm(false)}
              >
                取消
              </button>
              <button 
                className="confirm-btn danger"
                onClick={handleClear}
              >
                确认清空
              </button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className="toast">{toastMessage}</div>
      )}
    </div>
  );
};

export default History;