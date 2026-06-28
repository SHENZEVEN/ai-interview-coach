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
import uuid
import datetime
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from agent.interview_agent import InterviewAgent
from agent.cognitive_diagnosis import CognitiveModel
from agent.tools import set_vector_store
from agent.prep_agent import PrepAgent, ROLE_DIRECTIONS
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
    default_response_class=JSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 全局异常处理：确保所有响应（包括 500）都经过 CORS 中间件 ──
from fastapi import Request
from fastapi.responses import JSONResponse as _JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return _JSONResponse(status_code=500, content={"detail": str(exc)})

# ── 修复 UTF-8 编码问题 ──
from fastapi.responses import JSONResponse
import json

class UTF8JSONResponse(JSONResponse):
    def render(self, content: any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")

app.default_response_class = UTF8JSONResponse

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


@app.post("/api/agent/keep-alive")
async def keep_alive(session_id: str = Body(..., embed=True)):
    """会话保活：定期调用以保持会话不被超时清理。"""
    agent = get_agent()
    if agent.is_session_active(session_id):
        return {"success": True, "message": "会话保持活跃"}
    else:
        raise HTTPException(404, detail="会话不存在或已过期")


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


@app.post("/api/prep/stream-generate")
async def stream_generate_prep(req: PrepGenerateRequest):
    """SSE 流式生成面试准备文档。

    边生成边返回，用户可以看到生成进度。
    返回的事件类型：
    - status: 当前生成阶段
    - content: 生成的文本片段
    - done: 生成完成
    - error: 错误信息
    """
    agent = get_prep_agent()

    async def event_generator() -> AsyncGenerator[dict, None]:
        try:
            # 阶段 1：开始分析
            yield {"event": "status", "data": json.dumps({"status": "正在分析简历结构..."}, ensure_ascii=False)}
            await asyncio.sleep(0.1)

            yield {"event": "status", "data": json.dumps({"status": "正在解读岗位 JD..."}, ensure_ascii=False)}
            await asyncio.sleep(0.1)

            # 调用 agent 生成（支持流式输出）
            yield {"event": "status", "data": json.dumps({"status": "AI 正在生成面试准备内容，请稍候..."}, ensure_ascii=False)}

            # 收集生成的内容
            full_content = ""
            
            def fix_encoding(s: str) -> str:
                """修复可能的编码问题"""
                try:
                    # 尝试1: 直接返回
                    return s
                except:
                    pass
                try:
                    # 尝试2: 假设 UTF-8 被错误解码为 GBK
                    return s.encode('gbk', errors='ignore').decode('utf-8', errors='replace')
                except:
                    pass
                try:
                    # 尝试3: 使用 latin-1 作为中间编码
                    return s.encode('latin-1').decode('utf-8', errors='replace')
                except:
                    # 最后返回原始字符串
                    return s
            
            def sync_stream_callback(chunk: str):
                """流式回调函数 - 同步版本"""
                nonlocal full_content
                # 修复编码后再收集
                fixed_chunk = fix_encoding(chunk)
                full_content += fixed_chunk
                # 通过队列传递数据到异步生成器
                queue.put_nowait(fixed_chunk)

            # 创建队列用于同步回调和异步生成器之间的通信
            queue = asyncio.Queue()
            
            # 启动流式生成任务（后台运行）
            async def run_stream():
                try:
                    await asyncio.to_thread(
                        agent.generate_stream,
                        resume_text=req.resume_text,
                        jd_text=req.jd_text,
                        company_name=req.company_name,
                        role_name=req.role_name,
                        direction=req.direction,
                        difficulty=req.difficulty,
                        prep_mode=req.prep_mode,
                        stream_callback=sync_stream_callback,
                    )
                    # 发送结束信号
                    queue.put_nowait(None)
                except Exception as e:
                    queue.put_nowait(f"ERROR: {str(e)}")
            
            # 启动流式生成任务
            asyncio.create_task(run_stream())
            
            # 接收流式数据并发送
            while True:
                chunk = await queue.get()
                if chunk is None:
                    break  # 结束信号
                if isinstance(chunk, str) and chunk.startswith("ERROR:"):
                    yield {"event": "error", "data": json.dumps({"error": chunk[6:]}, ensure_ascii=False)}
                    return
                yield {"event": "content", "data": json.dumps({"content": chunk}, ensure_ascii=False)}
                await asyncio.sleep(0.02)  # 控制发送速度
            
            # 处理最终内容
            import re
            # 移除 markdown 代码块标记
            content = re.sub(r'```json\n?', '', full_content)
            content = re.sub(r'\n?```', '', content)
            
            # 调试日志
            print(f"[main.py] 原始内容长度: {len(content)}")
            print(f"[main.py] 内容前100字符: {repr(content[:100])}")
            
            # 修复编码问题：处理可能的编码错误
            # 尝试多种编码修复方案
            prep_doc = None
            encoding_tries = [
                # 尝试1: 直接解析
                lambda x: x,
                # 尝试2: 假设 UTF-8 被错误解码为 GBK
                lambda x: x.encode('gbk', errors='ignore').decode('utf-8', errors='replace'),
                # 尝试3: 假设 UTF-8 被错误解码为 GB2312
                lambda x: x.encode('gb2312', errors='ignore').decode('utf-8', errors='replace'),
                # 尝试4: 使用 latin-1 作为中间编码
                lambda x: x.encode('latin-1').decode('utf-8', errors='replace'),
            ]
            
            for i, fix_func in enumerate(encoding_tries):
                try:
                    fixed_content = fix_func(content)
                    prep_doc = json.loads(fixed_content)
                    print(f"[main.py] 编码修复成功，使用方案 {i+1}")
                    content = fixed_content
                    break
                except (json.JSONDecodeError, UnicodeEncodeError, UnicodeDecodeError):
                    continue
            
            if prep_doc is None:
                print(f"[main.py] 所有编码修复方案都失败，使用原始内容")
                try:
                    prep_doc = json.loads(content)
                except:
                    yield {"event": "error", "data": json.dumps({"error": "无法解析生成的文档"}, ensure_ascii=False)}
                    return

            # ── 轻量级字段名映射（只改 key 名，不改数据）──
            _FIELD_MAP = {
                "chapter_1_company_research": "company_research",
                "section_1_company_research": "company_research",
                "chapter_2_jd_analysis": "jd_analysis",
                "jd_match_analysis": "jd_analysis",
                "jd_matching_analysis": "jd_analysis",
                "jd_interpretation": "jd_analysis",
                "section_2_jd_analysis": "jd_analysis",
                "chapter_5_high_frequency_questions": "predicted_questions",
                "high_frequency_questions": "predicted_questions",
                "section_5_high_frequency_questions": "predicted_questions",
                "chapter_3_self_introduction": "self_intro",
                "self_introduction": "self_intro",
                "section_3_self_introduction": "self_intro",
                "appendix_gap_list": "gap_analysis",
                "gap_list": "gap_analysis",
                "section_6_gap_analysis": "gap_analysis",
                "section_4_project_deep_dive": "star_stories",
                "project_deep_dive": "star_stories",
                "section_7_coaching_tips": "coaching_tips",
                "section_7_ask_back_questions": "ask_back_questions",
                "section_8_ask_back_questions": "ask_back_questions",
            }
            # 处理嵌套
            if "interview_prep_doc" in prep_doc and isinstance(prep_doc["interview_prep_doc"], dict):
                inner = prep_doc.pop("interview_prep_doc")
                prep_doc.update(inner)
            # 重命名
            for old_key, new_key in _FIELD_MAP.items():
                if old_key in prep_doc and old_key != new_key:
                    prep_doc[new_key] = prep_doc.pop(old_key)
            print(f"[main.py] field mapping done, keys={list(prep_doc.keys())}")

            # ── 深层字段名对齐（LLM 返回的字段名与前端期望不一致）──
            # company_research 内部字段映射
            if isinstance(prep_doc.get("company_research"), dict):
                cr = prep_doc["company_research"]
                if "company_overview" not in cr:
                    for k in ["overview", "company_background", "background", "core_business"]:
                        if k in cr: cr["company_overview"] = cr.pop(k); break
                if "tech_culture" not in cr:
                    for k in ["culture_values", "culture_signals", "culture", "team_culture"]:
                        if k in cr: cr["tech_culture"] = cr.pop(k); break
                # tech_culture: 数组→字符串
                if "tech_culture" in cr and isinstance(cr["tech_culture"], list):
                    cr["tech_culture"] = "；".join(str(x) for x in cr["tech_culture"])
                if "key_focus_areas" not in cr:
                    for k in ["tech_focus_areas", "focus_areas", "product_features", "key_areas"]:
                        if k in cr:
                            v = cr.pop(k)
                            cr["key_focus_areas"] = v if isinstance(v, list) else [v]
                            break
                if "why_xiaohongshu_for_ai" not in cr:
                    for k in ["interview_focus", "interview_strategy", "ai_strategy", "why_this_company", "why_company"]:
                        if k in cr: cr["why_xiaohongshu_for_ai"] = cr.pop(k); break
                # recent_news 归一化
                if "recent_news" in cr and isinstance(cr["recent_news"], list):
                    cr["recent_news"] = "; ".join(str(x) for x in cr["recent_news"])

            # jd_analysis 内部字段映射
            if isinstance(prep_doc.get("jd_analysis"), dict):
                jd = prep_doc["jd_analysis"]
                if "core_requirements" not in jd:
                    for k in ["key_requirements", "requirements", "core_reqs"]:
                        if k in jd:
                            v = jd.pop(k)
                            jd["core_requirements"] = v if isinstance(v, list) else [v]
                            break
                # core_requirements: 对象数组 [{category, items}] → 扁平字符串数组
                if "core_requirements" in jd and isinstance(jd["core_requirements"], list):
                    flat = []
                    for item in jd["core_requirements"]:
                        if isinstance(item, str):
                            flat.append(item)
                        elif isinstance(item, dict):
                            cat = item.get("category", "")
                            sub_items = item.get("items", [])
                            if cat and sub_items:
                                flat.append(f"【{cat}】")
                                for si in sub_items:
                                    flat.append(f"  · {si}" if isinstance(si, str) else str(si))
                            elif cat:
                                flat.append(cat)
                            else:
                                flat.append(str(item))
                    jd["core_requirements"] = flat
                # 确保数组字段确实是数组
                for arr_key in ["core_requirements", "preferred_qualifications", "gap_identification"]:
                    if arr_key in jd and not isinstance(jd[arr_key], list):
                        v = jd[arr_key]
                        jd[arr_key] = [v] if isinstance(v, (str, dict)) else []

            # self_intro 格式归一化
            if isinstance(prep_doc.get("self_intro"), str):
                prep_doc["self_intro"] = {
                    "script": prep_doc["self_intro"],
                    "key_highlights": [],
                    "duration_seconds": 90
                }
            elif isinstance(prep_doc.get("self_intro"), dict):
                si = prep_doc["self_intro"]
                # script 为空时尝试 script_draft
                if not si.get("script") and si.get("script_draft"):
                    si["script"] = si.pop("script_draft")
                elif not si.get("script") and si.get("content"):
                    si["script"] = si.pop("content")
                if "key_highlights" not in si: si["key_highlights"] = []
                if "duration_seconds" not in si: si["duration_seconds"] = 90

            # gap_analysis: 旧格式 {strengths/weaknesses/mitigation} → 新格式 {priority_1/priority_2/priority_3}
            if isinstance(prep_doc.get("gap_analysis"), dict):
                ga = prep_doc["gap_analysis"]
                if "priority_1_must_fix" not in ga and ("weaknesses_vs_jd" in ga or "weaknesses" in ga):
                    p1_items = []
                    for w in ga.get("weaknesses_vs_jd", ga.get("weaknesses", [])):
                        if isinstance(w, dict):
                            p1_items.append({"gap": w.get("gap", str(w)), "action": w.get("action", ""), "time_estimate": w.get("time_estimate", "")})
                        else:
                            p1_items.append({"gap": str(w), "action": "", "time_estimate": ""})
                    p2_items = []
                    for s in ga.get("strengths_vs_jd", ga.get("strengths", [])):
                        if isinstance(s, str):
                            p2_items.append({"gap": s, "action": "", "time_estimate": ""})
                    p3_items = []
                    for m in ga.get("mitigation_strategies", []):
                        if isinstance(m, str):
                            p3_items.append({"gap": m, "action": "", "time_estimate": ""})
                    ga["priority_1_must_fix"] = p1_items
                    ga["priority_2_should_fix"] = p2_items
                    ga["priority_3_nice_to_have"] = p3_items

            # predicted_questions 确保是数组
            if "predicted_questions" in prep_doc and not isinstance(prep_doc["predicted_questions"], list):
                prep_doc["predicted_questions"] = []

            print(f"[main.py] deep field mapping done")

            # 强制覆盖 meta 字段为前端期望的格式
            prep_id = uuid.uuid4().hex[:12]
            prep_doc['meta'] = {
                'prep_id': prep_id,
                'company_name': req.company_name,
                'role_name': req.role_name,
                'direction': req.direction,
                'direction_label': ROLE_DIRECTIONS.get(req.direction, '其他'),
                'difficulty': req.difficulty,
                'prep_mode': req.prep_mode,
                'generated_at': datetime.datetime.now().strftime('%Y-%m-%d %H:%M'),
                'has_web_search': False,
                'source_count': 0
            }
            
            # 重新序列化
            content = json.dumps(prep_doc, ensure_ascii=False)
            print(f"[main.py] 成功添加 meta 字段, prep_id={prep_id}, content_length={len(content)}")
            print(f"[main.py] prep_doc keys: {list(prep_doc.keys())}")
            print(f"[main.py] company_research type: {type(prep_doc.get('company_research')).__name__}")
            if isinstance(prep_doc.get('company_research'), dict):
                print(f"[main.py] company_research keys: {list(prep_doc['company_research'].keys())}")
            print(f"[main.py] jd_analysis type: {type(prep_doc.get('jd_analysis')).__name__}")
            if isinstance(prep_doc.get('jd_analysis'), dict):
                print(f"[main.py] jd_analysis keys: {list(prep_doc['jd_analysis'].keys())}")
            print(f"[main.py] self_intro type: {type(prep_doc.get('self_intro')).__name__}")
            print(f"[main.py] predicted_questions count: {len(prep_doc.get('predicted_questions', []))}")
            
            # 发送完成信号
            yield {"event": "status", "data": json.dumps({"status": "面试准备文档生成完成！"}, ensure_ascii=False)}
            
            # 发送 done 事件，包含完整内容
            try:
                done_data = json.dumps({"content": content}, ensure_ascii=False)
                yield {"event": "done", "data": done_data}
            except Exception as e:
                # 如果 JSON 序列化失败，尝试发送原始内容
                yield {"event": "error", "data": json.dumps({"error": f"序列化失败: {str(e)}"}, ensure_ascii=False)}

        except Exception as e:
            yield {"event": "error", "data": json.dumps({"error": str(e)}, ensure_ascii=False)}

    return EventSourceResponse(event_generator())


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
    responses={400: {"model": ErrorResponse}},
)
async def refine_prep(req: PrepRefineRequest):
    """闭环：用认知诊断结果反向更新面试准备。

    诊断暴露的问题 → 更新 Gap 清单 + 生成针对性新题 + 优化自我介绍。

    支持两种模式：
    1. 在线模式：传 session_id，从后端内存获取诊断
    2. 离线模式：传 diagnosis_data + prep_data，完全绕过内存存储（用于已保存的诊断报告）
    """
    prep_agent = get_prep_agent()

    # 获取诊断数据（优先使用传入的完整数据，其次 session_id，最后允许纯文本由 prep_agent 解析）
    if req.diagnosis_data:
        diagnosis_dict = req.diagnosis_data
    elif req.session_id:
        interview_agent = get_agent()
        try:
            diagnosis = interview_agent.get_diagnosis(req.session_id)
            diagnosis_dict = diagnosis.model_dump() if hasattr(diagnosis, 'model_dump') else diagnosis
        except ValueError as e:
            raise HTTPException(400, detail=f"会话已过期: {e}")
    elif req.diagnosis_text:
        # 纯文本诊断 → 传空 dict，由 refine_with_diagnosis 内部调用 _parse_diagnosis_text 解析
        diagnosis_dict = {}
    else:
        raise HTTPException(400, detail="请提供 session_id、diagnosis_data 或 diagnosis_text")

    try:
        result = prep_agent.refine_with_diagnosis(
            req.prep_id, diagnosis_dict, req.prep_data,
            prep_text=req.prep_text, diagnosis_text=req.diagnosis_text,
        )
        # 日志：打印优化后关键字段摘要
        try:
            print(f"[refine_prep] Result keys: {list(result.keys())}")
            si = result.get("self_intro")
            print(f"[refine_prep] self_intro type={type(si).__name__}, value={str(si)[:200] if si else 'EMPTY'}")
            pq = result.get("predicted_questions", [])
            print(f"[refine_prep] predicted_questions count={len(pq)}")
            ga = result.get("gap_analysis")
            print(f"[refine_prep] gap_analysis keys={list(ga.keys()) if isinstance(ga, dict) else 'EMPTY'}")
            meta = result.get("meta", {})
            print(f"[refine_prep] meta.diagnosis_feedback={meta.get('diagnosis_feedback', 'NONE')}")
            print(f"[refine_prep] meta.refine_summary={meta.get('refine_summary', 'NONE')}")
        except Exception as log_err:
            print(f"[refine_prep] Log error: {log_err}")
        return result
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

    # 优先使用前端传入的 prep_data（绕过内存存储，解决重启丢失问题）
    if req.prep_data:
        prep = req.prep_data
    elif req.prep_id:
        try:
            prep = prep_agent.get_prep(req.prep_id)
        except ValueError as e:
            raise HTTPException(400, detail=str(e))
    else:
        raise HTTPException(400, detail="请提供 prep_id 或 prep_data")

    # 提取 prep 上下文
    predicted_questions = prep.get("predicted_questions", [])
    gap_analysis = prep.get("gap_analysis", {})
    jd_analysis = prep.get("jd_analysis", {})

    # 从 gap_analysis 中提取弱点作为 focus areas
    # gap_analysis 格式: {"priority_1_must_fix": [...], "priority_2_should_fix": [...], ...}
    # 每个 item 是 {"gap": "...", "action": "...", "time_estimate": "..."}
    # 也兼容旧格式: {"weaknesses": [...], "mitigation_strategies": [...]}
    weaknesses = gap_analysis.get("weaknesses", [])
    if not weaknesses:
        # 从 priority_1_must_fix 和 priority_2_should_fix 中提取
        p1_items = gap_analysis.get("priority_1_must_fix", [])
        p2_items = gap_analysis.get("priority_2_should_fix", [])
        for item in p1_items + p2_items:
            if isinstance(item, dict):
                gap_text = item.get("gap", "") or item.get("action", "")
                if gap_text:
                    weaknesses.append(gap_text)
            elif isinstance(item, str):
                weaknesses.append(item)

    mitigation_strategies = gap_analysis.get("mitigation_strategies", [])
    if not mitigation_strategies:
        # 从 priority items 的 action 中提取
        p1_items = gap_analysis.get("priority_1_must_fix", [])
        for item in p1_items:
            if isinstance(item, dict) and item.get("action"):
                mitigation_strategies.append(item["action"])

    all_focus = weaknesses[:3] + [s for s in mitigation_strategies if s][:2]

    # 提取 JD 核心意图（兼容两种字段名）
    jd_intent = ""
    if isinstance(jd_analysis, dict):
        jd_intent = jd_analysis.get("core_intent", "") or jd_analysis.get("core_requirements", "")
        if isinstance(jd_intent, list):
            jd_intent = jd_intent[0] if jd_intent else ""
        jd_intent = str(jd_intent) if jd_intent else ""

    # 启动面试（传入 prep 上下文）
    response = interview_agent.start_interview_with_prep(
        resume_text=req.resume_text or prep.get("meta", {}).get("role_name", ""),
        jd_text=prep.get("meta", {}).get("company_name", ""),
        difficulty=req.difficulty or prep.get("meta", {}).get("difficulty", "mid"),
        prep_context={
            "predicted_questions": predicted_questions[:8],
            "focus_areas": all_focus,
            "jd_intent": jd_intent,
            "gap_areas": weaknesses[:3],
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
    # 简历可选：文档已包含完整预测题库，简历仅用于提升题目匹配精准度

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
