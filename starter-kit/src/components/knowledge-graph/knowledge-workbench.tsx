"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
const DEFAULT_CORE_DEFECT_COUNT = 5
const DEFAULT_FIRST_HOP_LIMIT = 100

const globalDegreeMap = new Map<string, number>()
for (const link of knowledgeLinks) {
  globalDegreeMap.set(link.source, (globalDegreeMap.get(link.source) ?? 0) + 1)
  globalDegreeMap.set(link.target, (globalDegreeMap.get(link.target) ?? 0) + 1)
}

const nodeById = new Map(knowledgeNodes.map((node) => [node.id, node]))
const nodeIdToLabel = new Map(knowledgeNodes.map((n) => [n.id, n.label]))

// pre-sorted nodes by degree descending
const nodesSortedByDegree = [...knowledgeNodes].sort(
  (a, b) =>
    (globalDegreeMap.get(b.id) ?? 0) - (globalDegreeMap.get(a.id) ?? 0) ||
    a.label.localeCompare(b.label, "zh-Hans-CN")
)

// pre-built adjacency: nodeId → links[]
const nodeLinksMap = new Map<string, typeof knowledgeLinks>()
for (const link of knowledgeLinks) {
  if (!nodeLinksMap.has(link.source)) nodeLinksMap.set(link.source, [])
  if (!nodeLinksMap.has(link.target)) nodeLinksMap.set(link.target, [])
  nodeLinksMap.get(link.source)!.push(link)
  nodeLinksMap.get(link.target)!.push(link)
}

const defectNodesSortedByDegree = nodesSortedByDegree.filter(
  (node) => node.type === "defect"
)

interface GraphSeedConfig {
  coreDefectCount: number
  hopCount: number
  totalNodeLimit: number
}

type GraphSeedConfigKey = keyof GraphSeedConfig

function normalizeGraphSeedConfig(config: GraphSeedConfig): GraphSeedConfig {
  const totalNodeLimit = clampInt(
    config.totalNodeLimit,
    0,
    knowledgeNodes.length
  )
  if (totalNodeLimit === 0) {
    return { coreDefectCount: 0, hopCount: 0, totalNodeLimit: 0 }
  }
  const coreDefectCount = clampInt(
    config.coreDefectCount,
    1,
    Math.min(defectNodesSortedByDegree.length, totalNodeLimit)
  )
  const hopCount = Math.max(0, Math.floor(config.hopCount))

  return {
    coreDefectCount,
    hopCount,
    totalNodeLimit: Math.max(totalNodeLimit, coreDefectCount),
  }
}

function buildSeedGraph(config: GraphSeedConfig) {
  const normalized = normalizeGraphSeedConfig(config)
  if (normalized.totalNodeLimit === 0) {
    return {
      ...normalized,
      coreNodes: [] as typeof knowledgeNodes,
      coreNodeIds: new Set<string>(),
      visibleSeedIds: new Set<string>(),
    }
  }
  const coreNodes = defectNodesSortedByDegree.slice(
    0,
    normalized.coreDefectCount
  )
  const coreNodeIds = new Set(coreNodes.map((node) => node.id))
  const visibleSeedIds = new Set(coreNodeIds)

  let frontier = coreNodes

  for (
    let depth = 1;
    depth <= normalized.hopCount &&
    frontier.length > 0 &&
    visibleSeedIds.size < normalized.totalNodeLimit;
    depth++
  ) {
    const nextHopMap = new Map<string, (typeof knowledgeNodes)[number]>()

    for (const node of frontier) {
      for (const link of nodeLinksMap.get(node.id) ?? []) {
        const neighborId = link.source === node.id ? link.target : link.source
        if (visibleSeedIds.has(neighborId)) continue
        const neighborNode = nodeById.get(neighborId)
        if (neighborNode) {
          nextHopMap.set(neighborId, neighborNode)
        }
      }
    }

    const remainingSlots = normalized.totalNodeLimit - visibleSeedIds.size
    if (remainingSlots <= 0) break

    const nextHopNodes = [...nextHopMap.values()]
      .sort(
        (a, b) =>
          (globalDegreeMap.get(b.id) ?? 0) - (globalDegreeMap.get(a.id) ?? 0) ||
          a.label.localeCompare(b.label, "zh-Hans-CN")
      )
      .slice(0, remainingSlots)

    for (const node of nextHopNodes) {
      visibleSeedIds.add(node.id)
    }

    frontier = nextHopNodes
  }

  return {
    ...normalized,
    coreNodes,
    coreNodeIds,
    visibleSeedIds,
  }
}

