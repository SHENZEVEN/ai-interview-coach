# AI 面试模拟器

一个面向开发者的 AI 驱动面试练习平台，提供从通用刷题、精准准备到简历模拟的全流程闭环。

在线访问：https://ai-interview-coach-flame.vercel.app

## ✨ 核心功能

### 🎯 快速练习
- 按方向（前端/计网/算法/AI Coding）随机抽题
- AI 即时评分 + 优缺点分析 + 参考答案
- 练习历史记录与错题本自动归类

### 📝 针对性练习
- 输入 JD/面经文本，AI 动态生成相关面试题
- 支持 PDF / Word / 图片上传解析（多模态输入）
- 生成的题目自动入库，可复用练习

### 📚 题库管理
- 内置题库（前端/计网/算法/AI Coding）
- 支持添加/编辑/删除自定义题目
- 按类别、难度、状态筛选，追踪掌握进度

### 🔥 简历拷打
- 上传简历（PDF/Word/图片），AI 模拟面试官深挖追问
- 5 道针对性面试题 + 详细评分报告
- 覆盖技术深度、综合素质、架构设计、基础能力、项目经验等维度

### 📊 历史与错题本
- 查看全部练习记录，错题本自动归类
- 支持导出 JSON / Word 格式，便于复盘

## 🛠️ 技术栈

- **前端框架**：React 18 + TypeScript + Vite + Tailwind CSS
- **AI 服务**：DeepSeek API，实现 Prompt 工程下的结构化 JSON 输出
- **文档解析**：pdf-parse + mammoth + tesseract.js，实现 PDF/Word/图片多模态输入
- **数据存储**：localStorage + 题库 JSON 双源
- **部署**：Vercel

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/yourname/ai-interview-coach.git

# 安装依赖
npm install

# 配置 API Key（创建 .env.local 文件）
VITE_DEEPSEEK_API_KEY=your_api_key_here

# 启动开发服务器
npm run dev
