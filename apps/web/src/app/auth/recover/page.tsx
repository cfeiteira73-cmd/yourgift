'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const REASON_MESSAGES: Record<string, string> = {
  callback_failed:
    'We could not verify your sign-in. The link may have expired or already been used.',
  session_expired:
    'Your session has expired. Please sign in again to continue.',
  unauthorized:
    "You don't have permission to access that page. Please sign in with an authorised account.",
  missing_code:
    'The authentication link is incomplete. Please request a new one.',
  access_denied:
    'Access was denied. If this was a mistake, please try signing in again.',
  server_error:
    'An error occurred with the sign-in provider. Please try again.',
  no_user:
    'Sign-in succeeded but we could not load your account. Please try again.',
  missing_token:
    'The magic link is incomplete or has expired. Please request a new one.',
  link_expired:
    'This link has expired. Please request a new magic link.',
  no_code:
    'The authentication link is incomplete. Please try signing in again.',
};

function RecoverContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason') ?? '';

  const message =
    REASON_MESSAGES[reason] ??
    'Something went wrong during authentication. Please try again.';

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-md text-center">
        {/* Icon */}
        <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2" />
            <path
              d="M12 8v4M12 16h.01"
              stroke="#EF4444"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        {/* Logo */}
        <Link href="/" className="inline-block text-xl font-black text-gray-900 mb-6">
          your<span className="text-brand-600">gift</span>
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Authentication failed
        </h1>
        <p className="text-sm text-gray-500 mb-8">{message}</p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={() => router.push('/auth/login')}
            className="w-full bg-brand-600 text-white py-3 rounded-xl font-semibold hover:bg-brand-700 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="w-full border border-gray-300 text-gray-700 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors text-sm"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function RecoverPage() {
  return (
    <Suspense>
      <RecoverContent />
    </Suspense>
  );
}
