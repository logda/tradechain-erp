'use client';

import React from 'react';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { useMutationAttempt } from '../../../_lib/use-mutation-attempt';
import { createMutationRequestKey } from '../../../_lib/mutation-request-key';
import {
  autosaveSalesOrderDraftAction,
  createSalesOrderAction,
  updateSalesOrderDraftAction,
  type SalesOrderFormState,
} from './actions';
import {
  CounterpartyPicker,
  formatCounterpartyOptionLabel,
} from '../../../_components/counterparty-picker';
import type { CounterpartyOption } from '../../../_lib/counterparty-options';
import type { ProductOption } from '../../../_lib/product-options';
import { serializeProductOption } from '../../../_lib/product-option-serialization';

type SalesUserOption = {
  id: number;
  label: string;
};

type SalesOrderItemDraft = {
  id: number;
  productEntryMode: 'existing' | 'manual';
  preserveSavedSalePrice: boolean;
  productOption: string;
  productId: number;
  sku: string;
  productName: string;
  factoryPicUrls: string[];
  packageQuantity: string;
  unitsPerPackage: string;
  cartonQuantity: string;
  outerCartonSizeCm: string;
  outerCartonGrossWeightKg: string;
  unit: string;
  salePrice: string;
};

type InitialSalesOrderAttachment = {
  key?: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

export type InitialSalesOrderFormValue = {
  id: number;
  customerId?: number;
  customerEntryMode?: 'existing' | 'manual';
  customerName?: string;
  customerCode?: string;
  customerOrderNo?: string;
  orderingUnit?: string;
  storeName?: string;
  orderDate?: string;
  estimatedDeliveryDate?: string;
  shipTo?: string;
  title?: string;
  salesUserId?: number;
  salesOrderRemark?: string;
  salesOrderAttachments?: InitialSalesOrderAttachment[];
  items?: Array<{
    lineNo: number;
    productId?: number;
    sku: string;
    productName: string;
    factoryPicUrls?: string[];
    packageQuantity?: number;
    unitsPerPackage?: number;
    cartonQuantity?: number;
    outerCartonSizeCm?: string;
    outerCartonGrossWeightKg?: number;
    totalQuantity?: number;
    quantity: number;
    unit: string;
    salePrice: number;
  }>;
};

const initialState: SalesOrderFormState = { error: null };
const fallbackError = '创建销售单失败';

const formStyle = {
  display: 'grid',
  gap: '16px',
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gap: '16px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  fontSize: '14px',
  fontWeight: 600,
  color: '#0f172a',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '12px 14px',
  fontSize: '14px',
  color: '#0f172a',
  background: '#ffffff',
} satisfies React.CSSProperties;

const compactInputStyle = {
  ...inputStyle,
  minHeight: '46px',
  boxSizing: 'border-box',
} satisfies React.CSSProperties;

const compactDisabledInputStyle = {
  ...compactInputStyle,
  color: '#475569',
  background: '#f1f5f9',
  cursor: 'not-allowed',
} satisfies React.CSSProperties;

const fileInputStyle = {
  ...inputStyle,
  padding: '10px 12px',
} satisfies React.CSSProperties;

const compactFileInputStyle = {
  ...fileInputStyle,
  minHeight: '46px',
  boxSizing: 'border-box',
} satisfies React.CSSProperties;

const helperStyle = {
  margin: 0,
  fontSize: '13px',
  color: '#64748b',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const attachmentListStyle = {
  display: 'grid',
  gap: '8px',
  margin: 0,
  padding: 0,
  listStyle: 'none',
} satisfies React.CSSProperties;

const attachmentItemStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  border: '1px solid #d8e1ea',
  borderRadius: '12px',
  padding: '10px 12px',
  background: '#f8fafc',
  fontSize: '13px',
  color: '#0f172a',
} satisfies React.CSSProperties;

const autosaveTextStyle = {
  margin: 0,
  fontSize: '13px',
  color: '#64748b',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const linePanelStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '12px',
  padding: '14px',
  background: '#f8fafc',
  display: 'grid',
  gap: '14px',
} satisfies React.CSSProperties;

const salesLinesFieldsetStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '18px',
  padding: '18px 20px 20px',
  background: '#ffffff',
  display: 'grid',
  gap: '16px',
} satisfies React.CSSProperties;

const salesLinesLegendStyle = {
  color: '#0f172a',
  fontWeight: 800,
  padding: '0 8px',
} satisfies React.CSSProperties;

const salesLineCardStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '16px',
  padding: '18px',
  background: '#f8fafc',
  display: 'grid',
  gap: '16px',
  boxShadow: '0 10px 26px rgba(15, 23, 42, 0.04)',
} satisfies React.CSSProperties;

const lineHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const lineTitleStyle = {
  margin: 0,
  color: '#0f172a',
  fontSize: '16px',
  fontWeight: 800,
} satisfies React.CSSProperties;

const lineTopGridStyle = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'minmax(260px, 1.25fr) minmax(240px, 1fr) repeat(2, minmax(180px, 1fr))',
  alignItems: 'start',
} satisfies React.CSSProperties;

const lineMetricsGridStyle = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  alignItems: 'start',
} satisfies React.CSSProperties;

const imageUploadPanelStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '14px',
  padding: '14px',
  background: '#ffffff',
  display: 'grid',
  gap: '12px',
} satisfies React.CSSProperties;

const imagePreviewGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
  gap: '10px',
} satisfies React.CSSProperties;

const imagePreviewCardStyle = {
  display: 'grid',
  gap: '6px',
  color: '#0f172a',
  textDecoration: 'none',
  minWidth: 0,
} satisfies React.CSSProperties;

