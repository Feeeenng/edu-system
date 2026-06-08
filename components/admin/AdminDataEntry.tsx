"use client";

import { ArrowLeft, Download, FileDown, FileUp, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildCsvTemplate, exportDeliveriesToCsv } from "@/lib/csv/export";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { createClientProvider } from "@/lib/data/client-provider";
import { dedupeDeliveries, getDeliveryBusinessKey } from "@/lib/data/dedupe";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { getCityOptions, getProvinceOptions } from "@/lib/regions/china-regions";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";
import "./admin-data-entry.css";

type EntryFormState = {
  province: string;
  city: string;
  university: string;
  provinceUniversityTotal: string;
  cityUniversityTotal: string;
  productTags: string;
  purchaseTags: string;
  equipmentDetails: string;
  painPoints: string;
  deliveryContent: string;
};

type EntryField = keyof EntryFormState;

type FilterState = {
  keyword: string;
  province: string;
  city: string;
  product: string;
};

const EMPTY_ENTRY_FORM: EntryFormState = {
  province: "",
  city: "",
  university: "",
  provinceUniversityTotal: "",
  cityUniversityTotal: "",
  productTags: "",
  purchaseTags: "",
  equipmentDetails: "",
  painPoints: "",
  deliveryContent: "",
};

