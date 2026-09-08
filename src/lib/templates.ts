import type { WorkspaceMode } from "@/lib/store/chat";

export type TemplateCategory =
  | "marketing"
  | "ecommerce"
  | "workplace"
  | "writing"
  | "research"
  | "business"
  | "education"
  | "design"
  | "video"
  | "productivity";

/** 真实案例：变量填入真实值后的可复用示例。点击即填入输入框，不发送 */
export interface TemplateCase {
  /** 案例名（卡片展示） */
  label: string;
  /** 填入模板 {{变量}} 的真实值（key 需与 extractVariables 一致） */
  values: Record<string, string>;
  /** 效果图路径（public 下，如 /cases/d-corgi.jpg） */
  image?: string;
  /** 文字类案例的真实输出（节选），用于效果预览 */
  output?: string;
  /** 产出方式标注，用于说明真实性 */
  source?: string;
}

export interface Template {
  id: string;
  label: string;
  desc: string;
  category: TemplateCategory;
  mode: WorkspaceMode;
  prompt: string;
  /** 是否官方内置 */
  builtin?: boolean;
  /** 内置真实案例（0 到多个） */
  cases?: TemplateCase[];
}

export const CATEGORIES: { id: TemplateCategory; label: string }[] = [
  { id: "marketing", label: "市场营销" },
  { id: "ecommerce", label: "电商带货" },
  { id: "workplace", label: "职场办公" },
  { id: "writing", label: "写作创作" },
  { id: "research", label: "研究分析" },
  { id: "business", label: "商业创业" },
  { id: "education", label: "学习教育" },
  { id: "design", label: "设计绘图" },
  { id: "video", label: "视频直播" },
  { id: "productivity", label: "效率工具" },
];

export const CATEGORY_LABELS: Record<TemplateCategory, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.label])
) as Record<TemplateCategory, string>;

export const MODE_LABEL_OF: Record<WorkspaceMode, string> = {
  chat: "对话",
  research: "研究",
  slides: "PPT",
  image: "绘图",
  video: "视频",
  docs: "文档",
};

/** 提取提示词中的 {{变量}} */
export function extractVariables(prompt: string): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([^}]+?)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) set.add(m[1].trim());
  return [...set];
}

/** 用变量值替换占位符 */
export function applyVariables(prompt: string, values: Record<string, string>): string {
  return prompt.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, name) => values[name.trim()] ?? `【${name.trim()}】`);
}

