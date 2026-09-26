import Link from 'next/link';
import { formatSampleOrderStatus } from '@erp/shared';
import { AppShell } from '../../../_components/app-shell';
import { AuditLogTable } from '../../../_components/audit-log-table';
import { ActionPermissionNote } from '../../../_components/action-permission-note';
import { ImagePreviewGallery } from '../../../_components/image-preview-gallery';
import { MutationActionForm } from '../../../_components/mutation-action-form';
import {
  canViewFormalModule,
  resolveDemoSession,
} from '../../../_lib/demo-session';
import {
  canUseFormalSampleApprovalAction,
  canUseFormalSamplePurchaseExecutionAction,
  canUseFormalSampleSalesExecutionAction,
  canViewFormalSampleDetail,
  getFormalDetailAccessDeniedLabel,
} from '../../../_lib/formal-access';
import { hasValidAuditLogResponse, type AuditLogResponse } from '../../../_lib/audit-log';
import { loadActiveCounterpartyOptions } from '../../../_lib/counterparty-options';
import { formatCounterpartyChineseDisplay } from '../../../_lib/counterparty-display';
import { buildFormalRequestHeaders } from '../../../_lib/formal-request-headers';
import { buildSignedFormalRequestHeaders } from '../../../_lib/formal-request-signature';
import { SamplePurchaseExecutionForm } from './sample-purchase-execution-form';

type SearchParams = Record<string, string | string[] | undefined>;

type AppSampleOrderDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<SearchParams>;
};

type SampleOrderDetail = {
  id: number;
  sampleNo: string;
  currentVersionNo: number;
  currentStatus: string;
  sourceQuoteOrderId?: number;
  sourceQuoteVersionNo?: number;
  createdAt?: string;
  sampleRequirements?: string;
  samplingCost?: number | null;
  importantEnglishTitle?: string;
  orderCode?: string;
  purchaseUnit?: string;
  salesProductCode?: string;
  internalProductCode?: string;
  imageUrls?: string[];
  sampleQuantity?: number;
  estimatedCompletionDate?: string;
  freightForwarder?: string;
  domesticTrackingNo?: string;
  domesticCourierFee?: number | null;
  internationalCourierFee?: number | null;
  estimatedArrivalDate?: string;
};

function getSampleApiBaseUrl() {
  return process.env.ERP_API_BASE_URL ?? 'http://127.0.0.1:3001/api';
}

function hasValidSampleDetail(value: unknown): value is SampleOrderDetail {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as SampleOrderDetail).id === 'number' &&
    typeof (value as SampleOrderDetail).sampleNo === 'string' &&
    typeof (value as SampleOrderDetail).currentVersionNo === 'number' &&
    typeof (value as SampleOrderDetail).currentStatus === 'string'
  );
}

function resolveUserId(user: string) {
  if (user === 'Zoe') {
    return 2001;
  }

  if (user === 'Leo') {
    return 2002;
  }

  return 2000;
}