const EMPTY_FILTERS: FilterState = {
  keyword: "",
  province: "",
  city: "",
  product: "",
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

function formatOptionalNumber(value?: number) {
  return value === undefined ? "" : String(value);
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasInvalidNumber(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 && !Number.isFinite(Number(trimmed));
}

function validateForm(form: EntryFormState) {
  if (!form.province.trim() || !form.city.trim() || !form.university.trim()) {
    return "省份、城市、高校名称为必填项。";
  }

  if (hasInvalidNumber(form.provinceUniversityTotal) || hasInvalidNumber(form.cityUniversityTotal)) {
    return "省份高校总数和城市高校总数必须填写数字。";
  }

  return undefined;
}

function buildFormFromRecord(record: DeliveryRecord): EntryFormState {
  return {
    province: record.province,
    city: record.city,
    university: record.university,
    provinceUniversityTotal: formatOptionalNumber(record.provinceUniversityTotal),
    cityUniversityTotal: formatOptionalNumber(record.cityUniversityTotal),
    productTags: joinList(record.productTags),
    purchaseTags: joinList(record.purchaseTags),
    equipmentDetails: joinList(record.equipmentDetails),
    painPoints: joinList(record.painPoints),
    deliveryContent: record.deliveryContent ?? "",
  };
}

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase();
}

function recordMatchesFilters(record: DeliveryRecord, filters: FilterState) {
  if (filters.province && record.province !== filters.province) return false;
  if (filters.city && record.city !== filters.city) return false;
  if (filters.product && !record.productTags.includes(filters.product)) return false;

  const keyword = normalizeSearchText(filters.keyword);
  if (!keyword) return true;

  return [
    record.province,
    record.city,
    record.university,
    record.deliveryContent ?? "",
    ...record.productTags,
    ...record.purchaseTags,
    ...(record.equipmentDetails ?? []),
    ...(record.painPoints ?? []),
  ]
    .join(" ")
    .toLowerCase()
    .includes(keyword);
}

function buildPayload(form: EntryFormState, base?: DeliveryRecord): DeliveryPayload {
  return {
    ...base,
    province: form.province.trim(),
    city: form.city.trim(),
    university: form.university.trim(),
    provinceUniversityTotal: parseOptionalNumber(form.provinceUniversityTotal),
    cityUniversityTotal: parseOptionalNumber(form.cityUniversityTotal),
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
  const [editingForms, setEditingForms] = useState<Record<string, EntryFormState>>({});
  const [editingCityOptions, setEditingCityOptions] = useState<Record<string, string[]>>({});
  const [savingId, setSavingId] = useState<string>();
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("当前使用服务端数据模式，录入、导入和删除都会写入 /api/deliveries。");
  const [homeHref, setHomeHref] = useState("/");
  const providerRef = useRef<ReturnType<typeof createClientProvider> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const provinceOptions = useMemo(getProvinceOptions, []);
  const productOptions = useMemo(
    () =>
      Array.from(new Set(records.flatMap((record) => record.productTags).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "zh-CN"),
      ),
    [records],
  );
  const filteredRecords = useMemo(() => records.filter((record) => recordMatchesFilters(record, filters)), [filters, records]);
  const selectedFilteredIds = useMemo(
    () => filteredRecords.filter((record) => selectedIds.has(record.id)).map((record) => record.id),
    [filteredRecords, selectedIds],
  );
  const allFilteredSelected = filteredRecords.length > 0 && selectedFilteredIds.length === filteredRecords.length;

  const getProvider = useCallback(() => {
    providerRef.current ??= createClientProvider();
    return providerRef.current;
  }, []);

  useEffect(() => {
    if (window.location.protocol === "file:") {
      setHomeHref("../index.html");
    }
  }, []);

  useEffect(() => {
    void getProvider()
      .list()
      .then(setRecords)
      .catch((loadError) => {
        setMessage(loadError instanceof Error ? loadError.message : "服务端数据读取失败");
      })
      .finally(() => {
        setReady(true);
      });
  }, [getProvider]);

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

  const updateEditingField = (id: string, field: EntryField, value: string) => {
    setEditingForms((current) => {
      const form = current[id];
      if (!form) return current;
      return {
        ...current,
        [id]: {
          ...form,
          [field]: value,
          ...(field === "province" ? { city: "" } : {}),
        },
      };
    });
  };

  const updateFilter = (field: keyof FilterState) => {
    return (value: string) => {
      setFilters((current) => ({
        ...current,
        [field]: value,
        ...(field === "province" ? { city: "" } : {}),
      }));
    };
  };

  const toggleRecordSelection = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectFilteredRecords = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredRecords.forEach((record) => next.add(record.id));
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const clearFilteredSelection = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      filteredRecords.forEach((record) => next.delete(record.id));
      return next;
    });
  };

  const createRecord = async () => {
    const validationMessage = validateForm(entryForm);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    try {
      const record = await getProvider().create(buildPayload(entryForm));
      setRecords(await getProvider().list());
      setSelectedIds(new Set());
      setEntryForm(EMPTY_ENTRY_FORM);
      setMessage(`已新增：${record.university}，首页刷新后可查看。`);
    } catch (createError) {
      setMessage(createError instanceof Error ? createError.message : "新增记录失败");
    }
  };

  const startEditRecord = async (record: DeliveryRecord) => {
    setEditingForms((current) => ({
      ...current,
      [record.id]: buildFormFromRecord(record),
    }));

    try {
      const cities = await getCityOptions(record.province);
      setEditingCityOptions((current) => ({ ...current, [record.id]: cities }));
    } catch {
      setEditingCityOptions((current) => ({ ...current, [record.id]: [] }));
      setMessage("城市列表读取失败，仍可编辑其他字段。");
    }
  };

  const cancelEditRecord = (id: string) => {
    setEditingForms((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setEditingCityOptions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };

  const updateEditingProvince = async (id: string, province: string) => {
    updateEditingField(id, "province", province);
    setEditingCityOptions((current) => ({ ...current, [id]: [] }));
    if (!province) return;

    try {
      const cities = await getCityOptions(province);
      setEditingCityOptions((current) => ({ ...current, [id]: cities }));
    } catch {
      setMessage("城市列表读取失败，请重新选择省份。");
    }
  };

  const saveRecord = async (record: DeliveryRecord) => {
    const form = editingForms[record.id];
    if (!form) return;
    const validationMessage = validateForm(form);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    try {
      setSavingId(record.id);
      const updated = await getProvider().update(record.id, buildPayload(form, record));
      setRecords(await getProvider().list());
      cancelEditRecord(record.id);
      setMessage(`已更新：${updated.university}。`);
    } catch (saveError) {
      setMessage(saveError instanceof Error ? saveError.message : "保存记录失败");
    } finally {
      setSavingId(undefined);
    }
  };

  const deleteRecord = async (record: DeliveryRecord) => {
    if (!window.confirm(`确认删除「${record.university}」这条交付记录吗？`)) return;

    try {
      await getProvider().remove(record.id);
      setRecords(await getProvider().list());
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(record.id);
        return next;
      });
      setMessage(`已删除：${record.university}。`);
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : "删除记录失败");
    }
  };

  const deleteSelectedRecords = async () => {
    const ids = selectedFilteredIds;
    if (ids.length === 0) {
      setMessage("请先勾选当前筛选结果中需要删除的记录。");
      return;
    }

    if (!window.confirm(`确认批量删除当前筛选结果中选中的 ${ids.length} 条交付记录吗？`)) return;

    try {
      const idSet = new Set(ids);
      const nextRecords = records.filter((record) => !idSet.has(record.id));
      const savedRecords = await getProvider().replaceAll(nextRecords);
      setRecords(savedRecords);
      setSelectedIds(new Set());
      setMessage(`已批量删除 ${ids.length} 条记录。`);
    } catch (deleteError) {
      setMessage(deleteError instanceof Error ? deleteError.message : "批量删除失败");
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
      const currentRecords = await getProvider().list();
      const currentKeys = new Set(currentRecords.map(getDeliveryBusinessKey));
      const addedCount = nextRecords.filter((record) => !currentKeys.has(getDeliveryBusinessKey(record))).length;
      const mergedRecords = await getProvider().replaceAll(dedupeDeliveries([...nextRecords, ...currentRecords]));
      setRecords(mergedRecords);
      setSelectedIds(new Set());
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
          <strong>{filteredRecords.length} / {records.length} 条记录</strong>
        </div>

        <div className="table-toolbar" aria-label="表格筛选和批量操作">
          <label className="table-search">
            <Search size={16} aria-hidden="true" />
            <input
              value={filters.keyword}
              placeholder="搜索高校、标签、设备、痛点"
              onChange={(event) => updateFilter("keyword")(event.target.value)}
            />
          </label>
          <select value={filters.province} onChange={(event) => updateFilter("province")(event.target.value)}>
            <option value="">全部省份</option>
            {provinceOptions.map((province) => (
              <option key={province} value={province}>
                {province}
              </option>
            ))}
          </select>
          <select value={filters.city} disabled={!filters.province} onChange={(event) => updateFilter("city")(event.target.value)}>
            <option value="">全部城市</option>
            {Array.from(new Set(records.filter((record) => !filters.province || record.province === filters.province).map((record) => record.city)))
              .sort((a, b) => a.localeCompare(b, "zh-CN"))
              .map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
          </select>
          <select value={filters.product} onChange={(event) => updateFilter("product")(event.target.value)}>
            <option value="">全部产品</option>
            {productOptions.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setFilters(EMPTY_FILTERS)}>
            <X size={15} aria-hidden="true" />
            清空筛选
          </button>
          <button type="button" onClick={selectFilteredRecords} disabled={filteredRecords.length === 0}>
            选择当前结果
          </button>
          <button type="button" onClick={clearSelection} disabled={selectedIds.size === 0}>
            清空选择
          </button>
          <button
            className="danger-toolbar-action"
            type="button"
            onClick={() => void deleteSelectedRecords()}
            disabled={selectedFilteredIds.length === 0}
          >
            <Trash2 size={15} aria-hidden="true" />
            批量删除 {selectedFilteredIds.length}
          </button>
        </div>

        <div className="entry-table-shell">
          <table className="entry-table">
            <thead>
              <tr>
                <th className="col-select">
                  <input
                    type="checkbox"
                    aria-label="选择当前筛选结果"
                    checked={allFilteredSelected}
                    disabled={filteredRecords.length === 0}
                    onChange={(event) => {
                      if (event.target.checked) {
                        selectFilteredRecords();
                      } else {
                        clearFilteredSelection();
                      }
                    }}
                  />
                </th>
                <th className="col-province">省份</th>
                <th className="col-city">城市</th>
                <th className="col-university">高校名称</th>
                <th className="col-total">省份高校总数</th>
                <th className="col-total">城市高校总数</th>
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
                <td />
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
                    value={entryForm.provinceUniversityTotal}
                    inputMode="numeric"
                    placeholder="如 160"
                    onChange={(event) => updateField("provinceUniversityTotal")(event.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={entryForm.cityUniversityTotal}
                    inputMode="numeric"
                    placeholder="如 18"
                    onChange={(event) => updateField("cityUniversityTotal")(event.target.value)}
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
                  <td colSpan={12}>暂无交付记录，可通过上方表格新增或下载模板后批量导入 CSV。</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={12}>没有匹配当前筛选条件的交付记录。</td>
                </tr>
              ) : (
                filteredRecords.map((record) => {
                  const editingForm = editingForms[record.id];
                  const editingCities = editingCityOptions[record.id] ?? [];
                  return (
                    <tr className={editingForm ? "is-editing-row" : undefined} key={record.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`选择${record.university}`}
                          checked={selectedIds.has(record.id)}
                          disabled={Boolean(editingForm)}
                          onChange={() => toggleRecordSelection(record.id)}
                        />
                      </td>
                      {editingForm ? (
                        <>
                          <td>
                            <select
                              value={editingForm.province}
                              onChange={(event) => void updateEditingProvince(record.id, event.target.value)}
                            >
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
                              value={editingForm.city}
                              disabled={!editingForm.province}
                              onChange={(event) => updateEditingField(record.id, "city", event.target.value)}
                            >
                              <option value="">{editingForm.province ? "选择城市" : "先选省份"}</option>
                              {editingCities.map((city) => (
                                <option key={city} value={city}>
                                  {city}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              value={editingForm.university}
                              onChange={(event) => updateEditingField(record.id, "university", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.provinceUniversityTotal}
                              inputMode="numeric"
                              onChange={(event) =>
                                updateEditingField(record.id, "provinceUniversityTotal", event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.cityUniversityTotal}
                              inputMode="numeric"
                              onChange={(event) => updateEditingField(record.id, "cityUniversityTotal", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.productTags}
                              onChange={(event) => updateEditingField(record.id, "productTags", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.purchaseTags}
                              onChange={(event) => updateEditingField(record.id, "purchaseTags", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.equipmentDetails}
                              onChange={(event) => updateEditingField(record.id, "equipmentDetails", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.painPoints}
                              onChange={(event) => updateEditingField(record.id, "painPoints", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.deliveryContent}
                              onChange={(event) => updateEditingField(record.id, "deliveryContent", event.target.value)}
                            />
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{record.province}</td>
                          <td>{record.city}</td>
                          <td>
                            <strong>{record.university}</strong>
                          </td>
                          <td>{record.provinceUniversityTotal ?? "-"}</td>
                          <td>{record.cityUniversityTotal ?? "-"}</td>
                          <td>{joinList(record.productTags)}</td>
                          <td>{joinList(record.purchaseTags)}</td>
                          <td>{joinList(record.equipmentDetails)}</td>
                          <td>{joinList(record.painPoints)}</td>
                          <td>{record.deliveryContent || "-"}</td>
                        </>
                      )}
                      <td>
                        <div className="row-actions">
                          {editingForm ? (
                            <>
                              <button
                                className="table-primary-action"
                                type="button"
                                disabled={savingId === record.id}
                                onClick={() => void saveRecord(record)}
                              >
                                <Save size={15} aria-hidden="true" />
                                保存
                              </button>
                              <button className="table-plain-action" type="button" onClick={() => cancelEditRecord(record.id)}>
                                取消
                              </button>
                            </>
                          ) : (
                            <>
                              <button className="table-plain-action" type="button" onClick={() => void startEditRecord(record)}>
                                <Pencil size={15} aria-hidden="true" />
                                编辑
                              </button>
                              <button
                                className="table-danger-action"
                                type="button"
                                aria-label={`删除${record.university}`}
                                onClick={() => void deleteRecord(record)}
                              >
                                <Trash2 size={15} aria-hidden="true" />
                                删除
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="form-message">{message}</p>
      </section>
    </main>
  );
}
