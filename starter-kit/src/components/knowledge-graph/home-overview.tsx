"use client"

import Link from "next/link"
import {
  AlertTriangle,
  CircleAlert,
  Database,
  FileText,
  Gauge,
  Network,
  TriangleAlert,
  Zap,
} from "lucide-react"

import type { ReactNode } from "react"

import {
  knowledgeDocuments,
  knowledgeLinks,
  knowledgeNodes,
} from "@/data/kg-mock"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const overviewMetrics = [
  {
    label: "已扫描文档",
    value: `${knowledgeDocuments.length}`,
    unit: "份",
    hint: "+12.5% 本周",
    icon: FileText,
    color: "text-cyan-500 dark:text-cyan-300",
    barColor: "bg-cyan-500 dark:bg-cyan-300",
    bars: [24, 34, 32, 48, 66],
  },
  {
    label: "识别实体数量",
    value: `${knowledgeNodes.length}`,
    unit: "个",
    hint: "+4 新增",
    icon: Network,
    color: "text-fuchsia-500 dark:text-fuchsia-300",
    barColor: "bg-fuchsia-500 dark:bg-fuchsia-300",
    bars: [42, 24, 38, 52, 46],
  },
  {
    label: "活跃知识关联",
    value: `${knowledgeLinks.length}`,
    unit: "条",
    hint: "-0.4% 处理延迟",
    icon: Database,
    color: "text-emerald-500 dark:text-emerald-300",
    barColor: "bg-emerald-500 dark:bg-emerald-300",
    bars: [28, 50, 34, 46, 62],
  },
] as const

const threatItems = [
  {
    title: "结构性裂缝",
    location: "K124+450 桥墩支撑",
    level: "危急 (CRITICAL)",
    tone: "border-red-400/40 bg-[linear-gradient(90deg,rgba(239,68,68,0.10),rgba(239,68,68,0.03))] text-red-600 dark:bg-[linear-gradient(90deg,rgba(239,68,68,0.16),rgba(239,68,68,0.05))] dark:text-red-300",
    badge: "bg-red-500/90 text-white dark:bg-red-300/90 dark:text-black",
    icon: CircleAlert,
  },
  {
    title: "几何位移偏差",
    location: "L2 线曲线段 R350",
    level: "中高 (HIGH)",
    tone: "border-amber-400/40 bg-[linear-gradient(90deg,rgba(245,158,11,0.10),rgba(245,158,11,0.03))] text-amber-600 dark:bg-[linear-gradient(90deg,rgba(245,158,11,0.16),rgba(245,158,11,0.05))] dark:text-amber-300",
    badge: "bg-amber-500/90 text-white dark:bg-amber-300/90 dark:text-black",
    icon: TriangleAlert,
  },
  {
    title: "电气接触磨损",
    location: "接触网 043# 支柱",
    level: "常规 (NORMAL)",
    tone: "border-cyan-400/40 bg-[linear-gradient(90deg,rgba(34,211,238,0.10),rgba(34,211,238,0.03))] text-cyan-600 dark:bg-[linear-gradient(90deg,rgba(34,211,238,0.16),rgba(34,211,238,0.05))] dark:text-cyan-300",
    badge: "bg-cyan-500/90 text-white dark:bg-cyan-300/85 dark:text-slate-950",
    icon: Zap,
  },
] as const

const diseaseDistribution = [
  { label: "轨道扣件缺失", value: 65, color: "bg-cyan-500 dark:bg-cyan-300" },
  {
    label: "道床板结硬化",
    value: 42,
    color: "bg-fuchsia-500 dark:bg-fuchsia-300",
  },
  {
    label: "钢轨疲磨异常",
    value: 28,
    color: "bg-emerald-500 dark:bg-emerald-300",
  },
] as const

const healthScore = 94

