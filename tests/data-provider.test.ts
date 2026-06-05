import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDeliveryRecord, normalizeDeliveryPayload } from "@/lib/data/normalize";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

vi.mock("server-only", () => ({}));

describe("data normalize", () => {
  it("为导入记录补齐 id、updatedAt 和标签数组", () => {
    const record = createDeliveryRecord({
      province: "广东省",
      city: "深圳市",
      university: "深圳大学",
      purchaseTags: [],
      productTags: ["SDDC"],
    });

    expect(record.id).toMatch(/^delivery-/);
    expect(record.updatedAt).toMatch(/T/);
    expect(record.purchaseTags).toEqual([]);
    expect(record.productTags).toEqual(["SDDC"]);
  });

  it("规范化空标签和数字字段", () => {
    const payload = normalizeDeliveryPayload({
      province: " 广东省 ",
      city: " 深圳市 ",
      university: " 深圳大学 ",
      purchaseTags: undefined as unknown as string[],
      productTags: undefined as unknown as string[],
      resourceAmount: Number.NaN,
    });

    expect(payload.province).toBe("广东省");
    expect(payload.purchaseTags).toEqual([]);
    expect(payload.productTags).toEqual([]);
    expect(payload.resourceAmount).toBeUndefined();
  });
});

describe("data validation", () => {
  it("校验交付 payload 的必填字段", async () => {
    const { validateDeliveryPayload } = await import("@/lib/data/validation");

    expect(
      validateDeliveryPayload({
        province: "",
        city: "深圳市",
        university: "深圳大学",
        purchaseTags: [],
        productTags: [],
      }),
    ).toEqual({ ok: false, error: "缺少必填字段：省份" });

    expect(
      validateDeliveryPayload({
        province: "广东省",
        city: "深圳市",
        university: "深圳大学",
        purchaseTags: [],
        productTags: [],
      }),
    ).toEqual({ ok: true });
  });

  it("校验批量替换 payload 必须是非空数组", async () => {
    const { validateDeliveryPayloadArray } = await import("@/lib/data/validation");

    expect(validateDeliveryPayloadArray([])).toEqual({ ok: false, error: "交付记录不能为空" });
    expect(validateDeliveryPayloadArray({})).toEqual({ ok: false, error: "交付记录必须是数组" });
  });

  it("校验可选字段的运行时类型和枚举值", async () => {
    const { validateDeliveryPayload } = await import("@/lib/data/validation");

    const basePayload = {
      province: "广东省",
      city: "深圳市",
      university: "深圳大学",
      purchaseTags: [],
      productTags: [],
    };

    expect(validateDeliveryPayload({ ...basePayload, id: 123 })).toEqual({
      ok: false,
      error: "记录 ID 必须是字符串",
    });
    expect(validateDeliveryPayload({ ...basePayload, coverageStatus: "错误状态" })).toEqual({
      ok: false,
      error: "覆盖状态必须是以下值之一：已覆盖、跟进中、未覆盖、暂停",
    });
    expect(validateDeliveryPayload({ ...basePayload, projectStage: "错误阶段" })).toEqual({
      ok: false,
      error: "项目阶段必须是以下值之一：线索、测试、方案、交付、运维",
    });
    expect(validateDeliveryPayload({ ...basePayload, extraJson: [] })).toEqual({
      ok: false,
      error: "扩展字段JSON必须是普通对象",
    });
    expect(validateDeliveryPayload({ ...basePayload, extraJson: null })).toEqual({
      ok: false,
      error: "扩展字段JSON必须是普通对象",
    });
  });
});

