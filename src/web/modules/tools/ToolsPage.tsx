// ─── Tools Page ──────────────────────────────────────────────────────────────
// Route: /tools — Full tools management page with grid view.
// Click on a tool → navigates to /tools/:id (separate page, not dialog).

import { AddCircle, Bolt, Magnifier } from "@solar-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AgentTool } from "src/common/types";
import RenderIf from "src/components/ui/RenderIf";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { useAppDispatch, useAppSelector } from "src/store/store";
import { fetchTools } from "./common/toolsSlice";
import { AddToolPopover } from "./components/AddToolDialog";
import { ToolGridItem } from "./components/ToolGridItem";

export default function ToolsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const tools = useAppSelector((s) => s.tools.items) as AgentTool[];

  const [search, setSearch] = useState("");

  useEffect(() => {
    dispatch(fetchTools());
  }, [dispatch]);

  // Filtered tools
  const filteredTools = useMemo(() => {
    if (!search.trim()) return tools;
    const q = search.trim().toLowerCase();
    return tools.filter(
      (t) => (t.label ?? "").toLowerCase().includes(q) || (t.name ?? "").toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
    );
  }, [tools, search]);

  // Separate custom and builtin
  const customTools = useMemo(() => filteredTools.filter((t) => !t.isBuiltin), [filteredTools]);
  const builtinTools = useMemo(() => filteredTools.filter((t) => t.isBuiltin), [filteredTools]);

  const handleToolClick = (toolId: string) => {
    navigate(`/tools/${toolId}`);
  };

  return (
    <div className="py-8 px-10">
      {/* Header */}
      <div className="flex items-start justify-between mb-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
            <Bolt width={22} height={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-main m-0 leading-tight">Tools</h1>
            <p className="text-sm text-muted mt-1">
              Manage your agent tools
              <span className="inline-flex items-center ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">{tools.length}</span>
            </p>
          </div>
        </div>
        <AddToolPopover onCreated={(id) => navigate(`/tools/${id}`)}>
          <Button variant="primary" size="md" icon={<AddCircle width={16} height={16} />}>
            New Tool
          </Button>
        </AddToolPopover>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* Search */}
        <div className="relative max-w-[360px] mb-8">
          <Magnifier width={16} height={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-[1]" />
          <Input placeholder="Search tools…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>

        {/* Custom Tools Grid */}
        <RenderIf condition={customTools.length > 0}>
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider m-0 mb-4 flex items-center gap-2">
              Custom Tools
              <span className="text-[10px] font-bold bg-surface-raised text-muted py-0.5 px-2 rounded-full normal-case tracking-normal">
                {customTools.length}
              </span>
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {customTools.map((tool) => (
                <ToolGridItem key={tool.id} tool={tool} onClick={() => handleToolClick(tool.id)} />
              ))}
            </div>
          </div>
        </RenderIf>

        {/* Builtin Tools Grid */}
        <RenderIf condition={builtinTools.length > 0}>
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-muted uppercase tracking-wider m-0 mb-4 flex items-center gap-2">
              Built-in Tools
              <span className="text-[10px] font-bold bg-surface-raised text-muted py-0.5 px-2 rounded-full normal-case tracking-normal">
                {builtinTools.length}
              </span>
            </h2>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
              {builtinTools.map((tool) => (
                <ToolGridItem key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        </RenderIf>

        {/* Empty state */}
        <RenderIf condition={filteredTools.length === 0}>
          <div className="flex flex-col items-center justify-center py-20 px-5">
            <div className="w-14 h-14 rounded-2xl bg-surface-raised flex items-center justify-center mb-4">
              <Bolt width={24} height={24} className="text-muted" />
            </div>
            <RenderIf
              condition={search.trim().length > 0}
              fallback={
                <div className="text-center">
                  <p className="text-sm font-semibold text-main mb-1">No tools yet</p>
                  <p className="text-xs text-muted">Create your first tool to get started.</p>
                </div>
              }
            >
              <div className="text-center">
                <p className="text-sm font-semibold text-main mb-1">No results</p>
                <p className="text-xs text-muted">No tools matching "{search}"</p>
              </div>
            </RenderIf>
          </div>
        </RenderIf>
      </div>
    </div>
  );
}
