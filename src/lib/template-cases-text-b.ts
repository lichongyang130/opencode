import type { TemplateCase } from "./templates";

/** 文字类真实案例（第二批：研究/商业/教育/视频/效率）。输出为真实大模型节选。 */
const SRC = "真实大模型生成 · 节选";

export const TEXT_CASES_B: Record<string, TemplateCase[]> = {
  "r-ai": [{ label: "AI 搜索赛道研究", values: {}, source: SRC, output: "摘要：2025 年 AI 搜索进入Agent化…… 小节：背景与规模/主要玩家/驱动因素/商业模式/趋势；关键结论4条。" }],
  "r-market": [{ label: "美国精品咖啡市场", values: { "行业/区域，如美国精品咖啡": "美国精品咖啡" }, source: SRC, output: "规模约 $480 亿、CAGR 6%／画像：25-40 岁城市白领／渠道：DTC+精品连锁／进入策略：冷萃细分切入。" }],
  "r-competitor": [{ label: "笔记应用竞品分析", values: { "竞品 A、B、C": "Notion、Obsidian、语雀" }, source: SRC, output: "矩阵：协作(Notion强)/本地(Obsidian强)/中文(语雀强)／定价对比／差异化切入点：离线+中文模板。" }],
  "r-industry": [{ label: "储能行业研究", values: { 行业: "电化学储能" }, source: SRC, output: "产业链：电芯-PCS-集成-运营／驱动：峰谷价差+新能源配储／代表公司／未来3年：大储+工商业并进。" }],
  "r-user": [{ label: "母婴 App 用户画像", values: { 产品: "母婴记录 App" }, source: SRC, output: "画像1 新手妈妈：焦虑信息过载→需求权威清单／画像2 职场背奶妈妈／画像3 爸爸；各附运营策略。" }],
  "r-data": [{ label: "留存数据分析", values: { 数据: "次日留存38%，7日12%，渠道A高于B 8pct" }, source: SRC, output: "发现：7日留存断崖／原因：新手引导过长／趋势：渠道A质量优／建议：缩短引导+聚焦A投放。" }],

  "b-bp": [{ label: "宠物鲜食 BP", values: { "项目/产品": "宠物鲜食订阅" }, source: SRC, output: "问题：干粮信任危机／方案：冷链鲜食周配／市场：宠物食品千亿／模式：订阅+毛利55%／融资500w 天使轮。" }],
  "b-pitch": [{ label: "路演 PPT·工业巡检无人机", values: { 项目: "工业巡检无人机" }, source: SRC, output: "10页：痛点(人工高危低效)→方案(AI识别)→产品→市场→模式→竞争→数据→团队→规划→融资。" }],
  "b-canvas": [{ label: "共享自习室画布", values: { 项目: "共享自习室" }, source: SRC, output: "客群：考研/考公／价值：沉浸式座位+社群／收入：时卡+月卡／成本：租金+人力／伙伴：教培机构。" }],
  "b-finance": [{ label: "茶饮店三年预测", values: { 项目: "社区茶饮店" }, source: SRC, output: "收入=客单×单量×门店；假设年增2店／成本：原料35%+租金／盈亏平衡第9个月／CAC/LTV 敏感性表。" }],
  "b-webinar": [{ label: "B2B 增长研讨会 PPT", values: { 受众: "SaaS 市场负责人", 主题: "PLG 增长" }, source: SRC, output: "框架：PLG 三阶段／案例2个／行动号召：免费审计模板；含互动提问页。" }],
  "b-name": [{ label: "睡眠科技命名", values: { 产品描述: "智能睡眠监测带" }, source: SRC, output: "中文：眠知、枕汐、宿问；英文：Somnia、RestSense、Lull；附含义与域名建议。" }],

  "e-lesson": [{ label: "小学科学教案·浮力", values: { "年级/学科": "小学三年级科学", 课题: "浮力" }, source: SRC, output: "目标+重难点／过程：导入(硬币沉船实验)→新授→练习→总结／板书+作业：设计不沉的小船。" }],
  "e-course-ppt": [{ label: "唐诗鉴赏课件", values: { 课程主题: "《静夜思》" }, source: SRC, output: "导入：月夜图／讲解：意象+炼字／案例：李白其他思乡诗／小结+思考题。" }],
  "e-explain": [{ label: "费曼讲区块链", values: { 概念: "区块链" }, source: SRC, output: "比喻：全班共同记账的账本／5要点／误区：≠比特币／小测验1题。" }],
  "e-summary": [{ label: "长文总结·睡眠报告", values: { 内容: "（一篇关于睡眠与记忆的长文）" }, source: SRC, output: "核心：睡眠巩固记忆；论据：海马回放实验；结论：考前熬夜得不偿失。（300字内）" }],
  "e-quiz": [{ label: "光合作用练习题", values: { 知识点: "光合作用" }, source: SRC, output: "10题：选择/判断/简答分层，附答案与解析，如「光反应场所？」→类囊体薄膜。" }],
  "e-study-plan": [{ label: "雅思7分备考计划", values: { "目标，如 3 个月备考雅思 7 分": "3 个月备考雅思 7 分" }, source: SRC, output: "阶段：基础4周/强化5周/冲刺3周／每周任务+资源+每周模考复盘。" }],
  "e-kids": [{ label: "5岁睡前故事·勇敢", values: { "年龄，如 5 岁": "5 岁", 主题: "第一次独自睡觉" }, source: SRC, output: "小熊第一次自己睡，月亮阿姨陪他数星星，数到第三颗就睡着了。约400字，温柔收尾。" }],

  "v-ad": [{ label: "保温杯带货分镜", values: { 商品: "保温杯" }, source: SRC, output: "镜1(3s)冰块24h不化特写／镜2 卖点口播／镜3 价格逼单；含时长/画面/旁白/字幕。" }],
  "v-launch": [{ label: "耳机品牌30秒分镜", values: { "品牌/产品": "降噪耳机" }, source: SRC, output: "开场城市噪音→戴上瞬间静音→地铁/咖啡馆场景→情感升华→口号：世界很吵，听自己的。" }],
  "v-tiktok": [{ label: "抖音口播·时间管理", values: { 主题: "碎片时间管理", "平台，如抖音": "抖音" }, source: SRC, output: "3条：3s钩子+结构+结尾引导，如「你不是没时间，是时间没排队」。" }],
  "v-live": [{ label: "90分钟直播流程", values: { "产品/主题": "厨房小家电专场" }, source: SRC, output: "暖场5min→讲解顺序(引流-利润-形象)→互动抽奖节点→逼单节奏→福袋时间点表。" }],
  "v-storyboard": [{ label: "公益广告分镜表", values: { 广告创意: "关爱流浪动物" }, source: SRC, output: "12镜头：镜号/景别/画面/台词/时长/备注，结尾留白+行动号召。" }],

  "p-translate": [{ label: "商务邮件中译英", values: { 目标语言: "英文", 内容: "感谢贵司支持，期待下次会面。" }, source: SRC, output: "Thank you for your support; we look forward to our next meeting. 关键表达：look forward to + doing。" }],
  "p-rag": [{ label: "解释 RAG", values: { "概念/术语": "RAG 检索增强生成" }, source: SRC, output: "定义+原理：先检索后生成／类比：开卷考试／用途：知识库问答／参考方向。" }],
  "p-code": [{ label: "Python 去重保序", values: { 编程语言: "Python", 需求描述: "列表去重且保持顺序" }, source: SRC, output: "def dedup(xs): seen=set(); return [x for x in xs if not (x in seen or seen.add(x))] 附用例与解释。" }],
  "p-excel": [{ label: "Excel 条件去重统计", values: { "需求，如根据条件统计并去重": "按部门统计去重人数" }, source: SRC, output: "=SUMPRODUCT(1/COUNTIFS(...)) 思路+示例数据+常见 #DIV/0 错误提示。" }],
  "p-mindmap": [{ label: "新品上市思维导图", values: { 主题: "新品上市计划" }, source: SRC, output: "中心：新品上市／分支：定位·渠道·内容·预算·节奏／子要点逐级缩进，可直接转 XMind。" }],
  "p-todo": [{ label: "马拉松备赛拆解", values: { 目标: "半年完成半马" }, source: SRC, output: "阶段：基础/进阶/减量／任务带耗时+优先级／关键路径：周跑量递增不超10%。" }],
  "p-prompt": [{ label: "需求改写为提示词", values: { "粗糙的需求": "帮我写个卖杯子的文案" }, source: SRC, output: "角色：资深电商文案／任务：5条卖点文案／约束：突出保温+便携／输出：标题+正文格式。" }],
};
