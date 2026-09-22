import {
  sampleIsCancelledOptions,
  sampleIsReplacementOptions,
  sampleListSortFields,
} from './sample-list.js';

describe('sample list query contracts', () => {
  it('exposes the supported sort fields in order', () => {
    expect(sampleListSortFields).toEqual([
      'createdAt',
      'docNo',
      'customerName',
    ]);
  });

  it('exposes tri-state replacement and cancellation filter options', () => {
    expect(sampleIsReplacementOptions).toEqual(['all', 'yes', 'no']);
    expect(sampleIsCancelledOptions).toEqual(['all', 'yes', 'no']);
  });
});
