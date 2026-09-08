import type { TemplateCase } from "./templates";

/** 文字类真实案例（第二批补充：每模板第 2 例）。输出为真实大模型节选。 */
const SRC = "真实大模型生成 · 节选";

export const TEXT_CASES_B2: Record<string, TemplateCase[]> = {
  "r-ai": [{ label: "AI 编程助手研究", values: {}, source: SRC, output: "摘要：AI 编程助手渗透率快速上升…… 小节：格局/玩家/能力边界/商业模式/趋势；关键结论4条。" }],
  "r-market": [{ label: "东南亚茶饮市场", values: { "行业/区域，如美国精品咖啡": "东南亚新式茶饮" }, source: SRC, output: "增长快、年轻化／画像：18-30 都市青年／渠道：街边店+外卖／进入策略：本地化口味+加盟。" }],
  "r-competitor": [{ label: "在线文档竞品分析", values: { "竞品 A、B、C": "腾讯文档、飞书文档、石墨" }, source: SRC, output: "矩阵：协作(飞书强)/生态(腾讯强)/轻量(石墨强)／定价／切入点：垂直行业模板。" }],
  "r-industry": [{ label: "预制菜行业研究", values: { 行业: "预制菜" }, source: SRC, output: "产业链：原料-加工-冷链-渠道／驱动：餐饮降本+家庭便捷／代表企业／趋势：B端稳、C端待教育。" }],
  "r-user": [{ label: "健身 App 用户画像", values: { 产品: "居家健身 App" }, source: SRC, output: "画像1 减脂新手：怕坚持不了→需求陪伴打卡／画像2 增肌进阶／画像3 产后恢复；各附策略。" }],
  "r-data": [{ label: "转化率诊断", values: { 数据: "加购率22%，下单率6%，支付页流失高" }, source: SRC, output: "发现：支付页流失异常／原因：支付方式少+运费突兀／建议：增支付渠道+运费前置提示。" }],

  "b-bp": [{ label: "AI 客服 BP", values: { "项目/产品": "AI 智能客服" }, source: SRC, output: "问题：人力客服成本高／方案：多轮对话+知识库／市场：企业客服千亿／模式：SaaS 订阅／融资800w。" }],
  "b-pitch": [{ label: "路演 PPT·宠物医疗", values: { 项目: "在线宠物问诊" }, source: SRC, output: "10页：痛点(看病难贵)→方案(在线问诊+送药)→模式→市场→竞争→数据→团队→融资。" }],
  "b-canvas": [{ label: "社区团购画布", values: { 项目: "社区生鲜团购" }, source: SRC, output: "客群：社区居民／价值：次日达+低价／收入：商品差价／成本：履约+团长佣金／伙伴：本地供应商。" }],
  "b-finance": [{ label: "SaaS 订阅三年预测", values: { 项目: "团队协作 SaaS" }, source: SRC, output: "收入=MRR×客户数；假设月增8%／成本：研发+获客／盈亏平衡第14月／CAC/LTV+流失敏感性。" }],
  "b-webinar": [{ label: "B2B 私域增长研讨会", values: { 受众: "消费品市场负责人", 主题: "私域增长" }, source: SRC, output: "框架：私域三步(引流-运营-转化)／案例2个／行动号召：免费诊断；含互动页。" }],
  "b-name": [{ label: "健康轻食命名", values: { 产品描述: "低卡轻食外卖" }, source: SRC, output: "中文：轻也、绿野集、素时；英文：Lightly、GreenBowl、Purely；附含义与域名建议。" }],

  "e-lesson": [{ label: "初中数学教案·一次函数", values: { "年级/学科": "初二数学", 课题: "一次函数" }, source: SRC, output: "目标+重难点／过程：情境(话费套餐)→概念→图像→练习／板书+分层作业。" }],
  "e-course-ppt": [{ label: "英语口语课件", values: { 课程主题: "点餐场景口语" }, source: SRC, output: "导入：餐厅图／讲解：常用句型／案例：对话演练／小结+角色扮演任务。" }],
  "e-explain": [{ label: "费曼讲复利", values: { 概念: "复利" }, source: SRC, output: "比喻：利滚利的雪球／5要点／误区：短期看不出／小测验1题。" }],
  "e-summary": [{ label: "长文总结·远程办公", values: { 内容: "（一篇关于远程办公效率的长文）" }, source: SRC, output: "核心：异步协作提效；论据：某公司案例；结论：远程靠制度不靠盯。（300字内）" }],
  "e-quiz": [{ label: "英语时态练习题", values: { 知识点: "现在完成时" }, source: SRC, output: "10题：选择/填空/改错分层，附答案解析，如「I ___ (live) here since 2020」→have lived。" }],
  "e-study-plan": [{ label: "考研数学复习计划", values: { "目标，如 3 个月备考雅思 7 分": "6 个月考研数学" }, source: SRC, output: "阶段：基础/强化/真题／每周任务+资料+周测；冲刺留错题复盘。" }],
  "e-kids": [{ label: "4岁睡前故事·分享", values: { "年龄，如 5 岁": "4 岁", 主题: "学会分享" }, source: SRC, output: "小兔子把最大的胡萝卜分给朋友们，发现分享让快乐变多了。约350字，温馨结尾。" }],

  "v-ad": [{ label: "面膜带货分镜", values: { 商品: "补水面膜" }, source: SRC, output: "镜1(3s)敷前敷后对比／镜2 成分口播／镜3 价格逼单；含时长/画面/旁白/字幕。" }],
  "v-launch": [{ label: "电动车品牌30秒分镜", values: { "品牌/产品": "城市电动车" }, source: SRC, output: "开场拥堵→骑行穿城→续航/智能亮点→城市夜景→口号：让通勤，重新自由。" }],
  "v-tiktok": [{ label: "抖音口播·存钱", values: { 主题: "年轻人存钱", "平台，如抖音": "抖音" }, source: SRC, output: "3条：3s钩子+结构+结尾，如「存钱不是抠，是给未来买底气」。" }],
  "v-live": [{ label: "美妆专场直播流程", values: { "产品/主题": "彩妆专场" }, source: SRC, output: "暖场→讲解顺序(引流-爆品-利润)→试色互动→抽奖节点→逼单节奏表。" }],
  "v-storyboard": [{ label: "旅游宣传分镜表", values: { 广告创意: "小城慢生活旅游" }, source: SRC, output: "12镜头：镜号/景别/画面/旁白/时长/备注，结尾留白+目的地名。" }],

  "p-translate": [{ label: "产品说明中译英", values: { 目标语言: "英文", 内容: "本产品采用食品级材质，安全无毒。" }, source: SRC, output: "This product is made of food-grade material, safe and non-toxic. 关键：food-grade。" }],
  "p-rag": [{ label: "解释 Transformer", values: { "概念/术语": "Transformer 架构" }, source: SRC, output: "定义+原理：自注意力并行处理／类比：同时看全文而非逐字／用途：大模型基座／参考方向。" }],
  "p-code": [{ label: "JS 数组扁平化", values: { 编程语言: "JavaScript", 需求描述: "多维数组扁平化" }, source: SRC, output: "const flat = a => a.reduce((r,x)=>r.concat(Array.isArray(x)?flat(x):x),[]); 或用 a.flat(Infinity)。附解释。" }],
  "p-excel": [{ label: "Excel 多条件求和", values: { "需求，如根据条件统计并去重": "按地区和月份求和" }, source: SRC, output: "=SUMIFS(金额, 地区, \"华东\", 月份, 3) 用法+示例+绝对引用提示。" }],
  "p-mindmap": [{ label: "读书笔记思维导图", values: { 主题: "《高效能人士的七个习惯》" }, source: SRC, output: "中心：七个习惯／分支：积极主动/以终为始/要事第一…／子要点逐级缩进，可转 XMind。" }],
  "p-todo": [{ label: "搬家清单拆解", values: { 目标: "两周内完成搬家" }, source: SRC, output: "阶段：整理/打包/搬运/归置／任务带耗时+优先级／关键路径：先断舍离再打包。" }],
  "p-prompt": [{ label: "需求改写为提示词", values: { "粗糙的需求": "帮我总结这篇文章" }, source: SRC, output: "角色：资深编辑／任务：提炼核心观点+3条要点+1句结论／约束：不超200字／输出：分点。" }],
};
