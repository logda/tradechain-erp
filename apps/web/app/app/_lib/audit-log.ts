import { formatQuoteStatus } from './quote-status';

export type AuditLogItem = {
  id: number;
  bizType: string;
  bizId: number;
  operationType: string;
  operatorId: number;
  operatorName?: string;
  beforeData?: unknown;
  afterData?: unknown;
  createdAt: string;
};

export type AuditLogResponse = {
  items: AuditLogItem[];
};

export type UnifiedAuditLogItem = AuditLogItem & {
  moduleKey: string;
  moduleLabel: string;
};

export type UnifiedAuditModuleSummary = {
  key: string;
  label: string;
  count: number;
  failed: boolean;
};

export type UnifiedAuditLogResponse = {
  modules: UnifiedAuditModuleSummary[];
  items: UnifiedAuditLogItem[];
};

export type AuditChangeSummary = {
  title: string;
  rows: Array<{
    field: string;
    before: string;
    after: string;
  }>;
};

const operationTypeLabels: Record<string, string> = {
  login: '登录系统',
  create: '创建记录',
  update: '更新记录',
  delete: '删除记录',
  create_quote: '创建报价单',
  submit_quote: '提交报价单',
  approve_quote: '确认报价单',
  reject_quote: '驳回报价单',
  convert_quote_to_sales: '报价转销售单',
  create_quote_inquiry: '创建询价单',
  submit_quote_inquiry: '提交询价',
  boss_confirm_inquiry: '老板确认询价',
  create_sample_order: '创建样品单',
  submit_sample_order: '提交样品单',
  approve_sample_order: '确认样品单',
  create_sales_order: '创建销售单',
  submit_sales_order: '提交销售单',
  approve_sales_order: '确认销售单',
  reject_sales_order: '驳回销售单',
  update_sales_order_status: '更新销售单状态',
  finance_confirm: '财务确认',
  create_purchase_orders_from_sales: '销售单生成采购单',
  create_purchase_order: '创建采购单',
  save_purchase_order_draft: '保存采购单草稿',
  submit_purchase_order: '提交采购单',
  approve_purchase_order: '采购主管确认',
  reject_purchase_order: '采购主管驳回',
  resubmit_purchase_order: '重提采购单',
  create_shipment_batch: '创建发货批次',
  mark_shipment_departed: '标记已发货',
  mark_shipment_arrived: '标记已到货',
  mark_forwarder_received: '货代已收货',
  mark_forwarder_shipped: '货代已发出',
  create_after_sales_order: '创建售后单',
  create_after_sales: '创建售后单',
  process_after_sales_order: '处理售后单',
  close_after_sales_order: '关闭售后单',
  create_counterparty: '创建往来单位',
  update_counterparty: '更新往来单位',
  deactivate_counterparty: '停用往来单位',
  activate_counterparty: '启用往来单位',
  create_product: '创建商品',
  update_product: '更新商品',
  deactivate_product: '停用商品',
  activate_product: '启用商品',
  create_user: '创建账号',
  update_user: '更新账号',
  deactivate_user: '停用账号',
  activate_user: '启用账号',
  update_role_permission: '更新角色权限',
};

const bizTypeLabels: Record<string, string> = {
  quote: '需求单 / 报价单',
  quote_inquiry: '询价单',
  sample_order: '样品单',
  sales_order: '销售单',
  purchase_order: '采购单',
  shipment_batch: '发货批次',
  after_sales: '售后单',
  counterparty: '往来单位',
  product: '商品',
  user: '账号',
  role_permission: '角色权限',
};

