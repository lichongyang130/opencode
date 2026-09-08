# 一站式 AI Agent 工作空间（HIX AI 同类产品）完整建设方案

> 目标：做一个类似 hix.ai 的产品 —— 用户在一个对话式工作空间里，用自然语言完成
> **深度研究 → 写文档 → 做 PPT → 生成图片 → 生成视频 → 出代码 → 整套营销素材包**，
> 后端聚合多家主流大模型，商业模式为"免费额度 + 订阅 + 按量充值"。

---

## 一、产品定位

| 项 | 内容 |
|---|---|
| 一句话定位 | 你的终极 AI 智能体工作空间（研究、分析、创作一条流完成）|
| 核心差异点 | 不是单点工具（不是纯聊天/纯绘图），而是 **Agent 编排 + 多模态产物 + 品牌一致性** |
| 目标用户 | ① 市场营销人员 ② 研究/分析师 ③ 创业者/独立开发者 ④ 教师/教育者 |
| 商业模式 | Freemium：注册送积分 → 订阅套餐（月/年）→ 积分充值包 |
| 对标产品 | HIX AI、Genspark、Jasper、Notion AI、Lovart（设计向）|

---

## 二、功能拆解（对标 HIX 的功能矩阵）

### P0 —— MVP 必须有（上线即用）
1. **AI Chat 多模型对话**
   - 一个入口切换多个模型（Claude / GPT / Gemini / Qwen / DeepSeek 等）
   - 流式输出（SSE）、多轮上下文、附件上传（PDF/Word/图片/链接）
   - 联网搜索开关
2. **Artifacts 产物系统**（OpenCanvas 式右侧画布）
   - 对话中生成的文档、代码、PPT、图片直接渲染在右侧画布，可继续编辑/迭代
3. **AI 文档写作（Docs）**
   - 富文本/块编辑器，AI 续写、改写、翻译、扩写、总结
4. **AI PPT/Slides 生成**
   - 一句话/一份资料 → 结构化幻灯片 → 在线预览 → 导出 PPTX/PDF
5. **AI 图片生成（Image）**
   - 文生图、图生图、风格参考、品牌尺寸模板（社媒图、海报）
6. **深度研究（Research）**
   - 输入主题 → 自动多轮搜索 → 阅读网页/PDF → 输出带引用的研究报告
7. **用户系统 + 积分系统**
   - 注册登录、积分扣减（按模型/按任务）、用量记录
8. **素材库（Library）**
   - 所有对话、文档、PPT、图片、视频集中管理、分享

### P1 —— 上线后 1~2 个月补齐
9. **AI 视频生成（Video）**：文生视频、图生视频（接入 Seedance / Kling / Wan / Veo 类模型）
10. **Agent 工作流模板（"一句话出整套包"）**
    - 产品发布套件、社媒 campaign 包、网络研讨会包、儿童绘本（故事+插图+书）等
    - 底层是多步骤 Agent：调研 → 文案 → 配图 → 视频脚本 → PPT
11. **品牌中心（Brand Kit）**：上传品牌 logo/色板/字体/语调，所有产物保持品牌一致
12. **代码生成与预览**：HTML/React 原型直接在沙箱 iframe 中预览
13. **分享与协作**：产物链接分享、团队工作区

### P2 —— 中期
14. 自定义 Agent / 工作流编排（可视化节点，类 Dify）
15. API 开放平台（按 token 计费）
16. 浏览器插件、移动端
17. 企业版：SSO、私有模型接入、数据隔离

---

## 三、技术架构

```
┌─────────────────────────────────────────────────────────┐
│                    前端 (Next.js)                        │
│  对话面板  │  产物画布(Artifacts)  │  编辑器  │  素材库    │
└───────────────┬─────────────────────────────────────────┘
                │ SSE 流式 / REST / WebSocket(长任务进度)
┌───────────────▼─────────────────────────────────────────┐
│                 API 层 (Next.js Route Handlers)          │
│  鉴权 │ 限流 │ 积分预扣 │ 路由 │ 任务编排                  │
└───────┬───────────────┬──────────────────┬──────────────┘
        │               │                  │
┌───────▼──────┐ ┌──────▼───────┐  ┌───────▼────────┐
│ 模型网关      │ │ Agent 引擎    │  │ 任务队列        │
│ (统一路由/    │ │ (LangGraph)  │  │ (BullMQ+Redis) │
│  计费/降级)   │ │ 研究/PPT/包   │  │ 视频/研究/批量  │
└───┬────┬─────┘ └──────┬───────┘  └───────┬────────┘
    │    │              │                  │
 LLM 文本  图像/视频   搜索工具         Worker 进程
 多供应商  多供应商    Tavily/Exa      (调用模型+回写)
┌──────────────────────────────────────────────────────────┐
│ PostgreSQL(业务数据)  │  Redis(队列/缓存)  │  S3/R2(文件)  │
└──────────────────────────────────────────────────────────┘
```

### 技术选型建议

