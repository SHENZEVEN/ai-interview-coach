# AI Interview Coach

面试准备 → 模拟 → 诊断的闭环 Web 应用。基于 LangChain + RAG 的认知诊断式面试 Agent。

🔗 在线访问：https://ai-interview-coach-flame.vercel.app

> **注意**：在线版本仅展示前端交互（题库/历史/轻量刷题），完整功能需本地运行后端。

![stack](https://img.shields.io/badge/React-19-61DAFB?logo=react) ![stack](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi) ![stack](https://img.shields.io/badge/LangChain-0.3-1C3C3C?logo=langchain) ![stack](https://img.shields.io/badge/ChromaDB-0.5-FF6F00?logo=chromadb) ![deploy](https://img.shields.io/badge/deploy-Vercel-black?logo=vercel)

## 导航

| Tab | 功能 | 后端 |
|-----|------|:---:|
| 🎯 面试准备 | 简历+JD → 8章备战文档（公司调研 / JD解读 / 自我介绍 / STAR故事 / 高频预测 / 反问清单 / Gap分析） | ✅ |
| 🔍 简历匹配 | 简历+JD → 匹配度评分 + 四类标注（覆盖/可挖/缺失/错配）→ 桥接完整准备 | ✅ |
| 🧠 面试拷打 | Agent 自适应面试 + 认知诊断报告（雷达图 / 得分时间线 / 强项短板 / 改进路径） | ✅ |
| ⚡ 轻量刷题 | 10分类随机抽题 → AI评分 → 错题本 | ❌ |
| 📚 题库管理 | 159道内置题 + 自定义题 + 面经提取导入 | ❌ |
| 📊 历史记录 | 4tab分类（全部/错题本/面试拷打/面试准备）+ 诊断详情弹窗 | ❌ |

## 架构

```
ai-interview-coach/
├── src/                   # React 19 + TypeScript + Vite
│   ├── views/             # 6 页面（InterviewPrep / ResumeMatcher / ResumeRoast / ...）
│   ├── services/          # prepService / diagnosisService / aiService
│   ├── data/questions.ts  # 内置题库 159 题
│   └── utils/             # LocalStorage / 文件解析(PDF/DOCX/图片OCR)
├── backend/               # Python FastAPI + LangChain + ChromaDB
│   ├── agent/             # InterviewAgent / PrepAgent / CognitiveModel
│   ├── rag/               # ChromaDB向量库 + DuckDuckGo联网搜索(三层回退)
│   ├── models/schemas.py  # Pydantic 数据模型
│   └── main.py            # 12+1 API 端点
└── README.md
```

## 闭环设计

```
面试准备(/prep) ─→ 逐题练习 ─→ 面试拷打(/roast) ─→ 认知诊断报告
      ↑                                                │
      └──── 闭环优化 (诊断结果反馈回准备页面，更新Gap清单) ───┘
```

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

1. **输入简历 + JD**：可手动粘贴，也可拖拽上传 PDF / DOCX / 图片
2. **选择方向**：岗位方向 A~G（AI产品 / AI全栈 / PM / 产品运营 / 商业策略 / 增长数据 / 其他）
3. **选择深度**：rapid（速准 5-10s）/ standard（标准 15-30s）/ deep（深研，含联网搜索）
4. **生成后**：展开 8 个章节逐一阅读，在预测题列表中逐题作答练习
5. **点击「开始面试拷打」**：Agent 基于 prep 分析结果自适应出题
6. **面试结束**：查看认知诊断报告（雷达图 + 时间线 + 知识缺口）
7. **闭环反馈**：点击「闭环优化面试准备」→ 回到 prep 页面，Gap 清单已更新

### 快速刷题

1. 导航到「面试拷打」→ 选择「⚡ 轻量刷题」
2. 选择分类 → 随机抽 10 题 → 逐题作答 → AI 评分
3. 错题自动入错题本，可在「历史」中查看

### 简历快速匹配

1. 导航到「面试准备」→ 切换「🔍 简历匹配」
2. 输入简历 + JD → 5-10 秒出匹配度评分 + 四类标注
3. 可一键桥接到完整准备流程

## 技术细节

- **LLM**：Agnes AI API（OpenAI 兼容格式），模型 `agnes-2.0-flash`
- **RAG**：ChromaDB + ONNX `all-MiniLM-L6-v2` 本地 Embedding（首次自动下载 ~80MB，后续完全离线）
- **联网搜索**：DuckDuckGo 三层回退（HTML → Lite → API JSON）+ LLM 训练数据兜底（7 个岗位方向各有独立 prompt）
- **认知诊断**：知识覆盖度 + 理解深度 + 逻辑清晰度 + 表达沟通，生成雷达图和时间线
- **超时策略**：本地 30s 超时 / 3 次重试 / 指数退避；Vercel 部署自动降级为 DEMO 模式
- **样式**：CRT 终端美学（扫描线、绿字黑底、像素风开机动画，sessionStorage 记忆首次启动）
- **导出**：诊断报告支持导出 Word (.docx) 和 JSON
- **认证**：`Authorization: Bearer <API_KEY>` 透传

## FAQ

**Q: 在线版为什么点面试准备报错？**
A: Vercel 只托管前端。报错不是 bug，是后端未部署的优雅降级提示。克隆到本地即可体验完整功能。

**Q: 首次运行 `seed_data.py` 太慢？**
A: 会自动下载 ONNX `all-MiniLM-L6-v2` 模型（~80MB），仅首次需要，之后离线运行。

**Q: 能否换其他 LLM？**
A: 可以。后端使用 OpenAI 兼容 API，改 `backend/.env` 中的 `LLM_API_BASE` 和 `LLM_MODEL` 即可接入 DeepSeek / Qwen / 智谱等。
