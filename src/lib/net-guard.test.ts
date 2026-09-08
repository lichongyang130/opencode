import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockedAddressError, assertPublicUrl, safeFetch } from "./net-guard";

/**
 * SSRF 防护测试。
 *
 * DNS 解析被 mock 掉：真实解析会依赖网络与本地 resolver，
 * 既慢又会让「域名指向内网」这类用例无法稳定复现。
 */
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

const { lookup } = (await import("node:dns/promises")) as unknown as {
  lookup: ReturnType<typeof vi.fn>;
};

afterEach(() => {
  vi.restoreAllMocks();
  lookup.mockReset();
});

/** 让指定域名解析到给定地址 */
function resolveTo(...addresses: string[]) {
  lookup.mockResolvedValue(addresses.map((address) => ({ address })));
}

describe("协议与格式校验", () => {
  it("拒绝非 http/https 协议", async () => {
    for (const url of [
      "file:///etc/passwd",
      "ftp://example.com/x",
      "gopher://example.com",
      "data:text/plain,hi",
    ]) {
      await expect(assertPublicUrl(url)).rejects.toThrow(BlockedAddressError);
    }
  });

  it("拒绝无法解析的 URL 字面量", async () => {
    await expect(assertPublicUrl("不是链接")).rejects.toThrow(/链接格式不正确/);
  });
});

describe("主机名黑名单", () => {
  it("拒绝 localhost 及其子域", async () => {
    for (const host of ["localhost", "LOCALHOST", "api.localhost"]) {
      await expect(assertPublicUrl(`http://${host}/x`)).rejects.toThrow(/本机地址/);
    }
  });

  it("拒绝云厂商元数据主机名", async () => {
    for (const host of ["metadata", "metadata.google.internal"]) {
      await expect(assertPublicUrl(`http://${host}/`)).rejects.toThrow(/本机地址/);
    }
  });
});

describe("IPv4 保留段", () => {
  const blocked = [
    ["127.0.0.1", "环回"],
    ["127.1.2.3", "环回段内其它地址"],
    ["10.0.0.1", "私有 A 类"],
    ["172.16.0.1", "私有 B 类"],
    ["172.31.255.255", "私有 B 类上界"],
    ["192.168.1.1", "私有 C 类"],
    ["169.254.169.254", "云元数据服务"],
    ["169.254.0.1", "链路本地"],
    ["0.0.0.0", "本网络"],
    ["100.64.0.1", "运营商级 NAT"],
    ["192.0.0.1", "IETF 协议分配"],
    ["198.18.0.1", "基准测试段"],
    ["224.0.0.1", "组播"],
    ["255.255.255.255", "广播"],
  ] as const;

  for (const [ip, label] of blocked) {
    it(`拒绝 ${ip}（${label}）`, async () => {
      await expect(assertPublicUrl(`http://${ip}/`)).rejects.toThrow(/内网或保留地址/);
    });
  }

  it("放行公网 IPv4 字面量", async () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "172.15.0.1", "172.32.0.1"]) {
      await expect(assertPublicUrl(`http://${ip}/`)).resolves.toBeInstanceOf(URL);
    }
  });
});

describe("IPv6 保留段", () => {
  it("拒绝环回与未指定地址", async () => {
    for (const ip of ["[::1]", "[::]"]) {
      await expect(assertPublicUrl(`http://${ip}/`)).rejects.toThrow(/内网或保留地址/);
    }
  });

  it("拒绝唯一本地地址 fc00::/7", async () => {
    for (const ip of ["[fc00::1]", "[fd12:3456::1]"]) {
      await expect(assertPublicUrl(`http://${ip}/`)).rejects.toThrow(/内网或保留地址/);
    }
  });

  it("拒绝链路本地 fe80::/10", async () => {
    await expect(assertPublicUrl("http://[fe80::1]/")).rejects.toThrow(/内网或保留地址/);
  });

  it("拒绝 IPv4 映射形式的内网地址", async () => {
    await expect(assertPublicUrl("http://[::ffff:127.0.0.1]/")).rejects.toThrow(/内网或保留地址/);
    await expect(assertPublicUrl("http://[::ffff:169.254.169.254]/")).rejects.toThrow(
      /内网或保留地址/
    );
  });

  it("拒绝 URL 规范化后的十六进制映射形式（new URL 会改写字面量）", async () => {
    // http://[::ffff:127.0.0.1]/ 会被规范化成 [::ffff:7f00:1]，
    // 只按点分十进制做正则匹配会漏掉这种等价写法
    await expect(assertPublicUrl("http://[::ffff:7f00:1]/")).rejects.toThrow(/内网或保留地址/);
    await expect(assertPublicUrl("http://[::ffff:a9fe:a9fe]/")).rejects.toThrow(/内网或保留地址/);
  });

  it("拒绝 IPv4 兼容形式 ::x.x.x.x", async () => {
    await expect(assertPublicUrl("http://[::127.0.0.1]/")).rejects.toThrow(/内网或保留地址/);
  });

  it("拒绝带 zone id 的链路本地地址（URL 解析阶段即被判非法）", async () => {
    await expect(assertPublicUrl("http://[fe80::1%25eth0]/")).rejects.toThrow(BlockedAddressError);
  });

  it("拒绝 fe80::/10 段内的其它地址（fea0 / febf）", async () => {
    for (const ip of ["[fea0::1]", "[febf::1]"]) {
      await expect(assertPublicUrl(`http://${ip}/`)).rejects.toThrow(/内网或保留地址/);
    }
  });

  it("放行公网 IPv6", async () => {
    await expect(assertPublicUrl("http://[2606:4700:4700::1111]/")).resolves.toBeInstanceOf(URL);
  });
});

