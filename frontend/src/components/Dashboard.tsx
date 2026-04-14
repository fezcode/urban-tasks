import React from 'react';
import { useAppState } from '../context/AppState';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { format, subDays, isSameDay, isAfter, startOfDay, differenceInDays, addDays } from 'date-fns';
import {
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Zap,
  BarChart3,
  Target,
  AlertTriangle,
  Flame,
  CalendarClock,
  Flag,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ProjectIcon from './ProjectIcon';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-raised border border-border rounded-lg px-3 py-2 shadow-md text-[12px]">
      <p className="text-text-tertiary mb-0.5">{String(label)}</p>
      {payload.map((p: { value?: number; name?: string }, i: number) => (
        <p key={i} className="text-text-primary font-medium">
          {p.value}{' '}
          {p.name === 'remaining' ? 'remaining' : p.name === 'completed' ? 'completed' : 'tasks'}
        </p>
      ))}
    </div>
  );
};

const Dashboard: React.FC = () => {
  const { state } = useAppState();
  const { theme } = useTheme();

  const isDark = theme === 'dark';
  const gridColor = isDark ? '#333' : '#E8E4DD';
  const tickColor = isDark ? '#6E6A64' : '#9C958D';
  const accentColor = isDark ? '#D2785A' : '#C96442';
  const activeColor = isDark ? '#6EA88C' : '#5B8A72';

  const tasks = state.activeProjectId
    ? state.tasks.filter((t) => t.projectId === state.activeProjectId)
    : state.tasks;

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const active = tasks.filter((t) => t.status === 'in-progress').length;
  const todo = tasks.filter((t) => t.status === 'todo').length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  // --- Burndown data (last 14 days) ---
  const days = 14;
  const burndownData = Array.from({ length: days }, (_, i) => {
    const date = subDays(new Date(), days - 1 - i);
    const dayStart = startOfDay(date);

    // Tasks that existed by this day
    const existedByDay = tasks.filter((t) => !isAfter(startOfDay(new Date(t.createdAt)), dayStart));

    // Of those, how many were completed by this day
    const completedByDay = existedByDay.filter(
      (t) =>
        t.status === 'done' &&
        t.completedAt &&
        !isAfter(startOfDay(new Date(t.completedAt)), dayStart)
    ).length;

    return {
      name: format(date, 'MMM d'),
      remaining: existedByDay.length - completedByDay,
      completed: completedByDay,
    };
  });

  // --- Overdue count ---
  const today = startOfDay(new Date());
  const overdueCount = tasks.filter(
    (t) =>
      t.status !== 'done' &&
      t.dueDate &&
      differenceInDays(startOfDay(new Date(t.dueDate)), today) < 0
  ).length;

  // --- Streak: consecutive days up to today with ≥1 completion ---
  const completionDates = new Set(
    tasks
      .filter((t) => t.status === 'done' && t.completedAt)
      .map((t) => format(startOfDay(new Date(t.completedAt!)), 'yyyy-MM-dd'))
  );
  let streak = 0;
  for (let i = 0; ; i++) {
    const key = format(subDays(today, i), 'yyyy-MM-dd');
    if (completionDates.has(key)) streak++;
    else break;
  }

  // --- Velocity trend: completions this week vs last week ---
  const completedLast7 = tasks.filter(
    (t) =>
      t.status === 'done' &&
      t.completedAt &&
      !isAfter(startOfDay(new Date(t.completedAt)), today) &&
      differenceInDays(today, startOfDay(new Date(t.completedAt))) < 7
  ).length;
  const completedPrior7 = tasks.filter((t) => {
    if (t.status !== 'done' || !t.completedAt) return false;
    const diff = differenceInDays(today, startOfDay(new Date(t.completedAt)));
    return diff >= 7 && diff < 14;
  }).length;
  const velocityDelta =
    completedPrior7 === 0
      ? completedLast7 > 0
        ? 100
        : 0
      : Math.round(((completedLast7 - completedPrior7) / completedPrior7) * 100);

  // --- Upcoming due (next 7 days) ---
  const upcomingDue = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const count = tasks.filter(
      (t) =>
        t.status !== 'done' &&
        t.dueDate &&
        isSameDay(startOfDay(new Date(t.dueDate)), date)
    ).length;
    return { name: i === 0 ? 'Today' : format(date, 'EEE'), count };
  });

  // --- Priority distribution ---
  const priorityDist = (['high', 'medium', 'low', 'none'] as const).map((p) => ({
    priority: p,
    count: tasks.filter((t) => t.status !== 'done' && (t.priority ?? 'none') === p).length,
  }));
  const priorityColor: Record<string, string> = {
    high: isDark ? '#E07A6C' : '#C94E3E',
    medium: isDark ? '#D7A84D' : '#C98D28',
    low: accentColor,
    none: isDark ? '#555' : '#D5CFC7',
  };
  const priorityTotal = priorityDist.reduce((s, p) => s + p.count, 0);

  // --- Daily completions (last 7 days) ---
  const dailyCompletions = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    const count = tasks.filter(
      (t) => t.status === 'done' && t.completedAt && isSameDay(new Date(t.completedAt), date)
    ).length;
    return {
      name: format(date, 'EEE'),
      count,
    };
  });

  // --- Status distribution ---
  const pieData = [
    { name: 'To Do', value: todo, color: isDark ? '#555' : '#D5CFC7' },
    { name: 'Active', value: active, color: accentColor },
    { name: 'Done', value: done, color: activeColor },
  ].filter((d) => d.value > 0);

  // --- Per-project breakdown ---
  const projectBreakdown = state.projects.map((p) => {
    const pTasks = state.tasks.filter((t) => t.projectId === p.id);
    const pDone = pTasks.filter((t) => t.status === 'done').length;
    return {
      ...p,
      total: pTasks.length,
      done: pDone,
      rate: pTasks.length > 0 ? Math.round((pDone / pTasks.length) * 100) : 0,
    };
  });

  return (
    <div className="space-y-8 pb-12 animate-fade-in">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total Tasks', value: total, icon: BarChart3, accent: false, danger: false, hint: null as string | null },
          { label: 'Completed', value: done, icon: CheckCircle2, accent: false, danger: false, hint: null },
          { label: 'In Progress', value: active, icon: Zap, accent: true, danger: false, hint: null },
          { label: 'Completion', value: `${completionRate}%`, icon: Target, accent: false, danger: false, hint: null },
          { label: 'Overdue', value: overdueCount, icon: AlertTriangle, accent: false, danger: overdueCount > 0, hint: null },
          { label: 'Streak', value: `${streak}d`, icon: Flame, accent: false, danger: false, hint: streak > 0 ? 'Keep it going' : 'Complete a task today' },
        ].map((stat, i) => (
          <div
            key={i}
            className="bg-surface border border-border rounded-2xl p-5 transition-base hover:shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                {stat.label}
              </span>
              <stat.icon
                size={16}
                className={
                  stat.accent
                    ? 'text-accent'
                    : stat.danger
                      ? 'text-danger'
                      : 'text-text-tertiary'
                }
              />
            </div>
            <div className="text-2xl font-semibold text-text-primary tracking-tight">
              {stat.value}
            </div>
            {stat.hint && <div className="mt-1 text-2xs text-text-tertiary">{stat.hint}</div>}
          </div>
        ))}
      </div>

      {/* Trend strip */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
              This week
            </span>
            {velocityDelta >= 0 ? (
              <TrendingUp size={16} className="text-status-active" />
            ) : (
              <TrendingDown size={16} className="text-danger" />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold text-text-primary">{completedLast7}</span>
            <span className="text-[12px] text-text-tertiary">completed</span>
          </div>
          <div
            className={`mt-1 text-2xs font-medium ${
              velocityDelta >= 0 ? 'text-status-active' : 'text-danger'
            }`}
          >
            {velocityDelta >= 0 ? '+' : ''}
            {velocityDelta}% vs. prior 7 days ({completedPrior7})
          </div>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock size={16} className="text-accent" />
              <h3 className="text-[14px] font-semibold text-text-primary">Upcoming</h3>
            </div>
            <span className="text-2xs text-text-tertiary">Next 7 days</span>
          </div>
          <div className="flex items-end gap-2 h-24">
            {upcomingDue.map((d) => {
              const max = Math.max(...upcomingDue.map((x) => x.count), 1);
              const h = (d.count / max) * 100;
              return (
                <div key={d.name} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className="w-full rounded-t-md transition-all duration-500"
                      style={{
                        height: `${Math.max(h, d.count > 0 ? 10 : 2)}%`,
                        backgroundColor: d.count > 0 ? accentColor : gridColor,
                      }}
                    />
                  </div>
                  <span className="text-2xs text-text-tertiary">{d.name}</span>
                  <span className="text-2xs text-text-primary tabular-nums font-medium">
                    {d.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Burndown chart */}
        <div className="lg:col-span-8 bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingDown size={16} className="text-accent" />
              <h3 className="text-[14px] font-semibold text-text-primary">Burndown</h3>
            </div>
            <span className="text-2xs text-text-tertiary">Last 14 days</span>
          </div>
          <div className="h-56">
            {total === 0 ? (
              <div className="h-full flex items-center justify-center text-[13px] text-text-tertiary">
                Add tasks to see your burndown chart
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={burndownData}>
                  <defs>
                    <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={accentColor} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: tickColor, fontSize: 11 }}
                    dy={8}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: tickColor, fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip content={ChartTooltip} />
                  <Area
                    type="monotone"
                    dataKey="remaining"
                    stroke={accentColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#burnGrad)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0, fill: accentColor }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status distribution */}
        <div className="lg:col-span-4 bg-surface border border-border rounded-2xl p-6 flex flex-col">
          <h3 className="text-[14px] font-semibold text-text-primary mb-6">Status</h3>
          {total === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-text-tertiary">
              No tasks yet
            </div>
          ) : (
            <>
              <div className="flex-1 flex items-center justify-center">
                <div className="w-40 h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        innerRadius={48}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-2.5 mt-4">
                {pieData.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-[13px]">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-text-secondary">{entry.name}</span>
                    </div>
                    <span className="text-text-primary font-medium tabular-nums">
                      {entry.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Daily velocity */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-status-active" />
            <h3 className="text-[14px] font-semibold text-text-primary">Daily Velocity</h3>
          </div>
          <span className="text-2xs text-text-tertiary">Last 7 days</span>
        </div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyCompletions}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickColor, fontSize: 11 }}
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: tickColor, fontSize: 11 }}
                allowDecimals={false}
              />
              <Tooltip content={ChartTooltip} />
              <Bar
                dataKey="count"
                name="completed"
                fill={activeColor}
                radius={[4, 4, 0, 0]}
                barSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Priority distribution (open tasks) */}
      {priorityTotal > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Flag size={16} className="text-accent" />
              <h3 className="text-[14px] font-semibold text-text-primary">Priority mix</h3>
            </div>
            <span className="text-2xs text-text-tertiary">Open tasks only</span>
          </div>
          <div className="space-y-3">
            {priorityDist.map((p) => {
              const pct = priorityTotal > 0 ? (p.count / priorityTotal) * 100 : 0;
              return (
                <div key={p.priority} className="flex items-center gap-3">
                  <span className="w-14 text-[12px] capitalize text-text-secondary">
                    {p.priority}
                  </span>
                  <div className="flex-1 h-2 bg-bg-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: priorityColor[p.priority],
                      }}
                    />
                  </div>
                  <span className="text-2xs text-text-tertiary tabular-nums w-10 text-right">
                    {p.count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-project breakdown (only when viewing all) */}
      {!state.activeProjectId && state.projects.length > 1 && (
        <div className="bg-surface border border-border rounded-2xl p-6">
          <h3 className="text-[14px] font-semibold text-text-primary mb-5">Projects</h3>
          <div className="space-y-3">
            {projectBreakdown.map((p) => (
              <div key={p.id} className="flex items-center gap-3">
                <ProjectIcon projectId={p.id} color={p.color} size={24} />
                <span className="text-[13px] text-text-primary font-medium flex-1 truncate">
                  {p.name}
                </span>
                <div className="w-32 h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${p.rate}%`,
                      backgroundColor: p.color,
                    }}
                  />
                </div>
                <span className="text-2xs text-text-tertiary tabular-nums w-12 text-right">
                  {p.done}/{p.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
