"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSseStream } from "@/hooks/useSseStream";
import { Copy, Download, FileText, Loader2, QrCode, Sparkles, Square, X } from "lucide-react";
import QRCodeLib from "qrcode";
import { ALL_TOOLS, type ToolDef, type ToolResult } from "@/lib/tools";
import { useChatStore } from "@/lib/store/chat";
import { getOverrides } from "@/lib/settings";
import { toast } from "@/lib/store/toast";
import { TaskBoard } from "./TaskBoard";
import { ImageGallery } from "./ImageGallery";
import { PermissionMatrix } from "./PermissionMatrix";

interface PdfFile {
  name: string;
  size: number;
  data: string; // dataURL
}

interface PdfOut {
  name: string;
  data: string; // base64
}

function downloadBase64Pdf(name: string, b64: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadFile(name: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** 工具运行器：文本类工具的输入 → 处理 → 输出（支持流式 AI / 图片水印 / 分享 / 建任务） */
export function ToolRunnerModal({
  tool,
  onClose,
  onHandoff,
}: {
  tool: ToolDef | null;
  onClose: () => void;
  /** 工具接力：把当前结果文本送入另一个工具继续处理 */
  onHandoff?: (target: ToolDef, text: string) => void;
}) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [option, setOption] = useState<string>("");
  const [result, setResult] = useState<ToolResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [wmText, setWmText] = useState("OpenCanvas");
  const [srcImage, setSrcImage] = useState<string>("");
  const [shareUrl, setShareUrl] = useState("");
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [pdfOuts, setPdfOuts] = useState<PdfOut[]>([]);
  const [pages, setPages] = useState("");
  const [ocrImage, setOcrImage] = useState("");
  const [qrData, setQrData] = useState("");
  const [handoffTarget, setHandoffTarget] = useState("");
  const handoffTools = tool
    ? ALL_TOOLS.filter(
        (t) => t.id !== tool.id && t.kind !== "unsupported" && (t.kind === "local" || t.kind === "ai"),
      )
    : [];
  const aiStream = useSseStream();

  /** 生成二维码（纯前端，qrcode 库） */
  const generateQr = async () => {
    const text = input.trim();
    if (!text) {
      toast("请先输入链接或文字", "error");
      return;
    }
    try {
      const data = await QRCodeLib.toDataURL(text, { width: 512, margin: 2 });
      setQrData(data);
      toast("二维码已生成", "success");
    } catch {
      toast("生成失败：内容过长或包含不支持的字符", "error");
    }
  };

  const downloadQr = () => {
    if (!qrData) return;
    const a = document.createElement("a");
    a.href = qrData;
    a.download = `qr-${Date.now()}.png`;
    a.click();
  };
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const ocrRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput("");
    setResult(null);
    setShareUrl("");
    setBusy(false);
    setPdfFiles([]);
    setPdfOuts([]);
    setPages("");
    setOcrImage("");
    setQrData("");
    setOption(tool?.option?.default ?? "");
  }, [tool]);


  if (!tool) return null;

  const stamp = () => new Date().toISOString().slice(0, 10);

  const runAi = async () => {
    const text = input.trim();
    if (!text) {
      toast("请先输入内容", "error");
      return;
    }
    setBusy(true);
    setResult({ output: "" });
    const store = useChatStore.getState();
    let acc = "";
    try {
      // AI15：SSE 读取收敛进 useSseStream；error 事件由 hook 统一抛出
      acc = await aiStream.start({
        url: "/api/chat",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: store.model,
          overrides: getOverrides(),
          messages: [
            { role: "system", content: tool.system ?? "你是一个高效的助手，请用中文回答。" },
            { role: "user", content: text },
          ],
        }),
      });
      setResult({ output: acc.trim() || "（没有返回内容）" });
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setResult({ output: aiStream.text || "已停止生成。", note: "已手动停止" });
      } else {
        setResult({ output: "", note: `⚠️ ${err instanceof Error ? err.message : "运行失败"}` });
      }
    } finally {
      setBusy(false);
    }
  };

  const runWatermark = () => {
    if (!srcImage) {
      toast("请先选择一张图片", "error");
      return;
    }
    setBusy(true);
    const img = new Image();
    img.onload = () => {
      const maxW = 1200;
      const scale = Math.min(1, maxW / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setBusy(false);
        toast("当前浏览器不支持 Canvas", "error");
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const text = wmText.trim() || "OpenCanvas";
      ctx.save();
      ctx.translate(w / 2, h / 2);
      ctx.rotate((-20 * Math.PI) / 180);
      ctx.font = `600 ${Math.max(18, Math.round(w / 22))}px system-ui, sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.62)";
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const step = Math.max(160, Math.round(w / 4));
      for (let y = -h; y < h; y += step) {
        for (let x = -w; x < w; x += step * 2.2) {
          ctx.strokeText(text, x, y);
          ctx.fillText(text, x, y);
        }
      }
      ctx.restore();
      const url = canvas.toDataURL("image/png");
      setResult({ output: "", image: url, note: `已生成水印图（${w}×${h}），可下载保存`, ext: "png" });
      setBusy(false);
    };
    img.onerror = () => {
      setBusy(false);
      toast("图片读取失败", "error");
    };
    img.src = srcImage;
  };

  const runPdf = async () => {
    if (pdfFiles.length === 0) {
      toast("请先选择 PDF 文件", "error");
      return;
    }
    const opt = option || tool.option?.default || "info";
    const [action, variant] = opt.split("-");
    if ((action === "merge") && pdfFiles.length < 2) {
      toast("合并至少需要 2 个 PDF", "error");
      return;
    }
    if ((opt === "split-range" || action === "extract") && !pages.trim()) {
      toast(opt === "extract" ? "请填写要提取的页码，如 1,3,5-7" : "请填写页码段，如 1-3;5-8;10-", "error");
      return;
    }
    setBusy(true);
    setPdfOuts([]);
    try {
      const res = await fetch("/api/tools/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          files: pdfFiles.map((f) => ({ name: f.name, data: f.data })),
          ranges: opt === "split-range" ? pages.trim() : undefined,
          pages: action === "extract" || action === "rotate" ? pages.trim() || undefined : undefined,
          angle: 90,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; text?: string; files?: PdfOut[]; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "处理失败");
      setResult({ output: data.text ?? "完成" });
      setPdfOuts(data.files ?? []);
      toast("PDF 处理完成", "success");
    } catch (err) {
      setResult({ output: "", note: `⚠️ ${err instanceof Error ? err.message : "处理失败"}` });
    } finally {
      setBusy(false);
    }
  };

  const runOcr = async () => {
    if (!ocrImage) {
      toast("请先选择图片", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/tools/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: ocrImage, prompt: input.trim() || undefined, overrides: getOverrides() }),
      });
      const data = (await res.json()) as { ok?: boolean; text?: string; error?: string; model?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "识别失败");
      setResult({ output: data.text ?? "", note: `识别模型：${data.model ?? "视觉模型"}` });
      toast("识别完成", "success");
    } catch (err) {
      setResult({ output: "", note: `⚠️ ${err instanceof Error ? err.message : "识别失败"}` });
    } finally {
      setBusy(false);
    }
  };

  const runShare = async () => {
    const text = input.trim();
    if (!text) {
      toast("请先输入要分享的内容", "error");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/cases/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: `tool-${tool.id}`,
          label: text.split("\n")[0].slice(0, 30) || "分享内容",
          prompt: text,
          source: `工具箱 · ${tool.name}`,
        }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) throw new Error(data.error ?? "生成失败");
      const url = `${window.location.origin}/s/${data.code}`;
      setShareUrl(url);
      setResult({ output: url, note: "链接已生成，任何人打开即可查看这份内容" });
      toast("分享链接已生成", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "生成失败", "error");
    } finally {
      setBusy(false);
    }
  };

  const runTask = async () => {
    const text = input.trim();
    if (!text) {
      toast("请先描述任务", "error");
      return;
    }
    setBusy(true);
    try {
      await useChatStore.getState().runTemplate({ mode: "chat", prompt: text });
      onClose();
      router.push("/chat");
      toast("任务已创建，正在生成…", "success");
    } finally {
      setBusy(false);
    }
  };

  const run = () => {
    if (tool.kind === "ai") return void runAi();
    if (tool.kind === "watermark") return runWatermark();
    if (tool.kind === "pdf") return void runPdf();
    if (tool.kind === "ocr") return void runOcr();
    if (tool.kind === "share") return void runShare();
    if (tool.kind === "qr") return void generateQr();
    if (tool.kind === "task") return void runTask();
    if (tool.kind === "local" && tool.run) {
      const r = tool.run(input, option || tool.option?.default);
      setResult(r);
      return;
    }
  };

  const copyResult = async () => {
    const text = result?.output ?? "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast("已复制结果", "success");
    } catch {
      toast("复制失败，请手动选择复制", "error");
    }
  };

  const downloadResult = () => {
    if (!result) return;
    if (result.image) {
      const a = document.createElement("a");
      a.href = result.image;
      a.download = `${tool.name}-${stamp()}.png`;
      a.click();
      return;
    }
    if (result.html) {
      downloadFile(`${tool.name}-${stamp()}.svg`, result.html, "image/svg+xml");
      return;
    }
    if (!result.output) return;
    downloadFile(`${tool.name}-${stamp()}.${result.ext ?? "txt"}`, result.output);
  };

  const continueInChat = async () => {
    const text = result?.output ?? "";
    if (!text) return;
    await useChatStore
      .getState()
      .runTemplate({ mode: "chat", prompt: `这是我用「${tool.name}」得到的结果，请基于它继续帮我完善：\n\n${text.slice(0, 3000)}` });
    onClose();
    router.push("/chat");
  };

  const fallbackToChat = async () => {
    const prompt = `${tool.fallbackPrompt ?? "请帮我完成下面的需求：\n"}${input}`.trim();
    await useChatStore.getState().runTemplate({ mode: "chat", prompt });
    onClose();
    router.push("/chat");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-start gap-3 border-b border-stone-100 p-5">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tool.bg} ${tool.tint}`}>
            <tool.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-semibold text-stone-800">{tool.name}</h3>
            <p className="mt-0.5 text-[12px] leading-5 text-stone-400">{tool.desc}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 内容 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tool.kind === "unsupported" ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-6 text-amber-800">
                {tool.reason}
              </div>
              <p className="text-[13px] text-stone-600">可以先用 AI 把这件事做掉（会带着下面的内容跳到对话）：</p>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={6}
                placeholder="粘贴相关内容（可留空）…"
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-[13px] leading-6 outline-none focus:border-[#e0b79c]"
              />
              <button
                onClick={() => void fallbackToChat()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 py-2.5 text-[13px] font-medium text-white transition hover:brightness-105"
              >
                <Sparkles className="h-4 w-4" /> 用 AI 代替完成
              </button>
            </div>
          ) : tool.kind === "board" ? (
            <TaskBoard />
          ) : tool.kind === "matrix" ? (
            <PermissionMatrix />
          ) : tool.kind === "gallery" ? (
            <ImageGallery />
          ) : tool.kind === "qr" ? (
            <div className="space-y-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={3}
                placeholder={tool.hint}
                className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-[13px] leading-6 outline-none focus:border-[#e0b79c]"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void generateQr()}
                  disabled={!input.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-[12.5px] font-medium text-white transition hover:bg-brand-700 disabled:opacity-40"
                >
                  <QrCode className="h-4 w-4" /> 生成二维码
                </button>
                {qrData && (
                  <button
                    onClick={downloadQr}
                    className="flex items-center gap-1 rounded-lg border border-stone-200 px-3 py-2 text-[12.5px] text-stone-600 transition hover:border-brand-300 hover:text-brand-600"
                  >
                    <Download className="h-3.5 w-3.5" /> 下载 PNG
                  </button>
                )}
              </div>
              {qrData && (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-stone-100 bg-stone-50 p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrData} alt="二维码" className="h-48 w-48 rounded-lg bg-white shadow-sm" />
                  <p className="text-[11px] text-stone-400">内容长度 {input.trim().length} 字符 · 纯前端生成，数据不出浏览器</p>
                </div>
              )}
            </div>
          ) : (
            <>
              {tool.kind === "pdf" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => pdfRef.current?.click()}
                      className="rounded-xl border border-[#e0b79c] px-3.5 py-2 text-[13px] text-[#c05f3c] transition hover:bg-[#fdeee1]"
                    >
                      选择 PDF
                    </button>
                    <input
                      ref={pdfRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const list = Array.from(e.target.files ?? []);
                        for (const f of list) {
                          const reader = new FileReader();
                          reader.onload = () =>
                            setPdfFiles((prev) => [
                              ...prev,
                              { name: f.name, size: f.size, data: String(reader.result ?? "") },
                            ]);
                          reader.readAsDataURL(f);
                        }
                        e.currentTarget.value = "";
                      }}
                    />
                    {pdfFiles.length > 0 && (
                      <button
                        onClick={() => {
                          setPdfFiles([]);
                          setPdfOuts([]);
                        }}
                        className="text-[12px] text-stone-400 hover:text-stone-600"
                      >
                        清空
                      </button>
                    )}
                    <span className="text-[11.5px] text-stone-400">
                      合并选多个；拆分 / 提取 / 旋转只用第一个文件
                    </span>
                  </div>

                  {pdfFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 rounded-lg border border-stone-100 px-3 py-2 text-[12.5px]">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      <span className="min-w-0 flex-1 truncate text-stone-700">{f.name}</span>
                      <span className="shrink-0 text-stone-400">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                      <button
                        onClick={() => setPdfFiles((prev) => prev.filter((_, j) => j !== i))}
                        className="shrink-0 text-stone-300 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}

                  {(option === "split-range" || option === "extract" || option === "rotate") && (
                    <input
                      value={pages}
                      onChange={(e) => setPages(e.target.value)}
                      placeholder={
                        option === "split-range"
                          ? "页码段，分号分隔：1-3;5-8;10-"
                          : option === "extract"
                            ? "要提取的页码：1,3,5-7"
                            : "要旋转的页码（留空=全部）：1,2,5-8"
                      }
                      className="w-full rounded-xl border border-stone-200 px-3 py-2 text-[13px] outline-none focus:border-[#e0b79c]"
                    />
                  )}

                  {pdfOuts.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[12px] font-medium text-stone-500">输出文件（{pdfOuts.length}）</p>
                      {pdfOuts.map((f, i) => (
                        <button
                          key={i}
                          onClick={() => downloadBase64Pdf(f.name, f.data)}
                          className="flex w-full items-center gap-2 rounded-lg border border-[#e0b79c] bg-[#fdf1e3] px-3 py-2 text-left text-[12.5px] text-[#c05f3c] transition hover:bg-[#fdeee1]"
                        >
                          <Download className="h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{f.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : tool.kind === "ocr" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => ocrRef.current?.click()}
                      className="rounded-xl border border-[#e0b79c] px-3.5 py-2 text-[13px] text-[#c05f3c] transition hover:bg-[#fdeee1]"
                    >
                      选择图片
                    </button>
                    <input
                      ref={ocrRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const reader = new FileReader();
                        reader.onload = () => setOcrImage(String(reader.result ?? ""));
                        reader.readAsDataURL(f);
                        e.currentTarget.value = "";
                      }}
                    />
                    {ocrImage && (
                      <button onClick={() => setOcrImage("")} className="text-[12px] text-stone-400 hover:text-stone-600">
                        移除
                      </button>
                    )}
                  </div>
                  {ocrImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ocrImage} alt="待识别" className="max-h-56 rounded-xl border border-stone-100 object-contain" />
                  )}
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="可选：补充识别要求，如「只提取表格」「保留换行」"
                    className="w-full rounded-xl border border-stone-200 px-3 py-2 text-[13px] outline-none focus:border-[#e0b79c]"
                  />
                  <p className="text-[11.5px] leading-5 text-stone-400">
                    识别需要带视觉能力的模型：在「模型设置」填入 OpenAI / Anthropic / 阿里云百炼 任一密钥；未配置时会给出明确提示。
                  </p>
                </div>
              ) : tool.kind === "watermark" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="rounded-xl border border-stone-200 px-3.5 py-2 text-[13px] text-stone-600 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                    >
                      选择图片
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const reader = new FileReader();
                        reader.onload = () => setSrcImage(String(reader.result ?? ""));
                        reader.readAsDataURL(f);
                      }}
                    />
                    <input
                      value={wmText}
                      onChange={(e) => setWmText(e.target.value)}
                      placeholder="水印文字"
                      className="flex-1 rounded-xl border border-stone-200 px-3 py-2 text-[13px] outline-none focus:border-[#e0b79c]"
                    />
                  </div>
                  {srcImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={srcImage} alt="原图" className="max-h-52 rounded-xl border border-stone-100 object-contain" />
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-stone-500">输入</span>
                    {tool.sample && (
                      <button
                        onClick={() => setInput(tool.sample ?? "")}
                        className="text-[11.5px] text-stone-400 transition hover:text-[#c05f3c]"
                      >
                        填入示例
                      </button>
                    )}
                  </div>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    rows={tool.kind === "ai" ? 5 : 7}
                    placeholder={tool.hint}
                    className="w-full rounded-xl border border-stone-200 px-3 py-2.5 text-[13px] leading-6 outline-none focus:border-[#e0b79c]"
                  />
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {tool.option && (
                  <select
                    value={option || tool.option.default}
                    onChange={(e) => setOption(e.target.value)}
                    className="rounded-xl border border-stone-200 px-3 py-2 text-[13px] text-stone-600 outline-none focus:border-[#e0b79c]"
                  >
                    {tool.option.choices.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                )}
                {busy && tool.kind === "ai" ? (
                  <button
                    onClick={() => aiStream.stop()}
                    className="flex items-center gap-1.5 rounded-xl bg-stone-700 px-4 py-2 text-[13px] font-medium text-white"
                  >
                    <Square className="h-3 w-3 fill-current" /> 停止
                  </button>
                ) : (
                  <button
                    onClick={run}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-400 to-red-500 px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-105 disabled:opacity-50"
                  >
                    {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {tool.action ?? (tool.kind === "ai" ? "生成" : "运行")}
                  </button>
                )}
                {tool.kind === "ai" && (
                  <span className="text-[11.5px] text-stone-400">
                    未配置密钥时使用内置演示模型，配置后自动切换到你的模型
                  </span>
                )}
              </div>

              {/* 结果 */}
              {(result || busy) && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[12px] font-medium text-stone-500">结果</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => void copyResult()}
                        className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-[11.5px] text-stone-500 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                      >
                        <Copy className="h-3 w-3" /> 复制
                      </button>
                      <button
                        onClick={downloadResult}
                        className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-[11.5px] text-stone-500 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                      >
                        <Download className="h-3 w-3" /> 下载
                      </button>
                      {result?.output && result.output.length > 20 && (
                        <button
                          onClick={() => void continueInChat()}
                          className="flex items-center gap-1 rounded-lg border border-stone-200 px-2.5 py-1 text-[11.5px] text-stone-500 transition hover:border-[#e0b79c] hover:text-[#c05f3c]"
                        >
                          <Sparkles className="h-3 w-3" /> 在对话中继续
                        </button>
                      )}
                    </div>
                  </div>

                  {result?.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={result.image} alt="结果" className="max-h-72 rounded-xl border border-stone-100 object-contain" />
                  )}

                  {result?.html && (
                    <div
                      className="overflow-x-auto rounded-xl border border-stone-100 bg-[#fdfaf6] p-3"
                      dangerouslySetInnerHTML={{ __html: result.html }}
                    />
                  )}

                  {result?.output && (
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-stone-100 bg-[#fbf8f4] p-3.5 text-[12.5px] leading-6 text-stone-700">
                      {result.output}
                    </pre>
                  )}

                  {shareUrl && (
                    <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#e0b79c] bg-[#fdf1e3] px-3 py-2">
                      <a
                        href={shareUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-w-0 flex-1 truncate text-[12.5px] text-[#c05f3c] underline"
                      >
                        {shareUrl}
                      </a>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(shareUrl).then(
                            () => toast("链接已复制", "success"),
                            () => toast("复制失败", "error")
                          );
                        }}
                        className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-[11.5px] text-stone-600"
                      >
                        复制
                      </button>
                    </div>
                  )}

                  {result?.note && <p className="mt-2 text-[11.5px] text-stone-400">{result.note}</p>}

                  {/* 工具接力：结果文本送入另一个工具 */}
                  {result?.output && onHandoff && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-stone-200 bg-stone-50/70 px-3 py-2">
                      <span className="shrink-0 text-[11.5px] text-stone-400">接力：</span>
                      <select
                        value={handoffTarget}
                        onChange={(e) => setHandoffTarget(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-[12px] text-stone-600 outline-none"
                      >
                        <option value="">选择下一个工具…</option>
                        {(handoffTools ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} · {t.desc}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!handoffTarget}
                        onClick={() => {
                          const target = (handoffTools ?? []).find((t) => t.id === handoffTarget);
                          if (target) onHandoff(target, result?.output ?? "");
                        }}
                        className="shrink-0 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-stone-600 transition hover:border-orange-300 hover:text-orange-600 disabled:opacity-40"
                      >
                        送入
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
