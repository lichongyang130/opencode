import { describe, it, expect, beforeEach } from "vitest";
import { GET as getHealth } from "./health/route";
import { GET as getVersion } from "./version/route";

describe("health & version API (O7/O8)", () => {
  it("GET /api/version 返回版本、提交和运行环境", async () => {
    const res = await getVersion();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("version");
    expect(data).toHaveProperty("commit");
    expect(data).toHaveProperty("builtAt");
    expect(data).toHaveProperty("node");
  });

  it("GET /api/health 返回健康状态与指标", async () => {
    const res = await getHealth();
    expect([200, 503]).toContain(res.status);
    const data = await res.json();
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("db");
    expect(data).toHaveProperty("disk");
    expect(data).toHaveProperty("uptimeSec");
    expect(data).toHaveProperty("sse");
    expect(data).toHaveProperty("faults");
  });
});