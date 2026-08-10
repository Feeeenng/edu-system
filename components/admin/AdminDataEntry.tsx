"use client";

import {
  AppstoreOutlined,
  BankOutlined,
  BellOutlined,
  BookOutlined,
  CloudServerOutlined,
  ContainerOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DeploymentUnitOutlined,
  DownloadOutlined,
  EnvironmentFilled,
  FileTextFilled,
  FileExcelOutlined,
  FileTextOutlined,
  FilterFilled,
  FilterOutlined,
  HddOutlined,
  HomeOutlined,
  ImportOutlined,
  LeftOutlined,
  LockOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoreOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  App as AntApp,
  Avatar,
  Breadcrumb,
  Button,
  Card,
  Col,
  ConfigProvider,
  Drawer,
  Dropdown,
  Empty,
  Flex,
  Form,
  Grid,
  Input,
  InputNumber,
  Layout,
  Menu,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from "antd";
import type { MenuProps, TableColumnsType, UploadProps } from "antd";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Key } from "react";
import { COVERAGE_STATUSES } from "@/lib/coverage/status";
import { createClientProvider } from "@/lib/data/client-provider";
import { dedupeDeliveries, getDeliveryBusinessKey } from "@/lib/data/dedupe";
import { createDeliveryRecord } from "@/lib/data/normalize";
import { buildDeliveriesWorkbook, buildExcelTemplate, parseDeliveryExcel } from "@/lib/excel/workbook";
import { getProvinceOptions } from "@/lib/regions/china-regions";
import type { DeliveryPayload, DeliveryRecord } from "@/lib/types";
import "./admin-data-entry.css";

const { Header, Content, Sider } = Layout;
const { Title, Text, Paragraph } = Typography;

type EntryFormValues = {
  schoolId?: string;
  province: string;
  university: string;
  coverageStatus?: string;
  customerStatus?: string;
  purchaseYear?: string;
  purchaseTags?: string;
  resourceType?: string;
  resourceAmount?: number;
  resourceUnit?: string;
  businessScenario?: string;
  coreValue?: string;
  deviceModel?: string;
  bidLink?: string;
  notes?: string;
};

type Filters = {
  keyword: string;
  province?: string;
  product?: string;
  coverageStatus?: string;
};

type AdminSessionPayload = {
  configured?: boolean;
  unlocked?: boolean;
  error?: string;
};

const EMPTY_FILTERS: Filters = { keyword: "" };
const EMPTY_FORM: EntryFormValues = { province: "", university: "" };

const menuItems: MenuProps["items"] = [
  { key: "workspace", icon: <HomeOutlined />, label: "工作台" },
  {
    key: "university-management",
    icon: <BankOutlined />,
    label: "高校管理",
    children: [{ key: "university-info", label: "高校信息维护" }],
  },
  { key: "customer", icon: <TeamOutlined />, label: "客户管理" },
  { key: "product", icon: <AppstoreOutlined />, label: "产品配置" },
  { key: "resource", icon: <DatabaseOutlined />, label: "资源池管理" },
  { key: "delivery", icon: <DeploymentUnitOutlined />, label: "项目交付" },
  { key: "sync", icon: <CloudServerOutlined />, label: "数据同步" },
  { key: "report", icon: <FileTextOutlined />, label: "报表中心" },
  { key: "settings", icon: <SettingOutlined />, label: "系统设置" },
];

