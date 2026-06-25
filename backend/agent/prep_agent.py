"""Interview Preparation Agent — 面试准备文档生成 + 闭环反馈。

对标 interview-prep skill 的核心方法，使用相同 LLM 基础设施，
生成：公司/产品调研、JD深度解读、定制自我介绍、STAR预案、
高频题预测、Gap清单。支持从认知诊断结果反向更新。

简化版：一次 LLM 调用完成，不依赖联网搜索。
"""

import json
import os
import re
import time
from pathlib import Path
from typing import Optional, Callable

# ── 加载 interview-prep skill 方法论（注入到 system prompt）──
_METHODOLOGY_PATH = Path(__file__).resolve().parent.parent / "references" / "interview_prep_methodology.md"
FALLBACK_METHODOLOGY = ""
try:
    FALLBACK_METHODOLOGY = _METHODOLOGY_PATH.read_text(encoding="utf-8")
    print(f"[prep_agent] Loaded methodology: {len(FALLBACK_METHODOLOGY)} chars")
except Exception as e:
    print(f"[prep_agent] WARNING: Failed to load methodology: {e}")

import uuid

from langchain_openai import ChatOpenAI


# ── Role Direction Mapping ──
ROLE_DIRECTIONS = {
    "A": "产品经理（PM）",
    "B": "增长/数据产品",
    "C": "产品运营",
    "D": "商业策略/BD",
    "E": "AI产品经理/AI产品实习",
    "F": "AI全栈开发/AI应用开发实习",
    "G": "其他",
}

# ── 方向专属面试知识 — LLM 回退时的提示上下文 ──
# 每个方向描述该岗位面试真实考察维度，引导 LLM 从训练数据中检索对应知识
DIRECTION_INTERVIEW_CONTEXT: dict[str, str] = {
    "A": """【产品经理面试特征】
- 核心考察：需求分析、用户洞察、数据驱动决策、竞品分析、产品设计
- 典型题：产品case题（"如何设计一个XX功能"）、估算题（"北京有多少加油站"）、行为面试（"讲一个你推动的项目"）
- 深挖方向：用户研究具体方法、PRD撰写、A/B测试设计、优先级排序、跨部门协作冲突处理
- 公司知识提取重点：该公司的产品矩阵、DAU/MAU量级、产品迭代节奏、竞品格局""",

    "B": """【增长/数据产品面试特征】
- 核心考察：增长模型、用户分层、渠道归因、AB实验设计、数据指标体系
- 典型题：SQL手写、留存分析case（"DAU下降20%怎么查"）、北极星指标定义、增长黑客案例
- 深挖方向：LTV/CAC模型、激活漏斗优化、病毒传播K因子、数据埋点设计
- 公司知识提取重点：该公司的增长模型（AARRR哪个环节是重点）、数据基建水平、实验文化""",

    "C": """【产品运营面试特征】
- 核心考察：用户运营体系、活动策划、内容策略、社区运营、数据分析
- 典型题：用户分层运营方案、促活活动设计case、NPS提升方法论
- 深挖方向：RFM模型应用、Push策略、用户生命周期管理、社群SOP
- 公司知识提取重点：该公司的运营体系成熟度、用户规模与构成、运营驱动vs产品驱动的比重""",

    "D": """【商业策略/BD面试特征】
- 核心考察：行业分析、商业模式、竞对研究、谈判能力、财务建模
- 典型题：市场sizing（"估算中国XX市场规模"）、收入模型拆解、合作伙伴评估框架
- 深挖方向：波特五力分析、单位经济学、战略规划方法论
- 公司知识提取重点：该公司的商业模式、收入来源、利润率水平、战略投资方向""",

    "E": """【AI产品经理面试特征 — 重点关注】
- 核心考察：大模型基础认知（Transformer/Token/RAG/Prompt）、AI产品设计、模型选型决策、数据飞轮设计
- 典型题：
  * 技术认知："RAG和微调什么场景选哪个？""Token消耗怎么预估？""怎么评估一个模型好不好用？"
  * 产品设计："设计一个AI客服产品，从0到1怎么做""给你的产品接入AI，第一步做什么？"
  * 评估体系："BLEU/Rouge这些指标有意义吗？你怎么定义AI产品的'好'？""模型幻觉你怎么在产品和用户之间做缓冲？"
  * Prompt工程："给这个场景写一个system prompt""设计一个多轮对话的交互流程"
  * 行业判断："你觉得AI Native产品跟传统产品本质区别在哪？""现在toC AI产品PMF了吗？"
- 深挖方向：模型能力边界理解（不是调参，是知道AI能做什么不能做什么）、数据标注与评估闭环、AI产品交互范式（chat vs copilot vs agent vs 嵌入）、成本与延迟的trade-off
- 公司知识提取重点：该公司的AI产品矩阵（有没有自研大模型？AI功能是自研还是接API？）、AI PM的定位（偏策略还是偏工程？）、团队技术氛围、对PM的技术深度要求到什么程度""",

    "F": """【AI全栈开发面试特征 — 重点关注】
- 核心考察：LLM应用架构（RAG/Agent/Function Calling）、工程落地能力、系统设计、前端+后端+AI的贯通能力
- 典型题：
  * AI工程："从零搭建一个RAG系统，技术选型怎么做？""如何优化RAG检索质量？""Agent的工具调用loop怎么设计？""上下文窗口有限怎么管理长期记忆？"
  * 系统设计："设计一个支持10万QPS的AI客服后端""向量数据库选型Chroma vs Milvus vs Pinecone？""如何设计评估流水线来持续监控模型质量？"
  * 编码/算法："实现一个滑动窗口限流器""用LangChain写一个带记忆的多轮对话Agent""给这段代码加流式响应和错误重试"
  * 前端+AI："流式输出怎么在前端做打字机效果？""多模态输入（图片/语音/文件）架构怎么搭？"
  * Prompt与工具："Function Calling的JSON Schema怎么设计才稳定？""什么时候应该fine-tune而不是调prompt？"
- 深挖方向：ChromaDB/PGVector等向量库实战、LangChain/LlamaIndex框架原理与坑、模型部署（vLLM/Ollama）、评估与观测（LangSmith/自定义eval pipeline）、成本优化（缓存/压缩/路由）
- 公司知识提取重点：该公司的技术栈偏好（Python还是Go？React还是Vue？）、AI infra水平（自建还是用云服务？）、对全栈工程师的定义（偏前端+后端还是偏AI工程？）、面试有没有手撕算法环节、系统设计考不考LLM架构""",

    "G": """【通用岗位面试特征】
- 综合考察：根据具体JD调整，覆盖通用能力+行业知识+行为面试
- 公司知识提取重点：该公司整体业务、行业地位、发展阶段、团队规模
- 如果用户能明确更具体的岗位方向，请根据JD自行判断考察重点""",
}

