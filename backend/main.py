"""FastAPI 入口 — AI Interview Agent Backend.

核心端点:
- POST /api/agent/start-interview   开始诊断式面试 (SSE 可选)
- POST /api/agent/submit-answer     提交回答，获取评估+下一题
- GET  /api/agent/diagnosis/{id}     获取认知诊断报告
- POST /api/generate-question        兼容旧版前端 API
- POST /api/evaluate-answer          兼容旧版前端 API
"""

import asyncio
import json
import os
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from agent.interview_agent import InterviewAgent
from agent.cognitive_diagnosis import CognitiveModel
from agent.tools import set_vector_store
from agent.prep_agent import PrepAgent
from models.schemas import (
    StartInterviewRequest,
    StartInterviewResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    GenerateQuestionRequest,
    GenerateQuestionResponse,
    EvaluateAnswerRequest,
    EvaluateAnswerResponse,
    ErrorResponse,
    CognitiveDiagnosis,
    PrepGenerateRequest,
    PrepDocument,
    PrepRefineRequest,
    StartFromPrepRequest,
    StartFromPrepResponse,
    StartFromExternalDocRequest,
    StartFromExternalDocResponse,
    ExtractQuestionsRequest,
    ExtractQuestionsResponse,
    MatchRequest,
    MatchResponse,
)
from rag.vector_store import get_vector_store, load_seed_data, get_collection_count

load_dotenv()

# ── App 初始化 ──
app = FastAPI(
    title="AI Interview Agent",
    description="基于 LangChain + RAG 的认知诊断式面试 Agent",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 全局状态 ──
_interview_agent: InterviewAgent | None = None
_prep_agent: PrepAgent | None = None


@app.on_event("startup")
async def startup():
    """启动时初始化向量库和 Agent。"""
    global _interview_agent, _prep_agent

    persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")
    os.makedirs(persist_dir, exist_ok=True)

    vector_store = get_vector_store(persist_dir)

    count = get_collection_count(vector_store)
    if count == 0:
        print("[INFO] ChromaDB is empty. Use POST /api/admin/seed to load interview data.")
        print("[INFO] Or run: python scripts/seed_data.py")
    else:
        print(f"[OK] ChromaDB has {count} existing records")

    _interview_agent = InterviewAgent(vector_store)
    _prep_agent = PrepAgent()
    print("[READY] AI Interview Agent ready on port 8000")


def get_agent() -> InterviewAgent:
    if _interview_agent is None:
        raise HTTPException(503, "Agent 尚未初始化，请稍候")
    return _interview_agent


def get_prep_agent() -> PrepAgent:
    if _prep_agent is None:
        raise HTTPException(503, "Prep Agent 尚未初始化，请稍候")
    return _prep_agent


# ── Agent 端点 (v2 核心) ──

@app.post(
    "/api/agent/start-interview",
    response_model=StartInterviewResponse,
    responses={400: {"model": ErrorResponse}, 503: {"model": ErrorResponse}},
)
async def start_interview(req: StartInterviewRequest):
    """开始一次认知诊断式面试。

    上传简历文本，Agent 会：
    1. 分析简历，规划面试策略
    2. 从 RAG 知识库检索相关题目
    3. 返回第一道自适应题目
    """
    agent = get_agent()
    try:
        return agent.start_interview(
            resume_text=req.resume_text,
            jd_text=req.jd_text,
            difficulty=req.difficulty.value if hasattr(req.difficulty, 'value') else req.difficulty,
            focus_areas=req.focus_areas,
        )
    except Exception as e:
        raise HTTPException(400, detail=str(e))


@app.post(
    "/api/agent/submit-answer",
    response_model=SubmitAnswerResponse,
    responses={400: {"model": ErrorResponse}},
)
async def submit_answer(req: SubmitAnswerRequest):
    """提交回答，Agent 评估并决定下一题或结束面试。

    返回的 SubmitAnswerResponse 中：
    - is_finished=False → 继续面试，next_question 包含下一题
    - is_finished=True → 面试结束，cumulative_diagnosis 包含完整认知诊断报告
    """
    agent = get_agent()
    try:
        return agent.submit_answer(req.session_id, req.question_id, req.user_answer)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get(
    "/api/agent/diagnosis/{session_id}",
    response_model=CognitiveDiagnosis,
    responses={400: {"model": ErrorResponse}},
)
async def get_diagnosis(session_id: str):
    """获取指定会话的认知诊断报告。"""
    agent = get_agent()
    try:
        return agent.get_diagnosis(session_id)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))


