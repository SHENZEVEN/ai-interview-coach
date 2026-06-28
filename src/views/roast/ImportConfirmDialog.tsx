import { useState } from 'react';
import type { SavedPrep } from '../../services/prepStorage';
import { parseDocument } from '../../utils/documentParser';
import { CYAN, GREEN, DIM, CARD, BORDER } from '../../theme/colors';

interface ImportConfirmDialogProps {
  prep: SavedPrep;
  isLoading: boolean;
  onConfirm: (prep: SavedPrep, resumeText: string) => void;
  onCancel: () => void;
}

const ImportConfirmDialog = ({ prep, isLoading, onConfirm, onCancel }: ImportConfirmDialogProps) => {
  const [dialogResumeText, setDialogResumeText] = useState('');
  const [dialogResumeFile, setDialogResumeFile] = useState('');
  const [isDraggingDialogResume, setIsDraggingDialogResume] = useState(false);
  const [isParsing, setIsParsing] = useState(false);

  const processFile = async (file: File): Promise<string> => {
    setIsParsing(true);
    try {
      return await parseDocument(file);
    } finally {
      setIsParsing(false);
    }
  };

  const handleCancel = () => {
    setDialogResumeText('');
    setDialogResumeFile('');
    onCancel();
  };

  return (
    <div
      onClick={handleCancel}
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
            📋 {prep.meta.role_name} @ {prep.meta.company_name || '未知公司'}
          </div>
          <div style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
            <div>📅 生成于：{new Date(prep.meta.generated_at).toLocaleString('zh-CN')}</div>
            <div>🎯 方向：{prep.meta.direction === 'E' ? 'AI产品' : 'AI全栈开发'}</div>
            <div>📊 难度：{prep.meta.difficulty}</div>
            <div>💾 保存于：{new Date(prep.savedAt).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
        </div>
        <p style={{ color: '#ccc', fontSize: 13, lineHeight: 1.6, margin: '0 0 16px' }}>
          确认使用此文档启动针对性面试？系统将基于该文档的预测题库和 Gap 清单出题。
        </p>

        {/* 简历导入区（可选）*/}
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
            onClick={handleCancel}
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
              onConfirm(prep, resumeToUse);
            }}
            disabled={isLoading || isParsing}
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
  );
};

export default ImportConfirmDialog;
