import { Sidebar } from "@/components/workspace/Sidebar";
import { ArtifactWall } from "@/components/canvas/ArtifactWall";

/** 画布 = AI 产物墙：聚合各会话的文档/PPT/图片/研究报告/视频分镜产物 */
export default function CanvasPage() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#fbf8f4] text-stone-800">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <ArtifactWall />
      </main>
    </div>
  );
}
