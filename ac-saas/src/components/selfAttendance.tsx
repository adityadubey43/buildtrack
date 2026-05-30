"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, type AttendanceRecord } from "@/lib/api";
import { uploadFiles } from "@/lib/uploadApi";
import { ViewPhotosButton } from "@/components/imageViewer";
import { X, Camera, Loader2, LogIn, LogOut, Clock, CheckCircle2 } from "lucide-react";

// Photo modal with the staff member's own name locked
function SelfCheckModal({ name, action, onUpload, onClose }: {
  name: string;
  action: "checkin" | "checkout";
  onUpload: (photoUrl: string) => Promise<void>;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const isIn = action === "checkin";

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if (!files?.length) return;
    setUploading(true); setErr("");
    try { const urls = await uploadFiles(files, "attendance"); setPhoto(urls[0]); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Upload failed."); }
    finally { setUploading(false); }
  };

  const submit = async () => {
    if (!photo) { setErr("Photo is required."); return; }
    setSaving(true); setErr("");
    try { await onUpload(photo); onClose(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : "Failed."); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">{isIn ? "Check In" : "Check Out"}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          {err && <p className="text-red-600 text-sm bg-red-50 rounded-lg p-3">{err}</p>}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input value={name} readOnly disabled className="w-full border border-slate-200 bg-slate-50 text-slate-700 rounded-lg px-3 py-2 text-sm cursor-not-allowed font-medium" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{isIn ? "Check-in" : "Check-out"} Photo *</label>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
            {photo ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="proof" className="w-full h-44 object-cover rounded-xl border border-slate-200" />
                <button type="button" onClick={() => setPhoto("")} className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-blue-400 disabled:opacity-60">
                {uploading ? <Loader2 className="w-8 h-8 text-blue-400 mx-auto animate-spin" /> : <><Camera className="w-8 h-8 text-slate-400 mx-auto mb-1" /><p className="text-sm text-slate-500">Capture / upload photo</p></>}
              </button>
            )}
          </div>
          <button onClick={submit} disabled={saving || uploading || !photo} className={`w-full py-2.5 ${isIn ? "bg-green-600 hover:bg-green-700" : "bg-orange-500 hover:bg-orange-600"} disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2`}>
            {saving ? "Saving…" : <>{isIn ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}{isIn ? "Confirm Check In" : "Confirm Check Out"}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MyAttendanceCard({ variant = "full" }: { variant?: "full" | "compact" }) {
  const [rec, setRec] = useState<AttendanceRecord | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"checkin" | "checkout" | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.attendance.myToday();
      setRec(res.data); setName(res.worker?.name || "");
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (photoUrl: string) => {
    if (action === "checkin") { const r = await api.attendance.checkIn({ photoUrl }); setMsg(r.message); }
    else { const r = await api.attendance.checkOut({ photoUrl }); setMsg(r.message); }
    await load();
  };

  const checkedIn = !!rec?.checkInAt;
  const checkedOut = !!rec?.checkOutAt;

  return (
    <>
      {action && (
        <SelfCheckModal name={name} action={action} onUpload={handleUpload} onClose={() => setAction(null)} />
      )}

      <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 p-5 ${variant === "compact" ? "" : ""}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">My Attendance</h3>
            <p className="text-xs text-slate-400">{name || "You"} · today</p>
          </div>
          {checkedOut ? (
            <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Done
            </span>
          ) : checkedIn ? (
            <span className="flex items-center gap-1 text-xs bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full font-medium">
              <Clock className="w-3.5 h-3.5" /> Checked in
            </span>
          ) : (
            <span className="text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-medium">Not checked in</span>
          )}
        </div>

        {/* Times */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <div className="text-xs text-slate-400">Check-in</div>
            <div className="text-sm font-bold text-slate-800">{rec?.timeIn || "—"}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <div className="text-xs text-slate-400">Check-out</div>
            <div className="text-sm font-bold text-slate-800">{rec?.timeOut || "—"}</div>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 text-center">
            <div className="text-xs text-slate-400">Hours</div>
            <div className="text-sm font-bold text-slate-800">{checkedOut ? `${rec?.hoursWorked ?? 0}h` : "—"}</div>
          </div>
        </div>

        {(rec?.checkInPhoto || rec?.checkOutPhoto) && (
          <div className="mb-3 flex justify-center">
            <ViewPhotosButton images={[
              { url: rec?.checkInPhoto || "", label: "Check-in photo" },
              { url: rec?.checkOutPhoto || "", label: "Check-out photo" },
            ]} label="View my photos" />
          </div>
        )}

        {loading ? (
          <div className="h-10 bg-slate-100 rounded-xl animate-pulse" />
        ) : !checkedIn ? (
          <button onClick={() => setAction("checkin")} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            <LogIn className="w-4 h-4" /> Check In
          </button>
        ) : !checkedOut ? (
          <button onClick={() => setAction("checkout")} className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
            <LogOut className="w-4 h-4" /> Check Out
          </button>
        ) : (
          <p className="text-center text-xs text-slate-400">You&apos;ve completed today&apos;s attendance.</p>
        )}

        {msg && <p className="text-center text-xs text-green-600 mt-2">{msg}</p>}
      </div>
    </>
  );
}
