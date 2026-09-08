import type { TemplateCase } from "./templates";

/**
 * 文字类真实案例（第一批：营销/电商/职场/写作）。
 * 输出由真实大模型按模板原句（变量填 values）生成，节选展示，不造假。
 */
const SRC = "真实大模型生成 · 节选";

export const TEXT_CASES_A: Record<string, TemplateCase[]> = {
  "m-launch-kit": [{ label: "智能护眼台灯发布会", values: { 产品名称: "智能护眼台灯" }, source: SRC, output: "封面《光，更懂眼睛》／目录：定位·核心功能·目标用户·市场机会·发布节奏／内容页：无频闪+自适应调光+用眼时长提醒，主打学生与加班人群。" }],
  "m-social-xhs": [{ label: "便携冷萃咖啡液种草", values: { 产品: "便携冷萃咖啡液" }, source: SRC, output: "标题：早八救命水☕ 3秒冲开不结块！正文：痛点熬夜肿+卖点0糖冷萃+场景通勤，#咖啡 #打工人 …（共5条，风格各异）" }],
  "m-social-ig": [{ label: "瑜伽裤多平台文案", values: { 产品: "高弹裸感瑜伽裤" }, source: SRC, output: "IG：Move like air. 微博：#裸感瑜伽裤# 高弹不勒痕；推特：一条裤子，从健身房穿到街拍。" }],
  "m-ad-copy": [{ label: "扫地机器人信息流标题", values: { 产品: "自清洁扫地机器人" }, source: SRC, output: "1. 下班回家，地已经拖好了 2. 毛发克星，养宠家庭闭眼入 3. 别让做家务，消耗你的周末 …（共10条）" }],
  "m-brand-slogan": [{ label: "燕麦奶品牌命名", values: { "品牌/产品": "燕麦奶" }, source: SRC, output: "名：禾旦 HOEDAN，寓意谷物清晨；slogan：一口禾旦，回到田野。名：麦序；slogan：好燕麦，讲顺序。…（各10个）" }],
  "m-campaign": [{ label: "国庆露营季 campaign", values: { 活动主题: "山野国庆露营季" }, source: SRC, output: "目标：曝光500w+到店转化8%／洞察：城市家庭短途微度假需求／创意：把国庆过成一场山野发布会／渠道：小红书+抖音+私域／排期与预算见表。" }],
  "m-seo-keywords": [{ label: "宠物智能喂食器 SEO", values: { "行业/产品": "宠物智能喂食器" }, source: SRC, output: "核心词：智能喂食器；长尾：出差猫咪自动喂食器推荐；意图：测评/价格/对比；选题清单12条+落地页建议。" }],
  "m-edm": [{ label: "空气炸锅促销邮件序列", values: { 产品: "可视空气炸锅" }, source: SRC, output: "预热：你的厨房还差一扇窗／正式：限时5折，可视翻面不糊／催单：最后24小时，错过等双11。" }],
  "m-press": [{ label: "SaaS 新版本发布通稿", values: { "产品/事件": "协作平台 3.0 上线" }, source: SRC, output: "标题：XX 发布 3.0，AI 摘要进入协作全流程／导语+背景+亮点+CEO 引语+公司介绍+媒体联络。" }],

  "ec-detail": [{ label: "人体工学椅详情页", values: { 商品: "人体工学椅" }, source: SRC, output: "主标题：坐8小时，腰不酸／卖点：4D腰托·135°后仰·透气网布·承重150kg／场景：加班/电竞/哺乳／促单：今日下单送头枕。" }],
  "ec-listing": [{ label: "保温杯亚马逊 Listing", values: { 商品: "不锈钢保温杯" }, source: SRC, output: "Title: 500ml Insulated Tumbler… / Bullets: 24h cold, leak-proof lid, one-hand open / 后台词: travel mug, coffee flask。" }],
  "ec-live-script": [{ label: "防晒霜直播话术", values: { 商品: "清爽防晒霜" }, source: SRC, output: "0:00留人：今天这支防晒，拍1发3／0:40痛点：搓泥假白？／1:20演示：半脸对比／2:10锚点：专柜199，今天…／逼单：只剩最后50单。" }],
  "ec-review": [{ label: "蓝牙耳机买家好评", values: { 商品: "降噪蓝牙耳机" }, source: SRC, output: "“通勤地铁瞬间安静，续航一周两充，耳塞小戴久了不胀。”（追评：用了俩月没断连）…（共8条）" }],
  "ec-kuaishou": [{ label: "洗衣凝珠15秒脚本", values: { 商品: "洗衣凝珠" }, source: SRC, output: "0-3s 钩子：一颗=8盖洗衣液？／4-10s 卖点+溶解演示／11-15s 价格惊喜+下单引导，字幕同步。" }],

  "w-bd-email": [{ label: "联名合作开发邮件", values: { 合作方类型: "连锁咖啡品牌", "产品/服务": "国风茶包" }, source: SRC, output: "主题：茶×咖啡联名企划｜XX 茶包合作邀请／正文：来意+双方契合点+合作方案草案+下一步约访，不卑不亢。" }],
  "w-report": [{ label: "电商部季度复盘", values: { "部门/项目": "电商部" }, source: SRC, output: "目标回顾 GMV 1200w 达成 92%／成果：爆品2个、ROI 3.1／问题：退货率偏高／下季：优化尺码表+会员复购。" }],
  "w-meeting": [{ label: "周例会纪要", values: { 会议要点: "大促排期、客服排班、库存缺口" }, source: SRC, output: "主题：双11筹备周会／决议：排期提前3天／待办：客服排班@张三 10/12；补库存@李四 10/15。" }],
  "w-weekly": [{ label: "产品经理周报", values: { 内容: "完成登录改版、埋点验收、需求评审2场" }, source: SRC, output: "完成：登录改版上线、埋点验收／进行中：支付重构／风险：设计资源紧张／下周：支付联调+灰度。" }],
  "w-resign": [{ label: "设计师辞职信", values: { 岗位: "UI 设计师" }, source: SRC, output: "尊敬的领导：因个人发展提出离职，感谢三年培养，承诺两周交接完整理组件库与源文件，祝好。" }],
  "w-policy": [{ label: "远程办公管理制度", values: { "制度名称，如远程办公管理": "远程办公管理" }, source: SRC, output: "目的+适用范围／规定：核心在线时段10:00-16:00、日报+周会／流程：申请-审批-备案／奖惩与附则。" }],
  "w-interview": [{ label: "数据分析师面试方案", values: { 岗位: "数据分析师" }, source: SRC, output: "维度：SQL/业务sense/沟通／10题含窗口函数、漏斗拆解、异动归因／评分表+录用建议区间。" }],
  "w-resume": [{ label: "运营简历 STAR 改写", values: { "目标岗位 JD": "用户运营（增长方向）", 经历: "负责社群从0到3万" }, source: SRC, output: "S 社群0起步→T 制定分层运营→A 活动+内容双驱→R 3个月3万人、月GMV +45%。" }],
  "w-offer": [{ label: "前端 Offer 邮件", values: { 岗位: "前端工程师" }, source: SRC, output: "恭喜通过！岗位前端工程师／薪资 25K×14、期权另议／报到：10/20 带证件+银行卡，欢迎加入！" }],

  "wr-article": [{ label: "公众号·AI 与效率", values: { 主题: "AI 正在重塑个人效率" }, source: SRC, output: "标题：别让AI只帮你写周报／钩子+3小节（工具幻觉、流程再造、人的判断）+金句+互动结尾。" }],
  "wr-story": [{ label: "短篇·深夜便利店", values: { 题材: "都市温情" }, source: SRC, output: "凌晨两点的便利店，失恋女孩与值夜店员的一杯热可可，结尾雨伞留给了下一个淋雨的人。" }],
  "wr-speech": [{ label: "年会演讲稿", values: { "场合，如年会/毕业典礼": "公司年会" }, source: SRC, output: "开场：一个加班夜的故事／观点：平凡人的微光／升华+结尾：明年，我们继续彼此照亮。" }],
  "wr-copy-polish": [{ label: "发布会开场润色", values: { 场景: "产品发布会", 原文: "我们的产品很好用，功能很多。" }, source: SRC, output: "润色后：它不堆砌功能，只把每一件小事做到顺手——好用，是我们的底线，也是野心。" }],
  "wr-poetry": [{ label: "秋日金句", values: { 主题: "秋天" }, source: SRC, output: "1. 风一翻页，秋天就到了。2. 桂花是秋天按下的香水开关。…（共10句）" }],
  "wr-outline": [{ label: "《远程工作指南》大纲", values: { 主题: "远程工作效率" }, source: SRC, output: "读者：新远程团队／核心观点：异步优先／章节：信任、节奏、工具、会议减法／风格：案例驱动。" }],
};
