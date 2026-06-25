import re
import json

def _extract_json(text):
    try:
        # 尝试匹配 markdown code block
        match = re.search(r'```json\s*([\s\S]*?)\s*```', text)
        if match:
            return json.loads(match.group(1))
        # 尝试直接找 JSON 对象
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

# 测试标准 JSON 输出
test1 = '''```json
{"name": "test", "value": 1}
```'''
print('Test 1:', _extract_json(test1))

# 测试直接 JSON
test2 = '''{"name": "test", "value": 2}'''
print('Test 2:', _extract_json(test2))

# 测试带文本前缀
test3 = '''这是一个测试
```json
{"name": "test", "value": 3}
```
更多文本'''
print('Test 3:', _extract_json(test3))

# 测试失败情况
test4 = '''这不是 JSON'''
print('Test 4:', _extract_json(test4))
