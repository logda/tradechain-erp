import type { ProductOption } from './product-options';

export function serializeProductOption(option: ProductOption) {
  return [
    option.id,
    option.sku,
    option.nameCn,
    option.unit,
    option.defaultSalePrice,
  ].join('|');
}
