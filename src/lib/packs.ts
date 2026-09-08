import type { WorkspaceMode } from "@/lib/store/chat";

/**
 * 一键素材包：一个主题 → 串行产出整套素材
 * （文档/文案/PPT/配图各建一个任务，逐步出现在左栏）
 */
export interface PackStep {
  mode: WorkspaceMode;
  /** 任务标题前缀 */
  title: string;
  /** 发送给该工作台的 prompt 生成器 */
  prompt: (topic: string) => string;
}

export interface AssetPack {
  id: string;
  label: string;
  desc: string;
  emoji: string;
  steps: PackStep[];
}

export const ASSET_PACKS: AssetPack[] = [
  {
    id: "product-launch",
    label: "产品发布套件",
    desc: "发布文案 + 商业计划/产品文档 + 发布会 PPT + 宣传海报",
    emoji: "🚀",
    steps: [
      {
        mode: "docs",
        title: "产品发布总案",
        prompt: (t) =>
          `为「${t}」撰写一份产品发布总案文档，包含：产品定位与核心卖点、目标用户、发布节奏（预热/发布/长尾）、渠道清单、关键信息屋（Messaging House）与风险预案。`,
      },
      {
        mode: "chat",
        title: "社媒发布文案",
        prompt: (t) =>
          `为「${t}」写一组社媒发布文案：1 条公众号长文开头+3 个小标题、3 条微博/小红书短文（各带 5 个话题标签）、1 条朋友圈短文案。语气有感染力、突出卖点。`,
      },
      {
        mode: "slides",
        title: "发布会 PPT",
        prompt: (t) => `为「${t}」产品发布会生成一套 10 页 PPT：封面、行业背景、痛点、产品亮相、核心功能（3 页）、对比优势、客户案例、价格/发布计划、结尾号召。`,
      },
      {
        mode: "image",
        title: "宣传海报",
        prompt: (t) => `Product launch poster for ${t}, modern tech style, bold typography, hero product visual, vibrant gradient background, cinematic lighting, high detail, 16:9`,
      },
    ],
  },
  {
    id: "social-campaign",
    label: "社媒 Campaign 包",
    desc: "Campaign 策划案 + 多平台文案 + 配图",
    emoji: "📱",
    steps: [
      {
        mode: "docs",
        title: "Campaign 策划案",
        prompt: (t) =>
          `为「${t}」撰写一份社媒营销 Campaign 策划案：活动主题与 Big Idea、目标与 KPI、平台策略（小红书/抖音/微博/公众号）、内容日历（2 周）、达人投放建议、预算分配与数据复盘指标。`,
      },
      {
        mode: "chat",
        title: "多平台文案",
        prompt: (t) =>
          `为「${t}」产出一整套社媒文案：小红书种草文 2 篇（含标题、正文、标签）、抖音口播脚本 1 条（含分镜与字幕）、微博话题文案 3 条。`,
      },
      {
        mode: "image",
        title: "社媒配图",
        prompt: (t) => `Social media campaign key visual for ${t}, trendy flat illustration style, bright colors, shareable composition, Chinese social media aesthetic, square format`,
      },
    ],
  },
  {
    id: "webinar",
    label: "Webinar 直播包",
    desc: "直播策划 + 邀请函 + 演示 PPT",
    emoji: "🎥",
    steps: [
      {
        mode: "docs",
        title: "直播策划案",
        prompt: (t) =>
          `为「${t}」主题线上直播/Webinar 撰写策划案：主题与受众、议程时间表（60 分钟）、嘉宾分工、预热与邀约节奏、互动环节设计、转化路径（CTA）与复盘指标。`,
      },
      {
        mode: "chat",
        title: "邀约与宣传文案",
        prompt: (t) => `为「${t}」直播写：1 封正式邀请函邮件、1 条朋友圈邀约文案、3 条倒计时提醒文案（3 天/1 天/1 小时）。`,
      },
      {
        mode: "slides",
        title: "直播演示 PPT",
        prompt: (t) => `为「${t}」主题直播生成一套 12 页演示 PPT：开场破冰、议程、核心内容（6-8 页）、案例演示、Q&A、行动号召。`,
      },
    ],
  },
  {
    id: "brand-kit",
    label: "品牌起步包",
    desc: "品牌定位文档 + Slogan 方案 + Logo 方向图",
    emoji: "🎨",
    steps: [
      {
        mode: "docs",
        title: "品牌定位文档",
        prompt: (t) =>
          `为新品牌「${t}」撰写品牌定位文档：品牌使命与愿景、目标人群画像、品类定位、核心价值主张、品牌个性与语调（Tone of Voice）、品牌故事。`,
      },
      {
        mode: "chat",
        title: "Slogan 与命名",
        prompt: (t) => `为品牌「${t}」提供：10 个 Slogan 方案（中文为主、附英文）、5 个产品系列命名建议，并说明每个方案的传达点。`,
      },
      {
        mode: "image",
        title: "Logo 概念图",
        prompt: (t) => `Minimalist logo design concept for brand "${t}", clean geometric mark, modern, versatile, flat vector style, on white background, brand identity presentation`,
      },
    ],
  },
  {
    id: "children-book",
    label: "儿童绘本包",
    desc: "绘本故事 + 分镜脚本 + 插画",
    emoji: "📚",
    steps: [
      {
        mode: "docs",
        title: "绘本故事",
        prompt: (t) =>
          `为儿童绘本主题「${t}」写一个适合 3-6 岁儿童的睡前故事：温暖有教育意义，800 字以内，包含主角、冲突、成长与圆满结局，语言朗朗上口。`,
      },
      {
        mode: "video",
        title: "绘本分镜",
        prompt: (t) => `为儿童绘本「${t}」设计 8 个镜头的分镜脚本：每镜含画面描述、旁白文字、时长，风格统一、画面感强。`,
      },
      {
        mode: "image",
        title: "绘本插画",
        prompt: (t) => `Children picture book illustration for "${t}", cute hand-drawn watercolor style, soft pastel colors, warm storybook atmosphere, full page composition`,
      },
    ],
  },
  {
    id: "ecommerce",
    label: "电商带货包",
    desc: "详情页文案 + 直播话术 + 主图",
    emoji: "🛒",
    steps: [
      {
        mode: "docs",
        title: "详情页文案",
        prompt: (t) =>
          `为产品「${t}」撰写电商详情页文案：首屏卖点钩子、5 个核心卖点（FAB 结构）、使用场景、参数规格、常见问题 FAQ、促销与保障信息。`,
      },
      {
        mode: "chat",
        title: "直播带货话术",
        prompt: (t) => `为「${t}」写一套直播带货话术：开场留人 30 秒、产品介绍（痛点-卖点-演示）、逼单话术、互动抽奖话术、常见异议应对 5 条。`,
      },
      {
        mode: "image",
        title: "电商主图",
        prompt: (t) => `E-commerce product main image for ${t}, clean studio product photography, white background with subtle lifestyle props, promotional banner feel, high conversion style, square`,
      },
    ],
  },
];
