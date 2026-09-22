export const counterpartyFieldLabels = {
  code: '单位编码',
  name: '单位名称',
  shortName: '中文名称',
  region: '所属区域',
  ownerName: '所属人员',
  contactName: '联系人',
  phone: '联系号码',
  address: '地址',
  bankName: '开户银行',
  bankAccount: '银行账号',
  remark: '备注',
} as const;

export type CounterpartyFieldName = keyof typeof counterpartyFieldLabels;

export const counterpartyRequiredFieldLabels = {
  code: counterpartyFieldLabels.code,
  name: counterpartyFieldLabels.name,
  ownerName: counterpartyFieldLabels.ownerName,
} as const;

export type CounterpartyRequiredFieldName =
  keyof typeof counterpartyRequiredFieldLabels;

export const counterpartyFieldPlaceholders: Record<
  CounterpartyFieldName,
  string
> = {
  code: '请输入单位编码',
  name: '请输入单位名称',
  shortName: '请输入中文名称',
  region: '请输入所属区域',
  ownerName: '请选择所属人员',
  contactName: '请输入联系人',
  phone: '请输入联系号码',
  address: '请输入地址',
  bankName: '请输入开户银行',
  bankAccount: '请输入银行账号',
  remark: '请输入备注',
};

function normalizeFieldValue(value: string | null | undefined) {
  return value?.trim() ?? '';
}

export function getMissingCounterpartyRequiredFields(
  values: Partial<Record<CounterpartyFieldName, string>>,
) {
  return (
    Object.keys(counterpartyRequiredFieldLabels) as CounterpartyRequiredFieldName[]
  ).filter((fieldName) => !normalizeFieldValue(values[fieldName]));
}

export function buildCounterpartyRequiredFieldMessage(
  values: Partial<Record<CounterpartyFieldName, string>>,
) {
  const missingFields = getMissingCounterpartyRequiredFields(values);

  if (missingFields.length === 0) {
    return null;
  }

  return `请完整填写以下必填项：${missingFields
    .map((fieldName) => counterpartyRequiredFieldLabels[fieldName])
    .join('、')}`;
}
