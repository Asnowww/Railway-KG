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
  /** External highlight override – when set, these node IDs glow and everything else dims */
  highlightNodes?: Set<string> | null
  onSelectNode: (nodeId: string) => void
  onSelectLink: (linkId: string) => void
  onExpandNode?: (nodeId: string) => void
  onResetExpand?: () => void
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

const BASE_RADIUS: Record<string, number> = {
  defect: 16,
  "defect-genre": 20,
  "rail-system": 22,
  risk: 14,
  factor: 14,
  measure: 14,
  component: 14,
  facility: 16,
  function: 14,
  technique: 14,
}

const LINK_COLORS: Record<string, string> = {
  包含: "rgba(148,163,184,0.40)",
  处理方式: "rgba(43,184,214,0.50)",
  导致: "rgba(249,115,96,0.55)",
  分为: "rgba(255,140,66,0.45)",
  功能: "rgba(74,222,128,0.45)",
  检测方法: "rgba(154,107,255,0.50)",
  检测方式: "rgba(154,107,255,0.45)",
  同: "rgba(148,163,184,0.35)",
  位于: "rgba(91,141,239,0.50)",
  原因: "rgba(251,146,60,0.55)",
}

const defaultNodes = knowledgeNodes
const defaultLinks = knowledgeLinks

