import os
from dotenv import load_dotenv
load_dotenv()
if not os.environ.get('LLM_API_KEY'):
    print('请在 backend/.env 中设置 LLM_API_KEY')
    exit(1)

from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model='agnes-2.0-flash',
    api_key=os.environ['LLM_API_KEY'],
    base_url='https://apihub.agnes-ai.com/v1',
    temperature=0.3,
    timeout=60
)

prompt = '''## 面试准备任务 [RAPID模式]

**目标岗位**：前端开发
**目标公司**：
**岗位方向**：AI全栈开发/AI应用开发实习
**目标职级**：中级

**候选人简历**：
张三，3年前端开发经验，熟悉React、TypeScript

**岗位 JD**：
要求：熟悉React，了解TypeScript，有前端开发经验

**Rapid模式指令**：快速生成核心5章
- 第2章：JD深度解读+逐条匹配分析
- 第3章：定制版自我介绍（≤250字）
- 第5章：高频题预测（10-15题）
- 附录：Gap清单

请严格按照JSON格式输出，包含以下字段：
- jd_analysis: {"core_intent": "...", "requirement_matching": [...]}
- self_intro: "..."
- predicted_questions: [...]
- coaching_tips: [...]
- ask_back_questions: [...]'''

result = llm.invoke(prompt)
content = result.content

print('=' * 60)
print('LLM Output Length:', len(content))
print('=' * 60)
print('Full LLM Output:')
print('-' * 60)
print(content)
print('-' * 60)