async function loadSampleDetail(id: string, session: { role: string; user: string }) {
  if (!id.trim()) {
    return null;
  }

  try {
    const response = await fetch(`${getSampleApiBaseUrl()}/samples/${id}`, {
      cache: 'no-store',
      headers: {
        ...buildFormalRequestHeaders(session),
        ...buildSignedFormalRequestHeaders(session),
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidSampleDetail(result) ? result : null;
  } catch {
    return null;
  }
}

async function loadSampleAuditLogs(session: { role: string; user: string }) {
  try {
    const response = await fetch(`${getSampleApiBaseUrl()}/samples/audit-logs`, {
      cache: 'no-store',
      headers: {
        ...buildFormalRequestHeaders(session),
        ...buildSignedFormalRequestHeaders(session),
      },
    });

    if (!response.ok) {
      return null;
    }

    const result = (await response.json().catch(() => null)) as unknown;
    return hasValidAuditLogResponse(result) ? result : null;
  } catch {
    return null;
  }
}

const detailLayoutStyle = {
  display: 'grid',
  gap: '18px',
} satisfies React.CSSProperties;

const backLinkStyle = {
  color: '#0f172a',
  textDecoration: 'none',
  fontWeight: 700,
} satisfies React.CSSProperties;

const heroCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '20px',
  padding: '22px 24px',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, #fff8ed 100%)',
  boxShadow: '0 18px 56px rgba(15, 23, 42, 0.08)',
} satisfies React.CSSProperties;

const heroEyebrowStyle = {
  margin: 0,
  fontSize: '12px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
} satisfies React.CSSProperties;

const heroTitleStyle = {
  margin: '10px 0 8px',
  fontSize: '32px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const heroSubStyle = {
  margin: 0,
  fontSize: '15px',
  color: '#475569',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '16px',
} satisfies React.CSSProperties;

const infoCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  padding: '18px',
  background: 'rgba(255,255,255,0.92)',
  boxShadow: '0 12px 36px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const labelStyle = {
  margin: 0,
  fontSize: '12px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
} satisfies React.CSSProperties;

const valueStyle = {
  margin: '10px 0 0',
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const actionPanelStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '22px',
  padding: '22px',
  background:
    'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.94) 100%)',
  boxShadow: '0 18px 54px rgba(15, 23, 42, 0.08)',
} satisfies React.CSSProperties;

const actionGridStyle = {
  display: 'grid',
  gap: '18px',
  gridTemplateColumns: 'minmax(0, 1fr)',
  alignItems: 'stretch',
} satisfies React.CSSProperties;

const actionPanelHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '16px',
  flexWrap: 'wrap' as const,
  marginBottom: '16px',
} satisfies React.CSSProperties;

const actionPanelTitleStyle = {
  margin: 0,
  fontSize: '18px',
  color: '#0f172a',
  fontWeight: 800,
} satisfies React.CSSProperties;

const actionPanelSubtitleStyle = {
  margin: '6px 0 0',
  color: '#64748b',
  fontSize: '13px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const statusPillStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  padding: '7px 12px',
  background: '#f8fafc',
  color: '#334155',
  fontSize: '12px',
  fontWeight: 800,
  whiteSpace: 'nowrap' as const,
} satisfies React.CSSProperties;

function isPurchaseSampleView(role: string) {
  return role === 'purchase' || role === 'purchase_manager';
}

function isSalesSampleView(role: string) {
  return role === 'sales' || role === 'sales_manager';
}

function formatSampleValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '0';
  }

  return String(value);
}

function formatSampleDate(value: string | null | undefined) {
  if (!value) {
    return '0';
  }

  return value.slice(0, 10);
}

function resolveSampleProductCode(sampleOrder: SampleOrderDetail) {
  return sampleOrder.salesProductCode || sampleOrder.internalProductCode || '';
}

function isSampleStatus(sampleOrder: SampleOrderDetail, status: string) {
  return sampleOrder.currentStatus === status;
}

function getSampleNextStepHint(status: string) {
  const hints: Record<string, string> = {
    draft: '下一步：采购先补充打样信息并保存，再提交样品审批',
    pending_approval: '下一步：销售主管审批，通过后进入待打样',
    pending_sampling: '下一步：采购开始打样',
    sampling: '下一步：采购标记已寄样',
    sample_sent: '下一步：销售跟进客户反馈，选择客户下单、再次打样或无后续',
    customer_confirmed: '流程已完成：客户确认下单',
    closed_no_followup: '流程已结束：客户暂无后续',
    canceled: '流程已结束：样品单已取消',
    replaced: '流程已转入替代版本：请跟进新版本样品单',
  };

  return hints[status] ?? '下一步：请按当前业务状态确认处理人';
}

function getSampleActionNote(status: string) {
  if (status === 'draft') {
    return '草稿状态由采购补齐打样信息并保存，再提交给主管审批。';
  }

  if (status === 'sample_sent') {
    return '已寄样后按客户反馈选择：客户下单、再次打样或无后续。';
  }

  return '当前可操作动作会根据样品单状态自动切换：提交审批、审批、开始打样、标记寄样和客户反馈。';
}

