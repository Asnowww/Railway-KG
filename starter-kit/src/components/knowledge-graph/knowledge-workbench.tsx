"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import dynamic from "next/dynamic"
import {
  ArrowRight,
  DatabaseZap,
  FileSearch,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react"

import type { KnowledgeNodeType } from "@/data/kg-mock"

import {
  knowledgeDocuments,
  knowledgeLinks,
  knowledgeNodes,
  nodeTypeMeta,
} from "@/data/kg-mock"

import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

const PdfViewer = dynamic(
  () => import("@/components/knowledge-graph/pdf-viewer"),
  { ssr: false }
)

const panelClassName =
  "rounded-[28px] border border-border/60 bg-card/95 shadow-[0_22px_70px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:border-white/8 dark:bg-[#0b1120]/92 dark:shadow-[0_22px_70px_rgba(0,0,0,0.34)]"

const ForceGraph = dynamic(
  () => import("./force-graph").then((module) => module.ForceGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[600px] items-center justify-center rounded-[24px] border border-dashed border-border/40 bg-muted/40 text-sm text-muted-foreground dark:border-white/10 dark:bg-black/20">
        正在加载图谱画布...
      </div>
    ),
  }
)

/* ── pre-computed degree map (from ALL links) ── */
const DEGREE_THRESHOLD = 3

const globalDegreeMap = new Map<string, number>()
for (const link of knowledgeLinks) {
  globalDegreeMap.set(link.source, (globalDegreeMap.get(link.source) ?? 0) + 1)
  globalDegreeMap.set(link.target, (globalDegreeMap.get(link.target) ?? 0) + 1)
}

const nodeIdToLabel = new Map(knowledgeNodes.map((n) => [n.id, n.label]))

// pre-sorted nodes by degree descending
const nodesSortedByDegree = [...knowledgeNodes].sort(
  (a, b) => (globalDegreeMap.get(b.id) ?? 0) - (globalDegreeMap.get(a.id) ?? 0)
)

// pre-built adjacency: nodeId → links[]
const nodeLinksMap = new Map<string, typeof knowledgeLinks>()
for (const link of knowledgeLinks) {
  if (!nodeLinksMap.has(link.source)) nodeLinksMap.set(link.source, [])
  if (!nodeLinksMap.has(link.target)) nodeLinksMap.set(link.target, [])
  nodeLinksMap.get(link.source)!.push(link)
  nodeLinksMap.get(link.target)!.push(link)
}

