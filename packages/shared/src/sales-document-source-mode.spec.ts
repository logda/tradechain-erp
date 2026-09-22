import {
  normalizeSalesDocumentSourceMode,
  resolveSalesDocumentSourceMode,
  salesDocumentSourceModeOptions,
} from './sales-document-source-mode.js';

describe('sales document source mode helpers', () => {
  it('exposes the supported source mode options in order', () => {
    expect(salesDocumentSourceModeOptions).toEqual([
      'all',
      'direct',
      'from_demand',
      'from_quote',
      'from_quote_with_inquiry',
    ]);
  });

  it('normalizes unsupported values to all', () => {
    expect(normalizeSalesDocumentSourceMode('direct')).toBe('direct');
    expect(normalizeSalesDocumentSourceMode('bogus')).toBe('all');
    expect(normalizeSalesDocumentSourceMode(undefined)).toBe('all');
  });

  it('resolves source mode from source summary text', () => {
    expect(resolveSalesDocumentSourceMode('DIRECT / 直建')).toBe('direct');
    expect(resolveSalesDocumentSourceMode('报价 Q202607080003')).toBe(
      'from_quote',
    );
    expect(resolveSalesDocumentSourceMode('DEMAND / 需求转单')).toBe(
      'from_demand',
    );
    expect(
      resolveSalesDocumentSourceMode('报价 Q202607080001 / 询价 IQ202607080002'),
    ).toBe('from_quote_with_inquiry');
  });
});
