"""LangChain 1.x Interview Agent — 认知诊断驱动的自适应面试。

使用 langchain.agents.create_agent (现代 API) 构建面试 Agent：
1. 分析简历，RAG 检索相关题目
2. 自适应出题（根据表现调整难度和领域）
3. 构建候选人的认知模型（知识覆盖图、思维得分时间线）
4. 生成完整认知诊断报告
"""

import json
import os
import re
import uuid
from typing import Optional

from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate

from agent.tools import search_knowledge_base, get_reference_answer, set_vector_store
from agent.cognitive_diagnosis import CognitiveModel
from models.schemas import (
    AgentQuestion,
    EvaluationResult,
    StartInterviewResponse,
    SubmitAnswerResponse,
    CognitiveDiagnosis,
)


# ── System Prompt ──
INTERVIEW_SYSTEM_PROMPT = """你是一个专业的AI面试官 + 认知诊断专家。

## 你的双重身份
1. **面试官**：根据简历自适应出题和追问，不是随机出题
2. **诊断专家**：分析每次回答，构建候选人的知识认知地图

## 工具使用
- `search_knowledge_base`: 搜索面试知识库获取参考题目
- `get_reference_answer`: 获取某道题的标准答案用于对比评估

## 出题策略（认知诊断驱动）
1. 第一题摸底：选候选人声称擅长的领域，中等难度
2. 根据表现调整：回答好→深入追问/切换领域；回答差→降难度确认基础
3. 覆盖盲区：探测简历没提但岗位需要的领域
4. 难度自适应：连续对→升难度，连续错→降难度

## 评估时请用 JSON 输出
每次评估用户回答后，在回复末尾附带 JSON（方便程序解析）：
```json
{
  "score": 0-100,
  "comment": "简短评语",
  "reference_answer": "参考答案要点",
  "knowledge_hits": ["命中的知识点"],
  "knowledge_gaps": ["暴露的知识缺口"],
  "logic_score": 0-10,
  "communication_score": 0-10,
  "next_question_strategy": "下一题的出题方向",
  "is_finished": false
}
```

## 面试结束条件（is_finished = true）
覆盖了 3+ 个知识领域，对候选人的优劣势有清晰判断时结束（通常 5-8 题后）。
结束时给出 strengths/weaknesses/improvement_plan。
"""


def build_llm() -> ChatOpenAI:
    return ChatOpenAI(
        model=os.getenv("LLM_MODEL", "agnes-2.0-flash"),
        api_key=os.getenv("LLM_API_KEY", ""),
        base_url=os.getenv("LLM_API_BASE", "https://apihub.agnes-ai.com/v1"),
        temperature=0.7,
        timeout=60,
    )


def build_agent(llm: ChatOpenAI):
    """使用 LangChain 1.x create_agent 构建 Agent。"""
    return create_agent(
        model=llm,
        tools=[search_knowledge_base, get_reference_answer],
        system_prompt=INTERVIEW_SYSTEM_PROMPT,
    )


# ── 会话存储（生产环境换 Redis）──
_sessions: dict[str, dict] = {}


