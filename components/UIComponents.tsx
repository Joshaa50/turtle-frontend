
import React from 'react';

interface ComponentProps {
  children?: React.ReactNode;
  className?: string;
}

export const PageTitle: React.FC<ComponentProps> = ({ children, className = '' }) => (
  <h1 className={`text-2xl font-black tracking-tight text-slate-900 dark:text-white ${className}`}>
    {children}
  </h1>
);

export const SectionHeading: React.FC<ComponentProps> = ({ children, className = '' }) => (
  <h2 className={`text-lg font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight ${className}`}>
    {children}
  </h2>
);

export const Label: React.FC<ComponentProps & { htmlFor?: string }> = ({ children, className = '', htmlFor }) => (
  <label 
    htmlFor={htmlFor}
    className={`block text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 ${className}`}
  >
    {children}
  </label>
);

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ className = '', error, icon, ...props }) => (
  <div className="w-full relative group">
    {icon && (
      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">
        {icon}
      </div>
    )}
    <input
      className={`w-full px-4 py-3 rounded-xl border transition-all text-sm outline-none font-medium
        ${error 
          ? 'border-rose-500 ring-2 ring-rose-500/10' 
          : 'border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-primary/20 focus:border-primary'
        }
        bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500
        ${icon ? 'pl-12' : ''}
        ${className}`}
      {...props}
    />
    {error && <ErrorMessage className="mt-1.5">{error}</ErrorMessage>}
  </div>
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export const Select: React.FC<SelectProps> = ({ className = '', error, children, ...props }) => (
  <div className="w-full relative">
    <select
      className={`w-full px-4 py-3 rounded-xl border transition-all text-sm outline-none font-medium appearance-none select-nice
        ${error 
          ? 'border-rose-500 ring-2 ring-rose-500/10' 
          : 'border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-primary/20 focus:border-primary'
        }
        bg-white dark:bg-slate-900 text-slate-900 dark:text-white
        ${className}`}
      {...props}
    >
      {children}
    </select>
    {error && <ErrorMessage className="mt-1.5">{error}</ErrorMessage>}
  </div>
);

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ className = '', error, ...props }) => (
  <div className="w-full">
    <textarea
      className={`w-full px-4 py-3 rounded-xl border transition-all text-sm outline-none font-medium min-h-[100px]
        ${error 
          ? 'border-rose-500 ring-2 ring-rose-500/10' 
          : 'border-slate-200 dark:border-white/10 focus:ring-2 focus:ring-primary/20 focus:border-primary'
        }
        bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500
        ${className}`}
      {...props}
    />
    {error && <ErrorMessage className="mt-1.5">{error}</ErrorMessage>}
  </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  className = '', 
  variant = 'primary', 
  size = 'md',
  children, 
  ...props 
}) => {
  const variants = {
    primary: 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary/90',
    secondary: 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10',
    destructive: 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-600',
    ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5',
    outline: 'bg-transparent border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
  };

  const sizes = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base'
  };

  return (
    <button
      className={`rounded-xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2
        ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const Card: React.FC<ComponentProps & { onClick?: () => void }> = ({ children, className = '', onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl p-5 shadow-sm 
      ${onClick ? 'cursor-pointer hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]' : ''} 
      ${className}`}
  >
    {children}
  </div>
);

export const HelperText: React.FC<ComponentProps> = ({ children, className = '' }) => (
  <p className={`text-xs text-slate-500 dark:text-slate-400 font-medium ${className}`}>
    {children}
  </p>
);

export const ErrorMessage: React.FC<ComponentProps> = ({ children, className = '' }) => (
  <p className={`text-xs text-rose-500 font-bold flex items-center gap-1 ${className}`}>
    {children}
  </p>
);

export const SuccessMessage: React.FC<ComponentProps> = ({ children, className = '' }) => (
  <p className={`text-xs text-emerald-500 font-bold flex items-center gap-1 ${className}`}>
    {children}
  </p>
);

export const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}> = ({ isOpen, onClose, title, children, footer, className = '' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className={`relative w-full max-w-2xl bg-white dark:bg-background-dark border border-slate-200 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${className}`}>
        <header className="px-8 py-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-white dark:bg-slate-900/50">
          <PageTitle className="!text-xl">{title}</PageTitle>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 transition-colors text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
        {footer && (
          <footer className="px-8 py-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 flex justify-end gap-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
};
