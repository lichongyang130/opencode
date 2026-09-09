"use client";

import { useEffect, useRef, useState } from "react";
import { useSseStream } from "@/hooks/useSseStream";
import {
  ArrowUp,
  Box,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Globe,
  ImageIcon,
  Layers,
  LayoutGrid,
  LayoutTemplate,
  Loader2,
  Mail,
  MessageSquare,
  Music,
  Pencil,
  Presentation,
  RotateCcw,
  Search,
  Square,
  Video,
  Wand2,
  Zap,
} from "lucide-react";
import { useChatStore, MODE_LABELS, type WorkspaceMode, type UIMessage } from "@/lib/store/chat";
import { Markdown } from "./Markdown";
import { PersonaPicker } from "./PersonaPicker";
import { ModelSelector, PROVIDER_NAME } from "./ModelSelector";
import { MODELS } from "@/lib/gateway/models";
import { estimateTokens } from "@/lib/gateway/credits";
import { IMAGE_MODELS } from "@/lib/gateway/image";
import { IMAGE_STYLES } from "@/lib/image/presets";
import { loadPromptHistory, type ImagePromptRecord } from "@/lib/image/history";
import { toast } from "@/lib/store/toast";
import { getOverrides } from "@/lib/settings";
import { readJSON, writeJSON, removeKey } from "@/lib/safe-storage";
import {
  SLASH_COMMANDS,
  matchSlash,
  TONE_CHIPS,
  LENGTH_CHIPS,
  AUDIENCE_CHIPS,
  type PromptChip,
} from "@/lib/slash";
import { cn } from "@/lib/utils";

const IMAGE_SIZES = [
  { id: "1024x1024", label: "方形 1:1" },
  { id: "1792x1024", label: "横版 16:9" },
  { id: "1024x1792", label: "竖版 9:16" },
];

const IMAGE_COUNTS = [
  { n: 1, label: "1 张" },
  { n: 2, label: "2 张" },
  { n: 4, label: "4 张" },
];

/** ── 首页技能体系与模板库 ───────────────────────────────
 * 顶部技能条收纳：可见 4 项 + 「更多」下拉；每技能展示 12 张模板卡
 * （每行 3 个，先显示 9 张，箭头展开隐藏 3 张）。真生成技能带 prompt，
 * 建设中技能（planned）点击提示即将上线。
 */
type TemplateCard = { title: string; desc: string; prompt?: string };
type HomeSkill = {
  key: string;
  label: string;
  icon: typeof MessageSquare;
  /** 真生成技能对应的工作模式（planned 技能无 mode） */
  mode?: WorkspaceMode;
  /** 建设中技能：卡片点击仅提示即将上线 */
  planned?: boolean;
};

const HOME_SKILLS: HomeSkill[] = [
  { key: "all", label: "全部", icon: MessageSquare },
  { key: "chat", label: "AI对话", icon: MessageSquare, mode: "chat" },
  { key: "docs", label: "文档", icon: FileText, mode: "docs" },
  { key: "ppt", label: "PPT", icon: Presentation, mode: "slides" },
  { key: "prototype", label: "原型", icon: LayoutTemplate, planned: true },
  { key: "slides", label: "幻灯片", icon: Presentation, mode: "slides" },
  { key: "image", label: "图片", icon: ImageIcon, mode: "image" },
  { key: "hyperframes", label: "HyperFrames", icon: Layers, planned: true },
  { key: "website", label: "网站复刻", icon: Globe, planned: true },
  { key: "video", label: "视频", icon: Video, mode: "video" },
  { key: "audio", label: "音频", icon: Music, planned: true },
  { key: "realtime", label: "实时产物", icon: Zap, planned: true },
  { key: "webgl", label: "WebGL", icon: Box, planned: true },
  { key: "research", label: "深度研究", icon: Search, mode: "research" },
];

/** 顶部可见技能（4 项）；其余进「更多」下拉 */
const HOME_VISIBLE_KEYS = ["all", "chat", "docs", "ppt"];

/** 各技能图标与缩略图 */
const SKILL_ICON = Object.fromEntries(HOME_SKILLS.map((x) => [x.key, x.icon])) as Record<string, typeof MessageSquare>;
const THUMB_IMG: Record<string, string> = {
  "chat": "/prompt-thumbs/thumb-email.jpg",
  "docs": "/prompt-thumbs/thumb-doc.jpg",
  "slides": "/prompt-thumbs/thumb-ppt.jpg",
  "ppt": "/prompt-thumbs/thumb-ppt.jpg",
  "image": "/prompt-thumbs/thumb-img.jpg",
  "research": "/prompt-thumbs/thumb-report.jpg",
  "video": "/prompt-thumbs/thumb-video.jpg",
};

