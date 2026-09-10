"use client";

import type { ReactNode } from "react";
import { DIFFUSER_WIDE, LAMP_WIDE, LiveWideCarousel } from "./LiveWideCarousel";

/** 画布文档案例：可划词复制的 HTML 成品，版式对齐设计稿 */

export function LiveDocByTitle({ title }: { title: string }) {
  if (title.includes("磁悬浮") || title.includes("氛围灯") || title.includes("Saturn")) return <LiveLampBrief />;
  if (title.includes("香薰") || title.includes("火焰") || title.includes("diffuser")) return <LiveDiffuserBrief />;
  if (title.includes("会议纪要") || title.includes("会议")) return <LiveMinutes />;
  if (title.includes("营销") || title.includes("Campaign") || title.includes("活动")) return <LiveMarketing />;
  if (title.includes("商业模式画布")) return <LiveMindmap />;
  if (title.includes("商业计划") || title.includes("SaaS") || title.includes("BP")) return <LiveSaaSBP />;
  if (title.includes("PRD")) return <LivePRD />;
  if (title.includes("周报") || title.includes("月报")) return <LiveWeekly />;
  if (title.includes("路线图")) return <LiveRoadmap />;
  if (title.includes("新闻稿")) return <LivePress />;
  if (title.includes("财务")) return <LiveFinance />;
  if (title.includes("教案")) return <LiveLesson />;
  if (title.includes("出题") || title.includes("解析")) return <LiveQuiz />;
  if (title.includes("简历")) return <LiveResume />;
  if (title.includes("思维导图")) return <LiveMindmap />;
  if (title.includes("学习计划")) return <LiveStudy />;
  if (title.includes("Excel") || title.includes("公式")) return <LiveExcel />;
  if (title.includes("儿童") || title.includes("故事")) return <LiveKids />;
  if (title.includes("早报") || title.includes("晚报") || title.includes("政策")) return <LivePress />;
  if (title.includes("更新日志") || title.includes("RFC")) return <LiveChangelog />;
  return <LiveOffice title={title} />;
}

const LAMP_PROMPT = `Commercial product photography of a futuristic magnetic levitation ambient lamp,
a glowing Saturn-like sphere floating above a minimalist walnut wood base with
brass ring detail, gradient light shifting from deep ocean blue to warm amber,
delicate mist surrounding the sphere, dark studio background with dramatic rim
lighting, ultra-realistic, 8K render, octane render, premium industrial design,
cinematic lighting --ar 3:4 --v 6.1 --style raw`;