const fieldLabels: Record<string, string> = {
  id: '内部ID',
  docNo: '单据编号',
  quoteNo: '报价单号',
  inquiryNo: '询价单号',
  salesNo: '销售单号',
  purchaseNo: '采购单号',
  shipmentNo: '发货单号',
  status: '状态',
  currentProgress: '当前进度',
  currentVersionNo: '版本号',
  customerId: '客户ID',
  customerCode: '客户编码',
  customerName: '客户名称',
  customerFullName: '客户中文名称',
  orderingUnit: '订货单位',
  supplierId: '供应商ID',
  supplierName: '供应商名称',
  supplierFullName: '供应商中文名称',
  title: '标题',
  customerOrderNo: '客户订单号',
  storeName: '门店',
  orderDate: '订货日期',
  deadline: '截止日期',
  shipTo: '收货地址',
  destination: '目的地',
  requirements: '需求说明',
  salesOrderRemark: '销售备注',
  sourceCode: '来源编码',
  sourceMode: '来源方式',
  salesUserId: '销售ID',
  salesUserName: '销售负责人',
  ownerName: '负责人',
  ownerUserId: '负责人ID',
  createdBy: '创建人',
  updatedBy: '更新人',
  createdAt: '创建时间',
  updatedAt: '更新时间',
  purchaseAggregateStatus: '采购联动状态',
  shipmentAggregateStatus: '发货联动状态',
  receiptSendStatus: '回单发送状态',
  receiptStatus: '收款状态',
  financeStatus: '财务状态',
  afterSalesEndStatus: '售后状态',
  items: '明细行',
  versionHistory: '版本历史',
  productName: '商品名称',
  productNo: '货品编码',
  unitPrice: '单价',
  quantity: '数量',
  fullAccess: '全量权限',
  roleCode: '角色',
  modules: '模块权限',
  dataScope: '数据范围',
  actions: '操作权限',
  username: '用户名',
  realName: '姓名',
};

const statusValueLabels: Record<string, string> = {
  draft: '草稿',
  rejected: '已驳回',
  submitted: '已提交',
  quoted: '已报价',
  revised: '已修订',
  ordered: '已转订单',
  closed: '已关闭',
  pending_boss_confirmation: '待老板确认',
  pending_boss_confirm: '待老板确认',
  boss_confirmed: '老板已确认',
  pending_sales_manager_approval: '待销售主管审批',
  pending_purchase_claim: '待采购认领',
  pending_purchase_manager_approval: '待采购主管审批',
  purchasing: '采购中',
  partial_purchasing: '部分采购中',
  shipped: '已发货',
  partial_shipped: '部分已发货',
  arrived: '已到货',
  partial_arrived: '部分到货',
  to_forwarder: '已交货代',
  forwarder_shipped: '货代已发出',
  pending: '待处理',
  confirmed: '已确认',
  approved: '已确认',
  active: '启用',
  inactive: '停用',
  unpaid: '未收款',
  paid: '已收款',
  not_started: '未开始',
  in_progress: '进行中',
  done: '已完成',
  void: '已作废',
};

const fallbackOperatorNames: Record<number, string> = {
  0: '系统',
  1: 'Admin',
  2: 'Mia',
  3: 'Zoe',
  4: 'Leo',
  2000: 'Mia',
  2001: 'Zoe',
  2002: 'Leo',
  9000: 'Admin',
};

function isAuditLogItem(value: unknown): value is AuditLogItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as AuditLogItem).id === 'number' &&
    typeof (value as AuditLogItem).bizType === 'string' &&
    typeof (value as AuditLogItem).bizId === 'number' &&
    typeof (value as AuditLogItem).operationType === 'string' &&
    typeof (value as AuditLogItem).operatorId === 'number' &&
    ((value as AuditLogItem).operatorName === undefined ||
      typeof (value as AuditLogItem).operatorName === 'string') &&
    typeof (value as AuditLogItem).createdAt === 'string'
  );
}

function isUnifiedAuditLogItem(value: unknown): value is UnifiedAuditLogItem {
  return (
    isAuditLogItem(value) &&
    typeof (value as UnifiedAuditLogItem).moduleKey === 'string' &&
    typeof (value as UnifiedAuditLogItem).moduleLabel === 'string'
  );
}

function isUnifiedAuditModuleSummary(
  value: unknown,
): value is UnifiedAuditModuleSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as UnifiedAuditModuleSummary).key === 'string' &&
    typeof (value as UnifiedAuditModuleSummary).label === 'string' &&
    typeof (value as UnifiedAuditModuleSummary).count === 'number' &&
    typeof (value as UnifiedAuditModuleSummary).failed === 'boolean'
  );
}

export function hasValidAuditLogResponse(value: unknown): value is AuditLogResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as AuditLogResponse).items) &&
    (value as AuditLogResponse).items.every(isAuditLogItem)
  );
}

export function hasValidUnifiedAuditLogResponse(
  value: unknown,
): value is UnifiedAuditLogResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as UnifiedAuditLogResponse).modules) &&
    (value as UnifiedAuditLogResponse).modules.every(isUnifiedAuditModuleSummary) &&
    Array.isArray((value as UnifiedAuditLogResponse).items) &&
    (value as UnifiedAuditLogResponse).items.every(isUnifiedAuditLogItem)
  );
}