function splitList(value?: string) {
  return (value ?? "")
    .split(/[;；/、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinList(items?: string[]) {
  return (items ?? []).join(" / ");
}

function getFormValues(record?: DeliveryRecord): EntryFormValues {
  if (!record) return EMPTY_FORM;

  return {
    schoolId: record.schoolId,
    province: record.province,
    university: record.university,
    coverageStatus: record.coverageStatus,
    customerStatus: record.customerStatus,
    purchaseYear: record.purchaseYear,
    purchaseTags: joinList(record.purchaseTags),
    resourceType: record.resourceType ?? joinList(record.productTags),
    resourceAmount: record.resourceAmount,
    resourceUnit: record.resourceUnit,
    businessScenario: record.businessScenario,
    coreValue: record.coreValue,
    deviceModel: record.deviceModel ?? joinList(record.equipmentDetails),
    bidLink: record.bidLink,
    notes: record.notes,
  };
}

function buildPayload(values: EntryFormValues, base?: DeliveryRecord): DeliveryPayload {
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

function statusTag(status?: string) {
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

function downloadWorkbook(filename: string, workbook: ArrayBuffer) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([workbook], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function readSession(response: Response): Promise<AdminSessionPayload> {
  const text = await response.text();
  let payload: AdminSessionPayload = {};

  try {
    payload = text ? (JSON.parse(text) as AdminSessionPayload) : {};
  } catch {
    throw new Error(`管理权限校验失败：HTTP ${response.status}`);
  }

  if (!response.ok) throw new Error(payload.error ?? `管理权限校验失败：HTTP ${response.status}`);
  return payload;
}

function AdminDataEntryContent() {
  const { message, modal } = AntApp.useApp();
  const screens = Grid.useBreakpoint();
  const [form] = Form.useForm<EntryFormValues>();
  const providerRef = useRef<ReturnType<typeof createClientProvider> | null>(null);
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Key[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | "detail">("create");
  const [currentRecord, setCurrentRecord] = useState<DeliveryRecord>();
  const [saving, setSaving] = useState(false);
  const [authOpen, setAuthOpen] = useState(true);
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
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
    void loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/session", { cache: "no-store", credentials: "same-origin" })
      .then(readSession)
      .then((payload) => {
        if (!active) return;
        setAdminUnlocked(Boolean(payload.unlocked));
        setAuthOpen(!payload.unlocked);
      })
      .catch((error) => {
        if (active) message.error(error instanceof Error ? error.message : "管理权限读取失败");
      });

    return () => {
      active = false;
    };
  }, [message]);

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
    setAuthOpen(true);
    message.warning("请先验证管理权限。");
    return false;
  };

  const unlockAdmin = async () => {
    if (!adminPassword) {
      message.warning("请输入管理密码。");
      return;
    }

    try {
      setAuthLoading(true);
      const payload = await readSession(
        await fetch("/api/admin/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ token: adminPassword }),
        }),
      );
      if (!payload.unlocked) throw new Error("管理密码验证失败");
      setAdminUnlocked(true);
      setAuthOpen(false);
      setAdminPassword("");
      message.success(payload.configured ? "管理权限已验证。" : "本地开发环境已解锁管理权限。");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "管理密码验证失败");
    } finally {
      setAuthLoading(false);
    }
  };

  const logoutAdmin = async () => {
    await fetch("/api/admin/session", { method: "DELETE", credentials: "same-origin" });
    setAdminUnlocked(false);
    setAuthOpen(true);
    message.success("已退出管理模式。");
  };

  const openDrawer = (mode: "create" | "edit" | "detail", record?: DeliveryRecord) => {
    if (mode !== "detail" && !requireAdminUnlocked()) return;
    setDrawerMode(mode);
    setCurrentRecord(record);
    form.setFieldsValue(getFormValues(record));
    setDrawerOpen(true);
  };

  const saveRecord = async () => {
    if (!requireAdminUnlocked()) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (drawerMode === "create") {
        const record = await getProvider().create(buildPayload(values));
        message.success(`已新增「${record.university}」。`);
      } else if (currentRecord) {
        const record = await getProvider().update(currentRecord.id, buildPayload(values, currentRecord));
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
    { title: "高校名称", dataIndex: "university", width: 150, render: (value) => <Text strong>{value}</Text> },
    { title: "覆盖状态", dataIndex: "coverageStatus", width: 112, render: statusTag },
    { title: "客户归属", dataIndex: "customerStatus", width: 170, ellipsis: true, render: (value) => value || "-" },
    { title: "产品线", dataIndex: "productTags", width: 145, ellipsis: true, render: joinList },
    { title: "资源集群", dataIndex: "resourceType", width: 150, ellipsis: true, render: (value, record) => value || joinList(record.productTags) || "-" },
    { title: "部署状态", dataIndex: "businessScenario", width: 130, ellipsis: true, render: (value) => value || "-" },
    { title: "设备型号", dataIndex: "deviceModel", width: 130, ellipsis: true, render: (value, record) => value || joinList(record.equipmentDetails) || "-" },
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
    <Layout className="admin-layout">
      <Sider
        className="admin-sider"
        width={208}
        collapsedWidth={0}
        collapsed={collapsed}
        breakpoint="lg"
        onBreakpoint={(broken) => setCollapsed(broken)}
      >
        <div className="admin-brand">
          <div className="admin-brand-mark"><BookOutlined /></div>
          <div><strong>云数智管</strong><span>后台管理系统</span></div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={["university-info"]}
          defaultOpenKeys={["university-management"]}
          items={menuItems}
          onClick={({ key }) => {
            if (key !== "university-info") message.info("该模块正在规划中。");
          }}
        />
        <Button className="collapse-footer" type="text" icon={<LeftOutlined />} onClick={() => setCollapsed(true)}>
          收起菜单
        </Button>
      </Sider>

      <Layout>
        <Header className="admin-header">
          <Space size={16} className="admin-header-left">
            <Button
              type="text"
              aria-label={collapsed ? "展开菜单" : "收起菜单"}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((value) => !value)}
            />
            <Breadcrumb items={[{ title: "后台管理" }, { title: "高校管理" }, { title: "高校信息维护" }]} />
          </Space>
          <Space size={16}>
            {screens.md ? <Input className="header-search" prefix={<SearchOutlined />} placeholder="搜索菜单、功能、数据..." readOnly /> : null}
            <Tooltip title="消息通知"><Button type="text" icon={<BellOutlined />} /></Tooltip>
            <Tooltip title="帮助中心"><Button type="text" icon={<QuestionCircleOutlined />} /></Tooltip>
            <Dropdown menu={{ items: [{ key: "logout", icon: <LockOutlined />, label: "退出管理模式", onClick: () => void logoutAdmin() }] }}>
              <Button className="admin-user" type="text">
                <Avatar size="small" icon={<UserOutlined />} />
                {screens.md ? <span>系统管理员</span> : null}
                <MoreOutlined />
              </Button>
            </Dropdown>
          </Space>
        </Header>

        <Content className="admin-content">
          <section className="page-heading">
            <div>
              <Title level={2}>高校信息维护</Title>
              <Paragraph>维护高校基础信息、客户归属、资源集群与部署状态，支持批量导入导出。</Paragraph>
            </div>
            <Tag color={adminUnlocked ? "success" : "default"}>{adminUnlocked ? "管理模式已解锁" : "只读模式"}</Tag>
          </section>

          <Row gutter={[16, 16]} className="summary-row">
            {[
              { label: "总记录", value: records.length, icon: <FileTextFilled />, tone: "blue" },
              { label: "覆盖省份", value: overview.provinceCount, icon: <EnvironmentFilled />, tone: "green" },
              { label: "已部署", value: overview.deployedCount, icon: <HddOutlined />, tone: "blue" },
              { label: "待补充", value: overview.incompleteCount, icon: <ContainerOutlined />, tone: "orange" },
              { label: "当前筛选", value: filteredRecords.length, icon: <FilterFilled />, tone: "purple" },
            ].map(({ label, value, icon, tone }) => (
              <Col xs={24} sm={12} lg={8} xl={4} flex="1 1 190px" key={label}>
                <Card className="summary-card" size="small">
                  <div className="summary-card-content">
                    <Statistic title={label} value={value} valueStyle={{ color: "#1d2939" }} />
                    <span className={`summary-icon summary-icon-${tone}`} aria-hidden="true">{icon}</span>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <Card className="university-workbench" bordered={false}>
            <Flex className="workbench-title" justify="space-between" align="center" wrap gap={16}>
              <Flex className="table-title-filters" align="center" wrap gap={12}>
                <Input
                  allowClear
                  className="table-title-search"
                  prefix={<SearchOutlined />}
                  placeholder="搜索高校名称、ID、设备型号等"
                  value={filters.keyword}
                  onChange={(event) => setFilters((value) => ({ ...value, keyword: event.target.value }))}
                />
                <Select className="table-toolbar-select" allowClear placeholder="全部省份" value={filters.province} options={provinceOptions.map((value) => ({ value, label: value }))} onChange={(province) => setFilters((value) => ({ ...value, province }))} />
                <Select className="table-toolbar-select" allowClear placeholder="全部产品" value={filters.product} options={productOptions.map((value) => ({ value, label: value }))} onChange={(product) => setFilters((value) => ({ ...value, product }))} />
                <Select className="table-toolbar-select" allowClear placeholder="部署状态" value={filters.coverageStatus} options={COVERAGE_STATUSES.map((value) => ({ value, label: value }))} onChange={(coverageStatus) => setFilters((value) => ({ ...value, coverageStatus }))} />
                <Button icon={<ReloadOutlined />} onClick={() => setFilters(EMPTY_FILTERS)}>重置</Button>
                <Button danger type="text" icon={<DeleteOutlined />} disabled={!adminUnlocked || selectedIds.length === 0} onClick={deleteSelected}>删除已选 {selectedIds.length || ""}</Button>
              </Flex>
              <Space wrap>
                <Button type="primary" icon={<PlusOutlined />} disabled={!adminUnlocked} onClick={() => openDrawer("create")}>新增高校</Button>
                <Upload {...uploadProps}><Button icon={<ImportOutlined />} loading={importing} disabled={!adminUnlocked}>导入 Excel</Button></Upload>
                <Button icon={<DownloadOutlined />} disabled={!adminUnlocked} onClick={() => downloadWorkbook("高校信息维护清单.xlsx", buildDeliveriesWorkbook(records))}>导出 Excel</Button>
                <Button icon={<FileExcelOutlined />} onClick={() => downloadWorkbook("高校信息维护清单-模板.xlsx", buildExcelTemplate())}>下载模板</Button>
              </Space>
            </Flex>

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
          </Card>
        </Content>
      </Layout>

      <Drawer
        title={drawerMode === "create" ? "新增高校" : drawerMode === "edit" ? "编辑高校信息" : "高校信息详情"}
        open={drawerOpen}
        width={screens.md ? 620 : "100%"}
        onClose={() => setDrawerOpen(false)}
        extra={drawerMode === "detail" ? <Button type="primary" disabled={!adminUnlocked} onClick={() => setDrawerMode("edit")}>编辑</Button> : null}
        footer={formDisabled ? null : <Flex justify="flex-end" gap={8}><Button onClick={() => setDrawerOpen(false)}>取消</Button><Button type="primary" loading={saving} onClick={() => void saveRecord()}>保存</Button></Flex>}
      >
        <Form form={form} layout="vertical" disabled={formDisabled} initialValues={EMPTY_FORM}>
          <Form.Item label="学校 ID" name="schoolId"><Input placeholder="如 1001" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="所在省份" name="province" rules={[{ required: true, message: "请选择所在省份" }]}><Select placeholder="选择省份" options={provinceOptions.map((value) => ({ value, label: value }))} /></Form.Item></Col>
            <Col span={12}><Form.Item label="高校名称" name="university" rules={[{ required: true, whitespace: true, message: "请输入高校名称" }]}><Input placeholder="如：深圳大学" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="覆盖状态" name="coverageStatus"><Select allowClear placeholder="选择状态" options={COVERAGE_STATUSES.map((value) => ({ value, label: value }))} /></Form.Item></Col>
            <Col span={12}><Form.Item label="部署年份" name="purchaseYear"><Input placeholder="如：2025年" /></Form.Item></Col>
          </Row>
          <Form.Item label="客户归属" name="customerStatus"><Input placeholder="如：信息中心" /></Form.Item>
          <Form.Item label="产品线" name="purchaseTags"><Input placeholder="多个标签使用分号分隔" /></Form.Item>
          <Form.Item label="资源集群" name="resourceType"><Input placeholder="如：信创 / VMware" /></Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item label="资源规模" name="resourceAmount"><InputNumber min={0} placeholder="请输入数量" style={{ width: "100%" }} /></Form.Item></Col>
            <Col span={12}><Form.Item label="资源单位" name="resourceUnit"><Input placeholder="如：节点、套、TB" /></Form.Item></Col>
          </Row>
          <Form.Item label="部署状态说明" name="businessScenario"><Input placeholder="如：教务系统云化" /></Form.Item>
          <Form.Item label="核心价值点" name="coreValue"><Input.TextArea rows={3} placeholder="填写业务收益或项目价值" /></Form.Item>
          <Form.Item label="设备型号" name="deviceModel"><Input placeholder="多个型号使用分号分隔" /></Form.Item>
          <Form.Item label="中标链接" name="bidLink"><Input placeholder="https://" /></Form.Item>
          <Form.Item label="备注" name="notes"><Input.TextArea rows={3} placeholder="补充说明" /></Form.Item>
        </Form>
      </Drawer>

      <Modal title="验证管理权限" open={authOpen} closable={false} footer={null} centered>
        <Paragraph type="secondary">输入管理密码后可新增、编辑、导入、导出和删除高校信息。</Paragraph>
        <Space.Compact block>
          <Input.Password autoFocus value={adminPassword} placeholder="管理密码" onChange={(event) => setAdminPassword(event.target.value)} onPressEnter={() => void unlockAdmin()} />
          <Button type="primary" loading={authLoading} onClick={() => void unlockAdmin()}>验证</Button>
        </Space.Compact>
      </Modal>
    </Layout>
  );
}

export function AdminDataEntry() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: "#1677ff", borderRadius: 8, fontFamily: "PingFang SC, Microsoft YaHei, sans-serif", colorBgLayout: "#f5f7fa" }, components: { Menu: { itemBorderRadius: 6, itemHeight: 40 }, Table: { headerBg: "#f8fafc", headerColor: "#475467" } } }}>
      <AntApp><AdminDataEntryContent /></AntApp>
    </ConfigProvider>
  );
}