/** 按提示词落地的商业摄影简报文档 */
export function LiveLampBrief() {
  return (
    <Paper>
      <p className="text-[11px] tracking-[0.22em] text-stone-400">LOOKBOOK · PRODUCT PHOTOGRAPHY BRIEF</p>
      <h1 className="mt-3 text-[28px] font-extrabold leading-tight text-stone-900">SATURN LAMP</h1>
      <p className="mt-1 text-[15px] text-stone-500">磁悬浮氛围灯 · 商业产品摄影简报</p>
      <p className="mt-2 text-[12px] text-stone-400">文档编号 LB-2026-091 · 机密 · 仅供拍摄与电商主图使用</p>

      <div className="mt-8 overflow-hidden rounded-sm bg-stone-950 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.55)]">
        <LiveWideCarousel images={LAMP_WIDE} alt="Saturn Lamp 主视觉" />
      </div>
      <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800/80">产品叙事</p>
          <p className="mt-3 text-[13.5px] leading-7 text-stone-700">
            SATURN LAMP 不是一盏「会亮的摆件」，而是一颗被磁场托住的土星。胡桃木底座压住桌面的重量感，黄铜环给出珠宝级细节；球体在深海蓝与暖琥珀之间缓慢呼吸。雾气只存在于镜头里——现场用极薄的雾机扫过一次，避免糊成科幻海报。
          </p>
          <p className="mt-3 text-[13.5px] leading-7 text-stone-700">
            本简报根据你提供的提示词直出主视觉，并补齐拍摄规格、灯光、材质与电商裁切，方便摄影、三维与电商运营共用同一口径。
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[12px]">
            {[
              ["定位", "高端家居 / 礼赠"],
              ["价格带", "¥1,280 – 1,680"],
              ["材质", "胡桃木 · 黄铜 · 树脂球"],
              ["光源", "可调 RGBW 8W"],
              ["比例", "16:9 宽屏主图"],
              ["引擎", "Octane / 实拍混渲"],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-stone-200 pt-2">
                <dt className="text-[10px] uppercase tracking-wider text-stone-400">{k}</dt>
                <dd className="mt-0.5 font-medium text-stone-800">{v}</dd>
              </div>
            ))}
          </dl>
      </div>

      <H>01  提示词（原文，不可改语气）</H>
      <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-[#16120e] px-4 py-4 font-mono text-[11.5px] leading-6 text-amber-100/90">{LAMP_PROMPT}</pre>
      <p className="mt-2 text-[11px] text-stone-400">参数：--ar 3:4 --v 6.1 --style raw。出图后禁止加滤镜预设，只允许校色到胡桃木真实棕。</p>

      <H>02  镜头与灯光</H>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-stone-900 text-amber-50">
            {["镜号", "用途", "机位", "光", "雾", "备注"].map((h) => (
              <th key={h} className="px-2 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-stone-700">
          {[
            ["A1", "电商主图", "平视略俯 15°", "轮廓光 + 球内发光", "薄雾一层", "3:4，留底部木纹"],
            ["A2", "材质特写", "底座 45° 微距", "侧逆光扫铜环", "无雾", "木纹年轮可读"],
            ["A3", "光色循环", "固定机位延时", "蓝→琥珀 8s", "轻雾", "官网首屏循环"],
            ["A4", "使用场景", "床头 / 书桌", "环境光压暗", "无雾", "16:9 生活方式"],
            ["A5", "礼盒开箱", "顶视", "柔光箱", "无雾", "黄铜配件入画"],
          ].map((r) => (
            <tr key={r[0]} className="border-b border-stone-100">
              {r.map((c) => (
                <td key={c} className="px-2 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <H>03  色彩与材质纪律</H>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Deep Ocean", "#0B3A5B", "球体冷极，不可偏紫"],
          ["Warm Amber", "#D48A32", "球体暖极，接近钨丝"],
          ["Walnut", "#5C3A21", "底座，保留导管孔"],
          ["Brass", "#C4A574", "环与触点，禁止镀铬感"],
          ["Studio Black", "#0A0908", "背景，可见极弱轮廓"],
          ["Mist", "10% 白", "只绕赤道一圈"],
        ].map(([n, hex, d]) => (
          <div key={n} className="rounded-xl border border-stone-200 p-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full border border-stone-200" style={{ background: hex.startsWith("#") ? hex : "#e7e5e4" }} />
              <p className="text-[13px] font-semibold text-stone-800">{n}</p>
            </div>
            <p className="mt-1 font-mono text-[11px] text-stone-400">{hex}</p>
            <p className="mt-1 text-[11px] text-stone-500">{d}</p>
          </div>
        ))}
      </div>

      <H>04  交付清单</H>
      <ul className="list-disc pl-5 text-[13px] leading-7 text-stone-600">
        <li>主图 3:4，长边 4000px，sRGB，无水印。</li>
        <li>场景 16:9 两张（床头、书桌），人物不出镜。</li>
        <li>材质特写 1:1 三张：木、铜、球体赤道光带。</li>
        <li>PSD 分层：背景 / 底座 / 球体 / 雾 / 高光。</li>
        <li>本页简报 PDF 与提示词原文一并存档。</li>
      </ul>

      <H>05  文案可用句</H>
      <blockquote className="border-l-2 border-amber-700/70 pl-4 text-[13.5px] leading-7 text-stone-700">
        一颗被托住的土星，落在你的桌上。光从深海走到琥珀，声音是没有声音。
      </blockquote>
      <p className="mt-8 text-[10px] text-stone-400">SATURN LAMP · 拍摄简报 v1.0 · 提示词由需求方提供，版式由开帆画布落地</p>
    </Paper>
  );
}

const DIFFUSER_PROMPT = `Cozy product photography of a flame-effect aroma diffuser humidifier, matte white rounded body with realistic warm orange flame light rising from the top, delicate water mist swirling upward like silk ribbons, placed on a natural oak desk corner beside an open book and a steaming cup of coffee, warm ambient night lighting, shallow depth of field, Nordic minimalist interior, ultra-realistic render, 8K, soft cinematic lighting --ar 3:4 --v 6.1 --style raw`;

export function LiveDiffuserBrief() {
  return (
    <Paper>
      <p className="text-[11px] tracking-[0.22em] text-stone-400">LOOKBOOK · LIFESTYLE PRODUCT PHOTOGRAPHY</p>
      <h1 className="mt-3 text-[28px] font-extrabold leading-tight text-stone-900">EMBER MIST</h1>
      <p className="mt-1 text-[15px] text-stone-500">火焰香薰加湿器 · 北欧桌角氛围拍摄简报</p>
      <p className="mt-2 text-[12px] text-stone-400">文档编号 EM-2026-092 · 机密 · 仅供场景主图与详情页使用</p>

      <div className="mt-8 overflow-hidden rounded-sm bg-stone-950 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.55)]">
        <LiveWideCarousel images={DIFFUSER_WIDE} alt="EMBER MIST 主视觉" />
      </div>
      <div className="mt-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800/80">产品叙事</p>
          <p className="mt-3 text-[13.5px] leading-7 text-stone-700">
            EMBER MIST 不是一台上桌的「小家电」，而是一簇被托住的炉火。哑光白圆身压在橡木桌角，顶口升起暖橙火焰灯效，水雾像丝带绕着夜色往上走。旁边是摊开的书和还在冒热气的咖啡——生活先入画，产品后被记住。
          </p>
          <p className="mt-3 text-[13.5px] leading-7 text-stone-700">
            本简报按你提供的提示词直出主视觉，并补齐景深、色温、道具纪律与电商裁切，方便摄影与详情页共用同一口径。
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[12px] sm:grid-cols-3">
            {[
              ["定位", "北欧家居 / 夜间仪式"],
              ["价格带", "¥268 – 398"],
              ["材质", "哑光白 ABS · 雾化芯"],
              ["光效", "仿真火焰 LED"],
              ["比例", "16:9 宽屏主图"],
              ["景深", "f/1.8–2.2 浅景深"],
            ].map(([k, v]) => (
              <div key={k} className="border-t border-stone-200 pt-2">
                <dt className="text-[10px] uppercase tracking-wider text-stone-400">{k}</dt>
                <dd className="mt-0.5 font-medium text-stone-800">{v}</dd>
              </div>
            ))}
          </dl>
      </div>

      <H>01  提示词（原文，不可改语气）</H>
      <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-[#16120e] px-4 py-4 font-mono text-[11.5px] leading-6 text-amber-100/90">{DIFFUSER_PROMPT}</pre>
      <p className="mt-2 text-[11px] text-stone-400">参数：--ar 3:4 --v 6.1 --style raw。禁止加冷白日光灯，只允许钨丝暖色与窗外星光。</p>

      <H>02  镜头与灯光</H>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-stone-900 text-amber-50">
            {["镜号", "用途", "机位", "光", "雾", "备注"].map((h) => (
              <th key={h} className="px-2 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-stone-700">
          {[
            ["B1", "电商主图", "桌面 35° 俯", "台灯暖光 + 火焰自发光", "丝带状上旋", "3:4，书与杯入画"],
            ["B2", "火焰特写", "顶口微距", "压环境、留焰芯", "薄雾一层", "1:1 详情页"],
            ["B3", "夜窗场景", "窗边侧逆", "窗外城市微光", "可见丝带", "16:9 生活方式"],
            ["B4", "材质", "机身 45°", "侧光扫哑光颗粒", "无雾", "白身不可过曝"],
            ["B5", "道具关系", "书页平视", "浅景深虚化后景", "轻雾", "眼镜可入画"],
          ].map((r) => (
            <tr key={r[0]} className="border-b border-stone-100">
              {r.map((c) => (
                <td key={c} className="px-2 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <H>03  色彩与道具纪律</H>
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Flame Orange", "#E07A2F", "焰芯，不可偏红霓虹"],
          ["Mist Ivory", "#E8D9C8", "水雾，保持透明"],
          ["Oak", "#C4A574", "桌面，年轮可读"],
          ["Matte White", "#EFECE7", "机身，禁止高光炸点"],
          ["Night Amber", "#8B5A2B", "台灯环境光"],
          ["Coffee Steam", "8% 白", "杯沿一小缕即可"],
        ].map(([n, hex, d]) => (
          <div key={n} className="rounded-xl border border-stone-200 p-3">
            <div className="flex items-center gap-2">
              <span className="h-6 w-6 rounded-full border border-stone-200" style={{ background: hex.startsWith("#") ? hex : "#e7e5e4" }} />
              <p className="text-[13px] font-semibold text-stone-800">{n}</p>
            </div>
            <p className="mt-1 font-mono text-[11px] text-stone-400">{hex}</p>
            <p className="mt-1 text-[11px] text-stone-500">{d}</p>
          </div>
        ))}
      </div>

      <H>04  交付清单</H>
      <ul className="list-disc pl-5 text-[13px] leading-7 text-stone-600">
        <li>主图 3:4，长边 4000px，sRGB，无水印。</li>
        <li>窗边 16:9 一张，人物不出镜。</li>
        <li>火焰特写 1:1 一张；机身哑光特写一张。</li>
        <li>PSD 分层：背景 / 桌面 / 机身 / 火焰 / 雾 / 书与杯。</li>
        <li>本页简报 PDF 与提示词原文一并存档。</li>
      </ul>

      <H>05  文案可用句</H>
      <blockquote className="border-l-2 border-amber-700/70 pl-4 text-[13.5px] leading-7 text-stone-700">
        一簇不烫手的火，一缕会绕弯的雾。书还摊着，咖啡还热着，夜先安静下来。
      </blockquote>
      <p className="mt-8 text-[10px] text-stone-400">EMBER MIST · 拍摄简报 v1.0 · 提示词由需求方提供，版式由开帆画布落地</p>
    </Paper>
  );
}

/** 灵感主卡：折角纸页会议纪要 */
export function LiveMinutes() {
  return (
    <div className="relative h-full overflow-hidden bg-[#efe6d6] px-6 py-8">
      <article className="relative mx-auto h-full max-w-[520px] bg-white px-8 py-10 shadow-[0_16px_40px_-24px_rgba(28,25,23,0.45)]">
        <span className="pointer-events-none absolute right-0 top-0 h-10 w-10 bg-[#efe6d6] [clip-path:polygon(0_0,100%_0,100%_100%)] shadow-[-4px_4px_0_0_rgba(0,0,0,0.04)]" />
        <h1 className="border-b-2 border-stone-800 pb-3 text-center text-[22px] font-bold tracking-wide text-stone-900">会议纪要</h1>
        <table className="mt-0 w-full border-collapse text-[13px] text-stone-700">
          <tbody>
            <tr>
              <td className="w-[28%] border border-stone-800 px-3 py-2.5 font-medium">日期</td>
              <td className="border border-stone-800 px-3 py-2.5">参办事项</td>
            </tr>
            <tr>
              <td className="border border-stone-800 px-3 py-3">参会人员</td>
              <td className="border border-stone-800 px-3 py-3" />
            </tr>
            <tr>
              <td className="border border-stone-800 px-3 py-3">参会人员</td>
              <td className="border border-stone-800 px-3 py-3" />
            </tr>
            <tr>
              <td colSpan={2} className="border border-stone-800 px-3 py-2 font-medium">
                讨论要点
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="h-28 border border-stone-800" />
            </tr>
            <tr>
              <td colSpan={2} className="border border-stone-800 px-3 py-2 font-medium">
                待办事项
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="h-16 border border-stone-800" />
            </tr>
            <tr>
              <td colSpan={2} className="border border-stone-800 px-3 py-2 font-medium">
                待办事项
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="h-16 border border-stone-800" />
            </tr>
          </tbody>
        </table>
      </article>
    </div>
  );
}

export function LiveRoadmap() {
  const qs = [
    { t: "Q1 第一季度", sub: "1 月 - 3 月", c: "bg-sky-500" },
    { t: "Q2 第二季度", sub: "4 月 - 6 月", c: "bg-emerald-500" },
    { t: "Q3 第三季度", sub: "7 月 - 9 月", c: "bg-orange-500" },
    { t: "Q4 第四季度", sub: "10 月 - 12 月", c: "bg-violet-500" },
  ];
  const rows: { icon: string; name: string; sub: string; cells: [string, string[]][] }[] = [
    {
      icon: "▣",
      name: "核心平台",
      sub: "夯实基础能力，提升平台竞争力",
      cells: [
        ["平台架构升级", ["技术架构优化", "性能提升 30%"]],
        ["核心模块重构", ["模块解耦与重构", "可扩展性增强"]],
        ["开放平台上线", ["API 能力开放", "开发者生态建设"]],
        ["智能化升级", ["AI 能力集成", "智能决策支持"]],
      ],
    },
    {
      icon: "☺",
      name: "客户体验",
      sub: "优化产品体验，提升客户满意度",
      cells: [
        ["用户体验优化", ["关键流程简化", "界面体验升级"]],
        ["个性化服务上线", ["用户画像完善", "个性化推荐"]],
        ["多端体验一致", ["跨端体验优化", "交互一致性提升"]],
        ["客户成功体系", ["客户旅程优化", "满意度提升"]],
      ],
    },
    {
      icon: "↗",
      name: "业务增长",
      sub: "拓展业务场景，驱动商业价值",
      cells: [
        ["重点场景拓展", ["行业解决方案", "场景化能力上线"]],
        ["生态合作深化", ["合作伙伴计划", "生态能力集成"]],
        ["新市场拓展", ["区域市场覆盖", "本地化支持"]],
        ["商业模式创新", ["增值服务上线", "收入模式优化"]],
      ],
    },
    {
      icon: "◆",
      name: "运营效率",
      sub: "提升运营效率，降低运营成本",
      cells: [
        ["流程自动化", ["自动化流程上线", "人效提升 20%"]],
        ["数据驱动运营", ["数据看板开上线", "运营洞察优化"]],
        ["智能运维升级", ["监控告警优化", "故障自愈能力"]],
        ["成本优化", ["资源利用优化", "成本降低 15%"]],
      ],
    },
  ];
  return (
    <Paper>
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-[10px] font-bold text-white">智</span>
          <div>
            <p className="text-[13px] font-semibold text-stone-800">智远咨询</p>
            <p className="text-[10px] text-stone-400">ZHIYUAN CONSULTING</p>
          </div>
        </div>
        <p className="text-[11px] text-stone-400">洞察未来 · 创造价值 · 驱动增长</p>
      </header>
      <h1 className="mt-8 text-[32px] font-extrabold tracking-tight text-stone-900">2026 年度产品路线图</h1>
      <p className="mt-1 text-[13px] text-stone-500">以客户价值为中心，持续创新，驱动产品与业务共同成长</p>
      <Section n="路线图概览">
        <p className="mb-3 text-[12px] leading-6 text-stone-500">
          本路线图展示了 2026 年度的核心产品规划与关键里程碑，涵盖四个季度的主要目标与交付成果，我们将保持灵活迭代，快速响应市场与客户需求变化。
        </p>
        <div className="overflow-hidden rounded-xl border border-stone-200">
          <div className="grid grid-cols-[140px_1fr_1fr_1fr_1fr] text-center text-[11px] font-semibold text-white">
            <div className="bg-stone-50" />
            {qs.map((q) => (
              <div key={q.t} className={`${q.c} px-2 py-2`}>
                {q.t}
                <div className="font-normal opacity-90">{q.sub}</div>
              </div>
            ))}
          </div>
          {rows.map((r) => (
            <div key={r.name} className="grid grid-cols-[140px_1fr_1fr_1fr_1fr] border-t border-stone-100 text-[11px]">
              <div className="bg-stone-50 p-2">
                <p className="font-semibold text-stone-800">
                  {r.icon} {r.name}
                </p>
                <p className="mt-0.5 text-[10px] leading-4 text-stone-400">{r.sub}</p>
              </div>
              {r.cells.map(([h, ls]) => (
                <div key={h} className="p-2">
                  <p className="font-semibold text-stone-800">{h}</p>
                  <ul className="mt-1 list-disc pl-3 text-stone-500">
                    {ls.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>
      <Section n="年度目标">
        <div className="grid grid-cols-4 gap-2">
          {[
            ["客户满意度", "≥ 90%"],
            ["市场增长率", "≥ 25%"],
            ["产品可用性", "≥ 99.9%"],
            ["运营成本降低", "≥ 15%"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-stone-200 p-3 text-center">
              <p className="text-[11px] text-stone-400">{k}</p>
              <p className="mt-1 text-lg font-bold text-sky-600">{v}</p>
            </div>
          ))}
        </div>
      </Section>
      <p className="mt-4 rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-800">
        说明：本路线图为规划性内容，具体计划将根据市场变化、客户反馈及业务优先级进行持续调整与迭代。
      </p>
      <footer className="mt-6 flex justify-between text-[10px] text-stone-400">
        <span>文档版本：V1.0</span>
        <span>发布日期：2025 年 5 月 20 日</span>
        <span>保密级别：内部使用</span>
      </footer>
    </Paper>
  );
}

export function LiveMarketing() {
  return (
    <Paper>
      <header className="flex items-center justify-between text-[11px] text-stone-400">
        <span className="flex items-center gap-1.5 font-medium text-sky-600">△ 品牌名称</span>
        <span>新品营销方案 ｜ 2024年5月20日</span>
      </header>
      <div className="mt-6 grid grid-cols-[1.2fr_0.8fr] gap-6">
        <div>
          <h1 className="text-[32px] font-extrabold tracking-tight text-stone-900">新品营销方案</h1>
          <div className="mt-2 h-1 w-16 bg-sky-500" />
          <p className="mt-3 text-[14px] font-semibold text-sky-600">新品上市，引爆关注，驱动增长</p>
          <p className="mt-2 text-[12px] leading-6 text-stone-500">
            本方案通过精准的用户洞察、整合的传播策略与节奏化执行，最大化新品声量与转化，达成销量与品牌双重增长目标。
          </p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-sky-50 to-stone-100 p-4">
          <p className="text-[11px] text-stone-400">BRAND · SKINCARE</p>
          <p className="mt-8 text-center text-2xl font-light tracking-[0.3em] text-stone-300">PRODUCT</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-4 gap-2 border-y border-stone-100 py-3 text-[11px]">
        {[
          ["核心目标", "提升新品知名度与销量"],
          ["活动周期", "4周（预热1周 + 上市3周）"],
          ["核心人群", "Z世代年轻消费人群"],
          ["重点目标", "销售额增长 300万+"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="font-semibold text-sky-700">{k}</p>
            <p className="mt-0.5 text-stone-500">{v}</p>
          </div>
        ))}
      </div>
      <Section n="1. 目标人群洞察">
        <div className="grid grid-cols-3 gap-3">
          {[
            ["精致生活追求者", "22-28岁 ｜ 女性 ｜ 一线城市", "注重生活品质与产品颜值", "乐于分享，受KOL种草影响大", "关注成分与功效，理性消费", "核心诉求  安全有效、颜值在线、生活态度认同"],
            ["成分功效关注者", "20-26岁 ｜ 男性 ｜ 新一线城市", "关注成分与科技，理性决策", "喜欢研究测评与对比", "追求高性价比与口碑推荐", "核心诉求  成分安全、效果显著、专业背书"],
            ["潮流尝新玩家", "18-24岁 ｜ 女性 ｜ 二线城市", "热爱尝新，追逐潮流热点", "活跃于社交平台，互动性强", "冲动消费比例高，重体验感", "核心诉求  新鲜有趣、体验感强、社交货币"],
          ].map((p) => (
            <article key={p[0]} className="rounded-xl border border-stone-200 p-3">
              <p className="text-[13px] font-semibold text-stone-800">{p[0]}</p>
              {p.slice(1, 5).map((l) => (
                <p key={l} className="mt-1 text-[11px] text-stone-500">
                  {l}
                </p>
              ))}
              <p className="mt-2 rounded-lg bg-sky-50 px-2 py-1 text-[10px] text-sky-700">{p[5]}</p>
            </article>
          ))}
        </div>
      </Section>
      <Section n="2. 渠道策略与内容规划">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="bg-sky-50 text-sky-800">
                {["渠道", "平台示例", "核心目标", "主要内容方向", "形式", "关键KPI"].map((h) => (
                  <th key={h} className="border border-sky-100 px-2 py-1.5 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-stone-600">
              {[
                ["社交媒体", "小红书 / 抖音 / 微博", "种草引爆 提升声量", "产品种草、口碑分享、场景化体验", "图文笔记、短视频、话题挑战", "曝光量、互动量"],
                ["内容KOL", "小红书、B站、抖音", "专业背书 建立信任", "成分科普、测评实证、真实体验", "测评视频、长图文、Vlog", "阅读量、转化率"],
                ["电商平台", "天猫 / 京东 / 抖音商城", "引流转化 促进销售", "新品首发、优惠促销、套装组合", "主图视频、详情页、直播带货", "访客数、加购率"],
                ["品牌自有阵地", "微信 / 邮件", "沉淀用户 促进复购", "品牌故事、会员权益、用户运营", "公众号推文、社群活动", "新增会员、复购率"],
                ["线下 & 体验", "快闪店、线下门店", "体验种草 口碑扩散", "产品体验、互动打卡、口碑传播", "快闪体验、试用装派发", "到店人数、UGC产出"],
              ].map((row) => (
                <tr key={row[0]}>
                  {row.map((c) => (
                    <td key={c} className="border border-stone-100 px-2 py-1.5">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section n="3. 4周传播节奏规划">
        <div className="grid grid-cols-4 gap-2 text-[11px]">
          {[
            ["Week 1 预热期（第1周）", "bg-sky-50", ["悬念海报/倒计时预热", "KOL剧透/开箱预告", "社交平台话题发起"], "KPI：曝光量 1000万+"],
            ["Week 2 上市期（第2周）", "bg-emerald-50", ["新品发布会/直播首发", "KOL集中测评种草", "电商平台首发活动"], "KPI：销售额 150万+"],
            ["Week 3 扩散期（第3周）", "bg-amber-50", ["口碑扩散，场景渗透", "社群互动/口碑分享", "多平台内容持续扩散"], "KPI：曝光量 2000万+"],
            ["Week 4 成熟期（第4周）", "bg-violet-50", ["持续转化，沉淀用户", "促销活动/会员专属福利", "复购引导 / 组合推荐"], "KPI：销售额 150万+"],
          ].map(([t, bg, items, kpi]) => (
            <div key={t as string} className={`rounded-xl p-3 ${bg}`}>
              <p className="font-semibold text-stone-800">{t as string}</p>
              <ul className="mt-2 list-disc pl-4 text-stone-600">
                {(items as string[]).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <p className="mt-2 font-medium text-sky-700">{kpi as string}</p>
            </div>
          ))}
        </div>
      </Section>
      <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
        <div>
          <p className="font-semibold text-stone-800">4. 预算分配（建议）</p>
          <ul className="mt-2 space-y-1 text-stone-600">
            <li>社媒投放 40%</li>
            <li>KOL合作 25%</li>
            <li>电商活动 20%</li>
            <li>内容制作 10%</li>
            <li>线下活动 5%</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-stone-800">5. 风险预案</p>
          <ul className="mt-2 list-disc pl-4 text-stone-600">
            <li>舆情风险：建立舆情监测机制</li>
            <li>供应链风险：提前锁定产能</li>
            <li>投放效果不及预期：动态优化</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-stone-800">6. 方案评估</p>
          <p className="mt-2 text-stone-600">曝光量、话题热度、媒体报道量、互动量、UGC内容量、成交额、转化率、ROI、会员增长、复购率</p>
        </div>
      </div>
      <p className="mt-6 text-center text-[12px] font-medium text-sky-700">让每一次新品上市，都成为品牌增长的起点！</p>
    </Paper>
  );
}

export function LiveSaaSBP() {
  const bars = [197, 232, 271, 315, 362];
  return (
    <Paper>
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sky-600">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white">☁</span>
          <div>
            <p className="text-[13px] font-semibold">CloudPro</p>
            <p className="text-[10px] text-stone-400">让业务，更高效</p>
          </div>
        </div>
        <span className="text-[11px] text-stone-400">机密文件</span>
      </header>
      <h1 className="mt-8 text-[32px] font-extrabold text-stone-900">SaaS 商业计划书</h1>
      <div className="mt-1 h-1 w-14 bg-sky-500" />
      <p className="mt-2 text-[13px] text-stone-500">智能化业务管理解决方案</p>
      <p className="mt-3 text-[12px] text-stone-400">公司名称：云创科技有限公司 ｜ 日期：2024年5月20日</p>
      <Section n="01  市场机会">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-stone-200 p-3">
            <p className="text-[12px] font-semibold">全球 SaaS 市场规模</p>
            <p className="text-[10px] text-stone-400">单位：十亿美元</p>
            <div className="mt-3 flex h-28 items-end gap-2">
              {bars.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[9px] text-stone-500">{v}</span>
                  <div className="w-full rounded-t bg-sky-500" style={{ height: `${v / 4}px` }} />
                  <span className="text-[9px] text-stone-400">{2022 + i}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-stone-200 p-3">
            <p className="text-[12px] font-semibold">中国 SaaS 市场增长趋势</p>
            <p className="mt-6 text-2xl font-bold text-sky-600">1,668</p>
            <p className="text-[11px] text-stone-500">2026E 十亿元 · 年复合增长率 &gt; 25%</p>
            <p className="mt-3 text-[11px] leading-5 text-stone-500">2022 682 → 2023 868 → 2024E 1,088 → 2025E 1,354</p>
          </div>
          <div className="rounded-xl border border-stone-200 p-3">
            <p className="text-[12px] font-semibold">细分市场分布（中国，2024E）</p>
            <p className="mt-4 text-center text-xl font-bold text-sky-600">1,088 十亿元</p>
            <ul className="mt-2 space-y-1 text-[11px] text-stone-600">
              <li>业务管理 32%</li>
              <li>财务管理 20%</li>
              <li>人力资源 16%</li>
              <li>营销管理 14%</li>
              <li>协同与效率 10% · 其他 8%</li>
            </ul>
          </div>
        </div>
      </Section>
      <Section n="02  收入模式">
        <p className="mb-2 text-[12px] text-stone-500">我们采用订阅制收费模式，提供标准化产品与增值服务，满足不同规模企业需求。</p>
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-sky-600 text-white">
              {["版本", "基础版", "专业版", "企业版", "定制版"].map((h) => (
                <th key={h} className="px-2 py-1.5 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-stone-100">
              <td className="px-2 py-1.5 text-stone-400">定价（元/用户/月）</td>
              <td className="px-2 py-1.5">¥59</td>
              <td className="px-2 py-1.5">¥129</td>
              <td className="px-2 py-1.5">¥239</td>
              <td className="px-2 py-1.5">定制报价</td>
            </tr>
            <tr className="border-b border-stone-100">
              <td className="px-2 py-1.5 text-stone-400">核心功能</td>
              <td className="px-2 py-1.5">任务管理、基础报表、成员协作</td>
              <td className="px-2 py-1.5">项目管理、数据分析、流程自动化、API</td>
              <td className="px-2 py-1.5">高级分析、权限、多组织、安全审计</td>
              <td className="px-2 py-1.5">私有化部署、定制开发、SLA</td>
            </tr>
            <tr>
              <td className="px-2 py-1.5 text-stone-400">存储 / 支持</td>
              <td className="px-2 py-1.5">10GB · 在线支持</td>
              <td className="px-2 py-1.5">50GB · 优先支持</td>
              <td className="px-2 py-1.5">200GB · 专属客户成功</td>
              <td className="px-2 py-1.5">不限 · 专属团队</td>
            </tr>
          </tbody>
        </table>
      </Section>
      <p className="mt-4 text-[11px] text-stone-400">收入构成：订阅费（主体）+ 增值服务费 + 实施与定制开发费 ｜ 第 1 页 / 共 20 页</p>
    </Paper>
  );
}

export function LivePRD() {
  return (
    <Paper>
      <p className="text-center text-[11px] text-stone-400">文档版本：v1.0 ｜ 作者：产品团队 ｜ 日期：2024-05-20 ｜ 状态：草稿</p>
      <h1 className="mt-4 text-center text-[26px] font-extrabold text-stone-900">PRD · 团队周报功能</h1>
      <H>1. 背景与目标</H>
      <p className="text-[12px] leading-6 text-stone-600">
        <b>背景：</b>目前团队成员通过 IM 或文档工具手动汇报工作进展，信息分散，缺乏沉淀与统计，不利于管理者掌握团队整体情况。
        <br />
        <b>目标：</b>提供结构化的团队周报功能，帮助团队成员高效提交周报，帮助管理者便捷查看、汇总与跟进，沉淀团队工作数据。
      </p>
      <H>2. 范围</H>
      <ul className="list-disc pl-5 text-[12px] leading-6 text-stone-600">
        <li>MVP 范围：周报填写与提交、团队周报列表与查看、评论与反馈、统计概览</li>
        <li>非 MVP 范围：周报模板自定义、跨团队汇总、与绩效强关联</li>
      </ul>
      <H>3. 用户角色</H>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-stone-50">
            <th className="border border-stone-200 px-2 py-1 text-left">角色</th>
            <th className="border border-stone-200 px-2 py-1 text-left">描述</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["成员（提交人）", "填写并提交周报，查看自己的历史周报与反馈"],
            ["管理者", "查看团队周报列表、查看详情、进行评论与反馈、查看统计概览"],
            ["管理员（可选）", "配置周报规则（提交截止时间、可见范围等）"],
          ].map(([a, b]) => (
            <tr key={a}>
              <td className="border border-stone-200 px-2 py-1">{a}</td>
              <td className="border border-stone-200 px-2 py-1">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <H>4. 用户故事（User Stories）</H>
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        {[
          ["US1 作为成员，我希望每周填写周报", "以便系统化地记录我的工作进展", ["能在指定入口进入周报填写页面", "能填写各项内容并保存草稿", "能在截止时间前提交周报", "提交后可查看历史记录"]],
          ["US2 作为管理者，我希望查看团队周报", "以便了解团队整体工作进展", ["能按周报查看团队成员的周报列表", "能查看周报详情", "未提交情况清晰展示", "支持按成员/时间筛选与搜索"]],
          ["US3 作为管理者，我希望对周报进行反馈", "以便与成员协作和跟进", ["能对周报进行评论", "成员能收到反馈通知", "评论记录可追溯"]],
        ].map(([t, why, ac]) => (
          <article key={t as string} className="rounded-xl border border-stone-200 p-3">
            <p className="font-semibold text-stone-800">{t as string}</p>
            <p className="mt-1 text-stone-500">{why as string}</p>
            <p className="mt-2 font-medium text-stone-700">验收标准：</p>
            <ul className="mt-1 list-disc pl-4 text-stone-600">
              {(ac as string[]).map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
      <H>5. 功能需求</H>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="bg-stone-50">
            {["编号", "功能点", "描述", "优先级"].map((h) => (
              <th key={h} className="border border-stone-200 px-2 py-1 text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ["F1", "周报填写与提交", "支持填写本周工作总结、下周计划、遇到的问题与风险、需要的支持等内容；支持保存草稿与提交。", "P0"],
            ["F2", "周报列表", "按周展示团队成员周报提交状态与摘要信息，支持查看详情。", "P0"],
            ["F3", "周报详情", "展示完整内容、评论与反馈记录、提交时间等。", "P0"],
            ["F4", "评论与反馈", "管理者可对周报进行评论；成员可回复；支持 @ 提醒。", "P0"],
            ["F5", "统计概览", "展示团队周报提交率、按时提交率等基础统计数据与趋势图。", "P1"],
            ["F6", "通知提醒", "周报截止前提醒、未提交提醒、评论回复提醒。", "P1"],
            ["F7", "权限与可见范围", "成员仅可见自己的周报；管理者可见团队范围内周报。", "P1"],
          ].map((r) => (
            <tr key={r[0]}>
              {r.map((c) => (
                <td key={c} className="border border-stone-200 px-2 py-1">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <H>7. 业务流程（简述）</H>
      <p className="flex flex-wrap items-center gap-1 text-[11px] text-stone-700">
        {["成员填写周报（保存草稿）", "成员提交周报", "管理者查看周报", "管理者评论/反馈", "成员查看反馈并回复"].map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            <span className="rounded-full border border-stone-200 bg-white px-2 py-1">{s}</span>
            {i < 4 && <span className="text-stone-300">→</span>}
          </span>
        ))}
      </p>
      <H>9. 验收标准</H>
      <p className="text-[12px] text-stone-600">AC1 成员可提交周报：在截止时间前，成员可填写必填内容并成功提交，状态为「已提交」。</p>
      <p className="mt-6 text-[10px] text-stone-400">注：本文档为产品需求规格说明（PRD）模板示例，具体需求以最终评审结论为准。</p>
    </Paper>
  );
}

export function LivePress() {
  return (
    <Paper>
      <p className="text-[11px] tracking-[0.2em] text-stone-400">PRESS RELEASE · FOR IMMEDIATE RELEASE</p>
      <h1 className="mt-4 text-[26px] font-extrabold leading-snug text-stone-900">开帆画布发布「对话即成品」工作台，把研究、文档与 PPT 收进同一会话</h1>
      <p className="mt-3 text-[12px] text-stone-400">上海 / 2026 年 5 月 20 日</p>
      <p className="mt-5 text-[13px] leading-7 text-stone-600">
        今日，开帆画布宣布面向内容与增长团队开放新一代工作台：用户用自然语言描述任务，系统直接交付可翻页 PPT、可复制正文与可切换原型，而不是再给一段提示词草稿。
      </p>
      <p className="mt-3 text-[13px] leading-7 text-stone-600">
        「决策层要的是能上会的成品。」产品负责人表示，栏目级预览与品牌资产贯穿，是这次发布的两条主线。早期客户已将周报、路演与研究报告的周转从「隔夜」压到「当午」。
      </p>
      <p className="mt-6 text-[11px] text-stone-400">媒体联络：press@opencanvas.example · 公司介绍见附件</p>
    </Paper>
  );
}

export function LiveFinance() {
  const rows = [
    ["收入", "480", "920", "1,680"],
    ["毛利", "312", "644", "1,260"],
    ["销售费用", "96", "156", "252"],
    ["研发", "120", "180", "240"],
    ["经营利润", "48", "188", "520"],
  ];
  return (
    <Paper>
      <h1 className="text-[26px] font-extrabold text-stone-900">三年财务预测（示意）</h1>
      <p className="mt-1 text-[12px] text-stone-400">单位：万元 · 订阅制 SaaS · 不含融资稀释</p>
      <table className="mt-6 w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-emerald-700 text-white">
            {["科目", "Y1", "Y2", "Y3"].map((h) => (
              <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]} className="border-b border-stone-100">
              {r.map((c) => (
                <td key={c} className="px-2 py-1.5 text-stone-700">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 text-[12px] leading-6 text-stone-600">关键假设：Y1 席位 80、ARPU ¥6,000；Y2 留存 88%、扩科 1.3；盈亏平衡落在 Y2 Q3。CAC 1,800 / LTV 14,400。</p>
    </Paper>
  );
}

export function LiveLesson() {
  return (
    <Paper>
      <p className="text-[11px] text-stone-400">七年级 · 语文 · 第 12 课</p>
      <h1 className="mt-2 text-[26px] font-extrabold text-stone-900">教案：借景抒情怎么写</h1>
      <H>教学目标</H>
      <ul className="list-disc pl-5 text-[12px] leading-6 text-stone-600">
        <li>能找出景物描写中的情感词</li>
        <li>会用「所见—所感—所悟」写 120 字片段</li>
      </ul>
      <H>教学过程</H>
      <ol className="list-decimal pl-5 text-[12px] leading-6 text-stone-600">
        <li>导入：两张同景异情的照片（3′）</li>
        <li>新授：圈画范文中的感官词（12′）</li>
        <li>练习：当堂写一段黄昏校园（15′）</li>
        <li>小结：展示 2 份习作，对照目标（8′）</li>
      </ol>
      <H>作业</H>
      <p className="text-[12px] text-stone-600">回家改写早晨上学路上，不少于 150 字，明天互评。</p>
    </Paper>
  );
}

export function LiveQuiz() {
  const qs = [
    ["1. 毛利率上升通常说明", "A 费用膨胀  B 结构改善  C 税率变化", "B。收入结构或成本下降优先于费用故事。"],
    ["2. CAC 高于 LTV 时应", "A 加大投放  B 停投复盘漏斗  C 先融资", "B。单位经济为负时放量只放大亏损。"],
    ["3. 次月留存 +6pt 更接近", "A 获客质量  B 品牌曝光  C 办公租赁", "A。留存是产品与人群匹配的领先指标。"],
  ];
  return (
    <Paper>
      <h1 className="text-[26px] font-extrabold text-stone-900">练习题与解析</h1>
      <p className="mt-1 text-[12px] text-stone-400">商业分析入门 · 10 分钟自测</p>
      {qs.map(([q, opt, a]) => (
        <section key={q} className="mt-5 rounded-xl border border-stone-200 p-3">
          <p className="text-[13px] font-semibold text-stone-800">{q}</p>
          <p className="mt-1 text-[12px] text-stone-500">{opt}</p>
          <p className="mt-2 text-[12px] text-emerald-700">解析：{a}</p>
        </section>
      ))}
    </Paper>
  );
}

export function LiveResume() {
  return (
    <Paper>
      <h1 className="text-[26px] font-extrabold text-stone-900">林启明</h1>
      <p className="text-[12px] text-stone-500">增长产品 · 上海 · lin@example.com</p>
      <H>求职意向</H>
      <p className="text-[12px] text-stone-600">高级产品经理（内容工具 / AI 工作流）</p>
      <H>经历（STAR 改写）</H>
      <p className="text-[13px] font-semibold text-stone-800">NovaDesk · 产品负责人 · 2023—今</p>
      <ul className="mt-1 list-disc pl-5 text-[12px] leading-6 text-stone-600">
        <li>把「聊天草稿」改成栏目成品预览，周报交付周期 11→7 天。</li>
        <li>主导积分与模型网关，毛利提升 9pt，P0 缺陷 -40%。</li>
      </ul>
    </Paper>
  );
}

export function LiveMindmap() {
  const branches: { h: string; ls: string[] }[] = [
    { h: "对话即成品", ls: ["文档", "PPT", "原型", "分镜"] },
    { h: "栏目画布", ls: ["案例可预览", "同款一键", "品牌色贯穿"] },
    { h: "增长", ls: ["免费额度", "席位", "积分包"] },
  ];
  return (
    <Paper>
      <h1 className="text-[26px] font-extrabold text-stone-900">思维导图大纲</h1>
      <p className="mt-1 text-[12px] text-stone-400">中心主题：开帆画布产品叙事</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {branches.map((b) => (
          <div key={b.h} className="rounded-2xl border border-sky-100 bg-sky-50/60 p-3">
            <p className="text-[13px] font-semibold text-sky-800">{b.h}</p>
            <ul className="mt-2 list-disc pl-4 text-[12px] text-stone-600">
              {b.ls.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Paper>
  );
}

export function LiveStudy() {
  const weeks = [
    ["W1-2", "词汇 800 + 听力精听 20′/天"],
    ["W3-6", "阅读逻辑链；每周 1 套模考"],
    ["W7-10", "写作题库 12 题；口语模拟 3 次/周"],
    ["W11-12", "全真模考 + 错题回炉"],
  ];
  return (
    <Paper>
      <h1 className="text-[26px] font-extrabold text-stone-900">3 个月备考计划 · 雅思 7 分</h1>
      <div className="mt-5 space-y-2">
        {weeks.map(([w, d]) => (
          <div key={w} className="flex gap-3 rounded-xl border border-stone-200 p-3 text-[12px]">
            <span className="w-14 shrink-0 font-semibold text-sky-700">{w}</span>
            <span className="text-stone-600">{d}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[12px] text-stone-500">每周日复盘：模考分差 &gt;0.5 则加练弱项，不扩新资料。</p>
    </Paper>
  );
}

export function LiveWeekly() {
  return (
    <Paper>
      <p className="text-[11px] text-stone-400">第 19 周 · 增长组 · 2026-05-09</p>
      <h1 className="mt-2 text-[26px] font-extrabold text-stone-900">本周周报</h1>
      <H>本周完成</H>
      <ul className="list-disc pl-5 text-[12px] leading-6 text-stone-600">
        <li>灵感页四卡 Live 预览上线，PPT 可翻页。</li>
        <li>分类案例补齐，每类不少于 10 个可交互成品。</li>
      </ul>
      <H>进行中</H>
      <p className="text-[12px] text-stone-600">知识库引用与积分账单联调，预计周三提测。</p>
      <H>风险</H>
      <p className="text-[12px] text-stone-600">模型配额周五见顶，需演示模式兜底。</p>
      <H>下周计划</H>
      <p className="text-[12px] text-stone-600">补教案/财报以外的文档分流，收一轮设计走查。</p>
    </Paper>
  );
}

export function LiveExcel() {
  return (
    <Paper>
      <h1 className="text-[26px] font-extrabold text-stone-900">Excel 公式助手</h1>
      <p className="mt-1 text-[12px] text-stone-400">需求：按部门去重统计本月成交额</p>
      <pre className="mt-4 overflow-x-auto rounded-xl bg-stone-900 p-4 text-[12px] leading-6 text-emerald-200">
{`=SUMIFS($D:$D,$A:$A,G2,$C:$C,">="&$H$1)
=UNIQUE(FILTER(A2:A,C2:C>=H1))
=XLOOKUP(G2,部门表[名称],部门表[负责人])`}
      </pre>
      <ul className="mt-4 list-disc pl-5 text-[12px] leading-6 text-stone-600">
        <li>G2 为部门名，H1 为本月 1 日</li>
        <li>先 UNIQUE 再 SUMIFS，避免透视表刷新遗漏</li>
        <li>常见错：区域长短不一致、文本数字混用</li>
      </ul>
    </Paper>
  );
}

export function LiveKids() {
  return (
    <Paper>
      <p className="text-[11px] text-stone-400">适合 5 岁 · 睡前 8 分钟</p>
      <h1 className="mt-2 text-[26px] font-extrabold text-stone-900">月亮把袜子收走了</h1>
      <p className="mt-4 text-[13px] leading-7 text-stone-600">
        小鹿把一只红袜子晾在窗台。月亮探进来，说：借我当小船，明天一早还你，还带一颗露珠。第二天，袜子回来了，露珠在脚尖上闪了一下，小鹿笑着去上学。
      </p>
      <p className="mt-3 text-[12px] text-stone-500">我们可以把用过的东西好好还回去。—— 今晚的一句</p>
    </Paper>
  );
}

export function LiveChangelog() {
  const rows = [
    ["v1.9", "灵感分类每类补齐可交互 Live 案例"],
    ["v1.8", "PPT 弹层可翻页，原型点机身切屏"],
    ["v1.7", "数据大屏 KPI 可点选"],
  ];
  return (
    <Paper>
      <h1 className="text-[26px] font-extrabold text-stone-900">产品更新日志</h1>
      <ul className="mt-5 space-y-3">
        {rows.map(([v, d]) => (
          <li key={v} className="rounded-xl border border-stone-200 p-3">
            <p className="text-[13px] font-semibold text-sky-800">{v}</p>
            <p className="mt-1 text-[12px] text-stone-600">{d}</p>
          </li>
        ))}
      </ul>
    </Paper>
  );
}

/** 制度 / 合同 / 手册：条款排版，不再误用路线图 */
export function LiveOffice({ title }: { title: string }) {
  const kind = /合同|协议|授权/.test(title) ? "contract" : /制度|规范|考勤|报销|手册|绩效|招聘/.test(title) ? "policy" : "memo";
  const clauses =
    kind === "contract"
      ? [
          ["第一条 合作范围", "甲方委托乙方按附件一交付文档、演示与实施支持；超出范围另行报价。"],
          ["第二条 费用与支付", "合同总额按里程碑支付：签约 40%、验收 50%、质保满 10%。"],
          ["第三条 保密", "双方对对方商业秘密承担保密义务，期限至合作结束后 24 个月。"],
          ["第四条 知识产权", "交付物著作权归甲方；乙方保留可复用的方法论与模板。"],
          ["第五条 违约", "逾期超过 10 个工作日，按未完成部分日万分之三计违约金。"],
        ]
      : kind === "policy"
        ? [
            ["1. 目的", `${title} 用于统一执行口径，减少口头约定。`],
            ["2. 适用范围", "全体全职、兼职与驻场外包人员。"],
            ["3. 核心规定", "事前申请、事中留痕、事后抽检；例外需直属主管书面同意。"],
            ["4. 流程", "发起 → 审批 → 归档；电子流与纸质原件效力等同。"],
            ["5. 奖惩", "首次口头提醒，二次书面，三次与绩效挂钩。"],
          ]
        : [
            ["摘要", `关于「${title}」的内部说明，供对齐口径。`],
            ["背景", "信息散落在群聊与个人文档，需要一份可引用的正文。"],
            ["结论", "先按本页结构填写，评审后再改版本号。"],
            ["下一步", "负责人补充数据、法务过条款、产品对齐验收。"],
          ];
  return (
    <Paper>
      <p className="text-[11px] text-stone-400">内部文件 · 可划词复制 · 非正式法律意见</p>
      <h1 className="mt-3 text-[26px] font-extrabold text-stone-900">{title}</h1>
      <div className="mt-2 h-1 w-14 bg-sky-500" />
      {clauses.map(([h, b]) => (
        <section key={h} className="mt-5">
          <p className="text-[13px] font-semibold text-stone-800">{h}</p>
          <p className="mt-1 text-[12px] leading-6 text-stone-600">{b}</p>
        </section>
      ))}
      <p className="mt-8 text-[10px] text-stone-400">版本 V1.0 · 点击「以此创作」可生成同结构成稿</p>
    </Paper>
  );
}

function Paper({ children }: { children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto bg-[#d9d2c5] px-3 py-6 sm:px-10">
      <article className="mx-auto max-w-[920px] bg-[#fffcf7] px-8 py-8 shadow-[0_18px_60px_-20px_rgba(28,25,23,0.45)] sm:px-14 sm:py-12">
        {children}
      </article>
    </div>
  );
}

function Section({ n, children }: { n: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-stone-800">
        <span className="inline-block h-4 w-1 rounded bg-sky-500" />
        {n}
      </p>
      {children}
    </section>
  );
}

function H({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-5 text-[14px] font-bold text-stone-800">{children}</h2>;
}
