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
  submit: '提交记录',
  approve: '审批通过',
  reject: '审批驳回',
  assign_purchase_owner: '分配采购负责人',
  approve_demand: '审批需求单',
  advance_quote_version: '更新报价版本',
  boss_confirm_quote_price: '老板确认报价售价',
  convert_demand_to_quote: '需求单转报价单',
  convert_demand_quote_to_sales: '需求单转销售单',
  create_quote_from_inquiry: '询价确认后生成报价单',
  record_customer_feedback: '记录客户反馈',
  update_quote_draft: '保存需求或报价草稿',
  update_sales_order_draft: '保存销售单草稿',
  sync_sales_order_operational_aggregates: '同步销售单流程状态',
  reject_inquiry_by_boss: '老板驳回询价',
  submit_inquiry_for_comparison: '提交询价比价',
  cancel_purchase_order: '取消采购单',
  sync_purchase_order_shipment_status: '同步采购单发货状态',
  update_factory_eta: '更新工厂预计交货时间',
  convert_product_to_formal: '转为正式产品',
  delete_product: '删除产品',
  sync_confirmed_inquiry: '同步询价确认资料',
  create_product_custom_field: '新增产品自定义字段',
  delete_product_custom_field: '删除产品自定义字段',
  create_counterparty_custom_field: '新增往来单位自定义字段',
  delete_counterparty_custom_field: '删除往来单位自定义字段',
  update_user_role: '修改账号角色',
  approve_after_sales: '审批售后单',
  close_after_sales: '关闭售后单',
  confirm_after_sales_finance: '确认售后财务',
  finish_after_sales: '完成售后处理',
  reject_after_sales: '驳回售后单',
  start_after_sales_processing: '开始处理售后',
  submit_after_sales: '提交售后单',
  cancel_sample_order: '取消样品单',
  close_sample_order_no_followup: '结束样品跟进',
  confirm_sample_order: '确认样品结果',
  create_sample_order_version: '新增样品版本',
  mark_sample_order_sent: '登记样品寄出',
  reject_sample_order: '驳回样品单',
  save_sample_order_draft: '保存样品草稿',
  start_sample_order_sampling: '开始打样',
  mark_shipment_exception: '登记发货异常',
  mark_shipment_forwarder_shipped: '登记货代发出',
  mark_shipment_to_forwarder: '登记交付货代',
  send_shipment_receipt: '发送发货回单',
  upload_shipment_receipt: '上传发货回单',
  create_stock_in: '登记入库',
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
  syncSource: '同步来源',
  salesCode: '产品编码',
  purchaseCodeMode: '采购编码方式',
  salesCodeMode: '产品编码方式',
  singleWeight: '单件重量',
  cartonQuantity: '装箱数量',
  cartonWeight: '外箱毛重',
  defaultSupplierCode: '默认供应商编码',
  nameCn: '中文名称',
  currency: '币种',
  defaultSalePrice: '默认售价',
  defaultPurchasePrice: '默认采购价',
  salePriceTiers: '阶梯售价',
  minQuantity: '起订数量',
  customValues: '自定义字段值',
  deactivatedAt: '停用时间',
  deactivatedBy: '停用操作人',
  deactivatedReason: '停用原因',
  productId: '产品编号',
  productSku: '产品编码',
  productStatus: '产品状态',
  productSizeCm: '产品尺寸',
  productMaterial: '材质',
  productPackaging: '包装',
  productWeightG: '产品重量',
  bulkLeadTimeDays: '大货交期',
  outerCartonSizeCm: '外箱尺寸',
  outerCartonGrossWeightKg: '外箱毛重',
  supplierSourceMode: '供应商录入方式',
  selectedSupplierQuoteIndex: '选定供应商报价序号',
  supplierQuoteCount: '供应商报价数',
  confirmedSupplierQuoteIndex: '确认供应商报价序号',
  confirmedSupplierId: '确认供应商编号',
  confirmedSupplierCode: '确认供应商编码',
  confirmedSupplierName: '确认供应商名称',
  confirmedPurchasePrice: '确认采购价',
  confirmedProductId: '确认产品编号',
  documentType: '单据类型',
  productSource: '产品来源',
  productCategory: '产品分类',
  customerEntryMode: '客户录入方式',
  inquiryDate: '询单日期',
  quoteAttachments: '报价附件',
  submitMode: '保存方式',
  linkedInquiryId: '关联询价单编号',
  linkedInquiryNo: '关联询价单号',
  linkedInquiryStatus: '关联询价单状态',
  linkedInquiryVersionNo: '关联询价版本',
  sourceDemandId: '来源需求单编号',
  sourceDemandNo: '来源需求单号',
  sourceDemandSnapshot: '来源需求快照',
  linkedQuoteId: '关联报价单编号',
  linkedQuoteNo: '关联报价单号',
  customerFeedbackResult: '客户反馈结果',
  customerFeedbackRemark: '客户反馈备注',
  customerFeedbackBy: '客户反馈操作人',
  customerFeedbackAt: '客户反馈时间',
  customerFeedbackHistory: '客户反馈历史',
  linkedSalesOrderId: '关联销售单编号',
  linkedSalesOrderNo: '关联销售单号',
  fileName: '文件名称',
  mimeType: '文件类型',
  url: '附件地址',
  key: '附件标识',
  packageQuantity: '件数',
  unitsPerPackage: '每件数量',
  totalQuantity: '总数量',
  factoryPicUrls: '工厂图片',
  sourceQuoteLineNo: '来源报价行号',
  operatedBy: '操作人',
  operatedAt: '操作时间',
  result: '结果',
  snapshot: '版本快照',
  deleted: '是否删除',
  contactName: '联系人',
  phone: '电话',
  email: '邮箱',
  address: '地址',
  bankName: '开户银行',
  bankAccount: '银行账号',
  region: '地区',
  shortName: '单位简称',
  paymentTerms: '付款条款',
  paymentMethod: '付款方式',
  openingReceivable: '期初应收款',
  payableReceivable: '应付应收款',
  unitTags: '单位标签',
  cooperationStatus: '合作状态',
  settlementMethod: '结算方式',
  factorySourceMode: '工厂来源',
  purchaseOrderId: '采购单编号',
  purchaseOrderNo: '采购单号',
  purchaseOrderAttachments: '采购单附件',
  purchaseLineNo: '采购明细行号',
  purchaseQty: '采购数量',
  purchaseUnit: '采购单位',
  purchasingUnit: '采购单位',
  sourceSalesOrderId: '来源销售单编号',
  sourceSalesItemId: '来源销售行编号',
  salesItemId: '销售明细编号',
  salesOrderNo: '销售单号',
  salesOrderAttachments: '销售单附件',
  salesOrderAttachment: '销售单附件',
  sourceDocumentType: '来源单据类型',
  sourceQuoteNo: '来源报价单号',
  sourceQuoteOrderId: '来源报价单编号',
  sourceQuoteVersionNo: '来源报价版本',
  sourceQuoteOrderNo: '来源报价单号',
  quoteOrderId: '报价单编号',
  quoteOrderNo: '报价单号',
  quoteVersionNo: '报价版本',
  lockedPurchaseOwner: '采购负责人已锁定',
  cancelReason: '取消原因',
  changeReason: '变更原因',
  closeReason: '关闭原因',
  currentStatus: '当前状态',
  secondaryStatus: '次级状态',
  arrivalStatus: '到货状态',
  stockInStatus: '入库状态',
  stockOutStatus: '出库状态',
  receiptCollectionStatus: '收款状态',
  financeReviewStatus: '财务复核状态',
  hasProductionStarted: '是否开始生产',
  salesOrderLocked: '销售单是否锁定',
  quoteConfirmed: '报价是否确认',
  sampleNo: '样品单号',
  sampleOrderId: '样品单编号',
  sampleQuantity: '样品数量',
  sampleRequirements: '样品要求',
  samplingCost: '打样费用',
  moldFee: '模具费用',
  domesticCourierFee: '国内快递费',
  internationalCourierFee: '国际快递费',
  domesticTrackingNo: '国内物流单号',
  isCancelled: '是否取消',
  isReplacement: '是否补单',
  replacedVersionNo: '替换版本号',
  shipmentBatchId: '发货批次编号',
  shipmentBatchNo: '发货批次单号',
  shipmentLineNo: '发货明细行号',
  shipmentQty: '发货数量',
  shippedQty: '已发货数量',
  remainingQty: '剩余数量',
  accumulatedQty: '累计数量',
  totalPackages: '总件数',
  factoryShipDate: '工厂发货日期',
  factoryEstimatedDeliveryDate: '工厂预计交货日期',
  forwarderShipDate: '货代发出日期',
  freightForwarder: '货代',
  freightStation: '货站',
  domesticFreight: '国内运费',
  hasException: '是否异常',
  exceptionReason: '异常原因',
  receiptSentBy: '回单发送人',
  receiptDocUrl: '回单地址',
  shippingMark: '唛头',
  shippingCode: '出运编号',
  shippingCodeItems: '出运明细',
  shippedAt: '发货时间',
  warehouseEntryNo: '仓库入库编号',
  stockInDocNo: '入库单号',
  stockOutDocNo: '出库单号',
  afterSalesNo: '售后单号',
  issueDescription: '问题说明',
  affectedQty: '涉及数量',
  estimatedArrivalDate: '预计到货日期',
  estimatedCompletionDate: '预计完成日期',
  estimatedDeliveryDate: '预计交货日期',
  comparisonSubmittedBy: '比价提交人',
  comparisonSummary: '比价摘要',
  supplierCount: '供应商数量',
  currentBatchCount: '当前批次数',
  internalCode: '内部编码',
  internalProductCode: '内部产品编码',
  salesProductCode: '销售产品编码',
  orderCode: '订单编号',
  goodsName: '货品名称',
  importantEnglishTitle: '英文标题',
  strategy: '编码策略',
  serialLength: '流水号长度',
  serialScope: '流水号范围',
  segments: '编码组成',
  initialStatus: '初始状态',
  itemCount: '明细数量',

  sku: '产品编码',
  lineNo: '行号',
  name: '名称',
  nameEn: '英文名称',
  code: '编码',
  fullName: '全称',
  type: '类型',
  unit: '单位',
  qty: '数量',
  targetPrice: '目标价',
  salePrice: '销售单价',
  salesPrice: '销售单价',
  purchasePrice: '采购价',
  customerPrice: '客户价',
  confirmedSalePrice: '老板确认售价',
  totalAmount: '总金额',
  amount: '金额',
  purchaseOwnerId: '采购负责人编号',
  purchaseOwnerName: '采购负责人',
  purchaseUserId: '采购负责人编号',
  purchaseUserName: '采购负责人',
  supplierCode: '供应商编码',
  supplierQuotes: '供应商报价',
  selectedSupplierId: '选定供应商编号',
  selectedSupplierName: '选定供应商',
  finalSupplierId: '最终供应商编号',
  finalSupplierName: '最终供应商',
  minSupplierCount: '最低比价供应商数',
  remark: '备注',
  reason: '原因',
  attachments: '附件',
  imageUrls: '图片',
  images: '图片',
  customFields: '自定义字段',
  label: '字段名称',
  fieldType: '字段类型',
  isActive: '是否启用',
  enabled: '是否启用',
  productStage: '产品阶段',
  pricingMode: '定价方式',
  productCode: '产品编码',
  purchaseCode: '采购编码',
  category: '分类',
  brand: '品牌',
  model: '型号',
  spec: '规格',
  material: '材质',
  size: '尺寸',
  weight: '产品重量',
  productWeight: '产品重量',
  packaging: '包装',
  cartonQty: '装箱数量',
  cartonSpec: '装箱规格',
  cartonSize: '外箱尺寸',
  cartonGrossWeight: '外箱毛重',
  leadTime: '大货交期',
  factoryName: '工厂名称',
  factoryEta: '工厂预计交货时间',
  inquiryId: '来源询价单编号',
  quoteId: '来源需求或报价单编号',
  salesOrderId: '来源销售单编号',
  sourceQuoteId: '来源报价单编号',
  sourceInquiryId: '来源询价单编号',
  sourceVersionNo: '来源版本号',
  versionNo: '版本号',
  currentVersion: '当前版本',
  draft: '草稿',
  sampleInfo: '打样信息',
  samplingInfo: '打样信息',
  trackingNo: '物流单号',
  carrier: '承运商',
  receiptAttachments: '回单附件',
  sentAt: '寄出时间',
  receiptSentAt: '回单发送时间',
  forwarderName: '货代名称',
  shipmentType: '发货方式',
  refundAmount: '退款金额',
  processRemark: '处理备注',
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

