"use client";

import { ArrowLeft, Download, FileDown, FileUp, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildCsvTemplate, exportDeliveriesToCsv } from "@/lib/csv/export";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { dedupeDeliveries, getDeliveryBusinessKey } from "@/lib/data/dedupe";
import { createBrowserProvider } from "@/lib/data/browser-provider";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { getCityOptions, getProvinceOptions } from "@/lib/regions/china-regions";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";
import "./admin-data-entry.css";

type EntryFormState = {
  province: string;
  city: string;
  university: string;
  productTags: string;
  purchaseTags: string;
  equipmentDetails: string;
  painPoints: string;
  deliveryContent: string;
};

type EntryField = keyof EntryFormState;

const EMPTY_ENTRY_FORM: EntryFormState = {
  province: "",
  city: "",
  university: "",
  productTags: "",
  purchaseTags: "",
  equipmentDetails: "",
  painPoints: "",
  deliveryContent: "",
};

function splitList(value: string) {
  return value
    .split(/[;；/、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(items?: string[]) {
  return (items ?? []).join(" / ");
}

function buildPayload(form: EntryFormState): DeliveryPayload {
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

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(records: DeliveryRecord[]) {
  downloadText("高校交付记录.csv", exportDeliveriesToCsv(records));
}

function downloadCsvTemplate() {
  downloadText("高校交付记录导入模板.csv", buildCsvTemplate());
}

export function AdminDataEntry() {
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [entryForm, setEntryForm] = useState<EntryFormState>(EMPTY_ENTRY_FORM);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("当前使用浏览器本地录入模式，适合静态预览和本机维护。");
  const [homeHref, setHomeHref] = useState("/");
  const providerRef = useRef(createBrowserProvider());
  const fileRef = useRef<HTMLInputElement>(null);
  const provinceOptions = useMemo(getProvinceOptions, []);

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

  useEffect(() => {
    let active = true;

    if (!entryForm.province) {
      setCityOptions([]);
      setCityLoading(false);
      return () => {
        active = false;
      };
    }

    setCityLoading(true);
    void getCityOptions(entryForm.province)
      .then((cities) => {
        if (active) setCityOptions(cities);
      })
      .catch(() => {
        if (active) {
          setCityOptions([]);
          setMessage("城市列表读取失败，请重新选择省份。");
        }
      })
      .finally(() => {
        if (active) setCityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [entryForm.province]);

  const updateField = (field: EntryField) => {
    return (value: string) => {
      setEntryForm((current) => ({
        ...current,
        [field]: value,
        ...(field === "province" ? { city: "" } : {}),
      }));
    };
  };

  const createRecord = async () => {
    if (!entryForm.province.trim() || !entryForm.city.trim() || !entryForm.university.trim()) {
      setMessage("省份、城市、高校名称为必填项。");
      return;
    }

    try {
      const record = await providerRef.current.create(buildPayload(entryForm));
      setRecords(await providerRef.current.list());
      setEntryForm(EMPTY_ENTRY_FORM);
      setMessage(`已新增：${record.university}，首页刷新后可查看。`);
    } catch (createError) {
      setMessage(createError instanceof Error ? createError.message : "新增记录失败");
    }
  };

  const deleteRecord = async (record: DeliveryRecord) => {
    if (!window.confirm(`确认删除「${record.university}」这条交付记录吗？`)) return;

    try {
      await providerRef.current.remove(record.id);
      setRecords(await providerRef.current.list());
      setMessage(`已删除：${record.university}。`);
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : "删除记录失败");
    }
  };

  const importCsv = async (file: File) => {
    const text = await file.text();
    const result = parseDeliveryCsv(text);
    if (result.errors.length > 0) {
      setMessage(result.errors.slice(0, 2).join("；"));
      return;
    }

    const nextRecords = dedupeDeliveries(result.records.map(createDeliveryRecord));
    if (nextRecords.length === 0) {
      setMessage("CSV中没有可导入的记录，已保留现有数据。");
      return;
    }

    try {
      const currentRecords = await providerRef.current.list();
      const currentKeys = new Set(currentRecords.map(getDeliveryBusinessKey));
      const addedCount = nextRecords.filter((record) => !currentKeys.has(getDeliveryBusinessKey(record))).length;
      const mergedRecords = await providerRef.current.replaceAll(dedupeDeliveries([...nextRecords, ...currentRecords]));
      setRecords(mergedRecords);
      const duplicateCount = result.records.length - addedCount;
      setMessage(
        duplicateCount > 0
          ? `已新增 ${addedCount} 条记录，自动忽略 ${duplicateCount} 条重复记录。`
          : `已导入 ${addedCount} 条记录，首页刷新后可查看。`,
      );
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
          <button type="button" onClick={downloadCsvTemplate}>
            <FileDown size={16} aria-hidden="true" />
            下载CSV模板
          </button>
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

      <section className="entry-workbench" aria-label="高校交付数据表格录入">
        <div className="workbench-heading">
          <div>
            <h2>表格录入</h2>
            <p>省份和城市使用下拉选择；标签、设备和痛点支持用分号、顿号或斜杠分隔。</p>
          </div>
          <strong>{records.length} 条记录</strong>
        </div>

        <div className="entry-table-shell">
          <table className="entry-table">
            <thead>
              <tr>
                <th className="col-province">省份</th>
                <th className="col-city">城市</th>
                <th className="col-university">高校名称</th>
                <th>产品标签</th>
                <th>采购标签</th>
                <th>设备明细</th>
                <th>业务痛点</th>
                <th>交付内容</th>
                <th className="col-action">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr className="entry-new-row">
                <td>
                  <select value={entryForm.province} onChange={(event) => updateField("province")(event.target.value)}>
                    <option value="">选择省份</option>
                    {provinceOptions.map((province) => (
                      <option key={province} value={province}>
                        {province}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    value={entryForm.city}
                    disabled={!entryForm.province || cityLoading}
                    onChange={(event) => updateField("city")(event.target.value)}
                  >
                    <option value="">{cityLoading ? "加载城市中" : entryForm.province ? "选择城市" : "先选省份"}</option>
                    {cityOptions.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={entryForm.university}
                    placeholder="高校名称"
                    onChange={(event) => updateField("university")(event.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={entryForm.productTags}
                    placeholder="SDDC;EDS"
                    onChange={(event) => updateField("productTags")(event.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={entryForm.purchaseTags}
                    placeholder="VMware替换;信创"
                    onChange={(event) => updateField("purchaseTags")(event.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={entryForm.equipmentDetails}
                    placeholder="超融合节点x3;交换机x2"
                    onChange={(event) => updateField("equipmentDetails")(event.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={entryForm.painPoints}
                    placeholder="授权成本高;数据增长快"
                    onChange={(event) => updateField("painPoints")(event.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={entryForm.deliveryContent}
                    placeholder="交付说明"
                    onChange={(event) => updateField("deliveryContent")(event.target.value)}
                  />
                </td>
                <td>
                  <button className="table-primary-action" type="button" disabled={!ready} onClick={() => void createRecord()}>
                    <Plus size={15} aria-hidden="true" />
                    新增
                  </button>
                </td>
              </tr>

              {records.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={9}>暂无交付记录，可通过上方表格新增或下载模板后批量导入 CSV。</td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.province}</td>
                    <td>{record.city}</td>
                    <td>
                      <strong>{record.university}</strong>
                    </td>
                    <td>{joinList(record.productTags)}</td>
                    <td>{joinList(record.purchaseTags)}</td>
                    <td>{joinList(record.equipmentDetails)}</td>
                    <td>{joinList(record.painPoints)}</td>
                    <td>{record.deliveryContent || "-"}</td>
                    <td>
                      <button
                        className="table-danger-action"
                        type="button"
                        aria-label={`删除${record.university}`}
                        onClick={() => void deleteRecord(record)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="form-message">{message}</p>
      </section>
    </main>
  );
}