export function ForceGraph({
  nodes = defaultNodes,
  links = defaultLinks,
  selectedNodeId,
  selectedLinkId,
  focusNodeId,
  highlightNodes,
  onSelectNode,
  onSelectLink,
  onExpandNode,
  onResetExpand,
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
  const dragNodeRef = useRef<SimNode | null>(null)
  const isPanningRef = useRef(false)
  const highlightSetRef = useRef<Set<string>>(new Set())
  const selectedNodeRef = useRef(selectedNodeId)
  const selectedLinkRef = useRef(selectedLinkId)
  const isDarkRef = useRef(true)

  // Track dark mode class on <html>
  useEffect(() => {
    const html = document.documentElement
    const update = () => {
      isDarkRef.current = html.classList.contains("dark")
    }
    update()
    const obs = new MutationObserver(update)
    obs.observe(html, { attributes: true, attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])

  // Sync external highlightNodes prop → internal highlightSetRef
  useEffect(() => {
    if (highlightNodes && highlightNodes.size > 0) {
      highlightSetRef.current = highlightNodes
    } else if (highlightNodes === null) {
      // explicit null = clear external highlight (keep expand highlights untouched)
    }
  }, [highlightNodes])

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
    const onFsc = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener("fullscreenchange", onFsc)
    return () => document.removeEventListener("fullscreenchange", onFsc)
  }, [])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) =>
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      })
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ───────────── draw (called every frame) ───────────── */
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

    const k = t.k
    const localNodes = nodesRef.current
    const localLinks = linksRef.current
    const selNodeId = selectedNodeRef.current
    const selLinkId = selectedLinkRef.current

    // LOD thresholds
    const showText = k >= 0.55
    const showArrows = k >= 0.3
    const isLow = k < 0.3

    // highlight state
    const hl = highlightSetRef.current
    const hasHighlight = hl.size > 0

    // theme-aware colors
    const dark = isDarkRef.current
    const linkLabelBg = dark ? "rgba(2,8,23,0.75)" : "rgba(255,255,255,0.88)"
    const linkLabelFg = dark ? "rgba(203,213,225,0.9)" : "rgba(30,41,59,0.9)"
    const ringStroke = dark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.15)"
    const nodeStroke = dark ? "#e2e8f0" : "#475569"

    /* ── links ── */
    for (const link of localLinks) {
      const s = link.source as SimNode
      const tgt = link.target as SimNode
      if (s.x == null || s.y == null || tgt.x == null || tgt.y == null) continue

      const isSel = link.id === selLinkId
      const isHl = !hasHighlight || (hl.has(s.id) && hl.has(tgt.id))

      ctx.globalAlpha = isSel ? 1 : isHl ? 1 : 0.08
      ctx.beginPath()
      ctx.moveTo(s.x, s.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.strokeStyle = isSel
        ? "#38bdf8"
        : (LINK_COLORS[link.relation] ?? "rgba(148,163,184,0.30)")
      ctx.lineWidth = isSel
        ? 2.5
        : isHl && hasHighlight
          ? 1.2
          : isLow
            ? 0.25
            : 0.7
      ctx.stroke()

      if (showArrows && (isHl || isSel)) {
        const dx = tgt.x - s.x
        const dy = tgt.y - s.y
        const len = Math.sqrt(dx * dx + dy * dy)
        if (len < 1) {
          ctx.globalAlpha = 1
          continue
        }
        const tgtR = tgt.radius + 2
        const ax = tgt.x - (dx / len) * tgtR
        const ay = tgt.y - (dy / len) * tgtR
        const angle = Math.atan2(dy, dx)
        const sz = isSel ? 6 : 4
        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(
          ax - sz * Math.cos(angle - Math.PI / 6),
          ay - sz * Math.sin(angle - Math.PI / 6)
        )
        ctx.lineTo(
          ax - sz * Math.cos(angle + Math.PI / 6),
          ay - sz * Math.sin(angle + Math.PI / 6)
        )
        ctx.closePath()
        ctx.fillStyle = isSel
          ? "#38bdf8"
          : (LINK_COLORS[link.relation] ?? "rgba(148,163,184,0.50)")
        ctx.fill()
      }

      // relation label on highlighted links only
      if (hasHighlight && isHl && showText) {
        const mx = (s.x + tgt.x) / 2
        const my = (s.y + tgt.y) / 2
        const labelFontSize = Math.max(8, Math.min(11, 10 / k))
        ctx.font = `500 ${labelFontSize}px system-ui, -apple-system, sans-serif`
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        // background pill
        const tw = ctx.measureText(link.relation).width + 8
        const th = labelFontSize + 6
        ctx.fillStyle = linkLabelBg
        ctx.beginPath()
        ctx.roundRect(mx - tw / 2, my - th / 2, tw, th, 4)
        ctx.fill()
        // text
        ctx.fillStyle = linkLabelFg
        ctx.fillText(link.relation, mx, my)
      }

      ctx.globalAlpha = 1
    }

    /* ── nodes ── */
    for (const node of localNodes) {
      if (node.x == null || node.y == null) continue
      const meta = nodeTypeMeta[node.type]
      if (!meta) continue
      const isSel = node.id === selNodeId
      const isHov = node === hoveredNodeRef.current
      const isHl = !hasHighlight || hl.has(node.id)
      const r = isLow ? Math.max(3, node.radius * 0.5) : node.radius

      ctx.globalAlpha = isHl ? 1 : 0.12

      // selection ring
      if (isSel && isHl) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, r + 5, 0, Math.PI * 2)
        ctx.fillStyle = meta.tint
        ctx.fill()
        ctx.strokeStyle = ringStroke
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // main circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fillStyle = isHov && isHl ? lightenColor(meta.color, 0.2) : meta.color
      ctx.fill()

      if ((isSel || isHov) && isHl && !isLow) {
        ctx.strokeStyle = nodeStroke
        ctx.lineWidth = isSel ? 2 : 1.5
        ctx.stroke()
      }

      // text inside circle
      if (showText && isHl) {
        wrapTextInCircle(ctx, node.label, node.x, node.y, r, dark)
      }

      ctx.globalAlpha = 1
    }

    ctx.restore()
  }, [])

  /* ───────────── simulation setup ───────────── */
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

    // preserve positions of existing nodes
    const prevMap = new Map(nodesRef.current.map((n) => [n.id, n]))

    // degree map for radius scaling
    const degMap = new Map<string, number>()
    for (const link of links) {
      degMap.set(link.source, (degMap.get(link.source) ?? 0) + 1)
      degMap.set(link.target, (degMap.get(link.target) ?? 0) + 1)
    }

    const localNodes: SimNode[] = nodes.map((node) => {
      const prev = prevMap.get(node.id)
      const degree = degMap.get(node.id) ?? 0
      const r = Math.min(
        32,
        (BASE_RADIUS[node.type] ?? 14) + Math.sqrt(degree) * 2
      )
      return {
        ...node,
        radius: r,
        x: prev?.x ?? width / 2 + (Math.random() - 0.5) * 200,
        y: prev?.y ?? height / 2 + (Math.random() - 0.5) * 200,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      }
    })
    const localLinks: SimLink[] = links.map((link) => ({ ...link }))

    nodesRef.current = localNodes
    linksRef.current = localLinks

    const simulation = d3
      .forceSimulation<SimNode>(localNodes)
      .force(
        "link",
        d3
          .forceLink<SimNode, SimLink>(localLinks)
          .id((n) => n.id)
          .distance(140)
          .strength(0.25)
      )
      .force("charge", d3.forceManyBody().strength(-300).distanceMax(500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force(
        "collide",
        d3
          .forceCollide<SimNode>()
          .radius((n) => n.radius + 18)
          .iterations(2)
      )
      .force("x", d3.forceX(width / 2).strength(0.018))
      .force("y", d3.forceY(height / 2).strength(0.018))
      .alphaDecay(0.035)
      .velocityDecay(0.4)

    simRef.current = simulation

    // render loop
    function tick() {
      draw()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    function getPointerPosition(event: MouseEvent | WheelEvent | TouchEvent) {
      const rect = canvas.getBoundingClientRect()
      if ("touches" in event && event.touches.length > 0) {
        return {
          x: event.touches[0].clientX - rect.left,
          y: event.touches[0].clientY - rect.top,
        }
      }
      if ("changedTouches" in event && event.changedTouches.length > 0) {
        return {
          x: event.changedTouches[0].clientX - rect.left,
          y: event.changedTouches[0].clientY - rect.top,
        }
      }
      if ("clientX" in event && "clientY" in event) {
        return {
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        }
      }
      return {
        x: 0,
        y: 0,
      }
    }

    /* ── hit testing ── */
    function findNodeAt(mx: number, my: number): SimNode | null {
      const tr = transformRef.current
      const x = (mx - tr.x) / tr.k
      const y = (my - tr.y) / tr.k
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
      const tr = transformRef.current
      const x = (mx - tr.x) / tr.k
      const y = (my - tr.y) / tr.k
      const threshold = 6 / tr.k
      for (const link of localLinks) {
        const s = link.source as SimNode
        const tg = link.target as SimNode
        if (s.x == null || s.y == null || tg.x == null || tg.y == null) continue
        if (pointToSegDist(x, y, s.x, s.y, tg.x, tg.y) < threshold) return link
      }
      return null
    }

    /* ── mouse events ── */
    const zoomBehavior = d3
      .zoom<HTMLCanvasElement, unknown>()
      .filter((event) => {
        if (event.type === "dblclick") return false
        if (event.type === "wheel") return !(event as WheelEvent).ctrlKey
        if ("button" in event && event.button !== 0) return false

        const pointer = getPointerPosition(
          event as MouseEvent | WheelEvent | TouchEvent
        )
        return (
          !findNodeAt(pointer.x, pointer.y) && !findLinkAt(pointer.x, pointer.y)
        )
      })
      .clickDistance(4)
      .scaleExtent([0.08, 5])
      .on("start", (event) => {
        if (
          event.sourceEvent?.type === "mousedown" ||
          event.sourceEvent?.type === "touchstart"
        ) {
          isPanningRef.current = true
          hoveredNodeRef.current = null
          setTooltip(null)
          canvas.style.cursor = "grabbing"
        }
      })
      .on("zoom", (event) => {
        transformRef.current = event.transform
        viewStateRef.current = {
          zoom: Number(event.transform.k.toFixed(2)),
          panX: event.transform.x,
          panY: event.transform.y,
        }
      })
      .on("end", () => {
        isPanningRef.current = false
        if (!dragNodeRef.current) {
          canvas.style.cursor = "grab"
        }
        setViewState({ ...viewStateRef.current })
      })

    const dragBehavior = d3
      .drag<HTMLCanvasElement, unknown, SimNode>()
      .container(canvas)
      .filter((event) => {
        if ("button" in event && event.button !== 0) return false
        const pointer = getPointerPosition(event as MouseEvent | TouchEvent)
        return !!findNodeAt(pointer.x, pointer.y)
      })
      .subject((event) => findNodeAt(event.x, event.y) as SimNode)
      .clickDistance(4)
      .on("start", (event) => {
        const node = event.subject
        dragNodeRef.current = node
        hoveredNodeRef.current = node
        setTooltip(null)
        canvas.style.cursor = "grabbing"
        if (!event.active) {
          simulation.alphaTarget(0.35)
        }
        simulation.alpha(0.45).restart()
        node.fx = node.x
        node.fy = node.y
      })
      .on("drag", (event) => {
        const node = event.subject
        const tr = transformRef.current
        node.fx = (event.x - tr.x) / tr.k
        node.fy = (event.y - tr.y) / tr.k
        simulation.alphaTarget(0.35).restart()
      })
      .on("end", (event) => {
        const node = event.subject
        dragNodeRef.current = null
        hoveredNodeRef.current = null
        node.fx = null
        node.fy = null
        if (!event.active) {
          simulation.alphaTarget(0)
        }
        canvas.style.cursor = "grab"
      })

    zoomBehaviorRef.current = zoomBehavior
    const sel = d3.select(canvas)
    sel.call(zoomBehavior)
    sel.call(dragBehavior)
    sel.on("dblclick.zoom", null)
    canvas.style.cursor = "grab"

    const initScale = 0.7
    sel.call(
      zoomBehavior.transform,
      d3.zoomIdentity
        .translate(
          width * (1 - initScale) * 0.5,
          height * (1 - initScale) * 0.5
        )
        .scale(initScale)
    )

    function onMouseMove(e: MouseEvent) {
      if (dragNodeRef.current || isPanningRef.current) {
        canvas.style.cursor = "grabbing"
        setTooltip(null)
        return
      }

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
          subtitle: meta ? meta.label : node.type,
          meta: `度: ${degMap.get(node.id) ?? 0}  |  双击展开邻居`,
        })
        return
      }

      const link = findLinkAt(mx, my)
      if (link) {
        canvas.style.cursor = "pointer"
        const s = link.source as SimNode
        const tgt = link.target as SimNode
        setTooltip({
          x: mx + 16,
          y: my + 16,
          title: `${s.label} → ${tgt.label}`,
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
      if (link) onSelectLink(link.id)
    }

    function onDblClick(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const node = findNodeAt(mx, my)
      if (node) {
        // build highlight set: this node + its direct neighbors
        const neighbors = new Set<string>([node.id])
        for (const link of localLinks) {
          const sId = (link.source as SimNode).id
          const tId = (link.target as SimNode).id
          if (sId === node.id) neighbors.add(tId)
          if (tId === node.id) neighbors.add(sId)
        }
        highlightSetRef.current = neighbors
        if (onExpandNode) onExpandNode(node.id)
      } else {
        // double-click on empty → clear highlight & collapse
        highlightSetRef.current = new Set()
        if (onResetExpand) onResetExpand()
      }
    }

    /* ── drag ── */
    canvas.addEventListener("mousemove", onMouseMove)
    canvas.addEventListener("click", onClick)
    canvas.addEventListener("dblclick", onDblClick)

    return () => {
      dragNodeRef.current = null
      isPanningRef.current = false
      simulation.stop()
      cancelAnimationFrame(rafRef.current)
      sel.on(".drag", null)
      sel.on(".zoom", null)
      canvas.removeEventListener("mousemove", onMouseMove)
      canvas.removeEventListener("click", onClick)
      canvas.removeEventListener("dblclick", onDblClick)
    }
  }, [
    dimensions.width,
    dimensions.height,
    nodes,
    links,
    draw,
    onSelectNode,
    onSelectLink,
    onExpandNode,
    onResetExpand,
  ])

  /* ── focus node ── */
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
      d3.select(canvas)
        .transition()
        .duration(600)
        .call(
          zoomBehavior.transform,
          d3.zoomIdentity.translate(tx, ty).scale(scale)
        )
    }, 400)

    return () => clearTimeout(timer)
  }, [focusNodeId, dimensions.width, dimensions.height])

  function updateViewState(patch: Partial<ViewState>) {
    const canvas = canvasRef.current
    const zoomBehavior = zoomBehaviorRef.current
    if (!canvas || !zoomBehavior) return

    const current = transformRef.current
    let newK = patch.zoom ?? current.k
    newK = Math.max(0.08, Math.min(5, newK))
    d3.select(canvas)
      .transition()
      .duration(200)
      .call(
        zoomBehavior.transform,
        d3.zoomIdentity.translate(current.x, current.y).scale(newK)
      )
  }

  return (
    <div
      ref={wrapperRef}
      className={`relative h-full min-h-[600px] w-full ${isFullscreen ? "bg-background dark:bg-[#020817]" : ""}`}
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ display: "block" }}
      />

      {tooltip ? (
        <div
          className="pointer-events-none absolute z-20 max-w-64 rounded-2xl border border-border/40 bg-card/95 px-4 py-3 shadow-lg backdrop-blur dark:border-white/10 dark:bg-[#020817]/94 dark:shadow-[0_24px_50px_rgba(0,0,0,0.42)]"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="text-sm font-semibold text-foreground">
            {tooltip.title}
          </div>
          <div className="mt-1 text-xs font-medium text-cyan-600 dark:text-cyan-300">
            {tooltip.subtitle}
          </div>
          {tooltip.meta && (
            <div className="mt-2 text-xs leading-5 text-muted-foreground">
              {tooltip.meta}
            </div>
          )}
        </div>
      ) : null}

      <div className="absolute bottom-4 left-4 z-20 rounded-[22px] border border-border/40 bg-card/90 p-2 shadow-md backdrop-blur dark:border-white/10 dark:bg-[#020817]/88 dark:shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
        <button
          aria-label={isFullscreen ? "退出全屏" : "全屏查看"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-muted/50 text-foreground transition hover:bg-muted/80 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.1]"
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

      <div className="absolute bottom-4 right-4 z-20 flex gap-2 rounded-[22px] border border-border/40 bg-card/90 p-2 shadow-md backdrop-blur dark:border-white/10 dark:bg-[#020817]/88 dark:shadow-[0_20px_40px_rgba(0,0,0,0.4)]">
        <button
          aria-label="放大图谱"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-muted/50 text-foreground transition hover:bg-muted/80 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.1]"
          onClick={() =>
            updateViewState({ zoom: viewStateRef.current.zoom * 1.3 })
          }
          type="button"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <button
          aria-label="缩小图谱"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/40 bg-muted/50 text-foreground transition hover:bg-muted/80 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-200 dark:hover:bg-white/[0.1]"
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