function toHumanText(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeComparableValue(value: unknown) {
  if (Array.isArray(value) || isPlainRecord(value)) {
    return JSON.stringify(value);
  }

  return value ?? null;
}

export function formatAuditOperationType(operationType: string) {
  const normalized = operationType.trim();
  const label = operationTypeLabels[normalized] ?? toHumanText(normalized);
  return `${label} / ${normalized}`;
}

export function formatAuditBizObject(item: Pick<AuditLogItem, 'bizType' | 'bizId'>) {
  const label = bizTypeLabels[item.bizType] ?? toHumanText(item.bizType);
  return `${label} #${item.bizId}`;
}

function readNameFromAuditData(value: unknown) {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  const candidateKeys = [
    'operatorName',
    'updatedBy',
    'createdBy',
    'salesUserName',
    'ownerName',
    'sentByName',
    'receiptSentByName',
  ];

  for (const key of candidateKeys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

export function formatAuditOperator(item: {
  operatorId: number;
  operatorName?: string;
  beforeData?: unknown;
  afterData?: unknown;
}) {
  const name =
    item.operatorName?.trim() ||
    readNameFromAuditData(item.afterData) ||
    readNameFromAuditData(item.beforeData) ||
    fallbackOperatorNames[item.operatorId];
  return name ? `${name} #${item.operatorId}` : `操作人 #${item.operatorId}`;
}

export function formatAuditFieldName(field: string) {
  return fieldLabels[field] ?? toHumanText(field);
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (typeof value === 'boolean') {
    return value ? '是 / Yes' : '否 / No';
  }

  if (typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return '-';
    }

    const statusLabel = statusValueLabels[trimmed];
    if (statusLabel) {
      return `${statusLabel} / ${trimmed}`;
    }

    return trimmed;
  }

  if (Array.isArray(value)) {
    return value.length > 0 ? `${value.length} 项` : '空';
  }

  if (isPlainRecord(value)) {
    const entries = Object.entries(value).filter(([, entryValue]) => entryValue !== undefined);
    if (entries.length === 0) {
      return '空';
    }

    const preview = entries
      .slice(0, 2)
      .map(([key, entryValue]) => `${formatAuditFieldName(key)}: ${formatAuditValue(entryValue)}`)
      .join('，');
    return entries.length > 2 ? `${preview} 等 ${entries.length} 项` : preview;
  }

  return String(value);
}

export function formatAuditCreatedAt(createdAt: string) {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function buildAuditChangeSummary(item: AuditLogItem): AuditChangeSummary {
  const beforeRecord = isPlainRecord(item.beforeData) ? item.beforeData : null;
  const afterRecord = isPlainRecord(item.afterData) ? item.afterData : null;
  const formatFieldValue = (field: string, value: unknown) =>
    item.bizType === 'quote' && field === 'status' && typeof value === 'string'
      ? formatQuoteStatus(value)
      : formatAuditValue(value);

  if (!beforeRecord && afterRecord) {
    const rows = Object.entries(afterRecord)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .slice(0, 4)
      .map(([field, value]) => ({
        field: formatAuditFieldName(field),
        before: '-',
        after: formatFieldValue(field, value),
      }));

    return {
      title: '新建记录',
      rows,
    };
  }

  if (beforeRecord && !afterRecord) {
    const rows = Object.entries(beforeRecord)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .slice(0, 4)
      .map(([field, value]) => ({
        field: formatAuditFieldName(field),
        before: formatFieldValue(field, value),
        after: '-',
      }));

    return {
      title: '移除记录',
      rows,
    };
  }

  if (beforeRecord && afterRecord) {
    const fields = Array.from(
      new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]),
    );
    const rows = fields
      .filter(
        (field) =>
          normalizeComparableValue(beforeRecord[field]) !==
          normalizeComparableValue(afterRecord[field]),
      )
      .slice(0, 5)
      .map((field) => ({
        field: formatAuditFieldName(field),
        before: formatFieldValue(field, beforeRecord[field]),
        after: formatFieldValue(field, afterRecord[field]),
      }));

    return {
      title: rows.length > 0 ? '字段变更' : '记录已保存，无字段差异',
      rows,
    };
  }

  return {
    title: '无结构化变更',
    rows: [],
  };
}