# ── System Prompt 核心 — 复用 interview-prep skill 方法论 ──
PREP_SYSTEM_PROMPT = """你是一个专业的面试准备顾问，精通互联网/科技行业的面试辅导。
你的方法论对标专业 interview-prep skill，核心原则：

1. **证据驱动**：所有分析必须基于简历和JD的真实内容，不编造
2. **像人一样思考**：目标导向，不堆砌术语，口语化表达
3. **一手信息优先**：公司/产品信息优先官方来源
4. **逐条匹配**：JD每条要求必须对应简历证据或gap分析

## 输出结构
你必须按以下JSON结构输出完整的面试准备文档：

{
  "company_research": {
    "overview": "公司定位/规模/融资阶段（5行内）",
    "product_features": "核心产品特性",
    "competitors": "主要竞品格局",
    "ai_strategy": "AI战略/大模型布局（如相关）",
    "recent_news": "近期动态",
    "culture_signals": "团队文化信号",
    "sources": ["参考来源URL或注明'基于训练数据'"]
  },
  "jd_analysis": {
    "core_intent": "一段话：岗位真正要找什么样的人",
    "plain_language": [{"original": "JD原文", "plain": "实际考察什么"}],
    "requirement_matching": [
      {
        "requirement": "JD要求原文",
        "resume_evidence": "简历证据或'简历未见直接证据'",
        "match_level": "✅强/⚠️中/❌弱/-",
        "gap_risk": "风险说明",
        "strategy": "面试应对策略"
      }
    ]
  },
  "self_intro": "≤250字口语化自我介绍，结构：背景定位→经历A(30s)→经历B(30s)→经历C(20s)→为什么感兴趣(20s)",
  "star_stories": [
    {
      "project_name": "项目名",
      "situation": "背景",
      "task": "任务",
      "action": "行动",
      "result": "结果",
      "follow_up_questions": ["追问1", "追问2"]
    }
  ],
  "predicted_questions": [
    {
      "question": "题目",
      "category": "前端/计网/算法/AI Coding/系统设计/数据库/操作系统/产品设计/AI基础/AI产品",
      "source": "面经预测/岗位专项/JD推导/简历深挖",
      "key_points": ["考察点1", "考察点2"]
    }
  ],
  "gap_analysis": {
    "priority_1_must_fix": [{"gap": "...", "action": "...", "time_estimate": "..."}],
    "priority_2_should_fix": [{"gap": "...", "action": "..."}],
    "priority_3_nice_to_have": [{"gap": "...", "action": "..."}]
  },
  "focus_areas": ["知识领域1", "知识领域2", ...],
  "prep_summary": "整体准备建议（3-5句话）",
  "coaching_tips": ["针对性指导建议1", "建议2", "建议3"],
  "ask_back_questions": ["反问面试官的问题1", "问题2", "问题3"]
}"""


def build_prep_llm() -> ChatOpenAI:
    """使用与 interview_agent 相同的 LLM 配置。"""
    return ChatOpenAI(
        model=os.getenv("LLM_MODEL", "agnes-2.0-flash"),
        api_key=os.getenv("LLM_API_KEY", ""),
        base_url=os.getenv("LLM_API_BASE", "https://apihub.agnes-ai.com/v1"),
        temperature=0.3,  # 更低温度以确保结构化输出
        timeout=300,  # 增加到 5 分钟
        max_retries=3,
    )


# ── 存储 ──
_prep_store: dict[str, dict] = {}


