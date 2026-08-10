"use client";

import {
  ContainerOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EnvironmentFilled,
  FileTextFilled,
  FileExcelOutlined,
  FilterFilled,
  FilterOutlined,
  HddOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Button,
  Empty,
  Flex,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { TableColumnsType, UploadProps } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Key } from "react";
import { COVERAGE_STATUSES } from "@/lib/coverage/status";
import { createClientProvider } from "@/lib/data/client-provider";
import { dedupeDeliveries, getDeliveryBusinessKey } from "@/lib/data/dedupe";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { buildDeliveriesWorkbook, buildExcelTemplate, parseDeliveryExcel } from "@/lib/excel/workbook";
import { getProvinceOptions } from "@/lib/regions/china-regions";
import type { DeliveryRecord } from "@/lib/types";
import { DataWorkbench } from "@/components/ui/DataWorkbench";
import { ManagementFormDrawer } from "@/components/ui/ManagementFormDrawer";
import { MetricCards } from "@/components/ui/MetricCards";
import { AdminAccessGate } from "@/components/admin/AdminAccessGate";
import { useAdminSession } from "@/components/admin/AdminSessionProvider";
import { AdminShell } from "@/components/admin/AdminShell";
import { UniversityFormFields } from "@/components/admin/UniversityFormFields";
import type { UniversityFormValues } from "@/components/admin/UniversityFormFields";
import {
  buildUniversityPayload,
  downloadUniversityWorkbook,
  getUniversityFormValues,
  joinUniversityValues,
  renderUniversityStatus,
} from "@/components/admin/university-data";
import "./admin-data-entry.css";

const { Title, Paragraph } = Typography;

type Filters = {
  keyword: string;
  province?: string;
  product?: string;
  coverageStatus?: string;
};

const EMPTY_FILTERS: Filters = { keyword: "" };

