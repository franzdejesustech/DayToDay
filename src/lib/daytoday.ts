export type Priority = "none" | "low" | "medium" | "high";
export type CalendarMode = "day" | "week" | "month" | "agenda";
export type Frequency = "daily" | "weekly" | "custom";
export type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";
export type CountdownCategory = "birthday" | "anniversary" | "holiday" | "event" | "other";

export type Folder = {
  id: number;
  user_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
};

export type TaskList = {
  id: number;
  user_id: string;
  folder_id: number | null;
  name: string;
  color: string;
  position: number;
  created_at: string;
};

export type TaskStatus = {
  id: number;
  user_id: string;
  name: string;
  color: string;
  position: number;
  is_done: boolean;
  created_at: string;
};

export type Task = {
  id: number;
  user_id: string;
  list_id: number | null;
  status_id: number | null;
  title: string;
  notes: string;
  start_at: string | null;
  due_at: string | null;
  priority: Priority;
  tags: string[];
  recurrence_rule: { frequency: RecurrenceFrequency; interval?: number; custom?: string } | null;
  is_important: boolean;
  is_urgent: boolean;
  estimated_minutes: number | null;
  position: number;
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Subtask = {
  id: number;
  user_id: string;
  task_id: number;
  title: string;
  is_completed: boolean;
  position: number;
  created_at: string;
};

export type Reminder = {
  id: number;
  user_id: string;
  task_id: number;
  remind_at: string;
  persistent: boolean;
  last_notified_at: string | null;
  acknowledged_at: string | null;
  created_at: string;
};

export type Note = {
  id: number;
  user_id: string;
  task_id: number | null;
  title: string;
  body: string;
  checklist: unknown[];
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

export type Habit = {
  id: number;
  user_id: string;
  name: string;
  frequency_type: Frequency;
  target_count: number;
  weekdays: number[];
  color: string;
  position: number;
  archived_at: string | null;
  created_at: string;
};

export type HabitCheckin = {
  id: number;
  user_id: string;
  habit_id: number;
  checkin_date: string;
  count: number;
  created_at: string;
  updated_at: string;
};

export type FocusSession = {
  id: number;
  user_id: string;
  task_id: number | null;
  session_type: "work" | "short_break" | "long_break";
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  is_completed: boolean;
  created_at: string;
};

export type DailyReflection = {
  id: number;
  user_id: string;
  reflection_date: string;
  mood: number | null;
  journal: string;
  best_thing: string;
  created_at: string;
  updated_at: string;
};

export type Countdown = {
  id: number;
  user_id: string;
  title: string;
  target_date: string;
  repeats_yearly: boolean;
  category: CountdownCategory;
  color: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type UserPreferences = {
  user_id: string;
  work_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  timezone: string;
  week_starts_on: number;
  updated_at: string;
};

export type TaskDraft = {
  title: string;
  notes: string;
  listId: number | null;
  statusId: number | null;
  startAt: string;
  dueAt: string;
  priority: Priority;
  tags: string[];
  recurrence: RecurrenceFrequency;
  customRecurrence: string;
  important: boolean;
  urgent: boolean;
  estimate: number | null;
  subtasks: string[];
  reminderOffsets: number[];
  persistentReminder: boolean;
};

export type ParsedQuickTask = {
  title: string;
  dueAt: string | null;
  priority: Priority;
  tags: string[];
  recurrence: RecurrenceFrequency;
};

export const COLORS = ["#2f7f73", "#d17d45", "#7b68b5", "#4776a8", "#b15f73", "#718052"];

export function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function fromDateTimeInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function startOfDay(date = new Date()) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

export function startOfWeek(date: Date, startsOn = 1) {
  const result = startOfDay(date);
  const difference = (result.getDay() - startsOn + 7) % 7;
  result.setDate(result.getDate() - difference);
  return result;
}

export function isSameDay(first: Date, second: Date) {
  return localDateKey(first) === localDateKey(second);
}

function dateOnlyParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function clampedCalendarDate(year: number, month: number, day: number) {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay), 12, 0, 0, 0);
}

export function getNextCountdownDate(countdown: Countdown, now = new Date()) {
  const { year, month, day } = dateOnlyParts(countdown.target_date);
  if (!countdown.repeats_yearly) return clampedCalendarDate(year, month, day);

  const today = startOfDay(now);
  let next = clampedCalendarDate(today.getFullYear(), month, day);
  if (startOfDay(next).getTime() < today.getTime()) {
    next = clampedCalendarDate(today.getFullYear() + 1, month, day);
  }
  return next;
}

export function getCountdownDays(countdown: Countdown, now = new Date()) {
  const target = getNextCountdownDate(countdown, now);
  const fromUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const targetUtc = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetUtc - fromUtc) / 86_400_000);
}

export function formatDue(value: string | null, includeDate = true) {
  if (!value) return "No date";
  const date = new Date(value);
  const today = startOfDay();
  const day = startOfDay(date);
  const difference = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  const label = difference === 0 ? "Today" : difference === 1 ? "Tomorrow" : difference === -1 ? "Yesterday" : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return includeDate ? `${label}, ${time}` : time;
}

export function isOverdue(task: Task) {
  return Boolean(task.due_at && !task.completed_at && new Date(task.due_at).getTime() < Date.now());
}

