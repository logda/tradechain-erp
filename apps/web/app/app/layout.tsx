import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { PersistentAppShell } from './_components/app-shell';
import { loadAuthenticatedSession } from './_lib/formal-auth-session';
import { FORMAL_SESSION_COOKIE } from './_lib/formal-session';

export default async function FormalAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const cookieStore = await cookies();
  const session = await loadAuthenticatedSession(cookieStore.get(FORMAL_SESSION_COOKIE)?.value);
  return session ? <PersistentAppShell session={session}>{children}</PersistentAppShell> : children;
}
