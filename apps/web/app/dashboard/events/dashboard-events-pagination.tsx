"use client";

import { Pagination } from "@heroui/react";
import { useRouter } from "next/navigation";

type DashboardEventsPaginationProps = {
  nextHref?: string;
  page: number;
  previousHref?: string;
  summary: string;
};

export function DashboardEventsPagination(
  props: DashboardEventsPaginationProps,
) {
  const router = useRouter();

  if (!props.previousHref && !props.nextHref) {
    return null;
  }

  function navigate(href: string | undefined) {
    if (href) {
      router.push(href);
    }
  }

  return (
    <Pagination className="dashboard-events-pagination" size="sm">
      <Pagination.Summary className="dashboard-events-pagination-summary">
        {props.summary}
      </Pagination.Summary>
      <Pagination.Content className="dashboard-events-pagination-content">
        <Pagination.Item>
          <Pagination.Previous
            isDisabled={!props.previousHref}
            onPress={() => navigate(props.previousHref)}
          >
            <Pagination.PreviousIcon />
            <span>Previous</span>
          </Pagination.Previous>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Link isActive>Page {props.page}</Pagination.Link>
        </Pagination.Item>
        <Pagination.Item>
          <Pagination.Next
            isDisabled={!props.nextHref}
            onPress={() => navigate(props.nextHref)}
          >
            <span>Next</span>
            <Pagination.NextIcon />
          </Pagination.Next>
        </Pagination.Item>
      </Pagination.Content>
    </Pagination>
  );
}
