# AI Interview Coach

面试准备 → 模拟 → 诊断的闭环 Web 应用。基于 LangChain + RAG 的认知诊断式面试 Agent。

在线访问：https://ai-interview-coach-flame.vercel.app

![stack](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![stack](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi) ![stack](https://img.shields.io/badge/LangChain-0.3-1C3C3C?logo=langchain) ![stack](https://img.shields.io/badge/ChromaDB-0.5-FF6F00?logo=chromadb) ![deploy](https://img.shields.io/badge/deploy-Vercel-black?logo=vercel)

## 导航

| Tab | 功能 | 依赖后端 |
|-----|------|---------|
| 🎯 面试准备 | 简历+JD → 8章备战文档（公司调研/JD解读/自我介绍/STAR故事/高频预测/备考建议/反问清单/Gap清单） | ✅ |
| 🔍 简历匹配 | 简历+JD → 匹配度评分 + 四类标注（覆盖/可挖/缺失/错配），可桥接到完整准备 | ✅ |
| 🧠 面试拷打 | Agent 自适应面试 + 认知诊断报告（雷达图/时间线/强项短板） | ✅ |
| ⚡ 轻量刷题 | 10分类题库，随机抽题，AI评分，错题本 | 本地 |
| 📚 题库 | 159道内置题，增删改查，面经提取导入 | 本地 |
| 📊 历史 | 4tab分类，诊断详情弹窗 | 本地 |

## 架构

```
ai-interview-coach/
├── src/              # React 19 + TypeScript + Vite
│   ├── views/        # InterviewPrep, ResumeRoast, QuestionBank, History, etc.
│   ├── services/     # prepService, diagnosisService, aiService
│   ├── data/         # 内置题库 159 题
│   └── utils/        # 题库CRUD, LocalStorage, 文件解析(PDF/DOCX/图片)
├── backend/          # Python FastAPI + LangChain + ChromaDB
│   ├── agent/        # InterviewAgent, PrepAgent, CognitiveModel
│   ├── rag/          # ChromaDB向量库 + DuckDuckGo联网搜索(三层回退)
│   ├── models/       # Pydantic schemas
│   └── main.py       # 12+1 API 端点 + SSE
└── README.md
```

## 闭环设计

```
面试准备(/prep) ──→ 逐题练习 ──→ 面试拷打(/roast) ──→ 认知诊断报告
      ↑                                                    │
      └────────── 闭环优化反馈 (refine with diagnosis) ──────┘
```

## 本地运行

```bash
# 前端
npm install
cp .env.example .env.local   # 填 VITE_AGNES_API_KEY
npm run dev                   # :5173

# 后端
cd backend
pip install -r requirements.txt
cp .env.example .env          # 填 LLM_API_KEY
python scripts/seed_data.py   # 初始化向量库
python main.py                # :8000
```

## 技术细节

- **LLM**: Agnes AI API (OpenAI 兼容)，`agnes-2.0-flash`
- **RAG**: ChromaDB + ONNX `all-MiniLM-L6-v2` 本地 Embedding（完全离线）
- **联网搜索**: DuckDuckGo HTML→Lite→API JSON 三层回退 + LLM 训练数据兜底（7岗位方向独立 prompt）
- **认知诊断**: Knowledge Area → 雷达图 + 得分时间线 + 知识缺口定位
- **样式**: CRT 终端美学 — 扫描线、绿字黑底、像素风开机动画
- **导出**: 诊断报告 → Word / JSON
