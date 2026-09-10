"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

/** 每张咨询卡独立大纲与版式，禁止 12 卡共用一副骨架。示意非实测。 */

type Kind = "cover" | "photo" | "photoL" | "cards" | "quote" | "table" | "time" | "split" | "close";

type Slide = {
  kind: Kind;
  kicker: string;
  title: string;
  sub?: string;
  photo?: string;
  items?: { h: string; b: string }[];
  rows?: string[][];
  steps?: { t: string; d: string }[];
};

const P = {
  hero: "/cases/ppt/cover-hero.jpg",
  launch: "/cases/ppt/product-launch.jpg",
  report: "/cases/ppt/work-report.jpg",
  pitch: "/cases/ppt/pitch.jpg",
  proposal: "/cases/ppt/proposal.jpg",
  board: "/cases/ppt/scene-board.jpg",
  data: "/cases/ppt/scene-data.jpg",
  navy: "/cases/ppt/bg-navy.jpg",
  gold: "/cases/ppt/bg-gold.jpg",
};

function deckFor(title?: string): Slide[] {
  const t = title ?? "";
  if (t.includes("汇报") || t.includes("金字塔")) return reportDeck();
  if (t.includes("路演") || t.includes("融资")) return pitchDeck();
  if (t.includes("提案")) return proposalDeck();
  if (t.includes("培训") || t.includes("PREP")) return prepDeck();
  if (t.includes("年终")) return yearDeck();
  if (t.includes("行业")) return industryDeck();
  if (t.includes("FAB") || t.includes("面谈")) return fabDeck();
  if (t.includes("复盘")) return retroDeck();
  if (t.includes("竞品")) return competeDeck();
  if (t.includes("周会")) return weeklyDeck();
  if (t.includes("董事会") || t.includes("地图")) return boardDeck();
  return scqaDeck(t);
}

function scqaDeck(title: string): Slide[] {
  return [
    { kind: "cover", kicker: "AURA ONE  ·  发布会预审", title: title || "曜界眼镜发布 SCQA", sub: "空间计算眼镜概念稿 · 示意画面须标注 · 禁止无边界全息承诺", photo: P.launch },
    { kind: "cards", kicker: "地图", title: "四句话讲完发布", items: [
      { h: "S", b: "旗舰手机已到顶，下一块屏要戴在脸上" },
      { h: "C", b: "现有头显仍像头盔，无法全天佩戴" },
      { h: "Q", b: "能否先做观影+窗口，而不是全息办公" },
      { h: "A", b: "曜界 AURA ONE：基础观影与空间窗口两档" },
    ]},
    { kind: "photo", kicker: "S  情境", title: "客厅已是第二块屏，办公室还没有", sub: "用户接受电视级观影，不接受全天候头盔。", photo: P.board },
    { kind: "quote", kicker: "C  冲突", title: "重量、续航、社交尴尬，三件同时未解。", sub: "不能用「无边界全息」掩盖工程约束。" },
    { kind: "photoL", kicker: "Q  疑问", title: "先切哪一档体验？", sub: "基础观影可演示；空间窗口待主机供电。", photo: P.data },
    { kind: "split", kicker: "A  答案", title: "两档，不装第三档", items: [
      { h: "观影", b: "暗室示意，不等于白日效果" },
      { h: "窗口", b: "依赖兼容主机计算与供电" },
      { h: "不做", b: "不承诺无边界全息办公" },
    ]},
    { kind: "table", kicker: "口径", title: "发布词 vs 工程事实", rows: [
      ["对外", "对内", "禁止"],
      ["空间窗口", "需主机", "独立全息电脑"],
      ["钛银配色", "规划件", "已量产实拍"],
      ["示意画面", "概念渲染", "用户实拍"],
    ]},
    { kind: "time", kicker: "发布路径", title: "从预审到站会", steps: [
      { t: "T-6 周", d: "锁两档体验边界" },
      { t: "T-3 周", d: "暗室样机，白日图不下发" },
      { t: "站会日", d: "只演示观影+窗口" },
    ]},
    { kind: "close", kicker: "请批", title: "批准两档发布口径，删掉全息办公页。", photo: P.launch },
  ];
}

function reportDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "Q3 运营预审  ·  供应链", title: "华东仓准时率止跌", sub: "结论先行。缺货小时数待财务复核，不上董事会终稿。", photo: P.report },
    { kind: "quote", kicker: "结论", title: "建议维持苏州仓双班，暂缓开郑州二仓。", sub: "开仓资本开支无法被当前准时率证明。" },
    { kind: "cards", kicker: "三支柱", title: "只带这三件事", items: [
      { h: "进度", b: "夜间出库从 62% 提到 71%（仓内计时，示意）" },
      { h: "风险", b: "暴雨周运力缺口未投保" },
      { h: "下一步", b: "11 月只加临时工，不加固定资产" },
    ]},
    { kind: "photo", kicker: "进度", title: "夜班编制补齐，白班不再倒货", sub: "倒货是准时率的主因，不是车队。", photo: P.board },
    { kind: "table", kicker: "风险灯", title: "仓网（示意，非审计数）", rows: [
      ["节点", "灯", "动作"],
      ["苏州", "绿", "维持双班"],
      ["宁波港", "黄", "预约窗口仍抖动"],
      ["郑州二仓", "红", "建议暂缓土建"],
    ]},
    { kind: "time", kicker: "下一步", title: "到双十一只做运营", steps: [
      { t: "本周", d: "夜班排班锁定" },
      { t: "四周", d: "宁波预约复盘" },
      { t: "Q4 末", d: "再议二仓" },
    ]},
    { kind: "close", kicker: "请批", title: "请批：不加仓、加夜班、保准时率。", photo: P.report },
  ];
}

function pitchDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "SEED  ·  潮汐能源", title: "岸线 TideGrid", sub: "用港口闲时电，给冷链仓削峰。不编 ARR、不编客户名。", photo: P.pitch },
    { kind: "photo", kicker: "世界", title: "港口有电，冷链仍在柴油发电", sub: "岸电接口在，调度软件不在。", photo: P.board },
    { kind: "quote", kicker: "冲突", title: "电费账单按月，柴油按小时，没人站中间。", sub: "不是缺变压器，是缺调度权。" },
    { kind: "photoL", kicker: "产品", title: "TideGrid：岸电预约 + 仓温联锁", sub: "先做一条航线、三座仓，不铺全国。", photo: P.data },
    { kind: "cards", kicker: "为何现在", title: "三件外部条件刚齐", items: [
      { h: "政策", b: "靠港禁怠速在部分港落地" },
      { h: "硬件", b: "岸电桩密度够一条示范线" },
      { h: "买方", b: "冷链货主开始问碳口径" },
    ]},
    { kind: "split", kicker: "差异", title: "不是又一块储能柜", items: [
      { h: "储能商", b: "卖设备，不管预约窗口" },
      { h: "TideGrid", b: "卖调度权，设备可租赁" },
    ]},
    { kind: "time", kicker: "路径", title: "尽调前只证明一条线", steps: [
      { t: "现在", d: "仿真调度（示意）" },
      { t: "两季", d: "一条航线联调" },
      { t: "尽调", d: "看仓温曲线，不看宣传片" },
    ]},
    { kind: "close", kicker: "ASK", title: "请进入尽调。不披露未签港口名。", photo: P.pitch },
  ];
}

function proposalDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "城商行  ·  对公信贷", title: "贷后巡检方案", sub: "把季度现场巡检改成「影像+例外抽查」。效果为规划口径。", photo: P.proposal },
    { kind: "photo", kicker: "现状", title: "客户经理开车下厂，拍完照仍手填表", sub: "表和影像对不上号，是合规隐患。", photo: P.board },
    { kind: "cards", kicker: "问题", title: "三处漏水", items: [
      { h: "时效", b: "巡检周期被路程吃掉" },
      { h: "证据", b: "照片无水印、无坐标" },
      { h: "例外", b: "高风险户与普通户同一套表" },
    ]},
    { kind: "photoL", kicker: "方案", title: "影像必采，表格只填例外", photo: P.data },
    { kind: "table", kicker: "效果", title: "规划对照，不是承诺降本百分比", rows: [
      ["环节", "现在", "试点后（规划）"],
      ["普通户", "全项现场", "影像+抽查"],
      ["高风险", "全项现场", "仍全项，加双人"],
      ["底稿", "纸质", "水印影像归档"],
    ]},
    { kind: "close", kicker: "商务", title: "先签两个支行、一个贷种。不全行铺开。", photo: P.proposal },
  ];
}

function prepDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "销培  ·  PREP", title: "异议处理：先认损失，再谈方案", sub: "给一线，不是给培训部目录。", photo: P.gold },
    { kind: "quote", kicker: "P  观点", title: "客户说贵，先重复他的损失，不先打折。", sub: "折扣是最后一张牌。" },
    { kind: "cards", kicker: "R  理由", title: "为什么这句有效", items: [
      { h: "情绪", b: "被听见才会听方案" },
      { h: "信息", b: "损失细节才暴露真预算" },
      { h: "权限", b: "一线没有无限折扣权" },
    ]},
    { kind: "photo", kicker: "E  案例", title: "「停机两小时」比「贵 8%」好谈", sub: "把异议从价格改写成停机成本。", photo: P.board },
    { kind: "quote", kicker: "P  重申", title: "重复损失 → 对齐目标 → 再出价。" },
    { kind: "close", kicker: "作业", title: "每人交一段 90 秒异议录音，下周互评。", photo: P.gold },
  ];
}

function yearDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "年终  ·  茶饮品牌「泊叶」", title: "今年只做成了三件事", sub: "不编营收。门店数为运营口径，未经审计。", photo: P.report },
    { kind: "time", kicker: "过去", title: "时间线上的钉子", steps: [
      { t: "春", d: "停联名、收 SKU 到 18 个" },
      { t: "夏", d: "华南关 4 家亏损店" },
      { t: "冬", d: "自有茶底中试通过" },
    ]},
    { kind: "photo", kicker: "现在", title: "客单稳住了，联名红利没了", sub: "这是主动选择，不是市场消失。", photo: P.board },
    { kind: "cards", kicker: "未来", title: "来年三件事，没有第四件", items: [
      { h: "茶底", b: "自有配方铺到直营" },
      { h: "门店", b: "只开商场店，停社区店" },
      { h: "组织", b: "培训官从外包收回" },
    ]},
    { kind: "close", kicker: "收束", title: "明年考核：茶底占比，不考核联名曝光。", photo: P.hero },
  ];
}

function industryDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "行业  ·  城市充电", title: "公共桩：从抢地到抢在桩时长", sub: "发现 / 对照 / 建议。利用率来源待补。", photo: P.data },
    { kind: "cards", kicker: "发现", title: "桩很多，车位被占着", items: [
      { h: "供给", b: "新区桩密度已过规划线（示意）" },
      { h: "占用", b: "燃油占位与超时占位未计价" },
      { h: "电网", b: "晚高峰扩容比新桩更贵" },
    ]},
    { kind: "table", kicker: "对照", title: "三种玩家（示意，来源待补）", rows: [
      ["玩家", "赚钱方式", "瓶颈"],
      ["地产配建", "车位绑定", "物业分成"],
      ["专营桩企", "度电差", "占位"],
      ["车企自营", "品牌服务", "跨网漫游"],
    ]},
    { kind: "photoL", kicker: "建议", title: "先做占位计价，再谈超充", sub: "超充投资无法被当前在桩时长证明。", photo: P.board },
    { kind: "close", kicker: "判断", title: "可执行：选 20 场站试点占位费。不写全国份额。", photo: P.data },
  ];
}

function fabDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "面谈  ·  静域耳机", title: "SILENCE PRO · FAB", sub: "给采购：特征—优势—利益。禁止零漏音、完全隔绝、护听承诺。", photo: P.launch },
    { kind: "photo", kicker: "F  特征", title: "四档：ANC / 通透 / 通话 / 有线", sub: "有线是兜底，不是情怀。", photo: P.board },
    { kind: "cards", kicker: "A  优势", title: "相对「只有蓝牙」的竞品", items: [
      { h: "会议", b: "通话链路与听歌链路分开" },
      { h: "出差", b: "电量见底可插线继续" },
      { h: "开放工位", b: "通透档保留环境声，不作医疗级隔绝" },
    ]},
    { kind: "quote", kicker: "B  利益", title: "采购要的是「会议不断麦」，不是「最静」。", sub: "续航分模式口径，待实测页另附。" },
    { kind: "close", kicker: "请拍板", title: "先 200 副试用工位，不签全员标配。", photo: P.launch },
  ];
}

function retroDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "复盘  ·  社区团购「邻里达」", title: "我们把履约做成了营销", sub: "失败写清楚。GMV 不上这页。", photo: P.navy },
    { kind: "time", kicker: "过去", title: "三条错误的钉子", steps: [
      { t: "立项", d: "用补贴换首单，履约外包" },
      { t: "爆单", d: "客诉集中在晚到，不是缺货" },
      { t: "止损", d: "关三个网格，收回自配送" },
    ]},
    { kind: "split", kicker: "取舍", title: "当时没选的路", items: [
      { h: "放弃", b: "全城铺网格" },
      { h: "坚持", b: "只留写字楼午间达" },
      { h: "未决", b: "冷链要不要自建" },
    ]},
    { kind: "cards", kicker: "下一步", title: "可执行，不抒情", items: [
      { h: "1", b: "午间达 SLA 写成合同附件" },
      { h: "2", b: "补贴只给复购，不给首单" },
      { h: "3", b: "客诉周报进经营会，不进品牌会" },
    ]},
    { kind: "close", kicker: "记一笔", title: "下次立项先写履约，再写投放。", photo: P.navy },
  ];
}

function competeDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "采购预审  ·  工单系统", title: "自研 vs 两家 SaaS", sub: "维度并列。禁止「全面落后」类绝对化。", photo: P.data },
    { kind: "table", kicker: "对照", title: "现场维修场景（示意）", rows: [
      ["维度", "自研旧系统", "云枢工单", "邻厂维修云"],
      ["离线", "有", "弱", "有（缓存 24h）"],
      ["配件库", "强", "中", "弱"],
      ["移动端", "差", "强", "中"],
      ["驻场实施", "自己人", "按人天", "打包"],
    ]},
    { kind: "quote", kicker: "结论", title: "移动端选云枢；配件库暂留自研。", sub: "不一次替换核心库。" },
    { kind: "close", kicker: "用途", title: "本页可进采购委员会，不进新闻稿。", photo: P.data },
  ];
}

function weeklyDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "研发周会  ·  W32", title: "支付中台：完成 / 风险 / 求助", sub: "5 页。无愿景页。", photo: P.board },
    { kind: "cards", kicker: "完成", title: "本周合上的", items: [
      { h: "退款", b: "幂等键上线，灰度 5%" },
      { h: "对账", b: "渠道 B 日切对齐" },
      { h: "文档", b: "错误码表给到商户群" },
    ]},
    { kind: "split", kicker: "风险", title: "两件黄灯", items: [
      { h: "渠道 C", b: "沙箱证书过期，联调停" },
      { h: "值班", b: "国庆排班未签到人" },
    ]},
    { kind: "quote", kicker: "求助", title: "需要法务本周确认：部分退款的展示文案。" },
    { kind: "close", kicker: "散会", title: "负责人：退款-陈柯 / 证书-周南 / 文案-法务。", photo: P.board },
  ];
}

