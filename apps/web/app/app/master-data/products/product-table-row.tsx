'use client';

import { useState } from 'react';
import { MutationActionForm } from '../../_components/mutation-action-form';
import { formatCounterpartyChineseDisplay } from '../../_lib/counterparty-display';
import type {
  PricingMode,
  ProductCategory,
  ProductStage,
  PurchaseCodeMode,
} from './create-product-form';
import type { ProductSupplierOption } from './product-supplier-options';
import { UpdateProductForm } from './update-product-form';
import type { CounterpartyCustomField } from '../counterparties/counterparty-extra-fields';

type ProductTableRowItem = {
  id: number;
  sku: string;
  salesCode?: string;
  purchaseCode?: string;
  purchaseCodeMode?: PurchaseCodeMode;
  productStage?: ProductStage;
  pricingMode?: PricingMode;
  brand?: string;
  factoryName?: string;
  model?: string;
  spec?: string;
  singleWeight?: number | null;
  cartonSpec?: string;
  cartonQuantity?: number | null;
  cartonWeight?: number | null;
  defaultSupplierCode?: string;
  nameCn: string;
  nameEn: string;
  category: ProductCategory;
  unit: string;
  currency: string;
  defaultSalePrice: number;
  defaultPurchasePrice?: number;
  customValues?: Record<string, string>;
  salePriceTiers?: Array<{
    id: number;
    minQuantity: number;
    salePrice: number;
    currency: string;
    status: 'active' | 'inactive' | 'deleted';
  }>;
  ownerName: string;
  status: 'active' | 'inactive' | 'deleted';
  createdAt: string;
  createdBy: string;
  deactivatedReason?: string;
};

type ProductTableRowProps = {
  item: ProductTableRowItem;
  canManageMasterData: boolean;
  salesView?: boolean;
  customFields?: CounterpartyCustomField[];
  updatedBy: string;
  supplierOptions: ProductSupplierOption[];
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  requestHeaders: Record<string, string>;
  apiBaseUrl: string;
  mutationApiBaseUrl?: string;
};

const categoryLabels: Record<ProductCategory, string> = {
  electronics: '电子类 Electronics',
  consumables: '耗材类 Consumables',
  service: '服务类 Service',
};

const productStageLabels: Record<ProductStage, string> = {
  quote_candidate: 'quote_candidate / 报价候选产品',
  formal: 'formal / 正式产品',
};

const pricingModeLabels: Record<PricingMode, string> = {
  fixed: 'fixed / 固定报价',
  tiered: 'tiered / 阶梯报价',
};

const cellStyle = {
  padding: '10px 8px',
  borderBottom: '1px solid #e5ebf2',
  borderRight: '1px solid #e5ebf2',
  fontSize: '13px',
  color: '#0f172a',
  verticalAlign: 'top' as const,
  lineHeight: 1.45,
  background: '#ffffff',
} satisfies React.CSSProperties;

const rowEditingCellStyle = {
  ...cellStyle,
  background: '#f8fbff',
} satisfies React.CSSProperties;

const expandedCellStyle = {
  padding: '0 0 18px',
  borderBottom: '1px solid #e5ebf2',
  borderRight: '1px solid #e5ebf2',
  background: '#f8fbff',
} satisfies React.CSSProperties;

const expandedPanelStyle = {
  margin: '0 16px',
  padding: '18px',
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  background:
    'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.96) 100%)',
  boxShadow: '0 10px 32px rgba(15, 23, 42, 0.04)',
  display: 'grid',
  gap: '16px',
} satisfies React.CSSProperties;

const expandedHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
} satisfies React.CSSProperties;

const expandedTitleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const expandedDescStyle = {
  margin: '6px 0 0',
  fontSize: '13px',
  lineHeight: 1.7,
  color: '#64748b',
} satisfies React.CSSProperties;

const mutedValueStyle = {
  color: '#94a3b8',
} satisfies React.CSSProperties;

