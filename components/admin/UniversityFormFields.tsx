import { Col, Form, Input, InputNumber, Row, Select } from "antd";
import type { FormInstance } from "antd";
import { COVERAGE_STATUSES } from "@/lib/coverage/status";

export type UniversityFormValues = {
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

type UniversityFormFieldsProps = {
  form: FormInstance<UniversityFormValues>;
  provinceOptions: string[];
  disabled: boolean;
};

/** 高校信息维护的字段分组，仅包含领域字段，不承载保存和抽屉行为。 */
export function UniversityFormFields({ form, provinceOptions, disabled }: UniversityFormFieldsProps) {
  return (
    <Form form={form} layout="vertical" disabled={disabled}>
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
  );
}
