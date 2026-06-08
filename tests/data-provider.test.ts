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

  it("extraJson 只接受 plain object", async () => {
    const { validateDeliveryPayload } = await import("@/lib/data/validation");

    class ExtraJsonValue {
      value = "bad";
    }

    const basePayload = {
      province: "广东省",
      city: "深圳市",
      university: "深圳大学",
      purchaseTags: [],
      productTags: [],
    };

    expect(validateDeliveryPayload({ ...basePayload, extraJson: {} })).toEqual({ ok: true });
    expect(validateDeliveryPayload({ ...basePayload, extraJson: new Date() })).toEqual({
      ok: false,
      error: "扩展字段JSON必须是普通对象",
    });
    expect(validateDeliveryPayload({ ...basePayload, extraJson: new Map() })).toEqual({
      ok: false,
      error: "扩展字段JSON必须是普通对象",
    });
    expect(validateDeliveryPayload({ ...basePayload, extraJson: new ExtraJsonValue() })).toEqual({
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
      mutateServerRecords: vi.fn(async (mutator: (current: DeliveryRecord[]) => DeliveryRecord[] | Promise<DeliveryRecord[]>) => {
        records = await mutator(records);
        return records;
      }),
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

  async function withAdminToken<T>(token: string | undefined, callback: () => Promise<T>) {
    const originalToken = process.env.ADMIN_API_TOKEN;
    if (token === undefined) {
      delete process.env.ADMIN_API_TOKEN;
    } else {
      process.env.ADMIN_API_TOKEN = token;
    }

    try {
      return await callback();
    } finally {
      if (originalToken === undefined) {
        delete process.env.ADMIN_API_TOKEN;
      } else {
        process.env.ADMIN_API_TOKEN = originalToken;
      }
      vi.resetModules();
    }
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
    expect(store.mutateServerRecords).not.toHaveBeenCalled();
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
    expect(store.mutateServerRecords).not.toHaveBeenCalled();
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
    expect(store.mutateServerRecords).not.toHaveBeenCalled();
  });

  it("POST 可选文本字段类型错误返回 400 且不写入", async () => {
    const { route, store } = await loadRoute();
    const response = await route.POST(
      new Request("http://localhost/api/deliveries", {
        method: "POST",
        body: JSON.stringify({
          province: "广东省",
          city: "深圳市",
          university: "深圳大学",
          customerStatus: 123,
          updatedAt: 123,
          purchaseTags: [],
          productTags: [],
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "更新时间必须是字符串" });
    expect(store.mutateServerRecords).not.toHaveBeenCalled();
  });

  it("POST 空白 updatedAt 由系统补齐而不是触发写入异常", async () => {
    const { route, store } = await loadRoute();
    const response = await route.POST(
      new Request("http://localhost/api/deliveries", {
        method: "POST",
        body: JSON.stringify({
          province: "广东省",
          city: "深圳市",
          university: "深圳大学",
          updatedAt: "   ",
          purchaseTags: [],
          productTags: [],
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.record.updatedAt).toMatch(/T/);
    expect(body.record.updatedAt.trim()).not.toBe("");
    expect(store.mutateServerRecords).toHaveBeenCalledTimes(1);
  });

  it("POST 空记录 ID 返回 400 且不写入", async () => {
    const { route, store } = await loadRoute();
    const response = await route.POST(
      new Request("http://localhost/api/deliveries", {
        method: "POST",
        body: JSON.stringify({
          id: "",
          province: "广东省",
          city: "深圳市",
          university: "深圳大学",
          purchaseTags: [],
          productTags: [],
        }),
        headers: { "Content-Type": "application/json" },
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "记录 ID 不能为空" });
    expect(store.mutateServerRecords).not.toHaveBeenCalled();
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
    expect(store.mutateServerRecords).toHaveBeenCalledTimes(1);
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
    expect(store.mutateServerRecords).toHaveBeenCalledTimes(1);
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
    expect(store.mutateServerRecords).not.toHaveBeenCalled();
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
    expect(store.mutateServerRecords).not.toHaveBeenCalled();
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
    expect(store.mutateServerRecords).not.toHaveBeenCalled();
  });

  it("配置 ADMIN_API_TOKEN 后 POST 无 token 返回 401 且不写入", async () => {
    await withAdminToken("secret-token", async () => {
      const { route, store } = await loadRoute();
      const response = await route.POST(
        new Request("http://localhost/api/deliveries", {
          method: "POST",
          body: JSON.stringify({
            province: "广东省",
            city: "深圳市",
            university: "深圳大学",
            purchaseTags: [],
            productTags: [],
          }),
          headers: { "Content-Type": "application/json" },
        }),
      );

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "未授权访问" });
      expect(store.mutateServerRecords).not.toHaveBeenCalled();
    });
  });

  it("Vercel 环境缺少 ADMIN_API_TOKEN 时 POST fail-closed", async () => {
    const originalToken = process.env.ADMIN_API_TOKEN;
    const originalVercel = process.env.VERCEL;
    delete process.env.ADMIN_API_TOKEN;
    process.env.VERCEL = "1";

    try {
      const { route, store } = await loadRoute();
      const response = await route.POST(
        new Request("http://localhost/api/deliveries", {
          method: "POST",
          body: JSON.stringify({
            province: "广东省",
            city: "深圳市",
            university: "深圳大学",
            purchaseTags: [],
            productTags: [],
          }),
          headers: { "Content-Type": "application/json" },
        }),
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "管理接口未配置 ADMIN_API_TOKEN" });
      expect(store.mutateServerRecords).not.toHaveBeenCalled();
    } finally {
      if (originalToken === undefined) {
        delete process.env.ADMIN_API_TOKEN;
      } else {
        process.env.ADMIN_API_TOKEN = originalToken;
      }
      if (originalVercel === undefined) {
        delete process.env.VERCEL;
      } else {
        process.env.VERCEL = originalVercel;
      }
      vi.resetModules();
    }
  });

  it("production 环境缺少 ADMIN_API_TOKEN 时 POST fail-closed", async () => {
    const originalToken = process.env.ADMIN_API_TOKEN;
    const originalNodeEnv = process.env.NODE_ENV;
    delete process.env.ADMIN_API_TOKEN;
    vi.stubEnv("NODE_ENV", "production");

    try {
      const { route, store } = await loadRoute();
      const response = await route.POST(
        new Request("http://localhost/api/deliveries", {
          method: "POST",
          body: JSON.stringify({
            province: "广东省",
            city: "深圳市",
            university: "深圳大学",
            purchaseTags: [],
            productTags: [],
          }),
          headers: { "Content-Type": "application/json" },
        }),
      );

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: "管理接口未配置 ADMIN_API_TOKEN" });
      expect(store.mutateServerRecords).not.toHaveBeenCalled();
    } finally {
      if (originalToken === undefined) {
        delete process.env.ADMIN_API_TOKEN;
      } else {
        process.env.ADMIN_API_TOKEN = originalToken;
      }
      vi.unstubAllEnvs();
      if (originalNodeEnv !== undefined) {
        process.env.NODE_ENV = originalNodeEnv;
      }
      vi.resetModules();
    }
  });

  it("配置 ADMIN_API_TOKEN 后 POST Bearer token 可写入", async () => {
    await withAdminToken("secret-token", async () => {
      const { route, store } = await loadRoute();
      const response = await route.POST(
        new Request("http://localhost/api/deliveries", {
          method: "POST",
          body: JSON.stringify({
            province: "广东省",
            city: "深圳市",
            university: "深圳大学",
            purchaseTags: [],
            productTags: [],
          }),
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer secret-token",
          },
        }),
      );

      expect(response.status).toBe(201);
      expect(store.mutateServerRecords).toHaveBeenCalledTimes(1);
    });
  });

  it("GET 保持公开读取", async () => {
    await withAdminToken("secret-token", async () => {
      const { route } = await loadRoute();
      const response = await route.GET();

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ records: [existingRecord] });
    });
  });

  it("export GET 配置 ADMIN_API_TOKEN 后无 token 返回 401", async () => {
    await withAdminToken("secret-token", async () => {
      const store = {
        readServerRecords: vi.fn(async () => [existingRecord]),
      };

      vi.resetModules();
      vi.doMock("@/lib/data/server-store", () => store);
      const route = await import("@/app/api/deliveries/export/route");
      const response = await route.GET(new Request("http://localhost/api/deliveries/export"));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "未授权访问" });
      expect(store.readServerRecords).not.toHaveBeenCalled();
    });
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

  it("本地数据文件元素损坏时抛错而不是回退 mock", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "edu-deliveries-"));
    const filePath = path.join(dir, "deliveries.local.json");

    try {
      await writeFile(filePath, "[null]", "utf8");
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

  it("Blob 读取使用 private origin get 且写入带 etag 条件", async () => {
    const originalVercel = process.env.VERCEL;
    const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
    const get = vi.fn(async () => ({
      statusCode: 200,
      stream: new Response(JSON.stringify([localRecord])).body,
      headers: new Headers(),
      blob: { etag: "etag-1" },
    }));
    const put = vi.fn(async () => ({ url: "", downloadUrl: "", pathname: "", contentType: "", contentDisposition: "" }));

    vi.resetModules();
    vi.doMock("@vercel/blob", () => ({ get, put, BlobPreconditionFailedError: class BlobPreconditionFailedError extends Error {} }));

    try {
      process.env.VERCEL = "1";
      process.env.BLOB_READ_WRITE_TOKEN = "token";
      const { writeServerRecords } = await import("@/lib/data/server-store");

      await writeServerRecords([localRecord]);

      expect(get).toHaveBeenCalledWith("edu-system/deliveries.json", {
        access: "private",
        useCache: false,
      });
      expect(put).toHaveBeenCalledWith("edu-system/deliveries.json", expect.stringContaining("delivery-local"), {
        access: "private",
        allowOverwrite: true,
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        contentType: "application/json",
        ifMatch: "etag-1",
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

  it("Blob get 返回 null 时回退空数据", async () => {
    const originalVercel = process.env.VERCEL;
    const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
    const get = vi.fn(async () => null);
    const put = vi.fn();

    vi.resetModules();
    vi.doMock("@vercel/blob", () => ({ get, put, BlobPreconditionFailedError: class BlobPreconditionFailedError extends Error {} }));

    try {
      process.env.VERCEL = "1";
      process.env.BLOB_READ_WRITE_TOKEN = "token";
      const { readServerRecords } = await import("@/lib/data/server-store");

      expect(await readServerRecords()).toEqual([]);
      expect(get).toHaveBeenCalledWith("edu-system/deliveries.json", {
        access: "private",
        useCache: false,
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

  it("Blob 条件写冲突时重读并有限重试 mutation", async () => {
    const originalVercel = process.env.VERCEL;
    const originalToken = process.env.BLOB_READ_WRITE_TOKEN;
    class BlobPreconditionFailedError extends Error {}
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        statusCode: 200,
        stream: new Response(JSON.stringify([localRecord])).body,
        headers: new Headers(),
        blob: { etag: "etag-1" },
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        stream: new Response(JSON.stringify([{ ...localRecord, id: "delivery-other" }])).body,
        headers: new Headers(),
        blob: { etag: "etag-2" },
      });
    const put = vi
      .fn()
      .mockRejectedValueOnce(new BlobPreconditionFailedError("stale"))
      .mockResolvedValueOnce({ url: "", downloadUrl: "", pathname: "", contentType: "", contentDisposition: "" });

    vi.resetModules();
    vi.doMock("@vercel/blob", () => ({ get, put, BlobPreconditionFailedError }));

    try {
      process.env.VERCEL = "1";
      process.env.BLOB_READ_WRITE_TOKEN = "token";
      const { mutateServerRecords } = await import("@/lib/data/server-store");

      const records = await mutateServerRecords((current) => [{ ...localRecord, id: "delivery-new" }, ...current]);

      expect(records.map((record) => record.id)).toEqual(["delivery-new", "delivery-other"]);
      expect(get).toHaveBeenCalledTimes(2);
      expect(put).toHaveBeenNthCalledWith(1, "edu-system/deliveries.json", expect.any(String), expect.objectContaining({ ifMatch: "etag-1" }));
      expect(put).toHaveBeenNthCalledWith(2, "edu-system/deliveries.json", expect.any(String), expect.objectContaining({ ifMatch: "etag-2" }));
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

  it("localStorage 损坏时拒绝写操作且保留坏数据", async () => {
    window.localStorage.setItem("edu-system.deliveries", "{bad json");
    const { createBrowserProvider } = await import("@/lib/data/browser-provider");
    const provider = createBrowserProvider();
    const payload: DeliveryPayload = {
      province: "广东省",
      city: "深圳市",
      university: "深圳大学",
      purchaseTags: [],
      productTags: [],
    };

    await expect(provider.replaceAll([payload])).rejects.toThrow("本地浏览器数据损坏，请先导出/清理后再写入");
    await expect(provider.create(payload)).rejects.toThrow("本地浏览器数据损坏，请先导出/清理后再写入");
    await expect(provider.update("delivery-existing", payload)).rejects.toThrow(
      "本地浏览器数据损坏，请先导出/清理后再写入",
    );
    await expect(provider.remove("delivery-existing")).rejects.toThrow(
      "本地浏览器数据损坏，请先导出/清理后再写入",
    );
    expect(window.localStorage.getItem("edu-system.deliveries")).toBe("{bad json");
  });

  it("localStorage 空字符串视为损坏数据且拒绝覆盖", async () => {
    const seed: DeliveryRecord[] = [
      {
        id: "delivery-seed",
        province: "广东省",
        city: "深圳市",
        university: "深圳大学",
        purchaseTags: [],
        productTags: [],
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
    ];
    const payload: DeliveryPayload = {
      province: "广东省",
      city: "深圳市",
      university: "深圳大学",
      purchaseTags: [],
      productTags: [],
    };

    window.localStorage.setItem("edu-system.deliveries", "");
    const { createBrowserProvider } = await import("@/lib/data/browser-provider");
    const provider = createBrowserProvider(seed);

    expect(await provider.list()).toEqual(seed);
    await expect(provider.create(payload)).rejects.toThrow("本地浏览器数据损坏，请先导出/清理后再写入");
    expect(window.localStorage.getItem("edu-system.deliveries")).toBe("");
  });

  it("localStorage 持久化空数组时 list 不回灌 seed", async () => {
    const seed: DeliveryRecord[] = [
      {
        id: "delivery-seed",
        province: "广东省",
        city: "深圳市",
        university: "深圳大学",
        purchaseTags: [],
        productTags: [],
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
    ];
    const { createBrowserProvider } = await import("@/lib/data/browser-provider");
    const provider = createBrowserProvider(seed);

    await provider.replaceAll([]);

    expect(await provider.list()).toEqual([]);
    expect(window.localStorage.getItem("edu-system.deliveries")).toBe("[]");
  });

  it("localStorage 元素损坏时返回 seed 且拒绝写操作", async () => {
    const seed: DeliveryRecord[] = [
      {
        id: "delivery-seed",
        province: "广东省",
        city: "深圳市",
        university: "深圳大学",
        purchaseTags: [],
        productTags: [],
        updatedAt: "2026-06-05T00:00:00.000Z",
      },
    ];
    const payload: DeliveryPayload = {
      province: "广东省",
      city: "深圳市",
      university: "深圳大学",
      purchaseTags: [],
      productTags: [],
    };

    window.localStorage.setItem("edu-system.deliveries", "[null]");
    const { createBrowserProvider } = await import("@/lib/data/browser-provider");
    const provider = createBrowserProvider(seed);

    expect(await provider.list()).toEqual(seed);
    await expect(provider.create(payload)).rejects.toThrow("本地浏览器数据损坏，请先导出/清理后再写入");
    expect(window.localStorage.getItem("edu-system.deliveries")).toBe("[null]");
  });
});
