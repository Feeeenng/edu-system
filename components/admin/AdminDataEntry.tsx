"use client";

import { ArrowLeft, Download, FileUp, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { exportDeliveriesToCsv } from "@/lib/csv/export";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { createBrowserProvider } from "@/lib/data/browser-provider";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";
import "./admin-data-entry.css";

type FormField =
  | "province"
  | "city"
  | "university"
  | "productTags"
  | "purchaseTags"
  | "equipmentDetails"
  | "painPoints"
  | "deliveryContent";

function splitList(value: string) {
  return value
    .split(/[;；]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(items?: string[]) {
  return (items ?? []).join(" / ");
}

function buildPayload(form: Record<FormField, string>): DeliveryPayload {
  return {
    province: form.province.trim(),
    city: form.city.trim(),
    university: form.university.trim(),
    productTags: splitList(form.productTags),
    purchaseTags: splitList(form.purchaseTags),
    equipmentDetails: splitList(form.equipmentDetails),
    painPoints: splitList(form.painPoints),
    deliveryContent: form.deliveryContent.trim() || undefined,
  };
}

function readEntryForm(formElement: HTMLFormElement): Record<FormField, string> {
  const data = new FormData(formElement);
  const read = (key: FormField) => String(data.get(key) ?? "");
  return {
    province: read("province"),
    city: read("city"),
    university: read("university"),
    productTags: read("productTags"),
    purchaseTags: read("purchaseTags"),
    equipmentDetails: read("equipmentDetails"),
    painPoints: read("painPoints"),
    deliveryContent: read("deliveryContent"),
  };
}

function downloadCsv(records: DeliveryRecord[]) {
  const blob = new Blob([exportDeliveriesToCsv(records)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "高校交付记录.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function AdminDataEntry() {
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("当前使用浏览器本地录入模式，适合静态预览和本机维护。");
  const [homeHref, setHomeHref] = useState("/");
  const providerRef = useRef(createBrowserProvider());
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const latestRecords = useMemo(() => records.slice(0, 10), [records]);

  useEffect(() => {
    if (window.location.protocol === "file:") {
      setHomeHref("../index.html");
    }
  }, []);

  useEffect(() => {
    void providerRef.current
      .list()
      .then(setRecords)
      .catch((loadError) => {
        setMessage(loadError instanceof Error ? loadError.message : "本地数据读取失败");
      })
      .finally(() => {
        setReady(true);
      });
  }, []);

  const createRecord = async () => {
    if (!formRef.current) return;
    const form = readEntryForm(formRef.current);
    if (!form.province.trim() || !form.city.trim() || !form.university.trim()) {
      setMessage("省份、城市、高校名称为必填项。");
      return;
    }

    try {
      const record = await providerRef.current.create(buildPayload(form));
      setRecords(await providerRef.current.list());
      formRef.current.reset();
      setMessage(`已新增：${record.university}，首页刷新后可查看。`);
    } catch (createError) {
      setMessage(createError instanceof Error ? createError.message : "新增记录失败");
    }
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const result = parseDeliveryCsv(text);
    if (result.errors.length > 0) {
      setMessage(result.errors.slice(0, 2).join("；"));
      return;
    }

    const nextRecords = result.records.map(createDeliveryRecord);
    try {
      const currentRecords = await providerRef.current.list();
      const mergedRecords = await providerRef.current.replaceAll([...nextRecords, ...currentRecords]);
      setRecords(mergedRecords);
      setMessage(`已导入 ${nextRecords.length} 条记录，首页刷新后可查看。`);
    } catch (importError) {
      setMessage(importError instanceof Error ? importError.message : "CSV导入失败");
    }
  };

  return (
    <main className="admin-shell">
      <section className="admin-hero">
        <div>
          <span>Data Entry</span>
          <h1>高校交付数据录入</h1>
        </div>
        <div className="admin-actions">
          <a className="admin-action-link" href={homeHref}>
            <ArrowLeft size={16} aria-hidden="true" />
            返回首页
          </a>
          <label className="file-action">
            <FileUp size={16} aria-hidden="true" />
            CSV导入
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              aria-label="CSV导入"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCsv(file);
                event.target.value = "";
              }}
            />
          </label>
          <button type="button" onClick={() => downloadCsv(records)}>
            <Download size={16} aria-hidden="true" />
            导出CSV
          </button>
        </div>
      </section>

      <section className="entry-layout">
        <form
          className="entry-form"
          ref={formRef}
          onSubmit={(event) => {
            event.preventDefault();
            void createRecord();
          }}
        >
          <h2>新增交付记录</h2>
          <label>
            省份
            <input name="province" />
          </label>
          <label>
            城市
            <input name="city" />
          </label>
          <label>
            高校名称
            <input name="university" />
          </label>
          <label>
            产品标签
            <input
              name="productTags"
              placeholder="SDDC;EDS;桌面云"
            />
          </label>
          <label>
            采购标签
            <input
              name="purchaseTags"
              placeholder="VMware替换;信创"
            />
          </label>
          <label>
            设备明细
            <textarea
              name="equipmentDetails"
              placeholder="超融合节点x3;EDS存储节点x2"
            />
          </label>
          <label>
            业务痛点
            <textarea
              name="painPoints"
              placeholder="VMware替换压力大;科研数据增长快"
            />
          </label>
          <label>
            交付内容
            <textarea name="deliveryContent" />
          </label>
          <button className="primary-action" type="submit" disabled={!ready}>
            <Plus size={16} aria-hidden="true" />
            新增记录
          </button>
          <p className="form-message">{message}</p>
        </form>

        <section className="record-panel" aria-label="交付记录列表">
          <div className="record-panel-heading">
            <h2>交付记录</h2>
            <strong>{records.length}</strong>
          </div>
          <div className="record-table">
            {latestRecords.map((record) => (
              <article className="record-row" key={record.id}>
                <div>
                  <strong>{record.university}</strong>
                  <span>
                    {record.province} · {record.city}
                  </span>
                </div>
                <p>{joinList(record.productTags)}</p>
                <small>{joinList(record.equipmentDetails)}</small>
                <small>{joinList(record.painPoints)}</small>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