export function nextOccurrence(task: Task) {
  if (!task.recurrence_rule || task.recurrence_rule.frequency === "none") return null;
  const result = task.due_at ? new Date(task.due_at) : new Date();
  const interval = Math.max(1, task.recurrence_rule.interval ?? 1);
  if (task.recurrence_rule.frequency === "daily") result.setDate(result.getDate() + interval);
  if (task.recurrence_rule.frequency === "weekly") result.setDate(result.getDate() + interval * 7);
  if (task.recurrence_rule.frequency === "monthly") result.setMonth(result.getMonth() + interval);
  if (task.recurrence_rule.frequency === "yearly") result.setFullYear(result.getFullYear() + interval);
  if (task.recurrence_rule.frequency === "custom") {
    const custom = task.recurrence_rule.custom?.match(/every\s+(\d+)\s+(day|week|month|year)s?/i);
    if (!custom) return null;
    const customInterval = Math.max(1, Number(custom[1]));
    if (custom[2].toLowerCase() === "day") result.setDate(result.getDate() + customInterval);
    if (custom[2].toLowerCase() === "week") result.setDate(result.getDate() + customInterval * 7);
    if (custom[2].toLowerCase() === "month") result.setMonth(result.getMonth() + customInterval);
    if (custom[2].toLowerCase() === "year") result.setFullYear(result.getFullYear() + customInterval);
  }
  return result.toISOString();
}

export function getMonthDays(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first, 1);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
}

export function getHabitStreak(habitId: number, checkins: HabitCheckin[]) {
  const completed = new Set(
    checkins.filter((item) => item.habit_id === habitId && item.count > 0).map((item) => item.checkin_date),
  );
  let streak = 0;
  let cursor = startOfDay();
  if (!completed.has(localDateKey(cursor))) cursor = addDays(cursor, -1);
  while (completed.has(localDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function nextWeekday(day: number, base: Date) {
  const result = new Date(base);
  let distance = (day - result.getDay() + 7) % 7;
  if (distance === 0) distance = 7;
  result.setDate(result.getDate() + distance);
  return result;
}

export function parseQuickTask(input: string): ParsedQuickTask {
  let working = input.trim();
  const now = new Date();
  const tags = Array.from(working.matchAll(/(?:^|\s)#([\w-]+)/g)).map((match) => match[1].toLowerCase());
  working = working.replace(/(?:^|\s)#[\w-]+/g, " ");

  let priority: Priority = "none";
  const priorityMatch = working.match(/(?:^|\s)(?:!|p)(high|medium|low|1|2|3)(?=\s|$)/i);
  if (priorityMatch) {
    const token = priorityMatch[1].toLowerCase();
    priority = token === "high" || token === "1" ? "high" : token === "medium" || token === "2" ? "medium" : "low";
    working = working.replace(priorityMatch[0], " ");
  }

  let recurrence: RecurrenceFrequency = "none";
  const recurrencePatterns: Array<[RegExp, RecurrenceFrequency]> = [
    [/\bevery\s+day\b|\bdaily\b/i, "daily"],
    [/\bevery\s+week\b|\bweekly\b/i, "weekly"],
    [/\bevery\s+month\b|\bmonthly\b/i, "monthly"],
    [/\bevery\s+year\b|\byearly\b|\bannually\b/i, "yearly"],
  ];
  for (const [pattern, frequency] of recurrencePatterns) {
    if (pattern.test(working)) {
      recurrence = frequency;
      working = working.replace(pattern, " ");
      break;
    }
  }

  let dueDate: Date | null = null;
  if (/\btomorrow\b/i.test(working)) {
    dueDate = addDays(now, 1);
    working = working.replace(/\btomorrow\b/i, " ");
  } else if (/\btoday\b/i.test(working)) {
    dueDate = new Date(now);
    working = working.replace(/\btoday\b/i, " ");
  } else {
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const weekdayPattern = new RegExp(`\\b(${weekdays.join("|")})\\b`, "i");
    const weekdayMatch = working.match(weekdayPattern);
    if (weekdayMatch) {
      dueDate = nextWeekday(weekdays.indexOf(weekdayMatch[1].toLowerCase()), now);
      working = working.replace(weekdayMatch[0], " ");
    }
  }

  const monthPattern = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i;
  const monthMatch = working.match(monthPattern);
  if (monthMatch) {
    const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const month = months.indexOf(monthMatch[1].slice(0, 3).toLowerCase());
    const year = monthMatch[3] ? Number(monthMatch[3]) : now.getFullYear();
    dueDate = new Date(year, month, Number(monthMatch[2]));
    if (dueDate.getTime() < startOfDay(now).getTime() && !monthMatch[3]) dueDate.setFullYear(year + 1);
    working = working.replace(monthMatch[0], " ");
  }

  const timeMatch = working.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch) {
    dueDate ??= new Date(now);
    let hour = Number(timeMatch[1]) % 12;
    if (timeMatch[3].toLowerCase() === "pm") hour += 12;
    dueDate.setHours(hour, Number(timeMatch[2] ?? 0), 0, 0);
    if (!/\b(today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i.test(input) && dueDate.getTime() < now.getTime()) {
      dueDate.setDate(dueDate.getDate() + 1);
    }
    working = working.replace(timeMatch[0], " ");
  } else if (dueDate) {
    dueDate.setHours(9, 0, 0, 0);
  }

  const title = working.replace(/\s+/g, " ").replace(/\s+([,.;!?])/g, "$1").trim();
  return {
    title: title || input.trim(),
    dueAt: dueDate ? dueDate.toISOString() : null,
    priority,
    tags,
    recurrence,
  };
}

export function createEmptyTaskDraft(defaultListId: number | null, defaultStatusId: number | null): TaskDraft {
  return {
    title: "",
    notes: "",
    listId: defaultListId,
    statusId: defaultStatusId,
    startAt: "",
    dueAt: "",
    priority: "none",
    tags: [],
    recurrence: "none",
    customRecurrence: "",
    important: false,
    urgent: false,
    estimate: null,
    subtasks: [],
    reminderOffsets: [],
    persistentReminder: false,
  };
}
