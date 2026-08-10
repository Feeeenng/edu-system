import { Tag, Typography } from "antd";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";
import type { UniversityFormValues } from "@/components/admin/UniversityFormFields";

const { Text } = Typography;

export const EMPTY_UNIVERSITY_FORM: UniversityFormValues = { province: "", university: "" };

function splitList(value?: string) {
  return (value ?? "")
    .split(/[;；/、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function joinUniversityValues(items?: string[]) {
  return (items ?? []).join(" / ");
}

export function getUniversityFormValues(record?: DeliveryRecord): UniversityFormValues {
  if (!record) return EMPTY_UNIVERSITY_FORM;

  return {
    schoolId: record.schoolId,
    province: record.province,
    university: record.university,
    coverageStatus: record.coverageStatus,
    customerStatus: record.customerStatus,
    purchaseYear: record.purchaseYear,
    purchaseTags: joinUniversityValues(record.purchaseTags),
    resourceType: record.resourceType ?? joinUniversityValues(record.productTags),
    resourceAmount: record.resourceAmount,
    resourceUnit: record.resourceUnit,
    businessScenario: record.businessScenario,
    coreValue: record.coreValue,
    deviceModel: record.deviceModel ?? joinUniversityValues(record.equipmentDetails),
    bidLink: record.bidLink,
    notes: record.notes,
  };
}

export function buildUniversityPayload(values: UniversityFormValues, base?: DeliveryRecord): DeliveryPayload {
  const productTags = splitList(values.resourceType?.replace(/adesk/gi, "桌面云").replace(/AIBuilder/gi, "FastGPT"));

  return {
    ...base,
    schoolId: values.schoolId?.trim() || undefined,
    province: values.province.trim(),
    city: values.province.trim(),
    university: values.university.trim(),
    coverageStatus: values.coverageStatus as DeliveryPayload["coverageStatus"],
    customerStatus: values.customerStatus?.trim() || undefined,
    purchaseYear: values.purchaseYear?.trim() || undefined,
    purchaseTags: splitList(values.purchaseTags),
    productTags,
    resourceType: values.resourceType?.trim() || undefined,
    resourceAmount: values.resourceAmount,
    resourceUnit: values.resourceUnit?.trim() || undefined,
    businessScenario: values.businessScenario?.trim() || undefined,
    coreValue: values.coreValue?.trim() || undefined,
    deviceModel: values.deviceModel?.trim() || undefined,
    equipmentDetails: splitList(values.deviceModel),
    painPoints: splitList(values.coreValue),
    bidLink: values.bidLink?.trim() || undefined,
    notes: values.notes?.trim() || undefined,
    deliveryContent: [values.businessScenario?.trim(), values.coreValue?.trim()].filter(Boolean).join("；") || undefined,
  };
}

/** 将高校覆盖状态渲染为统一语义色标签。 */
export function renderUniversityStatus(status?: string) {
  if (!status) return <Text type="secondary">-</Text>;

  const color =
    status === "已部署" || status === "已覆盖" || status === "已下单"
      ? "success"
      : status === "跟进中" || status === "新增商机" || status === "已下单+新增商机"
        ? "processing"
        : status === "未覆盖"
          ? "warning"
          : "default";
  return <Tag color={color}>{status}</Tag>;
}

export function downloadUniversityWorkbook(filename: string, workbook: ArrayBuffer) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
