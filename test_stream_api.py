import requests
import json

data = {
    "resume_text": "张三，5年Python开发经验，熟悉Django和FastAPI框架。",
    "jd_text": "招聘Python后端开发工程师，要求3年以上经验，熟悉Django框架",
    "company_name": "测试公司",
    "role_name": "后端开发工程师",
    "direction": "E",
    "difficulty": "mid",
    "prep_mode": "rapid"
}

print("测试流式API...")
try:
    response = requests.post(
        "http://localhost:8000/api/prep/stream-generate",
        json=data,
        stream=True,
        timeout=120
    )
    
    response.raise_for_status()
    
    buffer = ""
    event_type = ""
    final_content = None
    
    for chunk in response.iter_content(chunk_size=4096):
        if chunk:
            try:
                buffer += chunk.decode('utf-8')
            except UnicodeDecodeError as e:
                print(f"解码错误: {e}")
                buffer += chunk.decode('utf-8', errors='replace')
            
            lines = buffer.split('\n')
            buffer = lines.pop() if lines else ""
            
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                
                if line.startswith('event:'):
                    event_type = line[6:].strip()
                    print(f"\n事件类型: {event_type}")
                elif line.startswith('data:'):
                    data_part = line[5:].strip()
                    print(f"数据长度: {len(data_part)}")
                    
                    if event_type == 'done':
                        print(f"=== DONE 事件数据 ===")
                        print(f"原始数据长度: {len(data_part)}")
                        print(f"原始数据前500字符: {repr(data_part[:500])}")
                        print(f"原始数据后500字符: {repr(data_part[-500:])}")
                        
                        try:
                            parsed = json.loads(data_part)
                            print(f"JSON解析成功")
                            if 'content' in parsed:
                                print(f"内容长度: {len(parsed['content'])}")
                                print(f"内容前200字符: {repr(parsed['content'][:200])}")
                                final_content = parsed['content']
                        except json.JSONDecodeError as e:
                            print(f"JSON解析失败: {e}")
                            # 尝试找出问题位置
                            try:
                                # 分段解析
                                for i in range(0, len(data_part), 500):
                                    segment = data_part[i:i+500]
                                    try:
                                        # 尝试解析到当前位置
                                        json.loads(data_part[:i+500])
                                    except json.JSONDecodeError:
                                        print(f"问题可能在位置 {i}-{i+500}")
                                        print(f"该段数据: {repr(segment)}")
                                        break
                            except:
                                pass
    
    if final_content:
        print("\n=== 最终内容 ===")
        print(f"长度: {len(final_content)}")
        try:
            doc = json.loads(final_content)
            print(f"文档结构: {list(doc.keys())}")
            print("解析成功！")
        except json.JSONDecodeError as e:
            print(f"JSON解析失败: {e}")
        
except Exception as e:
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()