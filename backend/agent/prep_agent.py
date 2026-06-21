"""Interview Preparation Agent — 面试准备文档生成 + 闭环反馈。

对标 interview-prep skill 的核心方法，使用相同 LLM 基础设施，
生成：公司/产品调研、JD深度解读、定制自我介绍、STAR预案、
高频题预测、Gap清单。支持从认知诊断结果反向更新。

v2.1: 集成真实联网搜索 + prep_mode 速度模式。
"""

import json
import os
import re
import concurrent.futures
from typing import Optional

from rag.web_search import (
    search_company,
    search_interview_experiences,
    format_for_llm,
)
import uuid
import requests
from typing import Optional

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
        timeout=120,
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
                - rapid: 速准版 — 跳过深度调研，3分钟生成核心5章
                - standard: 标准版 — 完整调研+8章文档
                - deep: 深研版 — 标准版+竞品对比+延伸阅读

        Returns:
            完整的 prep 文档 dict + prep_id
        """
        prep_id = uuid.uuid4().hex[:12]
        direction_label = ROLE_DIRECTIONS.get(direction, "其他")

        # ── 联网搜索（并行）──
        web_context = ""
        sources_list = []

        if prep_mode in ("standard", "deep") and company_name:
            # 并行：联网搜索 + LLM 训练数据知识提取
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                future_company = executor.submit(self._run_company_search, company_name)
                future_interviews = executor.submit(
                    search_interview_experiences, company_name, role_name
                )
                future_llm_company = executor.submit(self._try_llm_company_info, company_name, direction, direction_label)
                future_llm_interview = executor.submit(
                    self._try_llm_interview_knowledge, company_name, role_name, direction, direction_label
                )

                company_results = future_company.result(timeout=30)
                interview_results = future_interviews.result(timeout=30)
                llm_company_info = future_llm_company.result(timeout=30)
                llm_interview_knowledge = future_llm_interview.result(timeout=30)

            has_web_results = bool(company_results or interview_results)

            if has_web_results:
                # 联网搜索成功 → 搜索为主，LLM为辅
                if company_results:
                    web_context += f"""
## 🌐 联网搜索 · 公司信息
{format_for_llm(company_results.get('overview', [])[:4])}
**近期动态**：
{format_for_llm(company_results.get('recent_news', [])[:3])}
**AI战略**：
{format_for_llm(company_results.get('ai_strategy', [])[:3])}
**团队/文化**：
{format_for_llm(company_results.get('culture', [])[:3])}
"""
                    for cat in ["overview", "recent_news", "ai_strategy", "culture"]:
                        for r in company_results.get(cat, []):
                            sources_list.append({"title": r["title"], "url": r["url"]})

                if interview_results:
                    web_context += f"""
## 🌐 联网搜索 · 真实面经
{format_for_llm(interview_results[:8])}
"""
                    for r in interview_results[:8]:
                        sources_list.append({"title": r["title"], "url": r["url"]})

                # LLM 知识作为补充（轻量提示）
                if llm_company_info:
                    web_context += f"""
## 📚 LLM补充 · 公司背景（基于训练数据）
{json.dumps(llm_company_info, ensure_ascii=False)}
"""
            else:
                # 联网搜索完全失败 → LLM 训练数据知识作为主要来源
                llm_context = self._format_llm_knowledge_context(llm_company_info, llm_interview_knowledge)
                if llm_context:
                    web_context += llm_context
                    sources_list.append({"title": "LLM训练数据", "url": "基于模型训练数据，非实时搜索"})
                else:
                    web_context += "\n（联网搜索失败且LLM训练数据中未找到该公司的足够信息。建议手动补充公司资料。）\n"

        else:
            # rapid 模式 + 无公司名：只用 LLM 知识
            llm_company_info = self._try_llm_company_info(company_name, direction, direction_label) if company_name else None
            llm_interview = self._try_llm_interview_knowledge(company_name, role_name, direction, direction_label) if company_name else None
            llm_context = self._format_llm_knowledge_context(llm_company_info, llm_interview)
            if llm_context:
                web_context = llm_context
                sources_list.append({"title": "LLM训练数据", "url": "rapid模式 — 基于模型训练数据"})
            elif llm_company_info:
                web_context = f"## 公司背景（LLM知识，非实时搜索）\n{json.dumps(llm_company_info, ensure_ascii=False)}"

        # ── 构建 prompt ──
        mode_instruction = self._get_mode_instruction(prep_mode, direction)

        user_prompt = f"""## 面试准备任务 [{prep_mode.upper()}模式]

