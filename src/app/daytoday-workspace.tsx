"use client";

import {
  FormEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Session } from "@supabase/supabase-js";
import Script from "next/script";
import {
  Archive,
  Bell,
  BookOpen,
  CalendarDays,
  CalendarRange,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Columns3,
  Edit3,
  Flame,
  Folder,
  FolderPlus,
  GripVertical,
  Heart,
  House,
  Inbox,
  LayoutDashboard,
  ListFilter,
  ListTodo,
  LogOut,
  Menu,
  MoreHorizontal,
  NotebookPen,
  PanelLeftClose,
  Pause,
  Pin,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  SunMedium,
  Tag as TagIcon,
  Target,
  Timer,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  COLORS,
  Countdown,
  CountdownCategory,
  DailyReflection,
  FocusSession,
  Folder as FolderType,
  Habit,
  HabitCheckin,
  Note,
  Priority,
  Reminder,
  Subtask,
  Task,
  TaskDraft,
  TaskList,
  TaskStatus,
  UserPreferences,
  addDays,
  createEmptyTaskDraft,
  formatDue,
  fromDateTimeInput,
  getCountdownDays,
  getHabitStreak,
  getMonthDays,
  getNextCountdownDate,
  isOverdue,
  isSameDay,
  localDateKey,
  nextOccurrence,
  parseQuickTask,
  startOfDay,
  startOfWeek,
  toDateTimeInput,
} from "@/lib/daytoday";
import {
  GOOGLE_CALENDAR_SCOPE,
  GoogleCalendarEvent,
  GoogleCalendarEventDraft,
  createPrimaryGoogleEvent,
  googleEventStart,
  googleEventTimeLabel,
  listPrimaryGoogleEvents,
  reschedulePrimaryGoogleEvent,
} from "@/lib/google-calendar";

type WorkspaceProps = {
  session: Session | null;
  preview: boolean;
  onSignOut: () => Promise<void>;
};

type Toast = { tone: "success" | "error" | "info"; message: string };
type CollectionDialog = { type: "folder" | "list" | "status"; folderId?: number | null } | null;
type SortMode = "manual" | "due" | "priority" | "created";
type FocusMode = "work" | "short_break" | "long_break";
type CountdownDraft = {
  title: string;
  targetDate: string;
  repeatsYearly: boolean;
  category: CountdownCategory;
  color: string;
  notes: string;
};

const DEFAULT_PREFERENCES: UserPreferences = {
  user_id: "preview",
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  timezone: "Asia/Manila",
  week_starts_on: 1,
  updated_at: new Date().toISOString(),
};

const PRIORITY_WEIGHT: Record<Priority, number> = { high: 4, medium: 3, low: 2, none: 1 };

function Surface({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`surface ${className}`}>{children}</section>;
}

function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <div><strong>{title}</strong><p>{description}</p></div>
      {action}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "none") return null;
  return <span className={`priority-badge priority-${priority}`}>{priority}</span>;
}

function dateRangeLabel(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth();
  if (sameMonth) return `${start.toLocaleDateString(undefined, { month: "long" })} ${start.getDate()}–${end.getDate()}, ${end.getFullYear()}`;
  return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
}

function createEmptyCountdownDraft(): CountdownDraft {
  return {
    title: "",
    targetDate: localDateKey(addDays(new Date(), 30)),
    repeatsYearly: false,
    category: "event",
    color: COLORS[0],
    notes: "",
  };
}

function createEmptyGoogleEventDraft(day = new Date()): GoogleCalendarEventDraft {
  const start = new Date(day);
  start.setHours(9, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    summary: "",
    description: "",
    location: "",
    allDay: false,
    start: toDateTimeInput(start.toISOString()),
    end: toDateTimeInput(end.toISOString()),
  };
}

