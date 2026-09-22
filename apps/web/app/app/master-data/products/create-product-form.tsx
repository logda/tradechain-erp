'use client';

import { type FormEvent, useState } from 'react';
import {
  buildFormalRequestHeaders,
  buildFormalRequestHeadersFromSearch,
} from '../../_lib/formal-request-headers';
import { submitFormalJsonMutationAction } from '../../_actions/formal-mutation-action';
import {
  CounterpartyPicker,
  formatCounterpartyOptionLabel,
} from '../../_components/counterparty-picker';
import {
  buildProductCodePreview,
  defaultProductCodeRule,
  defaultSalesProductCodeRule,
  describeProductCodeRule,
  type ProductCodeRule,
} from './product-code-rule';
import {
  fallbackProductSupplierOptions,
  findProductSupplierOption,
  type ProductSupplierOption,
} from './product-supplier-options';
import {
  buildSalePriceTierPayload,
  createEditableSalePriceTiers,
  SalePriceTierEditor,
} from './sale-price-tier-editor';

export type ProductCategory = 'electronics' | 'consumables' | 'service';
export type ProductStage = 'quote_candidate' | 'formal';
export type PricingMode = 'fixed' | 'tiered';
export type PurchaseCodeMode = 'manual' | 'generated';
export type SalesCodeMode = 'manual' | 'generated';
export type FactorySourceMode = 'manual' | 'supplier';

type CreateProductFormProps = {
  endpoint: string;
  createdBy: string;
  codeRule?: ProductCodeRule;
  salesCodeRule?: ProductCodeRule;
  supplierOptions?: ProductSupplierOption[];
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  onSuccess?: (item: {
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
    defaultPurchasePrice: number;
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
  }) => void;
};

type FormState = {
  error: string | null;
  success: string | null;
};

const initialState: FormState = { error: null, success: null };

const categoryLabels: Record<ProductCategory, string> = {
  electronics: 'electronics / 电子类',
  consumables: 'consumables / 耗材类',
  service: 'service / 服务类',
};

const productStageLabels: Record<ProductStage, string> = {
  quote_candidate: 'quote_candidate / 候选阶段',
  formal: 'formal / 正式阶段',
};

const pricingModeLabels: Record<PricingMode, string> = {
  fixed: 'fixed / 固定模式',
  tiered: 'tiered / 阶梯模式',
};

const purchaseCodeModeLabels: Record<PurchaseCodeMode, string> = {
  manual: 'manual / 手工填写',
  generated: 'generated / 自动生成',
};

const salesCodeModeLabels: Record<SalesCodeMode, string> = {
  manual: 'manual / 手工填写',
  generated: 'generated / 自动生成',
};

const factorySourceModeLabels: Record<FactorySourceMode, string> = {
  manual: 'manual / 手写工厂与单位编码',
  supplier: 'supplier / 选择供应商自动带出',
};

const formStyle = {
  display: 'grid',
  gap: '22px',
} satisfies React.CSSProperties;

const heroCardStyle = {
  display: 'grid',
  gap: '16px',
  padding: '22px 24px',
  border: '1px solid #dbe4ee',
  borderRadius: '22px',
  background:
    'radial-gradient(circle at top left, rgba(15,118,110,0.12) 0%, rgba(255,255,255,0.98) 34%, rgba(248,250,252,0.96) 100%)',
  boxShadow: '0 16px 42px rgba(15, 23, 42, 0.05)',
} satisfies React.CSSProperties;

const heroTitleStyle = {
  margin: 0,
  fontSize: '24px',
  lineHeight: 1.2,
  color: '#0f172a',
} satisfies React.CSSProperties;

const heroCopyStyle = {
  margin: 0,
  color: '#475569',
  fontSize: '14px',
  lineHeight: 1.8,
  maxWidth: '920px',
} satisfies React.CSSProperties;

const heroMetaGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: '12px',
} satisfies React.CSSProperties;

const heroMetaCardStyle = {
  display: 'grid',
  gap: '8px',
  padding: '14px 16px',
  border: '1px solid #d7e3ec',
  borderRadius: '18px',
  background: 'rgba(255,255,255,0.9)',
} satisfies React.CSSProperties;