export const TEMPLATES: Template[] = [
  // ============ 市场营销 ============
  { id: "m-launch-kit", label: "新品发布全套 PPT", desc: "发布会演示文稿", category: "marketing", mode: "slides", builtin: true, prompt: "为「{{产品名称}}」新品发布会生成一套完整 PPT，包含产品定位、核心功能、目标用户、市场机会与发布节奏" },
  { id: "m-social-xhs", label: "小红书爆款笔记", desc: "5 条种草文案", category: "marketing", mode: "chat", builtin: true, prompt: "为「{{产品}}」写 5 条小红书种草笔记，每条含吸睛标题、正文（痛点+卖点+使用场景）、emoji 和话题标签，风格各异" },
  { id: "m-social-ig", label: "Ins/社媒文案", desc: "多平台短文案", category: "marketing", mode: "chat", builtin: true, prompt: "为「{{产品}}」写一组社媒推广文案：Instagram 标题+正文、微博话题、推特短句，各 3 条，突出卖点与行动号召" },
  { id: "m-ad-copy", label: "信息流广告文案", desc: "10 条投放标题", category: "marketing", mode: "chat", builtin: true, prompt: "为「{{产品}}」写 10 条信息流广告标题+短描述，突出效率/性价比/痛点解决，风格不同，适合 A/B 测试" },
  { id: "m-brand-slogan", label: "品牌 Slogan", desc: "命名与口号", category: "marketing", mode: "chat", builtin: true, prompt: "为「{{品牌/产品}}」生成 10 个品牌名候选 + 10 条 slogan，要求好记、有调性，并说明每个的寓意" },
  { id: "m-brand-poster", label: "品牌宣传海报", desc: "新中式茶饮海报", category: "marketing", mode: "image", builtin: true, prompt: "{{品牌或产品}}的社媒宣传海报，{{风格，如清新水彩}}风格，主体突出，柔和光线，精致排版，商业摄影质感" },
  { id: "m-campaign", label: "营销 Campaign 策划", desc: "完整活动方案", category: "marketing", mode: "docs", builtin: true, prompt: "写一份「{{活动主题}}」整合营销 campaign 方案：目标、受众洞察、核心创意、渠道组合、内容排期、预算分配与 KPI" },
  { id: "m-seo-keywords", label: "SEO 关键词规划", desc: "关键词与内容策略", category: "marketing", mode: "docs", builtin: true, prompt: "围绕「{{行业/产品}}」做一份 SEO 关键词规划：核心词、长尾词、搜索意图、内容选题清单与落地页建议" },
  { id: "m-edm", label: "营销邮件 EDM", desc: "促销邮件序列", category: "marketing", mode: "chat", builtin: true, prompt: "为「{{产品}}」写一组 3 封促销邮件序列（预热/正式/催单），主题行吸睛，正文简短有力，含行动号召" },
  { id: "m-press", label: "新闻稿", desc: "产品发布通稿", category: "marketing", mode: "docs", builtin: true, prompt: "为「{{产品/事件}}」写一篇新闻通稿：标题、导语、正文（背景/亮点/引语）、公司介绍与媒体联系方式，专业规范" },

  // ============ 电商带货 ============
  { id: "ec-detail", label: "电商详情页文案", desc: "卖点转化文案", category: "ecommerce", mode: "docs", builtin: true, prompt: "为「{{商品}}」写电商详情页文案：主标题、5 大卖点（痛点+利益点）、使用场景、参数说明、促单话术" },
  { id: "ec-listing", label: "亚马逊 Listing", desc: "标题+五点+描述", category: "ecommerce", mode: "docs", builtin: true, prompt: "为「{{商品}}」写亚马逊 listing：英文标题、5 条 bullet points、产品描述、后台搜索关键词，符合平台规范且利于转化" },
  { id: "ec-live-script", label: "直播带货话术", desc: "主播口播脚本", category: "ecommerce", mode: "video", builtin: true, prompt: "为「{{商品}}」写一段 3 分钟直播带货口播脚本：留人开场、痛点、产品演示、价格锚点、逼单促单，分镜+台词" },
  { id: "ec-review", label: "好评/买家秀文案", desc: "真实感评价", category: "ecommerce", mode: "chat", builtin: true, prompt: "为「{{商品}}」写 8 条不同风格的买家好评（含追评、晒单文案），真实自然、突出使用体验，避免夸张" },
  { id: "ec-product-img", label: "商品主图", desc: "电商白底/场景图", category: "ecommerce", mode: "image", builtin: true, prompt: "{{商品}}的电商产品主图，纯白背景，专业棚拍，柔和阴影，高清细节，商业广告质感，方形构图" },
  { id: "ec-kuaishou", label: "快手/抖音带货脚本", desc: "15 秒短视频", category: "ecommerce", mode: "video", builtin: true, prompt: "为「{{商品}}」写一条 15 秒抖音带货短视频脚本：黄金 3 秒开头、卖点展示、价格惊喜、引导下单，含画面与字幕" },

  // ============ 职场办公 ============
  { id: "w-bd-email", label: "商务合作邮件", desc: "BD 外联邮件", category: "workplace", mode: "chat", builtin: true, prompt: "写一封商务合作开发邮件：向「{{合作方类型}}」介绍我们的「{{产品/服务}}」并提议合作，专业、简洁、不卑不亢，含主题行" },
  { id: "w-report", label: "季度经营复盘", desc: "复盘报告框架", category: "workplace", mode: "docs", builtin: true, prompt: "写一份「{{部门/项目}}」季度经营复盘报告：目标回顾、关键成果与数据、问题与原因、经验教训、下季度行动计划" },
  { id: "w-meeting", label: "会议纪要", desc: "纪要模板", category: "workplace", mode: "docs", builtin: true, prompt: "根据以下会议要点整理一份规范会议纪要：会议主题、时间参会人、讨论要点、决议事项、待办（负责人+截止时间）。要点：{{会议要点}}" },
  { id: "w-weekly", label: "周报/月报", desc: "工作汇报", category: "workplace", mode: "chat", builtin: true, prompt: "帮我把本周工作整理成一份结构化周报：本周完成、进行中、风险与需协调、下周计划。我的工作内容：{{内容}}" },
  { id: "w-resign", label: "辞职信/通知", desc: "得体文书", category: "workplace", mode: "chat", builtin: true, prompt: "写一封得体的辞职信，表达感谢、说明离职原因（个人发展）、交接承诺，语气真诚专业，岗位：{{岗位}}" },
  { id: "w-policy", label: "公司制度文档", desc: "管理制度", category: "workplace", mode: "docs", builtin: true, prompt: "起草一份「{{制度名称，如远程办公管理}}」制度：目的、适用范围、具体规定、流程、奖惩与附则，条款清晰可执行" },
  { id: "w-interview", label: "面试问题设计", desc: "岗位面试题", category: "workplace", mode: "docs", builtin: true, prompt: "为「{{岗位}}」设计一套面试评估方案：考察维度、10 个行为/专业问题、评分标准与录用建议参考" },
  { id: "w-resume", label: "简历优化", desc: "JD 匹配改写", category: "workplace", mode: "chat", builtin: true, prompt: "针对岗位「{{目标岗位 JD}}」，优化我的简历经历描述，用 STAR 法则和量化成果改写。我的经历：{{经历}}" },
  { id: "w-offer", label: "Offer/通知文案", desc: "HR 文书", category: "workplace", mode: "chat", builtin: true, prompt: "写一封录用通知（offer）邮件，岗位「{{岗位}}」，含薪资福利、报到事项、欢迎语，正式且友好" },

  // ============ 写作创作 ============
  { id: "wr-article", label: "公众号长文", desc: "爆款文章", category: "writing", mode: "docs", builtin: true, prompt: "写一篇微信公众号深度文章，主题「{{主题}}」：吸睛标题、开头钩子、3-5 个小标题段落、金句、结尾互动，语言有节奏" },
  { id: "wr-story", label: "短篇小说", desc: "故事创作", category: "writing", mode: "docs", builtin: true, prompt: "写一篇约 1500 字的短篇小说，题材「{{题材}}」，有人物、冲突与反转，结尾有余味，语言生动" },
  { id: "wr-speech", label: "演讲稿", desc: "演讲/致辞", category: "writing", mode: "docs", builtin: true, prompt: "写一篇「{{场合，如年会/毕业典礼}}」演讲稿，时长约 5 分钟，有开场故事、核心观点、情感升华与有力结尾" },
  { id: "wr-copy-polish", label: "文案润色", desc: "改写提升", category: "writing", mode: "chat", builtin: true, prompt: "润色下面这段文字，使其更流畅、有感染力、适合「{{场景}}」，保持原意：{{原文}}" },
  { id: "wr-poetry", label: "诗歌/文案金句", desc: "创意短句", category: "writing", mode: "chat", builtin: true, prompt: "以「{{主题}}」为题写 10 句有画面感的金句/短诗，适合做海报配文或社媒签名" },
  { id: "wr-outline", label: "写作大纲", desc: "书籍/专栏大纲", category: "writing", mode: "docs", builtin: true, prompt: "为一本关于「{{主题}}」的书写一份详细大纲：目标读者、核心观点、章节结构（每章要点）、写作风格建议" },

  // ============ 研究分析 ============
  { id: "r-ai", label: "AI 赛道研究", desc: "玩家/规模/趋势", category: "research", mode: "research", builtin: true, prompt: "深度研究 2025 年 AI 搜索与智能体赛道：主要玩家、市场规模、技术趋势、商业模式与差异化机会" },
  { id: "r-market", label: "市场调研报告", desc: "规模与用户", category: "research", mode: "research", builtin: true, prompt: "调研「{{行业/区域，如美国精品咖啡}}」市场：规模、增长率、主要品牌、消费者画像、渠道与进入策略" },
  { id: "r-competitor", label: "竞品分析", desc: "横向对比", category: "research", mode: "research", builtin: true, prompt: "对「{{竞品 A、B、C}}」做竞品分析：功能矩阵、定价、目标用户、优劣势与我们的差异化切入点" },
  { id: "r-industry", label: "行业研究报告", desc: "产业链梳理", category: "research", mode: "research", builtin: true, prompt: "深度研究「{{行业}}」：产业链结构、关键环节、驱动因素、政策影响、代表公司与未来 3 年趋势" },
  { id: "r-user", label: "用户画像分析", desc: "人群洞察", category: "research", mode: "docs", builtin: true, prompt: "为「{{产品}}」构建 3 个典型用户画像：人口属性、痛点、需求、使用场景、决策路径与运营策略建议" },
  { id: "r-data", label: "数据分析报告", desc: "数据解读", category: "research", mode: "docs", builtin: true, prompt: "根据以下数据写一份分析报告：关键发现、原因分析、趋势判断与行动建议。数据：{{数据}}" },

  // ============ 商业创业 ============
  { id: "b-bp", label: "商业计划书 BP", desc: "完整 BP", category: "business", mode: "docs", builtin: true, prompt: "写一份「{{项目/产品}}」商业计划书：问题与机会、解决方案、产品、目标市场、商业模式、竞品、营销策略、团队、财务预测与融资需求" },
  { id: "b-pitch", label: "路演 PPT", desc: "融资演示", category: "business", mode: "slides", builtin: true, prompt: "为「{{项目}}」生成一份 10 页融资路演 PPT：痛点、方案、产品、市场、模式、竞争、数据、团队、规划、融资" },
  { id: "b-canvas", label: "商业模式画布", desc: "九要素", category: "business", mode: "docs", builtin: true, prompt: "用商业模式画布（九大要素）分析「{{项目}}」：客户细分、价值主张、渠道、客户关系、收入来源、关键资源/活动/伙伴、成本结构" },
  { id: "b-finance", label: "财务预测", desc: "三年模型框架", category: "business", mode: "docs", builtin: true, prompt: "为「{{项目}}」搭建一份三年财务预测框架：收入假设、成本结构、盈亏平衡、关键指标（CAC/LTV）与敏感性分析" },
  { id: "b-webinar", label: "网络研讨会 PPT", desc: "B2B 分享", category: "business", mode: "slides", builtin: true, prompt: "为一场面向「{{受众}}」的「{{主题}}」网络研讨会生成演示 PPT，含干货框架、案例与行动号召" },
  { id: "b-name", label: "产品/公司命名", desc: "命名方案", category: "business", mode: "chat", builtin: true, prompt: "为「{{产品描述}}」提供 15 个命名方案（含中英文），分风格列出并说明含义、域名可用性建议" },

  // ============ 学习教育 ============
  { id: "e-lesson", label: "教案课件", desc: "完整教案", category: "education", mode: "docs", builtin: true, prompt: "为「{{年级/学科}}」的「{{课题}}」生成完整教案：教学目标、重难点、教学过程（导入/新授/练习/总结）、板书设计与作业" },
  { id: "e-course-ppt", label: "课程演示 PPT", desc: "教学幻灯片", category: "education", mode: "slides", builtin: true, prompt: "为「{{课程主题}}」一课生成教学演示 PPT，包含背景导入、知识讲解、案例、小结与思考题" },
  { id: "e-explain", label: "通俗讲解", desc: "费曼学习法", category: "education", mode: "chat", builtin: true, prompt: "用费曼学习法把「{{概念}}」讲给零基础的人听：一个生活化比喻、5 个要点、常见误区和一个小测验" },
  { id: "e-summary", label: "长文/资料总结", desc: "要点提炼", category: "education", mode: "chat", builtin: true, prompt: "把以下内容总结成结构化要点：核心观点、关键论据、可行动结论，300 字内。内容：{{内容}}" },
  { id: "e-quiz", label: "出题与解析", desc: "练习题", category: "education", mode: "docs", builtin: true, prompt: "围绕「{{知识点}}」出 10 道练习题（选择/判断/简答），附答案与详细解析，难度分层" },
  { id: "e-study-plan", label: "学习计划", desc: "备考规划", category: "education", mode: "docs", builtin: true, prompt: "为「{{目标，如 3 个月备考雅思 7 分}}」制定学习计划：阶段目标、每周任务、资源推荐、自测与复盘机制" },
  { id: "e-kids", label: "儿童故事/绘本", desc: "睡前故事", category: "education", mode: "docs", builtin: true, prompt: "写一个适合 {{年龄，如 5 岁}} 孩子的睡前故事，主题「{{主题}}」，语言温柔、有教育意义，约 400 字" },

  // ============ 设计绘图 ============
  { id: "d-corgi", label: "月球柯基海报", desc: "电影感插画", category: "design", mode: "image", builtin: true, prompt: "一只戴宇航头盔的柯基犬站在月球表面，地球在背景升起，电影感海报，光影细腻，科幻风格" },
  { id: "d-cyber", label: "赛博朋克城市", desc: "未来夜景", category: "design", mode: "image", builtin: true, prompt: "赛博朋克风格的未来城市夜景，霓虹灯光、雨夜街道、飞行汽车、广告牌，电影级构图，高细节" },
  { id: "d-mascot", label: "品牌 IP 吉祥物", desc: "3D 形象", category: "design", mode: "image", builtin: true, prompt: "一个科技公司的可爱机器人吉祥物 IP 形象，圆润造型，{{主色调}}，3D 渲染，纯白背景，适合做品牌形象" },
  { id: "d-logo", label: "Logo 概念图", desc: "品牌标志", category: "design", mode: "image", builtin: true, prompt: "为「{{品牌名}}」设计一个极简现代的 logo 概念，行业「{{行业}}」，矢量风格，单色为主，简洁有记忆点" },
  { id: "d-watercolor", label: "水彩插画", desc: "温柔手绘", category: "design", mode: "image", builtin: true, prompt: "{{画面主题}}的水彩手绘插画，柔和暖色，纸张质感，温馨治愈，适合做绘本或卡片" },
  { id: "d-product", label: "产品场景图", desc: "商业渲染", category: "design", mode: "image", builtin: true, prompt: "{{产品}}放在{{场景，如极简办公桌}}上的商业产品图，自然柔光，浅景深，高级质感，广告摄影" },
  { id: "d-avatar", label: "头像/人设图", desc: "个性头像", category: "design", mode: "image", builtin: true, prompt: "一个{{风格，如动漫/写实}}风格的个人头像，{{性别年龄外貌描述}}，纯色背景，光线柔和，正方形构图" },
  { id: "d-cover", label: "书籍/播客封面", desc: "封面设计", category: "design", mode: "image", builtin: true, prompt: "一本关于「{{主题}}」的书籍封面设计，{{风格}}，留白讲究，标题区域清晰，现代排版感" },

  // ============ 视频直播 ============
  { id: "v-ad", label: "带货短视频脚本", desc: "15 秒分镜", category: "video", mode: "video", builtin: true, prompt: "为「{{商品}}」写一条 15 秒抖音带货短视频脚本：分镜表（镜号/时长/画面/旁白/字幕），强钩子+卖点+逼单" },
  { id: "v-launch", label: "品牌短片分镜", desc: "30 秒短片", category: "video", mode: "video", builtin: true, prompt: "为「{{品牌/产品}}」写一条 30 秒品牌短片分镜脚本：开场氛围、产品亮相、使用场景、情感升华、口号收尾" },
  { id: "v-tiktok", label: "短视频选题脚本", desc: "口播脚本", category: "video", mode: "video", builtin: true, prompt: "围绕「{{主题}}」写 3 条短视频口播脚本，每条含 3 秒钩子、正文结构、结尾引导，适合 {{平台，如抖音}}" },
  { id: "v-live", label: "直播流程脚本", desc: "整场直播", category: "video", mode: "docs", builtin: true, prompt: "写一份「{{产品/主题}}」直播流程脚本（90 分钟）：开场暖场、产品讲解顺序、互动玩法、逼单节奏、福袋时间点" },
  { id: "v-storyboard", label: "分镜表", desc: "广告分镜", category: "video", mode: "docs", builtin: true, prompt: "为「{{广告创意}}」制作一份分镜表：镜号、景别、画面描述、台词/旁白、时长、备注，共 8-12 个镜头" },

  // ============ 效率工具 ============
  { id: "p-translate", label: "专业翻译", desc: "中英互译", category: "productivity", mode: "chat", builtin: true, prompt: "把下面内容翻译成{{目标语言}}，保持专业术语准确、语气自然，符合商务/技术语境，并附关键表达说明：{{内容}}" },
  { id: "p-rag", label: "概念解释", desc: "快速搞懂", category: "productivity", mode: "chat", builtin: true, prompt: "解释什么是「{{概念/术语}}」：一句话定义、工作原理、一个类比、常见用途与参考资料方向" },
  { id: "p-code", label: "代码生成/解释", desc: "编程助手", category: "productivity", mode: "chat", builtin: true, prompt: "用{{编程语言}}实现：{{需求描述}}。要求代码可运行、有注释、含简单用例；并解释关键逻辑" },
  { id: "p-excel", label: "Excel/公式助手", desc: "表格公式", category: "productivity", mode: "chat", builtin: true, prompt: "我需要在 Excel 中实现：{{需求，如根据条件统计并去重}}。请给出公式/步骤、示例数据和常见错误提示" },
  { id: "p-mindmap", label: "思维导图大纲", desc: "结构化梳理", category: "productivity", mode: "docs", builtin: true, prompt: "把「{{主题}}」梳理成思维导图大纲（多级缩进列表）：中心主题、主要分支、子要点，逻辑清晰可直接转 XMind" },
  { id: "p-todo", label: "任务拆解", desc: "目标落地", category: "productivity", mode: "chat", builtin: true, prompt: "把目标「{{目标}}」拆解为可执行的任务清单：按阶段分组，每个任务标注预计耗时和优先级，指出关键路径" },
  { id: "p-prompt", label: "提示词优化器", desc: "改写 prompt", category: "productivity", mode: "chat", builtin: true, prompt: "把下面这个需求改写成结构清晰、效果更好的 AI 提示词（含角色、任务、约束、输出格式）：{{粗糙的需求}}" },
];
