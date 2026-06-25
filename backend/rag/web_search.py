"""Lightweight web search — DuckDuckGo (free, no API key).

Provides real-time web search for company research, interview experiences,
and primary source verification — matching the interview-prep skill's philosophy.

v2.1: DDG API fallback + search result cache.
"""

import json
import re
import time
import urllib.parse
from typing import Optional

import requests

# ── User Agent ──
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/125.0.0.0 Safari/537.36"
)

# ── Rate limiting ──
_LAST_REQUEST = 0
_MIN_INTERVAL = 2.0  # seconds between requests

# ── Search cache ──
_CACHE: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL = 300  # 5 minutes


def _rate_limit():
    global _LAST_REQUEST
    elapsed = time.time() - _LAST_REQUEST
    if elapsed < _MIN_INTERVAL:
        time.sleep(_MIN_INTERVAL - elapsed)
    _LAST_REQUEST = time.time()


def _cache_key(query: str, source: str) -> str:
    return f"{source}:{query}"


def _cache_get(query: str, source: str) -> Optional[list[dict]]:
    key = _cache_key(query, source)
    if key in _CACHE:
        ts, results = _CACHE[key]
        if time.time() - ts < _CACHE_TTL:
            return results
        del _CACHE[key]
    return None


def _cache_set(query: str, source: str, results: list[dict]):
    key = _cache_key(query, source)
    _CACHE[key] = (time.time(), results)
    # 限制缓存大小
    if len(_CACHE) > 200:
        oldest = min(_CACHE.keys(), key=lambda k: _CACHE[k][0])
        del _CACHE[oldest]


def _search_ddg_html(query: str, max_results: int = 8) -> list[dict]:
    """Search DuckDuckGo HTML (non-JS version), returns list of {title, url, snippet}."""
    _rate_limit()

    url = "https://html.duckduckgo.com/html/"
    headers = {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    }
    data = {"q": query, "b": ""}

    try:
        resp = requests.post(url, headers=headers, data=data, timeout=5)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[web_search] DDG HTML search failed: {e}")
        return []

    # Parse results from HTML — try multiple regex patterns for different DDG HTML versions
    results = []

    # Pattern 1: Standard "result__a" class (current DDG HTML)
    result_blocks = re.findall(
        r'<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)</a>',
        resp.text,
    )
    snippet_blocks = re.findall(
        r'<a[^>]*class="result__snippet"[^>]*>(.*?)</a>',
        resp.text,
    )

    if not result_blocks:
        # Pattern 2: Older DDG format — "result__url" + "result__title"
        result_blocks = re.findall(
            r'<a[^>]*class="result__url"[^>]*href="([^"]*)"[^>]*>(.*?)</a>',
            resp.text,
        )
        titles = re.findall(
            r'<a[^>]*class="result__title"[^>]*href="[^"]*"[^>]*>(.*?)</a>',
            resp.text,
        )
        result_blocks = [(href, titles[i] if i < len(titles) else href) for i, (href, _) in enumerate(result_blocks)]

    if not result_blocks:
        # Pattern 3: Generic link extraction from search results
        all_links = re.findall(
            r'<a[^>]*href="(https?://[^"]*)"[^>]*>(.*?)</a>',
            resp.text,
        )
        # Filter out internal DDG links and short text
        result_blocks = [
            (href, title) for href, title in all_links
            if "duckduckgo" not in href.lower() and len(title.strip()) > 10
        ]

    for i, (href, title) in enumerate(result_blocks[:max_results]):
        snippet = ""
        if i < len(snippet_blocks):
            snippet = re.sub(r'<[^>]+>', '', snippet_blocks[i]).strip()
        # Clean HTML entities and tags
        title = re.sub(r'<[^>]+>', '', title).strip()
        title = title.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#x27;', "'")
        snippet = snippet.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&quot;', '"').replace('&#x27;', "'")

        if title and href.startswith("http"):
            results.append({
                "title": title,
                "url": href,
                "snippet": snippet[:300],
            })

    return results


def _search_ddg_lite(query: str, max_results: int = 8) -> list[dict]:
    """Fallback: DuckDuckGo Lite version."""
    _rate_limit()

    url = "https://lite.duckduckgo.com/lite/"
    headers = {
        "User-Agent": UA,
        "Accept": "text/html",
        "Accept-Language": "zh-CN,zh;q=0.9",
    }
    params = {"q": query}

    try:
        resp = requests.get(url, headers=headers, params=params, timeout=5)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[web_search] DDG Lite search failed: {e}")
        return []

    results = []
    # Lite version has simple table layout
    links = re.findall(
        r'<a[^>]*href="(https?://[^"]*)"[^>]*>([^<]*)</a>',
        resp.text,
    )
    # Filter out internal DDG links
    for href, text in links[:max_results]:
        text = text.strip()
        if text and "duckduckgo" not in href.lower() and len(text) > 3:
            results.append({
                "title": text[:150],
                "url": href,
                "snippet": "",
            })

    return results


