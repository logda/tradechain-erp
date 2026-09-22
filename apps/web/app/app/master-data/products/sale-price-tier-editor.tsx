'use client';

import type { PricingMode } from './create-product-form';

export type EditableSalePriceTier = {
  id: string;
  minQuantity: string;
  salePrice: string;
};

type PersistedSalePriceTier = {
  minQuantity: number;
  salePrice: number;
};

type SalePriceTierEditorProps = {
  pricingMode: PricingMode;
  tiers: EditableSalePriceTier[];
  onChange: (tiers: EditableSalePriceTier[]) => void;
  compact?: boolean;
};

const sectionStyle = {
  display: 'grid',
  gap: '10px',
  padding: '14px',
  border: '1px solid #d8e1ea',
  borderRadius: '6px',
  background: '#f8fbff',
} satisfies React.CSSProperties;

const sectionCompactStyle = {
  ...sectionStyle,
  padding: '10px',
} satisfies React.CSSProperties;

const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '10px',
  flexWrap: 'wrap' as const,
} satisfies React.CSSProperties;

const titleStyle = {
  margin: 0,
  fontSize: '13px',
  fontWeight: 700,
  color: '#0f172a',
} satisfies React.CSSProperties;

const helperStyle = {
  margin: 0,
  fontSize: '12px',
  color: '#64748b',
  lineHeight: 1.6,
} satisfies React.CSSProperties;

const gridStyle = {
  display: 'grid',
  gap: '10px',
} satisfies React.CSSProperties;

const rowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr)) auto',
  gap: '10px',
  alignItems: 'end',
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: '6px',
  fontSize: '12px',
  color: '#334155',
} satisfies React.CSSProperties;

const inputStyle = {
  border: '1px solid #cfd8e3',
  borderRadius: '4px',
  padding: '9px 10px',
  background: '#ffffff',
  color: '#0f172a',
  fontSize: '12px',
} satisfies React.CSSProperties;

const ghostButtonStyle = {
  border: '1px solid #cbd5e1',
  borderRadius: '4px',
  padding: '8px 10px',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '12px',
} satisfies React.CSSProperties;

function nextTierId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function createEmptyEditableSalePriceTier(): EditableSalePriceTier {
  return {
    id: nextTierId(),
    minQuantity: '',
    salePrice: '',
  };
}

export function createEditableSalePriceTiers(
  tiers: PersistedSalePriceTier[] | undefined,
): EditableSalePriceTier[] {
  if (!tiers?.length) {
    return [createEmptyEditableSalePriceTier()];
  }

  return tiers.map((tier) => ({
    id: nextTierId(),
    minQuantity: String(tier.minQuantity),
    salePrice: String(tier.salePrice),
  }));
}

export function buildSalePriceTierPayload(
  pricingMode: PricingMode,
  tiers: EditableSalePriceTier[],
  currency = 'USD',
) {
  if (pricingMode !== 'tiered') {
    return [];
  }

  return tiers
    .map((tier) => ({
      minQuantity: Number(tier.minQuantity),
      salePrice: Number(tier.salePrice),
      currency,
    }))
    .filter(
      (tier) =>
        Number.isFinite(tier.minQuantity) &&
        Number.isFinite(tier.salePrice) &&
        tier.minQuantity > 0,
    )
    .sort((left, right) => left.minQuantity - right.minQuantity);
}

export function SalePriceTierEditor({
  pricingMode,
  tiers,
  onChange,
  compact = false,
}: SalePriceTierEditorProps) {
  if (pricingMode !== 'tiered') {
    return (
      <div style={compact ? sectionCompactStyle : sectionStyle}>
        <p style={titleStyle}>阶梯售价 Tiered Pricing</p>
        <p style={helperStyle}>当前为固定报价模式，仅使用默认销售价。需要按数量分档时切换为阶梯模式。</p>
      </div>
    );
  }

  return (
    <div style={compact ? sectionCompactStyle : sectionStyle}>
      <div style={headerStyle}>
        <p style={titleStyle}>阶梯售价 Tiered Pricing</p>
        <button
          type="button"
          style={ghostButtonStyle}
          onClick={() => onChange([...tiers, createEmptyEditableSalePriceTier()])}
        >
          新增阶梯 Add Tier
        </button>
      </div>
      <p style={helperStyle}>支持例如 100 件一个售价、1000 件一个售价；系统会按最小数量从小到大保存。</p>
      <div style={gridStyle}>
        {tiers.map((tier, index) => (
          <div key={tier.id} style={rowStyle}>
            <label style={labelStyle}>
              最小数量 Min Qty {index + 1}
              <input
                aria-label={`最小数量 Min Qty ${index + 1}`}
                value={tier.minQuantity}
                onChange={(event) =>
                  onChange(
                    tiers.map((item) =>
                      item.id === tier.id
                        ? { ...item, minQuantity: event.target.value }
                        : item,
                    ),
                  )
                }
                type="number"
                min="1"
                step="1"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>
              阶梯售价 Tier Price {index + 1}
              <input
                aria-label={`阶梯售价 Tier Price ${index + 1}`}
                value={tier.salePrice}
                onChange={(event) =>
                  onChange(
                    tiers.map((item) =>
                      item.id === tier.id
                        ? { ...item, salePrice: event.target.value }
                        : item,
                    ),
                  )
                }
                type="number"
                min="0"
                step="0.01"
                style={inputStyle}
              />
            </label>
            <button
              type="button"
              style={ghostButtonStyle}
              disabled={tiers.length === 1}
              onClick={() => {
                if (tiers.length === 1) {
                  return;
                }

                onChange(tiers.filter((item) => item.id !== tier.id));
              }}
            >
              删除阶梯
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
