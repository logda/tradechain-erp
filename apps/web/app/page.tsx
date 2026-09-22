import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  buildFormalWorkspaceUrl,
  decodeFormalSessionCookie,
  FORMAL_SESSION_COOKIE,
} from './app/_lib/formal-session';

export default async function HomePage() {
  const cookieStore = await cookies();
  const formalSession = decodeFormalSessionCookie(
    cookieStore.get(FORMAL_SESSION_COOKIE)?.value,
  );

  if (formalSession) {
    redirect(buildFormalWorkspaceUrl(formalSession));
  }

  redirect('/app/login');
}
