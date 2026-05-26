'use client';
import React, { useEffect } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function Modal({ open, onClose, title, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative bg-[#0b1526] border border-[#1a2f48] rounded-2xl w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto shadow-2xl`}>
        <div className="flex items-center justify-between p-6 border-b border-[#1a2f48]">
          <h2 className="text-lg font-semibold text-[#f0f6ff]">{title}</h2>
          <button onClick={onClose} className="text-[#4d6a87] hover:text-[#f0f6ff] transition-colors text-xl leading-none">✕</button>
        </div>
        <div className="p-6">{children}</div>
        {footer && <div className="p-6 pt-0 flex gap-3 justify-end">{footer}</div>}
      </div>
    </div>
  );
}
