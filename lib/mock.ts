export const MOCK_KBS = [
  { id: '1', name: '产品需求文档', docCount: 12, updatedAt: '2026-03-20', description: '包含所有核心产品的 PRD、交互设计规范以及版本迭代记录。' },
  { id: '2', name: '技术架构指南', docCount: 5, updatedAt: '2026-03-21', description: '后端微服务架构设计、前端组件库说明、部署文档及 API 规范。' },
  { id: '3', name: 'HR 规章制度', docCount: 3, updatedAt: '2026-03-15', description: '员工手册、报销流程、休假制度、入职指引等行政文档。' },
  { id: '4', name: '客户支持话术', docCount: 28, updatedAt: '2026-03-22', description: '常见问题解答 (FAQ)、工单处理标准流程及客户沟通模板。' },
];

export const MOCK_DOCS = [
  { id: 'd1', name: 'v2.0_产品规划.pdf', size: '2.4 MB', type: 'PDF', pages: 15, status: 'success', updatedAt: '2026-03-21 10:00' },
  { id: 'd2', name: '前端架构演进.md', size: '45 KB', type: 'Markdown', pages: '-', status: 'success', updatedAt: '2026-03-20 15:20' },
  { id: 'd3', name: 'Q1_财务报表.xlsx', size: '1.2 MB', type: 'Excel', pages: 3, status: 'pending', updatedAt: '2026-03-22 08:00' },
  { id: 'd4', name: '无效的扫描件.pdf', size: '8.5 MB', type: 'PDF', pages: 20, status: 'failed', updatedAt: '2026-03-19 11:00' },
  { id: 'd5', name: 'API_接口规范_v1.docx', size: '320 KB', type: 'Word', pages: 8, status: 'success', updatedAt: '2026-03-18 09:30' },
];

export const MOCK_SESSIONS = [
  { id: 's1', title: '关于 v2.0 产品规划的疑问', updatedAt: '2026-03-22 14:00' },
  { id: 's2', title: '如何部署前端组件库？', updatedAt: '2026-03-21 09:30' },
  { id: 's3', title: '年假申请流程说明', updatedAt: '2026-03-18 16:45' },
  { id: 's4', title: '微服务鉴权机制探讨', updatedAt: '2026-03-15 11:20' },
];

export const MOCK_MESSAGES = [
  {
    id: 'm1',
    role: 'user',
    content: '请详细说明 v2.0 版本中知识库的主要更新点，特别是关于检索和权限的部分。',
    createdAt: '14:00'
  },
  { 
    id: 'm2', 
    role: 'assistant', 
    content: '<p>在 v2.0 版本中，知识库系统进行了全面的架构升级，核心更新集中在<strong>检索增强</strong>与<strong>企业级权限管控</strong>两个方面：</p><h3>1. 混合检索架构 (Hybrid Search)</h3><p>引入了全新的混合检索机制，将传统的关键词检索与向量检索深度融合：</p><ul><li><strong>BM25 算法</strong>：提升了对专业术语、产品代号等长尾词的精确召回率。</li><li><strong>语义向量 (Dense Retrieval)</strong>：基于最新的 <code>text-embedding-004</code> 模型，增强了对自然语言提问的意图理解。</li><li><strong>Rerank 重排</strong>：在召回后增加了一层交叉编码器重排，使 Top-K 结果的准确率提升了 40%。</li></ul><h3>2. 多模态文档解析</h3><p>系统现已原生支持复杂文档的解析：</p><ul><li><strong>OCR 增强</strong>：可直接提取扫描件、发票中的文本。</li><li><strong>图表理解</strong>：能够解析 PDF 中的表格结构，并将其转换为 Markdown 格式供大模型阅读。</li></ul><h3>3. 细粒度权限隔离 (RBAC)</h3><p>为了满足大客户的合规需求，v2.0 重构了权限模型：</p><ul><li><strong>文档级鉴权</strong>：在向量检索阶段即注入用户权限标识（Metadata Filtering），确保用户只能检索到其拥有权限的 Chunk。</li><li><strong>动态脱敏</strong>：针对敏感字段（如财务数据、PII），支持在返回给大模型前进行动态打码处理。</li></ul>', 
    createdAt: '14:01',
    citations: [
      { id: 'c1', filename: 'v2.0_产品规划_内部版.pdf', chunkId: 'chunk-042', snippet: 'v2.0 核心特性：引入混合检索机制（BM25 + 向量），结合 Rerank 重排模型，Top-K 准确率预期提升 40%...', score: 0.92 },
      { id: 'c2', filename: 'v2.0_产品规划_内部版.pdf', chunkId: 'chunk-045', snippet: '权限合规升级：实现文档级权限隔离，向量库查询需强制携带 User Token 进行 Metadata 过滤，防止越权检索。', score: 0.89 },
      { id: 'c3', filename: 'Q1_技术架构演进.md', chunkId: 'chunk-112', snippet: '多模态支持方案：集成最新 OCR 引擎，优化 PDF 表格提取算法，统一转换为 Markdown 结构化数据。', score: 0.85 }
    ],
    debugInfo: {
      query: 'v2.0 知识库 更新点 检索 权限',
      knowledgeBase: '产品需求文档 (ID: kb-001)',
      retrievedChunks: 15,
      topK: 5,
      latency: '1.24s',
      model: 'gemini-3.1-pro-preview',
      embeddingModel: 'text-embedding-004',
      reranker: 'bge-reranker-v2-m3',
      similarityScores: [0.92, 0.89, 0.85, 0.78, 0.71]
    }
  },
];