const imagePreviewStyle = {
  width: '100%',
  aspectRatio: '4 / 3',
  objectFit: 'cover',
  borderRadius: '10px',
  border: '1px solid #d8e1ea',
  background: '#f1f5f9',
} satisfies React.CSSProperties;

const secondaryButtonStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '12px',
  padding: '10px 14px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
} satisfies React.CSSProperties;

const dialogOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(15, 23, 42, 0.36)',
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  zIndex: 60,
} satisfies React.CSSProperties;

const dialogCardStyle = {
  width: 'min(960px, 100%)',
  maxHeight: 'min(80vh, 920px)',
  overflow: 'hidden',
  borderRadius: '24px',
  border: '1px solid #d8e1ea',
  background: '#ffffff',
  boxShadow: '0 28px 80px rgba(15, 23, 42, 0.18)',
  display: 'grid',
  gridTemplateRows: 'auto auto 1fr auto',
} satisfies React.CSSProperties;

const tableCellStyle = {
  padding: '14px 16px',
  fontSize: '14px',
  borderBottom: '1px solid #eef2f7',
  verticalAlign: 'middle',
  wordBreak: 'break-word' as const,
} satisfies React.CSSProperties;

const productPickerShellStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: '10px',
  alignItems: 'stretch',
} satisfies React.CSSProperties;

const selectedProductBoxStyle = {
  border: '1px solid #d8e1ea',
  borderRadius: '12px',
  padding: '8px 12px',
  background: '#ffffff',
  display: 'grid',
  gap: '2px',
  minHeight: '48px',
  alignContent: 'center',
  boxSizing: 'border-box',
} satisfies React.CSSProperties;

const selectedProductLabelStyle = {
  margin: 0,
  fontSize: '11px',
  color: '#64748b',
  fontWeight: 700,
  lineHeight: 1.2,
} satisfies React.CSSProperties;

const selectedProductValueStyle = {
  margin: 0,
  fontSize: '14px',
  color: '#0f172a',
  fontWeight: 800,
  lineHeight: 1.3,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies React.CSSProperties;

const productPickButtonStyle = {
  ...secondaryButtonStyle,
  minWidth: '104px',
  borderRadius: '12px',
  padding: '0 16px',
  background: '#0f172a',
  color: '#ffffff',
  border: '1px solid #0f172a',
  boxShadow: 'none',
} satisfies React.CSSProperties;

const pickerHeaderStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '16px',
  alignItems: 'flex-start',
  padding: '22px 24px 16px',
  borderBottom: '1px solid #e2e8f0',
  background: '#f8fafc',
} satisfies React.CSSProperties;

const pickerTitleStyle = {
  margin: 0,
  color: '#0f172a',
  fontSize: '20px',
  lineHeight: 1.25,
} satisfies React.CSSProperties;

const pickerToolbarStyle = {
  padding: '16px 24px',
  borderBottom: '1px solid #e2e8f0',
  display: 'grid',
  gap: '12px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const pickActionButtonStyle = {
  ...secondaryButtonStyle,
  borderRadius: '999px',
  padding: '8px 14px',
  background: '#0f172a',
  color: '#ffffff',
  border: '1px solid #0f172a',
} satisfies React.CSSProperties;

const segmentedControlStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '8px',
  alignSelf: 'start',
} satisfies React.CSSProperties;

function buildModeButtonStyle(isActive: boolean) {
  return {
    border: isActive ? '1px solid #0f172a' : '1px solid #cbd5e1',
    borderRadius: '12px',
    padding: '12px 14px',
    background: isActive ? '#0f172a' : '#ffffff',
    color: isActive ? '#ffffff' : '#0f172a',
    fontWeight: 700,
    cursor: 'pointer',
  } satisfies React.CSSProperties;
}

const buttonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '12px',
  padding: '12px 16px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  justifySelf: 'start',
} satisfies React.CSSProperties;

function createEmptySalesOrderItemDraft(id: number): SalesOrderItemDraft {
  return {
    id,
    productEntryMode: 'existing',
    preserveSavedSalePrice: false,
    productOption: '',
    productId: 0,
    sku: '',
    productName: '',
    factoryPicUrls: [],
    packageQuantity: '1',
    unitsPerPackage: '1',
    cartonQuantity: '',
    outerCartonSizeCm: '',
    outerCartonGrossWeightKg: '',
    unit: '个/pc',
    salePrice: '0',
  };
}

function parseProductOption(value: string) {
  const [productId, sku, productName, unit, defaultSalePrice] = value.split('|');

  return {
    productId: Number(productId),
    sku: sku ?? '',
    productName: productName ?? '',
    unit: unit ?? '',
    defaultSalePrice: Number(defaultSalePrice),
  };
}

function formatProductOptionLabel(option: ProductOption | null | undefined) {
  if (!option) {
    return '';
  }

  return [option.sku, option.nameCn, option.nameEn].filter(Boolean).join(' / ');
}