@app.get("/api/agent/stream-interview")
async def stream_interview(
    resume_text: str = Query(..., description="简历文本"),
    jd_text: str = Query("", description="岗位 JD"),
    difficulty: str = Query("mid", description="难度"),
):
    """SSE 流式面试 — Agent 出题和评估过程实时可见。

    用于展示 Agent 的"思考过程"——比赛答辩时演示效果炸裂。
    """
    agent = get_agent()

    async def event_generator() -> AsyncGenerator[dict, None]:
        try:
            # 阶段 1：开始面试
            yield {"event": "status", "data": "正在分析简历，制定面试策略..."}

            response = agent.start_interview(
                resume_text=resume_text,
                jd_text=jd_text or None,
                difficulty=difficulty,
            )
            yield {
                "event": "question",
                "data": json.dumps({
                    "session_id": response.session_id,
                    "question": response.first_question.text,
                    "agent_reasoning": response.agent_plan[:500],
                }, ensure_ascii=False),
            }

            # 阶段 2：等待用户回答（SSE 只演示首题，完整流程走 REST API）
            yield {
                "event": "done",
                "data": json.dumps({
                    "session_id": response.session_id,
                    "message": "首题已生成。请通过 POST /api/agent/submit-answer 继续面试。",
                }, ensure_ascii=False),
            }

        except Exception as e:
            yield {"event": "error", "data": str(e)}

    return EventSourceResponse(event_generator())


# ── 兼容端点 (v1 — 对接现有前端) ──

@app.post(
    "/api/generate-question",
    response_model=GenerateQuestionResponse,
)
async def generate_question(req: GenerateQuestionRequest):
    """兼容旧版前端：生成面试题。

    现在由 Agent 驱动，会先搜索知识库再出题。
    """
    agent = get_agent()
    try:
        # 用 Agent 的 LLM 生成题目，但先走 RAG
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            model=os.getenv("LLM_MODEL", "agnes-2.0-flash"),
            api_key=os.getenv("LLM_API_KEY", ""),
            base_url=os.getenv("LLM_API_BASE", "https://apihub.agnes-ai.com/v1"),
            temperature=0.7,
        )

        # RAG 检索相关题目作为上下文
        from rag.vector_store import search_similar_questions
        vs = get_vector_store()
        similar = search_similar_questions(vs, req.jd_text, k=2)

        rag_context = ""
        if similar:
            rag_context = "参考知识库中相关题目：\n" + "\n".join(
                f"- [{s['category']}] {s['question']}" for s in similar
            )

        difficulty_map = {
            "intern": "实习生：注重基础概念和学习能力",
            "junior": "初级：注重基础应用和实际动手能力",
            "mid": "中级：注重深入理解和解决问题的能力",
            "senior": "高级：注重架构设计和系统优化能力",
            "lead": "专家/组长：注重技术决策和团队管理能力",
        }
        diff_desc = difficulty_map.get(
            req.difficulty.value if hasattr(req.difficulty, 'value') else req.difficulty,
            "中级",
        )

        prompt = f"""你是专业面试官。根据JD/面经生成一道技术面试题。
难度：{diff_desc}
{rag_context}
JD/面经内容：{req.jd_text}

用JSON返回：{{"question": "题目", "category": "前端/计网/算法/AI Coding"}}"""

        result = llm.invoke(prompt)
        content = result.content if hasattr(result, 'content') else str(result)

        # 解析
        try:
            import re
            match = re.search(r'\{[\s\S]*\}', content)
            data = json.loads(match.group(0)) if match else {}
            return GenerateQuestionResponse(
                text=data.get("question", content[:200]),
                categories=[data.get("category", "前端"), "定制"],
            )
        except Exception:
            return GenerateQuestionResponse(text=content[:200], categories=["前端", "定制"])

    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.post(
    "/api/evaluate-answer",
    response_model=EvaluateAnswerResponse,
)
async def evaluate_answer(req: EvaluateAnswerRequest):
    """兼容旧版前端：评估回答。"""
    agent = get_agent()
    try:
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(
            model=os.getenv("LLM_MODEL", "agnes-2.0-flash"),
            api_key=os.getenv("LLM_API_KEY", ""),
            base_url=os.getenv("LLM_API_BASE", "https://apihub.agnes-ai.com/v1"),
            temperature=0.3,
        )

        prompt = f"""专业面试评价。
题目：{req.question}
参考：{req.reference_answer}
回答：{req.user_answer}
JSON返回：{{"score": 1-10整数, "comment": "50字评语", "referenceAnswer": "参考要点"}}"""

        result = llm.invoke(prompt)
        content = result.content if hasattr(result, 'content') else str(result)

        try:
            import re
            match = re.search(r'\{[\s\S]*\}', content)
            data = json.loads(match.group(0)) if match else {}
            score = min(10, max(1, int(data.get("score", 5))))
            return EvaluateAnswerResponse(
                score=score,
                comment=data.get("comment", "评估完成"),
                reference_answer=data.get("referenceAnswer", req.reference_answer),
            )
        except Exception:
            return EvaluateAnswerResponse(score=5, comment="评估完成", reference_answer="")

    except Exception as e:
        raise HTTPException(500, detail=str(e))


