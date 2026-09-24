'use client';

import { type FormEvent, useState } from 'react';
import {
  buildFormalRequestHeaders,
  buildFormalRequestHeadersFromSearch,
} from '../../_lib/formal-request-headers';
import { submitFormalJsonMutationAction } from '../../_actions/formal-mutation-action';
import { useMutationAttempt } from '../../_lib/use-mutation-attempt';
import {
  CounterpartyPicker,
  formatCounterpartyOptionLabel,
} from '../../_components/counterparty-picker';
import type {
  FactorySourceMode,
  PricingMode,
  ProductCategory,
  ProductStage,
  PurchaseCodeMode,
} from './create-product-form';
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

type ProductItem = {
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
};

type ProductRowDraft = ProductItem & {
  productStage?: ProductStage;
  pricingMode?: PricingMode;
};

type UpdateProductFormProps = {
  endpoint: string;
  item: ProductItem;
  updatedBy: string;
  supplierOptions?: ProductSupplierOption[];
  actorAccessScopes?: {
    modules: string[];
    dataScope: string;
    actions?: string[];
  };
  onSuccess?: (item: ProductRowDraft) => void;
};

const formStyle = {
  display: 'grid',
  gap: '14px',
  minWidth: '320px',
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: '12px',
} satisfies React.CSSProperties;

const sectionStyle = {
  display: 'grid',
  gap: '12px',
  padding: '14px',
  border: '1px solid #dbe4ee',
  borderRadius: '14px',
  background: '#ffffff',
} satisfies React.CSSProperties;

const sectionTitleStyle = {
  margin: 0,
  fontSize: '14px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const fieldStyle = {
  display: 'grid',
  gap: '6px',
  alignContent: 'start',
} satisfies React.CSSProperties;

const fieldLabelStyle = {
  color: '#475569',
  fontSize: '12px',
  fontWeight: 600,
  lineHeight: '18px',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cfd8e3',
  borderRadius: '4px',
  padding: '8px 10px',
  background: '#ffffff',
  fontSize: '12px',
  width: '100%',
  boxSizing: 'border-box',
} satisfies React.CSSProperties;

const segmentedControlStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '6px',
} satisfies React.CSSProperties;

function buildModeButtonStyle(isActive: boolean) {
  return {
    border: isActive ? '1px solid #334155' : '1px solid #cfd8e3',
    borderRadius: '4px',
    padding: '8px 10px',
    background: isActive ? '#334155' : '#ffffff',
    color: isActive ? '#ffffff' : '#0f172a',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  } satisfies React.CSSProperties;
}

const buttonStyle = {
  border: '1px solid #334155',
  borderRadius: '4px',
  padding: '8px 10px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
  width: 'fit-content',
} satisfies React.CSSProperties;

