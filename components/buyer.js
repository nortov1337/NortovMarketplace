"use client";
import { useState, useRef } from "react";
import {
  Breadcrumb,
  Empty,
  NavLink,
  Field,
  OrderItem,
  Minus,
  Plus,
  ShoppingBag,
  MessageCircle,
} from "./ui";
import { money, date } from "@/lib/client";

export function Cart({
  products,
  cart,
  updateCart,
  go,
  user,
  checkout,
  loginForCheckout,
}) {
  const [form, setForm] = useState({
      name: "",
      phone: "",
      address: "",
      comment: "",
    }),
    [busy, setBusy] = useState(false);
  const key = useRef(null);
  const set = (name, value) => {
    key.current = null;
    setForm({ ...form, [name]: value });
  };
  const entries = Object.entries(cart);
  const rows = entries.map(([id, quantity]) => ({
    id: Number(id),
    quantity,
    p: products.find((p) => p.id === Number(id)),
  }));
  const invalid = rows.some(
    (x) => !x.p || x.p.stock < x.quantity || x.p.seller_id === user?.id,
  );
  return (
    <>
      <Breadcrumb go={go}>Корзина</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">ВАШ ВЫБОР</span>
        <h1>Корзина</h1>
      </div>
      {!rows.length ? (
        <Empty
          title="В корзине пока пусто"
          text="Загляните в каталог — возможно, там уже есть что-то для вас."
        >
          <button className="button primary" onClick={() => go("catalog")}>
            Перейти в каталог
          </button>
        </Empty>
      ) : (
        <div className="cart-layout">
          <div className="stack">
            {rows.map(({ id, p, quantity }) => (
              <div className="cart-row" key={id}>
                <div className="cart-thumb">
                  {p?.image ? (
                    <img src={p.image} alt="" />
                  ) : (
                    <ShoppingBag size={27} />
                  )}
                </div>
                <div className="cart-info">
                  <b>{p ? p.name : "Товар больше недоступен"}</b>
                  <span>{p ? p.seller : "Удалите товар из корзины"}</span>
                  {p && p.stock < quantity && (
                    <span className="warning">Доступно: {p.stock} шт.</span>
                  )}
                  {p && p.seller_id === user?.id && (
                    <span className="warning">
                      Нельзя заказать собственный товар
                    </span>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      key.current = null;
                      updateCart(id, 0);
                    }}
                  >
                    Удалить
                  </button>
                </div>
                <div className="quantity">
                  <button
                    aria-label="Уменьшить количество"
                    onClick={() => {
                      key.current = null;
                      updateCart(id, quantity - 1);
                    }}
                  >
                    <Minus size={15} />
                  </button>
                  <span>{quantity}</span>
                  <button
                    aria-label="Увеличить количество"
                    disabled={!p || quantity >= p.stock || quantity >= 100}
                    onClick={() => {
                      key.current = null;
                      updateCart(id, quantity + 1);
                    }}
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <strong>{p ? money(p.price * quantity) : "—"}</strong>
              </div>
            ))}
          </div>
          <aside className="summary-card">
            <h2>Ваш заказ</h2>
            <div className="summary-line">
              <span>Товары, {entries.reduce((a, [, q]) => a + q, 0)} шт.</span>
              <b>
                {money(
                  rows.reduce((s, x) => s + (x.p?.price || 0) * x.quantity, 0),
                )}
              </b>
            </div>
            <div className="summary-line">
              <span>Доставка</span>
              <span>По договорённости</span>
            </div>
            <div className="summary-total">
              <b>Итого</b>
              <b>
                {money(
                  rows.reduce((s, x) => s + (x.p?.price || 0) * x.quantity, 0),
                )}
              </b>
            </div>
            {!user ? (
              <button
                className="button primary full"
                onClick={loginForCheckout}
              >
                Войти для оформления
              </button>
            ) : (
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  if (!key.current) key.current = crypto.randomUUID();
                  await checkout({
                    ...form,
                    key: key.current,
                    items: rows.map((x) => ({
                      id: x.id,
                      quantity: x.quantity,
                      price: x.p.price,
                    })),
                  });
                  setBusy(false);
                }}
              >
                <h3>Получатель</h3>
                <Field
                  required
                  label="Имя"
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
                <Field
                  required
                  label="Телефон"
                  type="tel"
                  maxLength={40}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
                <Field
                  required
                  label="Адрес доставки"
                  maxLength={500}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                />
                <label className="field">
                  <span>Комментарий к заказу</span>
                  <textarea
                    maxLength={1000}
                    value={form.comment}
                    onChange={(e) => set("comment", e.target.value)}
                  />
                </label>
                <button
                  disabled={busy || invalid}
                  className="button primary full"
                >
                  {busy ? "Оформляем…" : "Оформить заказ"}
                </button>
                {invalid && (
                  <p className="warning">Проверьте товары и их количество.</p>
                )}
              </form>
            )}
            <p className="fineprint">
              Заказ оформляется без онлайн-оплаты. Детали доставки и расчёта
              согласуйте с продавцом.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}
export function Orders({ orders, items, go, changeStatus }) {
  return (
    <>
      <Breadcrumb go={go}>Мои заказы</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">ВАШИ ПОКУПКИ</span>
        <h1>Мои заказы</h1>
      </div>
      {!orders.length ? (
        <Empty
          title="Заказов пока нет"
          text="Здесь появятся ваши покупки и их статусы."
        >
          <button className="button primary" onClick={() => go("catalog")}>
            Открыть каталог
          </button>
        </Empty>
      ) : (
        <div className="orders-list">
          {orders.map((o) => (
            <section className="order-card" key={o.id}>
              <div className="order-header">
                <div>
                  <h3>Заказ № {o.id}</h3>
                  <span>
                    {date(o.created_at)} · {o.address}
                  </span>
                </div>
                <strong>
                  {money(
                    items
                      .filter(
                        (i) => i.order_id === o.id && i.status !== "cancelled",
                      )
                      .reduce((sum, i) => sum + i.price * i.quantity, 0),
                  )}
                </strong>
              </div>
              {items
                .filter((i) => i.order_id === o.id)
                .map((i) => (
                  <OrderItem key={i.id} item={i} go={go}>
                    {i.status === "new" && (
                      <button
                        className="text-button"
                        onClick={() =>
                          changeStatus(i.id, "cancelled", "orders")
                        }
                      >
                        Отменить товар
                      </button>
                    )}
                    {i.status === "shipped" && (
                      <button
                        className="text-button"
                        onClick={() =>
                          changeStatus(i.id, "completed", "orders")
                        }
                      >
                        Подтвердить получение
                      </button>
                    )}
                    {i.status === "completed" && (
                      <NavLink page="product" id={i.product_id} go={go}>
                        Оставить отзыв
                      </NavLink>
                    )}
                  </OrderItem>
                ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
export function Chat({ data, user, go, sendMessage }) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  if (!data) return <p className="loading">Загружаем переписку…</p>;
  return (
    <>
      <Breadcrumb go={go}>Сообщения</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">ЗАКАЗ № {data.item.order_id}</span>
        <h1>Переписка</h1>
        <p>
          {data.item.product_name} · {data.item.seller}
        </p>
      </div>
      <section className="chat-card">
        <div className="chat-messages">
          {!data.messages.length && (
            <Empty
              icon="message"
              title="Начните диалог"
              text="Здесь можно согласовать доставку и уточнить детали заказа."
            />
          )}
          {data.messages.map((m) => (
            <div
              className={"message " + (m.sender_id === user.id ? "mine" : "")}
              key={m.id}
            >
              <b>{m.sender}</b>
              <p>{m.body}</p>
              <span>{date(m.created_at)}</span>
            </div>
          ))}
        </div>
        <form
          className="chat-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            if (await sendMessage(data.item.id, message)) setMessage("");
            setBusy(false);
          }}
        >
          <input
            aria-label="Сообщение"
            required
            maxLength={2000}
            placeholder="Напишите сообщение"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button className="button primary" disabled={busy}>
            <MessageCircle size={17} /> Отправить
          </button>
        </form>
      </section>
    </>
  );
}
