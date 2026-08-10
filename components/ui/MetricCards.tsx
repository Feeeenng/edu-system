import { Card, Col, Row, Statistic } from "antd";
import type { ReactNode } from "react";

type MetricTone = "blue" | "green" | "orange" | "purple";

export type MetricCardItem = {
  label: string;
  value: number;
  icon: ReactNode;
  tone: MetricTone;
};

type MetricCardsProps = {
  items: MetricCardItem[];
};

/** 统一展示各业务页面传入的概览指标，不包含任何领域计算。 */
export function MetricCards({ items }: MetricCardsProps) {
  return (
    <Row gutter={[16, 16]} className="management-metrics">
      {items.map(({ label, value, icon, tone }) => (
        <Col xs={24} sm={12} lg={8} xl={4} flex="1 1 190px" key={label}>
          <Card className="management-metric-card" size="small">
            <div className="management-metric-content">
              <Statistic title={label} value={value} valueStyle={{ color: "#1d2939" }} />
              <span className={`management-metric-icon management-metric-icon-${tone}`} aria-hidden="true">{icon}</span>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
}
