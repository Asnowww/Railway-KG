"use client"

import {
  Activity,
  AlertTriangle,
  DatabaseZap,
  FileSearch,
  Network,
  Orbit,
} from "lucide-react"

import type { LucideIcon } from "lucide-react"

import {
  knowledgeDocuments,
  knowledgeLinks,
  knowledgeNodes,
} from "@/data/kg-mock"

import { cn } from "@/lib/utils"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

const panelClassName =
  "rounded-[28px] border border-white/8 bg-[#0b1120]/92 shadow-[0_22px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl"

const metricTrendData = {
  corpus: [8, 12, 11, 16, 18, 20, 22],
  nodes: [6, 7, 8, 8, 9, 9, 9],
  links: [3, 4, 5, 6, 7, 8, 8],
  risk: [4, 6, 7, 9, 8, 7, 6],
}

export function HomeOverview() {
  return (
    <section className="relative overflow-hidden bg-[#050816] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_85%_18%,rgba(124,58,237,0.18),transparent_24%),radial-gradient(circle_at_bottom,rgba(34,197,94,0.1),transparent_30%)]" />
      <div className="container relative px-4 py-6 lg:px-6 lg:py-8">
        <div className="grid gap-4 xl:grid-cols-12">
          <Card className={cn(panelClassName, "xl:col-span-7")}>
            <CardContent className="relative overflow-hidden p-0">
              <div className="absolute inset-y-0 right-0 w-2/5 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.14),transparent_56%)]" />
              <div className="relative flex h-full flex-col gap-8 px-6 py-6 lg:px-8 lg:py-7">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full border-0 bg-cyan-400/14 px-3 py-1 text-cyan-300 hover:bg-cyan-400/14">
                    KG知识图谱平台
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-emerald-300"
                  >
                    主页总览
                  </Badge>
                </div>

                <div className="space-y-4">
                  <div className="max-w-4xl text-3xl font-semibold tracking-tight text-white lg:text-4xl">
                    轨道病害知识图谱大屏，图谱为视觉中心，原始文本与结构化信息分区对齐展示。
                  </div>
                  <p className="max-w-3xl text-sm leading-7 text-slate-300 lg:text-base">
                    当前页面采用深色 SaaS
                    仪表盘风格，强调高对比、统一圆角、清晰留白和严格网格。原始文档、实体浏览、图谱详情和统计快照都保持在固定卡片中。
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <HeroInfoBlock
                    icon={FileSearch}
                    title="非结构化文本"
                    value={`${knowledgeDocuments.length} 份文档`}
                    description="巡检记录、复核纪要和环境说明持续作为图谱证据源保留。"
                  />
                  <HeroInfoBlock
                    icon={DatabaseZap}
                    title="结构化图谱"
                    value={`${knowledgeNodes.length} 节点 / ${knowledgeLinks.length} 关系`}
                    description="实体、关系和属性已拆成 mock schema，后端接口确定后可直接替换。"
                  />
                  <HeroInfoBlock
                    icon={Orbit}
                    title="交互方式"
                    value="悬停 / 点击 / 拖拽"
                    description="节点和关系详情都在当前页完成查看，不再跳转到外层页面。"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 xl:col-span-5">
            <MetricTile
              icon={Activity}
              label="源文档数量"
              value={`${knowledgeDocuments.length}`}
              delta="+12%"
              tone="cyan"
              trend={metricTrendData.corpus}
            />
            <MetricTile
              icon={Network}
              label="实体节点"
              value={`${knowledgeNodes.length}`}
              delta="+04"
              tone="violet"
              trend={metricTrendData.nodes}
            />
            <MetricTile
              icon={DatabaseZap}
              label="关系边"
              value={`${knowledgeLinks.length}`}
              delta="+03"
              tone="emerald"
              trend={metricTrendData.links}
            />
            <MetricTile
              icon={AlertTriangle}
              label="风险信号"
              value={`${knowledgeNodes.filter((node) => node.type === "risk").length}`}
              delta="-02"
              tone="amber"
              trend={metricTrendData.risk}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroInfoBlock({
  icon: Icon,
  title,
  value,
  description,
}: {
  icon: LucideIcon
  title: string
  value: string
  description: string
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-2xl bg-white/[0.06] p-2">
          <Icon className="h-4 w-4 text-cyan-300" />
        </div>
        <div className="text-xs uppercase tracking-[0.16em] text-slate-500">
          {title}
        </div>
      </div>
      <div className="mt-4 text-lg font-semibold text-white">{value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  )
}

function MetricTile({
  icon: Icon,
  label,
  value,
  delta,
  tone,
  trend,
}: {
  icon: LucideIcon
  label: string
  value: string
  delta: string
  tone: "cyan" | "violet" | "emerald" | "amber"
  trend: number[]
}) {
  const toneMap = {
    cyan: {
      glow: "bg-cyan-400/14 text-cyan-300",
      line: "#22d3ee",
      chip: "bg-cyan-400/12 text-cyan-300",
    },
    violet: {
      glow: "bg-violet-400/14 text-violet-300",
      line: "#8b5cf6",
      chip: "bg-violet-400/12 text-violet-300",
    },
    emerald: {
      glow: "bg-emerald-400/14 text-emerald-300",
      line: "#10b981",
      chip: "bg-emerald-400/12 text-emerald-300",
    },
    amber: {
      glow: "bg-amber-400/14 text-amber-300",
      line: "#f59e0b",
      chip: "bg-amber-400/12 text-amber-300",
    },
  }[tone]

  return (
    <Card className={cn(panelClassName, "h-full")}>
      <CardContent className="flex h-full flex-col justify-between gap-4 p-5">
        <div className="flex items-start justify-between">
          <div className={cn("rounded-2xl p-2", toneMap.glow)}>
            <Icon className="h-4 w-4" />
          </div>
          <span
            className={cn(
              "rounded-full px-2 py-1 text-xs font-medium",
              toneMap.chip
            )}
          >
            {delta}
          </span>
        </div>
        <div>
          <div className="text-sm text-slate-400">{label}</div>
          <div className="mt-1 text-3xl font-semibold text-white">{value}</div>
        </div>
        <Sparkline values={trend} stroke={toneMap.line} />
      </CardContent>
    </Card>
  )
}

function Sparkline({ values, stroke }: { values: number[]; stroke: string }) {
  const width = 120
  const height = 36
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width
      const y = height - ((value - min) / range) * (height - 6) - 3
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg
      aria-hidden="true"
      className="h-9 w-full"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        fill="none"
        points={points}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  )
}