# ── 面试准备 (Prep) 端点 — 闭环核心 ──

@app.post(
    "/api/prep/generate",
    response_model=PrepDocument,
    responses={400: {"model": ErrorResponse}},
)
async def generate_prep(req: PrepGenerateRequest):
    """生成面试准备文档。

    对标 interview-prep skill 的完整方法：
    - 公司/产品调研（standard/deep 模式联网搜索）
    - JD 深度解读 + 逐条匹配分析
    - 定制版自我介绍（≤250字）
    - STAR 项目预案
    - 高频题预测
    - Gap 清单（按优先级分组）

    prep_mode: rapid(速准)/standard(标准)/deep(深研)
    difficulty: intern/junior/mid/senior/lead（目标职级）
    """
    agent = get_prep_agent()
    try:
        return agent.generate(
            resume_text=req.resume_text,
            jd_text=req.jd_text,
            company_name=req.company_name,
            role_name=req.role_name,
            direction=req.direction,
            difficulty=req.difficulty,
            prep_mode=req.prep_mode,
        )
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.get(
    "/api/prep/{prep_id}",
    response_model=PrepDocument,
    responses={400: {"model": ErrorResponse}},
)
async def get_prep(prep_id: str):
    """获取已生成的面试准备文档。"""
    agent = get_prep_agent()
    try:
        return agent.get_prep(prep_id)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))


@app.post(
    "/api/prep/refine",
    response_model=PrepDocument,
    responses={400: {"model": ErrorResponse}},
)
async def refine_prep(req: PrepRefineRequest):
    """闭环：用认知诊断结果反向更新面试准备。

    诊断暴露的问题 → 更新 Gap 清单 + 生成针对性新题 + 优化自我介绍。
    """
    prep_agent = get_prep_agent()
    interview_agent = get_agent()
    try:
        diagnosis = interview_agent.get_diagnosis(req.session_id)
        diagnosis_dict = diagnosis.model_dump() if hasattr(diagnosis, 'model_dump') else diagnosis
        return prep_agent.refine_with_diagnosis(req.prep_id, diagnosis_dict)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        raise HTTPException(500, detail=str(e))


