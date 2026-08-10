import { Card } from "antd";
import type { ReactNode } from "react";

type DataWorkbenchProps = {
  toolbar: ReactNode;
  children: ReactNode;
  className?: string;
};

/** 承载搜索、筛选、命令与表格内容的通用数据工作台容器。 */
export function DataWorkbench({ toolbar, children, className }: DataWorkbenchProps) {
  const classNames = ["management-workbench", className].filter(Boolean).join(" ");

  return (
    <Card className={classNames} bordered={false}>
      <div className="management-toolbar">{toolbar}</div>
      {children}
    </Card>
  );
}
