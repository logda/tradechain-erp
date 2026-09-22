export const requiredCustomerProductError = '客户和产品为必填项，请先选择后再创建报价';
export const requiredCustomerError = '请选择往来单位';
export const requiredManualCustomerError = '请填写客户名称';
export const requiredProductError = '请选择商品';
export const requiredCandidateProductError = '请填写候选产品名称';
export const invalidQuoteCandidateError = '报价单只能选择产品库产品';

function readTrimmedString(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function hasExistingCustomer(formData: FormData) {
  return Boolean(readTrimmedString(formData, 'customerId'));
}

function hasManualCustomer(formData: FormData) {
  return Boolean(readTrimmedString(formData, 'customerName'));
}

function hasExistingProduct(formData: FormData) {
  return Boolean(readTrimmedString(formData, 'productOption'));
}

function hasCandidateProduct(formData: FormData) {
  return Boolean(readTrimmedString(formData, 'candidateNameCn'));
}

export function validateCreateFormalQuoteFormData(formData: FormData) {
  const customerEntryMode =
    String(formData.get('customerEntryMode') ?? 'existing') === 'manual'
      ? 'manual'
      : 'existing';
  const productEntryMode =
    String(
      formData.get('productSource') ??
        formData.get('productEntryMode') ??
        'existing',
    ) === 'candidate'
      ? 'candidate'
      : 'existing';
  const documentType =
    String(formData.get('documentType') ?? 'demand') === 'quote'
      ? 'quote'
      : 'demand';

  if (documentType === 'quote' && productEntryMode === 'candidate') {
    return invalidQuoteCandidateError;
  }

  const hasCustomer =
    customerEntryMode === 'manual'
      ? hasManualCustomer(formData)
      : hasExistingCustomer(formData);
  const hasProduct =
    productEntryMode === 'candidate'
      ? hasCandidateProduct(formData)
      : hasExistingProduct(formData);

  if (!hasCustomer && !hasProduct) {
    return requiredCustomerProductError;
  }

  if (!hasCustomer) {
    return customerEntryMode === 'manual'
      ? requiredManualCustomerError
      : requiredCustomerError;
  }

  if (!hasProduct) {
    return productEntryMode === 'candidate'
      ? requiredCandidateProductError
      : requiredProductError;
  }

  return null;
}
