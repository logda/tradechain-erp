export type ProductSupplierOption = {
  code: string;
  name: string;
  shortName?: string;
};

export const fallbackProductSupplierOptions: ProductSupplierOption[] = [
  {
    code: 'SUP-BRAVO',
    name: 'Bravo Industrial',
  },
  {
    code: 'CP-GLOBAL',
    name: 'Global Partner Ltd.',
  },
];

export function findProductSupplierOption(
  supplierOptions: ProductSupplierOption[],
  code: string,
) {
  return supplierOptions.find((item) => item.code === code);
}