function AdminDataEntryContent() {
  const { message, modal } = AntApp.useApp();
  const { unlocked: adminUnlocked, logout } = useAdminSession();
  const [form] = Form.useForm<UniversityFormValues>();
  const providerRef = useRef<ReturnType<typeof createClientProvider> | null>(null);
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | "detail">("create");
  const [currentRecord, setCurrentRecord] = useState<DeliveryRecord>();
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);

  const getProvider = useCallback(() => {
    providerRef.current ??= createClientProvider();
    return providerRef.current;
  }, []);

  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setRecords(await getProvider().list());
    } catch (error) {
      message.error(error instanceof Error ? error.message : "高校信息读取失败");
    } finally {
      setLoading(false);
    }
  }, [getProvider, message]);

  useEffect(() => {
    if (!adminUnlocked) {
      setRecords([]);
      setLoading(false);
      return;
    }

    void loadRecords();
  }, [adminUnlocked, loadRecords]);

  const provinceOptions = useMemo(() => getProvinceOptions(), []);
  const productOptions = useMemo(
    () => Array.from(new Set(records.flatMap((record) => record.productTags))).sort((a, b) => a.localeCompare(b, "zh-CN")),
    [records],
  );
  const filteredRecords = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase();
    return records.filter((record) => {
      if (filters.province && record.province !== filters.province) return false;
      if (filters.product && !record.productTags.includes(filters.product)) return false;
      if (filters.coverageStatus && record.coverageStatus !== filters.coverageStatus) return false;
      if (!keyword) return true;

      return [
        record.schoolId,
        record.province,
        record.university,
        record.customerStatus,
        record.resourceType,
        record.businessScenario,
        record.deviceModel,
        ...record.productTags,
        ...record.purchaseTags,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [filters, records]);

  const overview = useMemo(
    () => ({
      provinceCount: new Set(records.map((record) => record.province).filter(Boolean)).size,
      deployedCount: records.filter((record) => record.coverageStatus === "已部署").length,
      incompleteCount: records.filter((record) => !record.coverageStatus || record.coverageStatus === "未覆盖").length,
    }),
    [records],
  );

  const requireAdminUnlocked = () => {
    if (adminUnlocked) return true;
    message.warning("请先验证管理权限。");
    return false;
  };

  const logoutAdmin = async () => {
    try {
      await logout();
      setRecords([]);
      setSelectedIds([]);
      message.success("已退出管理模式。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "退出管理模式失败");
    }
  };

  const openDrawer = (mode: "create" | "edit" | "detail", record?: DeliveryRecord) => {
    if (mode !== "detail" && !requireAdminUnlocked()) return;
    setDrawerMode(mode);
    setCurrentRecord(record);
    form.resetFields();
    form.setFieldsValue(getUniversityFormValues(record));
    setDrawerOpen(true);
  };

  const saveRecord = async () => {
    if (!requireAdminUnlocked()) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (drawerMode === "create") {
        const record = await getProvider().create(buildUniversityPayload(values));
        message.success(`已新增「${record.university}」。`);
      } else if (currentRecord) {
        const record = await getProvider().update(currentRecord.id, buildUniversityPayload(values, currentRecord));
        message.success(`已更新「${record.university}」。`);
      }
      setDrawerOpen(false);
      await loadRecords();
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRecord = async (record: DeliveryRecord) => {
    if (!requireAdminUnlocked()) return;
    try {
      await getProvider().remove(record.id);
      setSelectedIds((ids) => ids.filter((id) => id !== record.id));
      message.success(`已删除「${record.university}」。`);
      await loadRecords();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const deleteSelected = () => {
    if (!requireAdminUnlocked() || selectedIds.length === 0) return;
    modal.confirm({
      title: "确认批量删除？",
      content: `将删除已选中的 ${selectedIds.length} 条高校信息，删除后无法恢复。`,
      okText: "确认删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        const selected = new Set(selectedIds);
        await getProvider().replaceAll(records.filter((record) => !selected.has(record.id)));
        setSelectedIds([]);
        message.success(`已删除 ${selected.size} 条高校信息。`);
        await loadRecords();
      },
    });
  };

  const importExcel = async (file: File) => {
    if (!requireAdminUnlocked() || importing) return false;
    try {
      setImporting(true);
      const result = await parseDeliveryExcel(file);
      if (result.errors.length > 0) throw new Error(result.errors.slice(0, 2).join("；"));
      const imported = dedupeDeliveries(result.records.map(createDeliveryRecord));
      if (imported.length === 0) throw new Error("Excel 中没有可导入的记录。");
      const current = await getProvider().list();
      const currentKeys = new Set(current.map(getDeliveryBusinessKey));
      const addedCount = imported.filter((record) => !currentKeys.has(getDeliveryBusinessKey(record))).length;
      await getProvider().replaceAll(dedupeDeliveries([...imported, ...current]));
      message.success(`已导入 ${addedCount} 条高校信息。`);
      await loadRecords();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Excel 导入失败");
    } finally {
      setImporting(false);
    }
    return false;
  };

  const uploadProps: UploadProps = {
    accept: ".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    showUploadList: false,
    beforeUpload: importExcel,
    disabled: importing || !adminUnlocked,
  };

  const columns: TableColumnsType<DeliveryRecord> = [
    { title: "高校ID", dataIndex: "schoolId", width: 92, render: (value) => value || "-" },
    { title: "所在省", dataIndex: "province", width: 110 },
    { title: "高校名称", dataIndex: "university", width: 150, render: (value) => <Typography.Text strong>{value}</Typography.Text> },
    { title: "覆盖状态", dataIndex: "coverageStatus", width: 112, render: renderUniversityStatus },
    { title: "客户归属", dataIndex: "customerStatus", width: 170, ellipsis: true, render: (value) => value || "-" },
    { title: "产品线", dataIndex: "productTags", width: 145, ellipsis: true, render: joinUniversityValues },
    { title: "资源集群", dataIndex: "resourceType", width: 150, ellipsis: true, render: (value, record) => value || joinUniversityValues(record.productTags) || "-" },
    { title: "部署状态", dataIndex: "businessScenario", width: 130, ellipsis: true, render: (value) => value || "-" },
    { title: "设备型号", dataIndex: "deviceModel", width: 130, ellipsis: true, render: (value, record) => value || joinUniversityValues(record.equipmentDetails) || "-" },
    { title: "部署年份", dataIndex: "purchaseYear", width: 105, render: (value) => value || "-" },
    {
      title: "操作",
      fixed: "right",
      width: 160,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => openDrawer("detail", record)}>
            详情
          </Button>
          <Button type="link" size="small" disabled={!adminUnlocked} onClick={() => openDrawer("edit", record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该高校信息？"
            description={`“${record.university}”将被永久删除。`}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={() => void deleteRecord(record)}
          >
            <Button type="link" danger size="small" disabled={!adminUnlocked}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const formDisabled = drawerMode === "detail";

  return (
    <AdminShell selectedKey="university-info" onLogout={() => void logoutAdmin()}>
      <AdminAccessGate description="输入管理密码后可查看和维护高校信息。">
          <section className="management-page-heading">
            <div>
              <Title level={2}>高校信息维护</Title>
              <Paragraph>维护高校基础信息、客户归属、资源集群与部署状态，支持批量导入导出。</Paragraph>
            </div>
            <Tag color={adminUnlocked ? "success" : "default"}>{adminUnlocked ? "管理模式已解锁" : "只读模式"}</Tag>
          </section>

          <MetricCards
            items={[
              { label: "总记录", value: records.length, icon: <FileTextFilled />, tone: "blue" },
              { label: "覆盖省份", value: overview.provinceCount, icon: <EnvironmentFilled />, tone: "green" },
              { label: "已部署", value: overview.deployedCount, icon: <HddOutlined />, tone: "blue" },
              { label: "待补充", value: overview.incompleteCount, icon: <ContainerOutlined />, tone: "orange" },
              { label: "当前筛选", value: filteredRecords.length, icon: <FilterFilled />, tone: "purple" },
            ]}
          />

          <DataWorkbench
            className="university-workbench"
            toolbar={
              <Flex justify="space-between" align="center" wrap gap={16}>
              <Flex className="data-toolbar-filters" align="center" wrap gap={12}>
                <Input
                  allowClear
                  className="data-toolbar-search"
                  prefix={<SearchOutlined />}
                  placeholder="搜索高校名称、ID、设备型号等"
                  value={filters.keyword}
                  onChange={(event) => setFilters((value) => ({ ...value, keyword: event.target.value }))}
                />
                <Select className="data-toolbar-select" allowClear placeholder="全部省份" value={filters.province} options={provinceOptions.map((value) => ({ value, label: value }))} onChange={(province) => setFilters((value) => ({ ...value, province }))} />
                <Select className="data-toolbar-select" allowClear placeholder="全部产品" value={filters.product} options={productOptions.map((value) => ({ value, label: value }))} onChange={(product) => setFilters((value) => ({ ...value, product }))} />
                <Select className="data-toolbar-select" allowClear placeholder="部署状态" value={filters.coverageStatus} options={COVERAGE_STATUSES.map((value) => ({ value, label: value }))} onChange={(coverageStatus) => setFilters((value) => ({ ...value, coverageStatus }))} />
                <Button icon={<ReloadOutlined />} onClick={() => setFilters(EMPTY_FILTERS)}>重置</Button>
                <Button danger type="text" icon={<DeleteOutlined />} disabled={!adminUnlocked || selectedIds.length === 0} onClick={deleteSelected}>删除已选 {selectedIds.length || ""}</Button>
              </Flex>
              <Space wrap>
                <Button type="primary" icon={<PlusOutlined />} disabled={!adminUnlocked} onClick={() => openDrawer("create")}>新增高校</Button>
                <Upload {...uploadProps}><Button icon={<ImportOutlined />} loading={importing} disabled={!adminUnlocked}>导入 Excel</Button></Upload>
                <Button icon={<DownloadOutlined />} disabled={!adminUnlocked} onClick={() => downloadUniversityWorkbook("高校信息维护清单.xlsx", buildDeliveriesWorkbook(records))}>导出 Excel</Button>
                <Button icon={<FileExcelOutlined />} onClick={() => downloadUniversityWorkbook("高校信息维护清单-模板.xlsx", buildExcelTemplate())}>下载模板</Button>
              </Space>
              </Flex>
            }
          >

            <Table
              className="university-table"
              rowKey="id"
              loading={loading}
              columns={columns}
              dataSource={filteredRecords}
              scroll={{ x: 1510 }}
              rowSelection={{ selectedRowKeys: selectedIds, onChange: setSelectedIds, getCheckboxProps: () => ({ disabled: !adminUnlocked }) }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={records.length === 0 ? "暂无高校信息，请新增或导入 Excel" : "没有匹配当前筛选条件的记录"} /> }}
              pagination={{ showSizeChanger: true, showQuickJumper: true, showTotal: (total) => `共 ${total} 条`, pageSizeOptions: [10, 20, 50] }}
            />
          </DataWorkbench>

      <ManagementFormDrawer
        title={drawerMode === "create" ? "新增高校" : drawerMode === "edit" ? "编辑高校信息" : "高校信息详情"}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        extra={drawerMode === "detail" ? <Button type="primary" disabled={!adminUnlocked} onClick={() => setDrawerMode("edit")}>编辑</Button> : null}
        onSave={formDisabled ? undefined : saveRecord}
        saveLoading={saving}
      >
        <UniversityFormFields form={form} provinceOptions={provinceOptions} disabled={formDisabled} />
      </ManagementFormDrawer>
      </AdminAccessGate>
    </AdminShell>
  );
}

export function AdminDataEntry() {
  return <AdminDataEntryContent />;
}