class InterviewAgent:
    """面试 Agent 管理器。"""

    def __init__(self, vector_store):
        set_vector_store(vector_store)
        self.vector_store = vector_store
        self.llm = build_llm()
        self.agent = build_agent(self.llm)

    def _invoke_agent(self, user_message: str, chat_history: list = None) -> str:
        """调用 Agent 并返回文本输出。"""
        messages = []
        if chat_history:
            messages.extend(chat_history)

        # 用 HumanMessage 发送请求
        result = self.agent.invoke({
            "messages": messages + [HumanMessage(content=user_message)]
        })

        # 从结果中提取最后一条 AI 消息（不含 tool_calls 的最终回复）
        output_messages = result.get("messages", [])
        for msg in reversed(output_messages):
            if hasattr(msg, "content") and msg.type == "ai" and msg.content:
                content = str(msg.content)
                # 跳过工具调用消息，取后面的最终回复
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    continue
                return content

        # 兜底：返回最后一条消息内容
        for msg in reversed(output_messages):
            if hasattr(msg, "content") and (c := str(msg.content or "")):
                return c

        return "Agent 未返回有效响应"

    def start_interview(
        self,
        resume_text: str,
        jd_text: Optional[str] = None,
        difficulty: str = "mid",
        focus_areas: Optional[list[str]] = None,
    ) -> StartInterviewResponse:
        """开始面试，生成首题和策略。"""
        session_id = uuid.uuid4().hex[:12]

        focus_str = f"重点关注：{', '.join(focus_areas)}" if focus_areas else "全面考察"
        jd_str = f"\n岗位要求：{jd_text}" if jd_text else ""

        prompt = f"""## 开始面试

难度：{difficulty} | {focus_str}{jd_str}

候选人简历：
{resume_text}

请：
1. 用 search_knowledge_base 搜索简历中提到的核心技术领域
2. 分析你应该考察哪些领域，为什么
3. 出一道摸底题（中等难度），并标注分类

用JSON返回出题信息：{"question": "题目", "category": "前端/计网/算法/AI Coding/系统设计/数据库/操作系统"}

如果 search_knowledge_base 不可用，直接根据你的专业知识出题。"""

        output = self._invoke_agent(prompt)

        # 提取题目
        first_question = self._extract_question(output, difficulty, session_id, 1)

        # 初始化认知模型
        model = CognitiveModel(session_id=session_id)

        _sessions[session_id] = {
            "cognitive_model": model,
            "chat_history": [
                HumanMessage(content=prompt),
                self._make_ai_msg(output),
            ],
            "questions": [first_question],
            "answers": [],
            "difficulty": difficulty,
            "resume_text": resume_text,
        }

        return StartInterviewResponse(
            session_id=session_id,
            first_question=first_question,
            agent_plan=output[:800],
        )

    def start_interview_with_prep(
        self,
        resume_text: str,
        jd_text: Optional[str] = None,
        difficulty: str = "mid",
        prep_context: Optional[dict] = None,
    ) -> StartInterviewResponse:
        """从面试准备文档启动针对性面试。

        prep_context 包含：
        - predicted_questions: 面试准备预测的题目列表
        - focus_areas: 应优先考察的薄弱领域
        - jd_intent: JD 核心意图（帮助 Agent 理解岗位）
        - gap_areas: 候选人当前差距领域
        """
        session_id = uuid.uuid4().hex[:12]
        predicted_qs = prep_context.get("predicted_questions", []) if prep_context else []
        focus_areas = prep_context.get("focus_areas", []) if prep_context else []
        jd_intent = prep_context.get("jd_intent", "") if prep_context else ""
        gap_areas = prep_context.get("gap_areas", []) if prep_context else []

        # 构建 prep 题目池描述
        prep_questions_str = ""
        if predicted_qs:
            prep_questions_str = "参考面试准备文档中的预测题目：\n" + "\n".join(
                f"{i+1}. [{q.get('category', '综合')}] {q.get('question', '')[:120]}"
                for i, q in enumerate(predicted_qs[:6])
            )

        focus_str = f"重点关注：{', '.join(focus_areas)}" if focus_areas else "全面考察"
        gap_str = f"薄弱领域（重点检测）：{', '.join(gap_areas)}" if gap_areas else ""

        prompt = f"""## 开始针对性面试（面试准备驱动）

难度：{difficulty} | {focus_str}
岗位核心意图：{jd_intent}
{gap_str}

候选人简历：
{resume_text}

{prep_questions_str}

## 出题策略
- 前 2-3 题优先从上述预测题目中选取或改编
- 同时探测 {', '.join(gap_areas) if gap_areas else '简历中未提及的领域'}
- 后续题目可以超越预测范围，根据实际表现自适应调整
- 兼顾深度（追问）和广度（切换领域）

请：
1. 用 search_knowledge_base 检索相关领域背景
2. 出一道与面试准备文档相关但可能有延展的摸底题
3. 标注题目来源：prep_predicted / prep_extended / adaptive

用JSON返回：{{"question": "题目", "category": "前端/计网/算法/AI Coding/系统设计/数据库/操作系统", "source": "prep_predicted/prep_extended/adaptive"}}"""

        output = self._invoke_agent(prompt)

        first_question = self._extract_question(output, difficulty, session_id, 1)
        # 尝试提取 source 标注
        json_data = self._extract_json(output)
        source = json_data.get("source", "prep_extended")
        first_question.agent_reasoning = f"[来源:{source}] {output[:500]}"

        model = CognitiveModel(session_id=session_id)

        _sessions[session_id] = {
            "cognitive_model": model,
            "chat_history": [
                HumanMessage(content=prompt),
                self._make_ai_msg(output),
            ],
            "questions": [first_question],
            "answers": [],
            "difficulty": difficulty,
            "resume_text": resume_text,
            "prep_context": prep_context,
            "prep_question_pool": predicted_qs[:6] if predicted_qs else [],
            "prep_questions_used": 0,
        }

        return StartInterviewResponse(
            session_id=session_id,
            first_question=first_question,
            agent_plan=f"面试准备驱动面试 | 预测题池: {len(predicted_qs)}题 | "
                       f"关注领域: {focus_str} | {gap_str}"[:800],
        )

    # ── 外部文档解析 prompt ──
    EXTERNAL_DOC_PARSE_PROMPT = """你是一个面试准备文档解析器。用户会给你一份面试准备文档的 Markdown 原文（通常来自 interview-prep skill 的输出），请你从中提取关键信息，用于驱动一场针对性面试。

文档通常包含以下章节：
- 零、JD 原文
- 一、公司与产品调研
- 二、JD 深度解读（含核心意图 + 逐条匹配分析）
- 三、定制版自我介绍
- 四、项目深挖问答（STAR 格式）
- 五、高频面试问题与参考回答
- 六、设计思考
- 七、反问清单
- 附、Gap 清单（优先级 1/2/3）

请提取以下信息，用 JSON 返回：

```json
{
  "predicted_questions": [
    {"question": "题目文本", "category": "前端/计网/算法/AI Coding/系统设计/数据库/操作系统/AI基础/产品设计/综合", "key_points": ["考察点1", "考察点2"]}
  ],
  "focus_areas": ["需要重点关注的知识领域或技能"],
  "jd_intent": "JD 核心意图的一句话总结",
  "gap_areas": ["候选人的薄弱领域 / 需要补的知识点"],
  "parsed_summary": "解析摘要：从文档中提取了哪些内容用于驱动面试（2-3句话）"
}
```

要求：
- predicted_questions 提取文档第五章中列出的面试题目，至少提取 3 道，最多 15 道
- focus_areas 从文档第六章设计思考 + JD 匹配中的弱项推导，3-5 个
- jd_intent 从第二章核心意图提取
- gap_areas 从附件 Gap 清单的优先级 1（必须补）项提取，3-5 个
- 如果某个章节不存在，对应字段返回空数组或空字符串
- category 请根据题目内容判断，从可用分类中选择最合适的"""

    def start_from_external_doc(
        self,
        resume_text: str,
        external_doc_text: str,
        difficulty: str = "mid",
        direction: str = "E",
    ) -> dict:
        """从外部面试准备文档（如 interview-prep skill 的 .md 输出）启动面试。

        流程：
        1. 用 LLM 解析 Markdown 文档，提取预测题目、Gap、JD意图等
        2. 构建 prep_context
        3. 调用 start_interview_with_prep() 启动面试
        """
        # Step 1: LLM 解析外部文档
        parse_prompt = self.EXTERNAL_DOC_PARSE_PROMPT + f"\n\n岗位方向：{direction}\n\n外部文档原文：\n{external_doc_text[:8000]}"

        parse_result = self.llm.invoke(parse_prompt)
        parse_content = parse_result.content if hasattr(parse_result, 'content') else str(parse_result)

        # 提取 JSON
        parsed_data = self._extract_json(parse_content)

        predicted_questions = parsed_data.get("predicted_questions", [])
        focus_areas = parsed_data.get("focus_areas", [])
        jd_intent = parsed_data.get("jd_intent", "")
        gap_areas = parsed_data.get("gap_areas", [])
        parsed_summary = parsed_data.get("parsed_summary", "")

        # Step 2: 构建 prep_context
        prep_context = {
            "predicted_questions": predicted_questions[:8],
            "focus_areas": focus_areas[:5],
            "jd_intent": jd_intent,
            "gap_areas": gap_areas[:5],
        }

        # Step 3: 调用现有的 prep 驱动面试方法
        result = self.start_interview_with_prep(
            resume_text=resume_text,
            difficulty=difficulty,
            prep_context=prep_context,
        )

        # 附加解析摘要到返回结果
        return {
            "session_id": result.session_id,
            "first_question": result.first_question,
            "agent_plan": result.agent_plan,
            "prep_context_used": focus_areas[:5] + gap_areas[:3],
            "parsed_summary": parsed_summary,
        }

    def submit_answer(
        self, session_id: str, question_id: str, user_answer: str
    ) -> SubmitAnswerResponse:
        """提交回答，评估并决定下一步。"""
        session = _sessions.get(session_id)
        if not session:
            raise ValueError(f"会话 {session_id} 不存在")

        model: CognitiveModel = session["cognitive_model"]
        questions = session["questions"]
        current_q = next((q for q in questions if q.id == question_id), None)
        if not current_q:
            raise ValueError(f"题目 {question_id} 不存在")

        q_num = len(session["answers"]) + 1

        prompt = f"""## 评估第 {q_num} 题回答

题目（{current_q.category}）：{current_q.text}

用户回答：
{user_answer}

请先用 get_reference_answer 获取标准答案对比，然后严格评估。
在回复末尾附 JSON。
如果已问够 5 题以上且充分评估，设置 is_finished: true。"""

        output = self._invoke_agent(prompt, session["chat_history"])

        # 解析评估
        evaluation = self._extract_evaluation(output)
        is_finished = self._check_is_finished(output)

        # 更新认知模型
        model.update_from_evaluation(
            question_id=question_id,
            question_category=current_q.category,
            question_text=current_q.text,
            score=evaluation.score,
            knowledge_hits=evaluation.knowledge_hits,
            knowledge_gaps=evaluation.knowledge_gaps,
            logic_score=self._safe_float(output, "logic_score", 5.0),
            communication_score=self._safe_float(output, "communication_score", 5.0),
            keywords=evaluation.knowledge_hits,
        )

        # 记录聊天历史
        session["chat_history"].extend([
            HumanMessage(content=f"第{q_num}题回答：{user_answer}"),
            self._make_ai_msg(output),
        ])
        session["answers"].append({
            "question_id": question_id,
            "answer": user_answer,
            "evaluation": evaluation,
        })

        # 结束或继续
        if is_finished:
            diagnosis = self._generate_final_diagnosis(session_id)
            session["cached_diagnosis"] = diagnosis  # 缓存，避免 GET 时重调 LLM
            return SubmitAnswerResponse(
                evaluation=evaluation,
                next_question=None,
                is_finished=True,
                cumulative_diagnosis=diagnosis,
            )

        next_q = self._generate_next_question(output, session, len(questions) + 1)
        questions.append(next_q)

        return SubmitAnswerResponse(
            evaluation=evaluation,
            next_question=next_q,
            is_finished=False,
        )

    def get_diagnosis(self, session_id: str) -> CognitiveDiagnosis:
        session = _sessions.get(session_id)
        if not session:
            raise ValueError(f"会话 {session_id} 不存在")
        # 优先返回缓存的诊断报告（面试结束时生成），避免重调 LLM 导致数据不一致
        if "cached_diagnosis" in session:
            return session["cached_diagnosis"]
        return self._generate_final_diagnosis(session_id)

    # ── helpers ──

    def _make_ai_msg(self, content: str):
        from langchain_core.messages import AIMessage
        return AIMessage(content=content)

    def _extract_question(self, output: str, difficulty: str, session_id: str, idx: int) -> AgentQuestion:
        """从 Agent 输出提取题目。"""
        json_data = self._extract_json(output)

        # 尝试找题目文本
        question_text = ""
        for marker in ["面试题：", "题目：", "第一道题：", "**题目**：", "摸底题："]:
            if marker in output:
                question_text = output.split(marker)[-1].strip().split("\n")[0]
                break

        if not question_text:
            # 取最后一段非 JSON 的文本
            parts = re.split(r'```json|```', output)
            question_text = parts[0].strip()[-200:]

        return AgentQuestion(
            id=f"{session_id}_{idx}",
            text=question_text[:250] if question_text else output[:200],
            category=json_data.get("category", "综合"),
            difficulty=difficulty,
            target_knowledge=json_data.get("target_knowledge", []),
            agent_reasoning=output[:600],
        )

    def _extract_evaluation(self, output: str) -> EvaluationResult:
        json_data = self._extract_json(output)
        return EvaluationResult(
            score=float(json_data.get("score", 50)),
            comment=json_data.get("comment", "评估完成"),
            reference_answer=json_data.get("reference_answer", ""),
            knowledge_hits=json_data.get("knowledge_hits", []),
            knowledge_gaps=json_data.get("knowledge_gaps", []),
            logic_feedback=json_data.get("logic_feedback", ""),
        )

    def _check_is_finished(self, output: str) -> bool:
        return self._extract_json(output).get("is_finished", False)

    def _generate_next_question(self, output: str, session: dict, idx: int) -> AgentQuestion:
        json_data = self._extract_json(output)
        strategy = json_data.get("next_question_strategy", "")

        # 若还有未使用的 prep 预测题，偶尔插入
        prep_pool = session.get("prep_question_pool", [])
        prep_used = session.get("prep_questions_used", 0)
        prep_hint = ""
        if prep_pool and prep_used < len(prep_pool):
            unused = prep_pool[prep_used]
            session["prep_questions_used"] = prep_used + 1
            prep_hint = f"\n可参考面试准备文档预测题（可改编或超越）：{unused.get('question', '')[:150]}"

        prompt = f"""基于上一题策略：{strategy}{prep_hint}

请出第{idx}道题。如果是追问，深入上一题相关的知识点；如果是新题，换一个知识领域。
用JSON返回：{{"question": "题目内容", "category": "前端/计网/算法/AI Coding/系统设计/数据库/操作系统"}}"""

        result_text = self._invoke_agent(prompt, session["chat_history"][-4:])
        q_json = self._extract_json(result_text)

        # 优先从 JSON 取题目和分类
        q_text = q_json.get("question", "") or result_text[:250]
        q_category = q_json.get("category", json_data.get("category", "综合"))

        return AgentQuestion(
            id=f"{session['cognitive_model'].session_id}_{idx}",
            text=q_text[:250] if q_text else result_text[:250],
            category=q_category,
            difficulty=session["difficulty"],
            target_knowledge=json_data.get("target_knowledge", []),
            agent_reasoning=strategy,
        )

    def _generate_final_diagnosis(self, session_id: str) -> CognitiveDiagnosis:
        session = _sessions.get(session_id)
        if not session:
            raise ValueError(f"会话 {session_id} 不存在")

        model: CognitiveModel = session["cognitive_model"]

        prompt = f"""## 生成认知诊断报告

面试记录：
{json.dumps(model.score_timeline, ensure_ascii=False, indent=2)}

知识覆盖：
{json.dumps([a.to_dict() for a in model.areas.values()], ensure_ascii=False, indent=2)}

请用 JSON 输出最终诊断（strengths/weaknesses/improvement_plan）。"""

        result_text = self._invoke_agent(prompt)
        json_data = self._extract_json(result_text)

        # 标准化：LLM 可能返回字符串数组或对象数组
        def _normalize_strings(data) -> list[str]:
            if not data or not isinstance(data, list):
                return []
            result = []
            for item in data:
                if isinstance(item, str):
                    result.append(item)
                elif isinstance(item, dict):
                    # 尝试多种常见的对象字段名
                    text = item.get("detail") or item.get("description") or item.get("domain") or item.get("point") or ""
                    # 如果有多个字段，拼接
                    parts = [str(v) for v in item.values() if isinstance(v, str)]
                    if not text and parts:
                        text = "：".join(parts)
                    if text:
                        result.append(text)
            return result

        diagnosis = model.generate_diagnosis(
            strengths=_normalize_strings(json_data.get("strengths", [])),
            weaknesses=_normalize_strings(json_data.get("weaknesses", [])),
            improvement_plan=_normalize_strings(json_data.get("improvement_plan", [])),
        )
        return CognitiveDiagnosis(**diagnosis)

    def _extract_json(self, text: str) -> dict:
        """从文本中提取 JSON 对象。"""
        try:
            match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
            if match:
                return json.loads(match.group(1))
            for m in re.finditer(r'\{[\s\S]*?\}', text):
                try:
                    return json.loads(m.group(0))
                except json.JSONDecodeError:
                    continue
        except (json.JSONDecodeError, AttributeError):
            pass
        return {}

    def _safe_float(self, text: str, key: str, default: float) -> float:
        val = self._extract_json(text).get(key, default)
        try:
            return float(val)
        except (ValueError, TypeError):
            return default
