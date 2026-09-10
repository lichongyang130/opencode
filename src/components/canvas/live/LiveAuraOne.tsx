"use client";

import type { ReactNode } from "react";

export const AURA_PROMPT = `你是消费电子品牌策略与工业设计叙事创意总监。为虚构产品「曜界 AURA ONE｜旗舰级空间计算眼镜」写 14 页高端产品手册。
品牌主张：视界之外，自有新境。定位：轻量化眼镜形态，将个人影音、移动办公与情境信息融入眼前空间。计算与供电由兼容手机、电脑或独立配件承担，不默认独立运行。交互：镜腿触控、主机输入、可选控制器；不默认眼动或全场景手势。
规划能力：空间显示、随身影音、移动工作空间、情境智能辅助、个性化适配。均为概念规划。
气质：精密、克制、轻盈、未来感。禁止零延迟、永不眩晕、全天无感、完全替代手机。不编造实测、销量、奖项、认证。缺失参数写「待工程验证」。
页序 01 封面 02 产品理念 03 工业设计 04 显示体验 05 空间体验 06 个人影音 07 移动办公 08 智能辅助 09 交互 10 佩戴 11 系统架构 12 参数与兼容性 13 产品配置三套装 14 封底。
每页：标题、一句话观点、正文 150–250 字、重点模块、视觉建议、条件脚注。开头注明概念产品介绍稿。界面示意不代表实际视场与画质。`;

