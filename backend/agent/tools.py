"""Agent tools for the interview agent."""
import json
from typing import Optional

from langchain_core.tools import tool
from rag.vector_store import search_similar_questions

# 全局 collection 引用，由 agent 初始化时注入
import chromadb
_collection: Optional[chromadb.Collection] = None


def set_vector_store(collection) -> None:
    """注入 vector store 实例。"""
    global _collection
    _collection = collection


@tool
def search_knowledge_base(
    query: str, category: Optional[str] = None, top_k: int = 3
) -> str:
    """搜索面试知识库，获取相关题目、参考答案和知识点。

    当需要为候选人出题、或验证某个知识点的标准答案时调用此工具。

    Args:
        query: 搜索查询，例如 "React 虚拟DOM" 或 "TCP 三次握手"
        category: 可选，限定知识领域（前端/计网/算法/AI Coding/系统设计/数据库/操作系统）
        top_k: 返回结果数量，默认 3

    Returns:
        JSON 格式的搜索结果，包含题目、答案、关键知识点
    """
    if _collection is None:
        return json.dumps({"error": "知识库未初始化"}, ensure_ascii=False)

    results = search_similar_questions(
        _collection, query, k=top_k, filter_category=category
    )

    simplified = []
    for r in results:
        simplified.append({
            "question": r["question"],
            "key_points": r["key_points"],
            "related_concepts": r["related_concepts"],
            "category": f"{r['category']}·{r['subcategory']}",
        })

    return json.dumps(simplified, ensure_ascii=False, indent=2)


@tool
def get_reference_answer(question_text: str) -> str:
    """获取某道面试题的标准参考答案和评分要点。

    当需要评估候选人回答质量、或需要指出候选人的知识缺口时调用此工具。

    Args:
        question_text: 面试题原文或关键词

    Returns:
        JSON 格式的参考答案、关键知识点、常见误区
    """
    if _collection is None:
        return json.dumps({"error": "知识库未初始化"}, ensure_ascii=False)

    results = search_similar_questions(_collection, question_text, k=1)

    if not results:
        return json.dumps(
            {"answer": "未找到参考答案，请结合专业知识判断。", "key_points": [], "common_mistakes": []},
            ensure_ascii=False,
        )

    r = results[0]
    return json.dumps({
        "question": r["question"],
        "answer": r["answer"],
        "key_points": r["key_points"],
        "related_concepts": r["related_concepts"],
    }, ensure_ascii=False, indent=2)