/** 每技能的 12 个模板：真生成技能（带 prompt）/ 建设中技能（仅标题） */
const SKILL_TEMPLATES: Record<string, TemplateCard[]> = {
  "chat": [
    { title: "撰写邮件", desc: "起草清晰、有说服力的商务邮件", prompt: "帮我写一封商务合作邮件" },
    { title: "周报汇总", desc: "把零散进展整理成结构化周报", prompt: "帮我把这周的工作整理成一份周报，突出成果与风险" },
    { title: "客户回复", desc: "礼貌专业的客户来信回复", prompt: "帮我起草一封给客户的回复，语气专业友好" },
    { title: "会议纪要", desc: "把讨论要点整理成待办清单", prompt: "根据下面会议记录整理纪要：结论、负责人、时间点" },
    { title: "文案改写", desc: "让一段话更有感染力", prompt: "帮我改写这段文案，让它更生动有说服力" },
    { title: "岗位 JD", desc: "清晰有吸引力的职位描述", prompt: "为「AI 产品经理」写一份职位描述" },
    { title: "请假邮件", desc: "得体的请假申请", prompt: "帮我写一封请假邮件，理由合理、语气得体" },
    { title: "英文润色", desc: "中英互译与表达优化", prompt: "把这段话翻译成地道的商务英语并润色" },
    { title: "产品命名", desc: "有记忆点的品牌/产品名", prompt: "给我的智能水杯产品起 10 个中文名并附寓意" },
    { title: "头脑风暴", desc: "围绕一个主题发散点子", prompt: "就「办公室下午茶福利」做一轮头脑风暴，给出 10 个创意" },
    { title: "演讲稿", desc: "条理清晰的发言稿", prompt: "帮我写一篇 3 分钟的新人自我介绍演讲稿" },
    { title: "合同要点", desc: "把合同讲成人话", prompt: "用大白话解释这份合同里我需要重点关注的条款" },
  ],
  "docs": [
    { title: "生成文档", desc: "商业计划书 / 报告一键成稿", prompt: "写一份 SaaS 产品商业计划书" },
    { title: "公司介绍", desc: "企业简介与亮点提炼", prompt: "写一份 800 字公司介绍，突出技术壁垒" },
    { title: "PRD 文档", desc: "需求背景到验收标准", prompt: "为新功能「团队周报」写一份 PRD" },
    { title: "竞品分析", desc: "优劣势与差异化建议", prompt: "对比 Notion 与飞书文档，输出竞品分析" },
    { title: "SOP 手册", desc: "可执行的标准作业流程", prompt: "写一份「内容审核」标准作业流程 SOP" },
    { title: "年终总结", desc: "成果量化、规划来年", prompt: "帮我写年终总结：业绩、成长、明年计划" },
    { title: "营销方案", desc: "目标人群到落地节奏", prompt: "为新品耳机写一份营销推广方案" },
    { title: "制度手册", desc: "清晰简洁的团队制度", prompt: "制定一份远程办公管理制度手册" },
    { title: "立项提案", desc: "背景目标与资源预算", prompt: "写一份「数据中台」立项提案" },
    { title: "FAQ 文档", desc: "常见问题标准化回答", prompt: "整理产品常见问题 FAQ 二十条" },
    { title: "新闻稿", desc: "正式有新闻感的企业稿", prompt: "写一篇融资成功的企业新闻稿" },
    { title: "白皮书", desc: "行业洞察型深度长文", prompt: "写一份《2026 企业 AI 应用白皮书》框架" },
  ],
  "slides": [
    { title: "制作 PPT", desc: "输入主题生成整套幻灯片", prompt: "为产品发布会生成一套 10 页 PPT" },
    { title: "项目汇报", desc: "进度结果问题一步到位", prompt: "为季度项目汇报做一份 8 页 PPT" },
    { title: "融资路演", desc: "讲清商业模式与空间", prompt: "做一份种子轮融资路演 PPT" },
    { title: "营销提案", desc: "策略到创意的提案", prompt: "做一份品牌联名营销提案 PPT" },
    { title: "培训课件", desc: "知识要点清晰拆解", prompt: "做一套新人入职培训课件 PPT" },
    { title: "周会同步", desc: "快速对齐本周进展", prompt: "做一份 5 页周会同步 PPT" },
    { title: "竞品对比", desc: "关键维度并排呈现", prompt: "做一份我们与竞品对比的 PPT" },
    { title: "读书分享", desc: "观点提炼与启发", prompt: "为《纳瓦尔宝典》做读书分享 PPT" },
    { title: "行业趋势", desc: "数据支撑的趋势分析", prompt: "做一份 AI 行业 2026 趋势分析 PPT" },
    { title: "数据复盘", desc: "指标变化一目了然", prompt: "做一份上季度数据复盘 PPT" },
    { title: "方案汇报", desc: "需求理解到实施计划", prompt: "为客户做一份数字化改造方案 PPT" },
    { title: "年度回顾", desc: "大事记与来年展望", prompt: "做一份团队年度回顾 PPT" },
  ],
  "image": [
    { title: "生成图片", desc: "一句话生成 / 编辑图片", prompt: "一只戴宇航头盔的柯基在月球上，电影感海报" },
    { title: "产品海报", desc: "促销卖点视觉化", prompt: "为夏日冰饮做一张促销海报，明亮清爽" },
    { title: "赛博城市", desc: "霓虹与未来的街景", prompt: "赛博朋克风格雨夜城市街景，霓虹灯反射" },
    { title: "水彩插画", desc: "温柔手绘质感", prompt: "水彩风春日花园插画，柔和光线" },
    { title: "3D 渲染", desc: "产品质感展示", prompt: "白色耳机 3D 渲染，柔和影棚光" },
    { title: "角色概念", desc: "原创角色设计", prompt: "蒸汽朋克风格女机械师角色概念图" },
    { title: "电商 Banner", desc: "促销横幅画面", prompt: "618 大促科技产品 banner，简洁高质感" },
    { title: "壁纸系列", desc: "手机/桌面壁纸", prompt: "极简渐变山景手机壁纸，莫兰迪色" },
    { title: "绘本插图", desc: "童趣叙事画面", prompt: "儿童绘本插图：小狐狸第一次露营" },
    { title: "杂志封面", desc: "版式感封面图", prompt: "高端生活方式杂志封面风格，负空间构图" },
    { title: "头像定制", desc: "个性化头像", prompt: "宇航员风格的猫咪头像，Q 版" },
    { title: "家居效果图", desc: "空间氛围预览", prompt: "原木风客厅日间效果图，阳光洒入" },
  ],
  "research": [
    { title: "深度研究", desc: "竞品 / 行业调研报告", prompt: "研究 2025 年 AI 搜索赛道的竞争格局" },
    { title: "市场容量", desc: "规模增速与机会判断", prompt: "调研中国智能家居市场规模与增长逻辑" },
    { title: "技术趋势", desc: "前沿方向技术拆解", prompt: "研究多模态大模型的技术趋势与落地瓶颈" },
    { title: "用户画像", desc: "人群特征与需求洞察", prompt: "为「在线教育」用户做画像研究" },
    { title: "政策解读", desc: "新规影响与应对", prompt: "解读《生成式 AI 服务管理办法》对创业公司的影响" },
    { title: "出海机会", desc: "目标市场进入策略", prompt: "研究国产 SaaS 出海东南亚的机会与风险" },
    { title: "供应链", desc: "链路风险与优化", prompt: "研究消费电子供应链的东南亚转移现状" },
    { title: "消费者洞察", desc: "行为偏好数据化", prompt: "调研 Z 世代美妆消费偏好" },
    { title: "SaaS 指标", desc: "北极星指标拆解", prompt: "研究 B2B SaaS 的增长指标体系" },
    { title: "AI 应用层", desc: "应用机会与格局", prompt: "研究 AI 应用层 2026 年创业机会图谱" },
    { title: "新能源", desc: "产业格局深度研究", prompt: "研究固态电池产业化时间线" },
    { title: "物流科技", desc: "降本增效新技术", prompt: "研究仓储机器人的技术路线与落地成本" },
  ],
  "video": [
    { title: "视频脚本", desc: "带货 / 分镜 / 口播脚本", prompt: "为新款降噪耳机写一条 15 秒带货短视频脚本" },
    { title: "产品宣传", desc: "品牌感产品影片", prompt: "为智能手表写 60 秒产品宣传片脚本" },
    { title: "口播干货", desc: "知识类口播稿", prompt: "写一期 3 分钟「普通人如何学 AI」口播稿" },
    { title: "Vlog 脚本", desc: "生活感叙事线", prompt: "写一条周末城市漫步 Vlog 脚本" },
    { title: "教程分镜", desc: "步骤清晰教学视频", prompt: "为「用 AI 做 PPT」写教程视频分镜" },
    { title: "品牌故事", desc: "创始人叙事", prompt: "为咖啡品牌写一支 90 秒品牌故事片" },
    { title: "活动回顾", desc: "高光集锦旁白", prompt: "写活动回顾视频旁白：开场、节奏、收尾" },
    { title: "开箱测评", desc: "真实体验向脚本", prompt: "写数码产品开箱测评脚本，突出真实体验" },
    { title: "城市宣传", desc: "文旅气质影像", prompt: "写一条 3 分钟城市文旅宣传片创意脚本" },
    { title: "科普动画", desc: "知识可视化", prompt: "把「什么是大模型」做成 2 分钟科普动画脚本" },
    { title: "采访提纲", desc: "有深度的提问线", prompt: "设计一期创始人访谈的采访提纲与分镜" },
    { title: "音乐短片", desc: "情绪叙事 MV", prompt: "为轻音乐写一支情绪向 MV 概念脚本" },
  ],
  "prototype": [
    { title: "高保真原型", desc: "", prompt: undefined },
    { title: "可点击线框", desc: "", prompt: undefined },
    { title: "移动端原型", desc: "", prompt: undefined },
    { title: "登录注册流程", desc: "", prompt: undefined },
    { title: "仪表盘界面", desc: "", prompt: undefined },
    { title: "电商商品页", desc: "", prompt: undefined },
    { title: "多步表单流程", desc: "", prompt: undefined },
    { title: "桌面端工具", desc: "", prompt: undefined },
    { title: "个人中心", desc: "", prompt: undefined },
    { title: "支付流程", desc: "", prompt: undefined },
    { title: "设置页", desc: "", prompt: undefined },
    { title: "空状态页面", desc: "", prompt: undefined },
  ],
  "hyperframes": [
    { title: "灵感浏览", desc: "", prompt: undefined },
    { title: "社区热门", desc: "", prompt: undefined },
    { title: "作品趋势", desc: "", prompt: undefined },
    { title: "设计师榜", desc: "", prompt: undefined },
    { title: "每日精选", desc: "", prompt: undefined },
    { title: "风格实验室", desc: "", prompt: undefined },
    { title: "案例拆解", desc: "", prompt: undefined },
    { title: "模板商店", desc: "", prompt: undefined },
    { title: "教程系列", desc: "", prompt: undefined },
    { title: "开源项目", desc: "", prompt: undefined },
    { title: "收藏夹", desc: "", prompt: undefined },
    { title: "新锐作者", desc: "", prompt: undefined },
  ],
  "website": [
    { title: "落地页复刻", desc: "", prompt: undefined },
    { title: "企业官网", desc: "", prompt: undefined },
    { title: "个人作品集", desc: "", prompt: undefined },
    { title: "博客站点", desc: "", prompt: undefined },
    { title: "电商首页", desc: "", prompt: undefined },
    { title: "文档中心", desc: "", prompt: undefined },
    { title: "SaaS 官网", desc: "", prompt: undefined },
    { title: "活动专题页", desc: "", prompt: undefined },
    { title: "着陆页", desc: "", prompt: undefined },
    { title: "暗色风格站", desc: "", prompt: undefined },
    { title: "多语言站点", desc: "", prompt: undefined },
    { title: "信息架构梳理", desc: "", prompt: undefined },
  ],
  "audio": [
    { title: "语音配音", desc: "", prompt: undefined },
    { title: "背景音乐", desc: "", prompt: undefined },
    { title: "音效设计", desc: "", prompt: undefined },
    { title: "播客片头", desc: "", prompt: undefined },
    { title: "AI 歌曲", desc: "", prompt: undefined },
    { title: "环境白噪音", desc: "", prompt: undefined },
    { title: "有声书旁白", desc: "", prompt: undefined },
    { title: "音乐混音", desc: "", prompt: undefined },
    { title: "乐器分轨", desc: "", prompt: undefined },
    { title: "语音提示音", desc: "", prompt: undefined },
    { title: "广播广告", desc: "", prompt: undefined },
    { title: "冥想引导", desc: "", prompt: undefined },
  ],
  "realtime": [
    { title: "实时协作白板", desc: "", prompt: undefined },
    { title: "实时数据大屏", desc: "", prompt: undefined },
    { title: "在线演示", desc: "", prompt: undefined },
    { title: "协同标注", desc: "", prompt: undefined },
    { title: "多人会议画布", desc: "", prompt: undefined },
    { title: "实时投票", desc: "", prompt: undefined },
    { title: "直播提词", desc: "", prompt: undefined },
    { title: "实时字幕", desc: "", prompt: undefined },
    { title: "远程遥控演示", desc: "", prompt: undefined },
    { title: "协作流程图", desc: "", prompt: undefined },
    { title: "实时批注", desc: "", prompt: undefined },
    { title: "在线头脑风暴", desc: "", prompt: undefined },
  ],
  "webgl": [
    { title: "WebGL 场景", desc: "", prompt: undefined },
    { title: "3D 产品展示", desc: "", prompt: undefined },
    { title: "数据可视化", desc: "", prompt: undefined },
    { title: "互动首页", desc: "", prompt: undefined },
    { title: "粒子效果", desc: "", prompt: undefined },
    { title: "3D 展厅", desc: "", prompt: undefined },
    { title: "Shader 艺术", desc: "", prompt: undefined },
    { title: "3D 图标", desc: "", prompt: undefined },
    { title: "产品配置器", desc: "", prompt: undefined },
    { title: "城市漫游", desc: "", prompt: undefined },
    { title: "物理沙盒", desc: "", prompt: undefined },
    { title: "全景看房", desc: "", prompt: undefined },
  ],
};

