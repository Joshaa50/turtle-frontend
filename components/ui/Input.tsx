import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ 
  label, 
  error, 
  helperText, 
  required, 
  className = '', 
  id,
  ...props 
}, ref) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full mb-4">
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`
          w-full px-3 py-2 text-sm rounded-lg border transition-all duration-200
          bg-white dark:bg-surface-dark
          text-slate-900 dark:text-slate-100
          placeholder:text-slate-400 dark:placeholder:text-slate-500
          focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
          ${error 
            ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
            : 'border-slate-200 dark:border-border-dark hover:border-slate-300 dark:hover:border-slate-600'
          }
          disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{helperText}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
