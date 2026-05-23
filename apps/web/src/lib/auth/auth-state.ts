// Auth lifecycle states — deterministic, no ambiguity
export type AuthState =
  | 'IDLE'
  | 'AUTH_INITIATED'
  | 'OAUTH_REDIRECT'
  | 'CALLBACK_RECEIVED'
  | 'IDENTITY_RESOLVED'
  | 'SESSION_CREATED'
  | 'SESSION_VALIDATED'
  | 'LOGGED_IN'
  | 'CALLBACK_FAILED'
  | 'SESSION_INVALID'
  | 'PROVIDER_ERROR'
  | 'RECOVERY_MODE';

export type AuthProvider = 'google' | 'apple' | 'magic_link' | 'password';

export interface AuthStateEvent {
  state: AuthState;
  provider?: AuthProvider;
  error?: string;
  timestamp: number;
  attemptId?: string;
}

// Allowed transitions — enforces determinism
export const AUTH_TRANSITIONS: Record<AuthState, AuthState[]> = {
  IDLE:               ['AUTH_INITIATED'],
  AUTH_INITIATED:     ['OAUTH_REDIRECT', 'PROVIDER_ERROR'],
  OAUTH_REDIRECT:     ['CALLBACK_RECEIVED', 'PROVIDER_ERROR'],
  CALLBACK_RECEIVED:  ['IDENTITY_RESOLVED', 'CALLBACK_FAILED'],
  IDENTITY_RESOLVED:  ['SESSION_CREATED', 'CALLBACK_FAILED'],
  SESSION_CREATED:    ['SESSION_VALIDATED', 'SESSION_INVALID'],
  SESSION_VALIDATED:  ['LOGGED_IN'],
  LOGGED_IN:          ['IDLE'],
  CALLBACK_FAILED:    ['RECOVERY_MODE', 'IDLE'],
  SESSION_INVALID:    ['RECOVERY_MODE', 'IDLE'],
  PROVIDER_ERROR:     ['AUTH_INITIATED', 'RECOVERY_MODE', 'IDLE'],
  RECOVERY_MODE:      ['AUTH_INITIATED', 'IDLE'],
};

export function canTransition(from: AuthState, to: AuthState): boolean {
  return AUTH_TRANSITIONS[from]?.includes(to) ?? false;
}

// Human-readable state labels for UI
export const AUTH_STATE_LABELS: Record<AuthState, string> = {
  IDLE:              'Ready',
  AUTH_INITIATED:    'Initiating...',
  OAUTH_REDIRECT:    'Redirecting to provider...',
  CALLBACK_RECEIVED: 'Processing...',
  IDENTITY_RESOLVED: 'Identity confirmed',
  SESSION_CREATED:   'Creating session...',
  SESSION_VALIDATED: 'Session validated',
  LOGGED_IN:         'Signed in',
  CALLBACK_FAILED:   'Callback failed',
  SESSION_INVALID:   'Session invalid',
  PROVIDER_ERROR:    'Provider error',
  RECOVERY_MODE:     'Recovering...',
};