export function formatAuditOperationType(operationType: string, chineseOnly = false) {
  const normalized = operationType.trim();
  const label = operationTypeLabels[normalized] ?? toHumanText(normalized);
  return chineseOnly ? operationTypeLabels[normalized] ?? '其他操作' : `${label} / ${normalized}`;
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

export function formatAuditCreatedAt(createdAt: string, precise = false) {
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
    ...(precise ? { second: '2-digit' as const, timeZone: 'Asia/Shanghai' } : {}),
    hour12: false,
  }).format(date);
}

function buildDetailedAuditChanges(item: AuditLogItem): AuditChangeSummary {
  const rows: AuditChangeSummary['rows'] = [];
  const enumLabels: Record<string, Record<string, string>> = {
    syncSource: { purchase_order: '采购单', shipment_batch: '发货批次' },
    sourceMode: { direct: '直营', quote: '报价转单' },
    documentType: { demand: '需求单', quote: '报价单' },
    sourceDocumentType: { demand: '需求单', quote: '报价单' },
    productSource: { manual: '手填产品', product: '产品库', existing: '产品库' },
    customerEntryMode: { existing: '往来单位选择', manual: '手填客户' },
    supplierSourceMode: { counterparty: '往来单位选择', manual: '手填供应商' },
    factorySourceMode: { supplier: '供应商', manual: '手填工厂' },
    productStage: { quote_candidate: '报价产品', formal: '正式产品' },
    pricingMode: { fixed: '固定售价', tiered: '阶梯售价' },
    cooperationStatus: { cooperated: '已合作', uncooperated: '未合作' },
    submitMode: { draft: '保存草稿', submit: '提交审批' },
  };
  const display = (field: string, value: unknown): string => {
    if (value === undefined || value === null || value === '') return '-';
    if (typeof value === 'boolean') return value ? '是' : '否';
    if (typeof value === 'string') {
      if (field === 'status' && item.bizType === 'quote') {
        return formatQuoteStatus(value).replace(/^[^/]+ \/ /, '');
      }
      if (/status|progress/i.test(field)) return value === 'pending_purchase_assignment' ? '待分配采购负责人' : statusValueLabels[value] ?? value;
      return enumLabels[field]?.[value] ?? value;
    }
    if (Array.isArray(value)) return value.map((entry) => display(field, entry)).join('、') || '-';
    return String(value);
  };
  const visit = (before: unknown, after: unknown, path: string, field: string) => {
    if (normalizeComparableValue(before) === normalizeComparableValue(after)) return;
    if (isPlainRecord(before) || isPlainRecord(after)) {
      const left = isPlainRecord(before) ? before : {};
      const right = isPlainRecord(after) ? after : {};
      for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
        if (/password|secret|token/i.test(key)) continue;
        const label = fieldLabels[key] ?? (/[^\x00-\x7F]/.test(key) ? key : `扩展字段（${key}）`);
        visit(left[key], right[key], path ? `${path}·${label}` : label, key);
      }
    } else if ((Array.isArray(before) && before.some(isPlainRecord)) || (Array.isArray(after) && after.some(isPlainRecord))) {
      const left = Array.isArray(before) ? before : [];
      const right = Array.isArray(after) ? after : [];
      for (let index = 0; index < Math.max(left.length, right.length); index++) {
        visit(left[index], right[index], `${path}第${index + 1}${field === 'items' ? '行' : '项'}`, field);
      }
    } else {
      const beforeValue = display(field, before);
      const afterValue = display(field, after);
      if (beforeValue !== afterValue) rows.push({ field: path || '记录内容', before: beforeValue, after: afterValue });
    }
  };
  visit(item.beforeData, item.afterData, '', '');
  return {
    title: !item.beforeData ? '新建记录' : !item.afterData ? '移除记录' : rows.length ? '字段变更' : '记录已保存，无字段差异',
    rows,
  };
}

export function buildAuditChangeSummary(item: AuditLogItem, detailed = false): AuditChangeSummary {
  if (detailed) return buildDetailedAuditChanges(item);
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
