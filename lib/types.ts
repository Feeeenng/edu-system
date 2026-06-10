import type { CoverageStatus } from "@/lib/coverage/status";

export type DeliveryRecord = {
  id: string;
  schoolId?: string;
  province: string;
  city: string;
  university: string;
  longitude?: number;
  latitude?: number;
  customerStatus?: string;
  coverageStatus?: CoverageStatus;
  projectStage?: "线索" | "测试" | "方案" | "交付" | "运维";
  deliveryDate?: string;
  owner?: string;
  purchaseYear?: string;
  purchaseTags: string[];
  productTags: string[];
  provinceUniversityTotal?: number;
  cityUniversityTotal?: number;
  resourceType?: string;
  resourceAmount?: number;
  resourceUnit?: string;
  businessScenario?: string;
  coreValue?: string;
  deviceModel?: string;
  bidLink?: string;
  deliveryContent?: string;
  equipmentDetails?: string[];
  painPoints?: string[];
  notes?: string;
  extraJson?: Record<string, unknown>;
  updatedAt: string;
};

export type DeliveryFilters = {
  province?: string;
  city?: string;
  university?: string;
  purchaseTags?: string[];
  productTags?: string[];
  coverageStatus?: string;
  projectStage?: string;
  keyword?: string;
};

export type DrillLevel = "country" | "province" | "city" | "university";

export type DrillState = {
  level: DrillLevel;
  province?: string;
  city?: string;
  university?: string;
};

export type CoverageSummary = {
  provinceCount: number;
  cityCount: number;
  universityCount: number;
  deliveryCount: number;
  productCount: number;
  purchaseTagCount: number;
  totalUniversityCount?: number;
  coverageRate?: number;
};

export type RegionMetric = {
  name: string;
  province?: string;
  city?: string;
  universityCount: number;
  totalUniversityCount?: number;
  coverageRate?: number;
  deliveryCount: number;
  productTags: string[];
  purchaseTags: string[];
};

export type UniversityDetail = {
  province: string;
  city: string;
  university: string;
  deliveries: DeliveryRecord[];
  productTags: string[];
  purchaseTags: string[];
  latestDeliveryDate?: string;
};

export type DeliveryPayload = Omit<DeliveryRecord, "id" | "updatedAt"> & {
  id?: string;
  updatedAt?: string;
};
