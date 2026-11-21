"use client";
import { useState } from "react";
import { DescriptionField } from "./description";
import {
  Breadcrumb,
  Field,
  Store,
  Package,
  UserRound,
  Shield,
  NavLink,
  Empty,
  OrderItem,
} from "./ui";
import { money, date, sellerNext } from "@/lib/client";

export function Auth({ mode, setMode, config, submit, token }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" }),
    [busy, setBusy] = useState(false);
  const change = (key, value) => setForm({ ...form, [key]: value });
  const heading =
    {
      login: "Welcome back",
      register: "Create an account",
      forgot: "Password recovery",
      resendVerification: "Email confirmation",
      reset: "New Password",
      verify: "Email confirmation",
    }[mode] || "Entrance";
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="eyebrow">WELCOME TO ANTITRUMP</span>
        <h1>{heading}</h1>
        <p className="muted">
          {mode === "login"
            ? "Sign in to track your orders and save your favorite items."
            : mode === "register"
              ? "One account for purchases and sales."
              : mode === "verify"
                ? "Confirm your email to continue."
                : "Provide data to restore access."}
        </p>
        <form
          className="form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await submit(mode, { ...form, token });
            setBusy(false);
          }}
        >
          {mode === "register" && (
            <Field
              label="your name"
              required
              minLength={2}
              maxLength={80}
              value={form.name}
              onChange={(e) => change("name", e.target.value)}
              autoComplete="name"
            />
          )}
          {["register", "login", "forgot", "resendVerification"].includes(
            mode,
          ) && (
            <Field
              label="E-mail"
              required
              type="email"
              maxLength={254}
              value={form.email}
              onChange={(e) => change("email", e.target.value)}
              autoComplete="email"
            />
          )}
          {["login", "register", "reset"].includes(mode) && (
            <Field
              label={mode === "reset" ? "New Password" : "Password"}
              required
              type="password"
              minLength={8}
              maxLength={128}
              value={form.password}
              onChange={(e) => change("password", e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          )}
          <button disabled={busy} className="button primary full">
            {busy
              ? "Wait…"
              : mode === "login"
                ? "Sign in"
                : mode === "register"
                  ? "Register"
                  : mode === "verify"
                    ? "Confirm email"
                    : mode === "reset"
                      ? "Save password"
                      : "Send a letter"}
          </button>
        </form>
        <div className="auth-switch">
          {mode === "login" ? (
            <>
              Don’t have an account?{" "}
              <button onClick={() => setMode("register")}>Register</button>
            </>
          ) : (
            <button onClick={() => setMode("login")}>Back to sign in</button>
          )}
        </div>
        {mode === "login" && config.mailConfigured && (
          <div className="auth-extra">
            <button onClick={() => setMode("forgot")}>
              Forgot your password?
            </button>
            {config.verificationRequired && (
              <button onClick={() => setMode("resendVerification")}>
                Resend confirmation
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export function Account({ user, go, submit, logout }) {
  const [name, setName] = useState(user.name),
    [currentPassword, setCurrent] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Breadcrumb go={go}>Personal account</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">PERSONAL ACCOUNT</span>
        <h1>Hello, {user.name}</h1>
        <p>{user.email}</p>
      </div>
      <div className="account-grid">
        <div className="account-links">
          <button onClick={() => go("orders")}>
            <Package />{" "}
            <span>
              <b>My orders</b>
              <small>Purchases and their statuses</small>
            </span>
          </button>
          <button onClick={() => go("seller")}>
            <Store />{" "}
            <span>
              <b>Seller’s account</b>
              <small>Products and customer orders</small>
            </span>
          </button>
          {!!user.is_admin && (
            <button onClick={() => go("admin")}>
              <Shield />{" "}
              <span>
                <b>Site management</b>
                <small>Moderation and users</small>
              </span>
            </button>
          )}
          <button onClick={logout}>
            <UserRound />{" "}
            <span>
              <b>Log out of your account</b>
              <small>End current session</small>
            </span>
          </button>
        </div>
        <div className="stack">
          <form
            className="surface form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              await submit("profile", { name });
              setBusy(false);
            }}
          >
            <h3>Personal information</h3>
            <Field
              label="Name"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="button secondary" disabled={busy}>
              Save
            </button>
          </form>
          <form
            className="surface form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (await submit("password", { currentPassword, password })) {
                setCurrent("");
                setPassword("");
              }
              setBusy(false);
            }}
          >
            <h3>Change password</h3>
            <Field
              label="Current Password"
              type="password"
              required
              maxLength={128}
              value={currentPassword}
              onChange={(e) => setCurrent(e.target.value)}
            />
            <Field
              label="New Password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="button secondary" disabled={busy}>
              Update password
            </button>
            <p className="fineprint">
              After changing your password, you will need to log in again on all
              devices.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
const initial = {
  name: "",
  description: "",
  category: "",
  price: "",
  stock: "",
  image: "",
};
export function Seller({
  data,
  go,
  saveProduct,
  saveStore,
  changeActive,
  changeStatus,
  upload,
}) {
  const [tab, setTab] = useState("products"),
    [product, setProduct] = useState(initial),
    [store, setStore] = useState(null),
    [busy, setBusy] = useState(false),
    [tracking, setTracking] = useState({});
  if (!data) return <p className="loading">Loading your account...</p>;
  const originalCategory = data.products.find(
    (item) => item.id === product.id,
  )?.category;
  const profile = store || {
    name: data.profile.store_name,
    description: data.profile.description,
  };
  const edit = (key, value) => setProduct({ ...product, [key]: value });
  return (
    <>
      <Breadcrumb go={go}>Seller’s account</Breadcrumb>
      <div className="page-heading seller-heading">
        <div>
          <span className="eyebrow">SELL ON ANTITRUMP</span>
          <h1>Seller’s account</h1>
          <p>Manage products, orders and your store.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setProduct(initial);
            setTab("edit");
          }}
        >
          Add product
        </button>
      </div>
      <div className="dashboard-stats">
        <div>
          <span>Goods</span>
          <strong>{data.products.length}</strong>
        </div>
        <div>
          <span>On sale</span>
          <strong>
            {
              data.products.filter(
                (p) => p.active && p.moderation === "approved",
              ).length
            }
          </strong>
        </div>
        <div>
          <span>New orders</span>
          <strong>{data.items.filter((i) => i.status === "new").length}</strong>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {[
          ["products", "Goods"],
          ["orders", "Orders"],
          ["store", "Shop"],
          ...(tab === "edit"
            ? [["edit", product.id ? "Change product" : "New product"]]
            : []),
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            key={id}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "products" &&
        (!data.products.length ? (
          <Empty
            icon="store"
            title="Add your first product"
            text="Include description, price and balance so that buyers can find the product."
          >
            <button
              className="button primary"
              onClick={() => {
                setProduct(initial);
                setTab("edit");
              }}
            >
              Add product
            </button>
          </Empty>
        ) : (
          <div className="seller-list">
            {data.products.map((p) => (
              <div className="seller-row" key={p.id}>
                <div className="cart-thumb">
                  {p.image ? <img src={p.image} alt="" /> : <Package />}
                </div>
                <div className="seller-product">
                  <b>{p.name}</b>
                  <span>
                    {money(p.price)} · {p.stock} pcs. ·{" "}
                    {p.moderation === "hidden"
                      ? "Hidden by moderator"
                      : p.active
                        ? "On sale"
                        : "Out of stock"}
                  </span>
                </div>
                <div className="row-buttons">
                  <button
                    className="button ghost"
                    onClick={() => {
                      setProduct(p);
                      setTab("edit");
                    }}
                  >
                    Change
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => changeActive(p)}
                  >
                    {p.active ? "Remove from sale" : "Return to sale"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      {tab === "edit" && (
        <form
          className="surface form product-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            if (await saveProduct(product)) {
              setProduct(initial);
              setTab("products");
            }
            setBusy(false);
          }}
        >
          <h2>{product.id ? "Editing a product" : "New product"}</h2>
          <Field
            label="Product name"
            required
            minLength={2}
            maxLength={120}
            value={product.name}
            onChange={(e) => edit("name", e.target.value)}
          />
          <label className="field">
            <span>Category</span>
            <select
              required
              value={product.category}
              onChange={(e) => edit("category", e.target.value)}
            >
              <option value="" disabled>
                {data.categories.length
                  ? "Choose a category"
                  : "No active categories"}
              </option>
              {originalCategory &&
                !data.categories.includes(originalCategory) && (
                  <option value={originalCategory}>
                    {originalCategory} (archived)
                  </option>
                )}
              {data.categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <DescriptionField
            label="Description"
            required
            minLength={3}
            maxLength={3000}
            value={product.description}
            onChange={(description) => edit("description", description)}
          />
          <div className="form-two">
            <Field
              label="Price, ₽"
              type="number"
              min="1"
              max="100000000"
              required
              value={product.price}
              onChange={(e) => edit("price", e.target.value)}
            />
            <Field
              label="Quantity"
              type="number"
              min="0"
              max="1000000"
              required
              value={product.stock}
              onChange={(e) => edit("stock", e.target.value)}
            />
          </div>
          <label className="field">
            <span>Photo</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setBusy(true);
                  const image = await upload(file);
                  if (image) setProduct((p) => ({ ...p, image }));
                  setBusy(false);
                }
              }}
            />
          </label>
          <Field
            label="Or link to image (https)"
            value={product.image}
            maxLength={1000}
            onChange={(e) => edit("image", e.target.value)}
          />
          {product.image && (
            <div className="upload-preview">
              <img src={product.image} alt="Product preview" />
            </div>
          )}
          <div className="row-buttons">
            <button className="button primary" disabled={busy}>
              {busy ? "Let’s save..." : "Save product"}
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={() => setTab("products")}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
      {tab === "store" && (
        <form
          className="surface form product-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            await saveStore(profile);
            setBusy(false);
          }}
        >
          <h2>Your store</h2>
          <Field
            label="Store name"
            required
            minLength={2}
            maxLength={80}
            value={profile.name}
            onChange={(e) => setStore({ ...profile, name: e.target.value })}
          />
          <DescriptionField
            label="About the store"
            maxLength={1000}
            value={profile.description}
            onChange={(description) => setStore({ ...profile, description })}
          />
          <button className="button primary" disabled={busy}>
            Save
          </button>
        </form>
      )}
      {tab === "orders" &&
        (!data.items.length ? (
          <Empty
            title="No new orders yet"
            text="When the buyer places an order, it will appear here."
          />
        ) : (
          <div className="orders-list">
            {data.items.map((i) => (
              <section className="order-card" key={i.id}>
                <div className="order-header">
                  <div>
                    <h3>Order № {i.order_id}</h3>
                    <span>
                      {date(i.created_at)} · {i.recipient}
                    </span>
                  </div>
                </div>
                <OrderItem item={i} go={go}>
                  <div className="seller-contact">
                    <span>{i.phone}</span>
                    <span>{i.address}</span>
                    {i.comment && <span>Comment: {i.comment}</span>}
                  </div>
                  {i.status === "accepted" && (
                    <Field
                      label="Track number (if available))"
                      maxLength={100}
                      value={tracking[i.id] || ""}
                      onChange={(e) =>
                        setTracking({ ...tracking, [i.id]: e.target.value })
                      }
                    />
                  )}
                  <div className="row-buttons">
                    {(sellerNext[i.status] || []).map(([value, label]) => (
                      <button
                        className="button secondary small"
                        key={value}
                        onClick={() =>
                          changeStatus(
                            i.id,
                            value,
                            "seller",
                            tracking[i.id] || "",
                          )
                        }
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </OrderItem>
              </section>
            ))}
          </div>
        ))}
    </>
  );
}
export function Help({ go }) {
  return (
    <>
      <Breadcrumb go={go}>Help</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">IT’S SIMPLE</span>
        <h1>How does this work</h1>
      </div>
      <div className="help-grid">
        <article className="surface">
          <span className="eyebrow">FOR BUYERS</span>
          <h2>Choose and order</h2>
          <p>
            Add items to your cart and enter your contact details and address.
            After placing the order, message the seller to arrange delivery and
            payment.
          </p>
          <p>
            Once your order is shipped, confirm receipt and share your feedback.
            You can cancel an item before the seller accepts it.
          </p>
        </article>
        <article className="surface">
          <span className="eyebrow">FOR SELLERS</span>
          <h2>Open your store</h2>
          <p>
            Create an account, open the seller dashboard and add a product with
            a photo, description, price and quantity. Orders will appear in your
            dashboard.
          </p>
          <p>
            Contact the buyer, coordinate delivery and change the order status
            as it progresses. Online payment is not integrated.
          </p>
          <button className="button secondary" onClick={() => go("seller")}>
            Seller’s account
          </button>
        </article>
      </div>
    </>
  );
}
