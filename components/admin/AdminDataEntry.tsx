"use client";

import {
  ArrowLeft,
  Download,
  FileDown,
  FileUp,
  LockKeyhole,
  LogOut,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildCsvTemplate, exportDeliveriesToCsv } from "@/lib/csv/export";
import { parseDeliveryCsv } from "@/lib/csv/parse";
import { COVERAGE_STATUSES } from "@/lib/coverage/status";
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
  coverageStatus: string;
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

type AdminSessionPayload = {
  configured?: boolean;
  unlocked?: boolean;
  error?: string;
};

const EMPTY_ENTRY_FORM: EntryFormState = {
  province: "",
  city: "",
  university: "",
  provinceUniversityTotal: "",
  cityUniversityTotal: "",
  productTags: "",
  purchaseTags: "",
  coverageStatus: "",
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

const COVERAGE_STATUS_OPTIONS = COVERAGE_STATUSES;

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
    coverageStatus: record.coverageStatus ?? "",
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
    record.coverageStatus ?? "",
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
    coverageStatus: form.coverageStatus.trim()
      ? (form.coverageStatus.trim() as DeliveryPayload["coverageStatus"])
      : undefined,
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

async function readAdminSessionPayload(response: Response): Promise<AdminSessionPayload> {
  const text = await response.text();
  let payload: AdminSessionPayload = {};
  try {
    payload = text ? (JSON.parse(text) as AdminSessionPayload) : {};
  } catch {
    if (!response.ok) {
      throw new Error(`管理密码验证失败：HTTP ${response.status}`);
    }
    throw new Error("管理密码接口返回格式错误");
  }

  if (!response.ok) {
    throw new Error(payload.error ?? `管理密码验证失败：HTTP ${response.status}`);
  }
  return payload;
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
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(true);
  const [adminPassword, setAdminPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState("请输入管理密码，解锁录入、导入、导出和删除操作。");
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
  const provinceCount = useMemo(() => new Set(records.map((record) => record.province).filter(Boolean)).size, [records]);
  const cityCount = useMemo(() => new Set(records.map((record) => `${record.province}/${record.city}`).filter(Boolean)).size, [records]);
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

  const requireAdminUnlocked = useCallback(() => {
    if (adminUnlocked) return true;
    setAuthDialogOpen(true);
    setAuthMessage("请先输入管理密码。");
    setMessage("请先输入管理密码，再进行录入或维护。");
    return false;
  }, [adminUnlocked]);

  useEffect(() => {
    if (window.location.protocol === "file:") {
      setHomeHref("../index.html");
    }
  }, []);

  useEffect(() => {
    let active = true;

    void fetch("/api/admin/session", {
      cache: "no-store",
      credentials: "same-origin",
    })
      .then(readAdminSessionPayload)
      .then((payload) => {
        if (!active) return;
        setAdminUnlocked(Boolean(payload.unlocked));
        setAuthDialogOpen(!payload.unlocked);
        if (payload.unlocked) {
          setAuthMessage(payload.configured ? "管理权限已验证。" : "本地开发未配置管理密码，已自动解锁。");
        }
      })
      .catch((authError) => {
        if (!active) return;
        setAuthDialogOpen(true);
        setAuthMessage(authError instanceof Error ? authError.message : "管理密码状态读取失败，请重新输入。");
      });

    return () => {
      active = false;
    };
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

  const unlockAdmin = async () => {
    if (!adminPassword) {
      setAuthMessage("请输入管理密码。");
      return;
    }

    try {
      setAuthLoading(true);
      const payload = await readAdminSessionPayload(
        await fetch("/api/admin/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token: adminPassword }),
        }),
      );

      if (!payload.unlocked) {
        setAuthMessage("密码验证失败，请重新输入。");
        return;
      }

      setAdminUnlocked(true);
      setAuthDialogOpen(false);
      setAdminPassword("");
      setAuthMessage("管理权限已验证。");
      setMessage("管理权限已验证，可以录入和维护数据。");
    } catch (authError) {
      setAuthMessage(authError instanceof Error ? authError.message : "管理密码验证失败");
    } finally {
      setAuthLoading(false);
    }
  };

  const logoutAdmin = async () => {
    try {
      await fetch("/api/admin/session", {
        method: "DELETE",
        credentials: "same-origin",
      });
    } finally {
      setAdminUnlocked(false);
      setAuthDialogOpen(true);
      setAdminPassword("");
      setAuthMessage("已退出管理模式，请重新输入管理密码。");
      setMessage("已退出管理模式，录入和维护操作已锁定。");
    }
  };

  const createRecord = async () => {
    if (!requireAdminUnlocked()) return;

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
    if (!requireAdminUnlocked()) return;

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
    if (!requireAdminUnlocked()) return;

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
    if (!requireAdminUnlocked()) return;
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
    if (!requireAdminUnlocked()) return;

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
    if (!requireAdminUnlocked()) return;

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
      {authDialogOpen ? (
        <div className="admin-auth-backdrop">
          <section className="admin-auth-card" role="dialog" aria-modal="true" aria-labelledby="admin-auth-title">
            <div className="admin-auth-icon">
              <LockKeyhole size={22} aria-hidden="true" />
            </div>
            <div>
              <span>Admin Access</span>
              <h2 id="admin-auth-title">输入管理密码</h2>
              <p>后端会校验环境变量 ADMIN_API_TOKEN，验证通过后写入 HttpOnly 会话 Cookie。</p>
            </div>
            <form
              className="admin-auth-form"
              onSubmit={(event) => {
                event.preventDefault();
                void unlockAdmin();
              }}
            >
              <input
                autoFocus
                type="password"
                value={adminPassword}
                placeholder="管理密码"
                onChange={(event) => setAdminPassword(event.target.value)}
              />
              <button type="submit" disabled={authLoading}>
                {authLoading ? "验证中" : "解锁管理"}
              </button>
            </form>
            <p className="admin-auth-message">{authMessage}</p>
          </section>
        </div>
      ) : null}

      <section className="admin-hero">
        <div>
          <span>Data Entry</span>
          <h1>高校交付数据录入</h1>
          <p>维护高校案例、产品标签、采购标签、设备明细和业务痛点，数据会同步到服务端。</p>
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
          <label
            className={`file-action${adminUnlocked ? "" : " is-disabled"}`}
            onClick={(event) => {
              if (adminUnlocked) return;
              event.preventDefault();
              requireAdminUnlocked();
            }}
          >
            <FileUp size={16} aria-hidden="true" />
            CSV导入
            <input
              ref={fileRef}
              type="file"
              disabled={!adminUnlocked}
              accept=".csv,text/csv"
              aria-label="CSV导入"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  if (adminUnlocked) {
                    void importCsv(file);
                  } else {
                    requireAdminUnlocked();
                  }
                }
                event.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => {
              if (!requireAdminUnlocked()) return;
              downloadCsv(records);
            }}
          >
            <Download size={16} aria-hidden="true" />
            导出CSV
          </button>
          {adminUnlocked ? (
            <button type="button" onClick={() => void logoutAdmin()}>
              <LogOut size={16} aria-hidden="true" />
              退出管理
            </button>
          ) : null}
        </div>
      </section>

      <section className="entry-overview" aria-label="录入数据概览">
        <div>
          <span>总记录</span>
          <strong>{records.length}</strong>
        </div>
        <div>
          <span>覆盖省份</span>
          <strong>{provinceCount}</strong>
        </div>
        <div>
          <span>覆盖城市</span>
          <strong>{cityCount}</strong>
        </div>
        <div>
          <span>当前筛选</span>
          <strong>{filteredRecords.length}</strong>
        </div>
      </section>

      <section className="entry-compose" aria-label="新增高校交付记录">
        <div className="compose-heading">
          <div>
            <span>Quick Entry</span>
            <h2>新增交付记录</h2>
            <p>先填写高校和区域，再补充产品、采购、设备与业务痛点。</p>
          </div>
          <button
            className="compose-submit"
            type="button"
            disabled={!ready || !adminUnlocked}
            onClick={() => void createRecord()}
          >
            <Plus size={16} aria-hidden="true" />
            新增记录
          </button>
        </div>

        <div className="compose-grid">
          <div className="compose-panel compose-panel-primary">
            <div className="compose-panel-title">
              <span>01</span>
              <strong>高校与区域</strong>
            </div>
            <label>
              <span>省份</span>
              <select
                value={entryForm.province}
                disabled={!adminUnlocked}
                onChange={(event) => updateField("province")(event.target.value)}
              >
                <option value="">选择省份</option>
                {provinceOptions.map((province) => (
                  <option key={province} value={province}>
                    {province}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>城市</span>
              <select
                value={entryForm.city}
                disabled={!adminUnlocked || !entryForm.province || cityLoading}
                onChange={(event) => updateField("city")(event.target.value)}
              >
                <option value="">{cityLoading ? "加载城市中" : entryForm.province ? "选择城市" : "先选省份"}</option>
                {cityOptions.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </label>
            <label className="compose-field-wide">
              <span>高校名称</span>
              <input
                value={entryForm.university}
                disabled={!adminUnlocked}
                placeholder="例如：深圳大学"
                onChange={(event) => updateField("university")(event.target.value)}
              />
            </label>
          </div>

          <div className="compose-panel">
            <div className="compose-panel-title">
              <span>02</span>
              <strong>覆盖分母</strong>
            </div>
            <label>
              <span>省份高校总数</span>
              <input
                value={entryForm.provinceUniversityTotal}
                disabled={!adminUnlocked}
                inputMode="numeric"
                placeholder="如 160"
                onChange={(event) => updateField("provinceUniversityTotal")(event.target.value)}
              />
            </label>
            <label>
              <span>城市高校总数</span>
              <input
                value={entryForm.cityUniversityTotal}
                disabled={!adminUnlocked}
                inputMode="numeric"
                placeholder="如 18"
                onChange={(event) => updateField("cityUniversityTotal")(event.target.value)}
              />
            </label>
          </div>

          <div className="compose-panel compose-panel-tags">
            <div className="compose-panel-title">
              <span>03</span>
              <strong>标签与交付信息</strong>
            </div>
            <label>
              <span>产品标签</span>
              <input
                value={entryForm.productTags}
                disabled={!adminUnlocked}
                placeholder="SDDC;EDS;桌面云"
                onChange={(event) => updateField("productTags")(event.target.value)}
              />
            </label>
            <label>
              <span>采购标签</span>
              <input
                value={entryForm.purchaseTags}
                disabled={!adminUnlocked}
                placeholder="VMware替换;信创;AI超融合"
                onChange={(event) => updateField("purchaseTags")(event.target.value)}
              />
            </label>
            <label>
              <span>覆盖状态</span>
              <select
                value={entryForm.coverageStatus}
                disabled={!adminUnlocked}
                onChange={(event) => updateField("coverageStatus")(event.target.value)}
              >
                <option value="">选择状态</option>
                {COVERAGE_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>设备明细</span>
              <input
                value={entryForm.equipmentDetails}
                disabled={!adminUnlocked}
                placeholder="超融合节点x3;交换机x2"
                onChange={(event) => updateField("equipmentDetails")(event.target.value)}
              />
            </label>
            <label>
              <span>业务痛点</span>
              <input
                value={entryForm.painPoints}
                disabled={!adminUnlocked}
                placeholder="授权成本高;数据增长快"
                onChange={(event) => updateField("painPoints")(event.target.value)}
              />
            </label>
            <label className="compose-field-wide">
              <span>交付内容</span>
              <input
                value={entryForm.deliveryContent}
                disabled={!adminUnlocked}
                placeholder="交付范围、阶段或备注"
                onChange={(event) => updateField("deliveryContent")(event.target.value)}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="entry-workbench" aria-label="高校交付数据表格录入">
        <div className="workbench-heading">
          <div>
            <h2>数据维护表</h2>
            <p>支持搜索、筛选、行内编辑、批量选择和删除；多值字段用分号、顿号或斜杠分隔。</p>
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
          <button type="button" onClick={selectFilteredRecords} disabled={!adminUnlocked || filteredRecords.length === 0}>
            选择当前结果
          </button>
          <button type="button" onClick={clearSelection} disabled={selectedIds.size === 0}>
            清空选择
          </button>
          <button
            className="danger-toolbar-action"
            type="button"
            onClick={() => void deleteSelectedRecords()}
            disabled={!adminUnlocked || selectedFilteredIds.length === 0}
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
                    disabled={!adminUnlocked || filteredRecords.length === 0}
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
                <th className="col-status">覆盖状态</th>
                <th>设备明细</th>
                <th>业务痛点</th>
                <th>交付内容</th>
                <th className="col-action">操作</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={13}>暂无交付记录，可通过上方录入控制台新增或下载模板后批量导入 CSV。</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr className="empty-row">
                  <td colSpan={13}>没有匹配当前筛选条件的交付记录。</td>
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
                          disabled={!adminUnlocked || Boolean(editingForm)}
                          onChange={() => toggleRecordSelection(record.id)}
                        />
                      </td>
                      {editingForm ? (
                        <>
                          <td>
                            <select
                              value={editingForm.province}
                              disabled={!adminUnlocked}
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
                              disabled={!adminUnlocked || !editingForm.province}
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
                              disabled={!adminUnlocked}
                              onChange={(event) => updateEditingField(record.id, "university", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.provinceUniversityTotal}
                              disabled={!adminUnlocked}
                              inputMode="numeric"
                              onChange={(event) =>
                                updateEditingField(record.id, "provinceUniversityTotal", event.target.value)
                              }
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.cityUniversityTotal}
                              disabled={!adminUnlocked}
                              inputMode="numeric"
                              onChange={(event) => updateEditingField(record.id, "cityUniversityTotal", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.productTags}
                              disabled={!adminUnlocked}
                              onChange={(event) => updateEditingField(record.id, "productTags", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.purchaseTags}
                              disabled={!adminUnlocked}
                              onChange={(event) => updateEditingField(record.id, "purchaseTags", event.target.value)}
                            />
                          </td>
                          <td>
                            <select
                              value={editingForm.coverageStatus}
                              disabled={!adminUnlocked}
                              onChange={(event) => updateEditingField(record.id, "coverageStatus", event.target.value)}
                            >
                              <option value="">未填写</option>
                              {COVERAGE_STATUS_OPTIONS.map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              value={editingForm.equipmentDetails}
                              disabled={!adminUnlocked}
                              onChange={(event) => updateEditingField(record.id, "equipmentDetails", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.painPoints}
                              disabled={!adminUnlocked}
                              onChange={(event) => updateEditingField(record.id, "painPoints", event.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              value={editingForm.deliveryContent}
                              disabled={!adminUnlocked}
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
                          <td>{record.coverageStatus || "-"}</td>
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
                                disabled={!adminUnlocked || savingId === record.id}
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
                              <button
                                className="table-plain-action"
                                type="button"
                                disabled={!adminUnlocked}
                                onClick={() => void startEditRecord(record)}
                              >
                                <Pencil size={15} aria-hidden="true" />
                                编辑
                              </button>
                              <button
                                className="table-danger-action"
                                type="button"
                                aria-label={`删除${record.university}`}
                                disabled={!adminUnlocked}
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
