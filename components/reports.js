"use client";
import { useState } from "react";
export function ReportForm({ productId, submitReport }) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  if (!open)
    return (
      <button
        className="text-button report-button"
        onClick={() => setOpen(true)}
      >
        Complain about a product
      </button>
    );
  return (
    <form
      className="review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        if (await submitReport(productId, reason)) {
          setOpen(false);
          setReason("");
        }
        setBusy(false);
      }}
    >
      <h3>Complaint about the product</h3>
      <label className="field">
        <span>Tell me what’s wrong</span>
        <textarea
          required
          minLength={5}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <div className="row-buttons">
        <button className="button secondary" disabled={busy}>
          Send
        </button>
        <button
          type="button"
          className="button ghost"
          onClick={() => setOpen(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
export function ReportList({ reports, action }) {
  return reports.map((report) => (
    <div className="admin-row" key={report.id}>
      <div>
        <b>
          {report.product_name} ·{" "}
          {report.status === "open" ? "New complaint" : "Considered"}
        </b>
        <p>
          {report.reporter}: {report.reason}
        </p>
      </div>
      <div className="row-buttons">
        <button
          className="button secondary small"
          onClick={() =>
            action("adminProduct", {
              id: report.product_id,
              moderation:
                report.moderation === "hidden" ? "approved" : "hidden",
            })
          }
        >
          {report.moderation === "hidden" ? "Allow product" : "Hide product"}
        </button>
        <button
          className="button secondary small"
          onClick={() =>
            action("adminReport", {
              id: report.id,
              status: report.status === "open" ? "resolved" : "open",
            })
          }
        >
          {report.status === "open" ? "Reviewed" : "Open again"}
        </button>
      </div>
    </div>
  ));
}
