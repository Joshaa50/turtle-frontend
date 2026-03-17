import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`
      bg-white dark:bg-surface-dark 
      border border-slate-200 dark:border-border-dark 
      rounded-xl shadow-sm 
      ${onClick ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}
      ${className}
    `}
  >
    {children}
  </div>
);

export const CardHeader: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-b border-slate-100 dark:border-border-dark ${className}`}>
    {children}
  </div>
);

export const CardContent: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`px-6 py-4 ${className}`}>
    {children}
  </div>
);

export const CardFooter: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-t border-slate-100 dark:border-border-dark bg-slate-50/50 dark:bg-slate-900/20 rounded-b-xl ${className}`}>
    {children}
  </div>
);
