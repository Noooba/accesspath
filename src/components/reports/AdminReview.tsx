"use client";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ShieldCheck,
  LockKeyhole,
  LogOut,
  RefreshCw,
  Check,
  X,
  Info,
} from "lucide-react";
import type { ObstacleReport } from "@/types";
import { apiJson } from "@/lib/http-client";
import { StatusBadge } from "@/components/ui/StatusBadge";
export function AdminReview() {
  const [authenticated, setAuthenticated] = useState(false),
    [initializing, setInitializing] = useState(true),
    [key, setKey] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reports, setReports] = useState<ObstacleReport[]>([]),
    [filter, setFilter] = useState("pending"),
    [notice, setNotice] = useState("");
  const load = useCallback(
    () =>
      fetch("/api/admin/reports", { cache: "no-store" })
        .then(async (response) => {
          if (response.status === 401) {
            setAuthenticated(false);
            return;
          }
          const data = await response.json();
          if (!response.ok)
            throw new Error(
              data.error?.message || "Moderator reports could not be loaded.",
            );
          setReports(data.reports);
          setAuthenticated(true);
        })
        .catch((e) =>
          setError(
            e instanceof Error
              ? e.message
              : "The review service is unavailable.",
          ),
        )
        .finally(() => setInitializing(false)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiJson("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      setKey("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setError("");
    try {
      await apiJson("/api/admin/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      setAuthenticated(false);
      setReports([]);
      setNotice("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Sign-out could not be completed.",
      );
    }
  }
  if (initializing)
    return (
      <section className="admin-loading" role="status">
        <div className="button-spinner dark" />
        Checking moderator access…
      </section>
    );
  if (!authenticated)
    return (
      <section className="moderator-login">
        <span className="login-symbol">
          <LockKeyhole size={27} />
        </span>
        <StatusBadge kind="private">Protected moderator access</StatusBadge>
        <h2>Review with responsibility.</h2>
        <p>
          Moderation requires the configured administrator key. No key is
          included in the client application.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <form onSubmit={login}>
          <label className="field-label">
            Moderator key
            <input
              type="password"
              autoComplete="current-password"
              value={key}
              required
              minLength={32}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <button
            className="button primary"
            type="submit"
            disabled={busy || key.length < 32}
          >
            {busy ? "Signing in…" : "Sign in to review"}
            <ArrowRight size={16} />
          </button>
        </form>
        <p className="small-copy">
          Local setup: configure ADMIN_KEY and SESSION_SECRET server-side.
          Without configuration, moderation stays unavailable.
        </p>
      </section>
    );
  const visible = reports.filter(
    (r) => filter === "all" || r.reviewStatus === filter,
  );
  return (
    <section className="moderation-panel">
      <div className="moderation-toolbar">
        <StatusBadge kind="private">Authenticated review session</StatusBadge>
        <button className="text-link" onClick={() => void load()}>
          <RefreshCw size={14} />
          Refresh
        </button>
        <button
          className="button secondary small"
          onClick={() => void logout()}
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
      <div className="data-note">
        <ShieldCheck size={17} />
        <p>
          Approving a report changes its review status. It does not verify the
          edge’s slope, width, surface or step-free information. A separate
          operational update must be explicitly selected.
        </p>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="success-notice" role="status">
          {notice}
        </p>
      )}
      <label className="field-label compact-filter">
        Review status
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All reports</option>
        </select>
      </label>
      {visible.length ? (
        visible.map((report) => (
          <ReviewItem
            key={`${report.id}-${report.reviewStatus}`}
            report={report}
            onSuccess={async () => {
              setNotice(
                "Review saved. Only explicitly selected operational details were changed.",
              );
              await load();
            }}
          />
        ))
      ) : (
        <div className="empty-moderation">
          <Check size={28} />
          <h3>No {filter === "all" ? "recorded" : filter} reports.</h3>
          <p>
            New reports will appear here after they are saved. Nothing is
            automatically marked verified.
          </p>
        </div>
      )}
    </section>
  );
}
function ReviewItem({
  report,
  onSuccess,
}: {
  report: ObstacleReport;
  onSuccess: () => Promise<void>;
}) {
  const [notes, setNotes] = useState(report.moderatorNotes),
    [operation, setOperation] = useState("unchanged"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function review(reviewStatus: "approved" | "rejected") {
    setBusy(true);
    setError("");
    try {
      await apiJson(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus,
          moderatorNotes: notes,
          ...(operation !== "unchanged"
            ? { operationalStatus: operation }
            : {}),
        }),
      });
      await onSuccess();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The review could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="review-item">
      <div className="review-item-heading">
        <div>
          <span>{report.category.replaceAll("-", " ")}</span>
          <h3>{report.edgeId.replaceAll("-", " ")}</h3>
        </div>
        <StatusBadge
          kind={report.reviewStatus === "pending" ? "caution" : "demo"}
        >
          {report.reviewStatus}
        </StatusBadge>
      </div>
      <p className="report-description">
        {report.description || "No additional description supplied."}
      </p>
      <p className="review-reference">
        {report.id} · {new Date(report.reportedAt).toLocaleString()}
      </p>
      <label className="field-label">
        Moderator notes
        <textarea
          rows={3}
          maxLength={800}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <small className="field-help">
          Keep notes factual and free of personal information.
        </small>
      </label>
      <label className="field-label">
        Explicit pathway operational update
        <select
          value={operation}
          onChange={(e) => setOperation(e.target.value)}
        >
          <option value="unchanged">Leave pathway data unchanged</option>
          <option value="blocked">Mark pathway blocked</option>
          <option value="open">Mark pathway open</option>
          <option value="unknown">Mark operation unknown</option>
        </select>
      </label>
      <p className="review-caution">
        <Info size={14} /> Operational changes affect routing. Use only when
        evidence justifies the update.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="review-actions">
        <button
          disabled={busy}
          className="button primary"
          onClick={() => void review("approved")}
        >
          <Check size={15} />
          Approve report
        </button>
        <button
          disabled={busy}
          className="button secondary"
          onClick={() => void review("rejected")}
        >
          <X size={15} />
          Reject report
        </button>
      </div>
    </article>
  );
}
