"use client";
import { useEffect, useState } from "react";
import { PlugZap, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api/browser";
export function FoConnection({
  returnTo = "/connections/fo",
  onStatus,
}: {
  returnTo?: string;
  onStatus?: (connected: boolean) => void;
}) {
  const [status, setStatus] = useState<{
    connected: boolean;
    ready: boolean;
    message?: string;
  } | null>(null);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ connected: boolean; ready: boolean; message?: string }>(
      "/api/fo/status",
      undefined,
      controller.signal,
    )
      .then((s) => {
        setStatus(s);
        onStatus?.(s.connected);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [onStatus]);
  async function check() {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/fo/check", {});
      setVerified(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wajo could not be checked.");
    } finally {
      setBusy(false);
    }
  }
  async function connect() {
    setBusy(true);
    setError("");
    try {
      const result = await apiRequest<{ authorizationUrl: string }>(
        "/api/fo/connect",
        { returnTo },
      );
      window.location.assign(result.authorizationUrl);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Wajo sign-in could not be started.",
      );
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    try {
      await apiRequest("/api/fo/disconnect", {});
      setStatus({ connected: false, ready: true });
      setVerified(false);
      onStatus?.(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="fo-connection" aria-label="Wajo connection">
      <div className="approval-note">
        <span>
          {status?.connected ? (
            <ShieldCheck size={20} />
          ) : (
            <PlugZap size={20} />
          )}
        </span>
        <div>
          <strong>
            {status?.connected
              ? "Your Wajo account is connected."
              : "Connect your Fo assistant."}
          </strong>
          <p>
            {status?.connected
              ? "Fo can call venues and request reservations after you approve a specific action. Connecting your account does not contact anyone."
              : "Sign into Wajo and review its account access permissions. DayMade sends only the reservation actions you explicitly approve."}
          </p>
          <p>
            Wajo grants general Fo access through its MCP permission. Review the
            scope on Wajo’s consent screen.
          </p>
        </div>
      </div>
      {status?.message && <p className="form-help">{status.message}</p>}
      {error && (
        <p className="error-state" role="alert">
          {error}
        </p>
      )}
      {verified && (
        <p role="status" className="form-help">
          Connection verified with Wajo. No calls or reservation requests were
          made.
        </p>
      )}
      <div className="dialog-actions">
        {status?.connected && (
          <Button variant="secondary" onClick={check} disabled={busy}>
            Test connection
          </Button>
        )}
        <Button
          type="button"
          variant={status?.connected ? "ghost" : "default"}
          // Keep this actionable even if the status endpoint reports missing
          // setup (or fails to load). The connect endpoint can return the
          // specific setup error instead of leaving users with a gray button.
          disabled={busy}
          onClick={status?.connected ? disconnect : connect}
        >
          {busy
            ? "One moment…"
            : status?.connected
              ? "Disconnect Wajo"
              : "Connect Wajo"}
        </Button>
      </div>
      {status?.connected && (
        <p className="form-help">
          Disconnecting stops DayMade’s access. It does not cancel requests or
          reservations. You can also revoke DayMade in Wajo’s connected apps.
        </p>
      )}
    </section>
  );
}
