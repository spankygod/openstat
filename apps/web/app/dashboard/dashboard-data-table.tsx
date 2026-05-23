import type { ReactNode } from "react";

import { DashboardEmptyState } from "./dashboard-empty-state";

type DataTableColumn<T> = {
  key: string;
  label: string;
  render: (item: T) => ReactNode;
};

export function DashboardDataTable<T extends { id: string }>(props: {
  columns: Array<DataTableColumn<T>>;
  empty: string;
  items: Array<T>;
}) {
  if (props.items.length === 0) {
    return <DashboardEmptyState>{props.empty}</DashboardEmptyState>;
  }

  return (
    <div className="dashboard-table-wrap">
      <table className="dashboard-table">
        <thead>
          <tr>
            {props.columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.items.map((item) => (
            <tr key={item.id}>
              {props.columns.map((column) => (
                <td key={column.key}>{column.render(item)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
