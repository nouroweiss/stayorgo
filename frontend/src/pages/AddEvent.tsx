import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { api } from "../api";

const today = () => new Date().toISOString().split("T")[0];

export default function AddEvent() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefillDate = (location.state as { date?: string } | null)?.date ?? today();
  const [form, setForm] = useState({
    title: "",
    description: "",
    event_date: prefillDate,
    start_time: "",
    end_time: "",
    location: "",
    is_on_campus: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await api.createSchedule({
        title: form.title,
        description: form.description || undefined,
        event_date: form.event_date,
        start_time: form.start_time || undefined,
        end_time: form.end_time || undefined,
        location: form.location || undefined,
        is_on_campus: form.is_on_campus,
      });
      navigate("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Nav */}
      <header className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="font-semibold text-slate-900">Add event</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <form onSubmit={submit} className="space-y-5">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title <span className="text-red-400">*</span></label>
              <input
                type="text"
                required
                placeholder="CS301 Lecture"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Date <span className="text-red-400">*</span></label>
              <input
                type="date"
                required
                value={form.event_date}
                onChange={(e) => set("event_date", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Start time</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => set("start_time", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">End time</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => set("end_time", e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
              <input
                type="text"
                placeholder="Engineering Hall, Room 201"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
              <textarea
                rows={2}
                placeholder="Optional notes…"
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            {/* On campus toggle */}
            <div className="flex items-center justify-between py-3 border border-slate-200 rounded-lg px-4">
              <div>
                <p className="text-sm font-medium text-slate-800">On campus</p>
                <p className="text-xs text-slate-400">Turn off for off-campus or remote events</p>
              </div>
              <button
                type="button"
                onClick={() => set("is_on_campus", !form.is_on_campus)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.is_on_campus ? "bg-indigo-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    form.is_on_campus ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex-1 border border-slate-200 text-slate-700 font-medium py-2.5 rounded-lg text-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-60"
              >
                {loading ? "Saving…" : "Save event"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