const heroMetaLabelStyle = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  color: '#64748b',
} satisfies React.CSSProperties;

const heroMetaValueStyle = {
  fontSize: '14px',
  lineHeight: 1.7,
  color: '#0f172a',
  fontWeight: 600,
} satisfies React.CSSProperties;

const sectionStyle = {
  display: 'grid',
  gap: '16px',
  padding: '20px 22px 22px',
  border: '1px solid #dbe4ee',
  borderRadius: '22px',
  background: '#ffffff',
  boxShadow: '0 14px 32px rgba(15, 23, 42, 0.04)',
} satisfies React.CSSProperties;

const sectionHeaderStyle = {
  display: 'grid',
  gap: '6px',
} satisfies React.CSSProperties;

const sectionTitleStyle = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const sectionCopyStyle = {
  margin: 0,
  color: '#64748b',
  fontSize: '13px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: '14px',
} satisfies React.CSSProperties;

const codeSourceGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '18px 20px',
  alignItems: 'start',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '8px',
  fontSize: '13px',
  color: '#334155',
  alignContent: 'start',
  alignSelf: 'start',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '14px',
  padding: '12px 14px',
  background: '#ffffff',
  color: '#0f172a',
  minHeight: '48px',
  boxSizing: 'border-box' as const,
  width: '100%',
} satisfies React.CSSProperties;

const segmentedControlStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '6px',
  padding: '5px',
  border: '1px solid #dbe4ee',
  borderRadius: '16px',
  background: '#f8fafc',
  alignSelf: 'start',
} satisfies React.CSSProperties;

function buildModeButtonStyle(isActive: boolean) {
  return {
    border: isActive ? '1px solid #0f172a' : '1px solid transparent',
    borderRadius: '12px',
    padding: '9px 10px',
    background: isActive ? '#0f172a' : '#ffffff',
    color: isActive ? '#ffffff' : '#0f172a',
    fontWeight: 700,
    cursor: 'pointer',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
    lineHeight: 1.35,
    boxShadow: isActive ? '0 10px 20px rgba(15, 23, 42, 0.12)' : 'none',
  } satisfies React.CSSProperties;
}

const helperTextStyle = {
  color: '#64748b',
  fontSize: '12px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const mutedTextStyle = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: 1.7,
} satisfies React.CSSProperties;

const requiredMarkStyle = {
  color: '#dc2626',
  fontWeight: 700,
  marginLeft: '4px',
} satisfies React.CSSProperties;

const fullWidthFieldStyle = {
  gridColumn: '1 / -1',
} satisfies React.CSSProperties;

const buttonStyle = {
  border: '1px solid #0f172a',
  borderRadius: '14px',
  padding: '12px 20px',
  background: '#0f172a',
  color: '#ffffff',
  fontWeight: 700,
  cursor: 'pointer',
  width: 'fit-content',
} satisfies React.CSSProperties;

function renderRequiredLabel(title: string) {
  return (
    <span>
      <span>{title}</span>
      <span aria-hidden="true" style={requiredMarkStyle}>
        *
      </span>
    </span>
  );
}

