
import React from 'react';
import { Input } from './Input';

interface MetricInputProps {
  label: React.ReactNode;
  unit: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  onChange: (val: string) => void;
  isInteger?: boolean;
  step?: number;
  decimalPlaces?: number;
  theme?: 'light' | 'dark';
  className?: string;
  id?: string;
  error?: string;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
}

export const MetricInput: React.FC<MetricInputProps> = ({ 
  label, 
  unit, 
  placeholder = "0.0", 
  required = false, 
  value, 
  onChange, 
  isInteger = false, 
  step: customStep, 
  decimalPlaces, 
  theme = 'light',
  className,
  id,
  error,
  onBlur
}) => {
  const decimals = isInteger ? 0 : (decimalPlaces !== undefined ? decimalPlaces : 2);
  
  return (
    <Input
      id={id}
      label={label}
      required={required}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '' || /^-?\d*\.?\d*$/.test(val)) {
          onChange(val);
        }
      }}
      placeholder={isInteger ? "0" : placeholder}
      suffix={<span className="text-[10px] font-mono font-bold uppercase text-slate-400">{unit}</span>}
      error={error}
      onBlur={(e) => {
        if (e.target.value !== '') {
          const num = parseFloat(e.target.value);
          if (!isNaN(num)) {
            onChange(num.toFixed(decimals));
          }
        }
        if (onBlur) onBlur(e);
      }}
      className={className}
    />
  );
};
