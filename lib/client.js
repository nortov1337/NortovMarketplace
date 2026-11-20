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
    .catch(() => ({ error: "Неверный ответ сервера" }));
  if (!response.ok)
    throw new Error(result.error || "Не удалось выполнить запрос");
  return result;
}
export const money = (value) => Number(value).toLocaleString("ru-RU") + " ₽";
export const date = (value) =>
  new Date(
    value.includes("T") ? value : value.replace(" ", "T") + "Z",
  ).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
export const statusNames = {
  new: "Новый",
  accepted: "Принят",
  shipped: "Отправлен",
  completed: "Получен",
  cancelled: "Отменён",
};
export const sellerNext = {
  new: [
    ["accepted", "Принять"],
    ["cancelled", "Отменить"],
  ],
  accepted: [
    ["shipped", "Отправить"],
    ["cancelled", "Отменить"],
  ],
  shipped: [["completed", "Завершить"]],
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
