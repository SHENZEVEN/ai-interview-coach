# AI Interview Coach

面试准备 → 模拟 → 诊断的闭环 Web 应用。基于 LangChain + RAG 的认知诊断式面试 Agent。

🔗 在线访问：https://ai-interview-coach-flame.vercel.app

> **注意**：在线版本仅展示前端交互（题库/历史/轻量刷题），完整 AI 功能需本地运行后端。

![stack](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![stack](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi) ![stack](https://img.shields.io/badge/LangChain-0.3-1C3C3C?logo=langchain) ![stack](https://img.shields.io/badge/ChromaDB-0.5-FF6F00?logo=chromadb) ![deploy](https://img.shields.io/badge/deploy-Vercel-black?logo=vercel)

## 导航

| Tab | 功能 | 后端 |
|-----|------|:---:|
| 🎯 面试准备 | 简历+JD → 8章备战文档 / 简历匹配模式 / 流式生成 / 外部文档导入闭环 | ✅ |
| 🧠 面试拷打 | 三种模式（轻量刷题 / Agent面试 / 准备驱动）+ 认知诊断报告 | ✅ |
| 📚 题库 | 158 道内置题 + 自定义 + 面经 AI 提取 | ❌ |
| 📊 历史 | 4 tab（全部/错题本/面试拷打/面试准备）+ 诊断详情弹窗 | ❌ |

### 面试准备 — 三种入口

| 模式 | 说明 |
|------|------|
| 🔍 简历匹配 | 仅需简历+JD → 匹配度评分 + 四类标注（覆盖/可挖/缺失/错配）→ 可桥接完整准备 |
| 📋 完整准备 | 简历+JD+方向+职级 → SSE 流式生成 8 章备战文档 → 逐题练习 |
| 📥 外部导入 | 导入 interview-prep skill 的 .md 文档 + 诊断报告 → 闭环优化 |

## 架构

```
ai-interview-coach/
├── src/                      # React 19 + TypeScript + Vite
│   ├── views/                # InterviewPrep / ResumeMatcher / ResumeRoast / QuickPractice
│   │                         #   QuestionBank / History / Diagnosis
│   ├── services/             # prepService / diagnosisService / aiService
│   │                         #   prepStorage / diagnosisStorage（LocalStorage 持久化）
│   ├── data/questions.ts     # 内置题库 159 题
│   └── utils/                # LocalStorage / 文件解析(PDF/DOCX/图片)
├── backend/                  # Python FastAPI + LangChain + ChromaDB
│   ├── agent/                # PrepAgent（纯LLM驱动）/ InterviewAgent（双模式）/ CognitiveModel
│   ├── rag/                  # ChromaDB 向量库 + web_search（降频使用）
│   ├── models/schemas.py     # Pydantic 数据模型
│   ├── references/           # 面试准备方法论（提取自 interview-prep skill）
│   ├── logs/                 # LLM 输出调试日志
│   └── main.py               # 17 API 端点 + SSE 流式生成
└── README.md
```

## 闭环设计（三条路径）

```
路径 A（直播闭环）：
  /prep 生成文档 → 逐题练习 → 面试拷打 → 诊断报告
    → 闭环优化 → 回到 /prep（Gap 重排 + 新题生成）

路径 B（回溯闭环）：
  /prep 加载已保存文档 + 已保存诊断 → 闭环优化 → 同上

路径 C（外部导入闭环）：
  导入 interview-prep skill 的 .md 文档 + 诊断报告 → 闭环优化 → 同上
```

> 闭环优化已完全绕过后端内存存储，支持传 prep_data + diagnosis_data，后端重启不丢数据。

## 本地环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | ≥ 18 | 前端构建 |
| Python | ≥ 3.10 | 后端运行 |
| pip | ≥ 23 | Python 包管理 |

## 安装（两种方式）

### 方式一：完整安装（前后端全功能）

```bash
# 1. 克隆仓库
git clone https://github.com/SHENZEVEN/ai-interview-coach.git
cd ai-interview-coach

# 2. 安装前端依赖
npm install

# 3. 创建前端环境变量
cp .env.example .env.local
# 编辑 .env.local，填写你的 API Key：
#   VITE_AGNES_API_KEY=sk-xxxxxxxx

# 4. 安装后端依赖
cd backend
pip install -r requirements.txt

# 5. 创建后端环境变量
cp .env.example .env
# 编辑 .env，填写你的 API Key：
#   LLM_API_KEY=sk-xxxxxxxx

# 6. 初始化题库向量库（首次运行需要，会下载 ONNX Embedding 模型 ~80MB）
python scripts/seed_data.py

# 7. 回到根目录
cd ..
```

### 方式二：仅前端（Vercel 同款，题库 + 刷题可用）

```bash
git clone https://github.com/SHENZEVEN/ai-interview-coach.git
cd ai-interview-coach
npm install
cp .env.example .env.local
# 不填 API Key 也行，系统自动走本地模拟模式
npm run dev
```

## 启动

终端一 — 后端：
```bash
cd backend
python main.py
# FastAPI 启动在 http://localhost:8000
# API 文档 http://localhost:8000/docs
```

终端二 — 前端：
```bash
npm run dev
# Vite 启动在 http://localhost:5173
```

打开浏览器访问 `http://localhost:5173`。

## 使用流程

### 完整面试准备闭环

1. **选择模式**：简历匹配（快速评估）/ 完整准备（8章文档）/ 外部导入（从 interview-prep skill .md 文档导入）
2. **输入材料**：手动粘贴或拖拽上传 PDF / DOCX / 图片 / TXT / MD
3. **选择方向**：7 个岗位方向 A~G（AI产品 / AI全栈 / PM / 产品运营 / 商业策略 / 增长数据 / 其他）
4. **选择深度**：rapid（速准）/ standard（标准）/ deep（深研）
5. **流式生成**：SSE 实时推送生成进度，支持刷新恢复
6. **逐题练习**：在预测题列表中逐题作答，即时 AI 评分
7. **面试拷打**：支持三种模式 —
   - ⚡ 轻量刷题：随机抽 10 题快速练
   - 🧠 Agent 面试：上传简历，LangChain Agent 自适应出题
   - 🎯 准备驱动：从 prep 题目池出题，至少 8 题，结束出诊断报告
8. **诊断报告**：雷达图 + 得分时间线 + 强项短板 + 改进路径，支持导出 Word/JSON
9. **闭环反馈**：诊断结果反馈回准备页面 → Gap 清单更新 + 弱项生成新题

### 外部文档导入（v2.5）

- 支持导入 interview-prep skill 生成的 .md 面试准备文档
- 后端 LLM 自动解析文档中的预测题、Gap 清单、JD 意图
- 可配合诊断报告 .json 实现完整闭环（不限配套关系）

## 技术细节

- **LLM**：Agnes AI API（OpenAI 兼容格式），模型 `agnes-2.0-flash`，可直接切换 DeepSeek / Qwen / 智谱等
- **RAG**：ChromaDB + ONNX `all-MiniLM-L6-v2` 本地 Embedding（首次自动下载 ~80MB，后续完全离线）
- **生成策略**：纯 LLM 驱动（不依赖联网搜索，对知名公司效果好）；methodology 注入 + 7 个岗位方向专属上下文
- **流式生成**：SSE（Server-Sent Events）实时推送生成进度，支持刷新恢复
- **双模式面试**：LangChain Agent 模式（RAG 增强）+ 准备驱动模式（直接 LLM 调用，更快更稳定）
- **认知诊断**：连续知识覆盖度 + 理解深度 + 逻辑清晰度 + 表达沟通，雷达图 + 时间线
- **状态持久化**：LocalStorage 保存 prep 文档、诊断报告、面试进度，刷新不丢数据
- **超时策略**：prep 300s / agent 180s 超时，3 次重试 + 指数退避；Vercel 部署自动降级为 DEMO 模式
- **样式**：CRT 终端美学（扫描线、绿字黑底、像素风开机动画）
- **导出**：诊断报告导出 Word (.docx) / JSON；面试准备文档导出 JSON / Markdown
- **认证**：`Authorization: Bearer <API_KEY>` 透传

## FAQ

**Q: 在线版为什么点面试准备报错？**
A: Vercel 只托管前端。报错不是 bug，是后端未部署的优雅降级提示。克隆到本地即可体验完整功能。

**Q: 首次运行 `seed_data.py` 太慢？**
A: 会自动下载 ONNX `all-MiniLM-L6-v2` 模型（~80MB），仅首次需要，之后离线运行。

**Q: 能否换其他 LLM？**
A: 可以。后端使用 OpenAI 兼容 API，改 `backend/.env` 中的 `LLM_API_BASE` 和 `LLM_MODEL` 即可接入 DeepSeek / Qwen / 智谱等。

**Q: 后端重启后面试准备文档丢失？**
A: 前端已自动保存到 LocalStorage。此外闭环优化已支持传完整 prep_data + diagnosis_data 绕过后端内存存储。

**Q: 可以不装后端用 interview-prep skill 替代吗？**
A: 可以。用 Claude Code 的 interview-prep skill 生成 .md 文档，通过「外部导入」功能桥接到本项目的面试模拟 + 诊断闭环。
