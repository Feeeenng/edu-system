import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";

export type DeliveryDataProvider = {
  list(): Promise<DeliveryRecord[]>;
  replaceAll(records: DeliveryPayload[]): Promise<DeliveryRecord[]>;
  create(payload: DeliveryPayload): Promise<DeliveryRecord>;
  update(id: string, payload: DeliveryPayload): Promise<DeliveryRecord>;
  remove(id: string): Promise<void>;
};
