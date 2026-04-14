import React, { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { useAppState } from '../context/AppState';
import { PRIORITY_META } from './TaskItem';

interface Props {
  onMenuClick: () => void;
  onSelectTask: (id: string) => void;
}

const Calendar: React.FC<Props> = ({ onMenuClick, onSelectTask }) => {
  const { state } = useAppState();
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const out: Date[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, typeof state.tasks>();
    for (const t of state.tasks) {
      if (!t.dueDate) continue;
      const key = format(new Date(t.dueDate), 'yyyy-MM-dd');
      const arr = map.get(key) ?? [];
      arr.push(t);
      map.set(key, arr);
    }
    return map;
  }, [state.tasks]);

  const selectedTasks = selectedDay
    ? tasksByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? []
    : [];

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-1.5 rounded-md text-text-tertiary hover:bg-surface-hover"
            aria-label="Menu"
          >
            <Menu size={18} />
          </button>
          <h1 className="text-[17px] font-semibold text-text-primary">
            {format(cursor, 'MMMM yyyy')}
          </h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCursor(addMonths(cursor, -1))}
            className="p-1.5 rounded-md text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition-base"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setCursor(startOfMonth(new Date()))}
            className="px-2.5 py-1 text-[12px] font-medium rounded-md text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-base"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(addMonths(cursor, 1))}
            className="p-1.5 rounded-md text-text-tertiary hover:bg-surface-hover hover:text-text-primary transition-base"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] min-h-0">
        <div className="flex flex-col min-h-0 p-4 sm:p-6 overflow-hidden">
          <div className="grid grid-cols-7 gap-px mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div
                key={d}
                className="text-2xs font-medium text-text-tertiary uppercase tracking-wider text-center py-1"
              >
                {d}
              </div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 grid-rows-6 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const items = tasksByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, cursor);
              const selected = selectedDay && isSameDay(day, selectedDay);
              const today = isToday(day);
              return (
                <button
                  key={key}
                  onClick={() => setSelectedDay(day)}
                  className={`bg-bg relative text-left p-1.5 transition-base overflow-hidden ${
                    inMonth ? '' : 'opacity-40'
                  } ${selected ? 'ring-2 ring-accent ring-inset' : 'hover:bg-surface-hover'}`}
                >
                  <div
                    className={`text-2xs font-semibold mb-1 ${
                      today
                        ? 'w-5 h-5 inline-flex items-center justify-center rounded-full bg-accent text-text-inverse'
                        : 'text-text-secondary'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {items.slice(0, 3).map((t) => {
                      const meta = PRIORITY_META[t.priority ?? 'none'];
                      return (
                        <div
                          key={t.id}
                          className={`text-[10px] truncate px-1 py-0.5 rounded ${
                            t.status === 'done'
                              ? 'line-through text-text-tertiary bg-surface'
                              : meta
                              ? `${meta.className} bg-surface`
                              : 'text-text-secondary bg-surface'
                          }`}
                        >
                          {t.title}
                        </div>
                      );
                    })}
                    {items.length > 3 && (
                      <div className="text-[10px] text-text-tertiary px-1">
                        +{items.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="hidden lg:flex flex-col border-l border-border min-h-0">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-[14px] font-semibold text-text-primary">
              {selectedDay ? format(selectedDay, 'EEEE, MMM d') : 'Select a day'}
            </h2>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              {selectedDay
                ? `${selectedTasks.length} task${selectedTasks.length === 1 ? '' : 's'}`
                : 'Click a date to see tasks'}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {selectedTasks.length === 0 ? (
              <p className="text-[12px] text-text-tertiary text-center py-8">
                {selectedDay ? 'No tasks due on this day.' : ''}
              </p>
            ) : (
              <div className="space-y-1">
                {selectedTasks.map((t) => {
                  const project = state.projects.find((p) => p.id === t.projectId);
                  return (
                    <button
                      key={t.id}
                      onClick={() => onSelectTask(t.id)}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-surface-hover transition-base border border-transparent hover:border-border"
                    >
                      <p
                        className={`text-[13px] ${
                          t.status === 'done'
                            ? 'line-through text-text-tertiary'
                            : 'text-text-primary'
                        }`}
                      >
                        {t.title}
                      </p>
                      {project && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <span
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="text-2xs text-text-tertiary">{project.name}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Calendar;
