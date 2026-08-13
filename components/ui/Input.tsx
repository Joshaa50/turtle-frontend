import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  error?: string;
  helperText?: string;
  required?: boolean;
  suffix?: React.ReactNode;
  icon?: React.ReactNode;
  containerClassName?: string;
  noMargin?: boolean;
  /**
   * Renders a read-only display of an already-decided value instead of an
   * `<input>`. Used for locked fields - notably dates, where iOS Safari and
   * Android Chrome give `input[type="date"]` an intrinsic min-width from the
   * native picker that `w-full` can't shrink, overflowing its container.
   */
  lockedValue?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  label,
  error,
  helperText,
  required,
  suffix,
  icon,
  className = '',
  containerClassName = 'w-full',
  noMargin = false,
  lockedValue,
  id,
  ...props
}, ref) => {
  const inputId = id || (typeof label === 'string' ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={`${noMargin ? '' : 'mb-4'} ${containerClassName}`}>
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {lockedValue !== undefined ? (
        <div
          id={inputId}
          className={`
            flex items-center gap-2 w-full min-w-0 px-3 py-2 text-sm rounded-lg border
            bg-slate-50 dark:bg-slate-900
            text-slate-900 dark:text-slate-100
            border-slate-200 dark:border-border-dark
            ${className}
          `}
        >
          {icon && <span className="text-slate-400 shrink-0">{icon}</span>}
          <span className="truncate">{lockedValue}</span>
        </div>
      ) : (
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            {icon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full min-w-0 max-w-full px-3 py-2 text-sm rounded-lg border transition-all duration-200
            bg-white dark:bg-surface-dark
            text-slate-900 dark:text-slate-100
            placeholder:text-slate-400 dark:placeholder:text-slate-500
            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
            ${error 
              ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
              : 'border-slate-200 dark:border-border-dark hover:border-slate-300 dark:hover:border-slate-600'
            }
            disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900
            ${suffix ? 'pr-12' : ''}
            ${icon ? 'pl-10' : ''}
            ${className}
          `}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {suffix}
          </div>
        )}
      </div>
      )}
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