def _search_ddg_api(query: str, max_results: int = 8) -> list[dict]:
    """Fallback: DuckDuckGo Instant Answer API (JSON).

    This is the most reliable DDG interface — returns structured JSON.
    Limited to ~30 results max, but sufficient for interview prep research.
    """
    _rate_limit()

    url = "https://api.duckduckgo.com/"
    params = {
        "q": query,
        "format": "json",
        "no_html": 1,
        "skip_disambig": 1,
        "t": "ai-interview-coach",
    }

    try:
        resp = requests.get(url, headers={"User-Agent": UA}, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()
    except (requests.RequestException, json.JSONDecodeError) as e:
        print(f"[web_search] DDG API search failed: {e}")
        return []

    results = []

    # 1. Abstract (primary result)
    if data.get("Abstract") and data.get("AbstractURL"):
        results.append({
            "title": data.get("Heading", data.get("Abstract", "")[:80]),
            "url": data["AbstractURL"],
            "snippet": data["Abstract"][:300],
        })

    # 2. Related Topics
    for topic in data.get("RelatedTopics", [])[:max_results - 1]:
        if isinstance(topic, dict) and "Text" in topic:
            text = topic["Text"]
            url = topic.get("FirstURL", "")
            if text and url:
                results.append({
                    "title": text[:150],
                    "url": url,
                    "snippet": text[:300],
                })

    # 3. Results (if present)
    for item in data.get("Results", [])[:max_results - len(results)]:
        if isinstance(item, dict):
            results.append({
                "title": item.get("Text", "")[:150],
                "url": item.get("FirstURL", ""),
                "snippet": item.get("Text", "")[:300],
            })

    return results


def search(
    query: str,
    max_results: int = 8,
    source: str = "auto",
) -> list[dict]:
    """Search the web and return structured results.

    Args:
        query: Search query string
        max_results: Maximum number of results to return
        source: "ddg" | "lite" | "auto" (tries ddg first, falls back to lite)

    Returns:
        list of {title, url, snippet}
    """
    # Check cache
    cached = _cache_get(query, source)
    if cached is not None:
        return cached

    if source == "auto":
        results = _search_ddg_html(query, max_results)
        if not results:
            results = _search_ddg_lite(query, max_results)
        if not results:
            results = _search_ddg_api(query, max_results)
    elif source == "ddg":
        results = _search_ddg_html(query, max_results)
    elif source == "lite":
        results = _search_ddg_lite(query, max_results)
    elif source == "api":
        results = _search_ddg_api(query, max_results)
    else:
        results = []

    # Cache results
    _cache_set(query, source, results)
    return results


def search_company(company_name: str) -> dict:
    """Search for company information from multiple angles.

    Returns structured company info dict suitable for prep_agent.
    """
    results = {}

    # 1. Company overview
    overview_results = search(f"{company_name} 公司 简介 融资 创始人", max_results=4)
    results["overview"] = overview_results

    # 2. Recent news
    news_results = search(f"{company_name} 最新动态 2025", max_results=3)
    results["recent_news"] = news_results

    # 3. AI strategy (if relevant)
    ai_results = search(f"{company_name} 大模型 AI 战略", max_results=3)
    results["ai_strategy"] = ai_results

    # 4. Culture / team
    culture_results = search(f"{company_name} 面试 团队 文化", max_results=3)
    results["culture"] = culture_results

    return results


def search_interview_experiences(company_name: str, role_name: str = "") -> list[dict]:
    """Search for real interview experiences (面经).

    Searches across multiple query patterns to maximize coverage.
    """
    all_results = []

    queries = [
        f"{company_name} {role_name} 面经 2024 2025",
        f"{company_name} 面试 流程 考点",
        f"{role_name} 面试 常见问题",
    ]

    for q in queries:
        if not company_name and "公司" not in q:
            continue
        results = search(q, max_results=4)
        all_results.extend(results)
        if len(all_results) >= 10:
            break

    # Deduplicate by URL
    seen = set()
    unique = []
    for r in all_results:
        if r["url"] not in seen:
            seen.add(r["url"])
            unique.append(r)

    return unique[:10]


def format_for_llm(search_results: list[dict]) -> str:
    """Format search results as context for LLM prompt injection."""
    if not search_results:
        return "（未搜索到相关结果）"

    lines = []
    for i, r in enumerate(search_results[:8]):
        lines.append(f"{i+1}. **{r['title']}**")
        lines.append(f"   URL: {r['url']}")
        if r.get("snippet"):
            lines.append(f"   摘要: {r['snippet']}")
        lines.append("")

    return "\n".join(lines)
