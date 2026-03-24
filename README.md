# Frontend

前端基于 Next.js 15，使用 `pnpm` 管理依赖。

## 环境变量

本地开发时复制模板：

```bash
cp .env.example .env.local
```

PowerShell 可用：

```powershell
Copy-Item .env.example .env.local
```

默认配置：

- `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000`

## 本地运行

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

## Docker 构建与运行

构建镜像：

```bash
docker build -t ai-rag-agent-frontend --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8000 .
```

运行容器：

```bash
docker run --rm -p 3000:3000 ai-rag-agent-frontend
```

## 部署说明

- 前端镜像会在构建阶段把 `NEXT_PUBLIC_API_BASE_URL` 固定为 `http://localhost:8000`
- 如果后端地址不是 `http://localhost:8000`，需要重新构建前端镜像并传入新的 `NEXT_PUBLIC_API_BASE_URL`
- 数据库和后端的编排放在 [backend/docker-compose.yml](/G:/@restflux.com/workspace/Open/ai-rag-agent/backend/docker-compose.yml)
- 如果你是分别部署前后端，前端只需要当前目录下的 Dockerfile 和 `.env.example`
