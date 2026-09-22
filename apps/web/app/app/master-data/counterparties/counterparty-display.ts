export type CounterpartyDisplayItem = {
  code: string;
  shortName: string;
};

const defaultChineseNamesByCode: Record<string, string> = {
  'CP-GLOBAL': '环球伙伴',
  'CUS-ACME': '星河贸易',
  'CUST-ACME': '星河贸易',
  'SUP-BRAVO': '光源制造',
  'SUP-LIGHT': '光源制造',
};

export function resolveCounterpartyChineseName(item: CounterpartyDisplayItem) {
  const shortName = item.shortName.trim();
  return shortName || defaultChineseNamesByCode[item.code.trim().toUpperCase()] || '';
}

export function normalizeCounterpartyDisplayItem<T extends CounterpartyDisplayItem>(
  item: T,
) {
  return {
    ...item,
    shortName: resolveCounterpartyChineseName(item),
  };
}
