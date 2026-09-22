import { resolveApiPort } from '../src/app-port';

describe('resolveApiPort', () => {
  it('defaults to the current API port when PORT is missing', () => {
    expect(resolveApiPort(undefined)).toBe(3001);
  });

  it('uses a positive numeric PORT for parallel verification servers', () => {
    expect(resolveApiPort('3101')).toBe(3101);
  });

  it('falls back to the current API port for invalid PORT values', () => {
    expect(resolveApiPort('not-a-port')).toBe(3001);
    expect(resolveApiPort('0')).toBe(3001);
  });
});