**目标岗位**：{role_name}
**目标公司**：{company_name}
**岗位方向**：{direction_label}
**目标职级**：{difficulty_label(difficulty)}

**候选人简历**：
{resume_text or "未提供"}

**岗位 JD**：
{jd_text or "未提供"}

{web_context}

{mode_instruction}

请根据上述信息生成完整面试准备文档。严格按照JSON格式输出。

特别要求：
1. JD逐条匹配分析：先找简历证据再下判断，没有证据的标"-"
2. 自我介绍：≤250字，口语化，针对该岗位编排
3. 预测题目：含面经预测 + 岗位专项 + JD推导 + 简历深挖四种来源。如有真实面经搜索结果，优先从中提取
4. Gap清单：按优先级1/2/3分组，含具体补课行动
5. 若方向为E(AI产品)，关注AI基础认知/产品设计/行业格局类题目
6. 若方向为F(AI全栈开发)，关注LLM理论/RAG实战/Agent开发/系统设计/编程算法类题目
7. 公司调研章节必须标注信息来源（联网搜索结果标注真实URL，LLM知识标注'基于训练数据'）
8. coaching_tips：基于简历和JD差距，给出3-5条针对性备考建议（具体可操作的建议，而非泛泛而谈）
9. ask_back_questions：生成5-8个反问面试官的问题，覆盖公司战略/团队文化/岗位发展/技术方向/工作节奏等维度，体现求职者的思考深度"""

        # 调用 LLM
        result = self.llm.invoke(user_prompt)
        content = result.content if hasattr(result, 'content') else str(result)

        # 解析 JSON
        prep_data = self._extract_json(content)

        # 补充默认值
        prep_data = self._ensure_structure(prep_data, resume_text, jd_text)

        # 覆盖/补充公司调研的来源标注
        if sources_list and prep_data.get("company_research"):
            prep_data["company_research"]["sources"] = [
                s["url"] for s in sources_list[:10]
            ]

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
            "has_web_search": bool(sources_list),
            "source_count": len(sources_list),
        }

        # 存储
        _prep_store[prep_id] = prep_data

        return prep_data

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

    def refine_with_diagnosis(self, prep_id: str, diagnosis: dict) -> dict:
        """基于认知诊断结果反向更新面试准备。

        闭环核心：练习暴露的问题 → 更新 Gap 清单和预测题目。
        """
        prep = _prep_store.get(prep_id)
        if not prep:
            raise ValueError(f"Prep {prep_id} 不存在")

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

    def _run_company_search(self, company_name: str) -> dict:
        """执行公司联网搜索（非阻塞wrapper，捕获异常）。"""
        try:
            return search_company(company_name)
        except Exception as e:
            print(f"[prep_agent] Company search failed: {e}")
            return {}

    def _try_llm_company_info(self, company_name: str, direction: str = "G", direction_label: str = "其他") -> Optional[dict]:
        """用 LLM 训练数据提取公司背景知识（联网搜索失败时的深度回退）。

        根据岗位方向，从 LLM 训练数据中提取该公司对应该方向有价值的信息。
        E岗(AI产品)侧重产品矩阵和AI策略，F岗(AI全栈)侧重技术栈和AI Infra。
        """
        if not company_name:
            return None

        # 获取该方向的考察重点作为提取指引
        dir_context = DIRECTION_INTERVIEW_CONTEXT.get(direction, DIRECTION_INTERVIEW_CONTEXT["G"])
        # 提取"公司知识提取重点"部分
        company_focus = ""
        for line in dir_context.split("\n"):
            if "公司知识提取重点" in line:
                company_focus = line.strip()
                break

        try:
            prompt = f"""你是一个企业信息数据库。请用你的训练数据尽可能详细地介绍"{company_name}"公司。

当前用户面试方向：{direction_label}，该方向关注的公司信息维度：
{company_focus}

