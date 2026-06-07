# Quick Translator

本地英文快速翻译 Web 工具。第一版只包含最小可用闭环：

- 输入英文单词或短语，返回中文、IPA 音标、词性
- 输入英文句子或段落，返回中文翻译
- 前端使用浏览器 Web Speech API 播放英文朗读
- 后端使用 DeepSeek V4 API，按 OpenAI-compatible SDK 调用格式接入

## 项目结构

```text
quick-translator/
  backend/
    app/
      main.py
      schemas.py
    .env.example
    requirements.txt
  frontend/
    src/
      App.tsx
      App.css
      main.tsx
    index.html
    package.json
    tsconfig.json
    tsconfig.node.json
    vite.config.ts
```

## 启动后端

```bash
cd ~/projects/quick-translator/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

编辑 `.env`：

```bash
LLM_API_KEY=your_deepseek_api_key
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-flash
```

`LLM_BASE_URL` 和 `LLM_MODEL` 不设置时，后端默认分别使用 `https://api.deepseek.com` 和 `deepseek-v4-flash`。
第一版不默认使用 `deepseek-v4-pro`，也不默认使用已计划废弃的 `deepseek-chat` / `deepseek-reasoner`。

启动服务：

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

健康检查：

```bash
curl http://127.0.0.1:8000/api/health
```

## 启动前端

```bash
cd ~/projects/quick-translator/frontend
npm install
npm run dev
```

默认访问：

```text
http://127.0.0.1:5173
```

Vite 已配置 `/api` 代理到 `http://127.0.0.1:8000`。

## 测试翻译接口

单词或短语：

```bash
curl -X POST http://127.0.0.1:8000/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"take off"}'
```

句子或段落：

```bash
curl -X POST http://127.0.0.1:8000/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text":"I need to finish this project before Friday."}'
```

返回示例：

```json
{
  "kind": "term",
  "chinese": "起飞；脱下；开始成功",
  "ipa": "/teik of/",
  "part_of_speech": "动词短语"
}
```

## 当前未完成项

- 没有数据库
- 没有登录
- 没有部署配置
- 没有生词本
- 没有复杂历史记录
- 没有后端 TTS