@app.post(
    "/api/agent/start-from-prep",
    response_model=StartFromPrepResponse,
    responses={400: {"model": ErrorResponse}},
)
async def start_from_prep(req: StartFromPrepRequest):
    """从面试准备文档启动针对性面试。

    Agent 会：
    1. 从 prep 的 predicted_questions 中选取前几题
    2. 使用 prep 的 gap_analysis 的 priority_1 作为 focus_areas
    3. 后续自适应出题（部分源于 prep、部分超越 prep）
    """
    prep_agent = get_prep_agent()
    interview_agent = get_agent()

    try:
        prep = prep_agent.get_prep(req.prep_id)
    except ValueError as e:
        raise HTTPException(400, detail=str(e))

    # 提取 prep 上下文
    predicted_questions = prep.get("predicted_questions", [])
    gap_analysis = prep.get("gap_analysis", {})
    focus_areas = prep.get("focus_areas", [])
    jd_analysis = prep.get("jd_analysis", {})

    # 将 P1 gap 转为 focus areas
    p1_gaps = gap_analysis.get("priority_1_must_fix", [])
    gap_focus = [g.get("gap", "") for g in p1_gaps[:3]]

    # 构建增强版 focus areas
    all_focus = list(set(focus_areas + gap_focus))[:5]

    # 启动面试（传入 prep 上下文）
    response = interview_agent.start_interview_with_prep(
        resume_text=req.resume_text or prep.get("meta", {}).get("role_name", ""),
        jd_text=prep.get("meta", {}).get("company_name", ""),
        difficulty=req.difficulty or prep.get("meta", {}).get("difficulty", "mid"),
        prep_context={
            "predicted_questions": predicted_questions[:8],
            "focus_areas": all_focus,
            "jd_intent": jd_analysis.get("core_intent", ""),
            "gap_areas": gap_focus,
        },
    )

    return StartFromPrepResponse(
        session_id=response.session_id,
        prep_id=req.prep_id,
        first_question=response.first_question,
        prep_context_used=all_focus,
    )


@app.post(
    "/api/agent/start-from-external-doc",
    response_model=StartFromExternalDocResponse,
    responses={400: {"model": ErrorResponse}},
)
async def start_from_external_doc(req: StartFromExternalDocRequest):
    """从外部面试准备文档（如 interview-prep skill 的 .md 输出）启动针对性面试。

    接受 interview-prep skill 生成的 Markdown 文档原文，
    LLM 自动解析其中的题目、Gap、JD意图等结构化上下文，
    然后驱动面试 Agent 进行针对性出题。

    这是连接 Claude Code skill（高质量文档生成）和
    Web 应用（闭环模拟+诊断）的桥梁端点。
    """
    interview_agent = get_agent()

    if not req.external_doc_text.strip():
        raise HTTPException(400, detail="外部文档内容不能为空")
    if len(req.external_doc_text) > 50000:
        raise HTTPException(400, detail="文档过长，请控制在50000字以内")
    if not req.resume_text.strip():
        raise HTTPException(400, detail="简历内容不能为空")

    try:
        result = interview_agent.start_from_external_doc(
            resume_text=req.resume_text,
            external_doc_text=req.external_doc_text,
            difficulty=req.difficulty,
            direction=req.direction,
        )
        return StartFromExternalDocResponse(
            session_id=result["session_id"],
            first_question=result["first_question"],
            prep_context_used=result.get("prep_context_used", []),
            parsed_summary=result.get("parsed_summary", ""),
        )
    except Exception as e:
        raise HTTPException(500, detail=f"外部文档解析失败: {e}")


# ── 面经提取题目 ──

