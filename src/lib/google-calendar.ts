export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events.owned";

export type GoogleCalendarDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

export type GoogleCalendarEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  status?: string;
  start: GoogleCalendarDateTime;
  end: GoogleCalendarDateTime;
};

export type GoogleCalendarEventDraft = {
  summary: string;
  description: string;
  location: string;
  allDay: boolean;
  start: string;
  end: string;
};

export type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export type GoogleTokenClient = {
  requestAccessToken: (config?: { prompt?: string }) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: GoogleTokenResponse) => void;
            error_callback?: (error: { type?: string; message?: string }) => void;
          }) => GoogleTokenClient;
          revoke: (accessToken: string, callback?: () => void) => void;
        };
      };
    };
  }
}

type GoogleErrorPayload = {
  error?: { message?: string } | string;
  message?: string;
};

async function googleRequest<T>(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let message = `Google Calendar request failed (${response.status}).`;
    try {
      const payload = await response.json() as GoogleErrorPayload;
      if (typeof payload.error === "string") message = payload.error;
      else message = payload.error?.message || payload.message || message;
    } catch {
      // Keep the status-based fallback when Google does not return JSON.
    }
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function listPrimaryGoogleEvents(accessToken: string, timeMin: Date, timeMax: Date) {
  const events: GoogleCalendarEvent[] = [];
  let pageToken = "";

  do {
    const params = new URLSearchParams({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const payload = await googleRequest<{ items?: GoogleCalendarEvent[]; nextPageToken?: string }>(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
      accessToken,
    );
    events.push(...(payload.items ?? []).filter((event) => event.status !== "cancelled"));
    pageToken = payload.nextPageToken ?? "";
  } while (pageToken && events.length < 1000);

  return events;
}

function addDateOnlyDays(value: string, amount: number) {
  const [year, month, day] = value.split("-").map(Number);
  const result = new Date(year, month - 1, day, 12, 0, 0, 0);
  result.setDate(result.getDate() + amount);
  return `${result.getFullYear()}-${String(result.getMonth() + 1).padStart(2, "0")}-${String(result.getDate()).padStart(2, "0")}`;
}

export async function createPrimaryGoogleEvent(accessToken: string, draft: GoogleCalendarEventDraft) {
  const body = draft.allDay
    ? {
        summary: draft.summary.trim(),
        description: draft.description.trim() || undefined,
        location: draft.location.trim() || undefined,
        start: { date: draft.start.slice(0, 10) },
        end: { date: addDateOnlyDays((draft.end || draft.start).slice(0, 10), 1) },
      }
    : {
        summary: draft.summary.trim(),
        description: draft.description.trim() || undefined,
        location: draft.location.trim() || undefined,
        start: { dateTime: new Date(draft.start).toISOString() },
        end: { dateTime: new Date(draft.end).toISOString() },
      };

  return googleRequest<GoogleCalendarEvent>(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    accessToken,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export function googleEventStart(event: GoogleCalendarEvent) {
  if (event.start.dateTime) return new Date(event.start.dateTime);
  const [year, month, day] = (event.start.date ?? "1970-01-01").split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function googleEventTimeLabel(event: GoogleCalendarEvent) {
  if (event.start.date) return "All day";
  return googleEventStart(event).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export async function reschedulePrimaryGoogleEvent(
  accessToken: string,
  event: GoogleCalendarEvent,
  targetDay: Date,
) {
  let start: GoogleCalendarDateTime;
  let end: GoogleCalendarDateTime;

  if (event.start.date) {
    const startDate = event.start.date;
    const endDate = event.end.date ?? addDateOnlyDays(startDate, 1);
    const duration = Math.max(1, Math.round((Date.parse(`${endDate}T12:00:00`) - Date.parse(`${startDate}T12:00:00`)) / 86_400_000));
    const target = `${targetDay.getFullYear()}-${String(targetDay.getMonth() + 1).padStart(2, "0")}-${String(targetDay.getDate()).padStart(2, "0")}`;
    start = { date: target };
    end = { date: addDateOnlyDays(target, duration) };
  } else {
    const originalStart = new Date(event.start.dateTime!);
    const originalEnd = new Date(event.end.dateTime ?? event.start.dateTime!);
    const duration = Math.max(15 * 60_000, originalEnd.getTime() - originalStart.getTime());
    const movedStart = new Date(targetDay);
    movedStart.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), 0);
    start = { dateTime: movedStart.toISOString() };
    end = { dateTime: new Date(movedStart.getTime() + duration).toISOString() };
  }

  return googleRequest<GoogleCalendarEvent>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(event.id)}`,
    accessToken,
    { method: "PATCH", body: JSON.stringify({ start, end }) },
  );
}
