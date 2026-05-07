const BASE = "http://localhost:8000";

function token() {
  return localStorage.getItem("token");
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token()) headers["Authorization"] = `Bearer ${token()}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 204) return null as T;
  const body = await res.json();
  if (!res.ok) throw new Error(body.detail ?? "Request failed");
  return body;
}

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  commute_minutes: number;
  home_address: string | null;
  campus_address: string | null;
}

export interface Schedule {
  id: number;
  title: string;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  is_on_campus: boolean;
  source: string;
}

export interface Decision {
  id: number;
  decision_date: string;
  recommendation: "stay" | "go";
  reasoning: string;
  confidence_score: number;
  factors: string | null;
}

export interface ScheduleCreate {
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  is_on_campus: boolean;
}

export const api = {
  register: (data: { email: string; password: string; full_name?: string; commute_minutes?: number }) =>
    req<User>("/auth/register", { method: "POST", body: JSON.stringify(data) }),

  login: async (email: string, password: string): Promise<string> => {
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: email, password }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail ?? "Login failed");
    return body.access_token;
  },

  me: () => req<User>("/auth/me"),

  getSchedules: (date: string) => req<Schedule[]>(`/schedules/?event_date=${date}`),

  createSchedule: (data: ScheduleCreate) =>
    req<Schedule>("/schedules/", { method: "POST", body: JSON.stringify(data) }),

  deleteSchedule: (id: number) => req<null>(`/schedules/${id}`, { method: "DELETE" }),

  syncGoogle: (date: string) =>
    req<Schedule[]>(`/schedules/sync/google?target_date=${date}`, { method: "POST" }),

  getDecisions: (date: string) => req<Decision[]>(`/decisions/?decision_date=${date}`),

  makeDecision: (target_date: string, extra_context?: string) =>
    req<Decision>("/decisions/", { method: "POST", body: JSON.stringify({ target_date, extra_context }) }),

  getGoogleAuthUrl: () => req<{ auth_url: string }>("/auth/google"),
};
