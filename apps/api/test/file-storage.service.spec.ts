import { normalizeUploadedFileName } from '../src/file-storage/file-storage.service';

describe('FileStorageService', () => {
  it('keeps normal uploaded file names readable', () => {
    expect(normalizeUploadedFileName('quote-spec.pdf')).toBe('quote-spec.pdf');
    expect(normalizeUploadedFileName('报价附件.pdf')).toBe('报价附件.pdf');
  });

  it('normalizes latin1-decoded uploaded Chinese file names', () => {
    const mojibakeName = Buffer.from('报价附件.pdf', 'utf8').toString('latin1');

    expect(normalizeUploadedFileName(mojibakeName)).toBe('报价附件.pdf');
  });
});