function boardDeck(): Slide[] {
  return [
    { kind: "cover", kicker: "董事会  ·  地图", title: "停「全国仓网」，改「三城密度」", sub: "论点、支撑、时间、强攻/带过。数字待审计。", photo: P.hero },
    { kind: "cards", kicker: "地图", title: "先看全篇", items: [
      { h: "论点", b: "密度优于覆盖" },
      { h: "支撑 1", b: "三城已占订单 68%  · 强攻" },
      { h: "支撑 2", b: "新城履约亏损  · 强攻" },
      { h: "支撑 3", b: "品牌曝光可带过" },
      { h: "路径", b: "12 个月只加密三城  · 强攻" },
      { h: "风险", b: "竞对下沉叙事  · 带过" },
    ]},
    { kind: "time", kicker: "时间", title: "25 分钟怎么切", steps: [
      { t: "4′", d: "地图与论点" },
      { t: "12′", d: "三城密度模型" },
      { t: "9′", d: "停仓清单与投票" },
    ]},
    { kind: "quote", kicker: "强攻", title: "今天只投票：停哪五座新城仓。" },
    { kind: "close", kicker: "请批", title: "批准三城密度战略，否决全国铺仓预算。", photo: P.hero },
  ];
}

export function LivePpt({ title }: { title?: string }) {
  const slides = useMemo(() => deckFor(title), [title]);
  const [i, setI] = useState(0);
  const n = slides.length;
  useEffect(() => setI(0), [title]);
  const go = useCallback((d: number) => setI((x) => (x + d + n) % n), [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const s = slides[i] ?? slides[0];

  return (
    <div className="flex h-full flex-col bg-[#14120e]">
      <div className="flex min-h-0 flex-1 items-center justify-center p-3">
        <div className="relative aspect-video w-full max-h-full overflow-hidden rounded-[4px] bg-[#0c1220] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)]">
          <SlideFace s={s} index={i} total={n} />
          <button type="button" aria-label="上一页" onClick={() => go(-1)} className="absolute inset-y-0 left-0 z-10 w-[18%] bg-transparent" />
          <button type="button" aria-label="下一页" onClick={() => go(1)} className="absolute inset-y-0 right-0 z-10 w-[18%] bg-transparent" />
        </div>
      </div>
      <div className="flex items-center justify-between px-4 pb-3 text-[11px] text-[#b8a078]">
        <button type="button" onClick={() => go(-1)} className="tracking-[0.16em]">←  PREV</button>
        <span className="max-w-[50%] truncate font-mono tracking-[0.12em]">
          {title ?? "PPT"}  ·  {String(i + 1).padStart(2, "0")}/{String(n).padStart(2, "0")}
        </span>
        <button type="button" onClick={() => go(1)} className="tracking-[0.16em]">NEXT  →</button>
      </div>
    </div>
  );
}

function SlideFace({ s, index, total }: { s: Slide; index: number; total: number }) {
  const gold = "text-[#e2c48a]";
  if (s.kind === "cover" || s.kind === "close") {
    return (
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.photo} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/30 to-black/10" />
        <div className="absolute inset-x-0 bottom-0 px-[6%] pb-[7%]">
          <p className={`text-[11px] tracking-[0.42em] ${gold}`}>{s.kicker}</p>
          <h1 className="mt-4 max-w-[90%] text-[clamp(26px,4vw,50px)] font-semibold leading-[1.12] text-white">{s.title}</h1>
          {s.sub && <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/75">{s.sub}</p>}
          <p className="mt-8 font-mono text-[10px] tracking-[0.28em] text-white/40">
            {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </p>
        </div>
      </div>
    );
  }

  if (s.kind === "photo" || s.kind === "photoL") {
    const img = (
      <div className="relative min-h-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.photo} alt="" className="h-full w-full object-cover" />
      </div>
    );
    const copy = (
      <div className="flex flex-col justify-between bg-[#0c1220] px-[8%] py-[9%]">
        <div>
          <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
          <h1 className="mt-5 text-[clamp(22px,3vw,36px)] font-semibold leading-[1.2] text-white">{s.title}</h1>
          {s.sub && <p className="mt-5 max-w-md text-[15px] leading-7 text-white/65">{s.sub}</p>}
        </div>
        <p className="font-mono text-[10px] tracking-[0.28em] text-white/30">{String(index + 1).padStart(2, "0")}</p>
      </div>
    );
    return (
      <div className="absolute inset-0 grid grid-cols-2">
        {s.kind === "photoL" ? <>{img}{copy}</> : <>{copy}{img}</>}
      </div>
    );
  }

  if (s.kind === "quote") {
    return (
      <div className="absolute inset-0 bg-[#0c1220]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={P.gold} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" />
        <div className="relative flex h-full flex-col justify-center px-[9%]">
          <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
          <h1 className="mt-6 max-w-3xl text-[clamp(26px,3.6vw,44px)] font-semibold leading-[1.18] text-white">{s.title}</h1>
          {s.sub && <p className="mt-6 max-w-lg text-[16px] leading-8 text-[#e2c48a]/90">{s.sub}</p>}
        </div>
      </div>
    );
  }

  if (s.kind === "table" && s.rows) {
    const [head, ...body] = s.rows;
    return (
      <Plate>
        <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
        <h1 className="mt-3 text-[clamp(22px,2.8vw,34px)] font-semibold text-white">{s.title}</h1>
        <table className="mt-8 w-full border-collapse text-left text-[14px] text-white/80">
          <thead>
            <tr className="border-b border-[#e2c48a]/40">
              {head.map((h) => (
                <th key={h} className="pb-3 font-medium text-[#e2c48a]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((r) => (
              <tr key={r.join()} className="border-b border-white/10">
                {r.map((c) => (
                  <td key={c} className="py-3.5">{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Plate>
    );
  }

  if (s.kind === "time" && s.steps) {
    return (
      <Plate>
        <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
        <h1 className="mt-3 text-[clamp(22px,2.8vw,34px)] font-semibold text-white">{s.title}</h1>
        <div className="mt-10 flex gap-6">
          {s.steps.map((st, i) => (
            <div key={st.t} className="flex-1 border-t-2 border-[#e2c48a] pt-5">
              <p className="font-mono text-[12px] text-[#e2c48a]">{String(i + 1).padStart(2, "0")}  {st.t}</p>
              <p className="mt-3 text-[16px] leading-7 text-white/80">{st.d}</p>
            </div>
          ))}
        </div>
      </Plate>
    );
  }

  const cols = s.items && s.items.length > 4 ? "grid-cols-3" : s.items && s.items.length > 3 ? "grid-cols-4" : s.items && s.items.length === 2 ? "grid-cols-2" : "grid-cols-3";
  return (
    <Plate>
      <p className={`text-[11px] tracking-[0.36em] ${gold}`}>{s.kicker}</p>
      <h1 className="mt-3 max-w-3xl text-[clamp(22px,2.8vw,34px)] font-semibold leading-[1.2] text-white">{s.title}</h1>
      <div className={`mt-8 grid gap-5 ${cols}`}>
        {s.items?.map((it) => (
          <div key={it.h} className="border-t border-[#e2c48a]/50 pt-4">
            <p className="text-[13px] tracking-[0.2em] text-[#e2c48a]">{it.h}</p>
            <p className="mt-3 text-[14px] leading-7 text-white/75">{it.b}</p>
          </div>
        ))}
      </div>
    </Plate>
  );
}

function Plate({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 bg-[#0c1220] px-[7%] py-[7%]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={P.navy} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40" />
      <div className="relative">{children}</div>
    </div>
  );
}