export default async function AppSampleOrderDetailPage({
  params,
  searchParams,
}: AppSampleOrderDetailPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const session = resolveDemoSession(resolvedSearchParams);
  const canViewSalesSamples = canViewFormalModule(session, 'sales');
  const canViewPurchaseSamples = canViewFormalModule(session, 'purchase');
  const sampleBoardHref = canViewPurchaseSamples && !canViewSalesSamples
    ? '/app/purchase'
    : '/app/sales';
  const showSalesFields =
    session.role === 'admin' ||
    session.role === 'boss' ||
    isSalesSampleView(session.role);
  const showPurchaseFields =
    session.role === 'admin' ||
    session.role === 'boss' ||
    isPurchaseSampleView(session.role);

  if (!canViewSalesSamples && !canViewPurchaseSamples) {
    return (
      <AppShell
        title="正式样品单详情"
        subtitle="样品单详情加载失败。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <article style={heroCardStyle}>
            <h3 style={heroTitleStyle}>{getFormalDetailAccessDeniedLabel('sample')}</h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张样品单。</p>
          </article>
        </section>
      </AppShell>
    );
  }

  const [sampleOrder, auditLogs] = await Promise.all([
    loadSampleDetail(resolvedParams.id, session),
    loadSampleAuditLogs(session),
  ]);
  const createdBy = resolveUserId(session.user);
  const actionRequestHeaders = buildFormalRequestHeaders(
    session.role === 'admin'
      ? { role: session.role, user: session.user }
      : session,
  );

  if (!sampleOrder) {
    return (
      <AppShell
        title="正式样品单详情"
        subtitle="样品单详情加载失败。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <article style={heroCardStyle}>
            <h3 style={heroTitleStyle}>样品单详情加载失败</h3>
            <p style={heroSubStyle}>请返回正式样品单列表后重试。</p>
          </article>
        </section>
      </AppShell>
    );
  }

  const canSubmitSample =
    canUseFormalSamplePurchaseExecutionAction(session) &&
    isSampleStatus(sampleOrder, 'draft');
  const canSaveDraftSample =
    canUseFormalSamplePurchaseExecutionAction(session) &&
    isSampleStatus(sampleOrder, 'draft');
  const canApproveSample =
    canUseFormalSampleApprovalAction(session) &&
    isSampleStatus(sampleOrder, 'pending_approval');
  const canStartSampling =
    canUseFormalSamplePurchaseExecutionAction(session) &&
    isSampleStatus(sampleOrder, 'pending_sampling');
  const canMarkSent =
    canUseFormalSamplePurchaseExecutionAction(session) &&
    isSampleStatus(sampleOrder, 'sampling');
  const canHandleCustomerFeedback =
    canUseFormalSampleSalesExecutionAction(session) &&
    isSampleStatus(sampleOrder, 'sample_sent');
  const supplierOptions = canSaveDraftSample
    ? await loadActiveCounterpartyOptions('supplier', session)
    : [];

  if (!canViewFormalSampleDetail(session)) {
    return (
      <AppShell
        title="正式样品单详情"
        subtitle="样品单详情加载失败。"
        session={session}
      >
        <section style={detailLayoutStyle}>
          <article style={heroCardStyle}>
            <h3 style={heroTitleStyle}>{getFormalDetailAccessDeniedLabel('sample')}</h3>
            <p style={heroSubStyle}>当前登录账号没有权限查看这张样品单。</p>
          </article>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="正式样品单详情"
      subtitle="展示样品单版本、报价追溯、替代版本、取消规则和样品生命周期动作。"
      session={session}
    >
      <section style={detailLayoutStyle}>

        <article style={heroCardStyle}>
          <p style={heroEyebrowStyle}>Sample Order Detail / 样品单详情</p>
          <h3 style={heroTitleStyle}>{`样品单 ${sampleOrder.sampleNo}`}</h3>
          <p style={heroSubStyle}>
            样品单必须追溯到已确认报价版本，替代版本和取消动作需要保留原因，避免转销售时失去版本依据。
          </p>
        </article>

        <div style={gridStyle}>
          <article style={infoCardStyle}>
            <p style={labelStyle}>状态 Status</p>
            <p style={valueStyle}>
              {formatSampleOrderStatus(sampleOrder.currentStatus)}
            </p>
            <p style={heroSubStyle}>
              {getSampleNextStepHint(sampleOrder.currentStatus)}
            </p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>版本 Version</p>
            <p style={valueStyle}>V{sampleOrder.currentVersionNo}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>下单日期 Order Date</p>
            <p style={valueStyle}>{`下单日期：${formatSampleDate(sampleOrder.createdAt)}`}</p>
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>来源报价 Quote</p>
            <p style={valueStyle}>{`报价单 ID：${sampleOrder.sourceQuoteOrderId ?? '-'}`}</p>
            {sampleOrder.sourceQuoteOrderId ? (
              <Link
                href={`/app/sales/quotes/${sampleOrder.sourceQuoteOrderId}`}
                style={{ ...backLinkStyle, display: 'inline-flex', marginTop: '10px' }}
              >
                查看来源报价 {sampleOrder.sourceQuoteOrderId}
              </Link>
            ) : null}
          </article>
          <article style={infoCardStyle}>
            <p style={labelStyle}>报价版本 Quote Version</p>
            <p style={valueStyle}>{`报价版本：V${sampleOrder.sourceQuoteVersionNo ?? '-'}`}</p>
          </article>
        </div>

        <article style={infoCardStyle}>
          <h3 style={{ marginTop: 0 }}>样品基础信息</h3>
          <ImagePreviewGallery
            productName={`样品单 ${sampleOrder.sampleNo}`}
            imageUrls={sampleOrder.imageUrls}
          />
          <p style={heroSubStyle}>
            {sampleOrder.sampleRequirements ?? '暂无样品要求'}
          </p>
          <p style={valueStyle}>{`产品编码：${formatSampleValue(resolveSampleProductCode(sampleOrder))}`}</p>
          <p style={valueStyle}>{`订单编码：${formatSampleValue(sampleOrder.orderCode)}`}</p>
          <p style={valueStyle}>{`数量：${formatSampleValue(sampleOrder.sampleQuantity)}`}</p>
          <p style={valueStyle}>{`打样费：${formatSampleValue(sampleOrder.samplingCost)}`}</p>
        </article>

        {showSalesFields ? (
          <article style={infoCardStyle}>
            <h3 style={{ marginTop: 0 }}>客户确认信息</h3>
            <div style={gridStyle}>
              <article style={infoCardStyle}>
                <p style={labelStyle}>商品名称</p>
                <p style={valueStyle}>
                  {formatSampleValue(sampleOrder.importantEnglishTitle)}
                </p>
              </article>
              <article style={infoCardStyle}>
                <p style={labelStyle}>销售产品编码 / 订货编码</p>
                <p style={valueStyle}>
                  {formatSampleValue(sampleOrder.salesProductCode)}
                </p>
              </article>
            </div>
          </article>
        ) : null}

        {showPurchaseFields ? (
          <article style={infoCardStyle}>
            <h3 style={{ marginTop: 0 }}>打样执行信息</h3>
            <div style={gridStyle}>
              <article style={infoCardStyle}>
                <p style={labelStyle}>采购单位</p>
                <p style={valueStyle}>
                  {formatSampleValue(
                    formatCounterpartyChineseDisplay(sampleOrder.purchaseUnit),
                  )}
                </p>
              </article>
              <article style={infoCardStyle}>
                <p style={labelStyle}>国内快递号</p>
                <p style={valueStyle}>
                  {formatSampleValue(sampleOrder.domesticTrackingNo)}
                </p>
              </article>
              <article style={infoCardStyle}>
                <p style={labelStyle}>货代 / 国际快递</p>
                <p style={valueStyle}>
                  {formatSampleValue(sampleOrder.freightForwarder)}
                </p>
              </article>
              <article style={infoCardStyle}>
                <p style={labelStyle}>国内快递费用</p>
                <p style={valueStyle}>
                  {`国内快递费用：${formatSampleValue(sampleOrder.domesticCourierFee)}`}
                </p>
              </article>
              <article style={infoCardStyle}>
                <p style={labelStyle}>国际快递费用</p>
                <p style={valueStyle}>
                  {`国际快递费用：${formatSampleValue(sampleOrder.internationalCourierFee)}`}
                </p>
              </article>
              <article style={infoCardStyle}>
                <p style={labelStyle}>预计完成日期</p>
                <p style={valueStyle}>
                  {`预计完成日期：${formatSampleValue(sampleOrder.estimatedCompletionDate)}`}
                </p>
              </article>
              <article style={infoCardStyle}>
                <p style={labelStyle}>预计到达日期</p>
                <p style={valueStyle}>
                  {`预计到达日期：${formatSampleValue(sampleOrder.estimatedArrivalDate)}`}
                </p>
              </article>
            </div>
          </article>
        ) : null}

        <article style={actionPanelStyle}>
          <div style={actionPanelHeaderStyle}>
            <div>
              <h3 style={actionPanelTitleStyle}>流程操作</h3>
              <p style={actionPanelSubtitleStyle}>
                系统会按样品单当前状态和账号权限，只展示下一步可执行动作。
              </p>
            </div>
            <span style={statusPillStyle}>
              {formatSampleOrderStatus(sampleOrder.currentStatus)}
            </span>
          </div>
          <ActionPermissionNote>{getSampleActionNote(sampleOrder.currentStatus)}</ActionPermissionNote>
          <div style={actionGridStyle}>
            {canSaveDraftSample ? (
              <SamplePurchaseExecutionForm
                endpoint={`${getSampleApiBaseUrl()}/samples/${sampleOrder.id}/save-draft`}
                submitEndpoint={
                  canSubmitSample
                    ? `${getSampleApiBaseUrl()}/samples/${sampleOrder.id}/submit`
                    : undefined
                }
                label="保存草稿"
                submitLabel="提交样品审批"
                currentStatus={sampleOrder.currentStatus}
                supplierOptions={supplierOptions}
                requestHeaders={actionRequestHeaders}
                variant="draft"
                initialPurchaseUnit={sampleOrder.purchaseUnit}
                initialEstimatedCompletionDate={sampleOrder.estimatedCompletionDate}
                initialSampleRequirements={sampleOrder.sampleRequirements ?? ''}
                initialSamplingCost={sampleOrder.samplingCost ?? 0}
                initialSampleQuantity={sampleOrder.sampleQuantity ?? 0}
              />
            ) : null}
            {canApproveSample ? (
              <>
                <MutationActionForm
                  endpoint={`${getSampleApiBaseUrl()}/samples/${sampleOrder.id}/approve`}
                  label="通过样品审批"
                  requiredAction="sales.sample.approve"
                  requiredActionLabel="样品审批"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'currentStatus',
                      value: sampleOrder.currentStatus,
                    },
                  ]}
                />
                <MutationActionForm
                  endpoint={`${getSampleApiBaseUrl()}/samples/${sampleOrder.id}/reject`}
                  label="驳回样品审批"
                  requiredAction="sales.sample.approve"
                  requiredActionLabel="样品审批"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'currentStatus',
                      value: sampleOrder.currentStatus,
                    },
                  ]}
                />
              </>
            ) : null}
            {canStartSampling ? (
              <MutationActionForm
                endpoint={`${getSampleApiBaseUrl()}/samples/${sampleOrder.id}/start-sampling`}
                label="开始打样"
                successLabel="已开始打样"
                requiredAction="purchase.sample.execute"
                requiredActionLabel="采购样品执行"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: sampleOrder.currentStatus,
                  },
                ]}
              />
            ) : null}
            {canMarkSent ? (
              <MutationActionForm
                endpoint={`${getSampleApiBaseUrl()}/samples/${sampleOrder.id}/mark-sent`}
                label="标记已寄样"
                requiredAction="purchase.sample.execute"
                requiredActionLabel="采购样品执行"
                requestHeaders={actionRequestHeaders}
                fields={[
                  {
                    name: 'currentStatus',
                    value: sampleOrder.currentStatus,
                  },
                  {
                    name: 'freightForwarder',
                    value: sampleOrder.freightForwarder ?? '',
                    display: 'input',
                    label: '货代 / 国际快递',
                    placeholder: '例如：DHL / FedEx / 货代公司',
                    required: true,
                  },
                  {
                    name: 'domesticTrackingNo',
                    value: sampleOrder.domesticTrackingNo ?? '',
                    display: 'input',
                    label: '国内快递单号',
                    placeholder: '例如：SF123456789CN',
                    required: true,
                    helpText: '寄样时填写，后续可用于追踪样品发出节点。',
                  },
                  {
                    name: 'domesticCourierFee',
                    value: sampleOrder.domesticCourierFee ?? 0,
                    dataType: 'number',
                    display: 'input',
                    label: '国内快递费用',
                    inputType: 'number',
                  },
                  {
                    name: 'internationalCourierFee',
                    value: sampleOrder.internationalCourierFee ?? 0,
                    dataType: 'number',
                    display: 'input',
                    label: '国际快递费用',
                    inputType: 'number',
                  },
                  {
                    name: 'estimatedArrivalDate',
                    value: sampleOrder.estimatedArrivalDate ?? '',
                    display: 'input',
                    label: '预计到达日期',
                    inputType: 'date',
                  },
                ]}
              />
            ) : null}
            {canHandleCustomerFeedback ? (
              <>
                <MutationActionForm
                  endpoint={`${getSampleApiBaseUrl()}/samples/${sampleOrder.id}/mark-customer-confirmed`}
                  label="客户下单"
                  successLabel="已记录客户下单"
                  requiredAction="sales.sample.execute"
                  requiredActionLabel="样品执行"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'currentStatus',
                      value: sampleOrder.currentStatus,
                    },
                  ]}
                />
                <MutationActionForm
                  endpoint={`${getSampleApiBaseUrl()}/samples/${sampleOrder.id}/versions`}
                  label="再次打样"
                  successLabel="已进入再次打样"
                  requiredAction="sales.sample.execute"
                  requiredActionLabel="样品执行"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'currentStatus',
                      value: sampleOrder.currentStatus,
                    },
                    {
                      name: 'currentVersionNo',
                      value: sampleOrder.currentVersionNo,
                      dataType: 'number',
                    },
                    {
                      name: 'createdBy',
                      value: createdBy,
                      dataType: 'number',
                    },
                    {
                      name: 'sampleRequirements',
                      value: `${sampleOrder.sampleRequirements ?? '正式页替代样品'} / replacement`,
                    },
                    {
                      name: 'changeReason',
                      value: '客户反馈后需要再次打样',
                    },
                    {
                      name: 'samplingCost',
                      value: sampleOrder.samplingCost ?? 0,
                      dataType: 'number',
                    },
                  ]}
                />
                <MutationActionForm
                  endpoint={`${getSampleApiBaseUrl()}/samples/${sampleOrder.id}/close-no-followup`}
                  label="无后续"
                  successLabel="已记录无后续"
                  requiredAction="sales.sample.execute"
                  requiredActionLabel="样品执行"
                  requestHeaders={actionRequestHeaders}
                  fields={[
                    {
                      name: 'currentStatus',
                      value: sampleOrder.currentStatus,
                    },
                    {
                      name: 'closeReason',
                      value: '客户确认暂无后续',
                    },
                  ]}
                />
              </>
            ) : null}
          </div>
        </article>

        <AuditLogTable session={session} items={auditLogs?.items ?? []} />
      </section>
    </AppShell>
  );
}
