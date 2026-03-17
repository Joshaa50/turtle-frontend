import React from 'react';

interface TypographyProps {
  children: React.ReactNode;
  className?: string;
}

export const PageTitle: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <h1 className={`text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-6 ${className}`}>
    {children}
  </h1>
);

export const SectionHeading: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <h2 className={`text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4 ${className}`}>
    {children}
  </h2>
);

export const BodyText: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <p className={`text-sm text-slate-600 dark:text-slate-400 ${className}`}>
    {children}
  </p>
);

export const HelperText: React.FC<TypographyProps> = ({ children, className = '' }) => (
  <span className={`text-xs text-slate-500 dark:text-slate-500 ${className}`}>
    {children}
  </span>
);

export const Label: React.FC<TypographyProps & { htmlFor?: string; required?: boolean }> = ({ 
  children, 
  className = '', 
  htmlFor,
  required 
}) => (
  <label 
    htmlFor={htmlFor}
    className={`block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 ${className}`}
  >
    {children}
    {required && <span className="text-red-500 ml-1">*</span>}
  </label>
);
