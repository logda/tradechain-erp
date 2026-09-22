import { CreateQuoteForm } from './create-quote-form';

export default function NewQuotePage() {
  return (
    <main>
      <h1>Create Quote</h1>
      <p>Submit a draft quote and continue into the quote detail workflow.</p>
      <CreateQuoteForm />
    </main>
  );
}
