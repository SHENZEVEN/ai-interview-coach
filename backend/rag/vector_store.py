"""ChromaDB vector store using built-in ONNX embeddings (no external API needed)."""

import os
import json
from typing import Optional

import chromadb
from chromadb.utils import embedding_functions


def get_embedding_function():
    """使用 ChromaDB 内置 ONNX 模型 (all-MiniLM-L6-v2)，无需外部 API。
    首次使用自动下载模型 (~80MB)，之后完全离线运行。
    """
    return embedding_functions.DefaultEmbeddingFunction()


def get_vector_store(persist_dir: Optional[str] = None) -> chromadb.Collection:
    """获取或创建 ChromaDB collection（使用本地 ONNX embedding）。"""
    if persist_dir is None:
        persist_dir = os.getenv("CHROMA_PERSIST_DIR", "./chroma_data")

    os.makedirs(persist_dir, exist_ok=True)

    client = chromadb.PersistentClient(path=persist_dir)
    ef = get_embedding_function()

    collection = client.get_or_create_collection(
        name="interview_qa",
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"},
    )
    return collection


def get_collection_count(collection: chromadb.Collection) -> int:
    """获取 collection 中的文档数。"""
    try:
        return collection.count()
    except Exception:
        return 0


def load_seed_data(
    collection: chromadb.Collection, seed_path: str = "data/seed_qa.json"
) -> int:
    """加载种子数据到向量库，返回加载的文档数。"""
    with open(seed_path, "r", encoding="utf-8") as f:
        qa_list = json.load(f)

    ids = []
    documents = []
    metadatas = []

    for i, item in enumerate(qa_list):
        # 检索用文本：问题 + 知识点 + 相关概念
        search_text = (
            f"【{item['category']}·{item['subcategory']}】{item['question']}\n"
            f"考察要点：{'、'.join(item['key_points'])}\n"
            f"相关概念：{'、'.join(item.get('related_concepts', []))}"
        )

        ids.append(f"qa_{i:03d}")
        documents.append(search_text)
        metadatas.append({
            "category": item["category"],
            "subcategory": item["subcategory"],
            "question": item["question"],
            "answer": item["answer"],
            "key_points": json.dumps(item["key_points"], ensure_ascii=False),
            "related_concepts": json.dumps(
                item.get("related_concepts", []), ensure_ascii=False
            ),
        })

    if ids:
        collection.add(ids=ids, documents=documents, metadatas=metadatas)

    return len(ids)


def search_similar_questions(
    collection: chromadb.Collection,
    query: str,
    k: int = 5,
    filter_category: Optional[str] = None,
) -> list[dict]:
    """检索与查询最相似的面试题。

    Args:
        collection: ChromaDB collection
        query: 查询文本（简历内容/岗位JD）
        k: 返回数量
        filter_category: 可选，按类别过滤

    Returns:
        list[dict]: 相似题目列表
    """
    where_filter = None
    if filter_category:
        where_filter = {"category": filter_category}

    results = collection.query(
        query_texts=[query],
        n_results=k,
        where=where_filter,
    )

    output = []
    if results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            metadata = results["metadatas"][0][i] if results["metadatas"] else {}
            distance = results["distances"][0][i] if results["distances"] else None
            output.append({
                "question": metadata.get("question", ""),
                "answer": metadata.get("answer", ""),
                "category": metadata.get("category", ""),
                "subcategory": metadata.get("subcategory", ""),
                "key_points": json.loads(metadata.get("key_points", "[]")),
                "related_concepts": json.loads(
                    metadata.get("related_concepts", "[]")
                ),
                "relevance_score": 1 - distance if distance is not None else None,
            })

    return output