describe("DNS 解析结果校验", () => {
  it("域名解析到内网时拒绝（DNS rebinding）", async () => {
    resolveTo("127.0.0.1");
    await expect(assertPublicUrl("http://evil.example/")).rejects.toThrow(/指向内网或保留地址/);
  });

  it("多条解析结果中只要有一条是内网就拒绝，避免轮询绕过", async () => {
    resolveTo("93.184.216.34", "10.0.0.5");
    await expect(assertPublicUrl("http://mixed.example/")).rejects.toThrow(/指向内网或保留地址/);
  });

  it("解析失败时拒绝", async () => {
    lookup.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(assertPublicUrl("http://nope.example/")).rejects.toThrow(/无法解析该域名/);
  });

  it("解析结果为空时拒绝", async () => {
    lookup.mockResolvedValue([]);
    await expect(assertPublicUrl("http://empty.example/")).rejects.toThrow(/无法解析该域名/);
  });

  it("解析到公网地址时放行", async () => {
    resolveTo("93.184.216.34");
    await expect(assertPublicUrl("http://example.com/page")).resolves.toBeInstanceOf(URL);
  });
});

describe("safeFetch 重定向逐跳校验", () => {
  /** 构造一个只返回重定向头的响应 */
  const redirect = (location: string) =>
    new Response(null, { status: 302, headers: { location } });

  it("正常响应直接返回", async () => {
    resolveTo("93.184.216.34");
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await safeFetch("http://example.com/");
    expect(res.status).toBe(200);
    // 必须用 manual，否则 302 会被底层自动跟随、跳过后续校验
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: "manual" });
  });

  it("重定向到内网时在第二跳被拦下（旧代码用 follow 会被绕过）", async () => {
    lookup.mockImplementation(async (host: string) =>
      host === "example.com" ? [{ address: "93.184.216.34" }] : [{ address: "169.254.169.254" }]
    );
    const fetchMock = vi.fn().mockResolvedValue(redirect("http://metadata.evil/latest/meta-data"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetch("http://example.com/")).rejects.toThrow(BlockedAddressError);
  });

  it("重定向到 IP 字面量的内网地址同样被拦下", async () => {
    resolveTo("93.184.216.34");
    const fetchMock = vi.fn().mockResolvedValue(redirect("http://127.0.0.1:8080/admin"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetch("http://example.com/")).rejects.toThrow(/内网或保留地址/);
  });

  it("跟随公网之间的重定向并返回终态响应", async () => {
    resolveTo("93.184.216.34");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect("http://example.com/final"))
      .mockResolvedValueOnce(new Response("done", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await safeFetch("http://example.com/start");
    expect(await res.text()).toBe("done");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("相对路径的 Location 按当前 URL 解析", async () => {
    resolveTo("93.184.216.34");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(redirect("/relative"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await safeFetch("http://example.com/start");
    expect(String(fetchMock.mock.calls[1][0])).toBe("http://example.com/relative");
  });

  it("重定向链过长时中止，防止兜圈子耗尽资源", async () => {
    resolveTo("93.184.216.34");
    const fetchMock = vi.fn().mockResolvedValue(redirect("http://example.com/loop"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(safeFetch("http://example.com/", { maxRedirects: 2 })).rejects.toThrow(
      /重定向次数过多/
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("缺少 Location 头的重定向响应原样返回，不进入下一跳", async () => {
    resolveTo("93.184.216.34");
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 302 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await safeFetch("http://example.com/");
    expect(res.status).toBe(302);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});