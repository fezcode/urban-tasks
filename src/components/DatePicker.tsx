import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
  addDays,
} from 'date-fns';

interface Props {
  value?: string;
  onChange: (date: string) => void;
  onClear?: () => void;
}

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DatePicker: React.FC<Props> = ({ value, onChange, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() =>
    value ? new Date(value + 'T00:00:00') : new Date()
  );
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const selectedDate = value ? new Date(value + 'T00:00:00') : null;

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(viewDate);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const days: Date[] = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const handleSelect = (d: Date) => {
    onChange(format(d, 'yyyy-MM-dd'));
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => {
          setViewDate(selectedDate || new Date());
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-lg text-[13px] text-text-primary hover:border-text-tertiary transition-base"
      >
        <CalendarDays size={14} className="text-text-tertiary" />
        {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Set due date'}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 z-50 w-[272px] bg-surface border border-border rounded-xl shadow-lg p-3 animate-fade-in">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => setViewDate(subMonths(viewDate, 1))}
              className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] font-semibold text-text-primary">
              {format(viewDate, 'MMMM yyyy')}
            </span>
            <button
              onClick={() => setViewDate(addMonths(viewDate, 1))}
              className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-base"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-0.5">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-text-tertiary py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const inMonth = isSameMonth(d, viewDate);
              const selected = selectedDate && isSameDay(d, selectedDate);
              const today = isToday(d);

              return (
                <button
                  key={i}
                  onClick={() => handleSelect(d)}
                  className={`
                    w-[34px] h-[34px] mx-auto rounded-lg text-[13px] transition-base flex items-center justify-center
                    ${!inMonth ? 'text-text-tertiary/30' : ''}
                    ${selected ? 'bg-accent text-text-inverse font-medium' : ''}
                    ${!selected && today ? 'bg-accent-light text-accent font-medium' : ''}
                    ${!selected && !today && inMonth ? 'text-text-primary hover:bg-surface-hover' : ''}
                    ${!selected && !today && !inMonth ? 'hover:bg-surface-hover' : ''}
                  `}
                >
                  {format(d, 'd')}
                </button>
              );
            })}
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
            <button
              onClick={() => handleSelect(new Date())}
              className="px-2.5 py-1 rounded-md text-[12px] text-accent hover:bg-accent-light transition-base font-medium"
            >
              Today
            </button>
            {selectedDate && onClear && (
              <button
                onClick={() => {
                  onClear();
                  setIsOpen(false);
                }}
                className="px-2.5 py-1 rounded-md text-[12px] text-text-tertiary hover:text-danger hover:bg-danger-bg transition-base"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
