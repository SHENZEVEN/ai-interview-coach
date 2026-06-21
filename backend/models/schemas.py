"""Pydantic models for the Interview Agent API."""
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum


# ── 难度等级 ──
class DifficultyLevel(str, Enum):
    intern = "intern"
    junior = "junior"
    mid = "mid"
    senior = "senior"
    lead = "lead"


# ── 知识领域 ──
class KnowledgeCategory(str, Enum):
    frontend = "前端"
    network = "计网"
    algorithm = "算法"
    ai_coding = "AI Coding"
    system_design = "系统设计"
    database = "数据库"
    os = "操作系统"
    general = "综合素质"


# ── 请求体 ──
class StartInterviewRequest(BaseModel):
    resume_text: str = Field(..., description="简历全文")
    jd_text: Optional[str] = Field(None, description="岗位 JD（可选）")
    difficulty: DifficultyLevel = Field(DifficultyLevel.mid, description="面试难度")
    focus_areas: Optional[list[KnowledgeCategory]] = Field(
        None, description="希望重点考察的知识领域"
    )


class SubmitAnswerRequest(BaseModel):
    session_id: str = Field(..., description="面试会话 ID")
    question_id: str = Field(..., description="当前题目 ID")
    user_answer: str = Field(..., description="用户回答文本")


class GenerateQuestionRequest(BaseModel):
    jd_text: str = Field(..., description="岗位描述/面经文本")
    difficulty: DifficultyLevel = Field(DifficultyLevel.mid)


class EvaluateAnswerRequest(BaseModel):
    question: str = Field(..., description="面试题")
    user_answer: str = Field(..., description="用户回答")
    reference_answer: Optional[str] = Field("", description="参考要点")
    context: Optional[str] = Field("", description="上下文（简历等）")


# ── 响应体 ──
class KnowledgePoint(BaseModel):
    """单个知识点的掌握情况"""
    name: str = Field(..., description="知识点名称")
    coverage: float = Field(..., ge=0, le=1, description="覆盖度 0-1")
    depth_score: float = Field(..., ge=0, le=10, description="深度评分 0-10")
    keywords_mentioned: list[str] = Field(default_factory=list, description="用户提到的关键词")
    missing_concepts: list[str] = Field(default_factory=list, description="遗漏的核心概念")


class CognitiveDiagnosis(BaseModel):
    """认知诊断报告"""
    session_id: str
    overall_score: float = Field(..., ge=0, le=100)
    knowledge_map: list[KnowledgePoint] = Field(..., description="知识覆盖图谱")
    logic_score: float = Field(..., ge=0, le=10, description="逻辑连贯性")
    communication_score: float = Field(..., ge=0, le=10, description="表达清晰度")
    depth_score: float = Field(..., ge=0, le=10, description="回答深度")
    strengths: list[str] = Field(..., description="优势项")
    weaknesses: list[str] = Field(..., description="薄弱项")
    improvement_plan: list[str] = Field(..., description="改进建议")
    # 可视化数据
    radar_data: dict = Field(default_factory=dict, description="雷达图数据")
    timeline_data: list[dict] = Field(default_factory=list, description="时间线数据（每题的思维得分变化）")


class AgentQuestion(BaseModel):
    """Agent 生成的面试题"""
    id: str
    text: str
    category: str
    difficulty: str
    target_knowledge: list[str] = Field(default_factory=list, description="本题考察的知识点")
    agent_reasoning: str = Field("", description="Agent 出题思路（可视化用）")


class EvaluationResult(BaseModel):
    """单题评估结果"""
    score: float = Field(..., ge=0, le=100)
    comment: str
    reference_answer: str
    # 认知诊断增量
    knowledge_hits: list[str] = Field(default_factory=list, description="命中的知识点")
    knowledge_gaps: list[str] = Field(default_factory=list, description="暴露的知识缺口")
    logic_feedback: str = Field("", description="逻辑层面反馈")


class StartInterviewResponse(BaseModel):
    session_id: str
    first_question: AgentQuestion
    agent_plan: str = Field("", description="Agent 的面试策略说明")


class SubmitAnswerResponse(BaseModel):
    evaluation: EvaluationResult
    next_question: Optional[AgentQuestion] = None
    is_finished: bool = False
    cumulative_diagnosis: Optional[CognitiveDiagnosis] = None  # 如果面试结束则返回完整报告


class GenerateQuestionResponse(BaseModel):
    text: str
    categories: list[str]


class EvaluateAnswerResponse(BaseModel):
    score: int = Field(..., ge=1, le=10)
    comment: str
    reference_answer: str


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None


# ── 面试准备 (Prep) 相关模型 ──

class PrepGenerateRequest(BaseModel):
    resume_text: str = Field(..., description="简历全文")
    jd_text: Optional[str] = Field(None, description="岗位JD")
    company_name: str = Field("", description="公司名")
    role_name: str = Field("", description="岗位名")
    direction: str = Field("E", description="岗位方向: A-G")
    difficulty: str = Field("mid", description="目标职级: intern/junior/mid/senior/lead")
    prep_mode: str = Field("standard", description="准备深度: rapid/standard/deep")