describe("delivery api route", () => {
  const existingRecord: DeliveryRecord = {
    id: "delivery-existing",
    province: "广东省",
    city: "深圳市",
    university: "深圳大学",
    purchaseTags: [],
    productTags: ["SDDC"],
    updatedAt: "2026-06-05T00:00:00.000Z",
  };

  afterEach(() => {
    vi.doUnmock("@/lib/data/server-store");
    vi.resetModules();
    vi.clearAllMocks();
  });

  async function loadRoute(records: DeliveryRecord[] = [existingRecord]) {
    const store = {
      readServerRecords: vi.fn(async () => records),
      replaceServerRecords: vi.fn(async (payloads: DeliveryPayload[]) =>
        payloads.map((payload, index) => ({
          ...payload,
          id: payload.id ?? `delivery-${index}`,
          updatedAt: payload.updatedAt ?? "2026-06-05T00:00:00.000Z",
        })),
      ),
      writeServerRecords: vi.fn(async () => undefined),
    };

    vi.resetModules();
    vi.doMock("@/lib/data/server-store", () => store);
    const route = await import("@/app/api/deliveries/route");
    return { route, store };
  }

  it("POST malformed JSON 返回 400", async () => {
    const { route, store } = await loadRoute();
    const response = await route.POST(
      new Request("http://localhost/api/deliveries", {
        method: "POST",
        body: "{",
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "请求 JSON 格式错误" });
    expect(store.writeServerRecords).not.toHaveBeenCalled();
  });

  it("POST 缺少必填字段返回 400", async () => {
    const { route, store } = await loadRoute();
    const response = await route.POST(
      new Request("http://localhost/api/deliveries", {
        method: "POST",
        body: JSON.stringify({ province: "广东省", city: "", university: "深圳大学" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "缺少必填字段：地区/城市" });
    expect(store.writeServerRecords).not.toHaveBeenCalled();
  });

  it("POST purchaseTags 类型错误返回 400 且不写入", async () => {
    const { route, store } = await loadRoute();
    const response = await route.POST(
      new Request("http://localhost/api/deliveries", {
        method: "POST",
        body: JSON.stringify({
          province: "广东省",
          city: "深圳市",
          university: "深圳大学",
          purchaseTags: "bad",
          productTags: [],
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "采购标签必须是字符串数组" });
    expect(store.writeServerRecords).not.toHaveBeenCalled();
  });

  it("PUT 不存在 ID 返回 404 且不写入", async () => {
    const { route, store } = await loadRoute();
    const response = await route.PUT(
      new Request("http://localhost/api/deliveries", {
        method: "PUT",
        body: JSON.stringify({
          id: "delivery-missing",
          province: "广东省",
          city: "深圳市",
          university: "深圳大学",
          purchaseTags: [],
          productTags: [],
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "记录不存在" });
    expect(store.writeServerRecords).not.toHaveBeenCalled();
  });

  it("DELETE 不存在 ID 返回 404 且不写入", async () => {
    const { route, store } = await loadRoute();
    const response = await route.DELETE(
      new Request("http://localhost/api/deliveries", {
        method: "DELETE",
        body: JSON.stringify({ id: "delivery-missing" }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "记录不存在" });
    expect(store.writeServerRecords).not.toHaveBeenCalled();
  });

  it("DELETE body 为 null 返回 400 且不写入", async () => {
    const { route, store } = await loadRoute();
    const response = await route.DELETE(
      new Request("http://localhost/api/deliveries", {
        method: "DELETE",
        body: "null",
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "请求体必须是对象" });
    expect(store.writeServerRecords).not.toHaveBeenCalled();
  });

  it("PATCH 空数组返回 400 且不替换数据", async () => {
    const { route, store } = await loadRoute();
    const response = await route.PATCH(
      new Request("http://localhost/api/deliveries", {
        method: "PATCH",
        body: JSON.stringify([]),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "交付记录不能为空" });
    expect(store.replaceServerRecords).not.toHaveBeenCalled();
  });

  it("PATCH productTags 类型错误返回 400 且不替换数据", async () => {
    const { route, store } = await loadRoute();
    const response = await route.PATCH(
      new Request("http://localhost/api/deliveries", {
        method: "PATCH",
        body: JSON.stringify([
          {
            province: "广东省",
            city: "深圳市",
            university: "深圳大学",
            purchaseTags: [],
            productTags: "bad",
          },
        ]),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "第 1 条记录产品标签必须是字符串数组" });
    expect(store.replaceServerRecords).not.toHaveBeenCalled();
  });
});

describe("server store", () => {
  const localRecord: DeliveryRecord = {
    id: "delivery-local",
    province: "广东省",
    city: "深圳市",
    university: "深圳大学",
    purchaseTags: [],
    productTags: ["SDDC"],
    updatedAt: "2026-06-05T00:00:00.000Z",
  };

  it("本地数据文件损坏时抛错而不是回退 mock", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "edu-deliveries-"));
    const filePath = path.join(dir, "deliveries.local.json");

    try {
      await writeFile(filePath, "{bad json", "utf8");
      const { readLocalDeliveryRecords } = await import("@/lib/data/server-store");

      await expect(readLocalDeliveryRecords(filePath)).rejects.toThrow("本地交付数据文件损坏");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("本地数据写入后可以读取", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "edu-deliveries-"));
    const filePath = path.join(dir, "deliveries.local.json");

    try {
      const { readLocalDeliveryRecords, writeLocalDeliveryRecords } = await import("@/lib/data/server-store");

      await writeLocalDeliveryRecords([localRecord], filePath);

      expect(await readLocalDeliveryRecords(filePath)).toEqual([localRecord]);
      expect(await readFile(filePath, "utf8")).toContain("delivery-local");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("Blob 写入使用固定 key 覆盖和合法缓存时间", async () => {
    const originalVercel = process.env.VERCEL;
    const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
    const put = vi.fn(async () => ({ url: "", downloadUrl: "", pathname: "", contentType: "", contentDisposition: "" }));
    const list = vi.fn();

    vi.resetModules();
    vi.doMock("@vercel/blob", () => ({ list, put }));

    try {
      process.env.VERCEL = "1";
      process.env.BLOB_READ_WRITE_TOKEN = "token";
      const { writeServerRecords } = await import("@/lib/data/server-store");

      await writeServerRecords([localRecord]);

      expect(put).toHaveBeenCalledWith("edu-system/deliveries.json", expect.stringContaining("delivery-local"), {
        access: "public",
        allowOverwrite: true,
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        contentType: "application/json",
      });
    } finally {
      if (originalVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = originalVercel;
      }
      if (originalToken === undefined) {
        delete process.env.BLOB_READ_WRITE_TOKEN;
      } else {
        process.env.BLOB_READ_WRITE_TOKEN = originalToken;
      }
      vi.doUnmock("@vercel/blob");
      vi.resetModules();
    }
  });
});

describe("browser provider", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("localStorage 损坏时返回 seed 且不覆盖坏数据", async () => {
    const seed: DeliveryRecord[] = [
      {
        id: "delivery-seed",
        province: "广东省",
        city: "深圳市",
        university: "深圳大学",
        purchaseTags: [],
        productTags: ["SDDC"],
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
    ];

    window.localStorage.setItem("edu-system.deliveries", "{bad json");
    const { createBrowserProvider } = await import("@/lib/data/browser-provider");
    const provider = createBrowserProvider(seed);

    expect(await provider.list()).toEqual(seed);
    expect(window.localStorage.getItem("edu-system.deliveries")).toBe("{bad json");
  });
});
