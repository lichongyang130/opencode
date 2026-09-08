import type { TemplateCase } from "./templates";

/** 文字类真实案例（第一批补充：每模板第 2 例，不同参数）。输出为真实大模型节选。 */
const SRC = "真实大模型生成 · 节选";

export const TEXT_CASES_A2: Record<string, TemplateCase[]> = {
  "m-launch-kit": [{ label: "无线耳机新品发布", values: { 产品名称: "无线降噪耳机 Air" }, source: SRC, output: "封面《静，是一种奢侈》／结构：痛点(通勤噪音)→技术(自适应降噪)→体验(30h续航)→价格锚点→发布。" }],
  "m-social-xhs": [{ label: "空气炸锅食谱种草", values: { 产品: "可视空气炸锅" }, source: SRC, output: "标题：免油也能脆！空气炸锅5道懒人餐 正文：痛点外卖油腻+卖点可视翻面+3步做法，#空气炸锅 #懒人食谱 …（共5条）" }],
  "m-social-ig": [{ label: "香薰蜡烛多平台文案", values: { 产品: "大豆香薰蜡烛" }, source: SRC, output: "IG：Light the calm. 微博：#今晚的味道是雪松#；推特：一支蜡烛，把房间调成度假模式。" }],
  "m-ad-copy": [{ label: "儿童学习桌标题", values: { 产品: "可升降儿童学习桌" }, source: SRC, output: "1. 陪孩子长高的桌子 2. 坐姿对了，近视晚了 3. 从1米2用到1米8 …（共10条）" }],
  "m-brand-slogan": [{ label: "精品咖啡命名", values: { "品牌/产品": "精品挂耳咖啡" }, source: SRC, output: "名：山序 SHANXU，寓意产地风土；slogan：一杯山序，喝到海拔。名：拾光咖啡；slogan：把清晨，慢慢泡开。…（各10个）" }],
  "m-campaign": [{ label: "618 会员日 campaign", values: { 活动主题: "618 会员宠粉日" }, source: SRC, output: "目标：会员复购+30%／洞察：老客缺专属感／创意：会员专属盲盒／渠道：私域+短信+App Push／排期与预算表。" }],
  "m-seo-keywords": [{ label: "露营装备 SEO", values: { "行业/产品": "户外露营装备" }, source: SRC, output: "核心词：露营装备；长尾：新手露营装备清单一站式；意图：清单/测评/性价比；选题12条+聚合页建议。" }],
  "m-edm": [{ label: "会员续费提醒邮件序列", values: { 产品: "在线课程会员" }, source: SRC, output: "预热：你的学习进度还差2门／正式：续费立减+专属权益／催单：权益今晚到期，别断更。" }],
  "m-press": [{ label: "融资到账通稿", values: { "产品/事件": "完成 A 轮融资" }, source: SRC, output: "标题：XX 完成 A 轮融资，加速产能扩张／导语+资金用途+投资方观点+公司简介+联系方式。" }],

  "ec-detail": [{ label: "加湿器详情页", values: { 商品: "无雾加湿器" }, source: SRC, output: "主标题：加湿不湿桌面／卖点：无雾冷蒸发·静音·5L大水箱·抑菌／场景：卧室/办公／促单：赠滤芯。" }],
  "ec-listing": [{ label: "瑜伽垫亚马逊 Listing", values: { 商品: "防滑瑜伽垫" }, source: SRC, output: "Title: Non-Slip Yoga Mat 6mm… / Bullets: eco TPE, alignment lines, carry strap / 后台词: exercise mat, pilates。" }],
  "ec-live-script": [{ label: "坚果礼盒直播话术", values: { 商品: "每日坚果礼盒" }, source: SRC, output: "0:00留人：拍1发2盒／0:40痛点：办公室嘴馋／1:20演示：独立小包装／2:10锚点：超市价…／逼单：库存告急。" }],
  "ec-review": [{ label: "电动牙刷买家好评", values: { 商品: "声波电动牙刷" }, source: SRC, output: "“震感细腻不麻牙，续航两周，旅行充电方便。”（追评：用了三个月刷头没变形）…（共8条）" }],
  "ec-kuaishou": [{ label: "保温饭盒15秒脚本", values: { 商品: "焖烧保温饭盒" }, source: SRC, output: "0-3s 钩子：早上装晚上还热？／4-10s 6小时保温演示／11-15s 价格+下单，字幕同步。" }],

  "w-bd-email": [{ label: "渠道代理开发邮件", values: { 合作方类型: "区域经销商", "产品/服务": "智能门锁" }, source: SRC, output: "主题：智能门锁区域代理合作｜XX 品牌洽谈／正文：品牌实力+区域政策+返点方案+约见。" }],
  "w-report": [{ label: "市场部半年复盘", values: { "部门/项目": "市场部" }, source: SRC, output: "回顾：获客成本降18%／成果：品牌搜索+40%／问题：转化漏斗中段流失／下半年：内容+私域承接。" }],
  "w-meeting": [{ label: "项目启动会纪要", values: { 会议要点: "分工、里程碑、风险" }, source: SRC, output: "主题：X 项目启动／决议：两周里程碑／待办：技术方案@王五 周一；预算@赵六 周三。" }],
  "w-weekly": [{ label: "设计师周报", values: { 内容: "完成首页改版、组件库整理、走查2次" }, source: SRC, output: "完成：首页改版交付／进行中：设计规范／风险：需求频繁变更／下周：组件库评审。" }],
  "w-resign": [{ label: "程序员辞职信", values: { 岗位: "后端工程师" }, source: SRC, output: "尊敬的领导：因个人规划提出离职，感谢团队，承诺交接文档与代码，祝项目顺利。" }],
  "w-policy": [{ label: "报销管理制度", values: { "制度名称，如远程办公管理": "差旅与费用报销管理" }, source: SRC, output: "目的+范围／标准：住宿/交通限额／流程：申请-审批-贴票-打款／时限与违规处理。" }],
  "w-interview": [{ label: "产品经理面试方案", values: { 岗位: "产品经理" }, source: SRC, output: "维度：需求洞察/逻辑/协作／10题含竞品拆解、优先级排序、跨部门冲突／评分表+建议。" }],
  "w-resume": [{ label: "销售简历 STAR 改写", values: { "目标岗位 JD": "大客户销售", 经历: "负责华东区，年销1200万" }, source: SRC, output: "S 华东空白市场→T 制定KA策略→A 建客户关系+方案销售→R 年销1200万、回款率98%。" }],
  "w-offer": [{ label: "运营 Offer 邮件", values: { 岗位: "内容运营" }, source: SRC, output: "恭喜！岗位内容运营／薪资 15K×13+绩效／报到：11/1 带证件，期待你加入！" }],

  "wr-article": [{ label: "公众号·副业思考", values: { 主题: "普通人如何开启副业" }, source: SRC, output: "标题：副业不是第二份工，是第二套系统／钩子+3小节(选赛道、最小启动、复利)+金句+互动。" }],
  "wr-story": [{ label: "短篇·老照相馆", values: { 题材: "怀旧温情" }, source: SRC, output: "即将拆迁的老照相馆，最后一位客人带来五十年前的底片，师傅冲洗出跨越半生的全家福。" }],
  "wr-speech": [{ label: "毕业典礼演讲", values: { "场合，如年会/毕业典礼": "大学毕业典礼" }, source: SRC, output: "开场：一张四年前的照片／观点：选择比努力更需要勇气／升华+结尾：愿你们成为想成为的人。" }],
  "wr-copy-polish": [{ label: "招聘文案润色", values: { 场景: "招聘 JD", 原文: "我们公司待遇好，团队年轻。" }, source: SRC, output: "润色后：在这里，年轻的不是年龄，是敢把想法做上线的底气；有竞争力的回报，只给敢扛事的人。" }],
  "wr-poetry": [{ label: "城市夜晚金句", values: { 主题: "城市夜晚" }, source: SRC, output: "1. 霓虹是城市没说完的话。2. 末班车载着一车疲惫的星星。…（共10句）" }],
  "wr-outline": [{ label: "《个人品牌》大纲", values: { 主题: "打造个人品牌" }, source: SRC, output: "读者：职场人／核心：从专业到影响力／章节：定位、内容、渠道、变现／风格：案例+清单。" }],
};