/* ────── helpers ────── */

function wrapTextInCircle(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  radius: number,
  dark = true
) {
  const fontSize = Math.max(7, Math.min(12, radius * 0.6))
  ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  const maxWidth = radius * 1.6
  const charWidth = fontSize * 0.95
  const charsPerLine = Math.max(1, Math.floor(maxWidth / charWidth))

  const lines: string[] = []
  for (let i = 0; i < text.length; i += charsPerLine) {
    lines.push(text.slice(i, i + charsPerLine))
  }

  const maxLines = Math.max(1, Math.floor((radius * 1.7) / (fontSize * 1.25)))
  const display = lines.slice(0, maxLines)
  if (lines.length > maxLines && display.length > 0) {
    const last = display[display.length - 1]
    if (last.length > 1) {
      display[display.length - 1] = last.slice(0, -1) + "\u2026"
    }
  }

  const lh = fontSize * 1.25
  const startY = y - ((display.length - 1) * lh) / 2

  // shadow
  ctx.fillStyle = dark ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.7)"
  for (let i = 0; i < display.length; i++) {
    ctx.fillText(display[i], x + 0.5, startY + i * lh + 0.5)
  }
  // text
  ctx.fillStyle = dark ? "#f1f5f9" : "#1e293b"
  for (let i = 0; i < display.length; i++) {
    ctx.fillText(display[i], x, startY + i * lh)
  }
}

function pointToSegDist(
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
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq))
  return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2)
}

function lightenColor(hex: string, amt: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.min(255, r + 255 * amt)},${Math.min(255, g + 255 * amt)},${Math.min(255, b + 255 * amt)})`
}
