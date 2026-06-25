import os
os.environ['LLM_API_KEY'] = 'sk-dZ5g0R81i673XNpNkkn6a0uzBq7lzwX6dsXVVA2DYZYfEw2Q'

from langchain_openai import ChatOpenAI
import json
import re

llm = ChatOpenAI(
    model='agnes-2.0-flash',
    api_key=os.environ['LLM_API_KEY'],
    base_url='https://apihub.agnes-ai.com/v1',
    temperature=0.3,
    timeout=60
)

def _extract_json(text):
    try:
        match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
        if match:
            return json.loads(match.group(1))
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

def difficulty_label(difficulty):
    labels = {
        'intern': '实习',
        'junior': '初级',
        'mid': '中级',
        'senior': '高级',
        'lead': '负责人'
    }
    return labels.get(difficulty, difficulty)

# 模拟完整的 prompt 构建
prep_mode = 'rapid'
role_name = '前端开发'
company_name = ''
direction_label = 'AI全栈开发/AI应用开发实习'
difficulty = 'mid'
resume_text = '张三，3年前端开发经验，熟悉React、TypeScript'
jd_text = '要求：熟悉React，了解TypeScript，有前端开发经验'
web_context = ''

# 获取模式指令
mode_instruction = '''**Rapid模式指令**：快速生成核心5章
- 第1章：公司与产品调研（如无公司名则跳过）
- 第2章：JD深度解读+逐条匹配分析
- 第3章：定制版自我介绍（≤250字）
- 第5章：高频题预测（10-15题，按类别分组）
- 附录：Gap清单'''

# 构建完整 prompt
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
3. 预测题目：含面经预测 + 岗位专项 + JD推导 + 简历深挖四种来源
4. Gap清单：按优先级1/2/3分组，含具体补课行动
5. 若方向为F(AI全栈开发)，关注LLM理论/RAG实战/Agent开发/系统设计/编程算法类题目
6. coaching_tips：基于简历和JD差距，给出3-5条针对性备考建议
7. ask_back_questions：生成5-8个反问面试官的问题"""

print("Prompt length:", len(user_prompt))
print("=" * 60)
print("Sending request to LLM...")

result = llm.invoke(user_prompt)
content = result.content

print("=" * 60)
print("LLM Output Length:", len(content))
print("=" * 60)
print("Full LLM Output:")
print("-" * 60)
print(content)
print("-" * 60)

# 解析 JSON
prep_data = _extract_json(content)
print("=" * 60)
print("Extracted JSON keys:", list(prep_data.keys()))
print("jd_analysis:", prep_data.get('jd_analysis', {}))
print("predicted_questions count:", len(prep_data.get('predicted_questions', [])))
print("coaching_tips count:", len(prep_data.get('coaching_tips', [])))