请针对以上维度，优先提取与该面试方向最相关的公司信息。JSON格式返回：
{{
  "description": "公司一句话定位",
  "size": "员工规模（如万人/千人/百人）",
  "funding": "融资阶段（如已上市/Pre-IPO/D轮等）",
  "founded": "成立年份",
  "main_products": ["核心产品1", "核心产品2", "核心产品3"],
  "ai_strategy": "AI/大模型相关布局（如有关）— 这对AI方向面试尤其重要",
  "tech_stack_hint": "技术栈倾向（如已知）— AI全栈方向特别关注",
  "competitors": ["竞品1", "竞品2"],
  "culture_signals": "团队文化特点、加班情况、技术氛围",
  "hiring_trend": "近期招聘动态/团队扩张方向（如有关）",
  "direction_specific_note": "针对{direction_label}面试者，该公司最值得关注的1-2个特点",
  "confidence": "high/medium/low — 你对该公司的了解程度",
  "note": "此信息完全基于LLM训练数据（截止日期前的知识），非实时搜索，可能已过时"
}}"""
            result = self.llm.invoke(prompt)
            content = result.content if hasattr(result, 'content') else str(result)
            info = self._extract_json(content)
            if info and info.get("confidence") in ("high", "medium"):
                return info
            elif info:
                info["note"] = "⚠️ 低置信度：该公司的训练数据覆盖有限，建议补充联网搜索"
                return info
            return None
        except Exception:
            return None

    def _try_llm_interview_knowledge(
        self, company_name: str, role_name: str, direction: str = "G", direction_label: str = "其他"
    ) -> Optional[dict]:
        """用 LLM 训练数据合成面试经验，按岗位方向定制考察重点。

        每个方向有独立的 DIRECTION_INTERVIEW_CONTEXT，描述该岗位面试的：
        - 核心能力考察维度
        - 典型面试题类型
        - 深挖方向（内行才知道的考察重点）
        - 公司知识提取重点

        这比泛泛地问"介绍一下面试流程"能激活 LLM 训练数据中精细得多的记忆。
        """
        if not company_name and not role_name:
            return None

        dir_context = DIRECTION_INTERVIEW_CONTEXT.get(direction, DIRECTION_INTERVIEW_CONTEXT["G"])

        try:
            prompt = f"""你是一个面试顾问知识库，专门研究各公司的面试风格和考察重点。

{dir_context}

现在请针对"{company_name}"的"{role_name}"岗位（方向：{direction_label}），用你的训练数据回答：

1. 你在训练数据中见过该公司的{direction_label}面试讨论吗？面试流程是什么？
2. 该方向特有的高频考点和题目类型是什么？
3. 该公司的面试风格有何独特之处（跟同行业其他公司比）？
4. 如果你训练数据中没见过该公司的面经，坦诚说明，并给出该行业/岗位的通用面试模式。

JSON格式返回：
{{
  "typical_process": "典型面试流程（如：简历筛选→笔试→N轮技术面→HR面），标注是基于该公司面经还是行业通用模式",
  "common_topics": ["高频考点1 — 需要与{direction_label}方向直接相关", "考点2", "考点3", "考点4", "考点5"],
  "difficulty_level": "偏低/中等/偏高/极高",
  "unique_style": "面试风格特点 — 与其他公司的区别（如：更重算法/更重项目深挖/更重BQ行为面试等）",
  "what_they_really_test": "表面考察X，实际在考察Y — 面试官没说出口的真实意图",
  "role_specific_advice": "针对{direction_label}面试的特别建议 — 不要泛泛而谈",
  "common_mistakes": ["该方向面试者常犯错误1", "错误2"],
  "sample_questions_from_training": [
    {{"question": "与{direction_label}方向直接相关的具体题目1", "category": "分类"}},
    {{"question": "题目2", "category": "分类"}},
    {{"question": "题目3", "category": "分类"}},
    {{"question": "题目4", "category": "分类"}},
    {{"question": "题目5", "category": "分类"}}
  ],
  "is_from_company_specific_data": true,
  "confidence": "high/medium/low",
  "note": "基于LLM训练数据中见过的面经和面试讨论，非实时搜索。标注了哪些是该公司特有问题、哪些是行业通用问题。"
}}"""
            result = self.llm.invoke(prompt)
            content = result.content if hasattr(result, 'content') else str(result)
            return self._extract_json(content)
        except Exception:
            return None

    def _format_llm_knowledge_context(self, company_info: Optional[dict], interview_knowledge: Optional[dict]) -> str:
        """将 LLM 训练数据知识格式化为 prompt 上下文，标注来源以区别于实时搜索结果。"""
        parts = []
        parts.append("\n## 📚 LLM训练数据知识（非实时搜索，可能已过时）\n")

        if company_info and company_info.get("confidence") != "low":
            parts.append(f"""**公司概况**（置信度：{company_info.get('confidence', 'unknown')}）