export function DayToDayWorkspace({ session, preview, onSignOut }: WorkspaceProps) {
  const supabase = useMemo(() => (session ? createClient() : null), [session]);
  const userId = session?.user.id ?? "preview";
  const displayName = session?.user.user_metadata?.full_name || session?.user.email?.split("@")[0] || "Preview";

  const [folders, setFolders] = useState<FolderType[]>([]);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [checkins, setCheckins] = useState<HabitCheckin[]>([]);
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([]);
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [countdowns, setCountdowns] = useState<Countdown[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>({ ...DEFAULT_PREFERENCES, user_id: userId });
  const [dataLoading, setDataLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  const [activeView, setActiveView] = useState("today");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("manual");
  const [showCompleted, setShowCompleted] = useState(true);
  const [quickInput, setQuickInput] = useState("");
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [collectionDialog, setCollectionDialog] = useState<CollectionDialog>(null);
  const [collectionName, setCollectionName] = useState("");

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>(() => createEmptyTaskDraft(null, null));
  const [subtaskInput, setSubtaskInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [calendarMode, setCalendarMode] = useState<"day" | "week" | "month" | "agenda">("month");
  const [googleScriptReady, setGoogleScriptReady] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [googleCalendarLoading, setGoogleCalendarLoading] = useState(false);
  const [googleCalendarError, setGoogleCalendarError] = useState<string | null>(null);
  const [draggedGoogleEventId, setDraggedGoogleEventId] = useState<string | null>(null);
  const [googleEventEditorOpen, setGoogleEventEditorOpen] = useState(false);
  const [googleEventDraft, setGoogleEventDraft] = useState<GoogleCalendarEventDraft>(() => createEmptyGoogleEventDraft());

  const [countdownEditorOpen, setCountdownEditorOpen] = useState(false);
  const [editingCountdownId, setEditingCountdownId] = useState<number | null>(null);
  const [countdownDraft, setCountdownDraft] = useState<CountdownDraft>(() => createEmptyCountdownDraft());

  const [showHabitForm, setShowHabitForm] = useState(false);
  const [habitName, setHabitName] = useState("");
  const [habitFrequency, setHabitFrequency] = useState<"daily" | "weekly" | "custom">("daily");
  const [habitTarget, setHabitTarget] = useState(1);

  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [noteTaskId, setNoteTaskId] = useState<number | null>(null);
  const [notePinned, setNotePinned] = useState(false);

  const [focusMode, setFocusMode] = useState<FocusMode>("work");
  const [focusSeconds, setFocusSeconds] = useState(DEFAULT_PREFERENCES.work_minutes * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<number | null>(null);
  const [focusStartedAt, setFocusStartedAt] = useState<string | null>(null);

  const [reflectionMood, setReflectionMood] = useState<number | null>(null);
  const [reflectionJournal, setReflectionJournal] = useState("");
  const [reflectionBest, setReflectionBest] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const notifiedAt = useRef<Record<number, number>>({});

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToast({ message, tone });
    window.setTimeout(() => setToast((current) => current?.message === message ? null : current), 3200);
  }, []);

  const googleVisibleRange = useMemo(() => {
    if (calendarMode === "month") {
      const days = getMonthDays(calendarCursor);
      return { start: startOfDay(days[0]), end: addDays(startOfDay(days[days.length - 1]), 1) };
    }
    if (calendarMode === "week") {
      const start = startOfWeek(calendarCursor, preferences.week_starts_on);
      return { start, end: addDays(start, 7) };
    }
    if (calendarMode === "agenda") {
      const start = startOfDay();
      return { start, end: addDays(start, 14) };
    }
    const start = startOfDay(calendarCursor);
    return { start, end: addDays(start, 1) };
  }, [calendarCursor, calendarMode, preferences.week_starts_on]);

  const refreshGoogleCalendar = useCallback(async (accessToken?: string | null) => {
    const token = accessToken ?? googleAccessToken;
    if (!token) return;
    setGoogleCalendarLoading(true);
    setGoogleCalendarError(null);
    try {
      const events = await listPrimaryGoogleEvents(token, googleVisibleRange.start, googleVisibleRange.end);
      setGoogleEvents(events);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load Google Calendar.";
      setGoogleCalendarError(message);
      if (/invalid credentials|unauthenticated|401/i.test(message)) setGoogleAccessToken(null);
    } finally {
      setGoogleCalendarLoading(false);
    }
  }, [googleAccessToken, googleVisibleRange]);

  useEffect(() => {
    if (!googleAccessToken) return;
    const timeout = window.setTimeout(() => void refreshGoogleCalendar(googleAccessToken), 0);
    return () => window.clearTimeout(timeout);
  }, [googleAccessToken, refreshGoogleCalendar]);

  function connectGoogleCalendar() {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      const message = "Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to .env.local, then restart DayToDay.";
      setGoogleCalendarError(message);
      notify(message, "info");
      return;
    }
    if (!googleScriptReady || !window.google) {
      const message = "Google Calendar is still loading. Try again in a moment.";
      setGoogleCalendarError(message);
      notify(message, "info");
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_CALENDAR_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token) {
          const message = response.error_description || response.error || "Google Calendar access was not granted.";
          setGoogleCalendarError(message);
          notify(message, "error");
          return;
        }
        if (response.scope && !response.scope.split(" ").includes(GOOGLE_CALENDAR_SCOPE)) {
          const message = "Calendar event access was not granted.";
          setGoogleCalendarError(message);
          notify(message, "error");
          return;
        }
        setGoogleAccessToken(response.access_token);
        setGoogleCalendarError(null);
        notify("Google Calendar connected.");
      },
      error_callback: (error) => {
        const message = error.message || "The Google authorization window could not open.";
        setGoogleCalendarError(message);
        notify(message, "error");
      },
    });
    client.requestAccessToken({ prompt: "" });
  }

  function disconnectGoogleCalendar() {
    if (googleAccessToken && window.google) {
      window.google.accounts.oauth2.revoke(googleAccessToken);
    }
    setGoogleAccessToken(null);
    setGoogleEvents([]);
    setGoogleCalendarError(null);
    notify("Google Calendar disconnected.", "info");
  }

  function openGoogleEventEditor(day = calendarCursor) {
    setGoogleEventDraft(createEmptyGoogleEventDraft(day));
    setGoogleEventEditorOpen(true);
  }

  async function saveGoogleEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!googleAccessToken || !googleEventDraft.summary.trim()) return;
    if (!googleEventDraft.start || !googleEventDraft.end) {
      notify("Choose a start and end for the Google event.", "error");
      return;
    }
    if (googleEventDraft.end < googleEventDraft.start) {
      notify("The event end must be after its start.", "error");
      return;
    }
    if (!googleEventDraft.allDay && new Date(googleEventDraft.end).getTime() <= new Date(googleEventDraft.start).getTime()) {
      notify("The event end must be after its start.", "error");
      return;
    }

    setSaving(true);
    try {
      await createPrimaryGoogleEvent(googleAccessToken, googleEventDraft);
      setGoogleEventEditorOpen(false);
      await refreshGoogleCalendar(googleAccessToken);
      notify("Event added to Google Calendar.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not create the Google event.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function moveGoogleEvent(eventId: string, day: Date) {
    if (!googleAccessToken) return;
    const event = googleEvents.find((item) => item.id === eventId);
    if (!event) return;
    try {
      const updated = await reschedulePrimaryGoogleEvent(googleAccessToken, event, day);
      setGoogleEvents((current) => current.map((item) => item.id === updated.id ? updated : item));
      notify("Google event rescheduled.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not reschedule the Google event.", "error");
    } finally {
      setDraggedGoogleEventId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function loadWorkspace() {
      if (preview || !supabase || !session) {
        const created = new Date().toISOString();
        const previewList: TaskList = { id: -1, user_id: "preview", folder_id: null, name: "Inbox", color: COLORS[0], position: 1000, created_at: created };
        const previewStatuses: TaskStatus[] = [
          { id: -1, user_id: "preview", name: "To do", color: "#8b9590", position: 1000, is_done: false, created_at: created },
          { id: -2, user_id: "preview", name: "In progress", color: COLORS[1], position: 2000, is_done: false, created_at: created },
          { id: -3, user_id: "preview", name: "Done", color: COLORS[0], position: 3000, is_done: true, created_at: created },
        ];
        window.setTimeout(() => {
          if (cancelled) return;
          setLists(previewList ? [previewList] : []);
          setStatuses(previewStatuses);
          setPreferences({ ...DEFAULT_PREFERENCES, user_id: "preview" });
          setDataLoading(false);
        }, 0);
        return;
      }

      const results = await Promise.all([
        supabase.from("folders").select("*").order("position"),
        supabase.from("task_lists").select("*").order("position"),
        supabase.from("task_statuses").select("*").order("position"),
        supabase.from("tasks").select("*").is("archived_at", null).order("position"),
        supabase.from("subtasks").select("*").order("position"),
        supabase.from("reminders").select("*").order("remind_at"),
        supabase.from("notes").select("*").order("updated_at", { ascending: false }),
        supabase.from("habits").select("*").is("archived_at", null).order("position"),
        supabase.from("habit_checkins").select("*").gte("checkin_date", localDateKey(addDays(new Date(), -120))),
        supabase.from("focus_sessions").select("*").order("started_at", { ascending: false }).limit(100),
        supabase.from("daily_reflections").select("*").order("reflection_date", { ascending: false }).limit(30),
        supabase.from("countdowns").select("*").order("target_date"),
        supabase.from("user_preferences").select("*").maybeSingle(),
      ]);

      if (cancelled) return;
      const firstError = results.find((result) => result.error)?.error;
      if (firstError) {
        setDataLoading(false);
        notify(firstError.message, "error");
        return;
      }

      let loadedLists = (results[1].data ?? []) as TaskList[];
      let loadedStatuses = (results[2].data ?? []) as TaskStatus[];
      if (!loadedLists.length) {
        const { data, error } = await supabase.from("task_lists").insert({ user_id: session.user.id, name: "Inbox", color: COLORS[0], position: 1000 }).select("*");
        if (error) notify(error.message, "error");
        loadedLists = (data ?? []) as TaskList[];
      }
      if (!loadedStatuses.length) {
        const { data, error } = await supabase.from("task_statuses").insert([
          { user_id: session.user.id, name: "To do", color: "#8b9590", position: 1000, is_done: false },
          { user_id: session.user.id, name: "In progress", color: COLORS[1], position: 2000, is_done: false },
          { user_id: session.user.id, name: "Done", color: COLORS[0], position: 3000, is_done: true },
        ]).select("*");
        if (error) notify(error.message, "error");
        loadedStatuses = (data ?? []) as TaskStatus[];
      }

      let loadedPreferences = results[12].data as UserPreferences | null;
      if (!loadedPreferences) {
        const { data } = await supabase.from("user_preferences").upsert({ user_id: session.user.id, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Manila" }, { onConflict: "user_id" }).select("*").single();
        loadedPreferences = data as UserPreferences | null;
      }

      if (cancelled) return;
      setFolders((results[0].data ?? []) as FolderType[]);
      setLists(loadedLists);
      setStatuses(loadedStatuses);
      setTasks((results[3].data ?? []) as Task[]);
      setSubtasks((results[4].data ?? []) as Subtask[]);
      setReminders((results[5].data ?? []) as Reminder[]);
      setNotes((results[6].data ?? []) as Note[]);
      setHabits((results[7].data ?? []) as Habit[]);
      setCheckins((results[8].data ?? []) as HabitCheckin[]);
      setFocusSessions((results[9].data ?? []) as FocusSession[]);
      setReflections((results[10].data ?? []) as DailyReflection[]);
      setCountdowns((results[11].data ?? []) as Countdown[]);
      setPreferences(loadedPreferences ?? { ...DEFAULT_PREFERENCES, user_id: session.user.id });
      setDataLoading(false);
    }
    void loadWorkspace();
    return () => { cancelled = true; };
  }, [notify, preview, session, supabase]);

  useEffect(() => {
    const todayReflection = reflections.find((item) => item.reflection_date === localDateKey(new Date()));
    if (!todayReflection) return;
    const timeout = window.setTimeout(() => {
      setReflectionMood(todayReflection.mood);
      setReflectionJournal(todayReflection.journal);
      setReflectionBest(todayReflection.best_thing);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [reflections]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const defaultListId = lists[0]?.id ?? null;
  const defaultStatusId = statuses.find((item) => !item.is_done)?.id ?? statuses[0]?.id ?? null;
  const doneStatusId = statuses.find((item) => item.is_done)?.id ?? null;

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const listById = useMemo(() => new Map(lists.map((list) => [list.id, list])), [lists]);
  const allTags = useMemo(() => Array.from(new Set(tasks.flatMap((task) => task.tags))).sort(), [tasks]);

  const dueReminders = useMemo(() => reminders.filter((reminder) => {
    const task = taskById.get(reminder.task_id);
    return !reminder.acknowledged_at && !task?.completed_at && new Date(reminder.remind_at).getTime() <= nowTick;
  }), [nowTick, reminders, taskById]);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    for (const reminder of dueReminders) {
      const last = notifiedAt.current[reminder.id] ?? 0;
      const repeatAfter = reminder.persistent ? 5 * 60_000 : Number.POSITIVE_INFINITY;
      if (last && nowTick - last < repeatAfter) continue;
      const task = taskById.get(reminder.task_id);
      if (!task) continue;
      new Notification("DayToDay reminder", { body: task.title, tag: `daytoday-${reminder.id}`, requireInteraction: reminder.persistent });
      notifiedAt.current[reminder.id] = nowTick;
    }
  }, [dueReminders, nowTick, taskById]);

  function reportError(error: { message: string } | null) {
    if (error) notify(error.message, "error");
    return Boolean(error);
  }

  async function createCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = collectionName.trim();
    if (!name || !collectionDialog) return;
    setSaving(true);
    const createdAt = new Date().toISOString();
    const position = Date.now();
    if (collectionDialog.type === "folder") {
      if (preview) {
        setFolders((current) => [...current, { id: -Date.now(), user_id: userId, name, color: COLORS[current.length % COLORS.length], position, created_at: createdAt }]);
      } else if (supabase) {
        const { data, error } = await supabase.from("folders").insert({ user_id: userId, name, color: COLORS[folders.length % COLORS.length], position }).select("*").single();
        if (!reportError(error)) setFolders((current) => [...current, data as FolderType]);
      }
    }
    if (collectionDialog.type === "list") {
      const folderId = collectionDialog.folderId ?? null;
      if (preview) {
        setLists((current) => [...current, { id: -Date.now(), user_id: userId, folder_id: folderId, name, color: COLORS[current.length % COLORS.length], position, created_at: createdAt }]);
      } else if (supabase) {
        const { data, error } = await supabase.from("task_lists").insert({ user_id: userId, folder_id: folderId, name, color: COLORS[lists.length % COLORS.length], position }).select("*").single();
        if (!reportError(error)) setLists((current) => [...current, data as TaskList]);
      }
    }
    if (collectionDialog.type === "status") {
      if (preview) {
        setStatuses((current) => [...current, { id: -Date.now(), user_id: userId, name, color: COLORS[current.length % COLORS.length], position, is_done: false, created_at: createdAt }]);
      } else if (supabase) {
        const { data, error } = await supabase.from("task_statuses").insert({ user_id: userId, name, color: COLORS[statuses.length % COLORS.length], position, is_done: false }).select("*").single();
        if (!reportError(error)) setStatuses((current) => [...current, data as TaskStatus]);
      }
    }
    setSaving(false);
    setCollectionName("");
    setCollectionDialog(null);
    notify(`${name} created.`);
  }

  function openTaskEditor(task?: Task) {
    if (!task) {
      setEditingTaskId(null);
      setTaskDraft(createEmptyTaskDraft(defaultListId, defaultStatusId));
      setTagInput("");
    } else {
      const taskReminders = reminders.filter((item) => item.task_id === task.id);
      const dueTime = task.due_at ? new Date(task.due_at).getTime() : 0;
      setEditingTaskId(task.id);
      setTaskDraft({
        title: task.title,
        notes: task.notes,
        listId: task.list_id,
        statusId: task.status_id,
        startAt: toDateTimeInput(task.start_at),
        dueAt: toDateTimeInput(task.due_at),
        priority: task.priority,
        tags: task.tags,
        recurrence: task.recurrence_rule?.frequency ?? "none",
        customRecurrence: task.recurrence_rule?.custom ?? "",
        important: task.is_important,
        urgent: task.is_urgent,
        estimate: task.estimated_minutes,
        subtasks: subtasks.filter((item) => item.task_id === task.id).map((item) => item.title),
        reminderOffsets: task.due_at ? taskReminders.map((item) => Math.max(0, Math.round((dueTime - new Date(item.remind_at).getTime()) / 60_000))) : [],
        persistentReminder: taskReminders.some((item) => item.persistent),
      });
      setTagInput(task.tags.join(", "));
    }
    setSubtaskInput("");
    setEditorOpen(true);
  }

  function taskPayload(draft: TaskDraft) {
    return {
      user_id: userId,
      list_id: draft.listId,
      status_id: draft.statusId,
      title: draft.title.trim(),
      notes: draft.notes.trim(),
      start_at: fromDateTimeInput(draft.startAt),
      due_at: fromDateTimeInput(draft.dueAt),
      priority: draft.priority,
      tags: draft.tags,
      recurrence_rule: draft.recurrence === "none" ? null : { frequency: draft.recurrence, interval: 1, ...(draft.customRecurrence ? { custom: draft.customRecurrence } : {}) },
      is_important: draft.important,
      is_urgent: draft.urgent,
      estimated_minutes: draft.estimate,
      updated_at: new Date().toISOString(),
    };
  }

  async function saveTask(event?: FormEvent<HTMLFormElement>, draftOverride?: TaskDraft) {
    event?.preventDefault();
    const draft = draftOverride ?? taskDraft;
    if (!draft.title.trim()) return;
    setSaving(true);
    const payload = taskPayload(draft);
    const createdAt = new Date().toISOString();
    let savedTask: Task | null = null;

    if (preview) {
      if (editingTaskId) {
        setTasks((current) => current.map((task) => task.id === editingTaskId ? { ...task, ...payload } as Task : task));
        savedTask = { ...taskById.get(editingTaskId)!, ...payload } as Task;
      } else {
        savedTask = {
          id: Date.now(),
          ...payload,
          position: Math.max(0, ...tasks.map((task) => task.position)) + 1000,
          completed_at: null,
          archived_at: null,
          created_at: createdAt,
        } as Task;
        setTasks((current) => [...current, savedTask!]);
      }
    } else if (supabase) {
      if (editingTaskId) {
        const { data, error } = await supabase.from("tasks").update(payload).eq("id", editingTaskId).select("*").single();
        if (reportError(error)) { setSaving(false); return; }
        savedTask = data as Task;
        setTasks((current) => current.map((task) => task.id === editingTaskId ? savedTask! : task));
      } else {
        const { data, error } = await supabase.from("tasks").insert({ ...payload, position: Math.max(0, ...tasks.map((task) => task.position)) + 1000 }).select("*").single();
        if (reportError(error)) { setSaving(false); return; }
        savedTask = data as Task;
        setTasks((current) => [...current, savedTask!]);
      }
    }

    if (!savedTask) { setSaving(false); return; }
    const taskId = savedTask.id;
    const dueAt = savedTask.due_at ? new Date(savedTask.due_at).getTime() : null;
    const existingTaskSubtasks = subtasks.filter((item) => item.task_id === taskId);
    const subtaskRows = draft.subtasks.filter(Boolean).map((title, index) => ({ user_id: userId, task_id: taskId, title, is_completed: existingTaskSubtasks.find((item) => item.title === title)?.is_completed ?? false, position: (index + 1) * 1000 }));
    const reminderRows = dueAt === null ? [] : draft.reminderOffsets.map((offset) => ({ user_id: userId, task_id: taskId, remind_at: new Date(dueAt - offset * 60_000).toISOString(), persistent: draft.persistentReminder }));

    if (preview) {
      setSubtasks((current) => [
        ...current.filter((item) => item.task_id !== taskId),
        ...subtaskRows.map((item, index) => ({ ...item, id: Date.now() + index + 1, created_at: createdAt })),
      ]);
      setReminders((current) => [
        ...current.filter((item) => item.task_id !== taskId),
        ...reminderRows.map((item, index) => ({ ...item, id: Date.now() + index + 100, last_notified_at: null, acknowledged_at: null, created_at: createdAt })),
      ]);
    } else if (supabase) {
      await Promise.all([
        supabase.from("subtasks").delete().eq("task_id", taskId),
        supabase.from("reminders").delete().eq("task_id", taskId),
      ]);
      const [subtaskResult, reminderResult] = await Promise.all([
        subtaskRows.length ? supabase.from("subtasks").insert(subtaskRows).select("*") : Promise.resolve({ data: [], error: null }),
        reminderRows.length ? supabase.from("reminders").insert(reminderRows).select("*") : Promise.resolve({ data: [], error: null }),
      ]);
      if (subtaskResult.error) reportError(subtaskResult.error);
      if (reminderResult.error) reportError(reminderResult.error);
      setSubtasks((current) => [...current.filter((item) => item.task_id !== taskId), ...((subtaskResult.data ?? []) as Subtask[])]);
      setReminders((current) => [...current.filter((item) => item.task_id !== taskId), ...((reminderResult.data ?? []) as Reminder[])]);
    }

    setSaving(false);
    setEditorOpen(false);
    notify(editingTaskId ? "Task updated." : "Task added.");
  }

  async function createQuickTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseQuickTask(quickInput);
    if (!parsed.title) return;
    const draft = createEmptyTaskDraft(defaultListId, defaultStatusId);
    draft.title = parsed.title;
    draft.dueAt = toDateTimeInput(parsed.dueAt);
    draft.priority = parsed.priority;
    draft.tags = parsed.tags;
    draft.recurrence = parsed.recurrence;
    setQuickInput("");
    await saveTask(undefined, draft);
  }

  async function updateTaskFields(id: number, changes: Partial<Task>, successMessage?: string) {
    const previous = taskById.get(id);
    if (!previous) return;
    const next = { ...previous, ...changes, updated_at: new Date().toISOString() };
    setTasks((current) => current.map((task) => task.id === id ? next : task));
    if (!preview && supabase) {
      const { error } = await supabase.from("tasks").update({ ...changes, updated_at: next.updated_at }).eq("id", id);
      if (error) {
        setTasks((current) => current.map((task) => task.id === id ? previous : task));
        reportError(error);
        return;
      }
    }
    if (successMessage) notify(successMessage);
  }

  async function toggleTask(task: Task) {
    const completing = !task.completed_at;
    const completedAt = completing ? new Date().toISOString() : null;
    await updateTaskFields(task.id, { completed_at: completedAt, status_id: completing && doneStatusId ? doneStatusId : task.status_id });
    if (completing) {
      const nextDue = nextOccurrence(task);
      if (nextDue) {
        const draft = createEmptyTaskDraft(task.list_id, defaultStatusId);
        draft.title = task.title;
        draft.notes = task.notes;
        draft.startAt = task.start_at && task.due_at ? toDateTimeInput(new Date(new Date(task.start_at).getTime() + (new Date(nextDue).getTime() - new Date(task.due_at).getTime())).toISOString()) : "";
        draft.dueAt = toDateTimeInput(nextDue);
        draft.priority = task.priority;
        draft.tags = task.tags;
        draft.recurrence = task.recurrence_rule?.frequency ?? "none";
        draft.important = task.is_important;
        draft.urgent = task.is_urgent;
        draft.estimate = task.estimated_minutes;
        await saveTask(undefined, draft);
      }
    }
  }

  async function toggleSubtaskItem(subtask: Subtask) {
    const nextCompleted = !subtask.is_completed;
    setSubtasks((current) => current.map((item) => item.id === subtask.id ? { ...item, is_completed: nextCompleted } : item));
    if (!preview && supabase) {
      const { error } = await supabase.from("subtasks").update({ is_completed: nextCompleted }).eq("id", subtask.id);
      if (error) {
        setSubtasks((current) => current.map((item) => item.id === subtask.id ? subtask : item));
        reportError(error);
      }
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete “${task.title}”?`)) return;
    const previous = tasks;
    setTasks((current) => current.filter((item) => item.id !== task.id));
    if (!preview && supabase) {
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) { setTasks(previous); reportError(error); return; }
    }
    notify("Task deleted.", "info");
  }

  async function reorderTask(dragId: number, targetId: number) {
    if (dragId === targetId) return;
    const ordered = [...tasks].sort((a, b) => a.position - b.position);
    const fromIndex = ordered.findIndex((task) => task.id === dragId);
    const toIndex = ordered.findIndex((task) => task.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);
    const normalized = ordered.map((task, index) => ({ ...task, position: (index + 1) * 1000 }));
    setTasks(normalized);
    if (!preview && supabase) {
      await Promise.all(normalized.map((task) => supabase.from("tasks").update({ position: task.position }).eq("id", task.id)));
    }
  }

  async function acknowledgeReminder(reminder: Reminder) {
    const acknowledgedAt = new Date().toISOString();
    setReminders((current) => current.map((item) => item.id === reminder.id ? { ...item, acknowledged_at: acknowledgedAt } : item));
    if (!preview && supabase) {
      const { error } = await supabase.from("reminders").update({ acknowledged_at: acknowledgedAt }).eq("id", reminder.id);
      reportError(error);
    }
  }

  async function enableNotifications() {
    if (typeof Notification === "undefined") {
      notify("Browser notifications are not supported here.", "info");
      return;
    }
    const permission = await Notification.requestPermission();
    notify(permission === "granted" ? "Browser notifications enabled." : "Notifications were not enabled.", permission === "granted" ? "success" : "info");
  }

  async function createHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = habitName.trim();
    if (!name) return;
    setSaving(true);
    const payload = { user_id: userId, name, frequency_type: habitFrequency, target_count: habitTarget, color: COLORS[habits.length % COLORS.length], position: Date.now() };
    if (preview) {
      setHabits((current) => [...current, { ...payload, id: -Date.now(), weekdays: [], archived_at: null, created_at: new Date().toISOString() }]);
    } else if (supabase) {
      const { data, error } = await supabase.from("habits").insert(payload).select("*").single();
      if (!reportError(error)) setHabits((current) => [...current, data as Habit]);
    }
    setSaving(false);
    setHabitName("");
    setShowHabitForm(false);
    notify("Habit created.");
  }

  async function toggleHabitToday(habit: Habit) {
    const today = localDateKey(new Date());
    const existing = checkins.find((item) => item.habit_id === habit.id && item.checkin_date === today);
    const nextCount = existing?.count ? 0 : 1;
    if (preview) {
      if (existing) setCheckins((current) => current.map((item) => item.id === existing.id ? { ...item, count: nextCount } : item));
      else setCheckins((current) => [...current, { id: -Date.now(), user_id: userId, habit_id: habit.id, checkin_date: today, count: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]);
      return;
    }
    if (!supabase) return;
    const { data, error } = await supabase.from("habit_checkins").upsert({ user_id: userId, habit_id: habit.id, checkin_date: today, count: nextCount, updated_at: new Date().toISOString() }, { onConflict: "habit_id,checkin_date" }).select("*").single();
    if (reportError(error)) return;
    setCheckins((current) => existing ? current.map((item) => item.id === existing.id ? data as HabitCheckin : item) : [...current, data as HabitCheckin]);
  }

  async function archiveHabit(habit: Habit) {
    const archivedAt = new Date().toISOString();
    setHabits((current) => current.filter((item) => item.id !== habit.id));
    if (!preview && supabase) {
      const { error } = await supabase.from("habits").update({ archived_at: archivedAt }).eq("id", habit.id);
      reportError(error);
    }
  }

  function selectNote(note: Note | null) {
    setSelectedNoteId(note?.id ?? null);
    setNoteTitle(note?.title ?? "");
    setNoteBody(note?.body ?? "");
    setNoteTaskId(note?.task_id ?? null);
    setNotePinned(note?.is_pinned ?? false);
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteTitle.trim() && !noteBody.trim()) return;
    setSaving(true);
    const payload = { user_id: userId, title: noteTitle.trim(), body: noteBody.trim(), task_id: noteTaskId, is_pinned: notePinned, updated_at: new Date().toISOString() };
    if (preview) {
      if (selectedNoteId) setNotes((current) => current.map((item) => item.id === selectedNoteId ? { ...item, ...payload } : item));
      else {
        const note = { ...payload, id: -Date.now(), checklist: [], created_at: new Date().toISOString() } as Note;
        setNotes((current) => [note, ...current]);
        setSelectedNoteId(note.id);
      }
    } else if (supabase) {
      if (selectedNoteId) {
        const { data, error } = await supabase.from("notes").update(payload).eq("id", selectedNoteId).select("*").single();
        if (!reportError(error)) setNotes((current) => current.map((item) => item.id === selectedNoteId ? data as Note : item));
      } else {
        const { data, error } = await supabase.from("notes").insert(payload).select("*").single();
        if (!reportError(error)) { setNotes((current) => [data as Note, ...current]); setSelectedNoteId((data as Note).id); }
      }
    }
    setSaving(false);
    notify("Note saved.");
  }

  async function deleteNote() {
    if (!selectedNoteId || !window.confirm("Delete this note?")) return;
    const id = selectedNoteId;
    setNotes((current) => current.filter((item) => item.id !== id));
    selectNote(null);
    if (!preview && supabase) {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      reportError(error);
    }
  }

  const focusDuration = focusMode === "work" ? preferences.work_minutes : focusMode === "short_break" ? preferences.short_break_minutes : preferences.long_break_minutes;

  useEffect(() => {
    if (!focusRunning) return;
    const timeout = window.setTimeout(() => {
      if (focusSeconds <= 1) {
        setFocusRunning(false);
        setFocusSeconds(0);
        void completeFocusSession(true);
      } else {
        setFocusSeconds((seconds) => seconds - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timeout);
  });

  function chooseFocusMode(mode: FocusMode) {
    if (focusRunning) return;
    setFocusMode(mode);
    const minutes = mode === "work" ? preferences.work_minutes : mode === "short_break" ? preferences.short_break_minutes : preferences.long_break_minutes;
    setFocusSeconds(minutes * 60);
    setFocusStartedAt(null);
  }

  function toggleFocus() {
    if (!focusRunning && !focusStartedAt) setFocusStartedAt(new Date().toISOString());
    setFocusRunning((running) => !running);
  }

  async function completeFocusSession(naturalFinish = false) {
    const startedAt = focusStartedAt ?? new Date(Date.now() - focusDuration * 60_000).toISOString();
    const elapsedMinutes = naturalFinish ? focusDuration : Math.max(1, Math.round((focusDuration * 60 - focusSeconds) / 60));
    if (focusMode === "work" && (naturalFinish || elapsedMinutes > 0)) {
      const payload: Omit<FocusSession, "id" | "created_at"> = { user_id: userId, task_id: focusTaskId, session_type: "work", started_at: startedAt, ended_at: new Date().toISOString(), duration_minutes: elapsedMinutes, is_completed: naturalFinish };
      if (preview) {
        setFocusSessions((current) => [{ ...payload, id: -Date.now(), created_at: new Date().toISOString() }, ...current]);
      } else if (supabase) {
        const { data, error } = await supabase.from("focus_sessions").insert(payload).select("*").single();
        if (!reportError(error)) setFocusSessions((current) => [data as FocusSession, ...current]);
      }
    }
    setFocusRunning(false);
    setFocusStartedAt(null);
    if (naturalFinish && focusMode === "work") {
      setFocusMode("short_break");
      setFocusSeconds(preferences.short_break_minutes * 60);
      notify("Focus session complete. Take a short break.");
    } else {
      setFocusSeconds(focusDuration * 60);
      notify("Session saved.");
    }
  }

  async function savePreferences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const updated = { ...preferences, updated_at: new Date().toISOString() };
    setPreferences(updated);
    if (!focusRunning) setFocusSeconds((focusMode === "work" ? updated.work_minutes : focusMode === "short_break" ? updated.short_break_minutes : updated.long_break_minutes) * 60);
    if (!preview && supabase) {
      const { error } = await supabase.from("user_preferences").upsert(updated, { onConflict: "user_id" });
      if (reportError(error)) return;
    }
    notify("Timer settings saved.");
  }

  async function saveReflection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const today = localDateKey(new Date());
    const payload = { user_id: userId, reflection_date: today, mood: reflectionMood, journal: reflectionJournal.trim(), best_thing: reflectionBest.trim(), updated_at: new Date().toISOString() };
    const existing = reflections.find((item) => item.reflection_date === today);
    if (preview) {
      if (existing) setReflections((current) => current.map((item) => item.id === existing.id ? { ...item, ...payload } : item));
      else setReflections((current) => [{ ...payload, id: -Date.now(), created_at: new Date().toISOString() }, ...current]);
    } else if (supabase) {
      const { data, error } = await supabase.from("daily_reflections").upsert(payload, { onConflict: "user_id,reflection_date" }).select("*").single();
      if (reportError(error)) return;
      setReflections((current) => existing ? current.map((item) => item.id === existing.id ? data as DailyReflection : item) : [data as DailyReflection, ...current]);
    }
    notify("Reflection saved.");
  }

  function openCountdownEditor(countdown?: Countdown, preset?: Partial<CountdownDraft>) {
    if (countdown) {
      setEditingCountdownId(countdown.id);
      setCountdownDraft({
        title: countdown.title,
        targetDate: countdown.target_date,
        repeatsYearly: countdown.repeats_yearly,
        category: countdown.category,
        color: countdown.color,
        notes: countdown.notes,
      });
    } else {
      setEditingCountdownId(null);
      setCountdownDraft({ ...createEmptyCountdownDraft(), ...preset });
    }
    setCountdownEditorOpen(true);
  }

  async function saveCountdown(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!countdownDraft.title.trim() || !countdownDraft.targetDate) return;
    setSaving(true);
    const payload = {
      user_id: userId,
      title: countdownDraft.title.trim(),
      target_date: countdownDraft.targetDate,
      repeats_yearly: countdownDraft.repeatsYearly,
      category: countdownDraft.category,
      color: countdownDraft.color,
      notes: countdownDraft.notes.trim(),
      updated_at: new Date().toISOString(),
    };

    if (preview) {
      if (editingCountdownId) {
        setCountdowns((current) => current.map((item) => item.id === editingCountdownId ? { ...item, ...payload } : item));
      } else {
        setCountdowns((current) => [...current, { ...payload, id: -Date.now(), created_at: new Date().toISOString() }]);
      }
    } else if (supabase) {
      if (editingCountdownId) {
        const { data, error } = await supabase.from("countdowns").update(payload).eq("id", editingCountdownId).select("*").single();
        if (reportError(error)) { setSaving(false); return; }
        setCountdowns((current) => current.map((item) => item.id === editingCountdownId ? data as Countdown : item));
      } else {
        const { data, error } = await supabase.from("countdowns").insert(payload).select("*").single();
        if (reportError(error)) { setSaving(false); return; }
        setCountdowns((current) => [...current, data as Countdown]);
      }
    }
    setSaving(false);
    setCountdownEditorOpen(false);
    notify(editingCountdownId ? "Important date updated." : "Important date saved.");
  }

  async function deleteCountdown() {
    if (!editingCountdownId || !window.confirm("Delete this important date?")) return;
    if (!preview && supabase) {
      const { error } = await supabase.from("countdowns").delete().eq("id", editingCountdownId);
      if (reportError(error)) return;
    }
    setCountdowns((current) => current.filter((item) => item.id !== editingCountdownId));
    setCountdownEditorOpen(false);
    setEditingCountdownId(null);
    notify("Important date deleted.", "info");
  }

  const sortedCountdowns = useMemo(() => [...countdowns].sort((first, second) => {
    const now = new Date(nowTick);
    const firstDays = getCountdownDays(first, now);
    const secondDays = getCountdownDays(second, now);
    const firstPast = firstDays < 0 ? 1 : 0;
    const secondPast = secondDays < 0 ? 1 : 0;
    return firstPast - secondPast || firstDays - secondDays || first.title.localeCompare(second.title);
  }), [countdowns, nowTick]);

  const filteredTasks = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    let result = tasks.filter((task) => {
      if (!showCompleted && task.completed_at) return false;
      if (tagFilter !== "all" && !task.tags.includes(tagFilter)) return false;
      if (normalized && !`${task.title} ${task.notes} ${task.tags.join(" ")}`.toLowerCase().includes(normalized)) return false;
      if (activeView.startsWith("list:")) return task.list_id === Number(activeView.split(":")[1]);
      if (activeView === "inbox") return task.list_id === defaultListId;
      if (activeView === "smart-today") return Boolean(task.due_at && isSameDay(new Date(task.due_at), new Date()));
      if (activeView === "smart-next") {
        if (!task.due_at) return false;
        const due = new Date(task.due_at).getTime();
        return due >= startOfDay().getTime() && due < addDays(startOfDay(), 7).getTime();
      }
      if (activeView === "smart-overdue") return isOverdue(task);
      if (activeView === "smart-nodate") return !task.due_at;
      return true;
    });
    if (sortMode === "manual") result = [...result].sort((a, b) => a.position - b.position);
    if (sortMode === "due") result = [...result].sort((a, b) => (a.due_at ? new Date(a.due_at).getTime() : Number.MAX_SAFE_INTEGER) - (b.due_at ? new Date(b.due_at).getTime() : Number.MAX_SAFE_INTEGER));
    if (sortMode === "priority") result = [...result].sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);
    if (sortMode === "created") result = [...result].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return result;
  }, [activeView, defaultListId, search, showCompleted, sortMode, tagFilter, tasks]);

  const searchNotes = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return [];
    return notes.filter((note) => `${note.title} ${note.body}`.toLowerCase().includes(normalized)).slice(0, 5);
  }, [notes, search]);

  const globalSearchTasks = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return [];
    return tasks.filter((task) => `${task.title} ${task.notes} ${task.tags.join(" ")}`.toLowerCase().includes(normalized)).slice(0, 7);
  }, [search, tasks]);

  const searchGoogleEvents = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return [];
    return googleEvents.filter((event) => `${event.summary ?? ""} ${event.description ?? ""} ${event.location ?? ""}`.toLowerCase().includes(normalized)).slice(0, 5);
  }, [googleEvents, search]);

  function navigate(view: string) {
    setActiveView(view);
    setSidebarOpen(false);
  }

  function activeTitle() {
    if (activeView.startsWith("list:")) return listById.get(Number(activeView.split(":")[1]))?.name ?? "List";
    const titles: Record<string, string> = {
      today: "Today", inbox: "Inbox", tasks: "All tasks", calendar: "Calendar", kanban: "Kanban board", timeline: "Timeline", matrix: "Eisenhower matrix", countdowns: "Countdowns", habits: "Habits", focus: "Focus", notes: "Notes", reminders: "Reminders", reflection: "Daily reflection", "smart-today": "Today", "smart-next": "Next 7 days", "smart-overdue": "Overdue", "smart-nodate": "No date",
    };
    return titles[activeView] ?? "DayToDay";
  }

  function TaskRow({ task, compact = false }: { task: Task; compact?: boolean }) {
    const completedSubtasks = subtasks.filter((item) => item.task_id === task.id && item.is_completed).length;
    const taskSubtasks = subtasks.filter((item) => item.task_id === task.id);
    return (
      <div className="task-group">
        <article
          className={`task-row ${task.completed_at ? "completed" : ""} ${compact ? "compact" : ""}`}
          draggable
          onDragStart={() => setDraggedTaskId(task.id)}
          onDragEnd={() => setDraggedTaskId(null)}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); if (draggedTaskId) void reorderTask(draggedTaskId, task.id); }}
        >
          <GripVertical className="drag-handle" size={16} />
          <button className={`task-check ${task.completed_at ? "checked" : ""}`} type="button" onClick={() => void toggleTask(task)} aria-label={task.completed_at ? "Mark incomplete" : "Mark complete"}>{task.completed_at ? <Check size={14} /> : null}</button>
          <button className="task-main" type="button" onClick={() => openTaskEditor(task)}>
            <span className="task-title">{task.title}</span>
            <span className="task-meta">
              {listById.get(task.list_id ?? 0)?.name ?? "Unlisted"}
              <span>•</span>
              <span className={isOverdue(task) ? "overdue-text" : ""}>{formatDue(task.due_at)}</span>
              {taskSubtasks.length ? <><span>•</span>{completedSubtasks}/{taskSubtasks.length} subtasks</> : null}
            </span>
          </button>
          {!compact ? <div className="task-tags">{task.tags.slice(0, 2).map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
          <PriorityBadge priority={task.priority} />
          {taskSubtasks.length && !compact ? <button className={`icon-button ghost task-expand ${expandedTaskId === task.id ? "open" : ""}`} type="button" onClick={() => setExpandedTaskId((current) => current === task.id ? null : task.id)} aria-label="Show subtasks"><ChevronDown size={15} /></button> : <span className="task-expand-placeholder" />}
          <button className="icon-button ghost" type="button" onClick={() => openTaskEditor(task)} aria-label={`Edit ${task.title}`}><Edit3 size={15} /></button>
        </article>
        {expandedTaskId === task.id && taskSubtasks.length ? <div className="inline-subtasks">{taskSubtasks.map((subtask) => <button className={subtask.is_completed ? "completed" : ""} type="button" onClick={() => void toggleSubtaskItem(subtask)} key={subtask.id}>{subtask.is_completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}<span>{subtask.title}</span></button>)}</div> : null}
      </div>
    );
  }

  function QuickAdd() {
    const parsed = quickInput.trim() ? parseQuickTask(quickInput) : null;
    return (
      <form className="quick-add" onSubmit={createQuickTask}>
        <span className="quick-add-icon"><Sparkles size={17} /></span>
        <div className="quick-add-field">
          <input value={quickInput} onChange={(event) => setQuickInput(event.target.value)} placeholder='Quick add: “Submit report Friday 3pm #work !high”' aria-label="Quick add task" />
          {parsed ? <span className="parse-preview">{parsed.dueAt ? formatDue(parsed.dueAt) : "No date"}{parsed.tags.length ? ` · ${parsed.tags.map((tag) => `#${tag}`).join(" ")}` : ""}{parsed.priority !== "none" ? ` · ${parsed.priority} priority` : ""}</span> : null}
        </div>
        <button className="primary-button" type="submit" disabled={!quickInput.trim()}><Plus size={16} /> Add task</button>
        <button className="icon-button advanced-add" type="button" onClick={() => openTaskEditor()} aria-label="Open task details"><Settings2 size={16} /></button>
      </form>
    );
  }

  function TaskListPanel({ title, description, source = filteredTasks }: { title: string; description?: string; source?: Task[] }) {
    return (
      <Surface className="task-panel">
        <div className="section-heading"><div><h2>{title}</h2>{description ? <p>{description}</p> : null}</div><span className="count-pill">{source.filter((task) => !task.completed_at).length} open</span></div>
        {source.length ? <div className="task-list">{source.map((task) => <TaskRow task={task} key={task.id} />)}</div> : <EmptyState icon={<ListTodo size={20} />} title="Nothing here yet" description="Add a task above, or change the current filters." action={<button className="secondary-button" type="button" onClick={() => openTaskEditor()}><Plus size={15} /> New task</button>} />}
      </Surface>
    );
  }

  function renderToday() {
    const todayTasks = tasks.filter((task) => task.due_at && isSameDay(new Date(task.due_at), new Date()));
    const openToday = todayTasks.filter((task) => !task.completed_at);
    const completedToday = todayTasks.length - openToday.length;
    const completion = todayTasks.length ? Math.round((completedToday / todayTasks.length) * 100) : 0;
    const upcomingCountdowns = sortedCountdowns.filter((countdown) => getCountdownDays(countdown) >= 0).slice(0, 3);
    const pinned = notes.find((note) => note.is_pinned);
    return (
      <div className="view-stack">
        <QuickAdd />
        <section className="today-hero-grid">
          <Surface className="today-hero">
            <div className="hero-date"><span>{new Date().toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</span><strong>{new Date().getDate()}</strong></div>
            <div className="hero-copy"><span className="eyebrow">DAILY OVERVIEW</span><h2>{openToday.length ? `${openToday.length} ${openToday.length === 1 ? "thing" : "things"} to move forward` : "Your day is clear"}</h2><p>{todayTasks.length ? `${completedToday} of ${todayTasks.length} completed` : "Add a dated task to shape today."}</p><div className="progress-track"><span style={{ width: `${completion}%` }} /></div></div>
            <button className="focus-launch" type="button" onClick={() => navigate("focus")}><Timer size={20} /><span>Start focus</span></button>
          </Surface>
          <Surface className="today-stats">
            <div><strong>{openToday.length}</strong><span>Today</span></div>
            <div><strong>{tasks.filter((task) => isOverdue(task)).length}</strong><span>Overdue</span></div>
            <div><strong>{habits.filter((habit) => checkins.some((item) => item.habit_id === habit.id && item.checkin_date === localDateKey(new Date()) && item.count > 0)).length}/{habits.length}</strong><span>Habits</span></div>
          </Surface>
        </section>
        <div className="dashboard-grid">
          <div className="dashboard-main">
            <TaskListPanel title="Today’s tasks" description="Priorities and deadlines for today" source={todayTasks.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority])} />
            <Surface>
              <div className="section-heading"><div><h2>Habits</h2><p>Small actions, steady momentum</p></div><button className="text-button" type="button" onClick={() => navigate("habits")}>Open tracker <ChevronRight size={14} /></button></div>
              {habits.length ? <div className="mini-habits">{habits.slice(0, 4).map((habit) => {
                const done = checkins.some((item) => item.habit_id === habit.id && item.checkin_date === localDateKey(new Date()) && item.count > 0);
                return <button type="button" className={done ? "done" : ""} onClick={() => void toggleHabitToday(habit)} key={habit.id}><span style={{ background: habit.color }}>{done ? <Check size={13} /> : <Circle size={13} />}</span><strong>{habit.name}</strong><small>{getHabitStreak(habit.id, checkins)} day streak</small></button>;
              })}</div> : <EmptyState icon={<Target size={20} />} title="No habits yet" description="Create a habit to start building a streak." action={<button className="secondary-button" type="button" onClick={() => navigate("habits")}><Plus size={15} /> Add habit</button>} />}
            </Surface>
          </div>
          <div className="dashboard-side">
            <Surface>
              <div className="section-heading"><div><h2>Countdowns</h2><p>Birthdays and important days</p></div><button className="icon-button ghost" type="button" onClick={() => navigate("countdowns")} aria-label="Open countdowns"><CalendarRange size={17} /></button></div>
              {upcomingCountdowns.length ? <div className="countdown-list">{upcomingCountdowns.map((countdown) => {
                const days = getCountdownDays(countdown);
                const nextDate = getNextCountdownDate(countdown);
                return <button type="button" onClick={() => openCountdownEditor(countdown)} key={countdown.id}><span style={{ background: `${countdown.color}18`, color: countdown.color }}><strong>{days}</strong><small>{days === 1 ? "day" : "days"}</small></span><div><b>{countdown.title}</b><small>{nextDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: nextDate.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })}{countdown.repeats_yearly ? " · yearly" : ""}</small></div></button>;
              })}</div> : <EmptyState icon={<CalendarDays size={19} />} title="No important dates" description="Track birthdays, anniversaries, holidays, and New Year." action={<button className="secondary-button" type="button" onClick={() => navigate("countdowns")}><Plus size={15} /> Add a date</button>} />}
            </Surface>
            <Surface>
              <div className="section-heading"><div><h2>Reminders</h2><p>{dueReminders.length ? "Needs your attention" : "Nothing needs attention"}</p></div><Bell size={17} /></div>
              {dueReminders.length ? <div className="reminder-mini-list">{dueReminders.slice(0, 3).map((reminder) => <button type="button" onClick={() => void acknowledgeReminder(reminder)} key={reminder.id}><span className="reminder-dot" /><div><strong>{taskById.get(reminder.task_id)?.title}</strong><small>Tap to acknowledge</small></div></button>)}</div> : <EmptyState icon={<CheckCircle2 size={19} />} title="All caught up" description="Due reminders will appear here." />}
            </Surface>
            <Surface className="pinned-card">
              <div className="section-heading"><div><h2>Pinned note</h2></div><Pin size={17} /></div>
              {pinned ? <button className="pinned-note" type="button" onClick={() => { selectNote(pinned); navigate("notes"); }}><strong>{pinned.title || "Untitled note"}</strong><p>{pinned.body || "No additional text"}</p></button> : <EmptyState icon={<NotebookPen size={19} />} title="No pinned note" description="Pin a note to keep it close." />}
            </Surface>
          </div>
        </div>
      </div>
    );
  }

  function renderListView() {
    return (
      <div className="view-stack">
        <QuickAdd />
        <div className="list-toolbar surface">
          <div className="toolbar-group"><ListFilter size={16} /><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} aria-label="Sort tasks"><option value="manual">Manual order</option><option value="due">Due date</option><option value="priority">Priority</option><option value="created">Newest first</option></select></div>
          <div className="toolbar-group"><TagIcon size={16} /><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} aria-label="Filter by tag"><option value="all">All tags</option>{allTags.map((tag) => <option value={tag} key={tag}>#{tag}</option>)}</select></div>
          <label className="toggle-label"><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /><span>Show completed</span></label>
          <span className="toolbar-count">{filteredTasks.length} tasks</span>
        </div>
        <TaskListPanel title={activeTitle()} description="Drag to reorder, or open a task for full details" />
      </div>
    );
  }

  function renderCountdowns() {
    const nextNewYear = new Date(new Date().getFullYear() + 1, 0, 1);
    const today = new Date();
    const daysToNewYear = Math.round((Date.UTC(nextNewYear.getFullYear(), 0, 1) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
    const presets: Array<{ label: string; description: string; draft: Partial<CountdownDraft> }> = [
      { label: "Birthday", description: "Repeats every year", draft: { title: "Birthday", category: "birthday", repeatsYearly: true, color: "#ef5b7a" } },
      { label: "New Year", description: `${daysToNewYear} days away`, draft: { title: "New Year", targetDate: localDateKey(nextNewYear), category: "holiday", repeatsYearly: true, color: "#3478f6" } },
      { label: "Anniversary", description: "Remember a special date", draft: { title: "Anniversary", category: "anniversary", repeatsYearly: true, color: "#a868c3" } },
    ];
    return (
      <div className="view-stack">
        <section className="countdown-hero surface">
          <div><span className="eyebrow">IMPORTANT DAYS</span><h2>Always know what is coming</h2><p>Count down to birthdays, anniversaries, holidays, trips, launches, and the next New Year.</p></div>
          <button className="primary-button" type="button" onClick={() => openCountdownEditor()}><Plus size={16} /> Add important date</button>
        </section>
        <div className="countdown-presets">{presets.map((preset) => <button type="button" onClick={() => openCountdownEditor(undefined, preset.draft)} key={preset.label}><CalendarRange size={17} /><span><strong>{preset.label}</strong><small>{preset.description}</small></span><ChevronRight size={15} /></button>)}</div>
        {sortedCountdowns.length ? <div className="countdown-cards">{sortedCountdowns.map((countdown) => {
          const days = getCountdownDays(countdown);
          const nextDate = getNextCountdownDate(countdown);
          const passed = days < 0;
          return <Surface className={`countdown-card ${passed ? "passed" : ""}`} key={countdown.id}>
            <div className="countdown-date-tile" style={{ background: `${countdown.color}18`, color: countdown.color }}><strong>{nextDate.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}</strong><span>{nextDate.getDate()}</span></div>
            <div className="countdown-card-copy"><span className="countdown-category">{countdown.category}</span><h3>{countdown.title}</h3><p>{countdown.notes || (countdown.repeats_yearly ? "This important day repeats every year." : "A one-time important date.")}</p><small>{nextDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}{countdown.repeats_yearly ? " · repeats yearly" : ""}</small></div>
            <div className="countdown-days" style={{ color: passed ? undefined : countdown.color }}><strong>{Math.abs(days)}</strong><span>{passed ? `${Math.abs(days) === 1 ? "day" : "days"} ago` : days === 0 ? "today" : `${days === 1 ? "day" : "days"} to go`}</span></div>
            <button className="icon-button ghost" type="button" onClick={() => openCountdownEditor(countdown)} aria-label={`Edit ${countdown.title}`}><Edit3 size={16} /></button>
          </Surface>;
        })}</div> : <Surface><EmptyState icon={<CalendarRange size={22} />} title="No important dates yet" description="Add a birthday, annual celebration, or one-time milestone. Nothing is created until you choose it." action={<button className="primary-button" type="button" onClick={() => openCountdownEditor()}><Plus size={15} /> Add your first date</button>} /></Surface>}
      </div>
    );
  }

  function renderCalendar() {
    const monthDays = getMonthDays(calendarCursor);
    const weekStart = startOfWeek(calendarCursor, preferences.week_starts_on);
    const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
    const shownDays = calendarMode === "day" ? [calendarCursor] : weekDays;
    const googleConfigured = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID);
    function moveCalendar(amount: number) {
      const next = new Date(calendarCursor);
      if (calendarMode === "month") next.setMonth(next.getMonth() + amount);
      else next.setDate(next.getDate() + amount * (calendarMode === "week" ? 7 : 1));
      setCalendarCursor(next);
    }
    function openGoogleEvent(event: GoogleCalendarEvent) {
      if (event.htmlLink) window.open(event.htmlLink, "_blank", "noopener,noreferrer");
    }
    function dropOnDay(day: Date) {
      if (draggedGoogleEventId) {
        void moveGoogleEvent(draggedGoogleEventId, day);
        return;
      }
      if (!draggedTaskId) return;
      const task = taskById.get(draggedTaskId);
      if (!task) return;
      const due = task.due_at ? new Date(task.due_at) : new Date();
      due.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
      void updateTaskFields(task.id, { due_at: due.toISOString() }, "Task rescheduled.");
    }
    return (
      <div className="view-stack">
        <div className="calendar-toolbar surface">
          <div className="calendar-nav"><button className="icon-button" type="button" onClick={() => moveCalendar(-1)}><ChevronLeft size={17} /></button><button className="secondary-button" type="button" onClick={() => setCalendarCursor(new Date())}>Today</button><button className="icon-button" type="button" onClick={() => moveCalendar(1)}><ChevronRight size={17} /></button></div>
          <strong>{calendarMode === "month" ? calendarCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : dateRangeLabel(shownDays[0], shownDays[shownDays.length - 1])}</strong>
          <div className="segmented-control">{(["day", "week", "month", "agenda"] as const).map((mode) => <button className={calendarMode === mode ? "active" : ""} type="button" onClick={() => setCalendarMode(mode)} key={mode}>{mode}</button>)}</div>
        </div>
        <div className={`google-calendar-bar surface ${googleAccessToken ? "connected" : ""}`}>
          <span className="google-calendar-mark">G</span>
          <div><strong>{googleAccessToken ? "Google Calendar connected" : "Google Calendar"}</strong><small>{googleAccessToken ? (googleCalendarLoading ? "Syncing events…" : `${googleEvents.length} events in this view`) : googleConfigured ? "Connect to show and create events in your primary calendar." : "Add your Google OAuth client ID to enable the API."}</small>{googleCalendarError ? <p>{googleCalendarError}</p> : null}</div>
          {googleAccessToken ? <div className="google-calendar-actions"><button className="primary-button" type="button" onClick={() => openGoogleEventEditor()}><Plus size={15} /> Google event</button><button className="icon-button" type="button" onClick={() => void refreshGoogleCalendar()} aria-label="Refresh Google Calendar"><RotateCcw size={15} /></button><button className="secondary-button" type="button" onClick={disconnectGoogleCalendar}>Disconnect</button></div> : <button className="primary-button" type="button" onClick={connectGoogleCalendar} disabled={!googleScriptReady && googleConfigured}>Connect Google Calendar</button>}
        </div>
        {calendarMode === "month" ? (
          <Surface className="calendar-surface">
            <div className="month-weekdays">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="month-grid">{monthDays.map((day) => {
              const dayTasks = tasks.filter((task) => task.due_at && isSameDay(day, new Date(task.due_at)));
              const dayGoogleEvents = googleEvents.filter((event) => isSameDay(day, googleEventStart(event)));
              const outside = day.getMonth() !== calendarCursor.getMonth();
              const visibleTaskCount = Math.min(2, dayTasks.length);
              const visibleGoogleCount = Math.max(0, 3 - visibleTaskCount);
              const hiddenCount = Math.max(0, dayTasks.length + dayGoogleEvents.length - visibleTaskCount - Math.min(visibleGoogleCount, dayGoogleEvents.length));
              return <div className={`month-day ${outside ? "outside" : ""} ${isSameDay(day, new Date()) ? "today" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={() => dropOnDay(day)} key={day.toISOString()}><button type="button" onClick={() => { setCalendarCursor(day); setCalendarMode("day"); }}>{day.getDate()}</button><div>{dayTasks.slice(0, visibleTaskCount).map((task) => <button draggable onDragStart={() => setDraggedTaskId(task.id)} onDragEnd={() => setDraggedTaskId(null)} type="button" onClick={() => openTaskEditor(task)} className={`calendar-task priority-line-${task.priority}`} key={task.id}><span>{formatDue(task.due_at, false)}</span>{task.title}</button>)}{dayGoogleEvents.slice(0, visibleGoogleCount).map((event) => <button className="calendar-google-event" draggable onDragStart={() => setDraggedGoogleEventId(event.id)} onDragEnd={() => setDraggedGoogleEventId(null)} type="button" onClick={() => openGoogleEvent(event)} key={event.id}><span>G</span>{event.summary || "Untitled event"}</button>)}{hiddenCount ? <small>+{hiddenCount} more</small> : null}</div></div>;
            })}</div>
          </Surface>
        ) : (
          <Surface>
            <div className="day-columns">{(calendarMode === "agenda" ? Array.from({ length: 14 }, (_, index) => addDays(startOfDay(), index)) : shownDays).map((day) => {
              const dayTasks = tasks.filter((task) => task.due_at && isSameDay(day, new Date(task.due_at))).sort((a, b) => new Date(a.due_at!).getTime() - new Date(b.due_at!).getTime());
              const dayGoogleEvents = googleEvents.filter((event) => isSameDay(day, googleEventStart(event))).sort((first, second) => googleEventStart(first).getTime() - googleEventStart(second).getTime());
              return <section className="day-column" onDragOver={(event) => event.preventDefault()} onDrop={() => dropOnDay(day)} key={day.toISOString()}><header><span>{day.toLocaleDateString(undefined, { weekday: "short" })}</span><strong>{day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</strong></header><div className="day-column-content">{dayTasks.map((task) => <TaskRow compact task={task} key={task.id} />)}{dayGoogleEvents.map((event) => <button className="google-event-row" draggable onDragStart={() => setDraggedGoogleEventId(event.id)} onDragEnd={() => setDraggedGoogleEventId(null)} type="button" onClick={() => openGoogleEvent(event)} key={event.id}><span className="google-event-mark">G</span><div><strong>{event.summary || "Untitled event"}</strong><small>{googleEventTimeLabel(event)}{event.location ? ` · ${event.location}` : ""}</small></div><ChevronRight size={15} /></button>)}{!dayTasks.length && !dayGoogleEvents.length ? <span className="day-empty">No tasks or events</span> : null}</div></section>;
            })}</div>
          </Surface>
        )}
      </div>
    );
  }

  function renderKanban() {
    return (
      <div className="view-stack">
        <div className="view-actions"><p>Drag tasks between your custom status columns.</p><button className="secondary-button" type="button" onClick={() => { setCollectionName(""); setCollectionDialog({ type: "status" }); }}><Plus size={15} /> Add column</button></div>
        <div className="kanban-board">{statuses.map((status) => {
          const columnTasks = filteredTasks.filter((task) => task.status_id === status.id || (!task.status_id && status.id === defaultStatusId));
          return <section className="kanban-column" onDragOver={(event) => event.preventDefault()} onDrop={() => { if (!draggedTaskId) return; void updateTaskFields(draggedTaskId, { status_id: status.id, completed_at: status.is_done ? new Date().toISOString() : null }, `Moved to ${status.name}.`); }} key={status.id}><header><span className="status-dot" style={{ background: status.color }} /><strong>{status.name}</strong><small>{columnTasks.length}</small><MoreHorizontal size={16} /></header><div className="kanban-cards">{columnTasks.map((task) => <article className="kanban-card" draggable onDragStart={() => setDraggedTaskId(task.id)} onDragEnd={() => setDraggedTaskId(null)} key={task.id}><button type="button" onClick={() => openTaskEditor(task)}><span className="kanban-card-top"><PriorityBadge priority={task.priority} />{task.due_at ? <small className={isOverdue(task) ? "overdue-text" : ""}><Clock3 size={12} />{formatDue(task.due_at)}</small> : null}</span><strong>{task.title}</strong>{task.notes ? <p>{task.notes}</p> : null}<span className="kanban-tags">{task.tags.map((tag) => <small key={tag}>#{tag}</small>)}</span></button></article>)}{!columnTasks.length ? <div className="kanban-empty">Drop tasks here</div> : null}</div></section>;
        })}<button className="kanban-add-column" type="button" onClick={() => setCollectionDialog({ type: "status" })}><Plus size={17} /> Add column</button></div>
      </div>
    );
  }

  function renderTimeline() {
    const rangeStart = addDays(startOfDay(), -2);
    const rangeDays = Array.from({ length: 21 }, (_, index) => addDays(rangeStart, index));
    const rangeEnd = addDays(rangeStart, 21);
    const timelineTasks = filteredTasks.filter((task) => task.due_at && new Date(task.due_at) >= rangeStart && new Date(task.start_at ?? task.due_at) <= rangeEnd);
    return (
      <div className="view-stack">
        <div className="view-actions"><p>Task ranges across the next three weeks.</p><span className="count-pill">{timelineTasks.length} dated</span></div>
        <Surface className="timeline-surface">
          <div className="timeline-header"><span>Task</span><div>{rangeDays.map((day) => <span className={isSameDay(day, new Date()) ? "today" : ""} key={day.toISOString()}><small>{day.toLocaleDateString(undefined, { weekday: "narrow" })}</small><strong>{day.getDate()}</strong></span>)}</div></div>
          {timelineTasks.length ? <div className="timeline-rows">{timelineTasks.map((task) => {
            const start = new Date(task.start_at ?? task.due_at!);
            const end = new Date(task.due_at!);
            const left = Math.max(0, ((startOfDay(start).getTime() - rangeStart.getTime()) / (21 * 86_400_000)) * 100);
            const width = Math.max(4.75, ((Math.max(end.getTime(), start.getTime()) - startOfDay(start).getTime() + 86_400_000) / (21 * 86_400_000)) * 100);
            return <div className="timeline-row" key={task.id}><button type="button" onClick={() => openTaskEditor(task)}><strong>{task.title}</strong><small>{listById.get(task.list_id ?? 0)?.name ?? "Unlisted"}</small></button><div className="timeline-track"><button type="button" onClick={() => openTaskEditor(task)} className={`timeline-bar priority-bg-${task.priority}`} style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}>{task.estimated_minutes ? `${task.estimated_minutes}m` : ""}</button></div></div>;
          })}</div> : <EmptyState icon={<CalendarRange size={20} />} title="No tasks in this range" description="Add start and due dates to see a task on the timeline." />}
        </Surface>
      </div>
    );
  }

  function renderMatrix() {
    const quadrants = [
      { roman: "I", title: "Urgent & Important", urgent: true, important: true, tone: "rose" },
      { roman: "II", title: "Not Urgent & Important", urgent: false, important: true, tone: "amber" },
      { roman: "III", title: "Urgent & Unimportant", urgent: true, important: false, tone: "blue" },
      { roman: "IV", title: "Not Urgent & Unimportant", urgent: false, important: false, tone: "green" },
    ];
    return <div className="matrix-shell"><div className="matrix-grid">{quadrants.map((quadrant) => {
      const quadrantTasks = filteredTasks.filter((task) => task.is_urgent === quadrant.urgent && task.is_important === quadrant.important);
      return <section className={`matrix-quadrant tone-${quadrant.tone}`} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedTaskId) void updateTaskFields(draggedTaskId, { is_urgent: quadrant.urgent, is_important: quadrant.important }, `Moved to ${quadrant.title}.`); }} key={quadrant.roman}><header><span className="matrix-roman">{quadrant.roman}</span><strong title={quadrant.title}>{quadrant.title}</strong></header><div className="matrix-task-list">{quadrantTasks.map((task) => <article className={task.completed_at ? "completed" : ""} draggable onDragStart={() => setDraggedTaskId(task.id)} onDragEnd={() => setDraggedTaskId(null)} key={task.id}><button className={`matrix-check ${task.completed_at ? "checked" : ""}`} type="button" onClick={() => void toggleTask(task)} aria-label={task.completed_at ? "Mark incomplete" : "Mark complete"}>{task.completed_at ? <Check size={13} /> : null}</button><button className="matrix-task-copy" type="button" onClick={() => openTaskEditor(task)}><strong>{task.title}</strong><span>{task.due_at ? new Date(task.due_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "No date"}</span></button></article>)}{!quadrantTasks.length ? <div className="matrix-empty">No Tasks</div> : null}</div></section>;
    })}</div><button className="matrix-floating-add" type="button" onClick={() => openTaskEditor()} aria-label="Add task"><Plus size={30} /></button></div>;
  }

  function renderHabits() {
    const heatmapDays = Array.from({ length: 42 }, (_, index) => addDays(startOfDay(), index - 41));
    return (
      <div className="view-stack">
        <div className="view-actions"><p>Check in once a day and watch your consistency grow.</p><button className="primary-button" type="button" onClick={() => setShowHabitForm((open) => !open)}><Plus size={15} /> New habit</button></div>
        {showHabitForm ? <form className="inline-create surface" onSubmit={createHabit}><label><span>Habit name</span><input value={habitName} onChange={(event) => setHabitName(event.target.value)} placeholder="What do you want to repeat?" autoFocus required /></label><label><span>Frequency</span><select value={habitFrequency} onChange={(event) => setHabitFrequency(event.target.value as typeof habitFrequency)}><option value="daily">Daily</option><option value="weekly">N times per week</option><option value="custom">Custom</option></select></label><label><span>Target</span><input type="number" min="1" max="21" value={habitTarget} onChange={(event) => setHabitTarget(Number(event.target.value))} /></label><button className="primary-button" type="submit">Create habit</button></form> : null}
        {habits.length ? <div className="habit-cards">{habits.map((habit) => {
          const todayDone = checkins.some((item) => item.habit_id === habit.id && item.checkin_date === localDateKey(new Date()) && item.count > 0);
          return <Surface className="habit-card" key={habit.id}><div className="habit-card-top"><span className="habit-color" style={{ background: habit.color }}><Target size={18} /></span><div><h3>{habit.name}</h3><p>{habit.frequency_type === "daily" ? "Every day" : `${habit.target_count}× per week`}</p></div><span className="streak-badge"><Flame size={14} /> {getHabitStreak(habit.id, checkins)} days</span><button className="icon-button ghost" type="button" onClick={() => void archiveHabit(habit)} aria-label="Archive habit"><Archive size={15} /></button></div><div className="heatmap" aria-label={`${habit.name} check-in history`}>{heatmapDays.map((day) => {
            const count = checkins.find((item) => item.habit_id === habit.id && item.checkin_date === localDateKey(day))?.count ?? 0;
            return <span className={count ? "filled" : ""} style={count ? { background: habit.color } : undefined} title={`${localDateKey(day)}: ${count ? "done" : "not done"}`} key={day.toISOString()} />;
          })}</div><button className={`habit-check-button ${todayDone ? "done" : ""}`} type="button" onClick={() => void toggleHabitToday(habit)}>{todayDone ? <><CheckCircle2 size={17} /> Completed today</> : <><Circle size={17} /> Check in for today</>}</button></Surface>;
        })}</div> : <Surface><EmptyState icon={<Target size={22} />} title="Build your first streak" description="Create a habit with a daily or weekly target. Your tracker starts empty." action={<button className="primary-button" type="button" onClick={() => setShowHabitForm(true)}><Plus size={15} /> Create habit</button>} /></Surface>}
      </div>
    );
  }

  function renderFocus() {
    const minutes = String(Math.floor(focusSeconds / 60)).padStart(2, "0");
    const seconds = String(focusSeconds % 60).padStart(2, "0");
    const progress = Math.max(0, Math.min(100, (1 - focusSeconds / Math.max(1, focusDuration * 60)) * 100));
    const todayMinutes = focusSessions.filter((item) => isSameDay(new Date(item.started_at), new Date()) && item.session_type === "work").reduce((total, item) => total + item.duration_minutes, 0);
    const weekStart = startOfWeek(new Date(), preferences.week_starts_on);
    const weekMinutes = focusSessions.filter((item) => new Date(item.started_at) >= weekStart && item.session_type === "work").reduce((total, item) => total + item.duration_minutes, 0);
    return <div className="focus-layout"><Surface className="focus-timer-card"><div className="focus-modes">{(["work", "short_break", "long_break"] as FocusMode[]).map((mode) => <button className={focusMode === mode ? "active" : ""} type="button" onClick={() => chooseFocusMode(mode)} key={mode}>{mode === "work" ? "Focus" : mode === "short_break" ? "Short break" : "Long break"}</button>)}</div><div className="timer-ring" style={{ background: `conic-gradient(var(--teal) ${progress}%, var(--surface-soft) ${progress}% 100%)` }}><div><span>{minutes}:{seconds}</span><small>{focusMode === "work" ? "time to focus" : "time to recharge"}</small></div></div><label className="focus-task-select"><span>Linked task</span><select value={focusTaskId ?? ""} onChange={(event) => setFocusTaskId(event.target.value ? Number(event.target.value) : null)} disabled={focusRunning}><option value="">No linked task</option>{tasks.filter((task) => !task.completed_at).map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select></label><div className="timer-actions"><button className="timer-reset" type="button" onClick={() => { setFocusRunning(false); setFocusStartedAt(null); setFocusSeconds(focusDuration * 60); }}><RotateCcw size={17} /></button><button className="timer-play" type="button" onClick={toggleFocus}>{focusRunning ? <Pause size={23} /> : <Play size={23} />}{focusRunning ? "Pause" : focusStartedAt ? "Resume" : "Start"}</button><button className="timer-reset" type="button" onClick={() => void completeFocusSession(false)}><Check size={17} /></button></div></Surface><div className="focus-side"><Surface><div className="section-heading"><div><h2>Focus stats</h2><p>Completed work sessions</p></div><Zap size={17} /></div><div className="focus-stats"><div><strong>{todayMinutes}</strong><span>minutes today</span></div><div><strong>{weekMinutes}</strong><span>minutes this week</span></div><div><strong>{focusSessions.filter((item) => item.is_completed).length}</strong><span>sessions finished</span></div></div></Surface><Surface><div className="section-heading"><div><h2>Timer settings</h2><p>Minutes per session</p></div><Settings2 size={17} /></div><form className="timer-settings" onSubmit={savePreferences}><label><span>Focus</span><input type="number" min="5" max="120" value={preferences.work_minutes} onChange={(event) => setPreferences((current) => ({ ...current, work_minutes: Number(event.target.value) }))} /></label><label><span>Short break</span><input type="number" min="1" max="60" value={preferences.short_break_minutes} onChange={(event) => setPreferences((current) => ({ ...current, short_break_minutes: Number(event.target.value) }))} /></label><label><span>Long break</span><input type="number" min="5" max="120" value={preferences.long_break_minutes} onChange={(event) => setPreferences((current) => ({ ...current, long_break_minutes: Number(event.target.value) }))} /></label><button className="secondary-button" type="submit">Save settings</button></form></Surface><Surface><div className="section-heading"><div><h2>Recent sessions</h2></div></div>{focusSessions.length ? <div className="session-list">{focusSessions.slice(0, 5).map((item) => <div key={item.id}><span className="session-icon"><Timer size={15} /></span><div><strong>{taskById.get(item.task_id ?? 0)?.title ?? "Unlinked focus"}</strong><small>{new Date(item.started_at).toLocaleDateString()} · {item.duration_minutes} min</small></div><CheckCircle2 size={15} /></div>)}</div> : <EmptyState icon={<Timer size={19} />} title="No focus history" description="Complete a focus session to start your stats." />}</Surface></div></div>;
  }

  function renderNotes() {
    return <div className="notes-layout"><Surface className="notes-list-panel"><div className="section-heading"><div><h2>All notes</h2><p>{notes.length} saved</p></div><button className="icon-button" type="button" onClick={() => selectNote(null)}><Plus size={16} /></button></div>{notes.length ? <div className="notes-list">{notes.map((note) => <button className={selectedNoteId === note.id ? "active" : ""} type="button" onClick={() => selectNote(note)} key={note.id}>{note.is_pinned ? <Pin size={13} /> : <NotebookPen size={13} />}<div><strong>{note.title || "Untitled note"}</strong><p>{note.body || "Empty note"}</p><small>{new Date(note.updated_at).toLocaleDateString()}</small></div></button>)}</div> : <EmptyState icon={<NotebookPen size={20} />} title="No notes yet" description="Create a standalone note or attach one to a task." />}</Surface><Surface className="note-editor-panel"><form onSubmit={saveNote}><div className="note-editor-toolbar"><span>{selectedNoteId ? "Editing note" : "New note"}</span><div><label className="pin-toggle"><input type="checkbox" checked={notePinned} onChange={(event) => setNotePinned(event.target.checked)} /><Pin size={15} /> Pin</label>{selectedNoteId ? <button className="icon-button danger" type="button" onClick={() => void deleteNote()}><Trash2 size={15} /></button> : null}</div></div><input className="note-title-input" value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Note title" /><textarea className="note-body-input" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Write anything worth keeping..." /><div className="note-editor-footer"><label><span>Attach to task</span><select value={noteTaskId ?? ""} onChange={(event) => setNoteTaskId(event.target.value ? Number(event.target.value) : null)}><option value="">Standalone note</option>{tasks.map((task) => <option value={task.id} key={task.id}>{task.title}</option>)}</select></label><button className="primary-button" type="submit" disabled={!noteTitle.trim() && !noteBody.trim()}>Save note</button></div></form></Surface></div>;
  }

  function renderReminders() {
    const upcoming = reminders.filter((item) => !item.acknowledged_at).sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime());
    return <div className="view-stack"><div className="view-actions"><p>Task reminders stay visible until you acknowledge them.</p><button className="secondary-button" type="button" onClick={() => void enableNotifications()}><Bell size={15} /> Enable browser alerts</button></div><Surface><div className="section-heading"><div><h2>Active reminders</h2><p>Persistent reminders repeat every five minutes while DayToDay is open.</p></div><span className="count-pill">{upcoming.length}</span></div>{upcoming.length ? <div className="reminders-list">{upcoming.map((reminder) => { const task = taskById.get(reminder.task_id); const due = new Date(reminder.remind_at).getTime() <= nowTick; return <article className={due ? "due" : ""} key={reminder.id}><span className="reminder-bell"><Bell size={17} /></span><button type="button" onClick={() => task && openTaskEditor(task)}><strong>{task?.title ?? "Deleted task"}</strong><small>{new Date(reminder.remind_at).toLocaleString()} {reminder.persistent ? "· persistent" : ""}</small></button><button className="secondary-button" type="button" onClick={() => void acknowledgeReminder(reminder)}>{due ? "Acknowledge" : "Dismiss"}</button></article>; })}</div> : <EmptyState icon={<Bell size={20} />} title="No active reminders" description="Add one or more reminder times inside a task." />}</Surface></div>;
  }

  function renderReflection() {
    const moods = [{ value: 1, emoji: "😞", label: "Difficult" }, { value: 2, emoji: "😕", label: "Low" }, { value: 3, emoji: "🙂", label: "Okay" }, { value: 4, emoji: "😊", label: "Good" }, { value: 5, emoji: "🤩", label: "Great" }];
    return <div className="reflection-layout"><Surface className="reflection-card"><div className="section-heading"><div><h2>Close the loop on today</h2><p>A private check-in for {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p></div><Heart size={18} /></div><form onSubmit={saveReflection}><fieldset><legend>How are you feeling?</legend><div className="mood-grid">{moods.map((mood) => <button className={reflectionMood === mood.value ? "selected" : ""} type="button" onClick={() => setReflectionMood(mood.value)} key={mood.value}><span>{mood.emoji}</span><small>{mood.label}</small></button>)}</div></fieldset><label><span>Short journal entry</span><textarea value={reflectionJournal} onChange={(event) => setReflectionJournal(event.target.value)} placeholder="What is on your mind?" rows={7} /></label><label><span>Best thing today</span><input value={reflectionBest} onChange={(event) => setReflectionBest(event.target.value)} placeholder="One bright spot is enough" /></label><button className="primary-button" type="submit">Save reflection</button></form></Surface><Surface><div className="section-heading"><div><h2>Recent check-ins</h2><p>Your last seven reflections</p></div><BookOpen size={17} /></div>{reflections.length ? <div className="reflection-history">{reflections.slice(0, 7).map((item) => <div key={item.id}><span>{moods.find((mood) => mood.value === item.mood)?.emoji ?? "•"}</span><div><strong>{new Date(`${item.reflection_date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}</strong><p>{item.best_thing || item.journal || "Reflection saved"}</p></div></div>)}</div> : <EmptyState icon={<Heart size={19} />} title="No reflections yet" description="Your saved daily check-ins will appear here." />}</Surface></div>;
  }

  function renderActiveView() {
    if (activeView === "today") return renderToday();
    if (activeView === "calendar") return renderCalendar();
    if (activeView === "kanban") return renderKanban();
    if (activeView === "timeline") return renderTimeline();
    if (activeView === "matrix") return renderMatrix();
    if (activeView === "countdowns") return renderCountdowns();
    if (activeView === "habits") return renderHabits();
    if (activeView === "focus") return renderFocus();
    if (activeView === "notes") return renderNotes();
    if (activeView === "reminders") return renderReminders();
    if (activeView === "reflection") return renderReflection();
    return renderListView();
  }

  if (dataLoading) {
    return <main className="workspace-loading"><span className="brand-mark"><SunMedium size={18} /></span><strong>Loading your workspace</strong><p>Bringing your lists, tasks, notes, and habits together...</p></main>;
  }

  const primaryNav = [
    { id: "today", label: "Today", icon: House },
    { id: "inbox", label: "Inbox", icon: Inbox, count: tasks.filter((task) => task.list_id === defaultListId && !task.completed_at).length },
    { id: "tasks", label: "All tasks", icon: ListTodo },
  ];
  const smartNav = [
    { id: "smart-today", label: "Today", icon: SunMedium, count: tasks.filter((task) => task.due_at && isSameDay(new Date(task.due_at), new Date()) && !task.completed_at).length },
    { id: "smart-next", label: "Next 7 days", icon: CalendarRange },
    { id: "smart-overdue", label: "Overdue", icon: Clock3, count: tasks.filter((task) => isOverdue(task)).length },
    { id: "smart-nodate", label: "No date", icon: Archive },
  ];
  const viewNav = [
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "kanban", label: "Kanban", icon: Columns3 },
    { id: "timeline", label: "Timeline", icon: CalendarRange },
    { id: "matrix", label: "Matrix", icon: LayoutDashboard },
  ];
  const toolNav = [
    { id: "countdowns", label: "Countdowns", icon: CalendarRange },
    { id: "habits", label: "Habits", icon: Target },
    { id: "focus", label: "Focus", icon: Timer },
    { id: "notes", label: "Notes", icon: NotebookPen },
    { id: "reminders", label: "Reminders", icon: Bell, count: dueReminders.length },
    { id: "reflection", label: "Reflection", icon: Heart },
  ];

  return (
    <div className="daytoday-shell">
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setGoogleScriptReady(true)} onError={() => setGoogleCalendarError("Google Identity Services could not load.")} />
      <div className={`sidebar-scrim ${sidebarOpen ? "open" : ""}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`app-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="sidebar-brand"><span className="brand-mark"><SunMedium size={18} /></span><div><strong>DayToDay</strong><small>Everything you need, daily.</small></div><button className="icon-button sidebar-close" type="button" onClick={() => setSidebarOpen(false)}><PanelLeftClose size={17} /></button></div>
        <div className="sidebar-scroll">
          <nav className="nav-group" aria-label="Primary">{primaryNav.map((item) => <button className={activeView === item.id ? "active" : ""} type="button" onClick={() => navigate(item.id)} key={item.id}><item.icon size={17} /><span>{item.label}</span>{item.count !== undefined ? <small>{item.count}</small> : null}</button>)}</nav>
          <div className="nav-section"><div className="nav-section-title"><span>Smart lists</span></div><nav className="nav-group">{smartNav.map((item) => <button className={activeView === item.id ? "active" : ""} type="button" onClick={() => navigate(item.id)} key={item.id}><item.icon size={16} /><span>{item.label}</span>{item.count !== undefined ? <small className={item.id === "smart-overdue" && item.count ? "alert" : ""}>{item.count}</small> : null}</button>)}</nav></div>
          <div className="nav-section"><div className="nav-section-title"><span>Lists</span><div><button type="button" onClick={() => setCollectionDialog({ type: "folder" })} aria-label="New folder"><FolderPlus size={14} /></button><button type="button" onClick={() => setCollectionDialog({ type: "list", folderId: null })} aria-label="New list"><Plus size={14} /></button></div></div>{folders.map((folder) => <div className="folder-group" key={folder.id}><div className="folder-label"><ChevronDown size={13} /><Folder size={14} /><span>{folder.name}</span><button type="button" onClick={() => setCollectionDialog({ type: "list", folderId: folder.id })}><Plus size={13} /></button></div><nav className="nav-group nested">{lists.filter((list) => list.folder_id === folder.id).map((list) => <button className={activeView === `list:${list.id}` ? "active" : ""} type="button" onClick={() => navigate(`list:${list.id}`)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedTaskId) void updateTaskFields(draggedTaskId, { list_id: list.id }, `Moved to ${list.name}.`); }} key={list.id}><span className="list-color" style={{ background: list.color }} /><span>{list.name}</span><small>{tasks.filter((task) => task.list_id === list.id && !task.completed_at).length}</small></button>)}</nav></div>)}<nav className="nav-group">{lists.filter((list) => !list.folder_id).map((list) => <button className={activeView === `list:${list.id}` ? "active" : ""} type="button" onClick={() => navigate(`list:${list.id}`)} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggedTaskId) void updateTaskFields(draggedTaskId, { list_id: list.id }, `Moved to ${list.name}.`); }} key={list.id}><span className="list-color" style={{ background: list.color }} /><span>{list.name}</span><small>{tasks.filter((task) => task.list_id === list.id && !task.completed_at).length}</small></button>)}</nav></div>
          <div className="nav-section"><div className="nav-section-title"><span>Views</span></div><nav className="nav-group">{viewNav.map((item) => <button className={activeView === item.id ? "active" : ""} type="button" onClick={() => navigate(item.id)} key={item.id}><item.icon size={16} /><span>{item.label}</span></button>)}</nav></div>
          <div className="nav-section"><div className="nav-section-title"><span>Tools</span></div><nav className="nav-group">{toolNav.map((item) => <button className={activeView === item.id ? "active" : ""} type="button" onClick={() => navigate(item.id)} key={item.id}><item.icon size={16} /><span>{item.label}</span>{item.count ? <small className="alert">{item.count}</small> : null}</button>)}</nav></div>
        </div>
        <div className="sidebar-account"><div className="avatar">{displayName.charAt(0).toUpperCase()}</div><div><strong>{displayName}</strong><small>{preview ? "Preview workspace" : session?.user.email}</small></div><button className="icon-button ghost" type="button" onClick={() => void onSignOut()} aria-label={preview ? "Exit preview" : "Log out"}><LogOut size={16} /></button></div>
      </aside>

      <main className="app-main">
        <header className="app-topbar">
          <button className="icon-button mobile-menu" type="button" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>
          <div className="page-title"><span className="eyebrow"><span /> WORKSPACE</span><h1>{activeTitle()}</h1></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} type="search" placeholder="Search tasks, notes, and events" />{search ? <button type="button" onClick={() => setSearch("")}><X size={14} /></button> : <kbd>⌘ K</kbd>}</label>
            <button className={`icon-button notification-button ${dueReminders.length ? "has-alert" : ""}`} type="button" onClick={() => navigate("reminders")} aria-label="Reminders"><Bell size={18} />{dueReminders.length ? <span>{dueReminders.length}</span> : null}</button>
            <button className="primary-button top-add" type="button" onClick={() => openTaskEditor()}><Plus size={16} /> New task</button>
          </div>
          {search && (globalSearchTasks.length || searchNotes.length || searchGoogleEvents.length) ? <div className="search-results"><div><span>Tasks</span>{globalSearchTasks.slice(0, 5).map((task) => <button type="button" onClick={() => { openTaskEditor(task); setSearch(""); }} key={task.id}><CheckCircle2 size={14} /><div><strong>{task.title}</strong><small>{formatDue(task.due_at)}</small></div></button>)}</div>{searchGoogleEvents.length ? <div><span>Google events</span>{searchGoogleEvents.map((event) => <button type="button" onClick={() => { if (event.htmlLink) window.open(event.htmlLink, "_blank", "noopener,noreferrer"); setSearch(""); }} key={event.id}><CalendarDays size={14} /><div><strong>{event.summary || "Untitled event"}</strong><small>{googleEventStart(event).toLocaleString()}</small></div></button>)}</div> : null}{searchNotes.length ? <div><span>Notes</span>{searchNotes.map((note) => <button type="button" onClick={() => { selectNote(note); navigate("notes"); setSearch(""); }} key={note.id}><NotebookPen size={14} /><div><strong>{note.title || "Untitled note"}</strong><small>{note.body.slice(0, 60)}</small></div></button>)}</div> : null}</div> : null}
        </header>
        {preview ? <div className="preview-banner"><GridPreviewIcon /><span>You are previewing an empty workspace. Changes stay in this browser until you exit.</span><button type="button" onClick={() => void onSignOut()}>Exit preview</button></div> : null}
        <div className="app-content">{renderActiveView()}</div>
      </main>

      <nav className="mobile-bottom-nav"><button className={activeView === "today" ? "active" : ""} type="button" onClick={() => navigate("today")}><House size={19} /><span>Today</span></button><button className={activeView === "tasks" ? "active" : ""} type="button" onClick={() => navigate("tasks")}><ListTodo size={19} /><span>Tasks</span></button><button className="mobile-add-button" type="button" onClick={() => openTaskEditor()}><Plus size={22} /></button><button className={activeView === "calendar" ? "active" : ""} type="button" onClick={() => navigate("calendar")}><CalendarDays size={19} /><span>Calendar</span></button><button className={activeView === "focus" ? "active" : ""} type="button" onClick={() => navigate("focus")}><Timer size={19} /><span>Focus</span></button></nav>

      {editorOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}><form className="task-modal" onSubmit={(event) => void saveTask(event)}><header><div><span className="modal-kicker">{editingTaskId ? "EDIT TASK" : "NEW TASK"}</span><h2>{editingTaskId ? "Task details" : "What needs to be done?"}</h2></div><button className="icon-button ghost" type="button" onClick={() => setEditorOpen(false)}><X size={18} /></button></header><div className="task-modal-scroll"><label className="field full"><span>Title</span><input className="large-input" value={taskDraft.title} onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Task title" autoFocus required /></label><label className="field full"><span>Notes</span><textarea value={taskDraft.notes} onChange={(event) => setTaskDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Add context, links, or details" rows={4} /></label><div className="field-grid"><label className="field"><span>List</span><select value={taskDraft.listId ?? ""} onChange={(event) => setTaskDraft((current) => ({ ...current, listId: event.target.value ? Number(event.target.value) : null }))}><option value="">No list</option>{lists.map((list) => <option value={list.id} key={list.id}>{list.name}</option>)}</select></label><label className="field"><span>Status</span><select value={taskDraft.statusId ?? ""} onChange={(event) => setTaskDraft((current) => ({ ...current, statusId: event.target.value ? Number(event.target.value) : null }))}><option value="">No status</option>{statuses.map((status) => <option value={status.id} key={status.id}>{status.name}</option>)}</select></label><label className="field"><span>Start date</span><input type="datetime-local" value={taskDraft.startAt} onChange={(event) => setTaskDraft((current) => ({ ...current, startAt: event.target.value }))} /></label><label className="field"><span>Due date</span><input type="datetime-local" value={taskDraft.dueAt} onChange={(event) => setTaskDraft((current) => ({ ...current, dueAt: event.target.value }))} /></label><label className="field"><span>Priority</span><select value={taskDraft.priority} onChange={(event) => setTaskDraft((current) => ({ ...current, priority: event.target.value as Priority }))}><option value="none">None</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label className="field"><span>Estimate (minutes)</span><input type="number" min="1" max="1440" value={taskDraft.estimate ?? ""} onChange={(event) => setTaskDraft((current) => ({ ...current, estimate: event.target.value ? Number(event.target.value) : null }))} placeholder="25" /></label><label className="field full"><span>Tags</span><input value={tagInput} onChange={(event) => { setTagInput(event.target.value); setTaskDraft((current) => ({ ...current, tags: event.target.value.split(",").map((tag) => tag.trim().replace(/^#/, "").toLowerCase()).filter(Boolean) })); }} placeholder="work, report, finance" /></label><label className="field"><span>Repeat</span><select value={taskDraft.recurrence} onChange={(event) => setTaskDraft((current) => ({ ...current, recurrence: event.target.value as TaskDraft["recurrence"] }))}><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="custom">Custom</option></select></label>{taskDraft.recurrence === "custom" ? <label className="field"><span>Custom rule</span><input value={taskDraft.customRecurrence} onChange={(event) => setTaskDraft((current) => ({ ...current, customRecurrence: event.target.value }))} placeholder="Every 2 weeks on Mon" /></label> : <div />}</div><div className="choice-row"><label><input type="checkbox" checked={taskDraft.important} onChange={(event) => setTaskDraft((current) => ({ ...current, important: event.target.checked }))} /><span><Zap size={15} /> Important</span></label><label><input type="checkbox" checked={taskDraft.urgent} onChange={(event) => setTaskDraft((current) => ({ ...current, urgent: event.target.checked }))} /><span><Clock3 size={15} /> Urgent</span></label></div><div className="modal-section"><div className="modal-section-heading"><div><strong>Reminders</strong><small>Choose multiple times before the due date</small></div></div><div className="reminder-options">{[{ value: 0, label: "At due time" }, { value: 15, label: "15 min before" }, { value: 60, label: "1 hour before" }, { value: 1440, label: "1 day before" }].map((option) => <label className={taskDraft.reminderOffsets.includes(option.value) ? "selected" : ""} key={option.value}><input type="checkbox" checked={taskDraft.reminderOffsets.includes(option.value)} disabled={!taskDraft.dueAt} onChange={() => setTaskDraft((current) => ({ ...current, reminderOffsets: current.reminderOffsets.includes(option.value) ? current.reminderOffsets.filter((value) => value !== option.value) : [...current.reminderOffsets, option.value] }))} />{option.label}</label>)}</div><label className="persistent-toggle"><input type="checkbox" checked={taskDraft.persistentReminder} onChange={(event) => setTaskDraft((current) => ({ ...current, persistentReminder: event.target.checked }))} /><span>Keep reminding me until this task is complete</span></label></div><div className="modal-section"><div className="modal-section-heading"><div><strong>Subtasks</strong><small>Break the task into smaller steps</small></div></div><div className="subtask-composer"><input value={subtaskInput} onChange={(event) => setSubtaskInput(event.target.value)} placeholder="Add a subtask" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); const value = subtaskInput.trim(); if (value) { setTaskDraft((current) => ({ ...current, subtasks: [...current.subtasks, value] })); setSubtaskInput(""); } } }} /><button className="secondary-button" type="button" onClick={() => { const value = subtaskInput.trim(); if (value) { setTaskDraft((current) => ({ ...current, subtasks: [...current.subtasks, value] })); setSubtaskInput(""); } }}><Plus size={14} /> Add</button></div>{taskDraft.subtasks.length ? <div className="draft-subtasks">{taskDraft.subtasks.map((title, index) => <div key={`${title}-${index}`}><CheckCircle2 size={15} /><span>{title}</span><button type="button" onClick={() => setTaskDraft((current) => ({ ...current, subtasks: current.subtasks.filter((_, itemIndex) => itemIndex !== index) }))}><X size={14} /></button></div>)}</div> : null}</div></div><footer>{editingTaskId ? <button className="danger-button" type="button" onClick={() => { const task = taskById.get(editingTaskId); if (task) { setEditorOpen(false); void deleteTask(task); } }}><Trash2 size={15} /> Delete</button> : <span />}<div><button className="secondary-button" type="button" onClick={() => setEditorOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving || !taskDraft.title.trim()}>{saving ? "Saving..." : editingTaskId ? "Save changes" : "Create task"}</button></div></footer></form></div> : null}

      {countdownEditorOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCountdownEditorOpen(false); }}><form className="task-modal compact-modal" onSubmit={(event) => void saveCountdown(event)}><header><div><span className="modal-kicker">{editingCountdownId ? "EDIT IMPORTANT DATE" : "NEW IMPORTANT DATE"}</span><h2>{editingCountdownId ? "Update countdown" : "What are you looking forward to?"}</h2></div><button className="icon-button ghost" type="button" onClick={() => setCountdownEditorOpen(false)}><X size={18} /></button></header><div className="task-modal-scroll"><label className="field full"><span>Name</span><input className="large-input" value={countdownDraft.title} onChange={(event) => setCountdownDraft((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Mom’s birthday or New Year" autoFocus required /></label><div className="field-grid"><label className="field"><span>Date</span><input type="date" value={countdownDraft.targetDate} onChange={(event) => setCountdownDraft((current) => ({ ...current, targetDate: event.target.value }))} required /></label><label className="field"><span>Type</span><select value={countdownDraft.category} onChange={(event) => { const category = event.target.value as CountdownCategory; setCountdownDraft((current) => ({ ...current, category, repeatsYearly: ["birthday", "anniversary", "holiday"].includes(category) ? true : current.repeatsYearly })); }}><option value="birthday">Birthday</option><option value="anniversary">Anniversary</option><option value="holiday">Holiday</option><option value="event">Event</option><option value="other">Other</option></select></label><label className="field"><span>Color</span><input className="color-input" type="color" value={countdownDraft.color} onChange={(event) => setCountdownDraft((current) => ({ ...current, color: event.target.value }))} /></label><label className="field checkbox-field"><span>Repeat</span><label><input type="checkbox" checked={countdownDraft.repeatsYearly} onChange={(event) => setCountdownDraft((current) => ({ ...current, repeatsYearly: event.target.checked }))} /> Every year</label></label></div><label className="field full"><span>Notes</span><textarea value={countdownDraft.notes} onChange={(event) => setCountdownDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Why this day matters" rows={4} maxLength={2000} /></label></div><footer>{editingCountdownId ? <button className="danger-button" type="button" onClick={() => void deleteCountdown()}><Trash2 size={15} /> Delete</button> : <span />}<div><button className="secondary-button" type="button" onClick={() => setCountdownEditorOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving || !countdownDraft.title.trim() || !countdownDraft.targetDate}>{saving ? "Saving…" : "Save countdown"}</button></div></footer></form></div> : null}

      {googleEventEditorOpen ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setGoogleEventEditorOpen(false); }}><form className="task-modal compact-modal" onSubmit={(event) => void saveGoogleEvent(event)}><header><div><span className="modal-kicker">GOOGLE CALENDAR</span><h2>Add an event</h2></div><button className="icon-button ghost" type="button" onClick={() => setGoogleEventEditorOpen(false)}><X size={18} /></button></header><div className="task-modal-scroll"><label className="field full"><span>Event name</span><input className="large-input" value={googleEventDraft.summary} onChange={(event) => setGoogleEventDraft((current) => ({ ...current, summary: event.target.value }))} placeholder="Event title" autoFocus required /></label><label className="persistent-toggle"><input type="checkbox" checked={googleEventDraft.allDay} onChange={(event) => setGoogleEventDraft((current) => event.target.checked ? { ...current, allDay: true, start: current.start.slice(0, 10), end: current.end.slice(0, 10) } : { ...current, allDay: false, start: `${current.start.slice(0, 10)}T09:00`, end: `${current.end.slice(0, 10)}T10:00` })} /><span>All-day event</span></label><div className="field-grid"><label className="field"><span>Starts</span><input type={googleEventDraft.allDay ? "date" : "datetime-local"} value={googleEventDraft.start} onChange={(event) => setGoogleEventDraft((current) => ({ ...current, start: event.target.value }))} required /></label><label className="field"><span>{googleEventDraft.allDay ? "Ends on (inclusive)" : "Ends"}</span><input type={googleEventDraft.allDay ? "date" : "datetime-local"} value={googleEventDraft.end} onChange={(event) => setGoogleEventDraft((current) => ({ ...current, end: event.target.value }))} required /></label><label className="field full"><span>Location</span><input value={googleEventDraft.location} onChange={(event) => setGoogleEventDraft((current) => ({ ...current, location: event.target.value }))} placeholder="Optional location" /></label></div><label className="field full"><span>Description</span><textarea value={googleEventDraft.description} onChange={(event) => setGoogleEventDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Optional details" rows={4} /></label><p className="google-event-note">This event will be created directly in your primary Google Calendar.</p></div><footer><span /><div><button className="secondary-button" type="button" onClick={() => setGoogleEventEditorOpen(false)}>Cancel</button><button className="primary-button" type="submit" disabled={saving || !googleEventDraft.summary.trim()}>{saving ? "Adding…" : "Add to Google Calendar"}</button></div></footer></form></div> : null}

      {collectionDialog ? <div className="modal-backdrop"><form className="small-modal" onSubmit={createCollection}><header><div><span className="modal-kicker">NEW {collectionDialog.type.toUpperCase()}</span><h2>Name your {collectionDialog.type}</h2></div><button className="icon-button ghost" type="button" onClick={() => setCollectionDialog(null)}><X size={17} /></button></header><label className="field"><span>Name</span><input value={collectionName} onChange={(event) => setCollectionName(event.target.value)} placeholder={`${collectionDialog.type} name`} autoFocus required /></label><footer><button className="secondary-button" type="button" onClick={() => setCollectionDialog(null)}>Cancel</button><button className="primary-button" type="submit" disabled={saving || !collectionName.trim()}>Create</button></footer></form></div> : null}
      {toast ? <div className={`toast toast-${toast.tone}`} role="status">{toast.tone === "success" ? <CheckCircle2 size={16} /> : toast.tone === "error" ? <X size={16} /> : <Bell size={16} />}<span>{toast.message}</span></div> : null}
    </div>
  );
}

function GridPreviewIcon() {
  return <LayoutDashboard size={15} />;
}