function ProductPicker({
  options,
  selectedValue,
  onSelect,
}: {
  options: ProductOption[];
  selectedValue: string;
  onSelect: (option: ProductOption) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const selectedOption =
    options.find((option) => serializeProductOption(option) === selectedValue) ?? null;
  const selectedLabel = formatProductOptionLabel(selectedOption);
  const filteredOptions = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) {
      return options;
    }

    return options.filter((option) =>
      [option.sku, option.nameCn, option.nameEn, option.unit]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [options, searchQuery]);

  return (
    <>
      <div style={productPickerShellStyle}>
        <div style={selectedProductBoxStyle}>
          <p style={selectedProductLabelStyle}>当前货品 Current Product</p>
          <p style={selectedProductValueStyle}>
            {selectedLabel || '未选择货品'}
          </p>
          <input
            aria-label="货品编码/名称 Product"
            readOnly
            value={selectedLabel}
            style={{
              position: 'absolute',
              width: 1,
              height: 1,
              padding: 0,
              margin: -1,
              overflow: 'hidden',
              clip: 'rect(0 0 0 0)',
              whiteSpace: 'nowrap',
              border: 0,
            }}
          />
        </div>
        <button
          type="button"
          style={productPickButtonStyle}
          onClick={() => {
            setIsOpen(true);
            setSearchQuery('');
          }}
        >
          选择货品
        </button>
      </div>

      {isOpen ? (
        <div style={dialogOverlayStyle}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-picker-title"
            style={dialogCardStyle}
          >
            <div style={pickerHeaderStyle}>
              <div style={{ display: 'grid', gap: '6px' }}>
                <h3 id="product-picker-title" style={pickerTitleStyle}>
                  选择货品
                </h3>
                <p style={helperStyle}>支持按编码、中文名称、英文名称和单位筛选。</p>
              </div>
              <button type="button" style={secondaryButtonStyle} onClick={() => setIsOpen(false)}>
                关闭
              </button>
            </div>

            <div style={pickerToolbarStyle}>
              <label style={labelStyle}>
                搜索货品 Search Product
                <input
                  aria-label="搜索货品 Search Product"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                    }
                  }}
                  placeholder="输入货品编码、中文名或英文名"
                  style={inputStyle}
                />
              </label>
              <p style={helperStyle}>共 {filteredOptions.length} 条结果</p>
            </div>

            <div style={{ overflow: 'auto', padding: '0 24px 16px' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: '760px',
                  borderCollapse: 'collapse',
                  tableLayout: 'fixed',
                }}
              >
                <colgroup>
                  <col style={{ width: '22%' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '16%' }} />
                </colgroup>
                <thead>
                  <tr>
                    {['货品编码', '中文名称', '英文名称', '单位', '操作'].map((heading, index) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: index === 4 ? 'center' : 'left',
                          padding: '12px 16px',
                          fontSize: '13px',
                          color: '#475569',
                          background: '#f8fafc',
                          borderBottom: '1px solid #e2e8f0',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOptions.length > 0 ? (
                    filteredOptions.map((option) => (
                      <tr key={option.id}>
                        <td style={tableCellStyle}>{option.sku}</td>
                        <td style={tableCellStyle}>
                          <strong>{option.nameCn}</strong>
                        </td>
                        <td style={tableCellStyle}>{option.nameEn || '-'}</td>
                        <td style={tableCellStyle}>{option.unit}</td>
                        <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                          <button
                            type="button"
                            style={pickActionButtonStyle}
                            onClick={() => {
                              onSelect(option);
                              setIsOpen(false);
                            }}
                          >
                            选择
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ padding: '18px 16px', textAlign: 'center', color: '#64748b' }}>
                        未找到匹配的货品
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                padding: '16px 24px 24px',
                borderTop: '1px solid #e2e8f0',
              }}
            >
              <p style={helperStyle}>
                当前选中：{selectedOption ? formatProductOptionLabel(selectedOption) : '未选择'}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function readDraftNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeMasterSalePrice(value: number | null | undefined) {
  if (value === null || value === undefined || value === 0) {
    return null;
  }

  return Number.isFinite(value) ? value : null;
}

function resolveDraftTotalQuantity(item: SalesOrderItemDraft) {
  const packageQuantity = readDraftNumber(item.packageQuantity, 0);
  const unitsPerPackage = readDraftNumber(item.unitsPerPackage, 0);
  return Number((packageQuantity * unitsPerPackage).toFixed(4));
}

function findProductOptionBySerializedValue(
  productOptions: ProductOption[],
  productOptionValue: string,
) {
  return (
    productOptions.find((option) => serializeProductOption(option) === productOptionValue) ??
    null
  );
}

function resolveProductSalePrice(
  productOption: ProductOption | null | undefined,
  totalQuantity: number,
) {
  if (!productOption) {
    return null;
  }

  const activeTiers = (productOption.salePriceTiers ?? [])
    .filter((tier) => {
      const price = normalizeMasterSalePrice(tier.salePrice);
      return (
        tier.status !== 'inactive' &&
        Number.isFinite(tier.minQuantity) &&
        tier.minQuantity > 0 &&
        price !== null
      );
    })
    .sort((left, right) => right.minQuantity - left.minQuantity);
  const matchedTier = activeTiers.find((tier) => totalQuantity >= tier.minQuantity);
  if (matchedTier) {
    return normalizeMasterSalePrice(matchedTier.salePrice);
  }

  return normalizeMasterSalePrice(productOption.defaultSalePrice);
}

function applyProductSalePriceRule(
  item: SalesOrderItemDraft,
  productOptions: ProductOption[],
) {
  if (item.productEntryMode !== 'existing') {
    return item;
  }

  const productOption = findProductOptionBySerializedValue(
    productOptions,
    item.productOption,
  );
  const matchedPrice = resolveProductSalePrice(
    productOption,
    resolveDraftTotalQuantity(item),
  );

  return matchedPrice === null
    ? item
    : {
        ...item,
        salePrice: String(matchedPrice),
      };
}

function serializeSalesOrderItems(items: SalesOrderItemDraft[]) {
  return JSON.stringify(
    items.map((item, index) => {
      const totalQuantity = resolveDraftTotalQuantity(item);
      const salePrice = readDraftNumber(item.salePrice, 0);

      return {
        clientLineId: item.id,
        lineNo: index + 1,
        productId: item.productId,
        sku: item.sku.trim(),
        productName: item.productName.trim(),
        factoryPicUrls: item.factoryPicUrls,
        packageQuantity: readDraftNumber(item.packageQuantity, 0),
        unitsPerPackage: readDraftNumber(item.unitsPerPackage, 0),
        ...(item.cartonQuantity.trim() ? { cartonQuantity: Number(item.cartonQuantity) } : {}),
        ...(item.outerCartonSizeCm.trim() ? { outerCartonSizeCm: item.outerCartonSizeCm.trim() } : {}),
        ...(item.outerCartonGrossWeightKg.trim()
          ? { outerCartonGrossWeightKg: Number(item.outerCartonGrossWeightKg) }
          : {}),
        totalQuantity,
        quantity: totalQuantity,
        unit: item.unit.trim(),
        salePrice,
        amount: Number((totalQuantity * salePrice).toFixed(2)),
      };
    }),
  );
}

function resolveInitialProductOption(
  item: NonNullable<InitialSalesOrderFormValue['items']>[number],
  productOptions: ProductOption[],
) {
  const matched = productOptions.find(
    (option) => option.id === item.productId || option.sku === item.sku,
  );

  return matched ? serializeProductOption(matched) : '';
}

function createSalesOrderItemDraftsFromInitialValue(
  initialSalesOrder: InitialSalesOrderFormValue | undefined,
  productOptions: ProductOption[],
) {
  const items = initialSalesOrder?.items ?? [];
  if (!items.length) {
    return [createEmptySalesOrderItemDraft(1)];
  }

  return items.map((item, index) => {
    const productOption = resolveInitialProductOption(item, productOptions);
    const packageQuantity = item.packageQuantity ?? item.quantity ?? 1;
    const unitsPerPackage = item.unitsPerPackage ?? item.totalQuantity ?? item.quantity ?? 1;
    const productEntryMode = productOption ? 'existing' : 'manual';

    return {
      id: item.lineNo || index + 1,
      productEntryMode,
      preserveSavedSalePrice: true,
      productOption,
      productId: item.productId ?? 0,
      sku: item.sku,
      productName: item.productName,
      factoryPicUrls: item.factoryPicUrls ?? [],
      packageQuantity: String(packageQuantity),
      unitsPerPackage: String(unitsPerPackage),
      cartonQuantity: item.cartonQuantity == null ? '' : String(item.cartonQuantity),
      outerCartonSizeCm: item.outerCartonSizeCm ?? '',
      outerCartonGrossWeightKg: item.outerCartonGrossWeightKg == null ? '' : String(item.outerCartonGrossWeightKg),
      unit: item.unit,
      salePrice: String(item.salePrice),
    } satisfies SalesOrderItemDraft;
  });
}

export function CreateSalesOrderForm({
  customerOptions,
  productOptions,
  salesUsers,
  defaultSalesUserId,
  createdBy,
  role,
  user,
  access,
  initialSalesOrder,
}: {
  customerOptions: CounterpartyOption[];
  productOptions: ProductOption[];
  salesUsers: SalesUserOption[];
  defaultSalesUserId: number;
  createdBy: number;
  role: string;
  user: string;
  access?: string;
  initialSalesOrder?: InitialSalesOrderFormValue;
}) {
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attempt = useMutationAttempt();
  const [submittingMode, setSubmittingMode] = useState<'draft' | 'submit' | null>(null);
  const [draftSalesOrderId, setDraftSalesOrderId] = useState<number | null>(
    initialSalesOrder?.id ?? null,
  );
  const [autosaveStatus, setAutosaveStatus] = useState<
    'idle' | 'waiting' | 'saving' | 'saved' | 'skipped' | 'error'
  >('idle');
  const [autosaveMessage, setAutosaveMessage] = useState('');
  const [selectedAttachmentCount, setSelectedAttachmentCount] = useState(0);
  const [selectedFactoryPicPreviewsByLineId, setSelectedFactoryPicPreviewsByLineId] = useState<
    Record<number, Array<{ name: string; url: string; isImage: boolean }>>
  >({});
  const formRef = useRef<HTMLFormElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveSeqRef = useRef(0);
  const autosaveRunningRef = useRef(false);
  const autosaveQueuedRef = useRef(false);
  const autosavePromiseRef = useRef<Promise<void> | null>(null);
  const autosaveRequestKeyRef = useRef<string | null>(null);
  const isSubmittingRef = useRef(false);
  const draftSalesOrderIdRef = useRef<number | null>(initialSalesOrder?.id ?? null);
  const selectedFactoryPicPreviewUrlsRef = useRef<Record<number, string[]>>({});
  const [customerEntryMode, setCustomerEntryMode] = useState<'existing' | 'manual'>(
    initialSalesOrder?.customerEntryMode === 'manual' ? 'manual' : 'existing',
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialSalesOrder?.customerId
      ? String(initialSalesOrder.customerId)
      : '',
  );
  const initialSalesOrderItems = createSalesOrderItemDraftsFromInitialValue(
    initialSalesOrder,
    productOptions,
  );
  const [nextLineId, setNextLineId] = useState(
    Math.max(...initialSalesOrderItems.map((item) => item.id), 1) + 1,
  );
  const [salesOrderItems, setSalesOrderItems] = useState<SalesOrderItemDraft[]>(
    initialSalesOrderItems,
  );
  const selectedCustomer = customerOptions.find(
    (option) => String(option.id) === selectedCustomerId,
  );
  const formMode = draftSalesOrderId ? 'edit' : 'create';
  const fallbackSubmitError =
    formMode === 'edit' ? '销售单草稿保存失败' : fallbackError;

  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  useEffect(() => {
    draftSalesOrderIdRef.current = draftSalesOrderId;
  }, [draftSalesOrderId]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    selectedFactoryPicPreviewUrlsRef.current = Object.fromEntries(
      Object.entries(selectedFactoryPicPreviewsByLineId).map(([lineId, previews]) => [
        Number(lineId),
        previews.map((preview) => preview.url),
      ]),
    );
  }, [selectedFactoryPicPreviewsByLineId]);

  useEffect(() => {
    return () => {
      Object.values(selectedFactoryPicPreviewUrlsRef.current)
        .flat()
        .forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  function scheduleAutosave() {
    if (isSubmittingRef.current) {
      return;
    }

    if (autosaveRunningRef.current) {
      autosaveQueuedRef.current = true;
      return;
    }

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    setAutosaveStatus('waiting');
    setAutosaveMessage('正在等待字段稳定后自动保存草稿');
    const seq = autosaveSeqRef.current + 1;
    autosaveSeqRef.current = seq;
    autosaveTimerRef.current = setTimeout(async () => {
      const form = formRef.current;
      if (!form || isSubmittingRef.current) {
        return;
      }

      autosaveRunningRef.current = true;
      const running = (async () => {
        try {
          setAutosaveStatus('saving');
          setAutosaveMessage('正在自动保存草稿');
          const formData = new FormData(form);
          const submittedTitle = String(formData.get('title') ?? '');
          formData.set('submitMode', 'draft');
          formData.set('skipAttachmentUpload', 'true');
          autosaveRequestKeyRef.current ??= createMutationRequestKey();
          formData.set('idempotencyKey', autosaveRequestKeyRef.current);
          if (draftSalesOrderIdRef.current) {
            formData.set('salesOrderId', String(draftSalesOrderIdRef.current));
          }

          const result = await autosaveSalesOrderDraftAction(formData);
          if (result.salesOrderId) {
            autosaveRequestKeyRef.current = null;
            draftSalesOrderIdRef.current = result.salesOrderId;
            setDraftSalesOrderId(result.salesOrderId);
          }
          if (autosaveSeqRef.current !== seq) {
            return;
          }

          if (result.error) {
            setAutosaveStatus('error');
            setAutosaveMessage(result.error);
            return;
          }

          if (result.skipped) {
            setAutosaveStatus('skipped');
            setAutosaveMessage('完善订货单位和销售明细后会自动保存草稿');
            return;
          }

          if (result.title && titleInputRef.current?.value === submittedTitle) {
            titleInputRef.current.value = result.title;
          }

          setAutosaveStatus('saved');
          setAutosaveMessage(
            result.savedAt
              ? `已自动保存 ${new Date(result.savedAt).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : '已自动保存',
          );
        } finally {
          autosaveRunningRef.current = false;
          if (autosaveQueuedRef.current && !isSubmittingRef.current) {
            autosaveQueuedRef.current = false;
            scheduleAutosave();
          }
        }
      })();
      autosavePromiseRef.current = running;
      try {
        await running;
      } finally {
        autosavePromiseRef.current = null;
      }
    }, 1500);
  }

  function handleFormInput(event: FormEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'file') {
      return;
    }

    scheduleAutosave();
  }

  function handleFormChange(event: ChangeEvent<HTMLFormElement>) {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === 'file') {
      return;
    }

    scheduleAutosave();
  }

  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter') {
      return;
    }

    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      event.preventDefault();
    }
  }

  function updateSalesOrderItem(
    id: number,
    updater: (item: SalesOrderItemDraft) => SalesOrderItemDraft,
  ) {
    setSalesOrderItems((items) =>
      items.map((item) => (item.id === id ? updater(item) : item)),
    );
  }

  function addSalesOrderItem() {
    setSalesOrderItems((items) => [
      ...items,
      createEmptySalesOrderItemDraft(nextLineId),
    ]);
    setNextLineId((value) => value + 1);
  }

  function removeSalesOrderItem(id: number) {
    const urls = selectedFactoryPicPreviewUrlsRef.current[id] ?? [];
    urls.forEach((url) => URL.revokeObjectURL(url));
    setSelectedFactoryPicPreviewsByLineId((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setSalesOrderItems((items) =>
      items.length > 1 ? items.filter((item) => item.id !== id) : items,
    );
  }

  function handleFactoryPicChange(
    itemId: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const files = Array.from(event.currentTarget.files ?? []);
    const previousUrls = selectedFactoryPicPreviewUrlsRef.current[itemId] ?? [];
    previousUrls.forEach((url) => URL.revokeObjectURL(url));
    const nextPreviews = files
      .filter((file) => file.size > 0)
      .map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
        isImage: file.type.startsWith('image/') || /\.(avif|gif|jpe?g|png|webp)$/i.test(file.name),
      }));
    setSelectedFactoryPicPreviewsByLineId((current) => ({
      ...current,
      [itemId]: nextPreviews,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || isSubmittingRef.current || attempt.isComplete) {
      return;
    }

    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    isSubmittingRef.current = true;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (autosavePromiseRef.current) await autosavePromiseRef.current.catch(() => undefined);
    const requestKey = attempt.begin();
    if (!requestKey) {
      isSubmittingRef.current = false;
      return;
    }
    setIsSubmitting(true);
    setState(initialState);

    const formData = new FormData(form);
    formData.set('idempotencyKey', requestKey);
    if (draftSalesOrderIdRef.current) {
      formData.set('salesOrderId', String(draftSalesOrderIdRef.current));
    }
    const nextSubmitMode =
      submitter instanceof HTMLButtonElement && submitter.value === 'submit'
        ? 'submit'
        : 'draft';
    formData.set('submitMode', nextSubmitMode);
    setSubmittingMode(nextSubmitMode);
    try {
      const nextState =
        draftSalesOrderIdRef.current
          ? await updateSalesOrderDraftAction(initialState, formData)
          : await createSalesOrderAction(initialState, formData);
      if (nextState.error) attempt.fail();
      else attempt.succeed();
      setState(nextState);
    } catch (error) {
      if (isRedirectError(error)) {
        attempt.succeed();
        throw error;
      }

      attempt.fail();
      setState({ error: fallbackSubmitError });
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
      setSubmittingMode(null);
    }
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      onChangeCapture={attempt.resetFailedAfterEdit}
      onKeyDownCapture={handleFormKeyDown}
      onInput={handleFormInput}
      onChange={handleFormChange}
      style={formStyle}
    >
      {draftSalesOrderId ? (
        <input type="hidden" name="salesOrderId" value={String(draftSalesOrderId)} />
      ) : null}
      <input type="hidden" name="createdBy" value={String(createdBy)} />
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="user" value={user} />
      <input
        type="hidden"
        name="salesOrderItems"
        value={serializeSalesOrderItems(salesOrderItems)}
        readOnly
      />
      <input
        type="hidden"
        name="existingSalesOrderAttachments"
        value={JSON.stringify(initialSalesOrder?.salesOrderAttachments ?? [])}
        readOnly
      />
      {access ? <input type="hidden" name="access" value={access} /> : null}
      {role === 'sales' ? (
        <input
          type="hidden"
          name="salesUserId"
          value={String(initialSalesOrder?.salesUserId ?? defaultSalesUserId)}
        />
      ) : null}

      <div style={gridStyle}>
        <input type="hidden" name="customerEntryMode" value={customerEntryMode} />
        <div style={labelStyle}>
          <span>订货单位录入方式 Ordering Mode</span>
          <span role="group" aria-label="订货单位录入方式 Ordering Mode" style={segmentedControlStyle}>
            <button
              type="button"
              aria-pressed={customerEntryMode === 'existing'}
              style={buildModeButtonStyle(customerEntryMode === 'existing')}
              onClick={() => {
                setCustomerEntryMode('existing');
                setTimeout(scheduleAutosave, 0);
              }}
            >
              从客户主数据选择
            </button>
            <button
              type="button"
              aria-pressed={customerEntryMode === 'manual'}
              style={buildModeButtonStyle(customerEntryMode === 'manual')}
              onClick={() => {
                setCustomerEntryMode('manual');
                setTimeout(scheduleAutosave, 0);
              }}
            >
              手动填写订货单位
            </button>
          </span>
        </div>

        {customerEntryMode === 'existing' ? (
          <>
            <input type="hidden" name="customerName" value={selectedCustomer?.name ?? ''} />
            <input
              type="hidden"
              name="selectedCustomerName"
              value={selectedCustomer?.name ?? ''}
            />
            <input
              type="hidden"
              name="selectedCustomerCode"
              value={selectedCustomer?.code ?? ''}
            />
            <input type="hidden" name="customerId" value={selectedCustomerId} />
            <label style={labelStyle}>
              订货单位 Ordering
              <input
                readOnly
                value={formatCounterpartyOptionLabel(selectedCustomer)}
                placeholder="请选择客户"
                required
                style={inputStyle}
              />
              <CounterpartyPicker
                options={customerOptions}
                selectedId={selectedCustomerId}
                onSelect={(option) => setSelectedCustomerId(String(option.id))}
              />
            </label>
            <label style={labelStyle}>
              客户编码 Customer Code
              <input
                readOnly
                value={selectedCustomer?.code ?? ''}
                placeholder="选择订货单位后自动带出"
                style={inputStyle}
              />
            </label>
          </>
        ) : (
          <>
            <label style={labelStyle}>
              订货单位 Ordering
              <input
                name="customerName"
                type="text"
                placeholder="填写客户名称"
                required
                defaultValue={initialSalesOrder?.customerName ?? ''}
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              客户编码 Customer Code
              <input
                name="customerCode"
                type="text"
                placeholder="如 CUST-NORTHWIND"
                defaultValue={initialSalesOrder?.customerCode ?? ''}
                style={inputStyle}
              />
            </label>
            <label style={{ ...labelStyle, alignContent: 'end' }}>
              <span>同步设置</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 500 }}>
                <input name="saveManualCustomerToCounterparty" type="checkbox" />
                同步保存到往来单位 Save to Counterparty
              </span>
            </label>
          </>
        )}
      </div>

      <div style={gridStyle}>
        <label style={labelStyle}>
          门店 Store
          <input
            name="storeName"
            type="text"
            placeholder="例如：02 Libuys"
            defaultValue={initialSalesOrder?.storeName ?? ''}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          销售负责人 Sales Owner
          <select
            name="salesUserId"
            defaultValue={String(initialSalesOrder?.salesUserId ?? defaultSalesUserId)}
            disabled={role === 'sales'}
            style={inputStyle}
          >
            {salesUsers.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label style={labelStyle}>
          订货日期 Order Date
          <input
            name="orderDate"
            type="date"
            defaultValue={initialSalesOrder?.orderDate ?? ''}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          截止日期 Deadline
          <input
            name="estimatedDeliveryDate"
            type="date"
            defaultValue={initialSalesOrder?.estimatedDeliveryDate ?? ''}
            style={inputStyle}
          />
        </label>

        <label style={labelStyle}>
          Ship to 发货至
          <input
            name="shipTo"
            type="text"
            placeholder="例如：SH Boninoe"
            defaultValue={initialSalesOrder?.shipTo ?? ''}
            style={inputStyle}
          />
        </label>
      </div>

      <label style={labelStyle}>
        订单标题 Title
        <input
          ref={titleInputRef}
          name="title"
          type="text"
          placeholder="首次保存后生成：销售单号-产品名称-客户名称，可修改"
          defaultValue={initialSalesOrder?.title ?? ''}
          style={inputStyle}
        />
      </label>

      <fieldset style={salesLinesFieldsetStyle}>
        <legend style={salesLinesLegendStyle}>
          销售明细 Sales Line Items
        </legend>
        {salesOrderItems.map((item, index) => {
          const totalQuantity = resolveDraftTotalQuantity(item);
          const selectedProductOption = findProductOptionBySerializedValue(
            productOptions,
            item.productOption,
          );
          const masterSalePrice = resolveProductSalePrice(
            selectedProductOption,
            totalQuantity,
          );
          const isSalePriceLocked =
            item.productEntryMode === 'existing' &&
            masterSalePrice !== null &&
            !item.preserveSavedSalePrice;
          const salePrice = isSalePriceLocked
            ? masterSalePrice
            : readDraftNumber(item.salePrice, 0);
          const amount = Number((totalQuantity * salePrice).toFixed(2));

          return (
            <section key={item.id} style={salesLineCardStyle}>
              <div style={lineHeaderStyle}>
                <h3 style={lineTitleStyle}>{`明细行 ${index + 1}`}</h3>
                <button
                  type="button"
                  style={secondaryButtonStyle}
                  onClick={() => removeSalesOrderItem(item.id)}
                  disabled={salesOrderItems.length === 1}
                >
                  删除行
                </button>
              </div>

              <div style={lineTopGridStyle}>
                <div style={labelStyle}>
                  <span>录入方式 Entry Mode</span>
                  <span
                    role="group"
                    aria-label={`明细行 ${index + 1} 录入方式 Entry Mode`}
                    style={segmentedControlStyle}
                  >
                    {(['existing', 'manual'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        aria-pressed={item.productEntryMode === mode}
                        style={buildModeButtonStyle(item.productEntryMode === mode)}
                        onClick={() => {
                          const nextMode = mode;
                          updateSalesOrderItem(item.id, (current) => ({
                            ...applyProductSalePriceRule(
                              {
                                ...current,
                                productEntryMode: nextMode,
                                preserveSavedSalePrice: false,
                                productOption:
                                  nextMode === 'manual' ? '' : current.productOption,
                              },
                              productOptions,
                            ),
                          }));
                          setTimeout(scheduleAutosave, 0);
                        }}
                      >
                        {mode === 'existing' ? '选择已有货品' : '手动录入货品'}
                      </button>
                    ))}
                  </span>
                </div>

                {item.productEntryMode === 'existing' ? (
                  <label style={labelStyle}>
                    货品编码/名称 Product
                    <ProductPicker
                      options={productOptions}
                      selectedValue={item.productOption}
                      onSelect={(productOption) => {
                        const nextValue = serializeProductOption(productOption);
                        const product = parseProductOption(nextValue);
                        updateSalesOrderItem(item.id, (current) => {
                          const nextItem = {
                            ...current,
                            preserveSavedSalePrice: false,
                            productOption: nextValue,
                            productId: Number.isFinite(product.productId)
                              ? product.productId
                              : 0,
                            sku: product.sku,
                            productName: product.productName,
                            unit: current.unit || product.unit || '个/pc',
                          };
                          const matchedPrice = resolveProductSalePrice(
                            productOption,
                            resolveDraftTotalQuantity(nextItem),
                          );

                          return {
                            ...nextItem,
                            salePrice:
                              matchedPrice === null
                                ? current.salePrice
                                : String(matchedPrice),
                          };
                        });
                        setTimeout(scheduleAutosave, 0);
                      }}
                    />
                  </label>
                ) : null}

                <label style={labelStyle}>
                  货品编码 Product No
                  <input
                    value={item.sku}
                    disabled={item.productEntryMode === 'existing'}
                    onChange={(event) =>
                      updateSalesOrderItem(item.id, (current) => ({
                        ...current,
                        sku: event.target.value,
                      }))
                    }
                    style={item.productEntryMode === 'existing' ? compactDisabledInputStyle : compactInputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  货品名称 Product Name
                  <input
                    value={item.productName}
                    disabled={item.productEntryMode === 'existing'}
                    onChange={(event) =>
                      updateSalesOrderItem(item.id, (current) => ({
                        ...current,
                        productName: event.target.value,
                      }))
                    }
                    style={item.productEntryMode === 'existing' ? compactDisabledInputStyle : compactInputStyle}
                  />
                </label>
              </div>

              <div style={imageUploadPanelStyle}>
                <label style={labelStyle}>
                  <span>工厂图片 Factory Images</span>
                  <input
                    name={`salesOrderItemFactoryPicFiles:${item.id}`}
                    type="file"
                    accept="image/*"
                    multiple
                    style={compactFileInputStyle}
                    onChange={(event) => handleFactoryPicChange(item.id, event)}
                  />
                </label>
                {item.factoryPicUrls.length > 0 ? (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <span style={helperStyle}>
                      已保留 {item.factoryPicUrls.length} 张图片，可继续追加上传。
                    </span>
                    <div style={imagePreviewGridStyle}>
                      {item.factoryPicUrls.map((url, imageIndex) => (
                        <a
                          key={`${item.id}-${url}`}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          style={imagePreviewCardStyle}
                        >
                          <img
                            src={url}
                            alt={`${item.productName} 已保存图片 ${imageIndex + 1}`}
                            style={imagePreviewStyle}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
                {selectedFactoryPicPreviewsByLineId[item.id]?.length ? (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <span style={helperStyle}>
                      已选择 {selectedFactoryPicPreviewsByLineId[item.id].length} 张新图片
                    </span>
                    <div style={imagePreviewGridStyle}>
                      {selectedFactoryPicPreviewsByLineId[item.id].map((preview) => (
                        <a
                          key={preview.url}
                          href={preview.url}
                          target="_blank"
                          rel="noreferrer"
                          style={imagePreviewCardStyle}
                        >
                          {preview.isImage ? (
                            <img
                              src={preview.url}
                              alt={preview.name}
                              style={imagePreviewStyle}
                            />
                          ) : null}
                          <span
                            style={{
                              fontSize: '11px',
                              lineHeight: 1.4,
                              color: '#475569',
                              wordBreak: 'break-all',
                            }}
                          >
                            {preview.name}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div style={lineMetricsGridStyle}>
                <label style={labelStyle}>
                  数量/件 Quantity
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.packageQuantity}
                    onChange={(event) =>
                      updateSalesOrderItem(item.id, (current) =>
                        applyProductSalePriceRule(
                          {
                            ...current,
                            packageQuantity: event.target.value,
                          },
                          productOptions,
                        ),
                      )
                    }
                    style={compactInputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  每件数量 Quan
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.unitsPerPackage}
                    onChange={(event) =>
                      updateSalesOrderItem(item.id, (current) =>
                        applyProductSalePriceRule(
                          {
                            ...current,
                            unitsPerPackage: event.target.value,
                          },
                          productOptions,
                        ),
                      )
                    }
                    style={compactInputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  装箱数 Carton Qty
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={item.cartonQuantity}
                    onChange={(event) =>
                      updateSalesOrderItem(item.id, (current) => ({
                        ...current,
                        cartonQuantity: event.target.value,
                      }))
                    }
                    style={compactInputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  外箱尺寸 Carton Size
                  <input
                    value={item.outerCartonSizeCm}
                    onChange={(event) =>
                      updateSalesOrderItem(item.id, (current) => ({
                        ...current,
                        outerCartonSizeCm: event.target.value,
                      }))
                    }
                    style={compactInputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  外箱毛重 Gross Weight
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.outerCartonGrossWeightKg}
                    onChange={(event) =>
                      updateSalesOrderItem(item.id, (current) => ({
                        ...current,
                        outerCartonGrossWeightKg: event.target.value,
                      }))
                    }
                    style={compactInputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  总数量 Total Q
                  <input readOnly value={String(totalQuantity)} style={compactInputStyle} />
                </label>

                <label style={labelStyle}>
                  单位 Unit
                  <input
                    value={item.unit}
                    onChange={(event) =>
                      updateSalesOrderItem(item.id, (current) => ({
                        ...current,
                        unit: event.target.value,
                      }))
                    }
                    style={compactInputStyle}
                  />
                </label>

                <label style={labelStyle}>
                  单价 Unit P
                  <input
                    aria-label="单价 Unit P"
                    type="number"
                    min="0"
                    step="0.01"
                    value={isSalePriceLocked ? String(masterSalePrice) : item.salePrice}
                    disabled={isSalePriceLocked}
                    onChange={(event) =>
                      updateSalesOrderItem(item.id, (current) => ({
                        ...current,
                        salePrice: event.target.value,
                      }))
                    }
                    style={isSalePriceLocked ? compactDisabledInputStyle : compactInputStyle}
                  />
                  {isSalePriceLocked ? (
                    <span style={helperStyle}>
                      已按商品主数据价格锁定，数量变化时会自动匹配阶梯报价。
                    </span>
                  ) : null}
                </label>

                <label style={labelStyle}>
                  合计 Total
                  <input readOnly value={String(amount)} style={compactInputStyle} />
                </label>
              </div>
            </section>
          );
        })}
        <button type="button" style={secondaryButtonStyle} onClick={addSalesOrderItem}>
          新增产品行
        </button>
      </fieldset>

      <label style={labelStyle}>
        客户订单号 Customer PO No
        <input
          name="customerOrderNo"
          type="text"
          defaultValue={initialSalesOrder?.customerOrderNo ?? ''}
          placeholder="留空时与销售单号相同；提交审核前可修改"
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        备注 Remark
        <input
          name="salesOrderRemark"
          type="text"
          placeholder="例如：单个销售单可能会有多个工厂的产品"
          defaultValue={initialSalesOrder?.salesOrderRemark ?? ''}
          style={inputStyle}
        />
      </label>

      <label style={labelStyle}>
        销售单附件 Attachments
        <input
          name="salesOrderAttachmentFiles"
          aria-label="销售单附件 Attachments"
          type="file"
          multiple
          style={fileInputStyle}
          onChange={(event) =>
            setSelectedAttachmentCount(event.currentTarget.files?.length ?? 0)
          }
        />
        {initialSalesOrder?.salesOrderAttachments?.length ? (
          <ul aria-label="已保存销售单附件" style={attachmentListStyle}>
            {initialSalesOrder.salesOrderAttachments.map((attachment) => (
              <li key={attachment.url} style={attachmentItemStyle}>
                <span>{attachment.fileName}</span>
                <a href={attachment.url} target="_blank" rel="noreferrer">
                  查看
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <span style={helperStyle}>暂无已保存附件</span>
        )}
        {selectedAttachmentCount > 0 ? (
          <span style={helperStyle}>
            {`已选择 ${selectedAttachmentCount} 个附件，点击保存草稿或提交审批后上传。`}
          </span>
        ) : (
          <span style={helperStyle}>选择文件后不会自动上传，需点击保存草稿或提交审批。</span>
        )}
      </label>

      <p style={helperStyle}>
        {formMode === 'edit'
          ? '当前为草稿编辑：可继续保存为草稿，也可提交到销售主管审批。'
          : '创建人会按当前视角自动带入；可先保存为草稿继续补资料，也可直接提交到销售主管审批。'}
      </p>

      {state.error ? <p role="alert">{state.error}</p> : null}
      {autosaveStatus !== 'idle' ? (
        <p aria-live="polite" style={autosaveTextStyle}>
          {autosaveMessage}
        </p>
      ) : null}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="submit"
          name="submitMode"
          value="draft"
          disabled={isSubmitting || attempt.isComplete}
          style={secondaryButtonStyle}
        >
          {isSubmitting && submittingMode === 'draft' ? '保存中...' : '保存草稿'}
        </button>
        <button
          type="submit"
          name="submitMode"
          value="submit"
          disabled={isSubmitting || attempt.isComplete}
          style={buttonStyle}
        >
          {isSubmitting && submittingMode === 'submit' ? '提交中...' : '提交审批'}
        </button>
      </div>
    </form>
  );
}
