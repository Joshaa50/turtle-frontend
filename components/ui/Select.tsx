import React from 'react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  options: { value: string | number; label: string }[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ 
  label, 
  error, 
  helperText, 
  required, 
  options,
  className = '', 
  id,
  ...props 
}, ref) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full mb-4">
      {label && (
        <label 
          htmlFor={selectId}
          className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={`
            w-full px-3 py-2 text-sm rounded-lg border transition-all duration-200
            bg-white dark:bg-surface-dark
            text-slate-900 dark:text-slate-100
            appearance-none bg-no-repeat
            focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
            ${error 
              ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
              : 'border-slate-200 dark:border-border-dark hover:border-slate-300 dark:hover:border-slate-600'
            }
            disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-slate-900
            ${className}
          `}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
            backgroundPosition: 'right 0.75rem center',
            backgroundSize: '1rem'
          }}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{helperText}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';