function readOptionalNumber(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? '').trim();
  if (!raw) {
    return undefined;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function readPriceOrZero(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? '').trim();
  if (!raw) {
    return 0;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function resolveRequestHeaders(
  createdBy: string,
  actorAccessScopes?: CreateProductFormProps['actorAccessScopes'],
) {
  if (actorAccessScopes) {
    return buildFormalRequestHeaders({
      role: 'admin',
      user: createdBy,
      accessScopes: actorAccessScopes,
    });
  }

  if (typeof window === 'undefined') {
    return buildFormalRequestHeadersFromSearch(new URLSearchParams(), {
      role: 'admin',
      user: createdBy,
    });
  }

  return buildFormalRequestHeadersFromSearch(
    new URLSearchParams(window.location.search),
    { role: 'admin', user: createdBy },
  );
}

function buildSupplierPickerOptions(supplierOptions: ProductSupplierOption[]) {
  return supplierOptions.map((supplier, index) => ({
    id: index + 1,
    type: 'supplier' as const,
    code: supplier.code,
    name: supplier.name,
    shortName: supplier.shortName ?? '',
  }));
}

export function CreateProductForm({
  endpoint,
  createdBy,
  codeRule = defaultProductCodeRule,
  salesCodeRule = defaultSalesProductCodeRule,
  supplierOptions = fallbackProductSupplierOptions,
  actorAccessScopes,
  onSuccess,
}: CreateProductFormProps) {
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [salesCodeMode, setSalesCodeMode] = useState<SalesCodeMode>('generated');
  const [purchaseCodeMode, setPurchaseCodeMode] = useState<PurchaseCodeMode>('generated');
  const [factorySourceMode, setFactorySourceMode] = useState<FactorySourceMode>('manual');
  const [pricingMode, setPricingMode] = useState<PricingMode>('fixed');
  const [selectedCategory, setSelectedCategory] = useState<ProductCategory>('electronics');
  const [selectedSupplierCode, setSelectedSupplierCode] = useState(
    supplierOptions[0]?.code ?? '',
  );
  const [manualFactoryName, setManualFactoryName] = useState('');
  const [manualUnitCode, setManualUnitCode] = useState('');
  const [salePriceTiers, setSalePriceTiers] = useState(() => createEditableSalePriceTiers([]));

  const selectedSupplier = findProductSupplierOption(supplierOptions, selectedSupplierCode);
  const supplierPickerOptions = buildSupplierPickerOptions(supplierOptions);
  const selectedSupplierPickerOption = supplierPickerOptions.find(
    (option) => option.code === selectedSupplierCode,
  );
  const selectedSupplierPickerId = String(
    selectedSupplierPickerOption?.id ?? '',
  );
  const resolvedFactoryName =
    factorySourceMode === 'supplier' ? selectedSupplier?.name ?? '' : manualFactoryName;
  const resolvedUnitCode =
    factorySourceMode === 'supplier' ? selectedSupplier?.code ?? '' : manualUnitCode;
  const ruleNeedsSupplier = codeRule.segments.some(
    (segment) => segment.enabled && segment.key === 'supplier_code',
  );
  const ruleNeedsCategory = codeRule.segments.some(
    (segment) => segment.enabled && segment.key === 'category_code',
  );
  const generationReadySupplier = !ruleNeedsSupplier || factorySourceMode === 'supplier';
  const generationReadyCategory = !ruleNeedsCategory || Boolean(selectedCategory);
  const generationPreview = buildProductCodePreview(codeRule, {
    supplierCode: selectedSupplierCode || resolvedUnitCode || 'SUP-BRAVO',
    category: selectedCategory,
    now: '2026-07-17T08:00:00.000Z',
    sequence: 1,
  });
  const salesGenerationPreview = buildProductCodePreview(salesCodeRule, {
    category: selectedCategory,
    now: '2026-07-17T08:00:00.000Z',
    sequence: 1,
  });
  const requirementText = [
    generationReadySupplier ? '已选择供应商' : '需先选择供应商',
    generationReadyCategory ? '已填写产品分类' : '需先填写产品分类',
  ].join('，');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    const form = event.currentTarget;
    const formData = new FormData(form);
    const salesCode =
      salesCodeMode === 'manual'
        ? String(formData.get('salesCode') ?? '').trim()
        : '';
    const purchaseCode = String(formData.get('purchaseCode') ?? '').trim();
    const derivedSku = salesCode || purchaseCode || `SKU-${Date.now()}`;
    setState(initialState);

    if (purchaseCodeMode === 'generated' && ruleNeedsSupplier && !resolvedUnitCode.trim()) {
      setState({
        error: '自动生成采购编码需要单位编码。请选择供应商自动带出，或切换为手工填写采购编码。',
        success: null,
      });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      sku: derivedSku,
      salesCode,
      salesCodeMode,
      purchaseCode,
      purchaseCodeMode: String(formData.get('purchaseCodeMode') ?? ''),
      factorySourceMode,
      brand: String(formData.get('brand') ?? ''),
      factoryName: resolvedFactoryName,
      model: String(formData.get('model') ?? ''),
      spec: String(formData.get('spec') ?? ''),
      singleWeight: readOptionalNumber(formData, 'singleWeight'),
      cartonSpec: String(formData.get('cartonSpec') ?? ''),
      cartonQuantity: readOptionalNumber(formData, 'cartonQuantity'),
      cartonWeight: readOptionalNumber(formData, 'cartonWeight'),
      defaultSupplierCode: resolvedUnitCode,
      productStage: String(formData.get('productStage') ?? ''),
      pricingMode,
      nameCn: String(formData.get('nameCn') ?? ''),
      nameEn: String(formData.get('nameEn') ?? ''),
      category: String(formData.get('category') ?? ''),
      unit: String(formData.get('unit') ?? ''),
      currency: 'USD',
      defaultSalePrice: readPriceOrZero(formData, 'defaultSalePrice'),
      defaultPurchasePrice: readPriceOrZero(formData, 'defaultPurchasePrice'),
      salePriceTiers: buildSalePriceTierPayload(pricingMode, salePriceTiers),
      ownerName: createdBy,
      createdBy,
    };

    try {
      const result = await submitFormalJsonMutationAction(
        endpoint,
        'POST',
        payload,
        resolveRequestHeaders(createdBy, actorAccessScopes),
      );

      if (!result.ok) {
        setState({
          error: result.error,
          success: null,
        });
        return;
      }

      const responseItem =
        typeof result.result === 'object' && result.result !== null
          ? (result.result as Partial<{
              id: number;
              sku: string;
              salesCode: string;
              purchaseCode: string;
              purchaseCodeMode: PurchaseCodeMode;
              productStage: ProductStage;
              pricingMode: PricingMode;
              brand: string | null;
              factoryName: string | null;
              model: string | null;
              spec: string | null;
              singleWeight: number | null;
              cartonSpec: string | null;
              cartonQuantity: number | null;
              cartonWeight: number | null;
              defaultSupplierCode: string | null;
              nameCn: string;
              nameEn: string;
              category: ProductCategory;
              unit: string;
              currency: string;
              defaultSalePrice: number;
              defaultPurchasePrice: number;
              salePriceTiers: Array<{
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
            }>)
          : null;
      const createdItem = {
        id: responseItem?.id ?? Date.now(),
        sku: responseItem?.sku ?? payload.sku,
        salesCode: responseItem?.salesCode ?? (salesCode || undefined),
        purchaseCode: responseItem?.purchaseCode ?? (purchaseCode || undefined),
        purchaseCodeMode: responseItem?.purchaseCodeMode ?? purchaseCodeMode,
        productStage: responseItem?.productStage ?? (payload.productStage as ProductStage),
        pricingMode: responseItem?.pricingMode ?? pricingMode,
        brand: responseItem?.brand ?? (payload.brand.trim() || undefined),
        factoryName: responseItem?.factoryName ?? (payload.factoryName.trim() || undefined),
        model: responseItem?.model ?? (payload.model.trim() || undefined),
        spec: responseItem?.spec ?? (payload.spec.trim() || undefined),
        singleWeight: responseItem?.singleWeight ?? (
          Number.isFinite(payload.singleWeight) ? payload.singleWeight : null
        ),
        cartonSpec: responseItem?.cartonSpec ?? (payload.cartonSpec.trim() || undefined),
        cartonQuantity: responseItem?.cartonQuantity ?? (
          Number.isFinite(payload.cartonQuantity) ? payload.cartonQuantity : null
        ),
        cartonWeight: responseItem?.cartonWeight ?? (
          Number.isFinite(payload.cartonWeight) ? payload.cartonWeight : null
        ),
        defaultSupplierCode:
          responseItem?.defaultSupplierCode ?? (payload.defaultSupplierCode.trim() || undefined),
        nameCn: responseItem?.nameCn ?? payload.nameCn.trim(),
        nameEn: responseItem?.nameEn ?? payload.nameEn.trim(),
        category: responseItem?.category ?? (payload.category as ProductCategory),
        unit: responseItem?.unit ?? payload.unit.trim(),
        currency: responseItem?.currency ?? 'USD',
        defaultSalePrice: responseItem?.defaultSalePrice ?? payload.defaultSalePrice,
        defaultPurchasePrice: responseItem?.defaultPurchasePrice ?? payload.defaultPurchasePrice,
        salePriceTiers:
          responseItem?.salePriceTiers ??
          buildSalePriceTierPayload(pricingMode, salePriceTiers).map((tier, index) => ({
            id: index + 1,
            minQuantity: tier.minQuantity,
            salePrice: tier.salePrice,
            currency: tier.currency,
            status: 'active' as const,
          })),
        ownerName: responseItem?.ownerName ?? createdBy,
        status: responseItem?.status ?? 'active',
        createdAt: responseItem?.createdAt ?? new Date().toISOString(),
        createdBy: responseItem?.createdBy ?? createdBy,
      };

      form.reset();
      setPurchaseCodeMode('generated');
      setFactorySourceMode('manual');
      setPricingMode('fixed');
      setSelectedSupplierCode(supplierOptions[0]?.code ?? '');
      setManualFactoryName('');
      setManualUnitCode('');
      setSalePriceTiers(createEditableSalePriceTiers([]));
      onSuccess?.(createdItem);
      setState({
        error: null,
        success: onSuccess ? '新增成功，已同步到当前列表。' : '新增成功，请刷新查看最新商品。',
      });
    } catch {
      setState({ error: '新增商品失败', success: null });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={formStyle}>
      <input type="hidden" name="currency" value="USD" />
      <input type="hidden" name="ownerName" value={createdBy} />
      <section style={heroCardStyle}>
        <div style={{ display: 'grid', gap: '8px' }}>
          <h3 style={heroTitleStyle}>新增商品</h3>
          <p style={heroCopyStyle}>
            这是正式商品主数据的建档入口。销售编码和采购编码均可手填或按各自规则自动生成。
          </p>
        </div>
        <div style={heroMetaGridStyle}>
          <article style={heroMetaCardStyle}>
            <span style={heroMetaLabelStyle}>销售 / 采购编码模式</span>
            <span style={heroMetaValueStyle}>
              两类编码均可分别选择手工填写或自动生成。
            </span>
          </article>
          <article style={heroMetaCardStyle}>
            <span style={heroMetaLabelStyle}>当前编码规则</span>
            <span style={heroMetaValueStyle}>
              销售：{describeProductCodeRule(salesCodeRule)}；采购：{describeProductCodeRule(codeRule)}。
            </span>
          </article>
          <article style={heroMetaCardStyle}>
            <span style={heroMetaLabelStyle}>当前示例</span>
            <span style={heroMetaValueStyle}>{generationPreview}</span>
          </article>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h4 style={sectionTitleStyle}>编码与来源</h4>
          <p style={sectionCopyStyle}>
            先分别确定销售编码、采购编码的生成模式，再维护工厂来源。
          </p>
        </div>
        <div style={codeSourceGridStyle}>
          <div style={labelStyle}>
            <input type="hidden" name="salesCodeMode" value={salesCodeMode} />
            <span>销售编码模式 Sales Code Mode</span>
            <span role="group" aria-label="销售编码模式 Sales Code Mode" style={segmentedControlStyle}>
              {Object.entries(salesCodeModeLabels).map(([key, value]) => (
                <button
                  className="erp-mode-button"
                  key={key}
                  type="button"
                  aria-pressed={salesCodeMode === key}
                  style={buildModeButtonStyle(salesCodeMode === key)}
                  onClick={() => setSalesCodeMode(key as SalesCodeMode)}
                >
                  {value}
                </button>
              ))}
            </span>
            <span style={helperTextStyle}>自动生成规则：{describeProductCodeRule(salesCodeRule)}。</span>
          </div>
          <label style={labelStyle}>
            {renderRequiredLabel('产品销售编码 Sales Code')}
            <input
              className="erp-control"
              name="salesCode"
              aria-label="产品销售编码 Sales Code"
              style={inputStyle}
              disabled={salesCodeMode === 'generated'}
              placeholder={
                salesCodeMode === 'generated' ? '系统按规则自动生成' : '请手工填写销售编码'
              }
            />
            <span style={mutedTextStyle}>
              {salesCodeMode === 'generated'
                ? `当前示例：${salesGenerationPreview}`
                : '手工编码将直接用于报价、订单和客户沟通。'}
            </span>
          </label>
          <div style={labelStyle}>
            <input type="hidden" name="purchaseCodeMode" value={purchaseCodeMode} />
            <span>采购编码模式 Purchase Code Mode</span>
            <span role="group" aria-label="采购编码模式 Purchase Code Mode" style={segmentedControlStyle}>
              {Object.entries(purchaseCodeModeLabels).map(([key, value]) => (
                <button
                  className="erp-mode-button"
                  key={key}
                  type="button"
                  aria-pressed={purchaseCodeMode === key}
                  style={buildModeButtonStyle(purchaseCodeMode === key)}
                  onClick={() => setPurchaseCodeMode(key as PurchaseCodeMode)}
                >
                  {value}
                </button>
              ))}
            </span>
            <span style={helperTextStyle}>自动生成规则：{describeProductCodeRule(codeRule)}。</span>
          </div>
          <label style={labelStyle}>
            采购编码 Purchase Code
            <input
              aria-label="采购编码 Purchase Code"
              name="purchaseCode"
              style={inputStyle}
              disabled={purchaseCodeMode === 'generated'}
              placeholder={
                purchaseCodeMode === 'generated' ? '系统按规则自动生成' : '可手工填写采购编码'
              }
            />
            <span style={helperTextStyle}>
              {purchaseCodeMode === 'generated'
                ? `当前示例：${generationPreview}`
                : '切换为手工模式后，可填写独立采购编码。'}
            </span>
          </label>
          <div style={labelStyle}>
            <input type="hidden" name="factorySourceMode" value={factorySourceMode} />
            <span>工厂来源 Factory Source</span>
            <span role="group" aria-label="工厂来源 Factory Source" style={segmentedControlStyle}>
              {Object.entries(factorySourceModeLabels).map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={factorySourceMode === key}
                  style={buildModeButtonStyle(factorySourceMode === key)}
                  onClick={() => {
                    const nextMode = key as FactorySourceMode;
                    setFactorySourceMode(nextMode);
                    if (nextMode === 'supplier' && !selectedSupplierCode) {
                      setSelectedSupplierCode(supplierOptions[0]?.code ?? '');
                    }
                  }}
                >
                  {value}
                </button>
              ))}
            </span>
            <span style={helperTextStyle}>生成前提：{requirementText}。</span>
          </div>
          {factorySourceMode === 'supplier' ? (
            <label style={labelStyle}>
              关联供应商 Supplier
              <input
                aria-label="关联供应商 Supplier"
                readOnly
                value={formatCounterpartyOptionLabel(selectedSupplierPickerOption, {
                  nameOrder: 'chinese-english',
                })}
                placeholder="请选择供应商"
                style={inputStyle}
              />
              <CounterpartyPicker
                buttonLabel="选择供应商"
                nameOrder="chinese-english"
                options={supplierPickerOptions}
                selectedId={selectedSupplierPickerId}
                onSelect={(option) => setSelectedSupplierCode(option.code)}
              />
            </label>
          ) : null}
          <label style={labelStyle}>
            工厂 Factory
            <input
              aria-label="工厂 Factory"
              value={resolvedFactoryName}
              onChange={(event) => setManualFactoryName(event.target.value)}
              disabled={factorySourceMode === 'supplier'}
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            单位编码 Unit Code
            <input
              aria-label="单位编码 Unit Code"
              value={resolvedUnitCode}
              onChange={(event) => setManualUnitCode(event.target.value)}
              disabled={factorySourceMode === 'supplier'}
              style={inputStyle}
            />
            <span style={mutedTextStyle}>自动生成采购编码时，会组合当前供应商编码。</span>
          </label>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h4 style={sectionTitleStyle}>产品资料</h4>
          <p style={sectionCopyStyle}>这一组维护产品主属性、分类和报价阶段，方便后续报价、采购、库存共用。</p>
        </div>
        <div style={gridStyle}>
          <label style={labelStyle}>
            品牌 Brand
            <input aria-label="品牌 Brand" name="brand" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            型号 Model
            <input aria-label="型号 Model" name="model" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            单个规格 Spec
            <input aria-label="单个规格 Spec" name="spec" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            {renderRequiredLabel('产品名称 Product Name')}
            <input aria-label="产品名称 Product Name" name="nameCn" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            英文名称 Name EN
            <input aria-label="英文名称 Name EN" name="nameEn" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            {renderRequiredLabel('分类 Category')}
            <select
              aria-label="分类 Category"
              name="category"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value as ProductCategory)}
              style={inputStyle}
            >
              {Object.entries(categoryLabels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label style={labelStyle}>
            单位 Unit
            <input aria-label="单位 Unit" name="unit" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            {renderRequiredLabel('产品阶段 Product Stage')}
            <select
              aria-label="产品阶段 Product Stage"
              name="productStage"
              defaultValue=""
              style={inputStyle}
            >
              <option value="">请选择阶段 Select stage</option>
              {Object.entries(productStageLabels).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <h4 style={sectionTitleStyle}>包装与价格</h4>
          <p style={sectionCopyStyle}>补齐重量、装箱、定价方式和默认价格。需要按数量报价时，直接在下方阶梯售价里维护。</p>
        </div>
        <div style={gridStyle}>
          <label style={labelStyle}>
            单个重量 Weight
            <input
              aria-label="单个重量 Weight"
              name="singleWeight"
              type="number"
              step="0.001"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            装箱规格 Carton Spec
            <input aria-label="装箱规格 Carton Spec" name="cartonSpec" style={inputStyle} />
          </label>
          <label style={labelStyle}>
            装箱数量 Carton Qty
            <input
              aria-label="装箱数量 Carton Qty"
              name="cartonQuantity"
              type="number"
              step="1"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            装箱重量 Carton Weight
            <input
              aria-label="装箱重量 Carton Weight"
              name="cartonWeight"
              type="number"
              step="0.001"
              style={inputStyle}
            />
          </label>
          <div style={labelStyle}>
            <input type="hidden" name="pricingMode" value={pricingMode} />
            <span>定价方式 Pricing Mode</span>
            <span role="group" aria-label="定价方式 Pricing Mode" style={segmentedControlStyle}>
              {Object.entries(pricingModeLabels).map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={pricingMode === key}
                  style={buildModeButtonStyle(pricingMode === key)}
                  onClick={() => setPricingMode(key as PricingMode)}
                >
                  {value}
                </button>
              ))}
            </span>
          </div>
          <label style={labelStyle}>
            默认销售价 Sale Price
            <input
              aria-label="默认销售价 Sale Price"
              name="defaultSalePrice"
              type="number"
              step="0.01"
              style={inputStyle}
            />
          </label>
          <label style={labelStyle}>
            默认采购价 Purchase Price
            <input
              aria-label="默认采购价 Purchase Price"
              name="defaultPurchasePrice"
              type="number"
              step="0.01"
              style={inputStyle}
            />
          </label>
          <div style={fullWidthFieldStyle} />
        </div>
      </section>
      <SalePriceTierEditor
        pricingMode={pricingMode}
        tiers={salePriceTiers}
        onChange={setSalePriceTiers}
      />
      {state.error ? (
        <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: '13px' }}>
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p style={{ margin: 0, color: '#166534', fontSize: '13px' }}>{state.success}</p>
      ) : null}
      <button className="erp-button erp-button--primary" type="submit" disabled={isSubmitting}>
        {isSubmitting ? '提交中...' : '新增商品'}
      </button>
    </form>
  );
}
