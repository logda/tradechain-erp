'use client';

import { useState, type FormEvent } from 'react';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { createQuoteAction, type QuoteFormState } from './actions';

const initialState: QuoteFormState = { error: null };
const fallbackError = '创建报价失败';

export function CreateQuoteForm() {
  const [state, setState] = useState(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setState(initialState);

    const formData = new FormData(event.currentTarget);
    try {
      const nextState = await createQuoteAction(initialState, formData);
      setState(nextState);
    } catch (error) {
      if (isRedirectError(error)) {
        throw error;
      }

      setState({ error: fallbackError });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        Customer ID
        <input name="customerId" type="number" />
      </label>
      <label>
        Sales User ID
        <input name="salesUserId" type="number" />
      </label>
      <label>
        Source Code
        <input name="sourceCode" type="text" />
      </label>
      <label>
        Requirements
        <textarea name="requirements" />
      </label>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Submitting...' : 'Submit Quote'}
      </button>
    </form>
  );
}
