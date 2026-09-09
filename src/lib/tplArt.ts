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
    制作PPT: "/canvas-art/ppt-1.jpg",
    项目汇报: "/canvas-art/ppt-2.jpg",
    融资路演: "/canvas-art/ppt-3.jpg",
    培训课件: "/canvas-art/ppt-4.jpg",
  },
  // 原型：真实线框/界面图
  prototype: {
    登录注册流程: "/canvas-art/prototype-1.jpg",
    电商商品页: "/canvas-art/prototype-2.jpg",
  },
  // 图片：仓库真实 AI 生成成品（public/cases，语义匹配卡标题）
  image: {
    生成图片: "/cases/d-corgi-2.jpg",
    产品海报: "/cases/m-brand-poster-2.jpg",
    角色概念: "/cases/d-cyber-2.jpg",
    电商Banner: "/cases/ec-product-img-2.jpg",
    水彩插画: "/cases/d-watercolor-2.jpg",
    杂志封面: "/cases/d-cover-2.jpg",
    头像定制: "/cases/d-avatar-2.jpg",
  },
};