/* ── shared card style ── */
const cardCls =
  "rounded-[26px] border-border/50 bg-card text-card-foreground shadow-[0_18px_60px_rgba(0,0,0,0.06)] dark:border-white/8 dark:bg-[#0c1117] dark:text-white dark:shadow-[0_18px_60px_rgba(0,0,0,0.28)]"

export function HomeOverview() {
  return (
    <section className="relative min-h-full overflow-hidden bg-background text-foreground dark:bg-[#020508]">
      {/* ambient glow – light: softer, dark: original */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.05),transparent_26%),radial-gradient(circle_at_70%_10%,rgba(168,85,247,0.04),transparent_20%)] dark:bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.10),transparent_26%),radial-gradient(circle_at_70%_10%,rgba(168,85,247,0.08),transparent_20%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:56px_56px] dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_center,rgba(0,209,255,0.04),transparent_56%)] dark:bg-[radial-gradient(circle_at_center,rgba(0,209,255,0.08),transparent_56%)]" />

      <div className="container relative space-y-10 px-4 py-8 lg:px-6 lg:py-10">
        {/* ── hero banner ── */}
        <section className="relative overflow-hidden rounded-[32px] border border-border/40 bg-card/80 px-6 py-10 shadow-[0_30px_90px_rgba(0,0,0,0.08)] backdrop-blur-sm lg:px-10 lg:py-14 dark:border-white/6 dark:bg-black/30 dark:shadow-[0_30px_90px_rgba(0,0,0,0.35)]">
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-500/85 dark:text-cyan-300/85">
              Railway Intelligence
            </div>

            <div className="mt-6 leading-none">
              <div className="text-5xl font-black tracking-tight lg:text-7xl">
                <span className="bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-sky-400 dark:to-violet-400">
                  KG知识图谱
                </span>
                <span className="ml-3 text-foreground">平台</span>
              </div>
            </div>

            <p className="mt-8 max-w-3xl text-base leading-8 text-muted-foreground lg:text-lg">
              基于拓扑关系的病害关联分析，实现轨道缺陷的精准定位与全生命周期管理。系统深度整合结构化检测数据、传感器读数及历史维修记录，为轨道病害识别、预警与闭环治理提供统一入口。
            </p>
          </div>

          <div className="mt-10 flex justify-center">
            <Link
              href="/workbench"
              className="inline-flex items-center justify-center rounded-[18px] bg-gradient-to-r from-cyan-500 to-sky-500 px-10 py-4 text-lg font-bold text-white shadow-[0_0_35px_rgba(34,211,238,0.18)] transition hover:shadow-[0_0_50px_rgba(34,211,238,0.32)] dark:from-cyan-300 dark:to-sky-400 dark:text-slate-950 dark:shadow-[0_0_35px_rgba(34,211,238,0.28)] dark:hover:shadow-[0_0_50px_rgba(34,211,238,0.42)]"
            >
              进入系统
            </Link>
          </div>

          <div className="pointer-events-none absolute inset-x-20 bottom-0 h-24 bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.04),transparent_62%)] dark:bg-[radial-gradient(circle_at_center,rgba(163,230,53,0.08),transparent_62%)]" />
        </section>

        {/* ── metrics ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <Gauge className="h-5 w-5 text-foreground" />
            <h2 className="text-2xl font-bold text-foreground">关键数据指标</h2>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            {overviewMetrics.map((metric) => {
              const Icon = metric.icon

              return (
                <Card key={metric.label} className={cardCls}>
                  <CardContent className="space-y-6 p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-base text-muted-foreground">
                          {metric.label}
                        </div>
                        <div className="mt-4 text-4xl font-black tracking-tight lg:text-5xl">
                          {metric.value}
                          <span className="ml-2 text-lg font-semibold text-muted-foreground">
                            {metric.unit}
                          </span>
                        </div>
                        <div
                          className={`mt-3 text-base font-semibold ${metric.color}`}
                        >
                          {metric.hint}
                        </div>
                      </div>
                      <Icon className={`h-7 w-7 ${metric.color}`} />
                    </div>

                    <div className="flex items-end justify-end gap-2">
                      {metric.bars.map((bar, index) => (
                        <div
                          key={`${metric.label}-${index}`}
                          className={`w-5 rounded-md ${metric.barColor} shadow-sm dark:shadow-[0_0_18px_rgba(255,255,255,0.08)]`}
                          style={{ height: `${bar}px` }}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>

        {/* ── threats ── */}
        <Card
          className={`${cardCls} rounded-[28px] dark:shadow-[0_24px_80px_rgba(0,0,0,0.32)]`}
        >
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3 text-red-500 dark:text-red-400">
              <AlertTriangle className="h-5 w-5" />
              <CardTitle className="text-2xl font-bold">潜在威胁监控</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-3">
            {threatItems.map((item) => {
              const Icon = item.icon

              return (
                <div
                  key={item.title}
                  className={`rounded-[18px] border-l-4 px-4 py-4 ${item.tone}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted/60 dark:bg-black/25">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-lg font-bold">{item.title}</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {item.location}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold ${item.badge}`}
                    >
                      {item.level}
                    </span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* ── distribution + health ── */}
        <div className="grid gap-6 xl:grid-cols-12">
          <Card className={`${cardCls} rounded-[28px] xl:col-span-7`}>
            <CardContent className="space-y-6 p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-foreground">
                  近期病害分布
                </h3>
                <button
                  className="text-sm font-medium text-cyan-500 transition hover:text-cyan-400 dark:text-cyan-300 dark:hover:text-cyan-200"
                  type="button"
                >
                  查看全部
                </button>
              </div>

              <div className="space-y-5">
                {diseaseDistribution.map((item) => (
                  <div
                    key={item.label}
                    className="grid grid-cols-[160px_minmax(0,1fr)_56px] items-center gap-4"
                  >
                    <div className="text-base text-muted-foreground">
                      {item.label}
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted/60 dark:bg-white/8">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                    <div className="text-right text-base font-medium text-foreground/80">
                      {item.value}%
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={`${cardCls} rounded-[28px] xl:col-span-5`}>
            <CardContent className="flex h-full flex-col justify-between gap-6 p-6 lg:flex-row lg:items-center">
              <HealthGauge score={healthScore} />

              <div className="space-y-4">
                <h3 className="text-2xl font-bold">系统健康指数</h3>
                <p className="max-w-md text-base leading-8 text-muted-foreground">
                  当前知识图谱解析引擎运行平稳，图谱稠密度维持在 0.85
                  以上，推理一致性检查通过。
                </p>
                <div className="flex flex-wrap gap-3">
                  <StatusPill className="bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300">
                    SAFE
                  </StatusPill>
                  <StatusPill className="bg-cyan-500/15 text-cyan-600 dark:bg-cyan-400/15 dark:text-cyan-300">
                    OPTIMIZED
                  </StatusPill>
                  <StatusPill className="bg-fuchsia-500/15 text-fuchsia-600 dark:bg-fuchsia-400/15 dark:text-fuchsia-300">
                    STABLE
                  </StatusPill>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function HealthGauge({ score }: { score: number }) {
  const size = 150
  const radius = 56
  const circumference = 2 * Math.PI * radius
  const dash = (score / 100) * circumference
  const gap = circumference - dash

  return (
    <div className="relative h-[150px] w-[150px] shrink-0">
      <svg
        aria-hidden="true"
        className="h-full w-full -rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(34,211,238,0.14)"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#5bd5ff"
          strokeDasharray={`${dash} ${gap}`}
          strokeLinecap="round"
          strokeWidth="10"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-4xl font-black text-foreground">
        {score}%
      </div>
    </div>
  )
}

function StatusPill({
  children,
  className,
}: {
  children: ReactNode
  className: string
}) {
  return (
    <span className={`rounded-xl px-3 py-2 text-sm font-bold ${className}`}>
      {children}
    </span>
  )
}
