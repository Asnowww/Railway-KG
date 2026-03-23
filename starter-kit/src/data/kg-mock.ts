import kgRealData from "./kg-real.json"

export type KnowledgeNodeType =
  | "defect"
  | "defect-genre"
  | "facility"
  | "factor"
  | "function"
  | "measure"
  | "rail-system"
  | "component"
  | "technique"
  | "risk"

export interface KnowledgeDocument {
  id: string
  title: string
  source: string
  updatedAt: string
  location: string
  confidence: number
  tags: string[]
  summary: string
  text: string
}

export interface KnowledgeNode {
  id: string
  label: string
  type: KnowledgeNodeType
  categoryLabel?: string
  mentions?: number
  confidence?: number
  summary?: string
  properties?: { label: string; value: string }[]
}

export interface KnowledgeLink {
  id: string
  source: string
  target: string
  relation: string
  confidence?: number
  evidence?: string
}

export const nodeTypeMeta: Record<
  KnowledgeNodeType,
  { label: string; color: string; tint: string }
> = {
  defect: {
    label: "病害",
    color: "#f97360",
    tint: "rgba(249, 115, 96, 0.16)",
  },
  "defect-genre": {
    label: "病害类别",
    color: "#ff8c42",
    tint: "rgba(255, 140, 66, 0.16)",
  },
  facility: {
    label: "设施",
    color: "#31b3a4",
    tint: "rgba(49, 179, 164, 0.16)",
  },
  factor: {
    label: "因素",
    color: "#f2b44f",
    tint: "rgba(242, 180, 79, 0.16)",
  },
  function: {
    label: "功能",
    color: "#4ade80",
    tint: "rgba(74, 222, 128, 0.16)",
  },
  measure: {
    label: "措施",
    color: "#2bb8d6",
    tint: "rgba(43, 184, 214, 0.16)",
  },
  "rail-system": {
    label: "轨道系统",
    color: "#5b8def",
    tint: "rgba(91, 141, 239, 0.16)",
  },
  component: {
    label: "部件",
    color: "#818cf8",
    tint: "rgba(129, 140, 248, 0.16)",
  },
  technique: {
    label: "技术",
    color: "#9a6bff",
    tint: "rgba(154, 107, 255, 0.16)",
  },
  risk: {
    label: "风险",
    color: "#fb923c",
    tint: "rgba(251, 146, 60, 0.16)",
  },
}

export const knowledgeDocuments: KnowledgeDocument[] = [
  {
    id: "doc-1",
    title: "巡检记录 A-17",
    source: "轨道巡检日报",
    updatedAt: "2026-03-19 09:20",
    location: "京沪线 K134+280 曲线段",
    confidence: 0.92,
    tags: ["原始文本", "人工巡检", "高优先级"],
    summary: "记录描述了左股钢轨掉块、轨面剥离与轮轨冲击声增强的共现情况。",
    text: `巡检人员在京沪线 K134+280 曲线段发现左股钢轨表面存在明显掉块，剥离边界呈片状扩展，局部伴随发白擦痕。现场复核时，列车通过瞬间可听到连续性轮轨冲击声，且冲击位置集中在第 3 至第 5 枕木区域。

同一位置附近轨枕存在轻微横向位移，扣件外观未见断裂，但轨距波动相较上周加剧。结合近三日湿滑天气和高密度通行记录，怀疑病害已从表层磨耗发展为结构性剥离，需要进行超声复核与夜间综合维修安排。`,
  },
  {
    id: "doc-2",
    title: "复核纪要 B-04",
    source: "工务复核工单",
    updatedAt: "2026-03-18 22:45",
    location: "K134+280 - K134+320",
    confidence: 0.88,
    tags: ["结构化抽取", "复核结论"],
    summary: "复核强调轨道几何异常与轨枕位移对病害发展存在放大效应。",
    text: `复核组对 K134+280 至 K134+320 区间进行了轨检小车测量，发现左股高低与方向两项指标在病害附近同步抬升，说明冲击来源并非单一表层缺陷。现场记录显示，异常点与既有轨枕位移重合，病害受力条件持续恶化。

建议优先建立"病害 - 轨道几何异常 - 轨枕位移 - 轮轨冲击"的关联子图，并将该区段纳入本周重点监测。若超声检测结果进一步确认内部裂纹，则需直接转入钢轨更换方案。`,
  },
  {
    id: "doc-3",
    title: "环境说明 C-02",
    source: "调度与气象汇总",
    updatedAt: "2026-03-17 18:10",
    location: "K134+280 周边区段",
    confidence: 0.81,
    tags: ["环境因子", "背景信息"],
    summary: "湿滑环境和高峰时段车流可能提高轮轨冲击与损伤扩展风险。",
    text: `过去 72 小时内，区段累计降雨量偏高，轨面附着状态较差。晚高峰时段列车运行密度较大，曲线段轮轨作用增强，病害位置受到重复冲击。调度记录中未发现限速措施，说明风险仍处于可监测但需快速干预的阶段。

综合判断，该病害具备从局部表面伤损向运营风险演化的可能，建议将环境因子作为知识图谱中的风险放大节点，为后续预警模型提供上下文。`,
  },
]

export const knowledgeNodes: KnowledgeNode[] = (
  kgRealData as { nodes: { id: string; label: string; type: string }[] }
).nodes.map((n) => ({
  id: n.id,
  label: n.label,
  type: n.type as KnowledgeNodeType,
}))

export const knowledgeLinks: KnowledgeLink[] = (
  kgRealData as {
    links: { id: string; source: string; target: string; relation: string }[]
  }
).links.map((l) => ({
  id: l.id,
  source: l.source,
  target: l.target,
  relation: l.relation,
}))
