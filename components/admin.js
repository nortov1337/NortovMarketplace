"use client";
import { useRef, useState } from "react";
import { Breadcrumb, Field } from "./ui";
import { ReportList } from "./reports";
import { money, date } from "@/lib/client";

const tabs = [
  ["reports", "Complaints"],
  ["products", "Products"],
  ["categories", "Categories"],
  ["users", "Users"],
  ["reviews", "Reviews"],
  ["orders", "Orders"],
  ["audit", "Activity log"],
];

const statusFilters = {
  reports: [
    ["Open", (r) => r.status === "open"],
    ["Resolved", (r) => r.status === "resolved"],
  ],
  products: [
    ["Hidden", (p) => p.moderation === "hidden"],
    ["Archived", (p) => !p.active],
  ],
  categories: [
    ["Active", (c) => Boolean(c.active)],
    ["Archived", (c) => !c.active],
  ],
  users: [
    ["Blocked", (u) => Boolean(u.suspended)],
    ["Administrators", (u) => Boolean(u.is_admin)],
  ],
  orders: [
    ["In progress", (o) => o.active_items > 0],
    ["Closed", (o) => o.active_items === 0],
  ],
};

export default function Admin({ data, go, action }) {
  const [tab, setTab] = useState("reports");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [draft, setDraft] = useState({ name: "" });
  const [busy, setBusy] = useState(false);
  const categoryInput = useRef(null);
  if (!data) return <p className="loading">Loading data...</p>;
  const term = search.trim().toLowerCase();
  const filters = statusFilters[tab];
  const matchesStatus = filters?.find(([label]) => label === filter)?.[1];
  const entries = data[tab].filter(
    (entry) =>
      (!matchesStatus || matchesStatus(entry)) &&
      (!term ||
        Object.values(entry).some((value) =>
          String(value ?? "")
            .toLowerCase()
            .includes(term),
        )),
  );
  const change = async (name, values) => {
    if (busy) return false;
    setBusy(true);
    try {
      return await action(name, values);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Breadcrumb go={go}>Site management</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">SITE MANAGEMENT</span>
        <h1>Administration</h1>
        <p>Monitor the marketplace and manage moderation.</p>
      </div>
      <div className="dashboard-stats admin-stats">
        <div>
          <span>Users</span>
          <strong>{data.stats.users}</strong>
        </div>
        <div>
          <span>Active products</span>
          <strong>{data.stats.products}</strong>
        </div>
        <div>
          <span>Orders</span>
          <strong>{data.stats.orders}</strong>
        </div>
        <div>
          <span>Open complaints</span>
          <strong>{data.stats.open_reports}</strong>
        </div>
      </div>
      <div className="tabs">
        {tabs.map(([id, name]) => (
          <button
            aria-pressed={tab === id}
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => {
              setTab(id);
              setFilter("");
              setSearch("");
            }}
          >
            {name}
          </button>
        ))}
      </div>
      {tab === "categories" && (
        <form
          className="surface admin-category-form"
          onSubmit={async (event) => {
            event.preventDefault();
            if (await change("adminCategory", draft)) setDraft({ name: "" });
          }}
        >
          <Field
            ref={categoryInput}
            label={draft.id ? "Rename category" : "New category"}
            required
            minLength={2}
            maxLength={80}
            value={draft.name}
            disabled={busy}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
          />
          <div className="row-buttons">
            <button className="button primary" disabled={busy}>
              {draft.id ? "Save name" : "Add category"}
            </button>
            {draft.id && (
              <button
                type="button"
                className="button ghost"
                disabled={busy}
                onClick={() => setDraft({ name: "" })}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
      <div className="admin-filters">
        <Field
          label="Search"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            tab === "categories"
              ? "Find a category"
              : "Search the latest records"
          }
        />
        {filters && (
          <label className="field">
            <span>Status</span>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {filters.map(([label]) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {tab !== "categories" && (
        <p className="muted">
          Showing up to 500 latest records in each section.
        </p>
      )}
      <fieldset
        className="admin-list"
        disabled={busy}
        aria-label="Manage records"
      >
        {tab === "reports" && <ReportList reports={entries} action={change} />}
        {tab === "categories" &&
          entries.map((category) => (
            <div className="admin-row" key={category.id}>
              <div>
                <b>{category.name}</b>
                <p>
                  {category.active ? "Active" : "Archived"} ·{" "}
                  {category.product_count} products
                </p>
              </div>
              <div className="row-buttons">
                <button
                  className="button secondary small"
                  onClick={() => {
                    setDraft({ id: category.id, name: category.name });
                    categoryInput.current?.focus();
                  }}
                >
                  Rename
                </button>
                <button
                  className="button secondary small"
                  onClick={() =>
                    change("adminCategory", {
                      id: category.id,
                      active: !category.active,
                    })
                  }
                >
                  {category.active ? "Archive" : "Restore"}
                </button>
              </div>
            </div>
          ))}
        {tab === "products" &&
          entries.map((p) => (
            <div className="admin-row" key={p.id}>
              <div>
                <b>{p.name}</b>
                <p>
                  {p.seller} · {p.category} · {money(p.price)} ·{" "}
                  {p.moderation === "hidden" ? "Hidden" : "Allowed"} ·{" "}
                  {p.active ? "Published" : "Archived"}
                </p>
              </div>
              <button
                className="button secondary small"
                onClick={() =>
                  change("adminProduct", {
                    id: p.id,
                    moderation:
                      p.moderation === "hidden" ? "approved" : "hidden",
                  })
                }
              >
                {p.moderation === "hidden" ? "Allow" : "Hide"}
              </button>
            </div>
          ))}
        {tab === "users" &&
          entries.map((u) => (
            <div className="admin-row" key={u.id}>
              <div>
                <b>{u.name}</b>
                <p>
                  {u.email} ·{" "}
                  {u.is_admin
                    ? "Administrator"
                    : u.suspended
                      ? "Blocked"
                      : "Active"}
                </p>
              </div>
              {!u.is_admin && (
                <button
                  className="button secondary small"
                  onClick={() =>
                    window.confirm(
                      u.suspended
                        ? "Unblock this user?"
                        : "Block this user and end their sessions?",
                    ) &&
                    change("adminUser", { id: u.id, suspended: !u.suspended })
                  }
                >
                  {u.suspended ? "Unblock" : "Block"}
                </button>
              )}
            </div>
          ))}
        {tab === "reviews" &&
          entries.map((r) => (
            <div className="admin-row" key={r.id}>
              <div>
                <b>
                  {r.product_name} · {r.rating} / 5
                </b>
                <p>
                  {r.name}: {r.body}
                </p>
              </div>
              <button
                className="button secondary small"
                onClick={() => {
                  if (window.confirm("Delete review?"))
                    change("adminReview", { id: r.id });
                }}
              >
                Delete
              </button>
            </div>
          ))}
        {tab === "orders" &&
          entries.map((order) => (
            <div className="admin-row" key={order.id}>
              <div>
                <b>
                  Order #{order.id} · {money(order.total)}
                </b>
                <p>
                  {order.buyer} · {date(order.created_at)} · {order.item_count}{" "}
                  items · {order.active_items} in progress
                </p>
              </div>
            </div>
          ))}
        {tab === "audit" &&
          entries.map((entry) => (
            <div className="admin-row" key={entry.id}>
              <div>
                <b>
                  {entry.admin} · {entry.action}
                </b>
                <p>
                  {entry.target_type} #{entry.target_id} · {entry.detail} ·{" "}
                  {date(entry.created_at)}
                </p>
              </div>
            </div>
          ))}
        {entries.length === 0 && <p className="muted">No records found.</p>}
      </fieldset>
    </>
  );
}
