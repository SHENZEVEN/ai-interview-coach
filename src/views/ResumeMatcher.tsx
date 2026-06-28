import { useState, useRef, useEffect } from 'react';
import { matchResumeToJd, MatchResponse } from '../services/prepService';
import { parseDocument } from '../utils/documentParser';
import { CYAN, MAGENTA, GREEN, YELLOW, RED, DIM, CARD, BORDER } from '../theme/colors';

type Stage = 'input' | 'matching' | 'result';

// ── 文件拖拽区（独立组件，避免 hook 嵌套）──
function DropZone({
  target, label, value, onTextChange, onError,
}: {
  target: 'resume' | 'jd';
  label: string;
  value: string;
  onTextChange: (text: string) => void;
  onError: (msg: string) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    onError('');
    try {
      const text = await parseDocument(file);
      if (!text || !text.trim()) {
        onError('文件解析结果为空，请检查文件内容或手动粘贴');
        return;
      }
      onTextChange(text);
    } catch (err: any) {
      console.error('[ResumeMatcher] file parse error:', err);
      onError(`文件解析失败: ${err?.message || '未知错误'}。请尝试粘贴文本`);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 14, color: CYAN, marginBottom: 8, fontWeight: 600 }}>{label}</div>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${isDragging ? CYAN : BORDER}`, borderRadius: 8, padding: 12,
          textAlign: 'center', cursor: 'pointer', background: isDragging ? 'rgba(0,240,255,0.03)' : CARD,
          marginBottom: 8, transition: 'border-color 0.2s',
          fontSize: 12, color: DIM,
        }}
      >
        📎 拖拽文件或点击上传（PDF / DOCX / 图片 / TXT / MD）
      </div>
      <input
        type="file"
        ref={inputRef}
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        accept=".pdf,.docx,.doc,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt,.md"
      />
      <textarea
        value={value}
        onChange={(e) => onTextChange(e.target.value)}
        placeholder={target === 'resume' ? '粘贴简历内容，或拖拽/点击上传文件...' : '粘贴岗位描述，或拖拽/点击上传文件...'}
        style={{
          width: '100%', minHeight: target === 'resume' ? 160 : 120, padding: 12,
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8,
          color: '#ccc', fontSize: 13, fontFamily: 'inherit', resize: 'vertical',
          outline: 'none', boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

// ── 匹配度环形指示器 ──
function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 70 ? GREEN : score >= 50 ? YELLOW : RED;

  return (
    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
      <svg width={140} height={140} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={70} cy={70} r={radius} fill="none" stroke={BORDER} strokeWidth={strokeWidth} />
        <circle
          cx={70} cy={70} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 36, fontWeight: 700, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 12, color: DIM, marginTop: 2 }}>/ 100</span>
      </div>
    </div>
  );
}

// ── 分类卡片 ──
function CategoryCard({ title, items, color, icon }: { title: string; items: string[]; color: string; icon: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 18, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 14, fontWeight: 600, color, marginBottom: 10 }}>
        {icon} {title} <span style={{ color: DIM, fontWeight: 400 }}>({items.length})</span>
      </div>
      {items.map((item, i) => (
        <div key={i} style={{ fontSize: 13, color: '#aaa', marginBottom: 6, paddingLeft: 8, borderLeft: `2px solid ${BORDER}` }}>
          {item}
        </div>
      ))}
    </div>
  );
}

// ── 主组件 ──
interface Props {
  onSwitchToPrep: (resume: string, jd: string) => void;
}

export default function ResumeMatcher({ onSwitchToPrep }: Props) {
  const [stage, setStage] = useState<Stage>('input');
  const [resumeText, setResumeText] = useState('');
  const [jdText, setJdText] = useState('');
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [error, setError] = useState('');

  // ── 状态持久化：恢复之前的匹配状态 ──
  useEffect(() => {
    const savedState = localStorage.getItem('resume-matcher-state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed.stage === 'matching' && parsed.resumeText && parsed.jdText) {
          setResumeText(parsed.resumeText);
          setJdText(parsed.jdText);
          setStage('matching');
          localStorage.removeItem('resume-matcher-state');
        }
      } catch (e) {
        console.error('恢复匹配状态失败:', e);
      }
    }
  }, []);

  const handleMatch = async () => {
    if (!resumeText.trim()) { setError('请提供简历内容'); return; }
    if (!jdText.trim()) { setError('请提供JD内容'); return; }
    setError('');
    setStage('matching');

    // 保存状态到 localStorage
    localStorage.setItem('resume-matcher-state', JSON.stringify({
      stage: 'matching',
      resumeText,
      jdText,
      timestamp: Date.now(),
    }));

    try {
      const res = await matchResumeToJd({ resume_text: resumeText, jd_text: jdText });
      setResult(res);
      setStage('result');
      localStorage.removeItem('resume-matcher-state');
    } catch (e: any) {
      setError(e.message || '匹配分析失败，请重试');
      setStage('input');
      localStorage.removeItem('resume-matcher-state');
    }
  };

  if (stage === 'matching') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, padding: 40 }}>
        <div style={{ fontSize: 18, color: CYAN, marginBottom: 16 }}>🔍 正在分析匹配度...</div>
        <div style={{ fontSize: 13, color: DIM }}>AI 正在逐条对比你的简历和 JD</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: CYAN, animation: `pulse 1.2s ${i * 0.15}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  if (stage === 'result' && result) {
    return (
      <div style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 28, textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 13, color: DIM, marginBottom: 12 }}>简历—岗位匹配度</div>
          <ScoreRing score={result.match_score} />
          <div style={{ marginTop: 16, fontSize: 14, color: '#aaa', fontStyle: 'italic', maxWidth: 500, margin: '16px auto 0' }}>
            💡 {result.core_intent}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
          <CategoryCard title="已覆盖" items={result.covered} color={GREEN} icon="✅" />
          <CategoryCard title="可深挖" items={result.diggable} color={CYAN} icon="⚠️" />
          <CategoryCard title="缺失项" items={result.missing} color={RED} icon="❌" />
          <CategoryCard title="需调整" items={result.mismatched} color={YELLOW} icon="🔄" />
        </div>

        {result.requirement_matching && result.requirement_matching.length > 0 && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: CYAN, marginBottom: 14 }}>📋 JD 逐条匹配分析</div>
            {result.requirement_matching.map((item, i) => (
              <div key={i} style={{ padding: '10px 0', borderBottom: i < result.requirement_matching.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                    background: item.match_level.includes('强') ? 'rgba(34,255,34,0.1)' : item.match_level.includes('中') ? 'rgba(255,255,0,0.1)' : 'rgba(255,68,68,0.1)',
                    color: item.match_level.includes('强') ? GREEN : item.match_level.includes('中') ? YELLOW : RED,
                  }}>{item.match_level}</span>
                  <span style={{ fontSize: 13, color: '#ccc' }}>{item.requirement}</span>
                </div>
                {item.resume_evidence && <div style={{ fontSize: 12, color: DIM, marginLeft: 4 }}>📄 简历证据：{item.resume_evidence}</div>}
                <div style={{ fontSize: 12, marginLeft: 4, marginTop: 2 }}><span style={{ color: YELLOW }}>⚠️ {item.gap_risk}</span></div>
                <div style={{ fontSize: 12, marginLeft: 4 }}><span style={{ color: CYAN }}>💡 面试策略：{item.strategy}</span></div>
              </div>
            ))}
          </div>
        )}

        {result.prep_suggestions && result.prep_suggestions.length > 0 && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20, marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: MAGENTA, marginBottom: 12 }}>🎯 面试备考建议</div>
            {result.prep_suggestions.map((s, i) => (
              <div key={i} style={{ fontSize: 13, color: '#aaa', marginBottom: 8, paddingLeft: 12, borderLeft: `2px solid ${MAGENTA}` }}>{i + 1}. {s}</div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => { setStage('input'); setResult(null); }} style={{ padding: '10px 24px', background: 'transparent', color: DIM, border: `1px solid ${BORDER}`, borderRadius: 8, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit' }}>← 重新匹配</button>
          <button onClick={() => onSwitchToPrep(resumeText, jdText)} style={{ padding: '10px 24px', background: CYAN, color: '#000', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, fontFamily: 'inherit' }}>📋 基于匹配结果，生成完整备战文档 →</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
      {error && (
        <div style={{ background: 'rgba(255,68,68,0.1)', border: `1px solid ${RED}`, borderRadius: 8, padding: 10, marginBottom: 16, fontSize: 13, color: RED }}>
          ⚠️ {error}
          <button onClick={() => setError('')} style={{ marginLeft: 12, background: 'none', border: 'none', color: RED, cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
      )}

      <DropZone
        target="resume"
        label="📄 简历"
        value={resumeText}
        onTextChange={setResumeText}
        onError={setError}
      />

      <div style={{ height: 16 }} />

      <DropZone
        target="jd"
        label="📋 岗位描述 (JD)"
        value={jdText}
        onTextChange={setJdText}
        onError={setError}
      />

      <div style={{ marginTop: 20, textAlign: 'center' }}>
        <button onClick={handleMatch} style={{ padding: '12px 40px', background: CYAN, color: '#000', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 700, fontFamily: 'inherit' }}>
          🔍 开始匹配
        </button>
        <div style={{ marginTop: 10, fontSize: 12, color: DIM }}>
          仅需简历 + JD，约 5-10 秒出结果。不会联网，仅做语义匹配分析。
        </div>
      </div>
    </div>
  );
}