- 定位：{company_info.get('description', '未知')}
- 规模：{company_info.get('size', '未知')} | 成立：{company_info.get('founded', '未知')} | 融资：{company_info.get('funding', '未知')}
- 核心产品：{', '.join(company_info.get('main_products', []))}
- AI策略：{company_info.get('ai_strategy', company_info.get('ai_focus', '未提及'))}
- 技术栈倾向：{company_info.get('tech_stack_hint', '未知')}
- 竞品格局：{', '.join(company_info.get('competitors', []))}
- 团队文化：{company_info.get('culture_signals', '未提及')}
- 招聘动态：{company_info.get('hiring_trend', '未提及')}
- 面试方向关注：{company_info.get('direction_specific_note', '')}
- {company_info.get('note', '')}
""")

        if interview_knowledge and interview_knowledge.get("confidence") != "low":
            parts.append(f"""**面试相关**（置信度：{interview_knowledge.get('confidence', 'unknown')}）
- 典型流程：{interview_knowledge.get('typical_process', '未知')}
- 高频考点：{', '.join(interview_knowledge.get('common_topics', []))}
- 难度：{interview_knowledge.get('difficulty_level', '未知')} | 风格：{interview_knowledge.get('unique_style', '未知')}
- 面试官真实意图：{interview_knowledge.get('what_they_really_test', '未提及')}
- 方向专属建议：{interview_knowledge.get('role_specific_advice', '无')}
""")

            mistakes = interview_knowledge.get('common_mistakes', [])
            if mistakes:
                parts.append("**常见错误**：")
                for m in mistakes:
                    parts.append(f"  - ⚠️ {m}")

            sample_qs = interview_knowledge.get('sample_questions_from_training', [])
            if sample_qs:
                parts.append("**训练数据中见过的题目**：")
                for q in sample_qs:
                    parts.append(f"  - [{q.get('category', '综合')}] {q.get('question', '')}")

            parts.append(f"\n{interview_knowledge.get('note', '')}")

        if not company_info and not interview_knowledge:
            parts.append("（LLM训练数据中未找到该公司/岗位的足够信息，请优先使用联网搜索或手动补充。）\n")
        else:
            parts.append("\n> ⚠️ 以上内容来自LLM训练数据，非实时搜索。请在生成面试准备文档时：")
            parts.append("> 1. 公司调研章节标注来源为'基于训练数据'")
            parts.append("> 2. 如与搜索到的实时信息冲突，以实时信息为准")
            parts.append("> 3. 对于无法验证的具体数据（融资额、员工数等），避免给出精确数字\n")

        return "\n".join(parts)

    def _get_mode_instruction(self, prep_mode: str, direction: str) -> str:
        """根据准备模式返回不同的生成指令。"""
        if prep_mode == "rapid":
            return """**速准模式指令**：
- 跳过深度公司调研（已有联网搜索结果足以）
- 公司调研精简为3-5行概述
- 预测题目精简为5道核心题
- STAR预案只生成最相关的2个项目
- Gap清单只输出P1（必须补的前5条）
- 总体输出字数精简30%"""
        elif prep_mode == "deep":
            extra = ""
            if direction == "E":
                extra = "\n- E岗追加：深度AI产品分析，端到端拆解一个AI功能"
            elif direction == "F":
                extra = "\n- F岗追加：技术博客解析+GitHub开源分析+核心技术栈推断"
            return f"""**深研模式指令**：
- 竞品格局扩展为详细对比表
- 反问清单扩展为10条
- 附加3-5篇延伸阅读链接{extra}
- STAR预案生成3个项目，每个3条追问
- 公司调研章节尽可能详细"""
        else:
            return "**标准模式**：生成完整8章文档，每章节保持标准深度。"

    @staticmethod
    def _now_iso() -> str:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc).isoformat()

    def _extract_json(self, text: str) -> dict:
        """从 LLM 输出提取 JSON。"""
        try:
            match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
            if match:
                return json.loads(match.group(1))
            # 尝试直接找 JSON 对象
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
                        try:
                            return json.loads(text[start:i+1])
                        except json.JSONDecodeError:
                            start = -1
        except (json.JSONDecodeError, AttributeError):
            pass
        return {}

    def _ensure_structure(self, data: dict, resume_text: str, jd_text: str) -> dict:
        """确保输出包含完整结构，缺失部分填默认值。"""
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
