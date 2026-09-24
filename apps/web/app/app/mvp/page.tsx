import { redirect } from 'next/navigation';

export default async function AppMvpPage(_props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect('/app');
}