| 层 | 选型 | 理由 |
|---|---|---|
| 前端框架 | **Next.js 14+ (App Router) + TypeScript** | 全栈一体、流式友好、部署简单 |
| UI | **Tailwind CSS + shadcn/ui** | 快速搭出 HIX 风格界面 |
| 状态 | Zustand + TanStack Query | 轻量 |
| 富文本编辑器 | **TipTap** 或 BlockNote | AI 文档写作的事实标准 |
| 画布/Artifact | **自研分栏 + React Flow**（需要节点画布时）| 参考 OpenCanvas |
| PPT 渲染 | 前端 React 组件渲染幻灯片；导出用 **pptxgenjs**（Node）或 python-pptx | 不依赖第三方 PPT SaaS |
| 后端 | Next.js Route Handlers 为主；重任务用独立 **Node/Python Worker** | |
| Agent 编排 | **LangGraph**（Python 或 JS 版）| 状态机式多步 Agent，支持人工介入、断点恢复 |
| 数据库 | **PostgreSQL + Prisma** | |
| 队列 | **BullMQ + Redis** | 视频生成、深度研究等分钟级任务 |
| 文件存储 | Cloudflare R2 / AWS S3 | R2 出口流量免费，成本低 |
| 认证 | **Clerk**（海外）/ 自研 + 手机号验证码（国内）| |
| 支付 | **Stripe**（海外）；微信支付+支付宝（国内，用 PingPlusPlus/LemonSqueezy 类聚合）| |
| 部署 | Vercel（前端/API）+ Railway/Fly.io（Worker）；或整体阿里云/AWS | |

---

## 四、模型网关设计（产品的核心资产）

所有模型调用统一走内部 Gateway，对上暴露 OpenAI 兼容接口：

```
POST /api/v1/chat/completions  { model: "claude-xxx" | "gpt-xxx" | ... }
```

网关职责：
1. **多供应商适配**：Anthropic / OpenAI / Google / 阿里 Qwen / DeepSeek / MiniMax / 智谱
   等，每家一个 adapter；图像、视频模型同理。
2. **统一计费**：按 token / 张 / 秒换算成内部积分，调用前预扣、失败回滚。
3. **降级与重试**：某供应商限流/故障时自动切备用模型（如 Claude 不可 → GPT）。
4. **密钥管理**：服务端持有各厂商 Key，用户永远不接触。
5. **成本标记**：每个任务记录真实美元成本，方便毛利核算。

### 各能力推荐模型（以接入时最新版为准）

| 能力 | 首选 | 备选 |
|---|---|---|
| 对话/Agent/文案 | Claude Sonnet/Opus 系列 | GPT 系列、Gemini、Qwen-Max、DeepSeek |
| 低成本/高频 | DeepSeek、Qwen | Gemini Flash |
| 文生图 | Flux 系列、GPT Image | Seedream、即梦 |
| 文生视频 | Seedance、Kling | Wan、Veo |
| Embedding/RAG | bge-m3 / OpenAI embedding | |
| 联网搜索 | **Tavily**（AI 优化）或 Exa | SerpAPI + Jina Reader 读网页 |

---

## 五、三个关键模块的实现思路

### 1. PPT/Slides 生成（HIX 的主打卖点）
- 让 LLM 输出**严格 JSON Schema**：`{ title, theme, slides: [{layout, title, bullets, notes, imagePrompt}] }`
- 前端按 layout 模板渲染（封面/目录/图文/数据/对比/结尾 8~10 套版式）
- 图片位自动调用图像模型生成配图
- 用户可在画布上单页编辑、换主题、重排版
- 导出：pptxgenjs 生成 .pptx；浏览器打印为 PDF
- 结构化生成用"先大纲 → 用户确认/AI 自改 → 再逐页填充"两步法，质量明显更高

### 2. 深度研究（Deep Research）
LangGraph 状态机：
```
规划(拆解子问题) → 并⾏搜索(Tavily/Exa) → 网页阅读(Jina Reader)
→ 去重/打分 → 信息缺口? → 补充搜索(循环 2~4 轮)
→ 大纲 → 分节写作(带引用) → 组装报告 → 生成 PPT(可选)
```
- 全程异步任务 + WebSocket/SSE 推送进度（"正在搜索…正在阅读第 8 个来源…"）
- 产物是一篇带引用角标的文档 Artifact，可一键转 PPT

### 3. "一句话出整套素材包" Agent
以"新品发布套件"为例的 DAG：
```
主题输入
 ├─ 研究 Agent：竞品/受众/卖点
 ├─ 文案 Agent：新闻稿、社媒帖×5、邮件序列（共享品牌语调）
 ├─ 视觉 Agent：产品图、社媒配图、海报（图像模型 ×N）
 ├─ 视频 Agent：短视频脚本 → 视频模型生成
 └─ 汇总 Agent：落地页/PPT
```
- 每个节点产物都是 Artifact，挂在同一个"项目"下
- 关键：节点间共享上下文（品牌库 + 研究结论），保证风格统一

---

## 六、数据模型（核心表）

