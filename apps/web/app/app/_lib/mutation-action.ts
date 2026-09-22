export type MutationField = {
  name: string;
  value: string | number | boolean;
  dataType?: 'string' | 'number' | 'boolean' | 'numberArray' | 'json';
  display?: 'hidden' | 'input' | 'select';
  label?: string;
  inputType?: 'text' | 'number' | 'date';
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  min?: number;
  max?: number;
  options?: Array<{
    label: string;
    value: string | number;
  }>;
};

function parseValue(value: FormDataEntryValue | null, dataType: MutationField['dataType']) {
  if (dataType === 'number') {
    return typeof value === 'string' ? Number(value) : NaN;
  }

  if (dataType === 'boolean') {
    return value === 'true';
  }

  if (dataType === 'numberArray') {
    if (typeof value !== 'string' || value.trim() === '') {
      return [];
    }

    return value
      .split(',')
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isFinite(entry));
  }

  if (dataType === 'json') {
    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  return typeof value === 'string' ? value : '';
}

export function buildMutationPayload(formData: FormData, fields: MutationField[]) {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      parseValue(formData.get(field.name), field.dataType ?? 'string'),
    ]),
  );
}