const subTextStyle = {
  color: '#64748b',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const stackCellStyle = {
  display: 'grid',
  gap: '4px',
  alignContent: 'start',
} satisfies React.CSSProperties;

const fieldLabelStyle = {
  fontSize: '11px',
  lineHeight: 1.4,
  color: '#64748b',
  fontWeight: 700,
  letterSpacing: '0.02em',
} satisfies React.CSSProperties;

const primaryValueStyle = {
  color: '#0f172a',
  fontWeight: 700,
  lineHeight: 1.45,
} satisfies React.CSSProperties;

const secondaryValueStyle = {
  color: '#334155',
  lineHeight: 1.55,
} satisfies React.CSSProperties;

const actionStackStyle = {
  display: 'flex',
  gap: '6px',
  flexWrap: 'wrap' as const,
  alignItems: 'start',
} satisfies React.CSSProperties;

const statusBadgeBaseStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '999px',
  padding: '5px 10px',
  fontSize: '12px',
  fontWeight: 700,
  width: 'fit-content',
} satisfies React.CSSProperties;

const editTriggerStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '999px',
  padding: '5px 8px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
} satisfies React.CSSProperties;

function formatProductStage(value: ProductStage | undefined) {
  if (!value) {
    return '-';
  }

  return productStageLabels[value] ?? value;
}

function formatPricingMode(value: PricingMode | undefined) {
  if (!value) {
    return '-';
  }

  return pricingModeLabels[value] ?? value;
}

function renderMutedValue(value: string | number | null | undefined, suffix?: string) {
  if (value === null || value === undefined || value === '') {
    return <span style={mutedValueStyle}>-</span>;
  }

  return `${value}${suffix ?? ''}`;
}

function summarizeSalePriceTiers(
  tiers: ProductTableRowItem['salePriceTiers'] | undefined,
  pricingMode: PricingMode | undefined,
) {
  if (pricingMode !== 'tiered') {
    return '固定 1 档';
  }

  const total = tiers?.length ?? 0;
  return total > 0 ? `阶梯 ${total} 档` : '阶梯 0 档';
}

function formatSalePriceTierDetails(
  tiers: ProductTableRowItem['salePriceTiers'] | undefined,
  pricingMode: PricingMode | undefined,
) {
  if (pricingMode !== 'tiered') {
    return [];
  }

  return (tiers ?? []).map((tier) => `>=${tier.minQuantity}: ${tier.salePrice}`);
}

function renderStatusBadge(status: ProductTableRowItem['status']) {
  const style =
    status === 'active'
      ? {
          ...statusBadgeBaseStyle,
          color: '#166534',
          background: '#ecfdf5',
          border: '1px solid #bbf7d0',
        }
      : status === 'inactive'
        ? {
            ...statusBadgeBaseStyle,
            color: '#9f1239',
            background: '#fff1f2',
            border: '1px solid #fecdd3',
          }
        : {
            ...statusBadgeBaseStyle,
            color: '#475569',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
          };

  return (
    <span style={style}>
      {status === 'active' ? '启用中' : status === 'inactive' ? '停用状态' : '已删除'}
    </span>
  );
}

