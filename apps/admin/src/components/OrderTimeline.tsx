'use client';

import { formatDateTime } from '@/lib/utils';

export interface TimelineEvent {
  status: string;
  label: string;
  timestamp?: string | null;
  actor?: string | null;
  notes?: string | null;
  icon: string;
  color: string;
}

interface OrderTimelineProps {
  events: TimelineEvent[];
}

export default function OrderTimeline({ events }: OrderTimelineProps) {
  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-[#1a2f48]" />

      <div className="space-y-0">
        {events.map((event, idx) => {
          const isComplete = !!event.timestamp;
          const isLast = idx === events.length - 1;

          return (
            <div key={event.status} className="relative flex gap-4 pb-6">
              {/* Dot */}
              <div
                className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm transition-all ${
                  isComplete
                    ? 'border-[#4da3ff] bg-[#0d1f3a]'
                    : 'border-[#1a2f48] bg-[#0b1526]'
                }`}
                style={isComplete ? { borderColor: event.color } : undefined}
              >
                <span
                  className={isComplete ? 'opacity-100' : 'opacity-30'}
                  style={isComplete ? { filter: `drop-shadow(0 0 4px ${event.color})` } : undefined}
                >
                  {event.icon}
                </span>
              </div>

              {/* Content */}
              <div className={`flex-1 pt-0.5 ${isLast ? '' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-sm font-semibold ${
                      isComplete ? 'text-white' : 'text-[#4d6a87]'
                    }`}
                  >
                    {event.label}
                  </span>
                  {event.timestamp && (
                    <span className="text-xs text-[#4d6a87] font-mono">
                      {formatDateTime(event.timestamp)}
                    </span>
                  )}
                </div>

                {event.actor && (
                  <p className="text-xs text-[#8ba8c7] mt-0.5">
                    por{' '}
                    <span className="font-medium text-[#4da3ff]">{event.actor}</span>
                  </p>
                )}

                {event.notes && (
                  <p className="text-xs text-[#8ba8c7] mt-1 bg-[#102131] rounded-lg px-3 py-2 border border-[#1a2f48]">
                    {event.notes}
                  </p>
                )}

                {!isComplete && (
                  <p className="text-xs text-[#4d6a87] mt-0.5 italic">Aguardando...</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
