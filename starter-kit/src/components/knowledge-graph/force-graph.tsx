"use client"

import { useCallback, useEffect, useRef, useState } from "react"
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

const NODE_RADIUS: Record<string, number> = {
  defect: 8,
  "defect-genre": 10,
  "rail-system": 12,
  risk: 7,
  factor: 7,
  measure: 7,
  component: 7,
  facility: 8,
  function: 7,
  technique: 7,
}

const LINK_COLORS: Record<string, string> = {
  包含: "rgba(148,163,184,0.35)",
  处理方式: "rgba(43,184,214,0.45)",
  导致: "rgba(249,115,96,0.50)",
  分为: "rgba(255,140,66,0.40)",
  功能: "rgba(74,222,128,0.40)",
  检测方法: "rgba(154,107,255,0.45)",
  检测方式: "rgba(154,107,255,0.40)",
  同: "rgba(148,163,184,0.30)",
  位于: "rgba(91,141,239,0.45)",
  原因: "rgba(251,146,60,0.50)",
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const simRef = useRef<d3.Simulation<SimNode, SimLink> | null>(null)
  const nodesRef = useRef<SimNode[]>([])
  const linksRef = useRef<SimLink[]>([])
  const transformRef = useRef(d3.zoomIdentity)
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<
    HTMLCanvasElement,
    unknown
  > | null>(null)
  const rafRef = useRef<number>(0)
  const viewStateRef = useRef<ViewState>({ zoom: 1, panX: 0, panY: 0 })
  const hoveredNodeRef = useRef<SimNode | null>(null)
  const hoveredLinkRef = useRef<SimLink | null>(null)
  const draggedNodeRef = useRef<SimNode | null>(null)
  const selectedNodeRef = useRef(selectedNodeId)
  const selectedLinkRef = useRef(selectedLinkId)

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [, setViewState] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 })

  selectedNodeRef.current = selectedNodeId
  selectedLinkRef.current = selectedLinkId

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
    const onFullscreenChange = () =>
      setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  useEffect(() => {
    const element = wrapperRef.current
    if (!element) return
    const ro = new ResizeObserver(([entry]) =>
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    )
    ro.observe(element)
    return () => ro.disconnect()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    ctx.save()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)

    const t = transformRef.current
    ctx.translate(t.x, t.y)
    ctx.scale(t.k, t.k)

    const localNodes = nodesRef.current
    const localLinks = linksRef.current
    const selNodeId = selectedNodeRef.current
    const selLinkId = selectedLinkRef.current

    // Draw links
    for (const link of localLinks) {
      const s = link.source as SimNode
      const tgt = link.target as SimNode
      if (s.x == null || s.y == null || tgt.x == null || tgt.y == null) continue

      const isSelected = link.id === selLinkId
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.strokeStyle = isSelected
        ? "#38bdf8"
        : (LINK_COLORS[link.relation] ?? "rgba(148,163,184,0.30)")
      ctx.lineWidth = isSelected ? 2.5 : 0.8
      ctx.stroke()

      // Arrow head
      const dx = tgt.x - s.x
      const dy = tgt.y - s.y
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len < 1) continue
      const tgtR = tgt.radius + 2
      const ax = tgt.x - (dx / len) * tgtR
      const ay = tgt.y - (dy / len) * tgtR
      const angle = Math.atan2(dy, dx)
      const arrowSize = isSelected ? 6 : 4
      ctx.beginPath()
      ctx.moveTo(ax, ay)
      ctx.lineTo(
        ax - arrowSize * Math.cos(angle - Math.PI / 6),
        ay - arrowSize * Math.sin(angle - Math.PI / 6)
      )
      ctx.lineTo(
        ax - arrowSize * Math.cos(angle + Math.PI / 6),
        ay - arrowSize * Math.sin(angle + Math.PI / 6)
      )
      ctx.closePath()
      ctx.fillStyle = isSelected
        ? "#38bdf8"
        : (LINK_COLORS[link.relation] ?? "rgba(148,163,184,0.50)")
      ctx.fill()
    }

    // Draw nodes
    for (const node of localNodes) {
      if (node.x == null || node.y == null) continue
      const meta = nodeTypeMeta[node.type]
      if (!meta) continue
      const isSelected = node.id === selNodeId
      const isHovered = node === hoveredNodeRef.current

      // Selection ring
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2)
        ctx.fillStyle = meta.tint
        ctx.fill()
        ctx.strokeStyle = "rgba(255,255,255,0.3)"
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Main circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2)
      ctx.fillStyle = isHovered ? lightenColor(meta.color, 0.2) : meta.color
      ctx.fill()

      if (isSelected || isHovered) {
        ctx.strokeStyle = "#e2e8f0"
        ctx.lineWidth = isSelected ? 2 : 1.5
        ctx.stroke()
      }

      // Label - only show when zoomed in enough or selected/hovered
      const showLabel = t.k > 0.85 || isSelected || isHovered
      if (showLabel) {
        const fontSize = Math.max(9, Math.min(12, 10 / t.k))
        ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        const label = shorten(node.label, isSelected || isHovered ? 10 : 6)

        // Text shadow
        ctx.fillStyle = "rgba(0,0,0,0.7)"
        ctx.fillText(label, node.x + 0.5, node.y + node.radius + fontSize + 0.5)
        // Text
        ctx.fillStyle = "#f1f5f9"
        ctx.fillText(label, node.x, node.y + node.radius + fontSize)
      }
    }

    ctx.restore()
  }, [])

  // Main simulation setup
  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl || !dimensions.width || !dimensions.height) return
    const canvas: HTMLCanvasElement = canvasEl

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    canvas.style.width = `${dimensions.width}px`
    canvas.style.height = `${dimensions.height}px`

    const width = dimensions.width
    const height = dimensions.height

    const localNodes: SimNode[] = nodes.map((node) => ({
      ...node,
      radius: NODE_RADIUS[node.type] ?? 7,
    }))
    const localLinks: SimLink[] = links.map((link) => ({ ...link }))

    nodesRef.current = localNodes
    linksRef.current = localLinks

    // Build node degree map for layout
    const degreeMap = new Map<string, number>()
    for (const link of links) {
      degreeMap.set(link.source, (degreeMap.get(link.source) ?? 0) + 1)
      degreeMap.set(link.target, (degreeMap.get(link.target) ?? 0) + 1)
    }

    // Adjust radius by degree
    for (const node of localNodes) {
      const degree = degreeMap.get(node.id) ?? 0
      node.radius = Math.min(
        18,
        (NODE_RADIUS[node.type] ?? 7) + Math.sqrt(degree) * 1.2
      )
    }

    const simulation = d3
      .forceSimulation<SimNode>(localNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(localLinks)
          .id((n) => n.id)
          .distance(60)
          .strength(0.3)
      )
      .force("charge", d3.forceManyBody().strength(-80).distanceMax(300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3
          .forceCollide<SimNode>()
          .radius((n) => n.radius + 3)
          .iterations(1)
      )
      .force("x", d3.forceX(width / 2).strength(0.02))
      .force("y", d3.forceY(height / 2).strength(0.02))
      .alphaDecay(0.04)
      .velocityDecay(0.4)

    simRef.current = simulation

    // Render loop
    function tick() {
      draw()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    // Zoom
    const zoomBehavior = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.15, 4])
      .on("zoom", (event) => {
        transformRef.current = event.transform
        viewStateRef.current = {
          zoom: Number(event.transform.k.toFixed(2)),
          panX: event.transform.x,
          panY: event.transform.y,
        }
      })
      .on("end", () => {
        setViewState({ ...viewStateRef.current })
      })

    zoomBehaviorRef.current = zoomBehavior
    const sel = d3.select(canvas)
    sel.call(zoomBehavior)

    // Initial transform to center
    const initialTransform = d3.zoomIdentity.translate(0, 0).scale(0.8)
    sel.call(zoomBehavior.transform, initialTransform)

    // Hit testing
    function findNodeAt(mx: number, my: number): SimNode | null {
      const t = transformRef.current
      const x = (mx - t.x) / t.k
      const y = (my - t.y) / t.k
      for (let i = localNodes.length - 1; i >= 0; i--) {
        const n = localNodes[i]
        if (n.x == null || n.y == null) continue
        const dx = x - n.x
        const dy = y - n.y
        if (dx * dx + dy * dy < (n.radius + 4) * (n.radius + 4)) return n
      }
      return null
    }

    function findLinkAt(mx: number, my: number): SimLink | null {
      const t = transformRef.current
      const x = (mx - t.x) / t.k
      const y = (my - t.y) / t.k
      const threshold = 5 / t.k
      for (const link of localLinks) {
        const s = link.source as SimNode
        const tg = link.target as SimNode
        if (s.x == null || s.y == null || tg.x == null || tg.y == null) continue
        const dist = pointToSegmentDist(x, y, s.x, s.y, tg.x, tg.y)
        if (dist < threshold) return link
      }
      return null
    }

    // Mouse events
    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const node = findNodeAt(mx, my)
      hoveredNodeRef.current = node

      if (node) {
        canvas.style.cursor = "pointer"
        const meta = nodeTypeMeta[node.type]
        setTooltip({
          x: mx + 16,
          y: my + 16,
          title: node.label,
          subtitle: meta ? `${meta.label}` : node.type,
          meta: node.summary ?? `度: ${degreeMap.get(node.id) ?? 0}`,
        })
        hoveredLinkRef.current = null
        return
      }

      const link = findLinkAt(mx, my)
      hoveredLinkRef.current = link
      if (link) {
        canvas.style.cursor = "pointer"
        const s = link.source as SimNode
        const t = link.target as SimNode
        setTooltip({
          x: mx + 16,
          y: my + 16,
          title: `${s.label} → ${t.label}`,
          subtitle: link.relation,
          meta: link.evidence ?? "",
        })
        return
      }

      canvas.style.cursor = "grab"
      setTooltip(null)
    }

    function onClick(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const node = findNodeAt(mx, my)
      if (node) {
        onSelectNode(node.id)
        return
      }
      const link = findLinkAt(mx, my)
      if (link) {
        onSelectLink(link.id)
      }
    }

    canvas.addEventListener("mousemove", onMouseMove)
    canvas.addEventListener("click", onClick)

    // Drag
    let dragNode: SimNode | null = null
    function onMouseDown(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const node = findNodeAt(mx, my)
      if (node) {
        dragNode = node
        draggedNodeRef.current = node
        simulation.alphaTarget(0.3).restart()
        node.fx = node.x
        node.fy = node.y
        // Prevent zoom panning while dragging node
        sel.on(".zoom", null)
      }
    }
    function onMouseMoveDrag(e: MouseEvent) {
      if (!dragNode) return
      const rect = canvas.getBoundingClientRect()
      const t = transformRef.current
      dragNode.fx = (e.clientX - rect.left - t.x) / t.k
      dragNode.fy = (e.clientY - rect.top - t.y) / t.k
    }
    function onMouseUp() {
      if (dragNode) {
        simulation.alphaTarget(0)
        dragNode.fx = null
        dragNode.fy = null
        dragNode = null
        draggedNodeRef.current = null
        // Re-enable zoom
        sel.call(zoomBehavior)
      }
    }

    canvas.addEventListener("mousedown", onMouseDown)
    window.addEventListener("mousemove", onMouseMoveDrag)
    window.addEventListener("mouseup", onMouseUp)

    return () => {
      simulation.stop()
      cancelAnimationFrame(rafRef.current)
      canvas.removeEventListener("mousemove", onMouseMove)
      canvas.removeEventListener("click", onClick)
      canvas.removeEventListener("mousedown", onMouseDown)
      window.removeEventListener("mousemove", onMouseMoveDrag)
      window.removeEventListener("mouseup", onMouseUp)
    }
  }, [
    dimensions.width,
    dimensions.height,
    nodes,
    links,
    draw,
    onSelectNode,
    onSelectLink,
  ])

  // Focus node
  useEffect(() => {
    if (!focusNodeId || !dimensions.width || !dimensions.height) return
    const canvas = canvasRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!canvas || !zoomBehavior) return

    const timer = setTimeout(() => {
      const target = nodesRef.current.find((n) => n.id === focusNodeId)
      if (!target || target.x == null || target.y == null) return

      const scale = 2
      const tx = dimensions.width / 2 - target.x * scale
      const ty = dimensions.height / 2 - target.y * scale
      const transform = d3.zoomIdentity.translate(tx, ty).scale(scale)

      d3.select(canvas)
        .transition()
        .duration(600)
        .call(zoomBehavior.transform, transform)
    }, 400)

    return () => clearTimeout(timer)
  }, [focusNodeId, dimensions.width, dimensions.height])

  function updateViewState(patch: Partial<ViewState>) {
    const canvas = canvasRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!canvas || !zoomBehavior) return

    const current = transformRef.current
    let newK = patch.zoom ?? current.k
    newK = Math.max(0.15, Math.min(4, newK))
    const transform = d3.zoomIdentity
      .translate(current.x, current.y)
      .scale(newK)

    d3.select(canvas)
      .transition()
      .duration(200)
      .call(zoomBehavior.transform, transform)
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative h-full min-h-[600px] w-full ${isFullscreen ? "bg-[#020817]" : ""}`}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ display: "block" }}
      />

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
          {tooltip.meta && (
            <div className="mt-2 text-xs leading-5 text-slate-300">
              {tooltip.meta}
            </div>
          )}
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
            updateViewState({ zoom: viewStateRef.current.zoom * 1.3 })
          }
          type="button"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          aria-label="缩小图谱"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-200 transition hover:bg-white/[0.1]"
          onClick={() =>
            updateViewState({ zoom: viewStateRef.current.zoom * 0.7 })
          }
          type="button"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = ax + t * dx
  const projY = ay + t * dy
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

function lightenColor(hex: string, amount: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.min(255, r + 255 * amount)},${Math.min(255, g + 255 * amount)},${Math.min(255, b + 255 * amount)})`
}

function shorten(label: string, maxLen: number = 6) {
  return label.length > maxLen ? `${label.slice(0, maxLen)}..` : label
}
