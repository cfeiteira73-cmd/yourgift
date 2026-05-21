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
                        background: 'rgb(99,230,190)',
                        color: 'rgb(7,17,31)',
                        boxShadow: '0 0 0 4px rgba(99,230,190,0.15)',
                      }
                    : isCurrent
                    ? {
                        background: 'rgb(77,163,255)',
                        color: 'rgb(7,17,31)',
                        boxShadow: '0 0 0 4px rgba(77,163,255,0.2)',
                      }
                    : {
                        background: 'transparent',
                        color: 'rgba(170,180,198,0.5)',
                        border: '2px solid rgba(255,255,255,0.1)',
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
                      ? 'linear-gradient(to bottom, rgb(99,230,190), rgba(99,230,190,0.3))'
                      : 'rgba(255,255,255,0.06)',
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
                    ? 'rgb(245,247,251)'
                    : isCurrent
                    ? 'rgb(77,163,255)'
                    : 'rgba(170,180,198,0.5)',
                  marginBottom: '0.2rem',
                }}
              >
                {step.label}
              </p>

              {(step.timestamp || step.actor) && (
                <p style={{ fontSize: '0.75rem', color: 'rgb(120,130,150)' }}>
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
                <p style={{ fontSize: '0.75rem', color: 'rgb(116,231,255)', marginTop: '0.25rem' }}>
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
                <p style={{ fontSize: '0.75rem', color: 'rgb(77,163,255)', opacity: 0.7, marginTop: '0.15rem' }}>
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
