import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, Clock, MapPin, LogOut, Plus, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { api, Decision, Schedule } from "../api";
import { useAuth } from "../contexts/AuthContext";

const today = () => new Date().toISOString().split("T")[0];
const fmt = (t: string) => t.slice(0, 5);
const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const date = today();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loadingSched, setLoadingSched] = useState(true);
  const [loadingDecision, setLoadingDecision] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getSchedules(date)
      .then(setSchedules)
      .finally(() => setLoadingSched(false));
    api.getDecisions(date).then((ds) => ds.length && setDecision(ds[0]));
  }, []);

  const getDecision = async () => {
    setLoadingDecision(true);
    setError("");
    try {
      const d = await api.makeDecision(date);
      setDecision(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingDecision(false);
    }
  };

  const syncGoogle = async () => {
    setSyncing(true);
    setError("");
    try {
      const synced = await api.syncGoogle(date);
      if (synced.length === 0) {
        setError("No Google Calendar events found for today.");
      } else {
        const all = await api.getSchedules(date);
        setSchedules(all);
      }
    } catch (e: any) {
      if (e.message.includes("not connected")) {
        const { auth_url } = await api.getGoogleAuthUrl();
        window.open(auth_url, "_blank");
      } else {
        setError(e.message);
      }
    } finally {
      setSyncing(false);
    }
  };

  const deleteSchedule = async (id: number) => {
    await api.deleteSchedule(id);
    setSchedules((s) => s.filter((e) => e.id !== id));
  };

  const factors = decision?.factors ? JSON.parse(decision.factors) : null;
  const isStay = decision?.recommendation === "stay";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <span className="font-semibold text-slate-900">StayOrGo</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="text-slate-400 hover:text-slate-600 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Date */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{fmtDate(date)}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {user?.full_name ? `Hi, ${user.full_name.split(" ")[0]}` : "Good day"} · {user?.commute_minutes}min commute
            </p>
          </div>
          <button
            onClick={() => navigate("/add")}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Add event
          </button>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Decision Card */}
        {decision ? (
          <div className={`rounded-2xl p-5 ${isStay ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">Today's recommendation</p>
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-bold ${isStay ? "text-emerald-700" : "text-amber-700"}`}>
                    {isStay ? "Stay on campus" : "Go home"}
                  </span>
                </div>
              </div>
              <div className={`text-right`}>
                <div className={`text-2xl font-bold ${isStay ? "text-emerald-600" : "text-amber-600"}`}>
                  {decision.confidence_score}%
                </div>
                <div className="text-xs text-slate-500">confidence</div>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="h-1.5 bg-white/60 rounded-full mb-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isStay ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${decision.confidence_score}%` }}
              />
            </div>

            <p className="text-sm text-slate-700 leading-relaxed mb-3">{decision.reasoning}</p>

            {factors && (
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Events", value: factors.campus_events_count },
                  { label: "Commute", value: `${factors.total_commute_minutes}min` },
                  { label: "Largest gap", value: factors.largest_gap_minutes ? `${factors.largest_gap_minutes}min` : "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/60 rounded-lg px-2 py-1.5 text-center">
                    <div className="text-xs text-slate-500">{label}</div>
                    <div className="text-sm font-semibold text-slate-800">{value}</div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={getDecision}
              disabled={loadingDecision}
              className="mt-3 text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={loadingDecision ? "animate-spin" : ""} />
              Regenerate
            </button>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={16} className="text-indigo-500" />
              <span className="font-semibold text-slate-800 text-sm">Get today's recommendation</span>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Claude will analyze your schedule and commute to decide if you should stay or go.
            </p>
            <button
              onClick={getDecision}
              disabled={loadingDecision || schedules.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loadingDecision ? "Thinking…" : "Ask Claude"}
            </button>
            {schedules.length === 0 && !loadingSched && (
              <p className="text-xs text-slate-400 text-center mt-2">Add events first to get a recommendation.</p>
            )}
          </div>
        )}

        {/* Schedule */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              <span className="font-semibold text-slate-800 text-sm">Today's schedule</span>
              {schedules.length > 0 && (
                <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
                  {schedules.length}
                </span>
              )}
            </div>
            <button
              onClick={syncGoogle}
              disabled={syncing}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              Sync Google
            </button>
          </div>

          {loadingSched ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : schedules.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-slate-400 text-sm">No events today.</p>
              <button
                onClick={() => navigate("/add")}
                className="mt-3 text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
                + Add an event
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {schedules.map((s) => (
                <li key={s.id} className="flex items-start gap-4 px-5 py-4 group">
                  {/* Time column */}
                  <div className="w-20 shrink-0 text-right">
                    {s.start_time ? (
                      <span className="text-xs font-medium text-slate-500">{fmt(s.start_time)}</span>
                    ) : (
                      <span className="text-xs text-slate-400">All day</span>
                    )}
                  </div>

                  {/* Dot */}
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${s.is_on_campus ? "bg-indigo-500" : "bg-slate-300"}`} />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{s.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          {s.end_time && s.start_time && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <Clock size={11} />
                              {fmt(s.start_time)}–{fmt(s.end_time)}
                            </span>
                          )}
                          {s.location && (
                            <span className="flex items-center gap-1 text-xs text-slate-400">
                              <MapPin size={11} />
                              {s.location}
                            </span>
                          )}
                          <span className={`text-xs font-medium ${s.is_on_campus ? "text-indigo-500" : "text-slate-400"}`}>
                            {s.is_on_campus ? "On campus" : "Off campus"}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteSchedule(s.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