function resolveRequestHeaders(
  updatedBy: string,
  actorAccessScopes?: UpdateProductFormProps['actorAccessScopes'],
) {
  if (actorAccessScopes) {
    return buildFormalRequestHeaders({
      role: 'admin',
      user: updatedBy,
      accessScopes: actorAccessScopes,
    });
  }

  if (typeof window === 'undefined') {
    return buildFormalRequestHeadersFromSearch(new URLSearchParams(), {
      role: 'admin',
      user: updatedBy,
    });
  }

  return buildFormalRequestHeadersFromSearch(
    new URLSearchParams(window.location.search),
    { role: 'admin', user: updatedBy },
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

export function UpdateProductForm({
  endpoint,
  item,
  updatedBy,
  supplierOptions = fallbackProductSupplierOptions,
  actorAccessScopes,
  onSuccess,
}: UpdateProductFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const attempt = useMutationAttempt();
  const matchedSupplier = item.defaultSupplierCode
    ? findProductSupplierOption(supplierOptions, item.defaultSupplierCode)
    : undefined;
  const initialFactorySourceMode: FactorySourceMode =
    matchedSupplier && matchedSupplier.name === (item.factoryName ?? '')
      ? 'supplier'
      : 'manual';
  const [factorySourceMode, setFactorySourceMode] =
    useState<FactorySourceMode>(initialFactorySourceMode);
  const [purchaseCodeMode, setPurchaseCodeMode] = useState<PurchaseCodeMode>(
    item.purchaseCodeMode ?? 'manual',
  );
  const [pricingMode, setPricingMode] = useState<PricingMode>(item.pricingMode ?? 'fixed');
  const [selectedSupplierCode, setSelectedSupplierCode] = useState(
    matchedSupplier?.code ?? supplierOptions[0]?.code ?? '',
  );
  const [manualFactoryName, setManualFactoryName] = useState(item.factoryName ?? '');
  const [manualUnitCode, setManualUnitCode] = useState(item.defaultSupplierCode ?? '');
  const [salePriceTiers, setSalePriceTiers] = useState(() =>
    createEditableSalePriceTiers(item.salePriceTiers),
  );
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || attempt.isComplete) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    setError(null);
    setMessage(null);
    const requestKey = attempt.begin();
    if (!requestKey) return;
    setIsSubmitting(true);

    try {
      const result = await submitFormalJsonMutationAction(
        endpoint,
        'PATCH',
        {
          sku: String(formData.get('sku') ?? ''),
          salesCode: String(formData.get('salesCode') ?? ''),
          purchaseCode: String(formData.get('purchaseCode') ?? ''),
          purchaseCodeMode,
          factorySourceMode,
          brand: String(formData.get('brand') ?? ''),
          factoryName: resolvedFactoryName,
          model: String(formData.get('model') ?? ''),
          spec: String(formData.get('spec') ?? ''),
          singleWeight: Number(formData.get('singleWeight')),
          cartonSpec: String(formData.get('cartonSpec') ?? ''),
          cartonQuantity: Number(formData.get('cartonQuantity')),
          cartonWeight: Number(formData.get('cartonWeight')),
          defaultSupplierCode: resolvedUnitCode,
          productStage: String(formData.get('productStage') ?? ''),
          pricingMode,
          nameCn: String(formData.get('nameCn') ?? ''),
          nameEn: String(formData.get('nameEn') ?? ''),
          category: String(formData.get('category') ?? ''),
          unit: String(formData.get('unit') ?? ''),
          currency: 'USD',
          defaultSalePrice: Number(formData.get('defaultSalePrice')),
          defaultPurchasePrice: Number(formData.get('defaultPurchasePrice')),
          salePriceTiers: buildSalePriceTierPayload(pricingMode, salePriceTiers),
          ownerName: item.ownerName,
          updatedBy,
        },
        resolveRequestHeaders(updatedBy, actorAccessScopes),
        requestKey,
      );

      if (!result.ok) {
        attempt.fail();
        setError(result.error);
        return;
      }

      const nextSalePriceTiers = buildSalePriceTierPayload(pricingMode, salePriceTiers).map(
        (tier, index) => ({
          id: item.salePriceTiers?.[index]?.id ?? index + 1,
          minQuantity: tier.minQuantity,
          salePrice: tier.salePrice,
          currency: tier.currency,
          status: 'active' as const,
        }),
      );
      const nextItem: ProductRowDraft = {
        ...item,
        salesCode: String(formData.get('salesCode') ?? '').trim(),
        purchaseCode: String(formData.get('purchaseCode') ?? '').trim(),
        purchaseCodeMode,
        productStage: String(formData.get('productStage') ?? '') as ProductStage,
        pricingMode,
        brand: String(formData.get('brand') ?? '').trim(),
        factoryName: resolvedFactoryName.trim(),
        model: String(formData.get('model') ?? '').trim(),
        spec: String(formData.get('spec') ?? '').trim(),
        singleWeight: Number(formData.get('singleWeight')),
        cartonSpec: String(formData.get('cartonSpec') ?? '').trim(),
        cartonQuantity: Number(formData.get('cartonQuantity')),
        cartonWeight: Number(formData.get('cartonWeight')),
        defaultSupplierCode: resolvedUnitCode.trim(),
        nameCn: String(formData.get('nameCn') ?? '').trim(),
        nameEn: String(formData.get('nameEn') ?? '').trim(),
        category: String(formData.get('category') ?? '') as ProductCategory,
        unit: String(formData.get('unit') ?? '').trim(),
        currency: 'USD',
        defaultSalePrice: Number(formData.get('defaultSalePrice')),
        defaultPurchasePrice: Number(formData.get('defaultPurchasePrice')),
        salePriceTiers: nextSalePriceTiers,
      };
      const responseItem =
        typeof result.result === 'object' && result.result !== null
          ? (result.result as Partial<ProductRowDraft>)
          : null;

      onSuccess?.({
        ...nextItem,
        ...responseItem,
      });
      setMessage('保存成功');
      attempt.succeed();
    } catch {
      attempt.fail();
      setError('保存失败');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChangeCapture={attempt.resetAfterEdit} style={formStyle}>
      <input type="hidden" name="currency" value="USD" />
      <input type="hidden" name="ownerName" value={item.ownerName} />
      <input type="hidden" name="sku" value={item.sku} />
      <section style={sectionStyle}>
        <h5 style={sectionTitleStyle}>基础信息 Basic Info</h5>
        <div style={gridStyle}>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>产品销售编码 Sales Code</span>
            <input
              aria-label={`产品销售编码 Sales Code ${item.sku}`}
              name="salesCode"
              defaultValue={item.salesCode ?? ''}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>采购编码 Purchase Code</span>
            <input
              aria-label={`采购编码 Purchase Code ${item.sku}`}
              name="purchaseCode"
              defaultValue={item.purchaseCode ?? ''}
              style={inputStyle}
            />
          </label>
          <div style={fieldStyle}>
            <input type="hidden" name="purchaseCodeMode" value={purchaseCodeMode} />
            <span style={fieldLabelStyle}>采购编码模式 Purchase Code Mode</span>
            <span
              role="group"
              aria-label={`采购编码模式 Purchase Code Mode ${item.sku}`}
              style={segmentedControlStyle}
            >
              {(['manual', 'generated'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={purchaseCodeMode === mode}
                  style={buildModeButtonStyle(purchaseCodeMode === mode)}
                  onClick={() => setPurchaseCodeMode(mode)}
                >
                  {mode === 'manual' ? 'manual / 手工填写' : 'generated / 自动生成'}
                </button>
              ))}
            </span>
          </div>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>产品名称 Product Name</span>
            <input
              aria-label={`产品名称 Product Name ${item.sku}`}
              name="nameCn"
              defaultValue={item.nameCn}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>英文名称 Name EN</span>
            <input
              aria-label={`英文名称 Name EN ${item.sku}`}
              name="nameEn"
              defaultValue={item.nameEn}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>分类 Category</span>
            <select
              aria-label={`分类 Category ${item.sku}`}
              name="category"
              defaultValue={item.category}
              style={inputStyle}
            >
              <option value="electronics">electronics / 电子类</option>
              <option value="consumables">consumables / 耗材类</option>
              <option value="service">service / 服务类</option>
            </select>
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>单位 Unit</span>
            <input
              aria-label={`单位 Unit ${item.sku}`}
              name="unit"
              defaultValue={item.unit}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>产品阶段 Product Stage</span>
            <select
              aria-label={`产品阶段 Product Stage ${item.sku}`}
              name="productStage"
              defaultValue={item.productStage ?? 'formal'}
              style={inputStyle}
            >
              <option value="formal">formal / 正式阶段</option>
              <option value="quote_candidate">quote_candidate / 候选阶段</option>
            </select>
          </label>
        </div>
      </section>

      <section style={sectionStyle}>
        <h5 style={sectionTitleStyle}>包装物流 Packaging & Logistics</h5>
        <div style={gridStyle}>
          <div style={fieldStyle}>
            <span style={fieldLabelStyle}>工厂来源 Factory Source</span>
            <span
              role="group"
              aria-label={`工厂来源 Factory Source ${item.sku}`}
              style={segmentedControlStyle}
            >
              {(['manual', 'supplier'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={factorySourceMode === mode}
                  style={buildModeButtonStyle(factorySourceMode === mode)}
                  onClick={() => {
                    const nextMode = mode;
                    setFactorySourceMode(nextMode);
                    if (nextMode === 'supplier' && !selectedSupplierCode) {
                      setSelectedSupplierCode(supplierOptions[0]?.code ?? '');
                    }
                  }}
                >
                  {mode === 'manual'
                    ? 'manual / 手写工厂与单位编码'
                    : 'supplier / 选择供应商自动带出'}
                </button>
              ))}
            </span>
          </div>
          {factorySourceMode === 'supplier' ? (
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>关联供应商 Supplier</span>
              <input
                aria-label={`关联供应商 Supplier ${item.sku}`}
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
          ) : (
            <label style={fieldStyle}>
              <span style={fieldLabelStyle}>工厂 Factory</span>
              <input
                aria-label={`工厂 Factory ${item.sku}`}
                value={resolvedFactoryName}
                onChange={(event) => setManualFactoryName(event.target.value)}
                style={inputStyle}
              />
            </label>
          )}
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>单位编码 Unit Code</span>
            <input
              aria-label={`单位编码 Unit Code ${item.sku}`}
              value={resolvedUnitCode}
              onChange={(event) => setManualUnitCode(event.target.value)}
              disabled={factorySourceMode === 'supplier'}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>品牌 Brand</span>
            <input
              aria-label={`品牌 Brand ${item.sku}`}
              name="brand"
              defaultValue={item.brand ?? ''}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>型号 Model</span>
            <input
              aria-label={`型号 Model ${item.sku}`}
              name="model"
              defaultValue={item.model ?? ''}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>单个规格 Spec</span>
            <input
              aria-label={`单个规格 Spec ${item.sku}`}
              name="spec"
              defaultValue={item.spec ?? ''}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>单个重量 Weight</span>
            <input
              aria-label={`单个重量 Weight ${item.sku}`}
              name="singleWeight"
              type="number"
              step="0.001"
              defaultValue={item.singleWeight ?? ''}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>装箱规格 Carton Spec</span>
            <input
              aria-label={`装箱规格 Carton Spec ${item.sku}`}
              name="cartonSpec"
              defaultValue={item.cartonSpec ?? ''}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>装箱数量 Carton Qty</span>
            <input
              aria-label={`装箱数量 Carton Qty ${item.sku}`}
              name="cartonQuantity"
              type="number"
              step="1"
              defaultValue={item.cartonQuantity ?? ''}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>装箱重量 Carton Weight</span>
            <input
              aria-label={`装箱重量 Carton Weight ${item.sku}`}
              name="cartonWeight"
              type="number"
              step="0.001"
              defaultValue={item.cartonWeight ?? ''}
              style={inputStyle}
            />
          </label>
        </div>
      </section>

      <section style={sectionStyle}>
        <h5 style={sectionTitleStyle}>价格与供应商 Pricing & Supplier</h5>
        <div style={gridStyle}>
          <div style={fieldStyle}>
            <input type="hidden" name="pricingMode" value={pricingMode} />
            <span style={fieldLabelStyle}>定价方式 Pricing Mode</span>
            <span
              role="group"
              aria-label={`定价方式 Pricing Mode ${item.sku}`}
              style={segmentedControlStyle}
            >
              {(['fixed', 'tiered'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={pricingMode === mode}
                  style={buildModeButtonStyle(pricingMode === mode)}
                  onClick={() => setPricingMode(mode)}
                >
                  {mode === 'fixed' ? 'fixed / 固定模式' : 'tiered / 阶梯模式'}
                </button>
              ))}
            </span>
          </div>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>默认销售价 Sale Price</span>
            <input
              aria-label={`默认销售价 Sale Price ${item.sku}`}
              name="defaultSalePrice"
              type="number"
              step="0.01"
              defaultValue={item.defaultSalePrice}
              style={inputStyle}
            />
          </label>
          <label style={fieldStyle}>
            <span style={fieldLabelStyle}>默认采购价 Purchase Price</span>
            <input
              aria-label={`默认采购价 Purchase Price ${item.sku}`}
              name="defaultPurchasePrice"
              type="number"
              step="0.01"
              defaultValue={item.defaultPurchasePrice}
              style={inputStyle}
            />
          </label>
        </div>
      </section>

      <section style={sectionStyle}>
        <h5 style={sectionTitleStyle}>阶梯售价 Sale Price Tiers</h5>
        <SalePriceTierEditor
          pricingMode={pricingMode}
          tiers={salePriceTiers}
          onChange={setSalePriceTiers}
          compact
        />
      </section>
      {error ? (
        <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: '12px' }}>
          {error}
        </p>
      ) : null}
      {message ? <p style={{ margin: 0, color: '#166534', fontSize: '12px' }}>{message}</p> : null}
      <button type="submit" disabled={isSubmitting || attempt.isComplete} style={buttonStyle}>
        {isSubmitting ? '保存中...' : '保存编辑'}
      </button>
    </form>
  );
}
