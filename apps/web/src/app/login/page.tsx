// /login → redirect to /auth/login (canonical auth URL)
import { redirect } from 'next/navigation';

export default function LoginRedirect() {
  redirect('/auth/login');
}