export function LiveAuraOne() {
  return (
    <div className="h-full overflow-y-auto bg-[#d9d2c5] px-3 py-6 sm:px-10 text-stone-800">
      <article className="mx-auto max-w-[1100px] bg-[#fffcf7] px-6 py-8 shadow-[0_18px_60px_-20px_rgba(28,25,23,0.45)] sm:px-12 sm:py-12">
        <p className="text-[11px] font-medium tracking-[0.28em] text-teal-700">DESIGN / AURA ONE</p>
        <p className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] leading-6 text-stone-600">
          本资料为概念产品介绍稿，产品外观、功能与规格均为规划设定。界面及显示效果为示意，不代表实际视场范围与画质。
        </p>

        <Page n="01" title="封面：视界之外，自有新境">
          <Thesis>大屏体验，不必再困在桌面上。</Thesis>
          <Shot src="/cases/aura/p01-cover.jpg" cap="四分之三侧面 · 产品为唯一视觉中心" />
          <p className="mt-4 text-[13.5px] leading-7 text-stone-600">
            曜界 AURA ONE 是一副旗舰级空间计算眼镜：把个人影音、临时办公与情境信息，放进眼前的一层轻空间。它连接兼容主机工作，而不是假装自己是另一部手机。
          </p>
          <Cards
            items={[
              ["名称", "曜界 AURA ONE"],
              ["主张", "视界之外，自有新境。"],
              ["定位", "可连接外部设备的空间显示终端。"],
            ]}
          />
          <Note>概念产品。未量产、未实测、未获认证。</Note>
          <Vis>深曜黑底，细轮廓光勾镜片与镜腿；无场景、无 logo。</Vis>
        </Page>

        <Page n="02" title="产品理念：大屏体验，不必困于桌面">
          <Thesis>它补充屏幕，而不是宣布屏幕过时。</Thesis>
          <Shot src="/cases/aura/p02-idea.jpg" cap="酒店夜灯下的私人屏幕入口" />
          <p className="mt-4 text-[13.5px] leading-7 text-stone-600">
            出差时想把电影留给自己；会议室外想再看一眼文档；创意工作时需要一块不被旁人扫到的辅屏。眼镜形态让显示跟着人走，桌面仍留给键盘与交谈。AURA ONE 适合补上「需要大、但不想摊开」的那一段。
          </p>
          <Cards
            items={[
              ["移动观影", "连接兼容设备，把内容收到眼前。"],
              ["临时办公", "扩展文档与会议窗口，前提是主机与软件支持。"],
              ["个人信息", "情境提示来自主机，经授权才出现。"],
            ]}
          />
          <Note>不替代手机、电脑或电视。不承诺全天佩戴。</Note>
          <Vis>产品小、场景静；留白大于道具。</Vis>
        </Page>

        <Page n="03" title="工业设计：把复杂，藏进细节">
          <Thesis>能被看见的，只有轮廓、接缝与光。</Thesis>
          <Shot src="/cases/aura/p03-design.jpg" cap="镜腿铰链与鼻托微距 · 拟采用表面处理" />
          <p className="mt-4 text-[13.5px] leading-7 text-stone-600">
            设计方向是窄框、低体积、重量沿镜腿后移。鼻托可调，接触面拟采用柔质包覆。供电与视频走线收在一侧镜腿，接口朝后，避免在脸颊前晃动。材料未定稿：金属件为拟采用的轻质合金与钛金属银色涂层方向，不写成既定钛合金量产件。
          </p>
          <Cards
            items={[
              ["轮廓", "侧面尽量一条线，光学模组藏进镜圈。"],
              ["重量", "设计目标是重心靠近耳侧，具体克数待工程验证。"],
              ["接口", "规划为可拆线缆，朝后插拔。"],
            ]}
          />
          <Note>三组微距建议：铰链开合、鼻托纹理、接口金属口。材质均为设计方向。</Note>
          <Vis>黑底微距，编号线极少，强调接缝。</Vis>
        </Page>

        <Page n="04" title="显示体验：让内容，在眼前展开">
          <Thesis>你看见的是叠加，不是吞掉整个世界。</Thesis>
          <Shot src="/cases/aura/p04-display.jpg" cap="光学路径示意 · 非实际视场" />
          <p className="mt-4 text-[13.5px] leading-7 text-stone-600">
            规划采用双目显示与光学透视：数字画面经镜片进入视野，现实环境仍可透过镜片看见。观影模式提高画面占比、压暗周边；空间窗口模式保留更多环境。环境光越强，对比度越受挑战——户外正午不是主场景。
          </p>
          <Cards
            items={[
              ["数字画面", "显示范围受光学与镜圈限制，不是无限全息。"],
              ["现实可见", "透视存在，旁人与障碍物仍可能进入余光。"],
              ["两种模式", "观影 / 窗口，由主机应用切换。"],
            ]}
          />
          <Note>分辨率、亮度、视场角、等效屏幕尺寸：待工程验证。图为示意。</Note>
          <Vis>克制光路，禁止代码雨与过量全息。</Vis>
        </Page>

        <Page n="05" title="空间体验：窗口有位置，工作有层次">
          <Thesis>窗口可以有远近，前提是主机与追踪方案就绪。</Thesis>
          <Shot src="/cases/aura/p05-space.jpg" cap="空间窗口示意，不代表实际视场与画质" />
          <p className="mt-4 text-[13.5px] leading-7 text-stone-600">
            在兼容主机与经授权的追踪方案支持下，可以布置：主窗口读文档、辅窗口放资料、小窗口显示会议状态。规划两种放置：随头显示（跟着视线）与空间固定（相对房间或桌面）。六自由度追踪不作为默认能力，实现条件待验证。
          </p>
          <Cards
            items={[
              ["主窗口", "阅读与编辑，需要足够文本清晰度。"],
              ["辅窗口", "参考资料，可随时收起。"],
              ["状态窗", "会议或通知，避免抢焦点。"],
            ]}
          />
          <Note>界面为示意。追踪方案未定时，不承诺空间钉住。</Note>
          <Vis>前后层次清楚，窗口不超过三层。</Vis>
        </Page>

        <Page n="06" title="个人影音：把沉浸感，留给自己">
          <Thesis>内容来自主机，眼镜负责把画面送到眼前。</Thesis>
          <Shot src="/cases/aura/p06-cinema.jpg" cap="列车座位 · 连接手机观看" />
          <p className="mt-4 text-[13.5px] leading-7 text-stone-600">
            家中沙发、酒店床头、列车座位：用线缆或规划中的无线方案连接兼容手机或电脑，打开已安装的播放应用。音频规划通过镜腿扬声器或兼容耳机输出；开放式扬声器不能描述为完全不漏音。字幕与播放控制走镜腿触控或主机。平台版权与设备名单会影响能看什么。
          </p>
          <Cards
            items={[
              ["来源", "主机上的应用与文件。"],
              ["连接", "规划有线优先，无线为待验证。"],
              ["隐私", "旁人仍可能从侧面瞥见漏光，不是绝对私密。"],
            ]}
          />
          <Note>请在相对静止、安全的环境使用沉浸观影。</Note>
          <Vis>生活静物，产品小而清楚。</Vis>
        </Page>

        <Page n="07" title="移动办公：连接之后，展开思路">
          <Thesis>眼镜显示，主机计算，键盘负责写字。</Thesis>
          <Shot src="/cases/aura/p07-office.jpg" cap="出差桌：眼镜 + 电脑 + 键盘" />
          <p className="mt-4 text-[13.5px] leading-7 text-stone-600">
            叙事：连接电脑 → 打开文档 → 布置窗口 → 用键盘编辑 → 收起设备。眼镜不负责跑办公套件；文本清晰度、软件适配和佩戴舒适度都会限制时长。它让你少带一块显示器，不是少带一台电脑。
          </p>
          <ol className="mt-4 space-y-1.5 text-[13px] text-stone-600">
            {["连接兼容主机", "打开已适配应用", "布置一主一辅窗口", "主机或键盘输入", "断开并收入盒中"].map((t, i) => (
              <li key={t} className="flex gap-2">
                <span className="font-mono text-[11px] text-teal-700">0{i + 1}</span>
                {t}
              </li>
            ))}
          </ol>
          <Note>软件适配范围待验证。不承诺所有办公软件可用。</Note>
          <Vis>桌面静物，分工一眼可读。</Vis>
        </Page>

        <Page n="08" title="智能辅助：需要时，信息恰好出现">
          <Thesis>辅助来自主机上的服务，且必须先被允许。</Thesis>
          <p className="mt-4 text-[13.5px] leading-7 text-stone-600">
            语音问答、兼容应用内字幕翻译、用户粘贴或授权后的文本摘要——处理在兼容主机或云端完成，眼镜只呈现短结果。不默认持续环境录音、不默认摄像识别、不默认读取其他应用。联网与第三方服务中断时，相应能力不可用。
          </p>
          <div className="mt-4 space-y-3">
            {[
              ["语音问答", "用户主动唤醒", "主机或云端模型", "眼前短文本", "无唤醒不监听"],
              ["字幕翻译", "兼容播放应用", "主机翻译服务", "叠在画面下方", "依赖片源与网络"],
              ["文本摘要", "用户授权的选区", "主机摘要", "侧窗要点", "不扫描未授权内容"],
            ].map(([n, a, b, c, d]) => (
              <div key={n} className="border border-stone-200 bg-white p-3 text-[12px] text-stone-600">
                <p className="font-semibold text-stone-800">{n}</p>
                <p className="mt-1">输入：{a} · 处理：{b} · 呈现：{c} · 边界：{d}</p>
              </div>
            ))}
          </div>
          <Note>功能依赖联网与第三方时，须在界面提示。</Note>
          <Vis>三张信息卡，不要大脑图标。</Vis>
        </Page>

        <Page n="09" title="交互设计：少一点操作，多一点直接">
          <Thesis>确认用触控，写字用主机，选窗口可用手柄。</Thesis>
          <Shot src="/cases/aura/p09-touch.jpg" cap="镜腿触控条 · 概念交互" />
          <p className="mt-4 text-[13.5px] leading-7 text-stone-600">
            轻触确认、滑动调进度或音量；长文本与精确光标交给电脑或手机键盘；可选控制器用于抓取、放置窗口。手势仅为概念设定，未做可用性验证，不作为卖点承诺。
          </p>
          <Cards
            items={[
              ["镜腿", "确认、滑动、返回。"],
              ["主机", "打字、多任务、账号。"],
              ["控制器", "可选。窗口抓取与菜单。"],
            ]}
          />
          <Note>手势未验证。眼动追踪不在默认规格内。</Note>
          <Vis>手指与镜腿微距，动作单一。</Vis>
        </Page>

        <Page n="10" title="佩戴体验：舒适，来自每一处取舍">
          <Thesis>舒适是取舍，不是人人适用的保证。</Thesis>
          <Shot src="/cases/aura/p10-fit.jpg" cap="可调鼻托与可选近视方案 · 冷瓷白背景" />
          <p className="mt-4 text-[13.5px] leading-7 text-[#3a4149]">
            重量与克数待工程验证。设计关注鼻梁与耳侧压强、皮肤接触区散热、不同脸宽的镜腿张角。近视用户规划可选镜片插件或第三方配镜服务，适配范围待验证。使用中请定时摘下休息。不宣称预防近视或治疗眼部疾病。
          </p>
          <Cards
            items={[
              ["安全", "驾驶、骑行及需注视环境时，关闭沉浸功能。"],
              ["环境", "相对静止的室内或座位优先。"],
              ["休息", "出现疲劳、眩晕即摘下。"],
            ]}
          />
          <Note>不承诺人人适配。无医疗功效宣传。</Note>
          <Vis>浅底参数气质，产品静物。</Vis>
        </Page>

        <Page n="11" title="系统架构：眼前简洁，背后有序">
          <Thesis>眼镜负责显示与轻交互，计算留在主机。</Thesis>
          <Shot src="/cases/aura/p03-design.jpg" cap="结构分解方向：镜圈 / 镜腿 / 线缆 / 主机" />
          <div className="mt-5 space-y-2 text-[13px] text-[#3a4149]">
            {[
              ["内容与应用", "运行在兼容手机或电脑；部分需网络。"],
              ["主机计算", "解码、窗口、智能辅助。"],
              ["连接与供电", "规划线缆供电+视频；无线与电池配件待验证。"],
              ["眼镜", "显示、扬声器或耳机孔、触控。"],
              ["反馈", "触控与主机键鼠 / 可选控制器。"],
            ].map(([h, b]) => (
              <div key={h} className="flex gap-3 border border-stone-200 bg-white px-3 py-2">
                <span className="w-28 shrink-0 font-semibold text-[#080A0D]">{h}</span>
                <span>{b}</span>
              </div>
            ))}
          </div>
          <Note>不罗列芯片与协议名。无线方案非默认。</Note>
          <Vis>浅色分层条，左眼镜、右主机。</Vis>
        </Page>

        <Page n="12" title="参数与兼容性：每一项规格，都有边界">
          <Thesis>写得出数字才写数字，写不出就标明待验证。</Thesis>
          <table className="mt-5 w-full border-collapse text-[12px] text-[#3a4149]">
            <tbody>
              {[
                ["显示方案", "双目显示 + 光学透视（规划）"],
                ["分辨率", "待工程验证"],
                ["刷新率", "待工程验证"],
                ["视场角", "待工程验证"],
                ["亮度及口径", "待工程验证"],
                ["重量", "待工程验证（是否含线缆将分列）"],
                ["音频", "镜腿开放式扬声器；兼容耳机（规划）"],
                ["连接", "规划有线；无线待验证"],
                ["供电", "主机/配件供电（规划）"],
                ["追踪", "待验证；不默认六自由度"],
                ["近视适配", "可选插件 / 第三方，范围待验证"],
                ["主机系统", "规划支持名单待公布"],
              ].map(([k, v]) => (
                <tr key={k} className="border-b border-stone-200">
                  <td className="py-2 pr-3 font-medium text-[#080A0D]">{k}</td>
                  <td className="py-2">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-[12px] font-semibold text-[#080A0D]">兼容性（概念）</p>
          <Cards
            items={[
              ["规划支持", "指定手机 / 电脑机型名单待公布"],
              ["需配件", "控制器、计算配件、收纳"],
              ["待验证", "无线投屏、第三方镜片"],
            ]}
          />
          <Note>接口相同 ≠ 完整兼容。</Note>
          <Vis>浅底表格，禁止伪造精确数字。</Vis>
        </Page>

        <Page n="13" title="产品配置：按场景，选择体验">
          <Thesis>三套装只改配件与场景，不改眼镜本体规格。</Thesis>
          <Shot src="/cases/aura/p14-case.jpg" cap="收纳是体验的一部分" />
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              ["Essential", "已有兼容主机", "眼镜 + 线缆 + 收纳", "自备手机或电脑", "入门连接"],
              ["Cinema", "观影为主", "基础 + 控制器 + 遮光配件（规划）", "相对静止环境", "控制与收纳加强"],
              ["Studio", "桌面多窗口", "基础 + 键盘方案说明 + 控制器", "需要稳定桌面", "输入与窗口"],
            ].map(([n, who, kit, pre, diff]) => (
              <div key={n} className="border border-stone-200 bg-white p-3 text-[12px] text-[#3a4149]">
                <p className="text-[13px] font-semibold text-[#080A0D]">{n}</p>
                <p className="mt-2">人群：{who}</p>
                <p>配件：{kit}</p>
                <p>前提：{pre}</p>
                <p>区别：{diff}</p>
              </div>
            ))}
          </div>
          <Note>不编造售价、库存、上市时间。</Note>
          <Vis>三卡并列，无价格标签。</Vis>
        </Page>

        <Page n="14" title="封底：下一块屏幕，不必放在桌上">
          <Thesis>收进盒里，也是一种完成。</Thesis>
          <Shot src="/cases/aura/p14-case.jpg" cap="收拢状态与收纳盒，呼应封面" />
          <p className="mt-4 text-[14px] leading-8 text-stone-600">
            我们不把下一块屏幕钉在墙上。曜界 AURA ONE 只做一件事：在你需要时，把画面轻轻放到眼前；在你结束时，安静回到盒中。
          </p>
          <div className="mt-6 flex flex-wrap gap-3 text-[13px]">
            <span className="rounded-full border border-teal-400 px-4 py-2 text-teal-700">了解概念方案</span>
            <span className="rounded-full border border-stone-300 px-4 py-2 text-stone-700">申请体验资讯</span>
          </div>
          <p className="mt-6 text-[12px] text-[#6d7680]">
            网站（占位符）：www.aura-one.example · 资讯：hello@aura-one.example · +86-000-0000-0000
          </p>
          <Note>概念稿。无二维码伪作。</Note>
          <Vis>静物收纳，呼应封面光。</Vis>
        </Page>
      </article>
    </div>
  );
}

function Page({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="mt-12 border-t border-stone-200 pt-8">
      <p className="font-mono text-[11px] tracking-[0.3em] text-teal-700">{n}</p>
      <h2 className="mt-2 text-[22px] font-semibold text-stone-900">{title}</h2>
      {children}
    </section>
  );
}

function Thesis({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[14px] font-medium leading-7 text-teal-700">{children}</p>;
}

function Cards({ items }: { items: [string, string][] }) {
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {items.map(([h, b]) => (
        <div key={h} className="border border-stone-200 bg-white p-3">
          <p className="text-[11px] tracking-wide text-teal-700">{h}</p>
          <p className="mt-1.5 text-[12px] leading-6 text-stone-600">{b}</p>
        </div>
      ))}
    </div>
  );
}

function Shot({ src, cap }: { src: string; cap: string }) {
  return (
    <figure className="mt-6 overflow-hidden rounded-sm border border-stone-200 bg-stone-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={cap} className="aspect-video w-full object-cover" />
      <figcaption className="px-3 py-2 text-[11px] tracking-wide text-[#6d7680]">{cap}</figcaption>
    </figure>
  );
}

function Vis({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11px] leading-6 text-[#6d7680]">视觉与版式：{children}</p>;
}

function Note({ children }: { children: ReactNode }) {
  return <p className="mt-3 text-[11px] leading-6 text-[#6d7680]">条件 / 脚注：{children}</p>;
}
