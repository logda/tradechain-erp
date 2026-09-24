import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  FORMAL_SESSION_COOKIE,
} from './app/_lib/formal-session';
import { loadAuthenticatedSession } from './app/_lib/formal-auth-session';

export default async function HomePage() {
  const cookieStore = await cookies();
  const formalSession = await loadAuthenticatedSession(
    cookieStore.get(FORMAL_SESSION_COOKIE)?.value,
  );

  if (formalSession) {
    redirect('/app');
  }

  redirect('/app/login');
}
