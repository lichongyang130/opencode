/**
 * /chat「X · 示例模板」卡片 → 真实预览图映射。
 *
 * 键 = 模板卡所属集合（ChatPanel SKILL_TEMPLATES 的 key，ppt 与 幻灯片共用
 * slides 集合）；值 = 卡标题 → 图片路径。未映射的卡先用技能色渐变占位，
 * 后续按轮补图（图片生成每轮限量）。
 */

export const TPL_ART: Record<string, Record<string, string>> = {
  // 文档：复用画布栏目真实图（同主题成品文档）
  docs: {
    生成文档: "/canvas-art/docs-2.jpg",
    "PRD 文档": "/canvas-art/docs-4.jpg",
    营销方案: "/canvas-art/docs-3.jpg",
  },
  slides: {
    "制作 PPT": "/canvas-art/ppt-1.jpg",
    项目汇报: "/canvas-art/ppt-2.jpg",
    融资路演: "/canvas-art/ppt-3.jpg",
    培训课件: "/canvas-art/ppt-4.jpg",
    数据复盘: "/canvas-art/slides-1.jpg",
    方案汇报: "/canvas-art/slides-1.jpg",
    行业趋势: "/canvas-art/slides-3.jpg",
    年度回顾: "/canvas-art/slides-4.jpg",
  },
  // 原型：真实线框/界面图
  prototype: {
    登录注册流程: "/canvas-art/prototype-1.jpg",
    电商商品页: "/canvas-art/prototype-2.jpg",
  },
  // 图片：真实 AI 成品（public/cases + canvas-art，语义匹配卡标题）
  image: {
    生成图片: "/cases/d-corgi-2.jpg",
    产品海报: "/cases/m-brand-poster-2.jpg",
    角色概念: "/cases/d-cyber-2.jpg",
    "电商 Banner": "/cases/ec-product-img-2.jpg",
    水彩插画: "/cases/d-watercolor-2.jpg",
    杂志封面: "/cases/d-cover-2.jpg",
    头像定制: "/cases/d-avatar-2.jpg",
    赛博城市: "/canvas-art/image-3.jpg",
    家居效果图: "/canvas-art/image-4.jpg",
  },
  // 视频（分镜/脚本）
  video: {
    视频脚本: "/canvas-art/video-1.jpg",
    产品宣传: "/canvas-art/video-3.jpg",
    口播干货: "/canvas-art/video-2.jpg",
    科普动画: "/canvas-art/video-4.jpg",
  },
  // 深度研究：真实研究报告
  research: {
    深度研究: "/canvas-art/research-1.jpg",
    出海机会: "/canvas-art/research-2.jpg",
    消费者洞察: "/canvas-art/research-3.jpg",
    新能源: "/canvas-art/research-4.jpg",
  },
  // 网站复刻
  website: {
    落地页复刻: "/canvas-art/website-2.jpg",
    企业官网: "/canvas-art/website-1.jpg",
    个人作品集: "/canvas-art/website-3.jpg",
    电商首页: "/canvas-art/website-4.jpg",
  },
  // 音频（配音/片头/提示音/冥想）
  audio: {
    语音配音: "/canvas-art/audio-1.jpg",
    播客片头: "/canvas-art/audio-2.jpg",
    语音提示音: "/canvas-art/audio-3.jpg",
    冥想引导: "/canvas-art/audio-4.jpg",
  },
  // HyperFrames（/chat 内该技能卡以灵感/教程类为主，能对应的先映射）
  hyperframes: {
    教程系列: "/canvas-art/hyperframes-4.jpg",
  },
};
