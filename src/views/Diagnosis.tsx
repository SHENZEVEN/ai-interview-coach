import { useState } from 'react';
import {
  fetchDiagnosis,
  CognitiveDiagnosis,
  RadarEntry,
  TimelinePoint,
} from '../services/diagnosisService';
import { CYAN, MAGENTA, GREEN, YELLOW, DIM, BG } from '../theme/colors';

// ── SVG 雷达图（≥3维）或条形图（<3维）──
export const RadarChart = ({ data }: { data: Record<string, RadarEntry> }) => {
  const entries = Object.entries(data);
  const n = entries.length;

  // 维度不足时显示条形图
  if (n < 3) {
    const barW = 280, barH = 20, gap = 12, padL = 60;
    const svgH = n * (barH + gap) + 20;
    return (
      <svg viewBox={`0 0 ${barW + padL} ${svgH}`} width="100%" height={svgH}>
        {entries.map(([name, entry], i) => {
          const y = 10 + i * (barH + gap);
          return (
            <g key={name}>
              <text x={0} y={y + barH / 2 + 4} fill="#aaa" fontSize="10" fontFamily="monospace" textAnchor="start">{name}</text>
              {/* 覆盖度 */}
              <rect x={padL} y={y} width={entry.coverage * barW} height={barH / 2 - 2} fill="rgba(0,240,255,0.4)" stroke={CYAN} strokeWidth="0.5" />
              <text x={padL + entry.coverage * barW + 4} y={y + barH / 4 + 2} fill={CYAN} fontSize="8" fontFamily="monospace">覆盖 {Math.round(entry.coverage * 100)}%</text>
              {/* 深度 */}
              <rect x={padL} y={y + barH / 2} width={(entry.depth / 10) * barW} height={barH / 2 - 2} fill="rgba(255,0,255,0.3)" stroke={MAGENTA} strokeWidth="0.5" />
              <text x={padL + (entry.depth / 10) * barW + 4} y={y + barH * 0.75 + 2} fill={MAGENTA} fontSize="8" fontFamily="monospace">深度 {entry.depth}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  const cx = 150, cy = 150, r = 110;
  const levels = 5; // 同心圆层数

  // 计算多边形顶点
  const angleStep = (2 * Math.PI) / n;
  const getPoint = (i: number, value: number, max: number) => {
    const angle = angleStep * i - Math.PI / 2; // 从顶部开始
    const dist = (value / max) * r;
    return {
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle),
    };
  };

  // 标签位置
  const getLabel = (i: number) => {
    const angle = angleStep * i - Math.PI / 2;
    const dist = r + 22;
    return {
      x: cx + dist * Math.cos(angle),
      y: cy + dist * Math.sin(angle),
    };
  };

  // 网格
  const grids = Array.from({ length: levels }, (_, lvl) => {
    const radius = ((lvl + 1) / levels) * r;
    const points = Array.from({ length: n }, (_, i) => {
      const angle = angleStep * i - Math.PI / 2;
      return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
    }).join(' ');
    return <polygon key={lvl} points={points} fill="none" stroke={DIM} strokeWidth="0.5" />;
  });

  // 轴线
  const axes = Array.from({ length: n }, (_, i) => {
    const end = getPoint(i, 1, 0.1); // max out
    return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={DIM} strokeWidth="0.5" />;
  });

  // 覆盖率多边形
  const coveragePoints = Array.from({ length: n }, (_, i) => {
    const p = getPoint(i, entries[i][1].coverage, 1);
    return `${p.x},${p.y}`;
  }).join(' ');
  const depthPoints = Array.from({ length: n }, (_, i) => {
    const p = getPoint(i, entries[i][1].depth, 10);
    return `${p.x},${p.y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 300 300" width="300" height="300">
      {grids}
      {axes}
      {/* 覆盖率 */}
      <polygon points={coveragePoints} fill="rgba(0,240,255,0.15)" stroke={CYAN} strokeWidth="1.5" />
      {/* 深度 */}
      <polygon points={depthPoints} fill="rgba(255,0,255,0.1)" stroke={MAGENTA} strokeWidth="1.5" strokeDasharray="4,2" />
      {/* 数据点 */}
      {entries.map(([name, entry], i) => {
        const cp = getPoint(i, entry.coverage, 1);
        const dp = getPoint(i, entry.depth, 10);
        return (
          <g key={name}>
            <circle cx={cp.x} cy={cp.y} r="3" fill={CYAN} />
            <circle cx={dp.x} cy={dp.y} r="3" fill={MAGENTA} />
          </g>
        );
      })}
      {/* 标签 */}
      {entries.map(([name], i) => {
        const lbl = getLabel(i);
        return (
          <text
            key={name}
            x={lbl.x}
            y={lbl.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#aaa"
            fontSize="9"
            fontFamily="monospace"
          >
            {name}
          </text>
        );
      })}
    </svg>
  );
};

// ── 时间线（得分变化）──
export const Timeline = ({ data }: { data: TimelinePoint[] }) => {
  if (!data.length) return <p style={{ color: DIM }}>暂无答题记录</p>;

  const w = 520, h = 160, pad = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const maxVal = 100;
  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW / 2;

  const getX = (i: number) => pad.left + (data.length > 1 ? i * xStep : chartW / 2);
  const getY = (val: number) => pad.top + chartH - (val / maxVal) * chartH;

  // 生成路径（score 是 0-100，logic/comm 是 0-10，需要统一到 0-100 范围）
  const getScaledValue = (p: TimelinePoint, key: 'score' | 'logic_score' | 'communication_score') => {
    const val = p[key];
    // score 字段已为 0-100，logic_score 和 communication_score 为 0-10
    return key === 'score' ? val : val * 10;
  };
  const makePath = (key: 'score' | 'logic_score' | 'communication_score') =>
    data
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(getScaledValue(p, key))}`)
      .join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="160">
      {/* Y 轴网格 */}
      {[0, 25, 50, 75, 100].map(v => (
        <g key={v}>
          <line x1={pad.left} y1={getY(v)} x2={w - pad.right} y2={getY(v)} stroke={DIM} strokeWidth="0.3" />
          <text x={pad.left - 6} y={getY(v) + 4} textAnchor="end" fill="#666" fontSize="8" fontFamily="monospace">{v}</text>
        </g>
      ))}
      {/* 数据线 */}
      <path d={makePath('score')} fill="none" stroke={CYAN} strokeWidth="2" />
      <path d={makePath('logic_score')} fill="none" stroke={MAGENTA} strokeWidth="1.5" strokeDasharray="3,2" />
      <path d={makePath('communication_score')} fill="none" stroke={YELLOW} strokeWidth="1.5" strokeDasharray="3,2" />
      {/* 数据点 */}
      {data.map((p, i) => (
        <g key={p.question_id}>
          <circle cx={getX(i)} cy={getY(p.score)} r="4" fill={CYAN} />
          <text x={getX(i)} y={h - 8} textAnchor="middle" fill="#888" fontSize="7" fontFamily="monospace">
            Q{i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
};

// ── 主组件 ──
const Diagnosis = () => {
  const [sessionId, setSessionId] = useState('');
  const [diagnosis, setDiagnosis] = useState<CognitiveDiagnosis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetch = async () => {
    if (!sessionId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDiagnosis(sessionId.trim());
      setDiagnosis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '获取诊断报告失败');
    } finally {
      setLoading(false);
    }
  };

  const d = diagnosis;

  return (
    <div className="diagnosis-page" style={{ fontFamily: 'monospace', color: '#ccc', padding: 16 }}>
      <h2 style={{ color: CYAN, fontSize: 18, marginBottom: 16 }}>🧠 认知诊断报告</h2>

      {/* Session ID 输入 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          value={sessionId}
          onChange={e => setSessionId(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleFetch()}
          placeholder="输入 Session ID..."
          style={{
            flex: 1, maxWidth: 240,
            background: BG, border: `1px solid ${DIM}`, color: CYAN,
            padding: '6px 10px', fontFamily: 'monospace', fontSize: 13,
          }}
        />
        <button
          onClick={handleFetch}
          disabled={loading}
          style={{
            background: 'transparent', border: `1px solid ${CYAN}`, color: CYAN,
            padding: '6px 16px', cursor: 'pointer', fontFamily: 'monospace',
          }}
        >
          {loading ? '加载中...' : '查询'}
        </button>
      </div>

      {error && <div style={{ color: '#ff4444', marginBottom: 16, border: '1px solid #ff4444', padding: 8 }}>{error}</div>}

      {d && (
        <>
          {/* 总分概览 */}
          <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
            <ScoreBox label="总分" value={d.overall_score} max={100} color={CYAN} />
            <ScoreBox label="逻辑" value={d.logic_score} max={10} color={MAGENTA} />
            <ScoreBox label="表达" value={d.communication_score} max={10} color={YELLOW} />
            <ScoreBox label="深度" value={d.depth_score} max={10} color={GREEN} />
          </div>

          {/* 雷达图 + 知识覆盖 */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ border: `1px solid #333`, padding: 12, background: BG }}>
              <h3 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>📡 知识雷达</h3>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 11 }}>
                <span style={{ color: CYAN }}>── 覆盖度</span>
                <span style={{ color: MAGENTA }}>- - 深度</span>
              </div>
              <RadarChart data={d.radar_data} />
            </div>

            {/* 知识覆盖详情 */}
            <div style={{ flex: 1, minWidth: 280 }}>
              <h3 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>📋 知识覆盖详情</h3>
              {d.knowledge_map.map(kp => (
                <div key={kp.name} style={{ marginBottom: 12, border: '1px solid #333', padding: 8, background: BG }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{kp.name}</span>
                    <span>
                      <span style={{ color: CYAN }}>覆盖 {Math.round(kp.coverage * 100)}%</span>
                      <span style={{ margin: '0 8px', color: '#555' }}>|</span>
                      <span style={{ color: MAGENTA }}>深度 {kp.depth_score}</span>
                    </span>
                  </div>
                  {/* 进度条 */}
                  <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                    <div style={{ flex: 1, height: 4, background: '#222' }}>
                      <div style={{ width: `${kp.coverage * 100}%`, height: 4, background: CYAN }} />
                    </div>
                    <div style={{ flex: 1, height: 4, background: '#222' }}>
                      <div style={{ width: `${(kp.depth_score / 10) * 100}%`, height: 4, background: MAGENTA }} />
                    </div>
                  </div>
                  {kp.missing_concepts.length > 0 && (
                    <div style={{ fontSize: 11, color: '#ff6666' }}>
                      ⚠ 缺失概念：{kp.missing_concepts.join('、')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 时间线 */}
          <div style={{ border: '1px solid #333', padding: 12, marginBottom: 24, background: BG }}>
            <h3 style={{ color: CYAN, fontSize: 14, marginBottom: 8 }}>📈 得分时间线</h3>
            <div style={{ display: 'flex', gap: 16, fontSize: 11, marginBottom: 8 }}>
              <span style={{ color: CYAN }}>── 总分</span>
              <span style={{ color: MAGENTA }}>- - 逻辑</span>
              <span style={{ color: YELLOW }}>- - 表达</span>
            </div>
            <Timeline data={d.timeline_data} />
          </div>

          {/* 优劣势 + 改进建议 */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, border: '1px solid #333', padding: 12, background: BG }}>
              <h3 style={{ color: GREEN, fontSize: 14, marginBottom: 8 }}>✅ 优势</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                {d.strengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div style={{ flex: 1, minWidth: 200, border: '1px solid #333', padding: 12, background: BG }}>
              <h3 style={{ color: '#ff6666', fontSize: 14, marginBottom: 8 }}>❌ 短板</h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                {d.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
            <div style={{ flex: 1, minWidth: 200, border: '1px solid #333', padding: 12, background: BG }}>
              <h3 style={{ color: YELLOW, fontSize: 14, marginBottom: 8 }}>💡 改进路径</h3>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.8 }}>
                {d.improvement_plan.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          </div>
        </>
      )}

      {!d && !loading && !error && (
        <div style={{ color: DIM, fontSize: 13, border: '1px solid #333', padding: 16, background: BG }}>
          <p>输入 Session ID 查看认知诊断报告。</p>
          <p style={{ fontSize: 11, marginTop: 8 }}>
            Session ID 来自 Agent 面试 API（POST /api/agent/start-interview）。
          </p>
        </div>
      )}
    </div>
  );
};

// ── 辅助组件：分数方块 ──
export const ScoreBox = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => (
  <div
    style={{
      border: `1px solid #333`,
      padding: '8px 16px',
      textAlign: 'center',
      background: BG,
      minWidth: 72,
    }}
  >
    <div style={{ fontSize: 10, color: '#888', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 'bold', color }}>{value}</div>
    <div style={{ fontSize: 9, color: '#555' }}>/ {max}</div>
  </div>
);

export default Diagnosis;
