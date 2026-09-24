'use client';

import { useRef, useState } from 'react';
import { createMutationRequestKey } from './mutation-request-key';

export function useMutationAttempt() {
  const locked = useRef(false);
  const key = useRef<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  return {
    isComplete,
    begin() {
      if (locked.current) return null;
      locked.current = true;
      key.current ??= createMutationRequestKey();
      return key.current;
    },
    succeed() {
      setIsComplete(true);
    },
    fail() {
      locked.current = false;
    },
    resetAfterEdit() {
      if (locked.current && !isComplete) return;
      locked.current = false;
      key.current = null;
      if (isComplete) setIsComplete(false);
    },
    resetFailedAfterEdit() {
      if (locked.current || isComplete) return;
      key.current = null;
    },
  };
}
