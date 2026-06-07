'use client';

export interface TimelineStep {
  key: string;
  label: string;
  timestamp?: string | null;
  actor?: string | null;
  trackingNumber?: string | null;
}

interface OrderTimelineProps {
  steps: TimelineStep[];
  currentStatus: string;
}

const STEP_KEYS = ['created', 'paid', 'approved', 'producing', 'shipped', 'delivered'];

function stepIndex(key: string): number {
  return STEP_KEYS.indexOf(key);
}

export function OrderTimeline({ steps, currentStatus }: OrderTimelineProps) {
  const currentIdx = stepIndex(currentStatus);

  return (
    <div className="space-y-0">
      {steps.map((step, i) => {
        const stepIdx = stepIndex(step.key);
        const isCompleted = stepIdx < currentIdx;
        const isCurrent = stepIdx === currentIdx;
        const isPending = stepIdx > currentIdx;
        const isLast = i === steps.length - 1;

        return (
          <div key={step.key} className="flex gap-4">
            {/* Left — dot + line */}
            <div className="flex flex-col items-center" style={{ width: '28px', flexShrink: 0 }}>
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  transition: 'all 200ms ease',
                  ...(isCompleted
                    ? {
                        background: '#b8975e',
                        color: '#090907',
                        boxShadow: '0 0 0 4px rgba(184,151,94,0.14)',
                      }
                    : isCurrent
                    ? {
                        background: '#d4b47a',
                        color: '#090907',
                        boxShadow: '0 0 0 4px rgba(154,124,74,0.18)',
                      }
                    : {
                        background: 'transparent',
                        color: 'rgba(170,180,198,0.5)',
                        border: '2px solid rgba(240,236,228,0.10)',
                      }),
                }}
              >
                {isCompleted ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span style={{ fontSize: '0.65rem' }}>{stepIdx + 1}</span>
                )}
              </div>
              {!isLast && (
                <div
                  style={{
                    width: '2px',
                    flex: 1,
                    minHeight: '24px',
                    background: isCompleted
                      ? 'linear-gradient(to bottom, #b8975e, rgba(184,151,94,0.28))'
                      : 'rgba(240,236,228,0.06)',
                    margin: '4px 0',
                  }}
                />
              )}
            </div>

            {/* Right — content */}
            <div style={{ paddingBottom: isLast ? 0 : '1.25rem', paddingTop: '2px', flex: 1 }}>
              <p
                style={{
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: isCompleted
                    ? '#f0ece4'
                    : isCurrent
                    ? '#d4b47a'
                    : 'rgba(170,180,198,0.5)',
                  marginBottom: '0.2rem',
                }}
              >
                {step.label}
              </p>

              {(step.timestamp || step.actor) && (
                <p style={{ fontSize: '0.75rem', color: 'rgba(240,236,228,0.42)' }}>
                  {step.timestamp &&
                    new Date(step.timestamp).toLocaleString('pt-PT', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  {step.actor && step.timestamp && ' · '}
                  {step.actor && <span>{step.actor}</span>}
                </p>
              )}

              {step.trackingNumber && (
                <p style={{ fontSize: '0.75rem', color: '#b8975e', marginTop: '0.25rem' }}>
                  Rastreio:{' '}
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(step.trackingNumber)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}
                  >
                    {step.trackingNumber}
                  </a>
                </p>
              )}

              {isCurrent && !step.timestamp && (
                <p style={{ fontSize: '0.75rem', color: '#d4b47a', opacity: 0.7, marginTop: '0.15rem' }}>
                  Em curso...
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