class RequirementMatch(BaseModel):
    requirement: str
    resume_evidence: str
    match_level: str  # ✅强 / ⚠️中 / ❌弱 / -
    gap_risk: str
    strategy: str


class JDPlainLanguage(BaseModel):
    original: str
    plain: str


class PredictedQuestion(BaseModel):
    question: str
    category: str
    source: str
    key_points: list[str] = Field(default_factory=list)


class StarStory(BaseModel):
    project_name: str
    situation: str
    task: str
    action: str
    result: str
    follow_up_questions: list[str] = Field(default_factory=list)


class GapItem(BaseModel):
    gap: str
    action: str
    time_estimate: str = ""


class CompanyResearch(BaseModel):
    overview: str
    product_features: str
    competitors: str
    ai_strategy: str
    recent_news: str
    culture_signals: str
    sources: list[str] = Field(default_factory=list)


class JDAnalysis(BaseModel):
    core_intent: str
    plain_language: list[JDPlainLanguage] = Field(default_factory=list)
    requirement_matching: list[RequirementMatch] = Field(default_factory=list)


class GapAnalysis(BaseModel):
    priority_1_must_fix: list[GapItem] = Field(default_factory=list)
    priority_2_should_fix: list[GapItem] = Field(default_factory=list)
    priority_3_nice_to_have: list[GapItem] = Field(default_factory=list)


class PrepMeta(BaseModel):
    prep_id: str
    company_name: str
    role_name: str
    direction: str
    direction_label: str
    difficulty: str
    prep_mode: str = "standard"
    generated_at: str
    has_web_search: bool = False
    source_count: int = 0
    diagnosis_feedback: Optional[dict] = None


class PrepDocument(BaseModel):
    meta: PrepMeta
    company_research: CompanyResearch = Field(default_factory=CompanyResearch)
    jd_analysis: JDAnalysis = Field(default_factory=JDAnalysis)
    self_intro: str = ""
    star_stories: list[StarStory] = Field(default_factory=list)
    predicted_questions: list[PredictedQuestion] = Field(default_factory=list)
    gap_analysis: GapAnalysis = Field(default_factory=GapAnalysis)
    focus_areas: list[str] = Field(default_factory=list)
    prep_summary: str = ""
    coaching_tips: list[str] = Field(default_factory=list)
    ask_back_questions: list[str] = Field(default_factory=list, description="反问面试官的问题清单")


class PrepRefineRequest(BaseModel):
    prep_id: str = Field(..., description="面试准备文档ID")
    session_id: str = Field(..., description="面试会话ID（用于获取诊断结果）")


class StartFromPrepRequest(BaseModel):
    prep_id: str = Field(..., description="面试准备文档ID")
    resume_text: str = Field("", description="简历文本（覆盖prep中的）")
    difficulty: Optional[str] = Field(None, description="覆盖难度")


class StartFromPrepResponse(BaseModel):
    session_id: str
    prep_id: str
    first_question: AgentQuestion
    prep_context_used: list[str] = Field(default_factory=list, description="使用了哪些prep内容")


# ── 外部文档导入（Skill MD → 准备驱动面试）──

class StartFromExternalDocRequest(BaseModel):
    resume_text: str = Field(..., description="简历全文")
    external_doc_text: str = Field(..., description="外部面试准备文档全文（如 interview-prep skill 的 .md 输出）")
    difficulty: str = Field("mid", description="面试难度")
    direction: str = Field("E", description="岗位方向: A-G")


class StartFromExternalDocResponse(BaseModel):
    session_id: str
    first_question: AgentQuestion
    prep_context_used: list[str] = Field(default_factory=list, description="从外部文档中提取并使用的上下文")
    parsed_summary: str = Field("", description="解析摘要（用于前端展示）")


# ── 面经提取题目 ──

class ExtractQuestionsRequest(BaseModel):
    text: str = Field(..., description="面经文本/面试题目文本")
    category: str = Field("前端", description="默认分类")


class ExtractQuestionsResponse(BaseModel):
    questions: list[PredictedQuestion] = Field(default_factory=list, description="提取的题目列表")


# ── 简历-岗位匹配度 ──

class MatchRequest(BaseModel):
    resume_text: str = Field(..., max_length=10000, description="简历全文")
    jd_text: str = Field(..., max_length=10000, description="岗位JD全文")


class MatchResponse(BaseModel):
    match_score: int = Field(..., ge=0, le=100, description="匹配度评分 0-100")
    core_intent: str = Field("", description="JD核心意图一句话")
    requirement_matching: list[RequirementMatch] = Field(default_factory=list, description="逐条JD匹配分析")
    covered: list[str] = Field(default_factory=list, description="✅ 覆盖项")
    diggable: list[str] = Field(default_factory=list, description="⚠️ 可挖项（做过但表达不到位）")
    missing: list[str] = Field(default_factory=list, description="❌ 缺失项")
    mismatched: list[str] = Field(default_factory=list, description="🔄 错配项")
    prep_suggestions: list[str] = Field(default_factory=list, description="面试备考建议")