export function ProductTableRow({
  item,
  canManageMasterData,
  salesView = false,
  customFields = [],
  updatedBy,
  supplierOptions,
  actorAccessScopes,
  requestHeaders,
  apiBaseUrl,
  mutationApiBaseUrl = apiBaseUrl,
}: ProductTableRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState(item);
  const [isVisible, setIsVisible] = useState(item.status !== 'deleted');
  const canEditItem = !salesView && canManageMasterData && currentItem.status !== 'deleted';

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <tr>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          <div style={stackCellStyle}>
            <div style={primaryValueStyle}>{currentItem.salesCode || currentItem.sku}</div>
            {!salesView && currentItem.purchaseCode ? <div style={subTextStyle}>{currentItem.purchaseCode}</div> : null}
          </div>
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          <strong style={primaryValueStyle}>{currentItem.nameCn}</strong>
          {currentItem.nameEn ? <div style={subTextStyle}>{currentItem.nameEn}</div> : null}
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          <div style={stackCellStyle}>
            {currentItem.brand ? <div style={primaryValueStyle}>{currentItem.brand}</div> : null}
            <div style={subTextStyle}>{categoryLabels[currentItem.category]}</div>
          </div>
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          <div style={stackCellStyle}>
            {currentItem.model ? <div style={primaryValueStyle}>{currentItem.model}</div> : null}
            {currentItem.spec ? <div style={secondaryValueStyle}>{currentItem.spec}</div> : null}
            <div style={subTextStyle}>{currentItem.unit}</div>
          </div>
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          <div style={stackCellStyle}>
            <div style={primaryValueStyle}>{currentItem.defaultSalePrice} {currentItem.currency}</div>
            <div style={subTextStyle}>{formatProductStage(currentItem.productStage)}</div>
            <div style={subTextStyle}>{summarizeSalePriceTiers(currentItem.salePriceTiers, currentItem.pricingMode)}</div>
          </div>
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          <div style={stackCellStyle}>
            {renderStatusBadge(currentItem.status)}
            {currentItem.deactivatedReason ? (
              <span style={subTextStyle}>{currentItem.deactivatedReason}</span>
            ) : null}
          </div>
        </td>
        <td style={isEditing ? rowEditingCellStyle : cellStyle}>
          <div style={actionStackStyle}>
            <button type="button" style={editTriggerStyle} aria-expanded={isDetailsOpen} onClick={() => setIsDetailsOpen((current) => !current)}>
              {isDetailsOpen ? '收起资料' : '查看资料'}
            </button>
          {canEditItem ? (
            <button
              type="button"
              onClick={() => setIsEditing((current) => !current)}
              aria-expanded={isEditing}
              style={editTriggerStyle}
            >
              {isEditing ? '收起编辑' : '编辑'}
            </button>
          ) : null}
          {!salesView && canManageMasterData && currentItem.status !== 'deleted' ? (
            <details style={{ width: '100%' }}>
              <summary style={{ cursor: 'pointer', color: '#475569', fontSize: '12px' }}>更多操作</summary>
              <div style={{ display: 'grid', gap: '8px', marginTop: '8px' }}>
              {currentItem.status === 'active' ? (
                <MutationActionForm
                  endpoint={`${mutationApiBaseUrl}/products/${currentItem.id}/deactivate`}
                  label="停用"
                  successLabel="操作成功，商品已停用（假删除）"
                  requiredAction="product.write"
                  requiredActionLabel="产品库维护"
                  requestHeaders={requestHeaders}
                  onSuccess={(result) => {
                    const responseItem =
                      typeof result === 'object' && result !== null
                        ? (result as Partial<ProductTableRowItem>)
                        : null;

                    setCurrentItem((previous) => ({
                      ...previous,
                      ...responseItem,
                      status: responseItem?.status ?? 'inactive',
                      deactivatedReason:
                        typeof responseItem?.deactivatedReason === 'string'
                          ? responseItem.deactivatedReason
                          : '商品停用',
                    }));
                  }}
                  fields={[
                    { name: 'operatedBy', value: updatedBy },
                    { name: 'reason', value: '商品停用' },
                  ]}
                />
              ) : (
                <MutationActionForm
                  endpoint={`${mutationApiBaseUrl}/products/${currentItem.id}/activate`}
                  label="启用"
                  successLabel="操作成功，商品已重新启用"
                  requiredAction="product.write"
                  requiredActionLabel="产品库维护"
                  requestHeaders={requestHeaders}
                  onSuccess={(result) => {
                    const responseItem =
                      typeof result === 'object' && result !== null
                        ? (result as Partial<ProductTableRowItem>)
                        : null;

                    setCurrentItem((previous) => ({
                      ...previous,
                      ...responseItem,
                      status: responseItem?.status ?? 'active',
                      deactivatedReason: undefined,
                    }));
                  }}
                  fields={[
                    { name: 'operatedBy', value: updatedBy },
                    { name: 'reason', value: '恢复商品启用' },
                  ]}
                />
              )}
              <MutationActionForm
                endpoint={`${mutationApiBaseUrl}/products/${currentItem.id}/delete`}
                label="删除"
                successLabel="操作成功，商品已删除并退出业务调用"
                requiredAction="product.write"
                requiredActionLabel="产品库维护"
                requestHeaders={requestHeaders}
                onSuccess={(result) => {
                  const responseItem =
                    typeof result === 'object' && result !== null
                      ? (result as Partial<ProductTableRowItem>)
                      : null;

                  setCurrentItem((previous) => ({
                    ...previous,
                    ...responseItem,
                    status: responseItem?.status ?? 'deleted',
                    deactivatedReason:
                      typeof responseItem?.deactivatedReason === 'string'
                        ? responseItem.deactivatedReason
                        : '删除商品',
                  }));
                  setIsEditing(false);
                  setIsVisible(false);
                }}
                fields={[
                  { name: 'operatedBy', value: updatedBy },
                  { name: 'reason', value: '删除商品' },
                ]}
              />
              {currentItem.productStage === 'quote_candidate' ? (
                <MutationActionForm
                  endpoint={`${mutationApiBaseUrl}/products/${currentItem.id}/convert-to-formal`}
                  label="转正式产品"
                  successLabel="操作成功，候选产品已转为正式产品"
                  requiredAction="product.write"
                  requiredActionLabel="产品库维护"
                  requestHeaders={requestHeaders}
                  onSuccess={(result) => {
                    const responseItem =
                      typeof result === 'object' && result !== null
                        ? (result as Partial<ProductTableRowItem>)
                        : null;

                    setCurrentItem((previous) => ({
                      ...previous,
                      ...responseItem,
                      productStage: responseItem?.productStage ?? 'formal',
                    }));
                  }}
                  fields={[{ name: 'operatedBy', value: updatedBy }]}
                />
              ) : null}
              </div>
            </details>
          ) : null}
          </div>
        </td>
      </tr>
      {isDetailsOpen ? <tr>
        <td style={expandedCellStyle} colSpan={7}>
          <div style={expandedPanelStyle} role="region" aria-label={`${currentItem.nameCn}产品资料`}>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
              <div><dt style={fieldLabelStyle}>产品编码 Product Code</dt><dd style={{ margin: 0 }}>{currentItem.salesCode || currentItem.sku}</dd></div>
              {!salesView ? <>
                <div><dt style={fieldLabelStyle}>采购编码 Purchase</dt><dd style={{ margin: 0 }}>{renderMutedValue(currentItem.purchaseCode)}</dd></div>
                <div><dt style={fieldLabelStyle}>工厂 Factory</dt><dd style={{ margin: 0 }}>{renderMutedValue(formatCounterpartyChineseDisplay(currentItem.factoryName, { code: currentItem.defaultSupplierCode }))}</dd></div>
                <div><dt style={fieldLabelStyle}>供应商编码 Supplier Code</dt><dd style={{ margin: 0 }}>{renderMutedValue(currentItem.defaultSupplierCode)}</dd></div>
                <div><dt style={fieldLabelStyle}>默认采购价</dt><dd style={{ margin: 0 }}>{currentItem.defaultPurchasePrice == null ? '-' : `${currentItem.defaultPurchasePrice} ${currentItem.currency}`}</dd></div>
              </> : null}
              <div><dt style={fieldLabelStyle}>单个重量 Weight</dt><dd style={{ margin: 0 }}>{renderMutedValue(currentItem.singleWeight, ' kg')}</dd></div>
              <div><dt style={fieldLabelStyle}>装箱规格 Carton Spec</dt><dd style={{ margin: 0 }}>{renderMutedValue(currentItem.cartonSpec)}</dd></div>
              <div><dt style={fieldLabelStyle}>装箱数量 Carton Qty</dt><dd style={{ margin: 0 }}>{renderMutedValue(currentItem.cartonQuantity)}</dd></div>
              <div><dt style={fieldLabelStyle}>装箱重量 Carton Weight</dt><dd style={{ margin: 0 }}>{renderMutedValue(currentItem.cartonWeight, ' kg')}</dd></div>
              <div><dt style={fieldLabelStyle}>定价方式 Pricing Mode</dt><dd style={{ margin: 0 }}>{formatPricingMode(currentItem.pricingMode)}</dd></div>
              <div><dt style={fieldLabelStyle}>阶梯售价</dt><dd style={{ margin: 0 }}>{formatSalePriceTierDetails(currentItem.salePriceTiers, currentItem.pricingMode).map((entry) => <div key={entry}>{entry}</div>)}</dd></div>
            </dl>
          </div>
        </td>
      </tr> : null}
      {isEditing ? (
        <tr>
          <td style={expandedCellStyle} colSpan={7}>
            <div style={expandedPanelStyle}>
              <div style={expandedHeaderStyle}>
                <div>
                  <h4 style={expandedTitleStyle}>{currentItem.nameCn}</h4>
                  <p style={expandedDescStyle}>
                    在展开面板中按正式版分组维护产品资料、包装信息和价格规则，保存后当前页会自动刷新。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={editTriggerStyle}
                >
                  关闭面板
                </button>
              </div>
              <UpdateProductForm
                endpoint={`${mutationApiBaseUrl}/products/${currentItem.id}`}
                item={currentItem}
                updatedBy={updatedBy}
                supplierOptions={supplierOptions}
                customFields={customFields}
                actorAccessScopes={actorAccessScopes}
                onSuccess={(nextItem) => {
                  setCurrentItem((previous) => ({
                    ...previous,
                    ...nextItem,
                  }));
                }}
              />
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
