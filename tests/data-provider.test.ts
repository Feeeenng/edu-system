import { describe, expect, it } from "vitest";
import { createDeliveryRecord, normalizeDeliveryPayload } from "@/lib/data/normalize";

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
