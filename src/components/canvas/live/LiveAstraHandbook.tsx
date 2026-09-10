"use client";

import type { ReactNode } from "react";

const ASTRA_PROMPT = `撰写一份 12 页企业智能工作系统产品介绍手册（概念产品，可直接进入设计排版）。
产品名：启衡 ASTRA。定位：面向管理决策、销售支持、客户服务与研发知识管理的企业智能工作系统。语气克制、高端、科技感，不堆砌时髦名词。
文档开头注明：概念产品介绍稿，功能与方案为规划设定。
不编造客户案例、标志、合作伙伴、性能数据或行业排名。指标须标为「示例数据」或「待验证目标」。
每页输出：1. 页面标题 2. 一句话核心观点 3. 可直接排版的正文（短段落与信息卡片）4. 重点信息模块 5. 视觉与版式建议。
页序：
01 开篇：工作正在被重新定义
02 产品定位：ASTRA 是什么、不是什么
03 能力全景
04 人机协作与职责边界
05 知识与检索
06 把重复工作交给有序流程（接收需求—提取信息—生成草稿—人工审核—输出归档；异常回退或转交人工）
07 决策辅助：看见数据，更看见关联（事实 / 推断 / 建议分开；不替代管理决策）
08 技术架构：数据连接层—知识与检索层—模型与智能体层—应用编排层，安全治理贯穿
09 安全治理：身份、最小权限、访问控制、审计、敏感操作确认、数据生命周期；不虚构认证与绝对安全
10 应用场景：管理决策、销售支持、客户服务、研发知识管理，各写「痛点—使用方式—预期价值—适用边界」
11 实施路径：需求梳理、小范围验证、效果评估、逐步推广；不虚构交付周期
12 结语：下一代工作方式；预约产品演示 / 申请场景评估；联系方式用占位符`;

export { ASTRA_PROMPT };

