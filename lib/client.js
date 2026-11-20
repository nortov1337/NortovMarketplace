export async function api(view, data, query = {}) {
  const params = new URLSearchParams(view ? { view, ...query } : {});
  const response = await fetch(
    "/api" + (params.size ? "?" + params.toString() : ""),
    data
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      : { cache: "no-store" },
  );
  const result = await response
    .json()
    .catch(() => ({ error: "Invalid server response" }));
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}
export const money = (value) => Number(value).toLocaleString("en-US") + " ₽";
export const date = (value) =>
  new Date(
    value.includes("T") ? value : value.replace(" ", "T") + "Z",
  ).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
export const statusNames = {
  new: "New",
  accepted: "Accepted",
  shipped: "Sent",
  completed: "Received",
  cancelled: "Canceled",
};
export const sellerNext = {
  new: [
    ["accepted", "Accept"],
    ["cancelled", "Cancel"],
  ],
  accepted: [
    ["shipped", "Send"],
    ["cancelled", "Cancel"],
  ],
  shipped: [["completed", "Complete"]],
  completed: [],
  cancelled: [],
};
export function url(page, id) {
  const p = new URLSearchParams();
  if (page && page !== "catalog") p.set("page", page);
  if (id) p.set("id", id);
  const s = p.toString();
  return "/" + (s ? "?" + s : "");
}
