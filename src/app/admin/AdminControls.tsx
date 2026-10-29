"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

async function post(url: string, data: object) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Failed");
}

export function AdminLogin() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await post("/api/admin/login", { key });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  }
  return (
    <form className="panel name-form" onSubmit={submit}>
      <h1 className="spooky panel-title">Crypt keeper</h1>
      <label htmlFor="key">Admin key</label>
      <input id="key" className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)} required autoComplete="current-password" />
      <button className="btn btn-green">Enter</button>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

export function RowActions({ id, xid, handle }: { id: string; xid: string; handle: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(url: string, data: object, confirmText: string) {
    if (!confirm(confirmText)) return;
    setBusy(true);
    try {
      await post(url, data);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="row-actions">
      <button className="btn btn-sm" disabled={busy} onClick={() => act("/api/admin/hide", { id }, "Take this run off the board?")}>Hide</button>
      <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => act("/api/admin/ban", { xid }, `Ban @${handle}? All their entries leave the boards and they can't post again.`)}>Ban</button>
    </div>
  );
}
