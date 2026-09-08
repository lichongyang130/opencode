/**
 * 能力体系：左侧能力轨 / 输入舱能力区共用的分类与子能力定义。
 */
import type { WorkspaceMode } from "@/lib/store/chat";

export interface SubCapability {
  id: string;
  label: string;
  emoji: string;
  mode: WorkspaceMode;
}

export interface CatDef {
  id: string;
  label: string;
  emoji: string;
  items: SubCapability[];
}

export const CAPABILITIES: CatDef[] = [
  {
    id: "brand",
    label: "品牌与传播",
    emoji: "🌐",
    items: [
      { id: "brand-website", label: "产品官网", emoji: "🌐", mode: "docs" },
      { id: "brand-landing", label: "营销落地页", emoji: "", mode: "docs" },
      { id: "brand-mall", label: "品牌商城", emoji: "🛒", mode: "docs" },
      { id: "brand-visual", label: "品牌主视觉", emoji: "", mode: "image" },
      { id: "brand-poster", label: "活动海报", emoji: "🪧", mode: "image" },
      { id: "brand-launch", label: "产品发布会", emoji: "🎤", mode: "slides" },
    ],
  },
  {
    id: "content",
    label: "内容与视频",
    emoji: "",
    items: [
      { id: "content-concept", label: "产品概念图", emoji: "💡", mode: "image" },
      { id: "content-promo", label: "产品宣传片", emoji: "🎬", mode: "video" },
      { id: "content-short", label: "社交短视频", emoji: "", mode: "video" },
      { id: "content-tutorial", label: "功能讲解", emoji: "🎓", mode: "video" },
      { id: "content-3d", label: "3D 产品展示", emoji: "🧊", mode: "image" },
      { id: "content-hall", label: "3D 虚拟展厅", emoji: "🏛️", mode: "image" },
    ],
  },
  {
    id: "product",
    label: "产品与体验",
    emoji: "📱",
    items: [
      { id: "product-flow", label: "用户流程图", emoji: "🗺️", mode: "docs" },
      { id: "product-wire", label: "低保真原型", emoji: "️", mode: "docs" },
      { id: "product-app", label: "移动应用 MVP", emoji: "📲", mode: "docs" },
      { id: "product-companion", label: "设备伴侣", emoji: "🤖", mode: "docs" },
      { id: "product-web", label: "Web 应用", emoji: "💻", mode: "docs" },
      { id: "product-ext", label: "浏览器扩展", emoji: "🧩", mode: "docs" },
    ],
  },
  {
    id: "data",
    label: "数据与运营",
    emoji: "📊",
    items: [
      { id: "data-ops", label: "运营看板", emoji: "📈", mode: "docs" },
      { id: "data-cockpit", label: "管理驾驶舱", emoji: "🛰️", mode: "docs" },
      { id: "data-monitor", label: "系统监控台", emoji: "🔭", mode: "docs" },
      { id: "data-agent", label: "AI Agent 工作流", emoji: "🕸️", mode: "docs" },
    ],
  },
  {
    id: "consult",
    label: "咨询与策划",
    emoji: "💼",
    items: [
      { id: "consult-pitch", label: "融资路演", emoji: "💼", mode: "slides" },
      { id: "consult-strategy", label: "战略方案", emoji: "♟️", mode: "docs" },
      { id: "consult-research", label: "研究报告", emoji: "🔬", mode: "research" },
      { id: "consult-prd", label: "产品需求文档", emoji: "📐", mode: "docs" },
      { id: "consult-training", label: "培训课件", emoji: "", mode: "slides" },
    ],
  },
];
