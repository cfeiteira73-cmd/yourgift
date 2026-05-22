import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-[#8ba8c7]">{label}</label>}
      <input
        id={inputId}
        className={`w-full px-3 py-2 bg-[#07111f] border ${error ? 'border-red-500' : 'border-[#1a2f48]'} rounded-lg text-[#f0f6ff] placeholder-[#4d6a87] text-sm focus:outline-none focus:border-[#4da3ff] transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {hint && !error && <p className="text-xs text-[#4d6a87]">{hint}</p>}
    </div>
  );
}
