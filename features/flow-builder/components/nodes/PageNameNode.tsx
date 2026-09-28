"use client";

import type { NodeProps } from "@xyflow/react";
import type { PageNameFlowNode } from "../../types";
import { FlowNodeShell } from "./FlowNodeShell";

export default function PageNameNode({
  data,
  selected,
}: NodeProps<PageNameFlowNode>) {
  return (
    <FlowNodeShell
      selected={selected}
      accent="#8b0d64"
      badge="St"
      kind="Start"
      title={data.pageName || "Start"}
      subtitle={data.description || undefined}
      tag={data.isEntry ? "Entry" : undefined}
    />
  );
}