```
User(id, email/phone, plan, credits_balance, ...)
Conversation(id, user_id, title, model, mode)        # chat/slides/research...
Message(id, conversation_id, role, content, tokens, cost)
Artifact(id, conversation_id, type, title, data_json, file_url, version)
   type: document | slides | image | video | code | report
Task(id, user_id, type, status, progress, input_json, output_json, error)
CreditTransaction(id, user_id, amount, reason, task_id, created_at)
BrandKit(id, user_id, name, logo_url, colors, fonts, voice_guidelines)
Subscription(id, user_id, plan, stripe_id, period_end)
```

---

## 七、页面结构

```
/            落地页（Hero + 模型墙 + 场景卡 + 用户评价 + 定价，仿 HIX）
/pricing     定价
/app/chat    对话工作空间（左：会话列表；中：对话；右：Artifact 画布）
/app/research   深度研究
/app/slides     PPT 工作台
/app/image      图片工作台
/app/video      视频工作台
/app/docs        文档列表/编辑器
/app/library     素材库（全部产物）
/app/brand       品牌中心
/app/settings    账户/账单/用量
```

---

## 八、积分与定价设计（参考）

成本端（内部成本，量级参考，随模型价格变动）：
- 文本对话：约 $0.5~3 / 百万 token
- 图片：约 $0.02~0.05 / 张
- 视频：约 $0.1~0.5 / 条（5~10 秒）
- 深度研究报告：单次成本约 $0.3~1.5（大量搜索+长文生成）

建议定价：
| 套餐 | 价格 | 积分 | 适合 |
|---|---|---|---|
| Free | $0 | 注册送 100 积分/月 | 体验 |
| Pro | $19.9/月 | 高额度 + 高级模型 | 个人 |
| Teams | $49/人/月 | 协作 + 品牌库 | 小团队 |
| 充值包 | $9.9~99 | 不过期积分 | 偶尔用 |

积分换算示例：1 积分 ≈ $0.01 成本价，对用户售价约 $0.02~0.03/积分（保证 50%+ 毛利）。
- 对话 ~1 积分/次，图片 ~3 积分/张，PPT ~20~40 积分/份，研究报告 ~50~100 积分，视频 ~30~80 积分/条。

---

## 九、排期建议（2~3 人全栈小团队）

| 阶段 | 周数 | 交付 |
|---|---|---|
| 第 0 阶段：地基 | 第 1~2 周 | Next.js 脚手架、认证、模型网关（接 2~3 个文本模型）、积分系统、SSE 流式聊天 |
| 第 1 阶段：MVP | 第 3~6 周 | Artifact 画布、文档编辑器、图片生成、PPT 生成（JSON→渲染→导出）、素材库 |
| 第 2 阶段：研究+商业化 | 第 7~10 周 | Deep Research（LangGraph + 队列 + 进度推送）、Stripe/支付、落地页、SEO |
| **上线公测** | 第 10 周 | Free + Pro |
| 第 3 阶段 | 第 11~16 周 | 视频生成、Agent 素材包模板、品牌中心、代码沙箱 |
| 第 4 阶段 | 16 周后 | 自定义工作流、团队协作、API、插件 |

---

## 十、可直接复用的开源项目（省 2~3 个月）

| 项目 | 复用什么 |
|---|---|
| **OpenCanvas**（LangChain 出品，本仓库同名上游）| 对话 + Artifact 画布的整体交互、文档/代码生成与迭代模式 |
| **LobeChat** | 多模型聊天 UI、模型供应商适配、插件机制 |
| **Dify** | Agent/工作流编排思路、RAG 管道 |
| **LibreChat** | 多模型网关、对话管理 |
| **pptxgenjs / python-pptx** | PPT 导出 |
| **TipTap** | 文档编辑器 |

建议路线：**以 OpenCanvas 为底座**（它已经实现了聊天+画布+Artifact+多模型），
在其上加：模型网关计费层、PPT/图片/研究/视频四个垂直工作台、积分与订阅。

---

## 十一、合规与市场选择（重要决策点）

- **做海外市场**：Stripe + Clerk + 海外模型 API，内容政策宽松，Vercel 部署，英语优先。
- **做国内市场**：需要 ICP 备案、算法备案/生成式 AI 备案（或调用已备案的国内大模型：
  通义、文心、豆点、DeepSeek、智谱、Kling 等），支付接微信/支付宝，服务器在国内。
- 建议先做海外（上线快、无备案门槛），验证后再国内合规化。

---

## 十二、立刻可以开工的第一步

1. 初始化 Next.js 14 + Tailwind + shadcn/ui 项目
2. 接模型网关：先接 1 个文本模型（建议 DeepSeek，便宜）跑通 SSE 聊天
3. 实现积分表 + 调用预扣逻辑
4. 做三栏布局（会话列表 / 对话 / Artifact 画布）—— 即 OpenCanvas 式核心交互
5. 第一个垂直能力：PPT 生成（JSON Schema → 渲染 → 导出 pptx）
