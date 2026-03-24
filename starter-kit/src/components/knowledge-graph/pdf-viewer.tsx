"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Document, Page, pdfjs } from "react-pdf"

import "react-pdf/dist/Page/AnnotationLayer.css"
import "react-pdf/dist/Page/TextLayer.css"

import { ChevronLeft, ChevronRight, Minus, Plus, RotateCw } from "lucide-react"

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

/* How many pages to render around the current page (each side) */
const BUFFER = 2

interface PdfViewerProps {
  url: string
}

export default function PdfViewer({ url }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [jumpInput, setJumpInput] = useState("")
  const [pageHeight, setPageHeight] = useState(800) // estimated px per page
  const containerRef = useRef<HTMLDivElement>(null)
  const isJumping = useRef(false)
  const renderedPageRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n)
      setCurrentPage(1)
      if (containerRef.current) containerRef.current.scrollTop = 0
    },
    []
  )

  // Measure real page height once the first page renders
  const onFirstPageRender = useCallback(() => {
    const el = renderedPageRefs.current.get(1)
    if (el) {
      const h = el.getBoundingClientRect().height
      if (h > 50) setPageHeight(h)
    }
  }, [])

  // Track scroll position → derive current page
  useEffect(() => {
    const container = containerRef.current
    if (!container || numPages === 0) return

    let ticking = false
    const onScroll = () => {
      if (ticking || isJumping.current) return
      ticking = true
      requestAnimationFrame(() => {
        const scrollTop = container.scrollTop
        const gap = 16 // py-2 = 8px * 2
        const page = Math.min(
          numPages,
          Math.max(1, Math.floor(scrollTop / (pageHeight + gap)) + 1)
        )
        setCurrentPage(page)
        ticking = false
      })
    }

    container.addEventListener("scroll", onScroll, { passive: true })
    return () => container.removeEventListener("scroll", onScroll)
  }, [numPages, pageHeight])

  // Jump to page by scrolling
  const jumpToPage = useCallback(
    (page: number) => {
      const p = Math.max(1, Math.min(numPages, page))
      const container = containerRef.current
      if (!container) return
      isJumping.current = true
      setCurrentPage(p)
      const gap = 16
      const targetTop = (p - 1) * (pageHeight + gap)
      container.scrollTo({ top: targetTop, behavior: "smooth" })
      setTimeout(() => {
        isJumping.current = false
      }, 500)
    },
    [numPages, pageHeight]
  )

  const handleJumpSubmit = (e: React.FormEvent | React.FocusEvent) => {
    e.preventDefault()
    const n = parseInt(jumpInput, 10)
    if (!isNaN(n) && n >= 1 && n <= numPages) {
      jumpToPage(n)
    }
    setJumpInput("")
  }

  const zoomIn = () => setScale((s) => Math.min(3, +(s + 0.2).toFixed(1)))
  const zoomOut = () => setScale((s) => Math.max(0.4, +(s - 0.2).toFixed(1)))
  const resetZoom = () => setScale(1.0)

  // Visible window: only render pages within [current - BUFFER, current + BUFFER]
  const rangeStart = Math.max(1, currentPage - BUFFER)
  const rangeEnd = Math.min(numPages, currentPage + BUFFER)

  const btnCls =
    "flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground transition hover:bg-muted/80 hover:text-foreground disabled:opacity-30 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20 dark:hover:text-white dark:disabled:hover:bg-white/10"

  const gap = 16

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-1.5 dark:border-white/8">
        <div className="flex items-center gap-1">
          <button
            className={btnCls}
            onClick={() => jumpToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {currentPage} / {numPages || "-"}
          </span>
          <button
            className={btnCls}
            onClick={() => jumpToPage(currentPage + 1)}
            disabled={currentPage >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <form onSubmit={handleJumpSubmit} className="flex items-center">
            <input
              type="text"
              inputMode="numeric"
              value={jumpInput}
              onChange={(e) => setJumpInput(e.target.value.replace(/\D/g, ""))}
              onBlur={handleJumpSubmit}
              placeholder="跳转"
              className="h-6 w-12 rounded border border-border/40 bg-muted/50 px-1.5 text-center text-[11px] text-foreground outline-none placeholder:text-muted-foreground focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:placeholder:text-slate-600"
            />
          </form>
        </div>
        <div className="flex items-center gap-1">
          <button className={btnCls} onClick={zoomOut}>
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            className={btnCls + " !w-auto px-1.5"}
            onClick={resetZoom}
            title="Reset zoom"
          >
            <span className="text-[10px] tabular-nums">
              {Math.round(scale * 100)}%
            </span>
          </button>
          <button className={btnCls} onClick={zoomIn}>
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* PDF Content — virtualized continuous scroll */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-muted/40 dark:bg-[#1a1a2e]/60"
        style={{ minHeight: 0 }}
      >
        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(err) => console.error("[PdfViewer] load error:", err)}
          loading={
            <div className="flex h-full items-center justify-center py-20">
              <RotateCw className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-xs text-muted-foreground">
                加载中...
              </span>
            </div>
          }
          error={
            <div className="flex h-full flex-col items-center justify-center gap-2 py-20">
              <span className="text-sm text-destructive">PDF 加载失败</span>
              <button
                onClick={() => window.location.reload()}
                className="rounded bg-muted px-3 py-1 text-xs text-muted-foreground hover:bg-muted/80 dark:bg-white/10 dark:text-slate-300 dark:hover:bg-white/20"
              >
                点击重试
              </button>
            </div>
          }
        >
          {numPages > 0 && (
            <div
              style={{ height: numPages * (pageHeight + gap) - gap }}
              className="relative"
            >
              {Array.from(
                { length: rangeEnd - rangeStart + 1 },
                (_, i) => rangeStart + i
              ).map((pageNum) => (
                <div
                  key={pageNum}
                  data-page={pageNum}
                  ref={(el) => {
                    if (el) renderedPageRefs.current.set(pageNum, el)
                  }}
                  className="absolute flex w-full justify-center"
                  style={{ top: (pageNum - 1) * (pageHeight + gap) }}
                >
                  <Page
                    pageNumber={pageNum}
                    scale={scale}
                    className="shadow-xl"
                    renderAnnotationLayer={true}
                    renderTextLayer={true}
                    onRenderSuccess={
                      pageNum === 1 ? onFirstPageRender : undefined
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </Document>
      </div>
    </div>
  )
}
