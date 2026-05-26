import React from 'react';

interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  children: React.ReactNode;
  className?: string;
}

const variants: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-[#1a2f48] text-[#8ba8c7]',
  success: 'bg-green-900/40 text-green-400 border border-green-800',
  warning: 'bg-yellow-900/40 text-yellow-400 border border-yellow-800',
  danger: 'bg-red-900/40 text-red-400 border border-red-800',
  info: 'bg-blue-900/40 text-blue-400 border border-blue-800',
  purple: 'bg-purple-900/40 text-purple-400 border border-purple-800',
};

export function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
