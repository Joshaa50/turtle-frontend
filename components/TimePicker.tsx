import React, { useState, useRef, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  theme?: 'light' | 'dark';
}

export const TimePicker: React.FC<TimePickerProps> = ({ value, onChange, theme = 'light' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);

  // Parse value or default to current time
  const [hours, minutes] = (value || '00:00').split(':').map(Number);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll to selected time when opening
  useEffect(() => {
    if (isOpen) {
      if (hoursRef.current) {
        const selectedHour = hoursRef.current.children[hours + 1] as HTMLElement; // +1 for label
        if (selectedHour) {
            selectedHour.scrollIntoView({ block: 'center' });
        }
      }
      if (minutesRef.current) {
        const selectedMinute = minutesRef.current.children[minutes + 1] as HTMLElement; // +1 for label
        if (selectedMinute) {
            selectedMinute.scrollIntoView({ block: 'center' });
        }
      }
    }
  }, [isOpen]);

  const handleTimeChange = (newHours: number, newMinutes: number) => {
    const h = String(newHours).padStart(2, '0');
    const m = String(newMinutes).padStart(2, '0');
    onChange(`${h}:${m}`);
  };

  const hoursList = Array.from({ length: 24 }, (_, i) => i);
  const minutesList = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-bold border rounded-lg transition-all outline-none focus:ring-2 focus:ring-primary/50 ${
          theme === 'dark' 
            ? 'bg-transparent border-border-dark text-white hover:bg-white/5' 
            : 'bg-transparent border-slate-200 text-slate-900 hover:bg-slate-50'
        }`}
      >
        <span>{value || '--:--'}</span>
        <Clock className="w-4 h-4 opacity-50" />
      </button>

      {isOpen && (
        <div className={`absolute right-0 z-50 mt-2 p-2 rounded-xl shadow-xl border flex gap-2 w-48 h-64 overflow-hidden ${
          theme === 'dark' 
            ? 'bg-surface-dark border-border-dark shadow-black/50' 
            : 'bg-white border-slate-200 shadow-slate-200/50'
        }`}>
          {/* Hours Column */}
          <div className="flex-1 overflow-y-auto no-scrollbar" ref={hoursRef}>
            <div className={`text-[10px] font-black uppercase tracking-widest text-center mb-2 sticky top-0 py-1 z-10 backdrop-blur-sm ${
                theme === 'dark' ? 'text-slate-500 bg-surface-dark/90' : 'text-slate-400 bg-white/90'
            }`}>Hr</div>
            <div className="space-y-1 pb-20">
              {hoursList.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleTimeChange(h, minutes)}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    h === hours
                      ? 'bg-primary text-white'
                      : theme === 'dark' 
                        ? 'text-slate-400 hover:bg-white/5 hover:text-white' 
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {String(h).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>

          {/* Separator */}
          <div className={`w-px my-2 ${theme === 'dark' ? 'bg-white/10' : 'bg-slate-100'}`} />

          {/* Minutes Column */}
          <div className="flex-1 overflow-y-auto no-scrollbar" ref={minutesRef}>
            <div className={`text-[10px] font-black uppercase tracking-widest text-center mb-2 sticky top-0 py-1 z-10 backdrop-blur-sm ${
                theme === 'dark' ? 'text-slate-500 bg-surface-dark/90' : 'text-slate-400 bg-white/90'
            }`}>Min</div>
            <div className="space-y-1 pb-20">
              {minutesList.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleTimeChange(hours, m)}
                  className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    m === minutes
                      ? 'bg-primary text-white'
                      : theme === 'dark' 
                        ? 'text-slate-400 hover:bg-white/5 hover:text-white' 
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {String(m).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};
