"use client";
import { useState } from "react";
import { ReportList } from "./reports";
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
      login: "С возвращением",
      register: "Создать аккаунт",
      forgot: "Восстановление пароля",
      resendVerification: "Подтверждение почты",
      reset: "Новый пароль",
      verify: "Подтверждение почты",
    }[mode] || "Вход";
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <span className="eyebrow">ДОБРО ПОЖАЛОВАТЬ В NORTOV</span>
        <h1>{heading}</h1>
        <p className="muted">
          {mode === "login"
            ? "Войдите, чтобы следить за заказами и сохранять любимые товары."
            : mode === "register"
              ? "Один аккаунт для покупок и продаж."
              : mode === "verify"
                ? "Подтвердите почту, чтобы продолжить."
                : "Укажите данные для восстановления доступа."}
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
              label="Ваше имя"
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
              label="Электронная почта"
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
              label={mode === "reset" ? "Новый пароль" : "Пароль"}
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
              ? "Подождите…"
              : mode === "login"
                ? "Войти"
                : mode === "register"
                  ? "Зарегистрироваться"
                  : mode === "verify"
                    ? "Подтвердить почту"
                    : mode === "reset"
                      ? "Сохранить пароль"
                      : "Отправить письмо"}
          </button>
        </form>
        <div className="auth-switch">
          {mode === "login" ? (
            <>
              Нет аккаунта?{" "}
              <button onClick={() => setMode("register")}>
                Зарегистрироваться
              </button>
            </>
          ) : (
            <button onClick={() => setMode("login")}>Вернуться ко входу</button>
          )}
        </div>
        {mode === "login" && config.mailConfigured && (
          <div className="auth-extra">
            <button onClick={() => setMode("forgot")}>Забыли пароль?</button>
            {config.verificationRequired && (
              <button onClick={() => setMode("resendVerification")}>
                Отправить подтверждение повторно
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
      <Breadcrumb go={go}>Личный кабинет</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span>
        <h1>Здравствуйте, {user.name}</h1>
        <p>{user.email}</p>
      </div>
      <div className="account-grid">
        <div className="account-links">
          <button onClick={() => go("orders")}>
            <Package />{" "}
            <span>
              <b>Мои заказы</b>
              <small>Покупки и их статусы</small>
            </span>
          </button>
          <button onClick={() => go("seller")}>
            <Store />{" "}
            <span>
              <b>Кабинет продавца</b>
              <small>Товары и заказы покупателей</small>
            </span>
          </button>
          {!!user.is_admin && (
            <button onClick={() => go("admin")}>
              <Shield />{" "}
              <span>
                <b>Управление площадкой</b>
                <small>Модерация и пользователи</small>
              </span>
            </button>
          )}
          <button onClick={logout}>
            <UserRound />{" "}
            <span>
              <b>Выйти из аккаунта</b>
              <small>Завершить текущую сессию</small>
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
            <h3>Личные данные</h3>
            <Field
              label="Имя"
              required
              minLength={2}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="button secondary" disabled={busy}>
              Сохранить
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
            <h3>Изменить пароль</h3>
            <Field
              label="Текущий пароль"
              type="password"
              required
              maxLength={128}
              value={currentPassword}
              onChange={(e) => setCurrent(e.target.value)}
            />
            <Field
              label="Новый пароль"
              type="password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="button secondary" disabled={busy}>
              Обновить пароль
            </button>
            <p className="fineprint">
              После смены пароля потребуется войти снова на всех устройствах.
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
  if (!data) return <p className="loading">Загружаем кабинет…</p>;
  const profile = store || {
    name: data.profile.store_name,
    description: data.profile.description,
  };
  const edit = (key, value) => setProduct({ ...product, [key]: value });
  return (
    <>
      <Breadcrumb go={go}>Кабинет продавца</Breadcrumb>
      <div className="page-heading seller-heading">
        <div>
          <span className="eyebrow">ПРОДАВАЙТЕ НА NORTOV</span>
          <h1>Кабинет продавца</h1>
          <p>Управляйте товарами, заказами и своим магазином.</p>
        </div>
        <button
          className="button primary"
          onClick={() => {
            setProduct(initial);
            setTab("edit");
          }}
        >
          Добавить товар
        </button>
      </div>
      <div className="dashboard-stats">
        <div>
          <span>Товары</span>
          <strong>{data.products.length}</strong>
        </div>
        <div>
          <span>В продаже</span>
          <strong>
            {
              data.products.filter(
                (p) => p.active && p.moderation === "approved",
              ).length
            }
          </strong>
        </div>
        <div>
          <span>Новые заказы</span>
          <strong>{data.items.filter((i) => i.status === "new").length}</strong>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {[
          ["products", "Товары"],
          ["orders", "Заказы"],
          ["store", "Магазин"],
          ...(tab === "edit"
            ? [["edit", product.id ? "Изменить товар" : "Новый товар"]]
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
            title="Добавьте первый товар"
            text="Укажите описание, цену и остаток, чтобы покупатели могли найти товар."
          >
            <button
              className="button primary"
              onClick={() => {
                setProduct(initial);
                setTab("edit");
              }}
            >
              Добавить товар
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
                    {money(p.price)} · {p.stock} шт. ·{" "}
                    {p.moderation === "hidden"
                      ? "Скрыт модератором"
                      : p.active
                        ? "В продаже"
                        : "Снят с продажи"}
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
                    Изменить
                  </button>
                  <button
                    className="button secondary"
                    onClick={() => changeActive(p)}
                  >
                    {p.active ? "Снять с продажи" : "Вернуть в продажу"}
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
          <h2>{product.id ? "Редактирование товара" : "Новый товар"}</h2>
          <Field
            label="Название товара"
            required
            minLength={2}
            maxLength={120}
            value={product.name}
            onChange={(e) => edit("name", e.target.value)}
          />
          <Field
            label="Категория"
            required
            minLength={2}
            maxLength={80}
            placeholder="Например, Для дома"
            value={product.category}
            onChange={(e) => edit("category", e.target.value)}
          />
          <label className="field">
            <span>Описание</span>
            <textarea
              required
              minLength={3}
              maxLength={3000}
              value={product.description}
              onChange={(e) => edit("description", e.target.value)}
            />
          </label>
          <div className="form-two">
            <Field
              label="Цена, ₽"
              type="number"
              min="1"
              max="100000000"
              required
              value={product.price}
              onChange={(e) => edit("price", e.target.value)}
            />
            <Field
              label="Количество"
              type="number"
              min="0"
              max="1000000"
              required
              value={product.stock}
              onChange={(e) => edit("stock", e.target.value)}
            />
          </div>
          <label className="field">
            <span>Фотография</span>
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
            label="Или ссылка на изображение (https)"
            value={product.image}
            maxLength={1000}
            onChange={(e) => edit("image", e.target.value)}
          />
          {product.image && (
            <div className="upload-preview">
              <img src={product.image} alt="Предпросмотр товара" />
            </div>
          )}
          <div className="row-buttons">
            <button className="button primary" disabled={busy}>
              {busy ? "Сохраняем…" : "Сохранить товар"}
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={() => setTab("products")}
            >
              Отмена
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
          <h2>Ваш магазин</h2>
          <Field
            label="Название магазина"
            required
            minLength={2}
            maxLength={80}
            value={profile.name}
            onChange={(e) => setStore({ ...profile, name: e.target.value })}
          />
          <label className="field">
            <span>О магазине</span>
            <textarea
              maxLength={1000}
              value={profile.description}
              onChange={(e) =>
                setStore({ ...profile, description: e.target.value })
              }
            />
          </label>
          <button className="button primary" disabled={busy}>
            Сохранить
          </button>
        </form>
      )}
      {tab === "orders" &&
        (!data.items.length ? (
          <Empty
            title="Новых заказов пока нет"
            text="Когда покупатель оформит заказ, он появится здесь."
          />
        ) : (
          <div className="orders-list">
            {data.items.map((i) => (
              <section className="order-card" key={i.id}>
                <div className="order-header">
                  <div>
                    <h3>Заказ № {i.order_id}</h3>
                    <span>
                      {date(i.created_at)} · {i.recipient}
                    </span>
                  </div>
                </div>
                <OrderItem item={i} go={go}>
                  <div className="seller-contact">
                    <span>{i.phone}</span>
                    <span>{i.address}</span>
                    {i.comment && <span>Комментарий: {i.comment}</span>}
                  </div>
                  {i.status === "accepted" && (
                    <Field
                      label="Трек-номер (если есть)"
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
export function Admin({ data, go, action }) {
  const [tab, setTab] = useState("products");
  if (!data) return <p className="loading">Загружаем данные…</p>;
  return (
    <>
      <Breadcrumb go={go}>Управление площадкой</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">УПРАВЛЕНИЕ ПЛОЩАДКОЙ</span>
        <h1>Модерация</h1>
        <p>Товары, пользователи и отзывы.</p>
      </div>
      <div className="tabs">
        {[
          ["reports", "Жалобы"],
          ["products", "Товары"],
          ["users", "Пользователи"],
          ["reviews", "Отзывы"],
        ].map(([id, name]) => (
          <button
            className={tab === id ? "active" : ""}
            key={id}
            onClick={() => setTab(id)}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="admin-list">
        {tab === "reports" && (
          <ReportList reports={data.reports} action={action} />
        )}{" "}
        {tab === "products" &&
          data.products.map((p) => (
            <div className="admin-row" key={p.id}>
              <div>
                <b>{p.name}</b>
                <p>
                  {p.seller} · {money(p.price)} ·{" "}
                  {p.moderation === "hidden" ? "Скрыт" : "Разрешён"}
                </p>
              </div>
              <button
                className="button secondary small"
                onClick={() =>
                  action("adminProduct", {
                    id: p.id,
                    moderation:
                      p.moderation === "hidden" ? "approved" : "hidden",
                  })
                }
              >
                {p.moderation === "hidden" ? "Разрешить" : "Скрыть"}
              </button>
            </div>
          ))}
        {tab === "users" &&
          data.users.map((u) => (
            <div className="admin-row" key={u.id}>
              <div>
                <b>{u.name}</b>
                <p>
                  {u.email} ·{" "}
                  {u.is_admin
                    ? "Администратор"
                    : u.suspended
                      ? "Заблокирован"
                      : "Активен"}
                </p>
              </div>
              {!u.is_admin && (
                <button
                  className="button secondary small"
                  onClick={() =>
                    action("adminUser", { id: u.id, suspended: !u.suspended })
                  }
                >
                  {u.suspended ? "Разблокировать" : "Заблокировать"}
                </button>
              )}
            </div>
          ))}
        {tab === "reviews" &&
          data.reviews.map((r) => (
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
                  if (window.confirm("Удалить отзыв?"))
                    action("adminReview", { id: r.id });
                }}
              >
                Удалить
              </button>
            </div>
          ))}
        {data[tab]?.length === 0 && <p className="muted">Здесь пока пусто.</p>}
      </div>
    </>
  );
}
export function Help({ go }) {
  return (
    <>
      <Breadcrumb go={go}>Помощь</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">ВСЁ ПРОСТО</span>
        <h1>Как это работает</h1>
      </div>
      <div className="help-grid">
        <article className="surface">
          <span className="eyebrow">ПОКУПАТЕЛЯМ</span>
          <h2>Выбирайте и заказывайте</h2>
          <p>
            Добавьте товары в корзину, укажите контактные данные и адрес. После
            оформления напишите продавцу в карточке заказа, чтобы согласовать
            получение и расчёт.
          </p>
          <p>
            После отправки подтвердите получение и поделитесь отзывом. Пока
            продавец не принял заказ, товар можно отменить в личном кабинете.
          </p>
        </article>
        <article className="surface">
          <span className="eyebrow">ПРОДАВЦАМ</span>
          <h2>Откройте свой магазин</h2>
          <p>
            Создайте аккаунт, перейдите в кабинет продавца и добавьте товар с
            фотографией, описанием, ценой и количеством. Заказы появятся в вашем
            кабинете.
          </p>
          <p>
            Свяжитесь с покупателем, согласуйте доставку и меняйте статус заказа
            по мере выполнения. Для онлайн-оплаты отдельная интеграция не
            подключена.
          </p>
          <button className="button secondary" onClick={() => go("seller")}>
            Кабинет продавца
          </button>
        </article>
      </div>
    </>
  );
}
