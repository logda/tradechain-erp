import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMutationAttempt } from '../app/app/_lib/use-mutation-attempt';

describe('useMutationAttempt', () => {
  it('keeps a successful attempt locked until a save form is edited', () => {
    const { result } = renderHook(() => useMutationAttempt());
    const firstKey = result.current.begin();
    expect(firstKey).toEqual(expect.any(String));

    act(() => result.current.succeed());
    expect(result.current.begin()).toBeNull();
    expect(result.current.isComplete).toBe(true);

    act(() => result.current.resetAfterEdit());
    expect(result.current.isComplete).toBe(false);
    expect(result.current.begin()).not.toBe(firstKey);
  });

  it('retries a failed unchanged attempt with the same key', () => {
    const { result } = renderHook(() => useMutationAttempt());
    const firstKey = result.current.begin();
    result.current.fail();
    expect(result.current.begin()).toBe(firstKey);
    result.current.fail();
    result.current.resetFailedAfterEdit();
    expect(result.current.begin()).not.toBe(firstKey);
  });
});