export function KnowledgeWorkbench() {
  const [activeDocumentId, setActiveDocumentId] = useState(
    knowledgeDocuments[0].id
  )
  const [selectedNodeId, setSelectedNodeId] = useState(
    defectNodesSortedByDegree[0]?.id ?? knowledgeNodes[0]?.id ?? ""
  )
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null)
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [graphSearch, setGraphSearch] = useState("")
  const [graphSearchOpen, setGraphSearchOpen] = useState(false)
  const [graphSeedConfig, setGraphSeedConfig] = useState<GraphSeedConfig>(() =>
    normalizeGraphSeedConfig({
      coreDefectCount: DEFAULT_CORE_DEFECT_COUNT,
      hopCount: 1,
      totalNodeLimit: DEFAULT_CORE_DEFECT_COUNT + DEFAULT_FIRST_HOP_LIMIT,
    })
  )
  const [entityBrowserSearch, setEntityBrowserSearch] = useState("")
  const graphSearchRef = useRef<HTMLInputElement>(null)

  /* ── D: lazy expansion state ── */
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set()
  )

  const seedGraph = useMemo(
    () => buildSeedGraph(graphSeedConfig),
    [graphSeedConfig]
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
    const visibleIds = new Set<string>([
      ...seedGraph.visibleSeedIds,
      ...expandedNodeIds,
    ])
    const vNodes = knowledgeNodes.filter((n) => visibleIds.has(n.id))
    const filteredVisibleIds = new Set(
      vNodes
        .filter((node) => enabledTypes.has(node.type))
        .map((node) => node.id)
    )
    const filteredNodes = vNodes.filter((node) =>
      filteredVisibleIds.has(node.id)
    )
    const vLinks = knowledgeLinks.filter(
      (l) =>
        filteredVisibleIds.has(l.source) && filteredVisibleIds.has(l.target)
    )
    return { visibleNodes: filteredNodes, visibleLinks: vLinks }
  }, [enabledTypes, expandedNodeIds, seedGraph.visibleSeedIds])

  const handleGraphSeedConfigChange = useCallback(
    (key: GraphSeedConfigKey, rawValue: string) => {
      const parsedValue =
        rawValue.trim() === "" ? 0 : Number.parseInt(rawValue, 10)
      if (Number.isNaN(parsedValue)) return

      setGraphSeedConfig((prev) =>
        normalizeGraphSeedConfig({
          ...prev,
          [key]: parsedValue,
        })
      )
    },
    []
  )

  useEffect(() => {
    setExpandedNodeIds(new Set())
    setSelectedLinkId(null)
    setFocusNodeId(null)
    setSelectedNodeId((prev) =>
      seedGraph.visibleSeedIds.has(prev)
        ? prev
        : (seedGraph.coreNodes[0]?.id ?? knowledgeNodes[0]?.id ?? prev)
    )
  }, [seedGraph.coreNodes, seedGraph.visibleSeedIds])

  useEffect(() => {
    if (visibleNodes.length === 0) return
    if (visibleNodes.some((node) => node.id === selectedNodeId)) return

    setSelectedNodeId(visibleNodes[0].id)
    setSelectedLinkId(null)
  }, [selectedNodeId, visibleNodes])

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
    setSelectedLinkId(null)
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

  /* When a link is selected from the details panel, highlight its two endpoints */
  const linkHighlightNodes = useMemo<Set<string> | null>(() => {
    if (!selectedLink) return null
    return new Set([selectedLink.source, selectedLink.target])
  }, [selectedLink])

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

  const filteredBrowserNodes = useMemo(() => {
    const q = entityBrowserSearch.trim()
    if (!q) return nodesSortedByDegree
    return nodesSortedByDegree.filter(
      (node) =>
        node.label.includes(q) ||
        (nodeTypeMeta[node.type]?.label ?? "").includes(q)
    )
  }, [entityBrowserSearch])

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
            <CardHeader className="border-b border-border/40 dark:border-white/8 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-foreground">
                    源文档
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    点击查看子图来源文档
                  </CardDescription>
                </div>
                <FileSearch className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
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
                            ? "border-cyan-500/30 bg-cyan-50 shadow-sm dark:bg-cyan-400/10 dark:shadow-[0_14px_30px_rgba(34,211,238,0.08)]"
                            : "border-border/40 bg-muted/30 hover:border-border/60 hover:bg-muted/50 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-white/14 dark:hover:bg-white/[0.05]"
                        )}
                        onClick={() => setActiveDocumentId(document.id)}
                        type="button"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="font-medium text-foreground">
                              {document.title}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {document.source} / {document.updatedAt}
                            </div>
                          </div>
                          {document.confidence != null && (
                            <div className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground dark:bg-white/10">
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
            <CardHeader className="border-b border-border/40 dark:border-white/8 pb-3">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg text-foreground">
                    文档内容
                  </CardTitle>
                  <CardDescription className="mt-0.5 text-muted-foreground">
                    {activeDocument.summary}
                  </CardDescription>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {activeDocument.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="rounded-full border-border/40 bg-muted/50 text-[11px] text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Sparkles className="h-5 w-5 shrink-0 text-cyan-600 dark:text-cyan-300" />
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-0">
              {activeDocument.pdfUrl ? (
                <PdfViewer url={activeDocument.pdfUrl} />
              ) : (
                <ScrollArea className="h-full p-4">
                  <div className="rounded-[20px] border border-border/40 bg-muted/20 px-4 py-3 dark:border-white/8 dark:bg-[#030712]/70">
                    <div className="space-y-4 text-sm leading-7 text-foreground/80 dark:text-slate-300">
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
            <CardHeader className="border-b border-border/40 dark:border-white/8 pb-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    D3 力导向子图 · 显示{" "}
                    <span className="font-semibold text-cyan-600 dark:text-cyan-300">
                      {visibleNodes.length}
                    </span>{" "}
                    / {knowledgeNodes.length} 节点 ·{" "}
                    <span className="font-semibold text-cyan-600 dark:text-cyan-300">
                      {visibleLinks.length}
                    </span>{" "}
                    / {knowledgeLinks.length} 边
                  </div>
                  <CardTitle className="text-2xl text-foreground">
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
                              ? "border-foreground/20 text-foreground dark:border-white/20"
                              : "border-border/30 text-muted-foreground opacity-40 dark:border-white/5"
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
                  <div className="text-right text-[11px] text-muted-foreground">
                    点击上方标签可开关对应实体类型的显示
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="relative flex-1 p-0">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.04),transparent_30%),linear-gradient(180deg,rgba(241,245,249,0.5),rgba(248,250,252,0.7))] dark:bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.46),rgba(2,6,23,0.82))]" />
              <div className="absolute inset-0">
                <ForceGraph
                  nodes={visibleNodes}
                  links={visibleLinks}
                  coreNodeIds={seedGraph.coreNodeIds}
                  selectedLinkId={selectedLinkId}
                  selectedNodeId={selectedNodeId}
                  focusNodeId={focusNodeId}
                  highlightNodes={linkHighlightNodes}
                  onSelectLink={setSelectedLinkId}
                  onSelectNode={handleSelectNode}
                  onExpandNode={handleExpandNode}
                  onResetExpand={handleResetExpand}
                  overlay={
                    <div className="pointer-events-none absolute inset-x-5 top-4 z-10 flex flex-wrap items-center justify-between gap-2">
                      <div className="pointer-events-auto flex flex-wrap items-center gap-2">
                        <FloatingBadge
                          label="当前选择"
                          value={selectedLink ? "关系详情" : selectedNode.label}
                        />
                        <FloatingBadge
                          label="交互"
                          value="单击选中 · 双击展开 · 拖拽移动"
                        />
                        <GraphSeedControls
                          config={graphSeedConfig}
                          onChange={handleGraphSeedConfigChange}
                        />
                      </div>
                      <div className="pointer-events-auto relative">
                        <div
                          className={cn(
                            "flex h-9 items-center gap-2 rounded-full border border-border/40 bg-white/80 backdrop-blur transition-all dark:border-white/10 dark:bg-black/35",
                            graphSearchOpen ? "w-56 px-3" : "w-auto px-3"
                          )}
                        >
                          <button
                            type="button"
                            className="shrink-0 text-muted-foreground transition hover:text-foreground"
                            onClick={() => {
                              setGraphSearchOpen((open) => !open)
                              if (!graphSearchOpen) {
                                setTimeout(
                                  () => graphSearchRef.current?.focus(),
                                  60
                                )
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
                              onChange={(event) =>
                                setGraphSearch(event.target.value)
                              }
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
                              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                            />
                          )}
                        </div>
                        {graphSearchOpen && graphSearchResults.length > 0 && (
                          <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-2xl border border-border/40 bg-card/95 shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#020817]/94 dark:shadow-[0_24px_50px_rgba(0,0,0,0.42)]">
                            {graphSearchResults.map((node) => {
                              const meta = nodeTypeMeta[node.type]
                              return (
                                <button
                                  key={node.id}
                                  type="button"
                                  className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-muted/60 dark:hover:bg-white/[0.06]"
                                  onClick={() => handleSearchSelect(node.id)}
                                >
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{
                                      backgroundColor: meta?.color,
                                    }}
                                  />
                                  <span className="truncate text-xs font-medium text-foreground">
                                    {node.label}
                                  </span>
                                  <span className="ml-auto text-[10px] text-muted-foreground">
                                    {meta?.label}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  }
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
            <CardHeader className="border-b border-border/40 dark:border-white/8 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-foreground">
                    实体浏览
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    当前可见实体，点击联动详情与图谱。
                  </CardDescription>
                </div>
                <DatabaseZap className="h-5 w-5 text-violet-600 dark:text-violet-300" />
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-2 p-3">
              <div className="relative shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="搜索实体名称..."
                  value={entityBrowserSearch}
                  onChange={(e) => setEntityBrowserSearch(e.target.value)}
                  className="h-8 w-full rounded-xl border border-border/40 bg-background/90 pl-8 pr-3 text-xs text-foreground outline-none transition placeholder:text-muted-foreground focus:border-cyan-500/40 dark:border-white/10 dark:bg-[#020817]/80"
                />
              </div>
              <ScrollArea className="min-h-0 flex-1 pr-1">
                <div className="space-y-2">
                  {filteredBrowserNodes.map((node) => {
                    const meta = nodeTypeMeta[node.type]
                    if (!meta) return null
                    const isSelected = node.id === selectedNode.id

                    return (
                      <button
                        key={node.id}
                        className={cn(
                          "flex w-full items-center justify-between rounded-2xl border px-3 py-3 text-left transition-all",
                          isSelected
                            ? "border-cyan-500/30 bg-cyan-50 dark:border-cyan-400/26 dark:bg-cyan-400/10"
                            : "border-border/40 bg-muted/30 hover:border-border/60 hover:bg-muted/50 dark:border-white/8 dark:bg-white/[0.03] dark:hover:border-white/14 dark:hover:bg-white/[0.05]"
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
                            <div className="truncate text-sm font-medium text-foreground">
                              {node.label}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
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
            <CardHeader className="border-b border-border/40 dark:border-white/8 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-foreground">
                    {selectedLink ? "关系详情" : "实体详情"}
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    {selectedLink
                      ? "显示当前关系的证据。"
                      : "显示当前节点的关联关系。"}
                  </CardDescription>
                </div>
                <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-300" />
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-4">
              <ScrollArea className="h-full pr-1">
                {selectedLink ? (
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
                    <div className="rounded-[24px] border border-amber-400/20 bg-amber-50/60 dark:border-amber-300/12 dark:bg-amber-300/8 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="rounded-full border-0 bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-300/18 dark:text-amber-200 dark:hover:bg-amber-300/18">
                          当前选中关系边
                        </Badge>
                      </div>
                      <div className="mt-4 text-2xl font-semibold text-foreground">
                        {labelForNode(selectedLink.source)}{" "}
                        {selectedLink.relation}{" "}
                        {labelForNode(selectedLink.target)}
                      </div>
                      {selectedLink.evidence && (
                        <p className="mt-4 text-sm leading-7 text-muted-foreground">
                          {selectedLink.evidence}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col justify-between rounded-[24px] border border-border/40 bg-muted/30 p-4 dark:border-white/8 dark:bg-white/[0.03]">
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
                        className="mt-4 inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/50 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted/80 dark:border-white/10 dark:bg-white/[0.05] dark:hover:bg-white/[0.08]"
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
                      <div className="rounded-[24px] border border-border/40 bg-muted/30 p-5 dark:border-white/8 dark:bg-white/[0.03]">
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
                          <span className="text-xs text-muted-foreground">
                            度 {globalDegreeMap.get(selectedNode.id) ?? 0}
                          </span>
                        </div>
                        <div className="mt-4 text-2xl font-semibold text-foreground">
                          {selectedNode.label}
                        </div>
                        {selectedNode.summary && (
                          <p className="mt-3 text-sm leading-7 text-muted-foreground">
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
                                className="rounded-[20px] border border-border/40 bg-muted/30 p-4 dark:border-white/8 dark:bg-white/[0.03]"
                              >
                                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                  {property.label}
                                </div>
                                <div className="mt-2 text-sm font-medium text-foreground">
                                  {property.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>

                    <div className="rounded-[24px] border border-border/40 bg-muted/30 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                        关联关系 (
                        {(nodeLinksMap.get(selectedNode.id) ?? []).length})
                      </div>
                      <div className="mt-4 space-y-3">
                        {(nodeLinksMap.get(selectedNode.id) ?? []).map(
                          (link) => (
                            <button
                              key={link.id}
                              className="w-full rounded-2xl border border-border/40 bg-muted/30 px-3 py-3 text-left transition hover:border-border/60 hover:bg-muted/50 dark:border-white/8 dark:bg-black/20 dark:hover:border-white/14 dark:hover:bg-white/[0.04]"
                              onClick={() => {
                                setSelectedLinkId(link.id)
                                // ensure both endpoints are visible in the graph
                                setExpandedNodeIds((prev) => {
                                  const next = new Set(prev)
                                  next.add(link.source)
                                  next.add(link.target)
                                  return next
                                })
                              }}
                              type="button"
                            >
                              <div className="text-sm font-medium text-foreground">
                                {link.relation}
                              </div>
                              <div className="mt-1 text-xs text-muted-foreground">
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
            <CardHeader className="border-b border-border/40 dark:border-white/8 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg text-foreground">
                    图谱快照
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    实体分布与证据链入口。
                  </CardDescription>
                </div>
                <Sparkles className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 p-4">
              <ScrollArea className="h-full pr-1">
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-border/40 bg-muted/30 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
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

                  <div className="rounded-[24px] border border-border/40 bg-muted/30 p-4 dark:border-white/8 dark:bg-white/[0.03]">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      证据链
                    </div>
                    <div className="mt-3 space-y-3">
                      {highlightedRelations.map((link) => (
                        <button
                          key={link.id}
                          className="block w-full rounded-2xl border border-border/40 bg-muted/30 px-3 py-3 text-left transition hover:border-border/60 hover:bg-muted/50 dark:border-white/8 dark:bg-black/20 dark:hover:border-white/14 dark:hover:bg-white/[0.04]"
                          onClick={() => setSelectedLinkId(link.id)}
                          type="button"
                        >
                          <div className="text-sm font-medium text-foreground">
                            {link.relation}
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
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

function clampInt(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.floor(value)))
}

function GraphSeedControls({
  config,
  onChange,
}: {
  config: GraphSeedConfig
  onChange: (key: GraphSeedConfigKey, rawValue: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[22px] border border-border/40 bg-white/80 px-3 py-2 text-xs backdrop-blur dark:border-white/10 dark:bg-black/35">
      <GraphSeedInput
        label="病害"
        max={defectNodesSortedByDegree.length}
        min={1}
        onChange={(value) => onChange("coreDefectCount", value)}
        value={config.coreDefectCount}
      />
      <GraphSeedInput
        label="跳数"
        max={knowledgeNodes.length}
        min={0}
        onChange={(value) => onChange("hopCount", value)}
        value={config.hopCount}
      />
      <GraphSeedSlider
        label="总数量"
        max={Math.min(knowledgeNodes.length, 800)}
        min={0}
        onChange={(value) => onChange("totalNodeLimit", value)}
        value={config.totalNodeLimit}
      />
    </div>
  )
}

function GraphSeedInput({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string
  max: number
  min: number
  onChange: (value: string) => void
  value: number
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        className="h-8 w-16 rounded-full border border-border/40 bg-background/90 px-3 text-center text-xs font-medium text-foreground outline-none transition focus:border-cyan-500/40 dark:border-white/10 dark:bg-[#020817]/80"
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        step={1}
        type="number"
        value={value}
      />
    </label>
  )
}

function GraphSeedSlider({
  label,
  max,
  min,
  onChange,
  value,
}: {
  label: string
  max: number
  min: number
  onChange: (value: string) => void
  value: number
}) {
  const [localText, setLocalText] = useState(String(value))

  // sync from parent when value changes externally
  useEffect(() => {
    setLocalText(String(value))
  }, [value])

  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        className="h-1.5 w-20 cursor-pointer appearance-none rounded-full bg-muted accent-cyan-500 dark:bg-white/10 sm:w-28"
        max={max}
        min={min}
        onChange={(event) => onChange(event.target.value)}
        step={1}
        type="range"
        value={value}
      />
      <input
        className="h-6 w-12 rounded-md border border-border/40 bg-background/90 text-center text-[11px] font-medium text-foreground outline-none transition focus:border-cyan-500/40 dark:border-white/10 dark:bg-[#020817]/80"
        max={max}
        min={min}
        onChange={(event) => {
          setLocalText(event.target.value)
          onChange(event.target.value)
        }}
        onBlur={() => {
          if (localText.trim() === "") {
            onChange("0")
          }
        }}
        step={1}
        type="text"
        inputMode="numeric"
        value={localText}
      />
    </label>
  )
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
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
        <span className="font-medium text-foreground/80 dark:text-slate-300">
          {label}
        </span>
        <span className="text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted dark:bg-white/[0.06]">
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
    <div className="flex h-9 items-center rounded-full border border-border/40 bg-white/80 px-3 text-xs backdrop-blur dark:border-white/10 dark:bg-black/35">
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-2 font-medium text-foreground">{value}</span>
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
