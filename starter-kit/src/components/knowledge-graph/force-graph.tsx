"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import * as d3 from "d3"
import { Maximize, Minimize, ZoomIn, ZoomOut } from "lucide-react"

import type { KnowledgeLink, KnowledgeNode } from "@/data/kg-mock"

import { knowledgeLinks, knowledgeNodes, nodeTypeMeta } from "@/data/kg-mock"

interface TooltipState {
  x: number
  y: number
  title: string
  subtitle: string
  meta: string
}

interface ViewState {
  zoom: number
  panX: number
  panY: number
}

interface ForceGraphProps {
  nodes?: KnowledgeNode[]
  links?: KnowledgeLink[]
  selectedNodeId: string | null
  selectedLinkId: string | null
  focusNodeId?: string | null
  onSelectNode: (nodeId: string) => void
  onSelectLink: (linkId: string) => void
}

type SimNode = KnowledgeNode &
  d3.SimulationNodeDatum & {
    radius: number
  }

type SimLink = d3.SimulationLinkDatum<SimNode> &
  KnowledgeLink & {
    source: SimNode | string
    target: SimNode | string
  }

const defaultNodes = knowledgeNodes
const defaultLinks = knowledgeLinks

export function ForceGraph({
  nodes = defaultNodes,
  links = defaultLinks,
  selectedNodeId,
  selectedLinkId,
  focusNodeId,
  onSelectNode,
  onSelectLink,
}: ForceGraphProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    SVGSVGElement,
    unknown
  > | null>(null)
  const viewStateRef = useRef<ViewState>({ zoom: 1, panX: 0, panY: 0 })
  const localNodesRef = useRef<SimNode[]>([])
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [_viewState, setViewState] = useState<ViewState>({
    zoom: 1,
    panX: 0,
    panY: 0,
  })

  const toggleFullscreen = useCallback(() => {
    const el = wrapperRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch(() => {})
    } else {
      document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  const preparedNodes = useMemo<SimNode[]>(
    () =>
      nodes.map((node) => ({
        ...node,
        radius: node.type === "fault" ? 30 : node.type === "risk" ? 24 : 20,
      })),
    [nodes]
  )

  useEffect(() => {
    const element = wrapperRef.current
    if (!element) return

    const resizeObserver = new ResizeObserver(([entry]) => {
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    })

    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [])

  const applyViewState = useCallback(
    (nextState: ViewState) => {
      const svgElement = svgRef.current
      const zoomBehavior = zoomBehaviorRef.current
      if (
        !svgElement ||
        !zoomBehavior ||
        !dimensions.width ||
        !dimensions.height
      ) {
        return
      }

      const x = (nextState.panX / 100) * dimensions.width
      const y = (nextState.panY / 100) * dimensions.height
      const transform = d3.zoomIdentity.translate(x, y).scale(nextState.zoom)

      d3.select(svgElement).call(zoomBehavior.transform, transform)
    },
    [dimensions.height, dimensions.width]
  )

  useEffect(() => {
    const svgElement = svgRef.current
    if (!svgElement || !dimensions.width || !dimensions.height) return

    const width = dimensions.width
    const height = dimensions.height
    const svg = d3.select(svgElement)
    svg.selectAll("*").remove()

    const localNodes = preparedNodes.map((node) => ({ ...node }))
    localNodesRef.current = localNodes
    const localLinks: SimLink[] = links.map((link) => ({ ...link }))

    const defs = svg.append("defs")
    defs
      .append("marker")
      .attr("id", "kg-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 22)
      .attr("refY", 0)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", "#64748b")
      .attr("d", "M0,-5L10,0L0,5")

    const root = svg
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("class", "h-full w-full")

    const canvas = root.append("g")

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.7, 1.8])
      .on("zoom", (event) => {
        canvas.attr("transform", event.transform.toString())
        viewStateRef.current = {
          zoom: Number(event.transform.k.toFixed(2)),
          panX: clampPan((event.transform.x / width) * 100),
          panY: clampPan((event.transform.y / height) * 100),
        }
      })
      .on("end", () => {
        setViewState({ ...viewStateRef.current })
      })

    zoomBehaviorRef.current = zoomBehavior
    root.call(zoomBehavior)

    const simulation = d3
      .forceSimulation<SimNode>(localNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(localLinks)
          .id((node) => node.id)
          .distance((link) =>
            link.relation === "发生于" || link.relation === "表现为" ? 132 : 152
          )
          .strength(0.68)
      )
      .force("charge", d3.forceManyBody().strength(-420))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3.forceCollide<SimNode>().radius((node) => node.radius + 30)
      )
      .force("x", d3.forceX(width / 2).strength(0.03))
      .force("y", d3.forceY(height / 2).strength(0.03))

    const linkSelection = canvas
      .append("g")
      .selectAll("line")
      .data(localLinks)
      .join("line")
      .attr("stroke", (link) =>
        link.id === selectedLinkId ? "#38bdf8" : "rgba(148, 163, 184, 0.45)"
      )
      .attr("stroke-width", (link) => (link.id === selectedLinkId ? 2.8 : 1.5))
      .attr("stroke-linecap", "round")
      .attr("marker-end", "url(#kg-arrow)")
      .style("cursor", "pointer")
      .on("mouseenter", (event, link) =>
        showLinkTooltip(event, link, setTooltip)
      )
      .on("mousemove", (event, link) =>
        showLinkTooltip(event, link, setTooltip)
      )
      .on("mouseleave", () => setTooltip(null))
      .on("click", (_event, link) => {
        onSelectLink(link.id)
      })

    const linkLabelSelection = canvas
      .append("g")
      .selectAll("text")
      .data(localLinks)
      .join("text")
      .attr("fill", "rgba(203, 213, 225, 0.72)")
      .attr("font-size", 11)
      .attr("text-anchor", "middle")
      .attr("class", "select-none")
      .text((link) => link.relation)

    const nodeSelection = canvas
      .append("g")
      .selectAll("g")
      .data(localNodes)
      .join("g")
      .style("cursor", "pointer")
      .call((selection) => {
        drag(simulation)(
          selection as d3.Selection<SVGGElement, SimNode, SVGGElement, unknown>
        )
      })
      .on("mouseenter", (event, node) =>
        showNodeTooltip(event, node, setTooltip)
      )
      .on("mousemove", (event, node) =>
        showNodeTooltip(event, node, setTooltip)
      )
      .on("mouseleave", () => setTooltip(null))
      .on("click", (_event, node) => {
        onSelectNode(node.id)
      })

    nodeSelection
      .append("circle")
      .attr("r", (node) => node.radius + 11)
      .attr("fill", (node) =>
        node.id === selectedNodeId
          ? nodeTypeMeta[node.type].tint
          : "rgba(255,255,255,0.02)"
      )

    nodeSelection
      .append("circle")
      .attr("r", (node) => node.radius)
      .attr("fill", (node) => nodeTypeMeta[node.type].color)
      .attr("fill-opacity", 0.94)
      .attr("stroke", (node) =>
        node.id === selectedNodeId ? "#e2e8f0" : "rgba(255,255,255,0.18)"
      )
      .attr("stroke-width", (node) => (node.id === selectedNodeId ? 3 : 1.8))
      .attr("filter", "drop-shadow(0px 18px 34px rgba(15, 23, 42, 0.32))")

    nodeSelection
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .attr("font-size", 12)
      .attr("font-weight", 600)
      .attr("fill", "#f8fafc")
      .text((node) => shorten(node.label))

    simulation.on("tick", () => {
      linkSelection
        .attr("x1", (link) => sourceNode(link).x ?? 0)
        .attr("y1", (link) => sourceNode(link).y ?? 0)
        .attr("x2", (link) => targetNode(link).x ?? 0)
        .attr("y2", (link) => targetNode(link).y ?? 0)

      linkLabelSelection
        .attr(
          "x",
          (link) => ((sourceNode(link).x ?? 0) + (targetNode(link).x ?? 0)) / 2
        )
        .attr(
          "y",
          (link) =>
            ((sourceNode(link).y ?? 0) + (targetNode(link).y ?? 0)) / 2 - 10
        )

      nodeSelection.attr(
        "transform",
        (node) => `translate(${node.x ?? 0},${node.y ?? 0})`
      )
    })

    applyViewState({ zoom: 1, panX: 0, panY: 0 })

    return () => {
      simulation.stop()
    }
  }, [
    applyViewState,
    dimensions.height,
    dimensions.width,
    links,
    onSelectLink,
    onSelectNode,
    preparedNodes,
    selectedLinkId,
    selectedNodeId,
  ])

  useEffect(() => {
    if (!focusNodeId || !dimensions.width || !dimensions.height) return

    const svgElement = svgRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!svgElement || !zoomBehavior) return

    const timer = setTimeout(() => {
      const target = localNodesRef.current.find(
        (node) => node.id === focusNodeId
      )
      if (!target || target.x == null || target.y == null) return

      const scale = 1.3
      const tx = dimensions.width / 2 - target.x * scale
      const ty = dimensions.height / 2 - target.y * scale
      const transform = d3.zoomIdentity.translate(tx, ty).scale(scale)

      d3.select(svgElement)
        .transition()
        .duration(600)
        .call(zoomBehavior.transform, transform)
    }, 400)

    return () => clearTimeout(timer)
  }, [focusNodeId, dimensions.width, dimensions.height])

  function updateViewState(patch: Partial<ViewState>) {
    const nextState = {
      ...viewStateRef.current,
      ...patch,
    }
    if (patch.panX !== undefined) nextState.panX = clampPan(patch.panX)
    if (patch.panY !== undefined) nextState.panY = clampPan(patch.panY)
    if (patch.zoom !== undefined) nextState.zoom = clampZoom(patch.zoom)

    viewStateRef.current = nextState
    setViewState(nextState)
    applyViewState(nextState)
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative h-full min-h-[600px] w-full ${isFullscreen ? "bg-[#020817]" : ""}`}
    >
      <svg ref={svgRef} aria-label="知识图谱力导向子图" role="img" />
      {tooltip ? (
        <div
          className="pointer-events-none absolute z-20 max-w-64 rounded-2xl border border-white/10 bg-[#020817]/94 px-4 py-3 shadow-[0_24px_50px_rgba(0,0,0,0.42)] backdrop-blur"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-sm font-semibold text-white">
            {tooltip.title}
          </div>
          <div className="mt-1 text-xs font-medium text-cyan-300">
            {tooltip.subtitle}
          </div>
          <div className="mt-2 text-xs leading-5 text-slate-300">
            {tooltip.meta}
          </div>
        </div>
      ) : null}

      <div className="absolute bottom-4 left-4 z-20 rounded-[22px] border border-white/10 bg-[#020817]/88 p-2 shadow-[0_20px_40px_rgba(0,0,0,0.4)] backdrop-blur">
        <button
          aria-label={isFullscreen ? "退出全屏" : "全屏查看"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-200 transition hover:bg-white/[0.1]"
          onClick={toggleFullscreen}
          type="button"
        >
          {isFullscreen ? (
            <Minimize className="h-4 w-4" />
          ) : (
            <Maximize className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="absolute bottom-4 right-4 z-20 flex gap-2 rounded-[22px] border border-white/10 bg-[#020817]/88 p-2 shadow-[0_20px_40px_rgba(0,0,0,0.4)] backdrop-blur">
        <button
          aria-label="放大图谱"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-200 transition hover:bg-white/[0.1]"
          onClick={() =>
            updateViewState({ zoom: viewStateRef.current.zoom + 0.1 })
          }
          type="button"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          aria-label="缩小图谱"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-200 transition hover:bg-white/[0.1]"
          onClick={() =>
            updateViewState({ zoom: viewStateRef.current.zoom - 0.1 })
          }
          type="button"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function drag(simulation: d3.Simulation<SimNode, SimLink>) {
  function dragStarted(
    event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>,
    node: SimNode
  ) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    node.fx = node.x
    node.fy = node.y
  }

  function dragged(
    event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>,
    node: SimNode
  ) {
    node.fx = event.x
    node.fy = event.y
  }

  function dragEnded(
    event: d3.D3DragEvent<SVGGElement, SimNode, SimNode>,
    node: SimNode
  ) {
    if (!event.active) simulation.alphaTarget(0)
    node.fx = null
    node.fy = null
  }

  return d3
    .drag<SVGGElement, SimNode>()
    .on("start", dragStarted)
    .on("drag", dragged)
    .on("end", dragEnded)
}

function sourceNode(link: SimLink) {
  return link.source as SimNode
}

function targetNode(link: SimLink) {
  return link.target as SimNode
}

function sourceLabel(link: SimLink) {
  return sourceNode(link).label
}

function targetLabel(link: SimLink) {
  return targetNode(link).label
}

function showNodeTooltip(
  event: MouseEvent,
  node: SimNode,
  setTooltip: (tooltip: TooltipState | null) => void
) {
  setTooltip({
    x: event.offsetX + 16,
    y: event.offsetY + 16,
    title: node.label,
    subtitle: `${nodeTypeMeta[node.type].label} / ${(node.confidence * 100).toFixed(0)}%`,
    meta: node.summary,
  })
}

function showLinkTooltip(
  event: MouseEvent,
  link: SimLink,
  setTooltip: (tooltip: TooltipState | null) => void
) {
  setTooltip({
    x: event.offsetX + 16,
    y: event.offsetY + 16,
    title: `${sourceLabel(link)} ${link.relation} ${targetLabel(link)}`,
    subtitle: `关系置信度 ${(link.confidence * 100).toFixed(0)}%`,
    meta: link.evidence,
  })
}

function clampPan(value: number) {
  return Math.max(-35, Math.min(35, value))
}

function clampZoom(value: number) {
  return Math.max(0.7, Math.min(1.8, value))
}

function shorten(label: string) {
  return label.length > 8 ? `${label.slice(0, 7)}...` : label
}