export function LiveAstraHandbook() {
  return (
    <div className="h-full overflow-y-auto bg-[#07090d] text-[#e8edf5]">
      <article className="mx-auto max-w-[920px] px-6 py-10 sm:px-12 sm:py-14">
        <p className="text-[11px] font-medium tracking-[0.28em] text-cyan-400/80">CONCEPT BRIEF · ASTRA HANDBOOK</p>
        <p className="mt-3 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-[12px] leading-6 text-cyan-100/80">
          概念产品介绍稿，功能与方案为规划设定。本文不构成交付承诺。
        </p>
        <h1 className="mt-8 text-[34px] font-semibold tracking-tight text-white">启衡 ASTRA</h1>
        <p className="mt-2 text-[16px] text-stone-400">企业智能工作系统 · 12 页产品手册</p>
        <p className="mt-1 text-[12px] text-stone-500">文档编号 AH-2026-001 · 规划稿 · 供设计排版</p>
        <Shot src="/cases/astra/p01-hero.jpg" cap="工作台概念静帧 · 示意，非已上线界面" />

        <Page n="01" title="开篇：工作，正在被重新定义">
          <Thesis>真正的升级，不是更快地完成旧流程，而是让复杂工作以更清晰的方式发生。</Thesis>
          <p className="mt-4 text-[13.5px] leading-7 text-stone-300">
            企业并不缺工具。缺的是把需求、知识、判断与归档串成一条可治理路径的能力。启衡 ASTRA 被设定为一套工作系统：人提出意图，系统组织信息，关键节点仍由人确认。
          </p>
          <Cards
            items={[
              ["此刻的裂缝", "信息散落在会话、表格与个人硬盘；结论难追溯。"],
              ["我们选择的方向", "先把流程说清楚，再把智能放进流程里。"],
              ["读者是谁", "信息化负责人、业务一把手、安全与合规同事。"],
            ]}
          />
          <Vis>深空黑底、细青光线框；右侧留大面积负空间，仅一行标题。封面不放客户 logo。</Vis>
        </Page>

        <Page n="02" title="产品定位：ASTRA 是什么，不是什么">
          <Thesis>ASTRA 是企业工作的编排层，不是又一个聊天窗口。</Thesis>
          <Shot src="/cases/astra/p02-workbench.jpg" cap="左意图 / 右草稿与出处 · 概念界面" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Box h="是">
              连接已有系统中的数据与知识，按场景编排「检索—起草—审核—归档」，并留下可审计轨迹。
            </Box>
            <Box h="不是">
              不是自动替管理层拍板的黑箱，不是无边界的万能助手，也不承诺替代专业岗位。
            </Box>
          </div>
          <Cards
            items={[
              ["命名", "启衡 ASTRA：衡，是边界与分寸；Astra，是可导航的星图。"],
              ["形态", "工作台 + 流程编排 + 知识检索 + 治理后台。"],
              ["原则", "能解释、能撤回、能转交人工。"],
            ]}
          />
          <Vis>左右对开：左「是」冷青，右「不是」暗石色。中央一条竖向分割线。</Vis>
        </Page>

        <Page n="03" title="能力全景：让复杂工作清晰发生">
          <Thesis>四条主能力，对应四类最耗判断力的工作。</Thesis>
          <Shot src="/cases/astra/p03-capabilities.jpg" cap="编排 · 检索 · 起草 · 洞察" />
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {[
              ["编排", "把跨系统动作收成可配置流程"],
              ["检索", "在权限内召回制度、案例与记录"],
              ["起草", "生成可审阅草稿，而不是终稿伪装"],
              ["洞察", "汇总异常与关联，供人判断"],
            ].map(([k, v]) => (
              <div key={k} className="border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-[11px] tracking-[0.16em] text-cyan-400/90">{k}</p>
                <p className="mt-1 text-[13px] text-stone-200">{v}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-stone-500">能力以场景开关启用。未开通的能力在界面中保持不可见，避免「全能」幻觉。</p>
          <Vis>四宫格等权；避免仪表盘堆砌。每格一个动词。</Vis>
        </Page>

        <Page n="04" title="人机协作：职责写在界面上">
          <Thesis>系统负责组织与草稿，人负责确认与担责。</Thesis>
          <Shot src="/cases/astra/p02-workbench.jpg" cap="职责写在同一屏：草稿可改、可退、可签" />
          <table className="mt-5 w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-white/15 text-left text-cyan-200/80">
                {["环节", "系统", "人"].map((h) => (
                  <th key={h} className="py-2 pr-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-stone-300">
              {[
                ["接收需求", "结构化字段、缺项提示", "确认意图与优先级"],
                ["提取信息", "权限内检索与引用", "补充未入库事实"],
                ["生成草稿", "标注来源与不确定处", "改写、删减、否决"],
                ["审核输出", "检查清单与差异高亮", "签字或退回"],
                ["归档", "版本、权限、留痕", "指定可见范围"],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-white/8">
                  {r.map((c) => (
                    <td key={c} className="py-2 pr-3">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <Vis>三列表，不要拟人插画。表格即视觉。</Vis>
        </Page>

        <Page n="05" title="知识底座：企业记忆可被调用">
          <Thesis>没有权限与出处的「聪明」，只是不可用的聪明。</Thesis>
          <Shot src="/cases/astra/p05-knowledge.jpg" cap="权限内召回：被点亮的才可进入上下文" />
          <p className="mt-4 text-[13.5px] leading-7 text-stone-300">
            ASTRA 将制度、项目纪要、产品说明与经授权的业务记录纳入可检索层。每次引用在草稿旁给出出处卡片；无权限的内容既不出现在结果里，也不进入模型上下文。
          </p>
          <Cards
            items={[
              ["入库", "指定空间、密级、保留期限"],
              ["召回", "按角色与任务裁剪上下文"],
              ["失效", "过期或废止文档自动降权"],
            ]}
          />
          <Vis>抽象「目录树 + 光束」示意图，不用地球或大脑。</Vis>
        </Page>

        <Page n="06" title="把重复工作，交给有序流程">
          <Thesis>一条可回退的流水线，比一次惊艳的生成更重要。</Thesis>
          <Shot src="/cases/astra/p06-flow.jpg" cap="接收 → 提取 → 草稿 → 审核 → 归档" />
          <ol className="mt-5 space-y-2 text-[13px] text-stone-200">
            {[
              "接收需求：表单或会话采集目标、对象、截止与约束",
              "提取信息：在授权范围内召回制度、历史稿与数据摘要",
              "生成草稿：分段产出，关键句旁标注来源与置信说明",
              "人工审核：通过 / 修改 / 退回；退回必须写原因",
              "输出归档：写入指定空间，锁定版本，通知相关人",
            ].map((t, i) => (
              <li key={t} className="flex gap-3 border-l-2 border-cyan-500/50 pl-3">
                <span className="font-mono text-[11px] text-cyan-400">0{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <Box h="异常如何处理">
            超时、权限不足、来源冲突或审核人否决时，流程冻结在当前节点，支持回退至上一节点或转交指定人工队列。系统不自行跳过审核。
          </Box>
          <Vis>横向五步时间轴；异常用虚线回流到「人工队列」。</Vis>
        </Page>

        <Page n="07" title="决策辅助：看见数据，更看见关联">
          <Thesis>我们呈现事实、推断与建议，并让三者分开站立。</Thesis>
          <Shot src="/cases/astra/p07-decision.jpg" cap="三栏权重递减：事实最实，建议最轻" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["事实", "可核对的记录、报表摘录、制度原文"],
              ["推断", "基于事实的关联与缺口，标明假设"],
              ["建议", "可选动作及适用条件，供人取舍"],
            ].map(([h, b]) => (
              <div key={h} className="border border-white/10 p-3">
                <p className="text-[12px] font-semibold text-white">{h}</p>
                <p className="mt-2 text-[12px] leading-6 text-stone-400">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13px] leading-7 text-stone-300">
            异常以「偏离基线 / 来源冲突 / 缺失字段」提示，而不是红色警报恐吓。ASTRA 不承诺自动替代管理决策。
          </p>
          <p className="mt-2 text-[11px] text-stone-500">示例数据（待验证目标）：试点团队将「找材料」时间减少，具体比例在评估阶段测量，本文不预填。</p>
          <Vis>三列等高卡片；建议列视觉权重最低，避免「命令感」。</Vis>
        </Page>

        <Page n="08" title="技术架构：复杂能力，清晰组织">
          <Thesis>四层能力，一层治理，从连接走到编排。</Thesis>
          <Shot src="/cases/astra/p08-arch.jpg" cap="四层横叠，治理竖轨贯穿" />
          <div className="mt-5 space-y-2">
            {[
              ["应用编排层", "场景工作流、审核节点、通知与归档"],
              ["模型与智能体层", "起草、摘要、分类；工具调用受白名单约束"],
              ["知识与检索层", "索引、密级、出处回链、过期降权"],
              ["数据连接层", "经授权的系统连接器，最小字段同步"],
            ].map(([h, b]) => (
              <div key={h} className="flex gap-4 border border-white/10 px-4 py-3">
                <p className="w-36 shrink-0 text-[12px] font-semibold text-cyan-200">{h}</p>
                <p className="text-[12px] text-stone-300">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-stone-400">安全治理不是第五层摆件，而是贯穿身份、权限、审计与密钥的竖切能力。</p>
          <Vis>四层横条自上而下；左侧一条贯穿的「治理」竖轨。可直接绘制架构图。</Vis>
        </Page>

        <Page n="09" title="安全治理：让智能运行在边界之内">
          <Thesis>智能只在被允许的范围内工作，并且留下证据。</Thesis>
          <Shot src="/cases/astra/p09-secure.jpg" cap="默认关闭，按角色打开" />
          <ul className="mt-4 list-disc space-y-2 pl-5 text-[13px] leading-7 text-stone-300">
            <li>身份认证：对接企业身份源；未认证不进入任何空间。</li>
            <li>最小权限：按角色、空间、密级授权；默认无权限。</li>
            <li>访问控制：检索、生成、导出分权；高密内容禁止进入模型上下文。</li>
            <li>审计记录：谁在何时对何对象做了检索、生成、审核、导出。</li>
            <li>敏感操作确认：外发、批量导出、权限提升需二次确认。</li>
            <li>数据生命周期：分类、保留、销毁策略可配置；过期自动失效。</li>
          </ul>
          <p className="mt-3 text-[12px] text-stone-500">本文不陈述任何认证、合规资质或「绝对安全」承诺。落地以客户环境评估为准。</p>
          <Vis>六点清单配细图标，不要盾牌堆砌或绿色对勾墙。</Vis>
        </Page>

        <Page n="10" title="应用场景：让价值落在具体工作里">
          <Thesis>四个场景，同一套边界：先试点，再谈推广。</Thesis>
          <Shot src="/cases/astra/p10-scenes.jpg" cap="决策 / 销售 / 客服 / 研发 · 示意场景" />
          <div className="mt-5 space-y-4">
            {[
              ["管理决策", "材料难对齐、口径打架", "按议题拉取事实卡，生成对比草稿供会前审阅", "缩短对齐时间，会议从「找数」转向「判断」", "不自动形成决议；财务与人事敏感项需专权"],
              ["销售支持", "方案重复写、案例找不到", "按客户行业调取许可材料，生成可改方案骨架", "减少从空白页开始的时间", "未经审核不得对外发送；价格以主数据为准"],
              ["客户服务", "答复依赖个人记忆", "工单进入流程：检索制度 → 草稿 → 坐席确认", "口径更一致，升级路径更清楚", "情绪安抚与例外赔付必须人工"],
              ["研发知识", "设计讨论留在聊天里", "纪要入库、接口说明可检索、变更需审核", "减少重复问答，设计决策可追溯", "源代码与密钥不入库、不进模型"],
            ].map(([name, pain, use, value, bound]) => (
              <div key={name} className="border border-white/10 p-4">
                <p className="text-[13px] font-semibold text-white">{name}</p>
                <dl className="mt-2 grid gap-1 text-[12px] text-stone-400 sm:grid-cols-2">
                  <div>痛点：{pain}</div>
                  <div>使用：{use}</div>
                  <div>预期价值：{value}</div>
                  <div>适用边界：{bound}</div>
                </dl>
              </div>
            ))}
          </div>
          <Vis>四张等宽场景卡，每卡四行标签。禁止客户商标。</Vis>
        </Page>

        <Page n="11" title="实施路径：从可控试点，到规模化应用">
          <Thesis>先证明在一个场景里可治理，再扩大范围。</Thesis>
          <Shot src="/cases/astra/p06-flow.jpg" cap="试点只开通一条完整路径" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["1 需求梳理", "选定一个场景、一批用户、一类数据。验收：边界说明书签署。"],
              ["2 小范围验证", "跑通流程与权限。验收：完整审计日志可回放。"],
              ["3 效果评估", "对照「找材料 / 出草稿 / 审核耗时」的示例基线。验收：书面评估，指标标为待验证。"],
              ["4 逐步推广", "按空间复制，不默认全员开通。验收：培训与回退预案齐备。"],
            ].map(([h, b]) => (
              <div key={h} className="border border-white/10 p-3">
                <p className="text-[12px] font-semibold text-cyan-200">{h}</p>
                <p className="mt-1 text-[12px] leading-6 text-stone-400">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-stone-500">不在此给出虚构的周次或人天。周期由数据就绪程度与组织协同决定。</p>
          <Vis>四段阶梯，不是火箭发射图。每段一个验收动词。</Vis>
        </Page>

        <Page n="12" title="结语：构建企业的下一代工作方式">
          <Thesis>把智能关进流程，把责任留在人这边——这就是我们愿意称之为「下一代」的原因。</Thesis>
          <Shot src="/cases/astra/p12-close.jpg" cap="从一间试点房间开始" />
          <p className="mt-4 text-[14px] leading-8 text-stone-200">
            企业不需要更多窗口。它需要一条能被看见、被撤回、被审计的工作路径。启衡 ASTRA 愿做这条路径的规划稿——从试点房间开始，而不是从口号开始。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <span className="rounded-full border border-cyan-400/40 px-4 py-2 text-[13px] text-cyan-100">预约产品演示</span>
            <span className="rounded-full border border-white/20 px-4 py-2 text-[13px] text-stone-200">申请场景评估</span>
          </div>
          <p className="mt-6 text-[12px] text-stone-500">
            联系（占位符）：demo@astra.example · assessment@astra.example · +86-000-0000-0000
          </p>
          <Vis>大字结语居中；两个 CTA 胶囊按钮；页脚仅占位联系方式，无二维码伪作。</Vis>
        </Page>

        <p className="mt-12 border-t border-white/10 pt-4 text-[10px] tracking-wide text-stone-600">
          启衡 ASTRA · 产品手册 v0.1 · 概念设定 · 提示词见右侧栏
        </p>
      </article>
    </div>
  );
}

function Page({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-14 border-t border-white/10 pt-8">
      <p className="font-mono text-[11px] tracking-[0.3em] text-cyan-500/80">{n}</p>
      <h2 className="mt-2 text-[22px] font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Thesis({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[14px] font-medium leading-7 text-cyan-100/90">{children}</p>;
}

function Cards({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {items.map(([h, b]) => (
        <div key={h} className="border border-white/10 bg-white/[0.03] p-3">
          <p className="text-[11px] tracking-wide text-cyan-400/80">{h}</p>
          <p className="mt-1.5 text-[12px] leading-6 text-stone-300">{b}</p>
        </div>
      ))}
    </div>
  );
}

function Box({ h, children }: { h: string; children: ReactNode }) {
  return (
    <div className="mt-4 border border-white/10 p-4">
      <p className="text-[12px] font-semibold text-white">{h}</p>
      <p className="mt-2 text-[13px] leading-7 text-stone-300">{children}</p>
    </div>
  );
}

function Vis({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 text-[11px] leading-6 text-stone-500">
      视觉与版式：{children}
    </p>
  );
}