/** 「全部」：六个真生成技能各取 2 条共 12 张，交错排列让首屏先见每个技能代表作。
 *  每卡带所属技能 key，「全部」视图下点击也能正确按该技能生成。 */
const ALL_CURATED: { skill: string; card: TemplateCard }[] = [
  { skill: "chat", card: SKILL_TEMPLATES["chat"][0] },
  { skill: "docs", card: SKILL_TEMPLATES["docs"][0] },
  { skill: "slides", card: SKILL_TEMPLATES["slides"][0] },
  { skill: "image", card: SKILL_TEMPLATES["image"][0] },
  { skill: "research", card: SKILL_TEMPLATES["research"][0] },
  { skill: "video", card: SKILL_TEMPLATES["video"][0] },
  { skill: "chat", card: SKILL_TEMPLATES["chat"][1] },
  { skill: "docs", card: SKILL_TEMPLATES["docs"][1] },
  { skill: "slides", card: SKILL_TEMPLATES["slides"][1] },
  { skill: "image", card: SKILL_TEMPLATES["image"][1] },
  { skill: "research", card: SKILL_TEMPLATES["research"][1] },
  { skill: "video", card: SKILL_TEMPLATES["video"][1] },
];

/** 技能选择（输入框内下拉）：六个创作能力 —— 与竖栏 PRIMARY_MODES 一致 */
const SKILLS: { mode: WorkspaceMode; icon: typeof MessageSquare }[] = [
  { mode: "chat", icon: MessageSquare },
  { mode: "docs", icon: FileText },
  { mode: "slides", icon: Presentation },
  { mode: "image", icon: ImageIcon },
  { mode: "research", icon: Search },
  { mode: "video", icon: Video },
];
const SKILL_META: Record<WorkspaceMode, { icon: typeof MessageSquare; desc: string }> = {
  chat: { icon: MessageSquare, desc: "自由对话，AI 自动判断格式" },
  docs: { icon: FileText, desc: "计划书 / 报告 / 制度" },
  slides: { icon: Presentation, desc: "主题 → 整套幻灯片" },
  image: { icon: ImageIcon, desc: "一句话生成 / 编辑图片" },
  research: { icon: Search, desc: "联网查证 · 带引用报告" },
  video: { icon: Video, desc: "分镜 / 口播 / 带货脚本" },
};

/* ═══════════════════════════════════════════
 *  消息气泡
 * ═══════════════════════════════════════════ */

