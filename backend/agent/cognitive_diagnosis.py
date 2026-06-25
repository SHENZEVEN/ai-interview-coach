"""Cognitive diagnosis — analyzes interview answers to build a knowledge model.

This is the core differentiator: instead of just scoring answers,
we build a structured "cognitive map" of the candidate's abilities.
"""

import json
from typing import Optional
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class KnowledgeArea:
    """Tracks mastery of a specific knowledge area across the interview."""
    name: str
    total_hits: int = 0          # 被考察到的次数
    covered_well: int = 0         # 回答良好的次数
    keywords_mentioned: set[str] = field(default_factory=set)
    missing_concepts: set[str] = field(default_factory=set)
    scores: list[float] = field(default_factory=list)

    @property
    def coverage(self) -> float:
        """该领域回答覆盖率 0-1（连续值，每个题目贡献 score/100）。"""
        if self.total_hits == 0:
            return 0.0
        # covered_well 存储的是 Σ(score/100)，除以 total_hits 得到平均覆盖率
        return min(1.0, self.covered_well / self.total_hits)

    @property
    def depth_score(self) -> float:
        """该领域平均深度评分 0-10。"""
        if not self.scores:
            return 0.0
        return (sum(self.scores) / len(self.scores)) / 10

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "coverage": round(self.coverage, 2),
            "depth_score": round(self.depth_score, 1),
            "keywords_mentioned": sorted(self.keywords_mentioned),
            "missing_concepts": sorted(self.missing_concepts),
        }


@dataclass
class CognitiveModel:
    """The continuously-updated cognitive model of a candidate."""
    session_id: str
    areas: dict[str, KnowledgeArea] = field(default_factory=dict)

    # 跨题目指标
    logic_scores: list[float] = field(default_factory=list)
    communication_scores: list[float] = field(default_factory=list)

    # 时间线：每题得分变化
    score_timeline: list[dict] = field(default_factory=list)

    def get_or_create_area(self, name: str) -> KnowledgeArea:
        if name not in self.areas:
            self.areas[name] = KnowledgeArea(name=name)
        return self.areas[name]

    def update_from_evaluation(
        self,
        question_id: str,
        question_category: str,
        question_text: str,
        score: float,
        knowledge_hits: list[str],
        knowledge_gaps: list[str],
        logic_score: float,
        communication_score: float,
        keywords: list[str],
    ) -> None:
        """根据单题评估结果更新认知模型。"""
        area = self.get_or_create_area(question_category)
        area.total_hits += 1
        area.scores.append(score)
        # 使用连续分数而非二值阈值：score / 100 作为覆盖度贡献
        # 这样每个题目贡献 [0, 1] 的覆盖度，多次累加后取平均
        area.covered_well += score / 100.0  # score 是 0-100
        area.keywords_mentioned.update(keywords)
        area.missing_concepts.update(knowledge_gaps)

        self.logic_scores.append(logic_score)
        self.communication_scores.append(communication_score)

        self.score_timeline.append({
            "question_id": question_id,
            "question_short": question_text[:50] + "...",
            "category": question_category,
            "score": round(score, 1),
            "logic_score": round(logic_score, 1),
            "communication_score": round(communication_score, 1),
        })

    def generate_diagnosis(self, strengths: list[str], weaknesses: list[str], improvement_plan: list[str]) -> dict:
        """生成完整的认知诊断报告。"""
        knowledge_map = [area.to_dict() for area in self.areas.values()]

        # 计算总分（加权平均）
        all_scores = []
        for area in self.areas.values():
            all_scores.extend(area.scores)
        overall = sum(all_scores) / len(all_scores) if all_scores else 0.0

        avg_logic = sum(self.logic_scores) / len(self.logic_scores) if self.logic_scores else 0.0
        avg_comm = sum(self.communication_scores) / len(self.communication_scores) if self.communication_scores else 0.0
        avg_depth = sum(a.depth_score for a in self.areas.values()) / max(len(self.areas), 1)

        # 雷达图数据
        radar_data = {}
        for area in self.areas.values():
            radar_data[area.name] = {
                "coverage": area.coverage,
                "depth": area.depth_score,
            }

        return {
            "session_id": self.session_id,
            "overall_score": round(overall, 1),
            "knowledge_map": knowledge_map,
            "logic_score": round(avg_logic, 1),
            "communication_score": round(avg_comm, 1),
            "depth_score": round(avg_depth, 1),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "improvement_plan": improvement_plan,
            "radar_data": radar_data,
            "timeline_data": self.score_timeline,
        }
