export type KnowledgeNodeType =
  | "fault"
  | "location"
  | "component"
  | "symptom"
  | "risk"
  | "action"

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
  categoryLabel: string
  mentions: number
  confidence: number
  summary: string
  properties: { label: string; value: string }[]
}

export interface KnowledgeLink {
  id: string
  source: string
  target: string
  relation: string
  confidence: number
  evidence: string
}

export const nodeTypeMeta: Record<
  KnowledgeNodeType,
  { label: string; color: string; tint: string }
> = {
  fault: {
    label: "病害",
    color: "#f97360",
    tint: "rgba(249, 115, 96, 0.16)",
  },
  location: {
    label: "位置",
    color: "#31b3a4",
    tint: "rgba(49, 179, 164, 0.16)",
  },
  component: {
    label: "部件",
    color: "#5b8def",
    tint: "rgba(91, 141, 239, 0.16)",
  },
  symptom: {
    label: "表征",
    color: "#9a6bff",
    tint: "rgba(154, 107, 255, 0.16)",
  },
  risk: {
    label: "风险",
    color: "#f2b44f",
    tint: "rgba(242, 180, 79, 0.16)",
  },
  action: {
    label: "处置",
    color: "#2bb8d6",
    tint: "rgba(43, 184, 214, 0.16)",
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

建议优先建立“病害 - 轨道几何异常 - 轨枕位移 - 轮轨冲击”的关联子图，并将该区段纳入本周重点监测。若超声检测结果进一步确认内部裂纹，则需直接转入钢轨更换方案。`,
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

export const knowledgeNodes: KnowledgeNode[] = [
  {
    id: "fault-spall",
    label: "左股钢轨掉块",
    type: "fault",
    categoryLabel: "核心病害",
    mentions: 18,
    confidence: 0.95,
    summary: "病害核心实体，和轨面剥离、轮轨冲击、几何异常存在强关联。",
    properties: [
      { label: "病害等级", value: "Level II" },
      { label: "首次发现", value: "2026-03-17" },
      { label: "定位区间", value: "K134+280" },
      { label: "处置状态", value: "待夜间维修" },
    ],
  },
  {
    id: "location-curve",
    label: "K134+280 曲线段",
    type: "location",
    categoryLabel: "定位锚点",
    mentions: 12,
    confidence: 0.93,
    summary: "病害出现的主要空间锚点，也是多条证据文本的共同定位区间。",
    properties: [
      { label: "区段类型", value: "曲线段" },
      { label: "风险热度", value: "高" },
      { label: "监测频次", value: "每日复核" },
      { label: "邻近区间", value: "K134+320" },
    ],
  },
  {
    id: "symptom-peeling",
    label: "轨面剥离",
    type: "symptom",
    categoryLabel: "外观表征",
    mentions: 11,
    confidence: 0.9,
    summary: "属于肉眼可见表征，和掉块共同出现时通常提示病害已进入扩展阶段。",
    properties: [
      { label: "外观特征", value: "片状边界" },
      { label: "出现频次", value: "高频" },
      { label: "证据来源", value: "巡检记录 A-17" },
    ],
  },
  {
    id: "component-sleeper",
    label: "轨枕位移",
    type: "component",
    categoryLabel: "部件状态",
    mentions: 8,
    confidence: 0.84,
    summary: "轨枕横向位移会放大轮轨冲击，对病害发展具有诱发作用。",
    properties: [
      { label: "位移方向", value: "横向轻微偏移" },
      { label: "关联影响", value: "几何异常放大" },
      { label: "最近复核", value: "2026-03-18" },
    ],
  },
  {
    id: "risk-impact",
    label: "轮轨冲击",
    type: "risk",
    categoryLabel: "运营风险",
    mentions: 13,
    confidence: 0.91,
    summary: "列车通过时连续冲击声增强，是当前最直观的风险信号。",
    properties: [
      { label: "风险等级", value: "高" },
      { label: "触发场景", value: "列车高速通过" },
      { label: "影响范围", value: "第 3 至第 5 枕木区域" },
    ],
  },
  {
    id: "risk-geometry",
    label: "轨道几何异常",
    type: "risk",
    categoryLabel: "结构风险",
    mentions: 9,
    confidence: 0.87,
    summary: "高低与方向指标同步抬升，说明病害并非单点偶发。",
    properties: [
      { label: "主要指标", value: "高低 / 方向" },
      { label: "关联工单", value: "复核纪要 B-04" },
      { label: "变化趋势", value: "较上周加剧" },
    ],
  },
  {
    id: "risk-weather",
    label: "湿滑环境",
    type: "risk",
    categoryLabel: "环境因素",
    mentions: 6,
    confidence: 0.79,
    summary: "环境因子不是直接病害，但会提高轮轨作用强度与扩展概率。",
    properties: [
      { label: "时间窗口", value: "过去 72 小时" },
      { label: "来源", value: "调度与气象汇总" },
      { label: "建议用途", value: "风险放大节点" },
    ],
  },
  {
    id: "action-ultrasonic",
    label: "超声复核",
    type: "action",
    categoryLabel: "建议动作",
    mentions: 7,
    confidence: 0.89,
    summary: "用于确认内部裂纹是否形成，是钢轨更换决策前的关键动作。",
    properties: [
      { label: "执行窗口", value: "今日夜间" },
      { label: "优先级", value: "P1" },
      { label: "输出结果", value: "裂纹复核报告" },
    ],
  },
  {
    id: "action-repair",
    label: "夜间综合维修",
    type: "action",
    categoryLabel: "处置动作",
    mentions: 5,
    confidence: 0.85,
    summary: "在不影响日间运营的情况下，优先处理病害位置及相关轨枕状态。",
    properties: [
      { label: "排班状态", value: "待确认" },
      { label: "协同团队", value: "工务 + 调度" },
      { label: "预期效果", value: "降低短期冲击风险" },
    ],
  },
]

export const knowledgeLinks: KnowledgeLink[] = [
  {
    id: "link-1",
    source: "fault-spall",
    target: "location-curve",
    relation: "发生于",
    confidence: 0.96,
    evidence: "巡检记录 A-17 明确指向 K134+280 曲线段。",
  },
  {
    id: "link-2",
    source: "fault-spall",
    target: "symptom-peeling",
    relation: "表现为",
    confidence: 0.94,
    evidence: "掉块与轨面剥离在同一原始文本中被反复共同描述。",
  },
  {
    id: "link-3",
    source: "fault-spall",
    target: "risk-impact",
    relation: "诱发",
    confidence: 0.92,
    evidence: "列车通过时的连续轮轨冲击与病害位置高度重合。",
  },
  {
    id: "link-4",
    source: "component-sleeper",
    target: "risk-geometry",
    relation: "放大",
    confidence: 0.85,
    evidence: "轨枕横向位移与轨道几何异常共同出现。",
  },
  {
    id: "link-5",
    source: "risk-geometry",
    target: "fault-spall",
    relation: "加剧",
    confidence: 0.83,
    evidence: "复核纪要 B-04 认为几何异常不是独立现象。",
  },
  {
    id: "link-6",
    source: "risk-weather",
    target: "risk-impact",
    relation: "放大",
    confidence: 0.8,
    evidence: "湿滑环境会增强曲线段轮轨作用。",
  },
  {
    id: "link-7",
    source: "action-ultrasonic",
    target: "fault-spall",
    relation: "复核",
    confidence: 0.89,
    evidence: "超声检测用于确认病害是否已形成内部裂纹。",
  },
  {
    id: "link-8",
    source: "action-repair",
    target: "risk-impact",
    relation: "缓解",
    confidence: 0.82,
    evidence: "夜间维修目标是优先压低冲击风险。",
  },
]