EXTRACT_QUESTIONS_PROMPT = """你是一个专业的面试题目提取器。用户会给你一段面经文本（可能是论坛帖子、面试复盘、面经分享等），请你从中提取出所有的面试题目。

无论原文是否包含参考答案，你都需要为每道提取的题目：
1. 保留题目原文语义
2. 补充合理的 key_points（考察点）
3. 提供一份参考答案（如果原文有参考答案则基于原文优化，否则用你的专业知识补充）
4. 判断题目属于哪个分类（前端/计网/算法/AI Coding/系统设计/数据库/操作系统/AI基础/产品设计/定制）

用 JSON 数组返回：
```json
[
  {
    "question": "题目原文",
    "category": "前端",
    "source": "面经提取",
    "key_points": ["考察点1", "考察点2"],
    "reference_answer": "参考答案..."
  }
]
```

注意事项：
- 不是面试题的闲聊内容请跳过
- 如果一段文本包含多道题目，请分别提取
- 题目和答案不完整的，请用专业知识合理补全
- 分类要准确：涉及LLM/RAG/Prompt的归AI Coding，涉及Transformer/Attention/模型训练的归AI基础"""


@app.post("/api/extract-questions", response_model=ExtractQuestionsResponse)
async def extract_questions(req: ExtractQuestionsRequest):
    """从粘贴的面经文本中 AI 提取结构化题目。"""
    if not req.text.strip():
        raise HTTPException(400, detail="文本不能为空")
    if len(req.text) > 8000:
        raise HTTPException(400, detail="文本过长，请控制在8000字以内")

    try:
        from agent.prep_agent import build_prep_llm
        llm = build_prep_llm()

        prompt = EXTRACT_QUESTIONS_PROMPT + f"\n\n面经文本（默认分类：{req.category}）：\n{req.text}"
        result = llm.invoke(prompt)
        content = result.content if hasattr(result, 'content') else str(result)

        # 解析 JSON
        import re
        match = re.search(r'```json\s*([\s\S]*?)\s*```', content)
        if match:
            data = json.loads(match.group(1))
        else:
            # 尝试直接解析
            data = json.loads(content)

        questions = []
        for item in data[:20]:  # 最多20道
            questions.append({
                "question": item.get("question", ""),
                "category": item.get("category", req.category),
                "source": item.get("source", "面经提取"),
                "key_points": item.get("key_points", item.get("keyPoints", [])),
                "reference_answer": item.get("reference_answer", item.get("referenceAnswer", "")),
            })

        return ExtractQuestionsResponse(questions=questions)

    except json.JSONDecodeError as e:
        raise HTTPException(422, detail=f"AI 返回格式解析失败: {e}")
    except Exception as e:
        raise HTTPException(500, detail=f"题目提取失败: {e}")


# ── 简历-岗位匹配度 ──

@app.post("/api/match/analyze", response_model=MatchResponse, responses={400: {"model": ErrorResponse}})
async def match_resume_jd(req: MatchRequest):
    """轻量简历-JD匹配度分析。

    对标 industry-resume-toolkit skill 的 /JD匹配 命令，
    输出四类标注（覆盖/可挖/缺失/错配）+ 面试备考建议。
    不依赖联网搜索，约5-10秒出结果。
    """
    if not req.resume_text.strip():
        raise HTTPException(400, detail="简历内容不能为空")
    if not req.jd_text.strip():
        raise HTTPException(400, detail="JD内容不能为空")

    agent = get_prep_agent()
    try:
        return agent.match_resume_jd(
            resume_text=req.resume_text,
            jd_text=req.jd_text,
        )
    except Exception as e:
        raise HTTPException(500, detail=f"匹配分析失败: {e}")


# ── 管理端点 ──
@app.post("/api/admin/seed")
async def seed_data():
    """手动加载种子数据到 ChromaDB（需要有效 API Key）。"""
    try:
        vs = get_vector_store()
        n = load_seed_data(vs)
        return {"status": "ok", "loaded": n}
    except Exception as e:
        raise HTTPException(500, detail=f"Seed failed: {e}. Check your LLM_API_KEY.")


# ── 健康检查 ──
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0", "agent": "ready" if _interview_agent else "initializing"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")), reload=True)