export function KnowledgeWorkbench() {
  const [activeDocumentId, setActiveDocumentId] = useState(
    knowledgeDocuments[0].id
  )
  const [selectedNodeId, setSelectedNodeId] = useState(
    knowledgeNodes[0]?.id ?? ""
  )
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [graphSearch, setGraphSearch] = useState("")
  const [graphSearchOpen, setGraphSearchOpen] = useState(false)
  const graphSearchRef = useRef<HTMLInputElement>(null)

  /* ── D: lazy expansion state ── */
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set()
  )

  /* ── E: type filter state ── */
  const [enabledTypes, setEnabledTypes] = useState<Set<KnowledgeNodeType>>(
    () => new Set(Object.keys(nodeTypeMeta) as KnowledgeNodeType[])
  )

  const toggleType = useCallback((type: KnowledgeNodeType) => {
    setEnabledTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  /* ── compute visible nodes & links ── */
  const { visibleNodes, visibleLinks } = useMemo(() => {
    const visibleIds = new Set<string>()
    for (const node of knowledgeNodes) {
      if (!enabledTypes.has(node.type)) continue
      const degree = globalDegreeMap.get(node.id) ?? 0
      if (degree >= DEGREE_THRESHOLD || expandedNodeIds.has(node.id)) {
        visibleIds.add(node.id)
      }
    }
    const vNodes = knowledgeNodes.filter((n) => visibleIds.has(n.id))
    const vLinks = knowledgeLinks.filter(
      (l) => visibleIds.has(l.source) && visibleIds.has(l.target)
    )
    return { visibleNodes: vNodes, visibleLinks: vLinks }
  }, [enabledTypes, expandedNodeIds])

  /* ── expand handler (double-click in graph) ── */
  const handleExpandNode = useCallback((nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev)
      for (const link of knowledgeLinks) {
        if (link.source === nodeId) next.add(link.target)
        if (link.target === nodeId) next.add(link.source)
      }
      return next
    })
  }, [])

  /* ── reset handler (double-click empty space) ── */
  const handleResetExpand = useCallback(() => {
    setExpandedNodeIds(new Set())
  }, [])

  /* ── search ── */
  const graphSearchResults = useMemo(
    () =>
      graphSearch.trim()
        ? knowledgeNodes
            .filter(
              (node) =>
                node.label.includes(graphSearch.trim()) ||
                (nodeTypeMeta[node.type]?.label ?? "").includes(
                  graphSearch.trim()
                )
            )
            .slice(0, 20)
        : [],
    [graphSearch]
  )

  const handleSelectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
    setSelectedLinkId(null)
  }, [])

  const activeDocument = useMemo(
    () =>
      knowledgeDocuments.find((document) => document.id === activeDocumentId) ??
      knowledgeDocuments[0],
    [activeDocumentId]
  )

  const selectedNode = useMemo(
    () =>
      knowledgeNodes.find((node) => node.id === selectedNodeId) ??
      knowledgeNodes[0] ?? {
        id: "",
        label: "未选择",
        type: "defect" as const,
      },
    [selectedNodeId]
  )

  const selectedLink = useMemo(
    () =>
      selectedLinkId
        ? (knowledgeLinks.find((link) => link.id === selectedLinkId) ?? null)
        : null,
    [selectedLinkId]
  )

  const nodeDistribution = useMemo(
    () =>
      Object.entries(
        knowledgeNodes.reduce<Record<string, number>>((acc, node) => {
          acc[node.type] = (acc[node.type] ?? 0) + 1
          return acc
        }, {})
      ),
    []
  )

  const highlightedRelations = useMemo(() => knowledgeLinks.slice(0, 6), [])

  /* ── search result click → ensure visible + focus ── */
  const handleSearchSelect = useCallback((nodeId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev)
      next.add(nodeId)
      for (const link of knowledgeLinks) {
        if (link.source === nodeId) next.add(link.target)
        if (link.target === nodeId) next.add(link.source)
      }
      return next
    })
    setSelectedNodeId(nodeId)
    setSelectedLinkId(null)
    setFocusNodeId(null)
    requestAnimationFrame(() => setFocusNodeId(nodeId))
    setGraphSearch("")
    setGraphSearchOpen(false)
  }, [])

  return (
    <section className="relative overflow-hidden bg-background text-foreground dark:bg-[#050816]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.06),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(124,58,237,0.06),transparent_24%),radial-gradient(circle_at_bottom,rgba(34,197,94,0.04),transparent_30%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(124,58,237,0.18),transparent_24%),radial-gradient(circle_at_bottom,rgba(34,197,94,0.1),transparent_30%)]" />
      <div className="container relative px-4 py-6 lg:px-6 lg:py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            轨道病害图谱工作台
          </h1>
        </div>

        <div className="grid gap-4 xl:grid-cols-12">
          {/* ── 源文档 ── */}
          <Card
            className={cn(
              panelClassName,
              "flex h-[520px] flex-col xl:col-span-4"
            )}
          >
            <CardHeader className="border-b border-white/8 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-white">源文档</CardTitle>
                  <CardDescription className="text-slate-400">
                    保留可点击的文档列表。
                  </CardDescription>
                </div>
                <FileSearch className="h-5 w-5 text-cyan-300" />
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-3">
              <ScrollArea className="h-full pr-1">
                <div className="space-y-2">
                  {knowledgeDocuments.map((document) => {
                    const isActive = document.id === activeDocument.id
                    return (
                      <button
                        key={document.id}
                        className={cn(
                          "w-full rounded-2xl border px-4 py-3 text-left transition-all",
                          isActive
                            ? "border-cyan-400/30 bg-cyan-400/10 shadow-[0_14px_30px_rgba(34,211,238,0.08)]"
                            : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]"
                        )}
                        onClick={() => setActiveDocumentId(document.id)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-medium text-white">
                              {document.title}
                            </div>
                            <div className="text-xs text-slate-400">
                              {document.source} / {document.updatedAt}
                            </div>
                          </div>
                          {document.confidence != null && (
                            <div className="rounded-full bg-white/10 px-2 py-1 text-xs font-medium text-slate-200">
                              {(document.confidence * 100).toFixed(0)}%
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* ── 文档内容 ── */}
          <Card
            className={cn(
              panelClassName,
              "flex h-[520px] flex-col xl:col-span-8"
            )}
          >
            <CardHeader className="border-b border-white/8 pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg text-white">文档内容</CardTitle>
                  <CardDescription className="mt-0.5 text-slate-400">
                    {activeDocument.summary}
                  </CardDescription>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {activeDocument.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="rounded-full border-white/10 bg-white/[0.04] text-[11px] text-slate-400"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Sparkles className="h-5 w-5 shrink-0 text-cyan-300" />
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-0">
              {activeDocument.pdfUrl ? (
                <PdfViewer url={activeDocument.pdfUrl} />
              ) : (
                <ScrollArea className="h-full p-4">
                  <div className="rounded-[20px] border border-white/8 bg-[#030712]/70 px-4 py-3">
                    <div className="space-y-4 text-sm leading-7 text-slate-300">
                      {activeDocument.text.split("\n\n").map((paragraph) => (
                        <p key={paragraph.slice(0, 24)}>
                          <HighlightedText
                            text={paragraph}
                            onClickEntity={(nodeId) => {
                              setExpandedNodeIds(
                                (prev) => new Set([...prev, nodeId])
                              )
                              setSelectedNodeId(nodeId)
                              setSelectedLinkId(null)
                              setFocusNodeId(null)
                              requestAnimationFrame(() =>
                                setFocusNodeId(nodeId)
                              )
                            }}
                          />
                        </p>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* ── 力导向子图 ── */}
          <Card
            className={cn(
              panelClassName,
              "flex h-[720px] flex-col xl:col-span-12"
            )}
          >
            <CardHeader className="border-b border-white/8 pb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="text-sm text-slate-400">
                    D3 力导向子图 · 显示{" "}
                    <span className="font-semibold text-cyan-300">
                      {visibleNodes.length}
                    </span>{" "}
                    / {knowledgeNodes.length} 节点 ·{" "}
                    <span className="font-semibold text-cyan-300">
                      {visibleLinks.length}
                    </span>{" "}
                    / {knowledgeLinks.length} 边
                  </div>
                  <CardTitle className="text-2xl text-white">
                    轨道病害关联子图
                  </CardTitle>
                </div>
                {/* ── E: type filter toggles ── */}
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {(
                      Object.entries(nodeTypeMeta) as [
                        KnowledgeNodeType,
                        (typeof nodeTypeMeta)[KnowledgeNodeType],
                      ][]
                    ).map(([type, meta]) => {
                      const isOn = enabledTypes.has(type)
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleType(type)}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition",
                            isOn
                              ? "border-white/20 text-white"
                              : "border-white/5 text-slate-600 opacity-40"
                          )}
                          style={{
                            backgroundColor: isOn ? meta.tint : "transparent",
                          }}
                        >
                          {meta.label}
                        </button>
                      )
                    })}
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    点击上方标签可开关对应实体类型的显示
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative flex-1 p-0">
              <div className="pointer-events-none absolute inset-x-5 top-5 z-10 flex flex-wrap items-start justify-between gap-2">
                <div className="pointer-events-auto flex flex-wrap gap-2">
                  <FloatingBadge
                    label="当前选择"
                    value={selectedLink ? "关系详情" : selectedNode.label}
                  />
                  <FloatingBadge
                    label="交互"
                    value="单击选中 · 双击展开 · 拖拽移动"
                  />
                </div>
                <div className="pointer-events-auto relative">
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-full border border-white/10 bg-black/35 backdrop-blur transition-all",
                      graphSearchOpen ? "w-56 px-3 py-2" : "w-auto px-3 py-2"
                    )}
                  >
                    <button
                      type="button"
                      className="shrink-0 text-slate-400 transition hover:text-white"
                      onClick={() => {
                        setGraphSearchOpen((open) => !open)
                        if (!graphSearchOpen) {
                          setTimeout(() => graphSearchRef.current?.focus(), 60)
                        } else {
                          setGraphSearch("")
                        }
                      }}
                    >
                      <Search className="h-4 w-4" />
                    </button>
                    {graphSearchOpen && (
                      <input
                        ref={graphSearchRef}
                        type="text"
                        placeholder="搜索实体..."
                        value={graphSearch}
                        onChange={(event) => setGraphSearch(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Escape") {
                            setGraphSearch("")
                            setGraphSearchOpen(false)
                          }
                          if (
                            event.key === "Enter" &&
                            graphSearchResults.length > 0
                          ) {
                            handleSearchSelect(graphSearchResults[0].id)
                          }
                        }}
                        className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 focus:outline-none"
                      />
                    )}
                  </div>
                  {graphSearchOpen && graphSearchResults.length > 0 && (
                    <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-white/10 bg-[#020817]/94 shadow-[0_24px_50px_rgba(0,0,0,0.42)] backdrop-blur">
                      {graphSearchResults.map((node) => {
                        const meta = nodeTypeMeta[node.type]
                        return (
                          <button
                            key={node.id}
                            type="button"
                            className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-white/[0.06]"
                            onClick={() => handleSearchSelect(node.id)}
                          >
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: meta?.color }}
                            />
                            <span className="truncate text-xs font-medium text-white">
                              {node.label}
                            </span>
                            <span className="ml-auto text-[10px] text-slate-500">
                              {meta?.label}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.46),rgba(2,6,23,0.82))]" />
              <div className="absolute inset-0 px-3 pb-0 pt-14 sm:px-4">
                <ForceGraph
                  nodes={visibleNodes}
                  links={visibleLinks}
                  selectedLinkId={selectedLinkId}
                  selectedNodeId={selectedNodeId}
                  focusNodeId={focusNodeId}
                  onSelectLink={setSelectedLinkId}
                  onSelectNode={handleSelectNode}
                  onExpandNode={handleExpandNode}
                  onResetExpand={handleResetExpand}
                />
              </div>
            </CardContent>
          </Card>

          {/* ── 实体浏览 ── */}
          <Card
            className={cn(
              panelClassName,
              "flex h-[420px] flex-col xl:col-span-3"
            )}
          >
            <CardHeader className="border-b border-white/8 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-white">实体浏览</CardTitle>
                  <CardDescription className="text-slate-400">
                    当前可见实体，点击联动详情与图谱。
                  </CardDescription>
                </div>
                <DatabaseZap className="h-5 w-5 text-violet-300" />
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-3">
              <ScrollArea className="h-full pr-1">
                <div className="space-y-2">
                  {nodesSortedByDegree.map((node) => {
                    const meta = nodeTypeMeta[node.type]
                    if (!meta) return null
                    const isSelected = node.id === selectedNode.id

                    return (
                      <button
                        key={node.id}
                        className={cn(
                          "flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-all",
                          isSelected
                            ? "border-cyan-400/26 bg-cyan-400/10"
                            : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]"
                        )}
                        onClick={() => {
                          setExpandedNodeIds((prev) => {
                            const next = new Set(prev)
                            next.add(node.id)
                            for (const link of knowledgeLinks) {
                              if (link.source === node.id) next.add(link.target)
                              if (link.target === node.id) next.add(link.source)
                            }
                            return next
                          })
                          setSelectedNodeId(node.id)
                          setSelectedLinkId(null)
                          setFocusNodeId(null)
                          requestAnimationFrame(() => setFocusNodeId(node.id))
                        }}
                        type="button"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: meta.color }}
                          />
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-white">
                              {node.label}
                            </div>
                            <div className="truncate text-xs text-slate-400">
                              {meta.label} · 度{" "}
                              {globalDegreeMap.get(node.id) ?? 0}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* ── 实体/关系详情 ── */}
          <Card
            className={cn(
              panelClassName,
              "flex h-[420px] flex-col xl:col-span-5"
            )}
          >
            <CardHeader className="border-b border-white/8 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-white">
                    {selectedLink ? "关系详情" : "实体详情"}
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    {selectedLink
                      ? "显示当前关系的证据。"
                      : "显示当前节点的关联关系。"}
                  </CardDescription>
                </div>
                <ShieldAlert className="h-5 w-5 text-amber-300" />
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-4">
              <ScrollArea className="h-full pr-1">
                {selectedLink ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
                    <div className="rounded-[24px] border border-amber-300/12 bg-amber-300/8 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border-0 bg-amber-300/18 text-amber-200 hover:bg-amber-300/18">
                          当前选中关系边
                        </Badge>
                      </div>
                      <div className="mt-4 text-2xl font-semibold text-white">
                        {labelForNode(selectedLink.source)}{" "}
                        {selectedLink.relation}{" "}
                        {labelForNode(selectedLink.target)}
                      </div>
                      {selectedLink.evidence && (
                        <p className="mt-4 text-sm leading-7 text-slate-300">
                          {selectedLink.evidence}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col justify-between rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="space-y-4">
                        <DetailMetric
                          label="源节点"
                          value={labelForNode(selectedLink.source)}
                        />
                        <DetailMetric
                          label="目标节点"
                          value={labelForNode(selectedLink.target)}
                        />
                        <DetailMetric
                          label="关系类型"
                          value={selectedLink.relation}
                        />
                      </div>
                      <button
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.08]"
                        onClick={() => {
                          setSelectedNodeId(selectedLink.source)
                          setSelectedLinkId(null)
                        }}
                        type="button"
                      >
                        跳到源节点
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="space-y-4">
                      <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          {nodeTypeMeta[selectedNode.type] && (
                            <span
                              className="rounded-full px-3 py-1 text-xs font-semibold"
                              style={{
                                backgroundColor:
                                  nodeTypeMeta[selectedNode.type].tint,
                                color: nodeTypeMeta[selectedNode.type].color,
                              }}
                            >
                              {nodeTypeMeta[selectedNode.type].label}
                            </span>
                          )}
                          <span className="text-xs text-slate-500">
                            度 {globalDegreeMap.get(selectedNode.id) ?? 0}
                          </span>
                        </div>
                        <div className="mt-4 text-2xl font-semibold text-white">
                          {selectedNode.label}
                        </div>
                        {selectedNode.summary && (
                          <p className="mt-3 text-sm leading-7 text-slate-300">
                            {selectedNode.summary}
                          </p>
                        )}
                      </div>

                      {selectedNode.properties &&
                        selectedNode.properties.length > 0 && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {selectedNode.properties.map((property) => (
                              <div
                                key={property.label}
                                className="rounded-[20px] border border-white/8 bg-white/[0.03] p-4"
                              >
                                <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                                  {property.label}
                                </div>
                                <div className="mt-2 text-sm font-medium text-slate-200">
                                  {property.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>

                    <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                        关联关系 (
                        {(nodeLinksMap.get(selectedNode.id) ?? []).length})
                      </div>
                      <div className="mt-4 space-y-3">
                        {(nodeLinksMap.get(selectedNode.id) ?? []).map(
                          (link) => (
                            <button
                              key={link.id}
                              className="w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-left transition hover:border-white/14 hover:bg-white/[0.04]"
                              onClick={() => setSelectedLinkId(link.id)}
                              type="button"
                            >
                              <div className="text-sm font-medium text-white">
                                {link.relation}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                {labelForNode(link.source)} →{" "}
                                {labelForNode(link.target)}
                              </div>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* ── 图谱快照 ── */}
          <Card
            className={cn(
              panelClassName,
              "flex h-[420px] flex-col xl:col-span-4"
            )}
          >
            <CardHeader className="border-b border-white/8 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-white">图谱快照</CardTitle>
                  <CardDescription className="text-slate-400">
                    实体分布与证据链入口。
                  </CardDescription>
                </div>
                <Sparkles className="h-5 w-5 text-cyan-300" />
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-4">
              <ScrollArea className="h-full pr-1">
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      全量实体类型占比
                    </div>
                    <div className="mt-4 space-y-3">
                      {nodeDistribution.map(([type, count]) => {
                        const meta =
                          nodeTypeMeta[type as keyof typeof nodeTypeMeta]
                        if (!meta) return null
                        const percentage = Math.round(
                          (count / knowledgeNodes.length) * 100
                        )
                        return (
                          <ProgressRow
                            key={type}
                            color={meta.color}
                            label={meta.label}
                            percentage={percentage}
                            value={`${count}`}
                          />
                        )
                      })}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
                      证据链
                    </div>
                    <div className="mt-3 space-y-3">
                      {highlightedRelations.map((link) => (
                        <button
                          key={link.id}
                          className="block w-full rounded-2xl border border-white/8 bg-black/20 px-3 py-3 text-left transition hover:border-white/14 hover:bg-white/[0.04]"
                          onClick={() => setSelectedLinkId(link.id)}
                          type="button"
                        >
                          <div className="text-sm font-medium text-white">
                            {link.relation}
                          </div>
                          <div className="mt-1 text-xs text-slate-400">
                            {labelForNode(link.source)} {"→"}{" "}
                            {labelForNode(link.target)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

/* ────── helpers ────── */

function labelForNode(nodeId: string) {
  return nodeIdToLabel.get(nodeId) ?? nodeId
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-slate-200">{value}</div>
    </div>
  )
}

function ProgressRow({
  color,
  label,
  percentage,
  value,
}: {
  color: string
  label: string
  percentage: number
  value: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-slate-300">{label}</span>
        <span className="text-slate-500">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/[0.06]">
        <div
          className="h-2 rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

function FloatingBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/10 bg-black/35 px-3 py-2 text-xs backdrop-blur">
      <span className="text-slate-500">{label}</span>
      <span className="ml-2 font-medium text-slate-200">{value}</span>
    </div>
  )
}

const labelToNode = new Map(knowledgeNodes.map((n) => [n.label, n]))

const entityPattern = (() => {
  const labels = knowledgeNodes
    .map((n) => n.label)
    .filter((l) => l.length >= 2)
    .sort((a, b) => b.length - a.length)
    .slice(0, 500)
  if (labels.length === 0) return null
  return new RegExp(
    `(${labels.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "g"
  )
})()

function HighlightedText({
  text,
  onClickEntity,
}: {
  text: string
  onClickEntity: (nodeId: string) => void
}) {
  if (!entityPattern) return <span>{text}</span>

  const parts = text.split(entityPattern)

  return (
    <>
      {parts.map((part, index) => {
        const node = labelToNode.get(part)
        if (!node) return <span key={index}>{part}</span>

        const meta = nodeTypeMeta[node.type]
        if (!meta) return <span key={index}>{part}</span>

        return (
          <button
            key={index}
            type="button"
            className="cursor-pointer rounded px-0.5 font-medium transition-colors hover:brightness-125"
            style={{
              color: meta.color,
              backgroundColor: meta.tint,
            }}
            onClick={() => onClickEntity(node.id)}
          >
            {part}
          </button>
        )
      })}
    </>
  )
}
