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
      <Breadcrumb go={go}>Basket</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">YOUR CHOICE</span>
        <h1>Basket</h1>
      </div>
      {!rows.length ? (
        <Empty
          title="The cart is still empty"
          text="Take a look at the catalog - there may already be something for you there."
        >
          <button className="button primary" onClick={() => go("catalog")}>
            Go to catalog
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
                  <b>{p ? p.name : "Product no longer available"}</b>
                  <span>{p ? p.seller : "Remove item from cart"}</span>
                  {p && p.stock < quantity && (
                    <span className="warning">Available: {p.stock} pcs.</span>
                  )}
                  {p && p.seller_id === user?.id && (
                    <span className="warning">
                      You cannot order your own product
                    </span>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      key.current = null;
                      updateCart(id, 0);
                    }}
                  >
                    Delete
                  </button>
                </div>
                <div className="quantity">
                  <button
                    aria-label="Reduce quantity"
                    onClick={() => {
                      key.current = null;
                      updateCart(id, quantity - 1);
                    }}
                  >
                    <Minus size={15} />
                  </button>
                  <span>{quantity}</span>
                  <button
                    aria-label="Increase quantity"
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
            <h2>Your order</h2>
            <div className="summary-line">
              <span>Goods, {entries.reduce((a, [, q]) => a + q, 0)} pcs.</span>
              <b>
                {money(
                  rows.reduce((s, x) => s + (x.p?.price || 0) * x.quantity, 0),
                )}
              </b>
            </div>
            <div className="summary-line">
              <span>Delivery</span>
              <span>By agreement</span>
            </div>
            <div className="summary-total">
              <b>Total</b>
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
                Sign in to checkout
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
                <h3>Recipient</h3>
                <Field
                  required
                  label="Name"
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
                <Field
                  required
                  label="Telephone"
                  type="tel"
                  maxLength={40}
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
                <Field
                  required
                  label="Delivery address"
                  maxLength={500}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                />
                <label className="field">
                  <span>Comments on the order</span>
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
                  {busy ? "We are preparing…" : "Place an order"}
                </button>
                {invalid && (
                  <p className="warning">Check products and their quantity.</p>
                )}
              </form>
            )}
            <p className="fineprint">
              This order has no online payment. Arrange delivery and payment
              with the seller.
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
      <Breadcrumb go={go}>My orders</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">YOUR PURCHASES</span>
        <h1>My orders</h1>
      </div>
      {!orders.length ? (
        <Empty
          title="No orders yet"
          text="Your purchases and their statuses will appear here."
        >
          <button className="button primary" onClick={() => go("catalog")}>
            Open catalog
          </button>
        </Empty>
      ) : (
        <div className="orders-list">
          {orders.map((o) => (
            <section className="order-card" key={o.id}>
              <div className="order-header">
                <div>
                  <h3>Order № {o.id}</h3>
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
                        Cancel item
                      </button>
                    )}
                    {i.status === "shipped" && (
                      <button
                        className="text-button"
                        onClick={() =>
                          changeStatus(i.id, "completed", "orders")
                        }
                      >
                        Confirm receipt
                      </button>
                    )}
                    {i.status === "completed" && (
                      <NavLink page="product" id={i.product_id} go={go}>
                        Leave feedback
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
  if (!data) return <p className="loading">Loading correspondence...</p>;
  return (
    <>
      <Breadcrumb go={go}>Messages</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">ORDER № {data.item.order_id}</span>
        <h1>Correspondence</h1>
        <p>
          {data.item.product_name} · {data.item.seller}
        </p>
      </div>
      <section className="chat-card">
        <div className="chat-messages">
          {!data.messages.length && (
            <Empty
              icon="message"
              title="Start a dialogue"
              text="Here you can coordinate delivery and clarify order details."
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
            aria-label="Message"
            required
            maxLength={2000}
            placeholder="Write a message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <button className="button primary" disabled={busy}>
            <MessageCircle size={17} /> Send
          </button>
        </form>
      </section>
    </>
  );
}