class PrepAgent:
    """面试准备 Agent — 对标 interview-prep skill。"""

    def __init__(self):
        self.llm = build_prep_llm()

    def generate(
        self,
        resume_text: str,
        jd_text: Optional[str] = None,
        company_name: str = "",
        role_name: str = "",
        direction: str = "E",
        difficulty: str = "mid",
        prep_mode: str = "standard",
    ) -> dict:
        """生成完整面试准备文档。

        Args:
            resume_text: 简历文本
            jd_text: 岗位描述
            company_name: 公司名
            role_name: 岗位名
            direction: 岗位方向 (A-G, 见 ROLE_DIRECTIONS)
            difficulty: 目标职级 (intern/junior/mid/senior/lead)
            prep_mode: 准备深度 (rapid/standard/deep)

        Returns:
            完整的 prep 文档 dict + prep_id
        """
        prep_id = uuid.uuid4().hex[:12]
        direction_label = ROLE_DIRECTIONS.get(direction, "其他")

        # ── 构建 system prompt（注入 methodology）──
        system_prompt = f"""{FALLBACK_METHODOLOGY}

重要规则：
1. 严格按照JSON格式输出，不要JSON之外的文字
2. 公司调研章节标注'基于训练数据'
3. 若方向为E(AI产品)，关注AI基础认知/产品设计/行业格局类题目
4. 若方向为F(AI全栈开发)，关注LLM理论/RAG实战/Agent开发/系统设计/编程算法类题目"""

        # ── 构建 user prompt（简历+JD+公司名+方向上下文）──
        user_prompt = f"""## 面试准备任务

**目标岗位**：{role_name}
**目标公司**：{company_name}
**岗位方向**：{direction_label}
**目标职级**：{difficulty_label(difficulty)}

**候选人简历**：
{resume_text or "未提供"}

**岗位 JD**：
{jd_text or "未提供"}

请根据上述信息生成完整面试准备文档。严格按照JSON格式输出。

特别要求：
1. JD逐条匹配分析：先找简历证据再下判断，没有证据的标"-"
2. 自我介绍：≤250字，口语化，针对该岗位编排
3. 预测题目：含面经预测 + 岗位专项 + JD推导 + 简历深挖四种来源
4. Gap清单：按优先级1/2/3分组，含具体补课行动
5. coaching_tips：基于简历和JD差距，给出3-5条针对性备考建议（具体可操作的建议，而非泛泛而谈）
6. ask_back_questions：生成5-8个反问面试官的问题，覆盖公司战略/团队文化/岗位发展/技术方向/工作节奏等维度，体现求职者的思考深度"""

        # 调用 LLM（一次调用搞定）
        result = self.llm.invoke(system_prompt + "\n\n" + user_prompt)
        content = result.content if hasattr(result, 'content') else str(result)

        # DEBUG: 打印完整 LLM 输出信息（处理 Windows 编码问题）
        try:
            print(f"[prep_agent] LLM output length: {len(content)} chars")
            # 移除 emoji 和特殊字符以避免编码问题
            safe_content = content.encode('utf-8', errors='replace').decode('utf-8')
            print(f"[prep_agent] LLM output (first 500 chars): {safe_content[:500]}")
        except Exception as e:
            print(f"[prep_agent] Failed to print LLM output: {e}")

        # 解析 JSON
        prep_data = self._extract_json(content)
        
        # DEBUG: 打印解析结果
        try:
            print(f"[prep_agent] Extracted JSON keys: {list(prep_data.keys())}")
            if not prep_data:
                print(f"[prep_agent] WARNING: _extract_json returned empty dict!")
                # 尝试直接解析
                try:
                    prep_data = json.loads(content)
                    print(f"[prep_agent] Direct JSON parse succeeded!")
                except json.JSONDecodeError as e:
                    print(f"[prep_agent] Direct JSON parse failed: {e}")
                    # 打印原始内容的开头部分来分析格式
                    print(f"[prep_agent] Content starts with: {repr(content[:100])}")
            else:
                # 打印部分数据内容
                print(f"[prep_agent] jd_analysis exists: {'jd_analysis' in prep_data}")
                print(f"[prep_agent] chapter_2_jd_analysis exists: {'chapter_2_jd_analysis' in prep_data}")
                print(f"[prep_agent] coaching_tips count: {len(prep_data.get('coaching_tips', []))}")
        except Exception as e:
            print(f"[prep_agent] Failed to print JSON keys: {e}")

        # 补充默认值
        prep_data = self._ensure_structure(prep_data, resume_text, jd_text)
        
        # DEBUG: 打印处理后的数据
        try:
            print(f"[prep_agent] After _ensure_structure keys: {list(prep_data.keys())}")
            print(f"[prep_agent] After _ensure_structure jd_analysis: {prep_data.get('jd_analysis', {})}")
            print(f"[prep_agent] After _ensure_structure predicted_questions count: {len(prep_data.get('predicted_questions', []))}")
            print(f"[prep_agent] After _ensure_structure coaching_tips count: {len(prep_data.get('coaching_tips', []))}")
        except Exception as e:
            print(f"[prep_agent] Failed to print processed data: {e}")

        # 注入额外结构化信息
        prep_data["meta"] = {
            "prep_id": prep_id,
            "company_name": company_name,
            "role_name": role_name,
            "direction": direction,
            "direction_label": direction_label,
            "difficulty": difficulty,
            "prep_mode": prep_mode,
            "generated_at": self._now_iso(),
        }

        # 存储
        _prep_store[prep_id] = prep_data

        return prep_data

    def generate_stream(
        self,
        resume_text: str,
        jd_text: Optional[str] = None,
        company_name: str = "",
        role_name: str = "",
        direction: str = "E",
        difficulty: str = "mid",
        prep_mode: str = "standard",
        stream_callback: Optional[Callable[[str], None]] = None,
    ) -> str:
        """流式生成面试准备文档。

        Args:
            resume_text: 简历文本
            jd_text: JD文本
            company_name: 公司名称
            role_name: 岗位名称
            direction: 岗位方向
            difficulty: 难度级别
            prep_mode: 准备模式
            stream_callback: 流式回调函数，接收每块生成的内容

        Returns:
            完整的 JSON 字符串
        """
        prep_id = uuid.uuid4().hex[:12]
        direction_label = ROLE_DIRECTIONS.get(direction, "其他")

        # ── 构建 system prompt（简化版，加速生成）──
        system_prompt = f"""你是一位专业的AI面试教练。请根据简历和JD生成面试准备文档。

重要规则：
1. 严格按照JSON格式输出
2. 输出完整的JSON对象，不要省略任何字段
3. 包含所有必要章节：meta, company_research, jd_analysis, self_intro, star_stories, predicted_questions, gap_analysis, coaching_tips, ask_back_questions"""

        # ── 构建 user prompt（精简版）──
        user_prompt = f"""## 面试准备任务

**目标岗位**：{role_name}
**目标公司**：{company_name}
**岗位方向**：{direction_label}
**目标职级**：{difficulty}

**候选人简历**：
{resume_text or "未提供"}

**岗位 JD**：
{jd_text or "未提供"}

请生成完整的面试准备文档JSON对象。"""

        # 调用 LLM（支持流式输出）
        if stream_callback:
            full_content = ""
            for chunk in self.llm.stream(system_prompt + "\n\n" + user_prompt):
                content = chunk.content if hasattr(chunk, 'content') else str(chunk)
                full_content += content
                stream_callback(content)
            return full_content
        else:
            result = self.llm.invoke(system_prompt + "\n\n" + user_prompt)
            content = result.content if hasattr(result, 'content') else str(result)
            return content

    def match_resume_jd(self, resume_text: str, jd_text: str) -> dict:
        """轻量简历-JD匹配分析，不复用完整8章生成流程。

        对标 industry-resume-toolkit skill 的 /JD匹配 命令，
        但输出落点为「面试备考建议」而非「简历改写建议」。

        约5-10秒出结果，比完整 prep generate 快5倍以上。
        """
        MATCH_SYSTEM_PROMPT = """你是一位资深HR+面试教练。你的任务是分析候选人的简历与目标岗位JD的匹配程度，并输出面试备考建议。

你需要在分析后返回一个严格的JSON对象（不要JSON之外的文字），包含以下字段：

```json
{
  "match_score": 78,
  "core_intent": "一句话概括这个JD的核心诉求，例如：'寻找能独立负责用户增长实验的数据驱动型产品经理'",
  "requirement_matching": [
    {
      "requirement": "JD原文要求",
      "resume_evidence": "简历中找到的对应证据，或'简历未见直接证据'",
      "match_level": "✅强 或 ⚠️中 或 ❌弱 或 -",
      "gap_risk": "这个差距在面试中可能如何暴露（如：追问技术细节时可能露怯）",
      "strategy": "面试中如何应对这个差距（如：主动承认+展示正在学习+引导到优势话题）"
    }
  ],
  "covered": ["你的大厂经历直接命中JD的'互联网行业背景'要求"],
  "diggable": ["你简历写了'数据分析'但没体现AB测试经验——如果你做过AB测试一定要在面试时展开说"],
  "missing": ["JD要求SQL但你简历完全没提——面试时诚实说不会，但补充你在学Coursera SQL课程"],
  "mismatched": ["你过去的电商经历偏toC，但JD偏toB——面试时调整叙事角度，强调可迁移的用户研究方法"],
  "prep_suggestions": ["面试前重点准备1个AB测试案例故事", "补SQL基础语法，至少能写SELECT/JOIN", "准备'为什么从toC转toB'的回答"]
}
```

重要规则：
1. **match_score**（0-100）：综合考虑硬性要求+关键词覆盖+经历匹配度。70+为较强匹配，50-70为中等匹配，<50为弱匹配。
2. **covered**（覆盖项）：简历中明确体现的JD要求，面试时可以自信展示。
3. **diggable**（可挖项）：JD要求的能力，你推断候选人可能做过但简历没写清楚。这些是"信息差"，要在面试时主动展开。
4. **missing**（缺失项）：JD要求但简历确实没有体现的能力。面试时建议诚实承认+展示学习意愿。
5. **mismatched**（错配项）：候选人有相关经历但跟JD的方向/语境不完全对齐。需要调整叙事角度。
6. **prep_suggestions**（备考建议）：5-8条具体可操作的面试准备建议，不同于"改简历建议"——这些是面试时怎么说、怎么准备，不是怎么改简历。
7. 严格遵守保真原则：不编造候选人没做过的经历。
8. 用第二人称「你」称呼候选人（如"你的简历优势是..."）。
9. **requirement_matching** 逐条分析JD的核心要求（3-5条最关键的即可，不用逐字分析），每条附上面试策略。

注意区分 diggable 和 missing：
- diggable = 你可能做了但没写 → 面试时补充展开
- missing = 你真的没有 → 面试时诚实应对"""

        user_prompt = f"""请分析以下简历和JD的匹配程度：

─── 简历 ───
{resume_text[:3000]}

─── JD ───
{jd_text[:3000]}"""

        result = self.llm.invoke(MATCH_SYSTEM_PROMPT + "\n\n" + user_prompt)
        content = result.content if hasattr(result, 'content') else str(result)
        
        # 调试：将 LLM 输出写入文件（避免终端编码问题）
        try:
            import os
            log_dir = "./logs"
            os.makedirs(log_dir, exist_ok=True)
            log_path = os.path.join(log_dir, f"llm_output_{int(time.time())}.txt")
            with open(log_path, "w", encoding="utf-8") as f:
                f.write(f"=== LLM Output ===\n")
                f.write(f"Length: {len(content)} chars\n")
                f.write(f"Content:\n{content}\n")
                f.write(f"\n=== End ===\n")
        except Exception as e:
            pass
        
        data = self._extract_json(content)

        # 确保必要字段存在
        data.setdefault("match_score", 50)
        data.setdefault("core_intent", "")
        data.setdefault("requirement_matching", [])
        data.setdefault("covered", [])
        data.setdefault("diggable", [])
        data.setdefault("missing", [])
        data.setdefault("mismatched", [])
        data.setdefault("prep_suggestions", [])

        # 确保 match_score 是整数且在范围内
        try:
            data["match_score"] = max(0, min(100, int(data["match_score"])))
        except (ValueError, TypeError):
            data["match_score"] = 50

        return data

    def _parse_prep_text(self, text: str) -> dict:
        """LLM 解析非结构化准备文档文本（.md/.docx）为结构化 prep dict。"""
        prompt = f"""你是一个面试准备文档解析器。请将以下非结构化的面试准备文档文本解析为结构化的 JSON。

{FALLBACK_METHODOLOGY[:1500] if FALLBACK_METHODOLOGY else ''}

**输入文本**：
{text[:6000]}

请提取并返回以下 JSON 结构（无法提取的字段用空值）：
{{
  "meta": {{"company_name": "", "role_name": "", "direction": "", "difficulty": "mid", "prep_mode": "standard"}},
  "company_research": {{"overview": "", "products": [], "culture": "", "recent_news": []}},
  "jd_analysis": {{"requirements": [], "jd_summary": ""}},
  "self_intro": "",
  "star_stories": [],
  "predicted_questions": [{{"question": "", "category": "", "difficulty": "medium", "key_points": []}}],
  "gap_analysis": {{"strengths": [], "weaknesses": [], "mitigation_strategies": []}},
  "coaching_tips": [],
  "ask_back_questions": []
}}

只返回 JSON，不要其他内容。"""
        result = self.llm.invoke(prompt)
        content = result.content if hasattr(result, 'content') else str(result)
        data = self._extract_json(content)
        data = self._ensure_structure(data)
        # 确保有基本 meta
        if "meta" not in data:
            data["meta"] = {}
        data["meta"].setdefault("prep_id", f"ext-{uuid.uuid4().hex[:8]}")
        data["meta"].setdefault("company_name", "外部导入")
        data["meta"].setdefault("role_name", "")
        data["meta"].setdefault("generated_at", self._now_iso())
        data["meta"].setdefault("direction", "E")
        data["meta"].setdefault("difficulty", "mid")
        data["meta"].setdefault("prep_mode", "standard")
        data["meta"].setdefault("has_web_search", False)
        data["meta"].setdefault("source_count", 0)
        return data

    def _parse_diagnosis_text(self, text: str) -> dict:
        """LLM 解析非结构化诊断报告文本（.md/.docx）为结构化 diagnosis dict。"""
        prompt = f"""你是一个面试诊断报告解析器。请将以下面试回顾/诊断文本解析为结构化的 JSON。

**输入文本**：
{text[:6000]}

请提取并返回以下 JSON 结构（无法提取的字段用空数组或 0）：
{{
  "overall_score": 0,
  "weaknesses": [],
  "strengths": [],
  "knowledge_map": [{{"name": "", "coverage": 0.0, "depth_score": 0, "keywords_mentioned": [], "missing_concepts": []}}],
  "timeline_data": [{{"question": "", "score": 0, "category": ""}}],
  "improvement_plan": []
}}

规则：
- overall_score: 如果文本中有总分/综合评分，提取为 0-100 的数字；否则根据文本评价倾向估算（正面多→70+，负面多→50-）
- weaknesses: 提取所有提到的弱点、不足、需要改进的地方
- strengths: 提取所有提到的优势、强项、表现好的地方
- knowledge_map: 从文本中识别考察的知识领域及其覆盖程度
- timeline_data: 如果文本提到具体题目和得分，逐条提取
- improvement_plan: 提取所有改进建议

只返回 JSON，不要其他内容。"""
        result = self.llm.invoke(prompt)
        content = result.content if hasattr(result, 'content') else str(result)
        data = self._extract_json(content)
        # 确保必要字段存在
        data.setdefault("overall_score", 0)
        data.setdefault("weaknesses", [])
        data.setdefault("strengths", [])
        data.setdefault("knowledge_map", [])
        data.setdefault("timeline_data", [])
        data.setdefault("improvement_plan", [])
        return data

    def refine_with_diagnosis(self, prep_id: str, diagnosis: dict, prep_data: dict = None,
                              prep_text: str = None, diagnosis_text: str = None) -> dict:
        """基于认知诊断结果反向更新面试准备。

        闭环核心：练习暴露的问题 → 更新 Gap 清单和预测题目。

        prep_data: 可选，传入则直接使用（绕过 _prep_store 内存存储，解决重启丢失问题）。
        prep_text: 可选，原始准备文档文本（.md/.docx），当 prep_data 为空时 LLM 解析后使用。
        diagnosis_text: 可选，原始诊断报告文本（.md/.docx），当 diagnosis 无结构化数据时 LLM 解析后使用。
        """
        # 解析 prep：结构化数据优先，否则尝试从文本解析
        if prep_data:
            prep = prep_data
        elif prep_text:
            prep = self._parse_prep_text(prep_text)
        else:
            prep = _prep_store.get(prep_id)
        if not prep:
            raise ValueError(f"Prep {prep_id} 不存在（后端可能已重启，请从已保存文档重新导入）")

        # 解析 diagnosis：如果传入的 diagnosis 缺少关键字段，尝试从文本解析
        has_structured = bool(diagnosis.get("weaknesses") or diagnosis.get("knowledge_map"))
        if not has_structured and diagnosis_text:
            parsed_diag = self._parse_diagnosis_text(diagnosis_text)
            # 合并：parsed 提供结构化字段，原始 diagnosis 中的其他字段保留
            diagnosis = {**parsed_diag, **diagnosis}
        elif not has_structured:
            # 既无结构化数据也无文本 — 用最小兼容数据让 refine 继续
            diagnosis.setdefault("weaknesses", [])
            diagnosis.setdefault("knowledge_map", [])
            diagnosis.setdefault("timeline_data", [])

        weaknesses = diagnosis.get("weaknesses", [])
        knowledge_map = diagnosis.get("knowledge_map", [])
        timeline = diagnosis.get("timeline_data", [])

        # 找出得分最低的领域
        weak_areas = [k for k in knowledge_map if k.get("coverage", 0) < 0.5]
        low_score_questions = [t for t in timeline if t.get("score", 100) < 50]

        user_prompt = f"""## 面试准备更新（基于真实面试表现）

**原始准备文档**：
{json.dumps(prep, ensure_ascii=False, indent=2)[:3000]}

**认知诊断结果**：
- 薄弱项：{json.dumps(weaknesses, ensure_ascii=False)}
- 弱覆盖领域：{json.dumps(weak_areas, ensure_ascii=False)}
- 低分题目：{json.dumps(low_score_questions, ensure_ascii=False)}

请更新以下部分（JSON格式）：
{{
  "updated_gap_analysis": {{
    "priority_1_must_fix": [将诊断暴露的弱项提到P1],
    "priority_2_should_fix": [...],
    "priority_3_nice_to_have": [...]
  }},
  "new_target_questions": [针对弱项的新题目 3-5 道],
  "refined_self_intro": "根据实际表现优化后的自我介绍（≤250字）",
  "coaching_tips": ["基于实际表现的针对性建议 3-5 条"]
}}"""

        result = self.llm.invoke(user_prompt)
        content = result.content if hasattr(result, 'content') else str(result)
        update_data = self._extract_json(content)

        # 合并更新
        if update_data.get("updated_gap_analysis"):
            prep["gap_analysis"] = update_data["updated_gap_analysis"]
        if update_data.get("new_target_questions"):
            prep["predicted_questions"].extend(update_data["new_target_questions"])
        if update_data.get("refined_self_intro"):
            prep["self_intro"] = update_data["refined_self_intro"]
        if update_data.get("coaching_tips"):
            prep["coaching_tips"] = update_data["coaching_tips"]

        prep["meta"]["diagnosis_feedback"] = {
            "overall_score": diagnosis.get("overall_score"),
            "weaknesses": weaknesses,
            "applied_at": self._now_iso(),
        }

        _prep_store[prep_id] = prep
        return prep

    def get_prep(self, prep_id: str) -> dict:
        """获取已存储的面试准备文档。"""
        if prep_id not in _prep_store:
            raise ValueError(f"Prep {prep_id} 不存在")
        return _prep_store[prep_id]

    @staticmethod
    def _now_iso() -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()

    def _extract_json(self, text: str) -> dict:
        """从 LLM 输出提取 JSON，支持多种格式和错误恢复。"""
        try:
            # 尝试 1: 查找 markdown 代码块中的 JSON
            match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
            if match:
                cleaned = self._clean_json(match.group(1))
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    pass
            
            # 尝试 2: 查找任何代码块
            match = re.search(r'```[\s\S]*?\n([\s\S]*?)\s*```', text)
            if match:
                cleaned = self._clean_json(match.group(1))
                try:
                    return json.loads(cleaned)
                except json.JSONDecodeError:
                    pass
            
            # 尝试 3: 直接找 JSON 对象（处理嵌套）
            brace_count = 0
            start = -1
            for i, ch in enumerate(text):
                if ch == '{':
                    if brace_count == 0:
                        start = i
                    brace_count += 1
                elif ch == '}':
                    brace_count -= 1
                    if brace_count == 0 and start >= 0:
                        json_str = text[start:i+1]
                        cleaned = self._clean_json(json_str)
                        try:
                            return json.loads(cleaned)
                        except json.JSONDecodeError:
                            start = -1
        except (json.JSONDecodeError, AttributeError):
            pass
        return {}
    
    def _clean_json(self, text: str) -> str:
        """清理 JSON 字符串中的常见问题。"""
        cleaned = text.strip()
        
        # 处理 Windows 换行符
        cleaned = cleaned.replace('\r\n', '\n')
        
        # 移除 trailing commas（JSON 不允许）
        cleaned = re.sub(r',\s*([}\]])', r'\1', cleaned)
        
        return cleaned

    def _get_match_level(self, status):
        """根据 match_status 获取 match_level。"""
        status = str(status).lower()
        if "match" in status or "匹配" in status or "✅" in status:
            return "high"
        elif "partial" in status or "部分" in status or "⚠️" in status:
            return "medium"
        elif "gap" in status or "缺失" in status or "❌" in status:
            return "low"
        return "medium"
    
    def _get_gap_risk(self, status):
        """根据 match_status 获取 gap_risk。"""
        status = str(status).lower()
        if "gap" in status or "缺失" in status or "❌" in status:
            return "high"
        elif "partial" in status or "部分" in status or "⚠️" in status:
            return "medium"
        return "low"
    
    def _extract_category_name(self, category_key: str) -> str:
        """从字段名提取类别中文名称。"""
        category_map = {
            "industry_specific": "行业特性",
            "role_specialized": "岗位专项",
            "role_specialized_F": "全栈专项",
            "technical_fundamentals": "技术基础",
            "technical_fundamentals_F": "技术基础",
            "motivation_based": "动机问题",
            "behavioral": "行为面试",
            "project_deep_dive": "项目深挖",
            "system_design": "系统设计",
            "ai_knowledge": "AI知识",
            "rag": "RAG",
            "llm": "LLM",
        }
        
        # 尝试精确匹配
        for key, name in category_map.items():
            if key.lower() in category_key.lower():
                return name
        
        # 如果是带方向后缀的（如 role_specialized_F_ai_fullstack）
        if "_F_" in category_key:
            return "全栈专项"
        if "_E_" in category_key:
            return "产品专项"
        
        # 默认返回处理后的字段名
        return category_key.replace("_", " ").capitalize()

    def _format_requirement_matching(self, items):
        """格式化 requirement_matching 字段，补充缺失的字段。"""
        formatted = []
        for item in items:
            if isinstance(item, dict):
                formatted.append({
                    "requirement": item.get("requirement", item.get("requirement_text", "")),
                    "resume_evidence": item.get("resume_evidence", item.get("evidence", "-")),
                    "match_status": item.get("match_status", item.get("status", "")),
                    "analysis": item.get("analysis", item.get("comment", "")),
                    "match_level": item.get("match_level", self._get_match_level(item.get("match_status", ""))),
                    "gap_risk": item.get("gap_risk", self._get_gap_risk(item.get("match_status", ""))),
                    "strategy": item.get("strategy", "")
                })
        return formatted

    def _ensure_structure(self, data: dict, resume_text: str = "", jd_text: str = "") -> dict:
        """确保输出包含完整结构，缺失部分填默认值。"""
        
        # 处理嵌套结构：如果数据在 interview_prep_doc 中，提取出来
        if "interview_prep_doc" in data and isinstance(data["interview_prep_doc"], dict):
            inner_data = data.pop("interview_prep_doc")
            data.update(inner_data)
        
        # 字段名映射：处理 LLM 可能返回的不同字段名
        field_mappings = {
            "chapter_2_jd_analysis": "jd_analysis",
            "jd_analysis": "jd_analysis",
            "jd_match_analysis": "jd_analysis",
            "jd_matching_analysis": "jd_analysis",
            "jd_interpretation": "jd_analysis",
            "section_2_jd_analysis": "jd_analysis",
            "chapter_5_high_frequency_questions": "predicted_questions",
            "predicted_questions": "predicted_questions",
            "high_frequency_questions": "predicted_questions",
            "section_5_high_frequency_questions": "predicted_questions",
            "chapter_3_self_introduction": "self_intro",
            "self_intro": "self_intro",
            "self_introduction": "self_intro",
            "section_3_self_introduction": "self_intro",
            "appendix_gap_list": "gap_analysis",
            "gap_analysis": "gap_analysis",
            "gap_list": "gap_analysis",
            "section_6_gap_analysis": "gap_analysis",
            "chapter_1_company_research": "company_research",
            "company_research": "company_research",
            "company_overview": "company_research",
            "section_1_company_research": "company_research",
            "section_4_project_deep_dive": "star_stories",
            "project_deep_dive": "star_stories",
            "section_7_coaching_tips": "coaching_tips",
            "section_7_ask_back_questions": "ask_back_questions",
            "section_8_ask_back_questions": "ask_back_questions",
        }
        
        # 重命名字段
        for old_key, new_key in field_mappings.items():
            if old_key in data and old_key != new_key:
                data[new_key] = data.pop(old_key)
        
        # 补充 company_research 中缺失的字段
        if "company_research" in data and isinstance(data["company_research"], dict):
            company_defaults = {
                "overview": "未搜索到公司信息，建议补充",
                "product_features": "",
                "competitors": "",
                "ai_strategy": "",
                "recent_news": "",
                "culture_signals": "",
                "sources": []
            }
            for key, default in company_defaults.items():
                if key not in data["company_research"]:
                    data["company_research"][key] = default
        
        defaults = {
            "company_research": {"overview": "未搜索到公司信息，建议补充",
                                 "product_features": "", "competitors": "",
                                 "ai_strategy": "", "recent_news": "", "culture_signals": "",
                                 "sources": []},
            "jd_analysis": {"core_intent": "未能解析JD核心意图",
                            "plain_language": [],
                            "requirement_matching": []},
            "self_intro": "（请根据简历和JD生成个性化自我介绍，≤250字）",
            "star_stories": [],
            "predicted_questions": [],
            "gap_analysis": {"priority_1_must_fix": [], "priority_2_should_fix": [],
                             "priority_3_nice_to_have": []},
            "focus_areas": [],
            "prep_summary": "面试准备文档已生成，请查看各章节详情。",
            "coaching_tips": [],
            "ask_back_questions": [],
        }
        
        # 处理 jd_analysis 字段格式转换
        if "jd_analysis" in data:
            jd_data = data["jd_analysis"]
            if isinstance(jd_data, list):
                data["jd_analysis"] = {
                    "core_intent": "JD分析完成",
                    "plain_language": [],
                    "requirement_matching": jd_data
                }
            elif isinstance(jd_data, dict):
                # 处理带编号的字段名（如 2.1_core_intent）
                core_intent = jd_data.get("core_intent", "")
                plain_language = []
                requirement_matching = []
                
                for key, value in jd_data.items():
                    if "core_intent" in key.lower() or "核心意图" in key:
                        core_intent = str(value) if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
                    elif "responsibility" in key.lower() or "职责" in key or "interpretation" in key.lower():
                        if isinstance(value, list):
                            plain_language.extend(value)
                        else:
                            plain_language.append(str(value))
                    elif "matching" in key.lower() or "匹配" in key:
                        if isinstance(value, list):
                            requirement_matching = self._format_requirement_matching(value)
                    elif "requirements" in key.lower():
                        requirement_matching = self._format_requirement_matching(value)
                
                # 转换 plain_language 格式
                formatted_plain_language = []
                for item in plain_language:
                    if isinstance(item, dict):
                        formatted_plain_language.append({
                            "original": item.get("requirement", item.get("original", "")),
                            "plain": item.get("interpretation", item.get("plain", ""))
                        })
                    elif isinstance(item, str):
                        formatted_plain_language.append({
                            "original": item,
                            "plain": item
                        })
                
                data["jd_analysis"] = {
                    "core_intent": core_intent if core_intent else "JD分析完成",
                    "plain_language": formatted_plain_language,
                    "requirement_matching": requirement_matching
                }
        
        # 统一格式化 requirement_matching
        if "jd_analysis" in data and "requirement_matching" in data["jd_analysis"]:
            data["jd_analysis"]["requirement_matching"] = self._format_requirement_matching(
                data["jd_analysis"]["requirement_matching"]
            )
        
        # 处理 self_intro 字段格式转换
        if "self_intro" in data and isinstance(data["self_intro"], dict):
            data["self_intro"] = data["self_intro"].get("content", "")
        
        # 处理 predicted_questions 字段格式转换
        if "predicted_questions" in data:
            questions = data["predicted_questions"]
            formatted_questions = []
            
            if isinstance(questions, dict):
                # 处理字典格式（如 {industry_specific: [...], role_specialized: [...]}）
                for category, items in questions.items():
                    if isinstance(items, list):
                        category_name = self._extract_category_name(category)
                        for q in items:
                            if isinstance(q, str):
                                formatted_questions.append({
                                    "question": q,
                                    "category": category_name,
                                    "source": "JD推导",
                                    "key_points": []
                                })
                            elif isinstance(q, dict):
                                formatted_questions.append({
                                    "question": q.get("question", q.get("text", "")),
                                    "category": category_name,
                                    "source": "JD推导",
                                    "key_points": q.get("key_points", []) if isinstance(q.get("key_points"), list) else []
                                })
            elif isinstance(questions, dict) and "questions" in questions:
                questions = questions["questions"]
            
            if isinstance(questions, list):
                for q in questions:
                    if isinstance(q, dict):
                        formatted_questions.append({
                            "question": q.get("question", q.get("text", "")),
                            "category": q.get("category", q.get("source_type", "综合")),
                            "source": "JD推导",
                            "key_points": q.get("key_points", []) if isinstance(q.get("key_points"), list) else []
                        })
                    elif isinstance(q, str):
                        formatted_questions.append({
                            "question": q,
                            "category": "综合",
                            "source": "JD推导",
                            "key_points": []
                        })
            data["predicted_questions"] = formatted_questions
        
        # 处理 ask_back_questions 字段格式转换
        if "ask_back_questions" in data:
            ask_back = data["ask_back_questions"]
            formatted_ask_back = []
            
            if isinstance(ask_back, dict):
                # 处理字典格式（如 section_7_ask_back_questions 的内容）
                for key, value in ask_back.items():
                    if isinstance(value, list):
                        for item in value:
                            if isinstance(item, str):
                                formatted_ask_back.append(item)
                            elif isinstance(item, dict):
                                formatted_ask_back.append(item.get("question", item.get("text", "")))
                    elif isinstance(value, str):
                        formatted_ask_back.append(value)
            elif isinstance(ask_back, list):
                for item in ask_back:
                    if isinstance(item, str):
                        formatted_ask_back.append(item)
                    elif isinstance(item, dict):
                        formatted_ask_back.append(item.get("question", item.get("text", "")))
            
            data["ask_back_questions"] = formatted_ask_back
        
        # 处理 star_stories 字段格式转换
        if "star_stories" in data:
            stories = data["star_stories"]
            formatted_stories = []
            
            if isinstance(stories, dict):
                # 处理字典格式（如 project_1, project_2 等）
                for key, value in stories.items():
                    if isinstance(value, dict):
                        # 从 key 或 value 中提取项目名称
                        project_name = value.get("project_name", value.get("name", ""))
                        if not project_name:
                            # 从 situation 中提取简短描述作为项目名
                            situation = value.get("situation", "")
                            project_name = situation[:30] + "..." if len(situation) > 30 else situation
                        
                        formatted_stories.append({
                            "project_name": project_name,
                            "situation": value.get("situation", value.get("Situation", "")),
                            "task": value.get("task", value.get("Task", "")),
                            "action": value.get("action", value.get("Action", "")),
                            "result": value.get("result", value.get("Result", "")),
                            "follow_up_questions": value.get("follow_up_questions", value.get("follow_up", []))
                        })
            elif isinstance(stories, list):
                for idx, story in enumerate(stories):
                    if isinstance(story, dict):
                        # 从 story 中提取项目名称
                        project_name = story.get("project_name", story.get("name", ""))
                        if not project_name:
                            # 从 situation 中提取简短描述作为项目名
                            situation = story.get("situation", "")
                            project_name = situation[:30] + "..." if len(situation) > 30 else situation
                        
                        formatted_stories.append({
                            "project_name": project_name,
                            "situation": story.get("situation", story.get("Situation", "")),
                            "task": story.get("task", story.get("Task", "")),
                            "action": story.get("action", story.get("Action", "")),
                            "result": story.get("result", story.get("Result", "")),
                            "follow_up_questions": story.get("follow_up_questions", story.get("follow_up", []))
                        })
            
            data["star_stories"] = formatted_stories
        
        # 处理 gap_analysis 字段格式转换
        if "gap_analysis" in data:
            gaps = data["gap_analysis"]
            if isinstance(gaps, list):
                priority_1 = []
                priority_2 = []
                priority_3 = []
                for gap in gaps:
                    if isinstance(gap, dict):
                        priority = gap.get("priority", 2)
                        item = {
                            "gap": gap.get("gap", gap.get("issue", "")),
                            "action": gap.get("action", gap.get("suggestion", ""))
                        }
                        if priority == 1:
                            priority_1.append(item)
                        elif priority == 3:
                            priority_3.append(item)
                        else:
                            priority_2.append(item)
                data["gap_analysis"] = {
                    "priority_1_must_fix": priority_1,
                    "priority_2_should_fix": priority_2,
                    "priority_3_nice_to_have": priority_3
                }
        
        for key, default in defaults.items():
            if key not in data or not data[key]:
                data[key] = default
        return data


def difficulty_label(d: str) -> str:
    """将难度代码转为中文标签。"""
    return {
        "intern": "实习生",
        "junior": "初级",
        "mid": "中级",
        "senior": "高级",
        "lead": "专家/组长",
    }.get(d, d)