function MessageBubble({
  m,
  isLastUser,
  onEdit,
  onRetry,
  agentLabel,
}: {
  m: UIMessage;
  isLastUser?: boolean;
  onEdit?: () => void;
  /** G74: 出错回复的「重新生成」：撤回该轮并原样重发 */
  onRetry?: () => void;
  /** 助手身份行右侧的小标签（当前模型名），仿 Codex 每条消息的模型头 */
  agentLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(m.content).then(
      () => {
        setCopied(true);
        toast("已复制", "success");
        setTimeout(() => setCopied(false), 1500);
      },
      () => toast("复制失败", "error")
    );
  };
  const isUser = m.role === "user";

  return (
    <div className={cn("group/msg w-full", isUser ? "flex justify-end" : "flex justify-start")}>
      {isUser ? (
        /* ChatGPT 风格：用户消息 = 右侧浅灰圆角块 */
        <div className="max-w-[85%]">
          <div
            className={cn(
              "whitespace-pre-wrap rounded-3xl bg-stone-200/70 px-4 py-2 text-[15px] leading-7 text-stone-800",
              m.error && "border border-red-200 bg-red-50 text-red-700"
            )}
          >
            {m.content}
          </div>
          {!m.streaming && m.content && (
            <div className="mt-1 flex justify-end gap-0.5 opacity-60 transition hover:opacity-100 group-hover/msg:opacity-100">
              {isLastUser && onEdit && (
                <button
                  onClick={onEdit}
                  title="编辑并重新发送"
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                >
                  <Pencil className="h-3 w-3" />
                  编辑
                </button>
              )}
              <button
                onClick={copy}
                title="复制"
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "已复制" : "复制"}
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ChatGPT / Codex 风格：助手消息 = 黑色小方块头像 + 无边框纯文字 */
        <div className="flex w-full max-w-full gap-3">
          <span
            aria-hidden
            className="mt-0.5 flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-lg bg-violet-600 text-[12px] font-bold text-white shadow-sm dark:bg-violet-500"
          >
            O
          </span>
          <div className="min-w-0 flex-1">
            {/* Codex 风格：助手消息开头一行身份 —— 产品名 + 当前模型小标签 */}
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[13px] font-semibold text-stone-900">OpenCanvas</span>
              {agentLabel && (
                <span className="rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-normal text-stone-500">
                  {agentLabel}
                </span>
              )}
            </div>
            {m.streaming && !m.content ? (
              <span className="inline-flex animate-pulse items-center gap-1.5 text-sm text-stone-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                正在思考…
              </span>
            ) : (
              <div className={cn("text-[15px] leading-7", m.error && "rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-red-700")}>
                <div className="markdown-body">
                  <Markdown content={m.content} />
                  {m.streaming && <span className="streaming-cursor" />}
                </div>
              </div>
            )}
            {!m.streaming && m.content && (
              <div className="mt-1.5 flex items-center gap-0.5 opacity-60 transition hover:opacity-100 group-hover/msg:opacity-100">
                <button
                  onClick={copy}
                  title="复制"
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? "已复制" : "复制"}
                </button>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    title="重新生成（撤回本轮错误并重发）"
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-red-500 transition hover:bg-red-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    重试
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
 *  分体式输入舱组件 (E5)
    </div>
  );
}

/* ═══════════════════════════════════════════
 *  分体式输入舱组件 (E5)
 * ═══════════════════════════════════════════ */

function SplitComposer({
  input,
  setInput,
  inputRef,
  submit,
  sending,
  stopGeneration,
  model,
  setModel,
  mode,
  imgSize,
  setImgSize,
  imgModel,
  setImgModel,
  imgStyle,
  setImgStyle,
  imgCount,
  setImgCount,
  imgNegative,
  setImgNegative,
  imgReference,
  setImgReference,
  showHistory,
  setShowHistory,
  history,
  openHistory,
  pickReference,
  applyHistory,
  fileRef,
  enhancing,
  enhancePrompt,
  slashMatches,
  slashIdx,
  setSlashIdx,
  runSlash,
  applyChip,
  chipOn,
  onRecallUp,
  canRecall,
  conversing,
}: {
  input: string;
  setInput: (v: string | ((prev: string) => string)) => void;
  inputRef: React.Ref<HTMLTextAreaElement>;
  submit: () => void;
  sending: boolean;
  stopGeneration: () => void;
  model: string;
  setModel: (id: string, provider?: string) => void;
  mode: WorkspaceMode;
  imgSize: string;
  setImgSize: (v: string) => void;
  imgModel: string;
  setImgModel: (v: string) => void;
  imgStyle: string;
  setImgStyle: (v: string | ((prev: string) => string)) => void;
  imgCount: number;
  setImgCount: (v: number) => void;
  imgNegative: string;
  setImgNegative: (v: string) => void;
  imgReference: string;
  setImgReference: (v: string) => void;
  showHistory: boolean;
  setShowHistory: (v: boolean | ((prev: boolean) => boolean)) => void;
  history: ImagePromptRecord[];
  openHistory: () => void;
  pickReference: (e: React.ChangeEvent<HTMLInputElement>) => void;
  applyHistory: (h: ImagePromptRecord) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  enhancing: boolean;
  enhancePrompt: () => void;
  slashMatches: ReturnType<typeof matchSlash>;
  slashIdx: number;
  setSlashIdx: (v: number | ((prev: number) => number)) => void;
  runSlash: (cmd: (typeof SLASH_COMMANDS)[number]) => void;
  applyChip: (chip: PromptChip) => void;
  chipOn: (chip: PromptChip) => boolean;
  /** UX10: ↑ 召回上一条已发送内容（无可召回时返回 false，事件放行给光标移动） */
  onRecallUp: () => boolean;
  /** UX10: 当前是否处于召回态（可继续前翻） */
  canRecall: boolean;
  /**
   * C24: 是否处于「已有消息」的对话态。对话态下左侧 38% 能力网格默认折叠成
   * 窄图标栏，把输入空间还给打字；空态（没消息）才展示完整能力区。
   */
  conversing?: boolean;
}) {
  // 简化单框：技能选择收敛为输入框内的一个下拉（点击其它处 / Esc 关闭）
  const [skillOpen, setSkillOpen] = useState(false);
  const skillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!skillOpen) return;
    const onDown = (e: MouseEvent) => {
      if (skillRef.current && !skillRef.current.contains(e.target as Node)) setSkillOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSkillOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [skillOpen]);
  const chooseSkill = (m: WorkspaceMode) => {
    setSkillOpen(false);
    if (m === mode) return;
    useChatStore.getState().setMode(m);
    toast(`已切换到「${MODE_LABELS[m]}」`, "success");
  };

  return (
    <div className="rounded-[28px] border border-white/70 bg-white/80 shadow-[0_2px_6px_rgba(0,0,0,0.03),0_16px_44px_-18px_rgba(76,29,149,0.22),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-2xl transition-shadow duration-200 focus-within:border-violet-200/80 focus-within:shadow-[0_2px_6px_rgba(0,0,0,0.03),0_20px_52px_-18px_rgba(124,58,237,0.34),inset_0_1px_0_rgba(255,255,255,0.95)]">
      <div className="relative flex min-w-0 flex-col">
        {/* 图片模式参数（IMG1~6）：模型直选 / 尺寸 / 张数 / 风格 / 负向 / 参考图 / 历史 */}
          {mode === "image" && (
            <div className="space-y-1.5 border-b border-stone-100 px-3 py-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-stone-400">模型</span>
                {IMAGE_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setImgModel(m.id)}
                    title={m.region === "builtin" ? "免费演示模型" : `${m.providerLabel} · ${m.creditsPerImage} 积分/张`}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      imgModel === m.id
                        ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                        : "border-stone-200 text-stone-500 hover:border-brand-300"
                    )}
                  >
                    {m.label}
                  </button>
                ))}
                <button
                  onClick={openHistory}
                  title="提示词历史"
                  className="ml-auto rounded-full border border-stone-200 px-2 py-0.5 text-[10px] text-stone-500 transition hover:border-brand-300 hover:text-brand-600"
                >
                  历史
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-stone-400">尺寸</span>
                {IMAGE_SIZES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setImgSize(s.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      imgSize === s.id
                        ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                        : "border-stone-200 text-stone-500 hover:border-brand-300"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
                <span className="ml-1 text-[10px] text-stone-400">张数</span>
                {IMAGE_COUNTS.map((c) => (
                  <button
                    key={c.n}
                    onClick={() => setImgCount(c.n)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      imgCount === c.n
                        ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                        : "border-stone-200 text-stone-500 hover:border-brand-300"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-stone-400">风格</span>
                {IMAGE_STYLES.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setImgStyle((v) => (v === st.id ? "" : st.id))}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[11px] transition",
                      imgStyle === st.id
                        ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                        : "border-stone-200 text-stone-500 hover:border-brand-300"
                    )}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="shrink-0 text-[10px] text-stone-400">负向</span>
                <input
                  value={imgNegative}
                  onChange={(e) => setImgNegative(e.target.value)}
                  placeholder="不想出现的元素，逗号分隔（仅万相生效）"
                  className="min-w-0 flex-1 rounded border border-stone-200 bg-transparent px-2 py-0.5 text-[11px] outline-none placeholder:text-stone-300 focus:border-brand-300"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  title="上传参考图（图生图，仅万相生效）"
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] transition",
                    imgReference
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                      : "border-stone-200 text-stone-500 hover:border-brand-300"
                  )}
                >
                  {imgReference ? "参考图 ✓" : "参考图"}
                </button>
                {imgReference && (
                  <button
                    onClick={() => setImgReference("")}
                    title="移除参考图"
                    className="shrink-0 rounded-full px-1 text-[10px] text-stone-400 hover:text-stone-600"
                  >
                    ✕
                  </button>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={pickReference} className="hidden" />
              </div>
              {/* IMG6: 提示词历史面板 */}
              {showHistory && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-stone-100 bg-stone-50 p-1.5">
                  {history.length === 0 && (
                    <div className="px-2 py-3 text-center text-[11px] text-stone-400">还没有历史记录</div>
                  )}
                  {history.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => applyHistory(h)}
                      title={`${h.model} · ${h.size}${h.style ? ` · ${h.style}` : ""}`}
                      className="block w-full truncate rounded px-2 py-1 text-left text-[11px] text-stone-600 transition hover:bg-brand-50 hover:text-brand-700"
                    >
                      {h.prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 斜杠命令菜单 */}
          {slashMatches && (
            <div className="absolute bottom-full left-0 z-20 mb-2 max-h-72 w-72 overflow-y-auto rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl">
              <div className="px-2 py-1 text-[11px] text-stone-400">快捷命令（↑↓ 选择，Enter 执行）</div>
              {slashMatches.length === 0 && (
                <div className="px-2 py-3 text-center text-xs text-stone-400">没有匹配的命令</div>
              )}
              {slashMatches.map((c, i) => (
                <button
                  key={c.cmd}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    runSlash(c);
                  }}
                  onMouseEnter={() => setSlashIdx(i)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left",
                    i === slashIdx ? "bg-brand-50" : "hover:bg-stone-50"
                  )}
                >
                  <span className="flex h-6 w-12 shrink-0 items-center justify-center rounded bg-stone-100 font-mono text-[11px] text-stone-500">
                    /{c.cmd}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-medium text-stone-700">{c.label}</span>
                    <span className="block truncate text-[11px] text-stone-400">{c.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* 文字类模式参数：语气 / 长度 / 受众（点击即追加约束，再点取消）——
          仅文档/PPT/研究/视频显示，chat 保持单框极简 */}
          {mode !== "image" && mode !== "chat" && !slashMatches && (
            <div className="flex flex-wrap items-center gap-1 border-b border-stone-100 px-3 py-1.5">
              <span className="text-[11px] text-stone-500" title="把语气要求拼到输入末尾，再点一次取消">语气</span>
              {TONE_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.suffix}
                  onClick={() => applyChip(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition",
                    chipOn(c)
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                      : "border-stone-200 text-stone-500 hover:border-brand-300"
                  )}
                >
                  {c.label}
                </button>
              ))}
              <span className="ml-1 text-[11px] text-stone-500" title="控制篇幅，点击拼到输入末尾，再点一次取消">长度</span>
              {LENGTH_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.suffix}
                  onClick={() => applyChip(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition",
                    chipOn(c)
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                      : "border-stone-200 text-stone-500 hover:border-brand-300"
                  )}
                >
                  {c.label}
                </button>
              ))}
              <span className="ml-1 text-[11px] text-stone-500" title="指定读者对象，点击拼到输入末尾，再点一次取消">受众</span>
              {AUDIENCE_CHIPS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.suffix}
                  onClick={() => applyChip(c)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] transition",
                    chipOn(c)
                      ? "border-brand-500 bg-brand-50 font-medium text-brand-700"
                      : "border-stone-200 text-stone-500 hover:border-brand-300"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* 输入框 */}
          <div className="relative flex flex-1 flex-col">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (slashMatches && slashMatches.length > 0) {
                  if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => (i + 1) % slashMatches.length); return; }
                  if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => (i - 1 + slashMatches.length) % slashMatches.length); return; }
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runSlash(slashMatches[Math.min(slashIdx, slashMatches.length - 1)]); return; }
                  if (e.key === "Escape") { e.preventDefault(); setInput(""); return; }
                }
                // UX10: 斜杠菜单未激活时，↑ 在空输入或召回态下逐级召回已发送内容；
                // 召回态（刚召回过、未编辑）下继续前翻，用户手改输入则退出召回态
                if (e.key === "ArrowUp" && onRecallUp && (!input || canRecall)) {
                  const recalled = onRecallUp();
                  if (recalled) e.preventDefault();
                  return;
                }
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              rows={2}
              placeholder={
                mode === "image"
                  ? "描述你想要的画面…"
                  : mode === "chat"
                    ? "想做什么？写下来告诉我…"
                    : `${MODE_LABELS[mode]}：描述你的需求…`
              }
              className="chat-composer-input min-h-[92px] w-full resize-none bg-transparent px-4 py-3.5 text-[14px] leading-relaxed outline-none placeholder:text-stone-400"
            />
          </div>

          {/* ──── 底部工具栏：技能选择 ▾ ｜ 润色提示词 · 模型下拉 · 发送，全部收在输入框下方 ──── */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-stone-100 px-2.5 py-2.5">
          {/* 技能选择下拉 */}
          <div ref={skillRef} className="relative">
            <button
              onClick={() => setSkillOpen((v) => !v)}
              aria-haspopup="listbox"
              aria-expanded={skillOpen}
              title="技能选择：对话 / 文档 / PPT / 图片 / 研究 / 视频"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-[13px] font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900"
            >
              {(() => {
                const Icon = SKILL_META[mode].icon;
                return <Icon className="h-3.5 w-3.5" />;
              })()}
              {MODE_LABELS[mode]}
              <ChevronDown className={cn("h-3 w-3 text-stone-400 transition-transform", skillOpen && "rotate-180")} />
            </button>
            {skillOpen && (
              <div role="listbox" className="absolute bottom-full left-0 z-40 mb-2 w-48 overflow-hidden rounded-xl border border-[#e5d9c6] bg-white p-1 shadow-xl">
                {SKILLS.map((skill) => {
                  const Icon = SKILL_META[skill.mode].icon;
                  const cur = skill.mode === mode;
                  return (
                    <button
                      key={skill.mode}
                      role="option"
                      aria-selected={cur}
                      onClick={() => chooseSkill(skill.mode)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-brand-50",
                        cur && "bg-brand-50"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", cur ? "text-brand-600" : "text-stone-400")} />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-xs", cur ? "font-medium text-brand-700" : "text-stone-700")}>
                          {MODE_LABELS[skill.mode]}
                        </span>
                        <span className="block truncate text-[10px] text-stone-400">{SKILL_META[skill.mode].desc}</span>
                      </span>
                      {cur && <Check className="h-3.5 w-3.5 text-brand-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <span className="min-w-0 flex-1" />

          {/* 润色提示词 */}
          <button
            onClick={() => void enhancePrompt()}
            disabled={!input.trim() || enhancing}
            title={input.trim() ? "优化提示词" : "输入内容后可优化提示词"}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 text-[13px] text-stone-500 transition hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-600 disabled:opacity-30"
          >
            {enhancing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{enhancing ? "润色中…" : "润色提示词"}</span>
          </button>

          {/* UX12: 实时 token/字数估算（estimateTokens 与计费同口径） */}
          {input.trim() && (
            <span className="truncate text-[10px] text-stone-400" title="估算值，实际以模型分词为准">
              {input.length} 字 · 约 {estimateTokens(input)} tokens
            </span>
          )}

          {/* 模型选择下拉 */}
          <ModelSelector
            value={model}
            onChange={(id, provider) => {
              setModel(id, provider);
              const label = MODELS.find((m) => m.id === id)?.label ?? id;
              // UX8: 补上供应商，让「用的是谁家的模型」一眼可辨
              const pv = provider ? PROVIDER_NAME[provider] : undefined;
              toast(pv ? `已切换到 ${pv} · ${label}` : `已切换到 ${label}`, "success");
            }}
          />

          {sending ? (
            // C35: 停止改红色圆钮，与「发送」在语义上一眼区分
            <button
              onClick={stopGeneration}
              title="停止生成"
              aria-label="停止生成"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm shadow-red-200 transition hover:bg-red-700"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!input.trim()}
              title={input.trim() ? "发送（回车）" : "输入内容后可发送"}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white shadow-[0_2px_10px_rgba(124,58,237,0.35)] transition hover:bg-violet-700 hover:shadow-[0_2px_14px_rgba(124,58,237,0.50)] disabled:bg-stone-100 disabled:text-stone-300 disabled:shadow-none dark:bg-violet-500 dark:hover:bg-violet-400"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>

          {/* 对话态常驻一行快捷键提示（空态的整句提示保留在原处） */}
          {conversing && (
            <p className="px-3 pb-1.5 text-right text-[10px] text-stone-300">
              Shift+回车换行 · ↑ 召回上一条 · / 快捷命令
            </p>
          )}
      </div>
    </div>
  );
}

/** d5：PPT 生成时的对话内阶段条。stage 由 deckMessage 关键词推断，
 *  与右侧产物画布的 SlidesGenerating 同口径（理解→大纲→排版→校对）。 */
const PPT_STAGES = ["理解需求", "生成大纲", "排版中", "校对导出"] as const;

function pptStageOf(message: string): number {
  if (message.includes("排版") || message.includes("解析")) return 2;
  if (message.includes("大纲")) return 1;
  if (message.includes("规划") || message.includes("结构")) return 0;
  return 1;
}

function SlidesProgressStrip({ message }: { message: string }) {
  const cur = pptStageOf(message);
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-stone-100 px-4 py-2.5">
        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
        <span className="text-[13px] font-semibold text-stone-800">正在生成 PPT</span>
        <span className="ml-auto shrink-0 text-[11px] text-stone-400">约 10~30 秒</span>
      </div>
      {message && (
        <p className="border-b border-stone-100 px-4 py-1.5 text-xs text-stone-500">{message}</p>
      )}
      <div className="flex items-center px-4 py-3">
        {PPT_STAGES.map((label, i) => {
          const done = i < cur;
          const active = i === cur;
          return (
            <div key={label} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[11px]",
                  done
                    ? "border-violet-600 bg-violet-600 text-white"
                    : active
                      ? "border-violet-400 bg-white text-violet-500"
                      : "border-stone-200 bg-white text-stone-300"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[11px]",
                  done || active ? "font-medium text-stone-700" : "text-stone-300"
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <div className="h-1 w-full bg-stone-100">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-400 transition-all duration-500"
          style={{ width: `${((cur + 1) / PPT_STAGES.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
 *  主 ChatPanel
 * ═══════════════════════════════════════════ */

export function ChatPanel() {
  const { conversations, activeId, send, sending, stopGeneration, model, setModel } = useChatStore();
  const pendingInput = useChatStore((s) => s.pendingInput);
  const convo = conversations.find((c) => c.id === activeId);
  const [input, setInput] = useState("");
  const [imgSize, setImgSize] = useState("1024x1024");
  // IMG1~6: 绘图参数（模型直选 / 风格 / 张数 / 负向词 / 参考图 / 历史）
  const [imgModel, setImgModel] = useState("demo-image");
  const [imgStyle, setImgStyle] = useState("");
  const [imgCount, setImgCount] = useState(1);
  const [imgNegative, setImgNegative] = useState("");
  const [imgReference, setImgReference] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ImagePromptRecord[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showJump, setShowJump] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const sse = useSseStream();
  const [slashIdx, setSlashIdx] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // UX10: ↑ 召回栈。仅在输入为空时按 ArrowUp 逐级往前取已发送内容；
  // 打字过程随时可再按 ↑ 继续（栈指针不因编辑而清零，发送后重置）
  const sentStack = useRef<string[]>([]);
  const recallIdx = useRef(-1);
  // UX10: 召回态（继续按 ↑ 可再往前翻）；用户手动编辑即退出
  const [recallActive, setRecallActive] = useState(false);
  // 空态技能条：当前选中技能 key（all=全部 / 具体技能）
  const [homeFilter, setHomeFilter] = useState("all");
  // 「更多」下拉开关
  const [moreOpen, setMoreOpen] = useState(false);
  // 模板卡展开（每技能 12 张：先显 9，展开到 12）
  const [tplExpanded, setTplExpanded] = useState(false);

  const slashMatches = matchSlash(input);
  useEffect(() => setSlashIdx(0), [input]);

  // UX11: 草稿按会话 id 存 localStorage —— 切会话自动保存/恢复，避开 pendingInput 的一次性意图
  const draftKey = activeId ? `opencanvas.draft.${activeId}` : null;
  useEffect(() => {
    if (!draftKey) return;
    const saved = readJSON<string>(draftKey, "");
    if (saved) {
      setInput(saved);
      inputRef.current?.focus();
      // D50: 恢复草稿时明说一句，避免用户以为内容是自己刚打上去的
      toast("已恢复这个会话上次未发送的草稿", "info");
    }
    // 仅在切换会话（activeId 变化）时恢复；输入过程不重放
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey) return;
    // 空草稿移除键，避免 localStorage 堆积已发送内容
    if (input.trim()) writeJSON(draftKey, input);
    else removeKey(draftKey);
  }, [input, draftKey]);

  useEffect(() => {
    if (pendingInput) {
      setInput(pendingInput.text);
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInput?.nonce]);

  const applyChip = (chip: PromptChip) => {
    setInput((v) => {
      const has = v.includes(chip.suffix);
      if (has) return v.replace(new RegExp(`\\n?${chip.suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"), "").trimEnd();
      if (v.startsWith("/")) return v;
      return v.trim() ? v.replace(/\s*$/, "") + "\n" + chip.suffix : chip.suffix;
    });
  };
  const chipOn = (c: PromptChip) => input.includes(c.suffix);

  const runSlash = (cmd: (typeof SLASH_COMMANDS)[number]) => {
    if (cmd.kind === "action" && cmd.mode) {
      useChatStore.getState().setMode(cmd.mode);
      setInput("");
      toast(`已切换到${MODE_LABELS[cmd.mode]}工作台`, "info");
      return;
    }
    const raw = input.replace(/^\/[a-z]*\s*/i, "").trim();
    const text = (cmd.insert ?? "").replace("{q}", raw);
    setInput(text);
    setTimeout(() => {
      const ta = inputRef.current;
      if (!ta) return;
      const pos = text.includes("「") ? text.indexOf("」") : text.length;
      ta.focus();
      ta.setSelectionRange(pos, pos);
    }, 0);
  };

  useEffect(() => {
    if (messages.length === 0) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const messages = convo?.messages ?? [];
  const mode: WorkspaceMode = convo?.mode ?? "chat";
  // 空态技能条收纳：顶部可见 4 项，其余在「更多」下拉
  const homeVisible = HOME_SKILLS.filter((sk) => HOME_VISIBLE_KEYS.includes(sk.key));
  const homeMore = HOME_SKILLS.filter((sk) => !HOME_VISIBLE_KEYS.includes(sk.key));
  const activeSkill = HOME_SKILLS.find((sk) => sk.key === homeFilter) ?? HOME_SKILLS[0];
  // 当前模板卡视图：全部=精选 12（各带源技能）；具体技能=该技能 12 张（PPT 与幻灯片共用一套）。
  // 统一成 { skill, card } 视图模型，点击时按卡所属技能生成，不受「全部」聚合影响。
  const templateKey = homeFilter === "ppt" ? "slides" : homeFilter;
  const templateSkill = homeFilter === "ppt" ? "ppt" : templateKey;
  const templates: { skill: string; card: TemplateCard }[] =
    homeFilter === "all"
      ? ALL_CURATED
      : (SKILL_TEMPLATES[templateKey] ?? []).map((card) => ({ skill: templateSkill, card }));
  const shownTemplates = tplExpanded ? templates : templates.slice(0, 9);
  const hasMoreTemplates = templates.length > 9;
  // d5：PPT 生成中（对话内顶部阶段条）
  const deckLoading = mode === "slides" && convo?.deckStatus === "loading";
  // 助手身份行小标签：当前模型名（Codex 每条消息头部同款）
  const modelLabel = MODELS.find((m) => m.id === model)?.label ?? model;

  const scrollToBottom = (smooth = true) =>
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: smooth ? "smooth" : "auto" });

  // UX13: 用户是否主动上滚离开底部（距底 > 120px）。流式跟随据此让位；
  // scrollToBottom（新消息/回到底部按钮）会清掉该标志恢复跟随。
  const userPinnedTop = useRef(false);
  const markBottom = () => {
    userPinnedTop.current = false;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = () => el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    const onScroll = () => {
      setShowJump(!atBottom());
      userPinnedTop.current = !atBottom();
      // DB4: 接近顶部时补拉更早历史；先记当前 scrollHeight，
      // 拉回后按新增高度补偿 scrollTop，用户视线停留在原消息上
      if (el.scrollTop <= 60) {
        const prevHeight = el.scrollHeight;
        void useChatStore.getState().loadEarlierMessages(activeId ?? "").then((n) => {
          if (n > 0) {
            requestAnimationFrame(() => {
              el.scrollTop += el.scrollHeight - prevHeight;
            });
          }
        });
      }
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useEffect(() => { markBottom(); scrollToBottom(); }, [messages.length]);

  // 发送中跟随最新消息滚动；UX13: 用户已上滚离底时暂停跟随，滚回底部自动恢复
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (sending && !userPinnedTop.current) scrollToBottom(); }, [sending, messages[messages.length - 1]?.content]);

  const submit = () => {
    if (!input.trim() || sending) return;
    const text = input;
    setInput("");
    // UX10: 发送成功路径统一入栈并重置召回指针（image 走 generateImage 也算一次发送）
    if (sentStack.current[sentStack.current.length - 1] !== text) sentStack.current.push(text);
    if (sentStack.current.length > 20) sentStack.current.shift();
    recallIdx.current = -1;
    if (mode === "image") {
      void useChatStore.getState().generateImage(text, {
        size: imgSize,
        model: imgModel,
        n: imgCount,
        style: imgStyle || undefined,
        negative: imgNegative || undefined,
        reference: imgReference || undefined,
      });
      // 参考图只对当次生成生效，发出去后清掉避免延续到下一张
      setImgReference("");
      return;
    }
    void send(text);
  };

  // UX10: ↑ 逐级召回已发送内容；栈空返回 false 让按键走默认光标行为
  const recallUp = () => {
    const stack = sentStack.current;
    if (!stack.length) return false;
    recallIdx.current = Math.min(recallIdx.current + 1, stack.length - 1);
    setInput(stack[stack.length - 1 - recallIdx.current]);
    setRecallActive(true);
    return true;
  };

  /** G74: 出错回复上的「重试」：撤掉本轮（含错误气泡）再原样重发用户原问 */
  const retryLast = () => {
    const st = useChatStore.getState();
    const convo = st.conversations.find((c) => c.id === st.activeId);
    if (!convo || convo.messages.length === 0) return;
    const text = [...convo.messages].reverse().find((mm) => mm.role === "user")?.content;
    if (!text || !text.trim()) return;
    st.editLastUserMessage();
    // 等 editLastUserMessage 把尾部截掉后，把同一句话重发给模型
    setTimeout(() => {
      const s2 = useChatStore.getState();
      if (s2.activeId && text.trim()) void s2.send(text);
    }, 0);
  };

  /** 输入变更统一入口：手动编辑即退出 UX10 召回态（召回态下 ↑ 可继续前翻） */
  // 空态模板卡：点击直接按技能+提示词开始生成（对应截图「点卡即出」）；
  // planned（建设中）技能仅提示，不假装能生成
  const runStarter = (skill: HomeSkill, q: TemplateCard) => {
    if (sending) return;
    if (skill.planned || !skill.mode || !q.prompt) {
      toast(`「${skill.label}」正在建设中，先用 AI 对话 / 文档 / PPT / 图片 / 视频试试`, "info");
      return;
    }
    const text = q.prompt;
    if (skill.mode !== mode) useChatStore.getState().setMode(skill.mode);
    setInput("");
    if (sentStack.current[sentStack.current.length - 1] !== text) sentStack.current.push(text);
    if (sentStack.current.length > 20) sentStack.current.shift();
    recallIdx.current = -1;
    if (skill.mode === "image") {
      void useChatStore.getState().generateImage(text, {
        size: imgSize,
        model: imgModel,
        n: imgCount,
        style: imgStyle || undefined,
        negative: imgNegative || undefined,
        reference: imgReference || undefined,
      });
      setImgReference("");
      return;
    }
    void useChatStore.getState().send(text);
  };

  /** 切换技能：重置模板展开态并收起更多下拉 */
  const pickSkill = (key: string) => {
    setHomeFilter(key);
    setTplExpanded(false);
    setMoreOpen(false);
  };

  const changeInput = (v: string | ((prev: string) => string)) => {
    setRecallActive(false);
    setInput(v);
  };

  // IMG5: 参考图选择 → data URI（配合通义万相图生图；其它模型服务端会明确报错）
  const pickReference = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("请选择图片文件作为参考图", "error");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast("参考图需小于 12MB", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImgReference(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  };

  // IMG6: 历史回填——点历史条目恢复当次完整参数
  const applyHistory = (h: ImagePromptRecord) => {
    setInput(h.prompt);
    setImgModel(h.model);
    setImgSize(h.size);
    setImgStyle(h.style ?? "");
    setImgNegative(h.negative ?? "");
    setImgCount(1);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  const openHistory = () => {
    setHistory(loadPromptHistory());
    setShowHistory((v) => !v);
  };

  const enhancePrompt = async () => {
    const raw = input.trim();
    if (!raw || enhancing) return;
    setEnhancing(true);
    const ov = getOverrides();
    const hasModel = Object.values(ov).some((p) => p?.apiKey);
    // 模型失败（网络/上游错误）不直接终止：本地模板兜底保证用户总能拿到结构化提示词
    let acc = "";
    if (hasModel && mode !== "image") {
      // AI15：reader 循环已收敛进 useSseStream，这里只保留业务语义
      acc = await sse.start({
        url: "/api/chat",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: convo?.model ?? "demo",
          overrides: ov,
          messages: [
            { role: "system", content: "你是提示词专家。把用户粗糙的需求改写成结构清晰、效果更好的中文提示词，包含：角色设定、具体任务、背景/受众、输出格式与约束。只输出改写后的提示词本身，不要解释、不要前后缀。" },
            { role: "user", content: raw },
          ],
        }),
      }).catch(() => "");
    }
    try {
      if (acc.trim()) { setInput(acc.trim()); toast("提示词已优化", "success"); return; }
      const modeHint: Record<string, string> = {
        image: "请输出一段英文绘图提示词，包含：主体细节、艺术风格、构图景别、光线氛围、画质词，用逗号分隔。",
        slides: "请输出一份幻灯片结构：标题、封面副标题、每页标题与 3-4 个要点。",
        research: "请从背景、现状、关键数据、主要玩家、趋势与结论几个方面展开。",
        docs: "请输出结构完整的文档：标题、导语、分小节（含小标题与要点）、结论。",
        video: "请输出分镜脚本：每个镜头含时长、画面、旁白、字幕。",
        chat: "请分点、有条理地回答，必要时给出步骤和示例。",
      };
      const improved = `# 角色\n你是该领域的资深专家。\n\n# 任务\n${raw}\n\n# 要求\n- 面向：相关从业者 / 普通读者（按需）\n- 语言：中文，专业且易懂\n- 输出：${modeHint[mode] ?? modeHint.chat}\n- 约束：内容准确、结构清晰、可直接使用，避免空话`;
      setInput(improved);
      toast("已生成结构化提示词", "success");
    } catch { toast("优化失败，请重试", "error"); }
    finally { setEnhancing(false); }
  };

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, [input]);

  return (
    <div className="relative flex min-w-0 flex-1 flex-col bg-white text-stone-800">
      <div
        ref={scrollRef}
        className={cn("flex-1 overflow-y-auto px-6", messages.length === 0 ? "bg-white py-12" : "bg-white py-10")}
      >
        <div className="mx-auto w-full max-w-[760px]">
          {/* d5：PPT 生成时，阶段条显示在对话流顶部 */}
          {deckLoading && <SlidesProgressStrip message={convo?.deckMessage ?? ""} />}
          {messages.length === 0 ? (
            <div className="relative px-2 pb-4 pt-4 text-center">
              {/* 页面主标题（sr-only：视觉上已由技能条+示例区承担引导，标题供读屏/结构用） */}
              <h1 className="sr-only">AI 对话</h1>
              {/* n5 氛围的浅色版：柔紫主光晕 + 一点琥珀偏光；背景仍是现有白底 */}
              <div aria-hidden className="pointer-events-none absolute -top-6 left-1/2 h-64 w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(139,92,246,0.13),transparent_70%)] blur-2xl" />
              <div aria-hidden className="pointer-events-none absolute right-2 top-24 hidden h-44 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(251,146,60,0.09),transparent_70%)] blur-2xl md:block" />
              <div className="relative">
                {/* 顶部技能条：可见 4 项 + 「更多」下拉（其余技能收纳） */}
                <div className="relative inline-flex max-w-full flex-wrap items-center justify-center gap-1">
                  {homeVisible.map((sk) => {
                    const active = homeFilter === sk.key;
                    const Icon = sk.icon;
                    return (
                      <button
                        key={sk.key}
                        role="tab"
                        aria-selected={active}
                        onClick={() => pickSkill(sk.key)}
                        title={sk.planned ? `${sk.label}（建设中）` : sk.label}
                        className={cn(
                          "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition",
                          active
                            ? "border-violet-600 bg-violet-600 text-white shadow-sm shadow-violet-200"
                            : "border-stone-200/80 bg-white/80 text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {sk.label}
                        {sk.planned && (
                          <span className="rounded-full bg-stone-200/80 px-1 text-[9px] leading-4 text-stone-500">soon</span>
                        )}
                      </button>
                    );
                  })}

                  {/* 更多：当前选中的是隐藏技能时，按钮显示该技能名 */}
                  <div className="relative">
                    <button
                      role="tab"
                      aria-selected={homeMore.some((sk) => sk.key === homeFilter)}
                      aria-haspopup="listbox"
                      aria-expanded={moreOpen}
                      onClick={() => {
                        setMoreOpen((v) => !v);
                        setTplExpanded(false);
                      }}
                      title="更多技能"
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition",
                        homeMore.some((sk) => sk.key === homeFilter)
                          ? "border-violet-600 bg-violet-600 text-white shadow-sm shadow-violet-200"
                          : "border-stone-200/80 bg-white/80 text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                      )}
                    >
                      {(() => {
                        const sel = homeMore.find((sk) => sk.key === homeFilter);
                        const Icon = (sel ?? homeMore[0]).icon;
                        return <Icon className="h-3.5 w-3.5" />;
                      })()}
                      {homeMore.find((sk) => sk.key === homeFilter)?.label ?? "更多"}
                      {moreOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                    </button>
                    {moreOpen && (
                      <div
                        role="listbox"
                        aria-label="更多技能"
                        className="absolute left-1/2 top-full z-40 mt-2 w-64 -translate-x-1/2 overflow-hidden rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl"
                      >
                        <div className="grid grid-cols-2 gap-0.5">
                          {homeMore.map((sk) => {
                            const Icon = sk.icon;
                            const sel = homeFilter === sk.key;
                            return (
                              <button
                                key={sk.key}
                                role="option"
                                aria-selected={sel}
                                onClick={() => pickSkill(sk.key)}
                                className={cn(
                                  "flex items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] transition",
                                  sel
                                    ? "bg-violet-50 font-medium text-violet-700"
                                    : "text-stone-600 hover:bg-stone-100"
                                )}
                              >
                                <Icon className="h-4 w-4 shrink-0" />
                                <span className="min-w-0 flex-1 truncate">{sk.label}</span>
                                {sk.planned && (
                                  <span className="rounded bg-stone-100 px-1 text-[9px] text-stone-400">soon</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              {/* E5 分体式输入舱 */}
              <div className="mx-auto mt-6 max-w-3xl">
                <SplitComposer
                  input={input}
                  setInput={changeInput as typeof setInput}
                  inputRef={inputRef}
                  submit={submit}
                  sending={sending}
                  stopGeneration={stopGeneration}
                  model={model}
                  setModel={setModel}
                  mode={mode}
                  imgSize={imgSize}
                  setImgSize={setImgSize}
                  imgModel={imgModel}
                  setImgModel={setImgModel}
                  imgStyle={imgStyle}
                  setImgStyle={setImgStyle}
                  imgCount={imgCount}
                  setImgCount={setImgCount}
                  imgNegative={imgNegative}
                  setImgNegative={setImgNegative}
                  imgReference={imgReference}
                  setImgReference={setImgReference}
                  showHistory={showHistory}
                  setShowHistory={setShowHistory}
                  history={history}
                  openHistory={openHistory}
                  pickReference={pickReference}
                  applyHistory={applyHistory}
                  fileRef={fileRef}
                  enhancing={enhancing}
                  enhancePrompt={enhancePrompt}
                  slashMatches={slashMatches}
                  slashIdx={slashIdx}
                  setSlashIdx={setSlashIdx}
                  runSlash={runSlash}
                  applyChip={applyChip}
                  chipOn={chipOn}
                  onRecallUp={recallUp}
                  canRecall={recallActive}
                  conversing={messages.length > 0}
                />
              </div>
              <p className="mt-2 text-xs text-stone-400">回车发送 · Shift+回车换行 · 上方技能条选择文档 / PPT / 图片 / 更多</p>

              {/* 示例模板：每个技能 12 张（每行 3 个，先显 9，箭头展开隐藏 3） */}
                <div className="mt-5 flex items-baseline justify-between px-1 text-left">
                  <h2 className="text-sm font-semibold tracking-wide text-stone-500">
                    {activeSkill.key === "all" ? "示例提示词" : `${activeSkill.label} · 示例模板`}
                  </h2>
                  <span className="text-xs text-stone-400">
                    {activeSkill.planned
                      ? "该能力正在建设中 · 其它技能点击卡片即可直接生成"
                      : `共 ${templates.length} 个 · 点击卡片直接生成`}
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2.5 text-left sm:grid-cols-3">
                  {shownTemplates.map((item) => {
                    const curSkill = HOME_SKILLS.find((x) => x.key === item.skill) ?? activeSkill;
                    const q = item.card;
                    const planned = curSkill.planned;
                    return (
                      <button
                        key={item.skill + ":" + q.title}
                        aria-label={q.title}
                        onClick={() => runStarter(curSkill, q)}
                        className="group overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-1.5 text-left transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-[0_12px_30px_-16px_rgba(76,29,149,0.4)]"
                      >
                        {planned ? (
                          <span className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-stone-100 to-stone-200 sm:h-20 lg:h-[4.5rem]">
                            {(() => {
                              const Icon = curSkill.icon;
                              return <Icon className="h-6 w-6 text-stone-400" />;
                            })()}
                            <span className="absolute right-1.5 top-1.5 rounded-full bg-stone-200/90 px-1.5 py-0.5 text-[9px] font-medium text-stone-500">
                              建设中
                            </span>
                          </span>
                        ) : (
                          <span className="relative block h-16 w-full overflow-hidden rounded-lg bg-stone-100 sm:h-20 lg:h-[4.5rem]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={THUMB_IMG[curSkill.mode ?? "chat"]}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                            />
                          </span>
                        )}
                        <span className="block px-1 pt-2">
                          <span className="block truncate text-[13px] font-semibold text-stone-800">{q.title}</span>
                          {q.desc && <span className="mt-0.5 block truncate text-xs text-stone-500">{q.desc}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {hasMoreTemplates && (
                  <div className="mt-3 flex justify-center">
                    <button
                      onClick={() => setTplExpanded((v) => !v)}
                      aria-expanded={tplExpanded}
                      className="flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-medium text-stone-500 transition hover:border-stone-300 hover:text-violet-600"
                    >
                      {tplExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" /> 收起
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" /> 还有 {templates.length - 9} 个，展开看看
                        </>
                      )}
                    </button>
                  </div>
                )}


              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {mode === "chat" && (
                <div className="flex justify-center">
                  <PersonaPicker
                    onStarter={(t) => { setInput(t); setTimeout(() => inputRef.current?.focus(), 0); }}
                  />
                </div>
              )}
              {/* UX9: 最后一条用户消息带编辑重发入口（非最后条保持只读，避免歧义的历史改写） */}
              {messages.map((m, i) => {
                const nextUser = messages.findIndex((x, j) => j > i && x.role === "user");
                const isLastUser = m.role === "user" && nextUser === -1;
                const isLastMsg = i === messages.length - 1;
                return (
                  <MessageBubble
                    key={m.id}
                    m={m}
                    isLastUser={isLastUser}
                    onEdit={isLastUser ? () => useChatStore.getState().editLastUserMessage() : undefined}
                    onRetry={m.error && isLastMsg ? retryLast : undefined}
                    agentLabel={modelLabel}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* R5：空对话时右下角一行极小的环境说明，不占布局 */}
      {messages.length === 0 && (
        <p
          aria-hidden
          className="pointer-events-none absolute bottom-3 right-5 hidden select-none text-[11px] text-stone-300 lg:block"
        >
          数据保存在本地 · 30 秒上手 · 不配密钥也能完整体验
        </p>
      )}

      {/* 回到底部 */}
      {showJump && messages.length > 0 && (
        <button
          onClick={() => { markBottom(); scrollToBottom(); }}
          className="absolute bottom-[200px] left-1/2 -translate-x-1/2 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-500 shadow-md transition hover:text-brand-600"
        >
          ↓ 回到底部
        </button>
      )}

      {/* 对话中底部的分体式输入舱 */}
      {messages.length > 0 && (
        <div className="relative px-6 pb-4 pt-1">
          <div aria-hidden className="pointer-events-none absolute inset-x-8 -top-14 bottom-0 rounded-[44px] bg-[radial-gradient(closest-side,rgba(139,92,246,0.10),transparent_75%)] blur-xl" />
          <div className="relative mx-auto w-full max-w-3xl">
            <SplitComposer
              input={input}
              setInput={changeInput as typeof setInput}
              inputRef={inputRef}
              submit={submit}
              sending={sending}
              stopGeneration={stopGeneration}
              model={model}
              setModel={setModel}
              mode={mode}
              imgSize={imgSize}
              setImgSize={setImgSize}
              imgModel={imgModel}
              setImgModel={setImgModel}
              imgStyle={imgStyle}
              setImgStyle={setImgStyle}
              imgCount={imgCount}
              setImgCount={setImgCount}
              imgNegative={imgNegative}
              setImgNegative={setImgNegative}
              imgReference={imgReference}
              setImgReference={setImgReference}
              showHistory={showHistory}
              setShowHistory={setShowHistory}
              history={history}
              openHistory={openHistory}
              pickReference={pickReference}
              applyHistory={applyHistory}
              fileRef={fileRef}
              enhancing={enhancing}
              enhancePrompt={enhancePrompt}
              slashMatches={slashMatches}
              slashIdx={slashIdx}
              setSlashIdx={setSlashIdx}
              runSlash={runSlash}
              applyChip={applyChip}
              chipOn={chipOn}
              onRecallUp={recallUp}
              canRecall={recallActive}
              conversing={messages.length > 0}
            />
          </div>
        </div>
      )}
    </div>
  );
}
