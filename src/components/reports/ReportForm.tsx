"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Flag,
  Info,
  MapPin,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";
import type { ObstacleReport, ReportCategory, SiteGraph } from "@/types";
import { SITES } from "@/data/demo-campus";
import { apiJson } from "@/lib/http-client";
import { StatusBadge } from "@/components/ui/StatusBadge";
const CATEGORIES: [ReportCategory, string][] = [
  ["blocked-path", "Blocked path"],
  ["stairs", "Stairs"],
  ["damaged-surface", "Damaged or uneven surface"],
  ["missing-curb-ramp", "Missing curb ramp"],
  ["steep-slope", "Steep slope"],
  ["inaccessible-entrance", "Inaccessible entrance"],
  ["other", "Something else"],
];
export function ReportForm({
  initialSite = "demo-campus",
  initialEdge = "",
  receipt = "",
  storageAvailable = true,
}: {
  initialSite?: string;
  initialEdge?: string;
  receipt?: string;
  storageAvailable?: boolean;
}) {
  const [siteId, setSiteId] = useState(
      SITES.some((s) => s.id === initialSite) ? initialSite : "demo-campus",
    ),
    [edgeId, setEdgeId] = useState(initialEdge),
    [graphResponse, setGraphResponse] = useState<{
      key: string;
      data?: SiteGraph;
      error?: string;
    } | null>(null),
    [category, setCategory] = useState<ReportCategory | " ">(" "),
    [description, setDescription] = useState(""),
    [website, setWebsite] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState<ObstacleReport | null>(null),
    [retry, setRetry] = useState(0);
  const errorRef = useRef<HTMLDivElement>(null);
  const graphKey = `${siteId}:${retry}`,
    graph = graphResponse?.key === graphKey ? graphResponse.data : null,
    loading = graphResponse?.key !== graphKey;
  const graphError =
    graphResponse?.key === graphKey ? (graphResponse.error ?? "") : "";
  const displayError = error || graphError;
  useEffect(() => {
    let active = true;
    const c = new AbortController(),
      timer = setTimeout(() => c.abort(), 12000);
    apiJson<SiteGraph>(`/api/sites/${siteId}/graph`, { signal: c.signal })
      .then((d) => {
        if (!active) return;
        setGraphResponse({ key: graphKey, data: d });
        setEdgeId((current) =>
          d.edges.some((e) => e.id === current) ? current : "",
        );
      })
      .catch((e) => {
        if (active)
          setGraphResponse({
            key: graphKey,
            error:
              e.name === "AbortError"
                ? "The site request timed out. Please try again."
                : e.message,
          });
      })
      .finally(() => {
        clearTimeout(timer);
      });
    return () => {
      active = false;
      c.abort();
      clearTimeout(timer);
    };
  }, [siteId, graphKey]);
  useEffect(() => {
    if (!receipt) return;
    const c = new AbortController();
    apiJson<{ reports: ObstacleReport[] }>(
      `/api/reports?siteId=${encodeURIComponent(siteId)}`,
      { signal: c.signal },
    )
      .then((d) => {
        const found = d.reports.find((r) => r.id === receipt);
        if (found) setSuccess(found);
        else
          setError(
            "That report reference could not be found in this site. You can submit a new report.",
          );
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => c.abort();
  }, [receipt, siteId]);
  useEffect(() => {
    if (displayError) errorRef.current?.focus();
  }, [displayError]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await apiJson<{ report: ObstacleReport }>("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId,
          edgeId,
          category,
          description,
          website,
        }),
      });
      setSuccess(data.report);
      window.history.replaceState(
        null,
        "",
        `/report?site=${encodeURIComponent(siteId)}&receipt=${encodeURIComponent(data.report.id)}`,
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The report could not be submitted. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <section className="report-success">
        <span className="success-icon">
          <Check size={30} />
        </span>
        <StatusBadge kind="caution">
          {success.reviewStatus === "pending"
            ? "Pending review"
            : success.reviewStatus}
        </StatusBadge>
        <h2>Your report is on the record.</h2>
        <p>
          It has been saved to the application database. A report does not
          change route accessibility until an authorized moderator reviews the
          affected information.
        </p>
        <div className="receipt">
          <span>Report reference</span>
          <strong>{success.id}</strong>
          <span>
            Pathway <b>{success.edgeId.replaceAll("-", " ")}</b>
          </span>
          <span>
            Submitted <b>{new Date(success.reportedAt).toLocaleString()}</b>
          </span>
        </div>
        <p className="data-note">
          This is a demo-campus report. It is not evidence of a real-world
          obstruction or a community interview.
        </p>
        <div className="inline-actions">
          <Link href="/explore" className="button primary">
            Return to routes <ArrowRight size={16} />
          </Link>
          <button
            className="button secondary"
            onClick={() => {
              setSuccess(null);
              setDescription("");
              setCategory(" ");
              window.history.replaceState(null, "", "/report");
            }}
          >
            Submit another report
          </button>
        </div>
      </section>
    );
  return (
    <div className="report-layout">
      <form className="report-form" onSubmit={submit}>
        <div className="form-panel-heading">
          <Flag size={21} />
          <div>
            <h2>Tell us about a pathway</h2>
            <p>Useful details help a moderator decide what needs checking.</p>
          </div>
        </div>
        {displayError && (
          <div className="form-error" role="alert" tabIndex={-1} ref={errorRef}>
            <strong>The report needs another look.</strong>
            <p>{displayError}</p>
          </div>
        )}
        <label className="field-label">
          Site
          <select
            value={siteId}
            onChange={(e) => {
              setSiteId(e.target.value);
              setError("");
              setEdgeId("");
            }}
          >
            {SITES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {!s.isDemo ? " — Pilot, unverified" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Pathway segment <span className="required-label">Required</span>
          <select
            value={edgeId}
            required
            disabled={loading || !graph?.edges.length}
            onChange={(e) => setEdgeId(e.target.value)}
          >
            <option value="">
              {loading
                ? "Loading documented segments…"
                : graph?.edges.length
                  ? "Choose a pathway"
                  : "No pathways supplied for this site"}
            </option>
            {graph?.edges.map((edge) => (
              <option key={edge.id} value={edge.id}>
                {graph.nodes.find((n) => n.id === edge.fromNodeId)?.name} ↔{" "}
                {graph.nodes.find((n) => n.id === edge.toNodeId)?.name}
              </option>
            ))}
          </select>
        </label>
        {!loading && !graph?.edges.length && (
          <p className="data-note">
            There is no pathway graph for this unverified pilot. Reports need a
            valid, documented segment; use the synthetic campus to test this
            form.
          </p>
        )}
        <label className="field-label">
          Barrier category <span className="required-label">Required</span>
          <select
            required
            value={category}
            onChange={(e) => setCategory(e.target.value as ReportCategory)}
          >
            <option value=" ">Choose a category</option>
            {CATEGORIES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          What did you notice? <span className="optional-label">Optional</span>
          <textarea
            rows={5}
            maxLength={800}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="For example: construction fencing is blocking the whole pathway near the library entrance."
          />
          <span className="field-help">
            <span>
              Describe the pathway only. Do not include names, contact details,
              or other personal information.
            </span>
            <span>{description.length}/800</span>
          </span>
        </label>
        <div className="honeypot" aria-hidden="true">
          <label>
            Website
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </label>
        </div>
        <div className="report-form-footer">
          <p>
            <ShieldCheck size={15} /> No account or live location required.
          </p>
          <button
            type="submit"
            disabled={
              !storageAvailable ||
              busy ||
              loading ||
              !graph?.edges.length ||
              category === " "
            }
            className="button primary"
          >
            {busy ? <span className="button-spinner" /> : <Flag size={16} />}{" "}
            {busy ? "Saving report…" : "Submit for review"}
          </button>
        </div>
        {displayError && (
          <button
            className="text-link"
            type="button"
            onClick={() => {
              setError("");
              setRetry((n) => n + 1);
            }}
          >
            Reload pathway information <ArrowRight size={13} />
          </button>
        )}
      </form>
      <aside className="report-context">
        <StatusBadge>Demonstration environment</StatusBadge>
        <h2>
          Good information
          <br />
          starts with a clear note.
        </h2>
        <p>
          Report what you can describe, not what you assume. Conditions can
          change, and a report is one piece of evidence.
        </p>
        <ol>
          <li>
            <span>1</span>
            <div>
              <strong>Save the observation</strong>
              <p>
                Your report is stored with a pathway reference and submission
                time.
              </p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Review the details</strong>
              <p>
                An authorized moderator can approve, reject, and document any
                justified operational update.
              </p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Keep the distinction</strong>
              <p>
                Approval is not a full accessibility survey. Unknown widths,
                slopes and curb details stay unknown.
              </p>
            </div>
          </li>
        </ol>
        <div className="data-note">
          <Info size={17} />
          <p>
            This prototype uses synthetic campus data. Do not report emergencies
            here. Follow official on-site guidance for actual travel.
          </p>
        </div>
        <Link className="text-link" href="/about">
          <MapPin size={14} />
          How we handle route information <ArrowUpRight size={13} />
        </Link>
      </aside>
    </div>
  );
}
