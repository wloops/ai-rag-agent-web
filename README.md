# Frontend 运行手册

前端基于 `Next.js 15 + TypeScript`，负责登录、知识库管理、文档上传、聊天问答、Agent 工具入口、引用查看和调试面板展示。

## 环境变量

复制模板：

```powershell
Copy-Item .env.example .env.local
```

默认变量：

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

如果后端地址变化，需要同步修改并重新启动前端。

## 本地开发

安装依赖：

```bash
pnpm install
```

启动开发服务器：

```bash
pnpm dev
```

访问地址：

```text
http://localhost:3000
```

## 构建与检查

Lint：

```bash
pnpm lint
```

生产构建：

```bash
pnpm build
```

本地启动生产包：

```bash
pnpm start
```

## Docker

如果要启动完整项目，优先使用项目根目录的统一编排：

```bash
cd ..
docker compose up -d --build
```

单独构建前端镜像时：

构建镜像：

```bash
docker build -t ai-rag-agent-frontend --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 .
```

运行镜像：

```bash
docker run --rm -p 3000:3000 ai-rag-agent-frontend
```

注意：`NEXT_PUBLIC_API_BASE_URL` 会写入前端构建产物。修改这个变量后，需要重新构建前端镜像。

## 当前前端页面

- `/login`: 登录页
- `/kb`: 知识库列表
- `/kb/[id]`: 知识库详情、文档上传、状态查看
- `/agent`: Agent 工作台
- `/chat`: 聊天入口页
- `/chat/[id]`: 会话详情、引用面板、RAG 调试视图
- `/dashboard`: 概览页

## 文档上传与状态轮询

知识库详情页当前支持：

- 上传 `txt` / `md` / `pdf`
- 上传后立即返回，不等待后端同步建库
- 页面自动轮询 `pending` / `processing` 文档状态
- 失败时显示 `error_message`
- `failed` 文档支持直接重试

这和后端异步链路是一一对应的：前端只负责展示与轮询，不自己推断处理结果。

## 聊天与调试能力

聊天页当前支持：

- 继续已有会话提问
- 展示引用来源
- 查看 chunk 原文预览
- 查看调试数据：阈值、top-k、最终上下文、耗时、召回结果

Agent 页当前支持：

- 选择知识库
- 选择任务类型
- 执行知识库问答、知识库总结、最新文档汇总、面试材料生成
- 查看执行轨迹与引用片段

## 与后端联调前提

联调前至少要保证：

- 后端 API 已启动
- Redis 已启动
- Celery worker 已启动
- 后端模型 API key 已配置

否则会出现上传后一直 `processing` 或聊天失败的情况。

## 相关文档

- 项目总览：[`../README.md`](../README.md)
- 后端运行手册：[`../backend/README.md`](../backend/README.md)
