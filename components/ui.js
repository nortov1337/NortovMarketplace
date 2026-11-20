"use client";
import {
  ShoppingBag,
  Search,
  Menu,
  Heart,
  UserRound,
  Package,
  Store,
  LogOut,
  Shield,
  X,
  ArrowLeft,
  Star,
  Minus,
  Plus,
  MessageCircle,
  ChevronRight,
} from "lucide-react";
import { money, statusNames, date, url } from "@/lib/client";

export function NavLink({ page, id, go, children, className = "", ...props }) {
  return (
    <a
      href={url(page, id)}
      className={className}
      onClick={(e) => {
        if (
          e.button === 0 &&
          !e.metaKey &&
          !e.ctrlKey &&
          !e.shiftKey &&
          !e.altKey
        ) {
          e.preventDefault();
          go(page, id);
        }
      }}
      {...props}
    >
      {children}
    </a>
  );
}
export function Header({ go, user, search, setSearch, count, favoriteCount }) {
  return (
    <>
      <div className="utility">
        <div className="wrap utility-inner">
          <span>Покупайте у независимых продавцов</span>
          <div>
            <NavLink page="seller" go={go}>
              Продавать на Nortov
            </NavLink>
            <NavLink page="help" go={go}>
              Помощь
            </NavLink>
          </div>
        </div>
      </div>
      <header className="site-header">
        <div className="wrap header-inner">
          <NavLink page="catalog" go={go} className="brand">
            nortov<span>.</span>
          </NavLink>
          <button className="catalog-button" onClick={() => go("catalog")}>
            <Menu size={20} />
            <span>Каталог</span>
          </button>
          <label className="search-box">
            <Search size={21} />
            <input
              aria-label="Поиск товаров"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                go("catalog");
              }}
              placeholder="Найти что угодно"
            />
            <kbd>Поиск</kbd>
          </label>
          <nav className="header-actions" aria-label="Основная навигация">
            <NavLink page="favorites" go={go}>
              <span className="icon-wrap">
                <Heart size={23} />
                {favoriteCount > 0 && <b>{favoriteCount}</b>}
              </span>
              <small>Избранное</small>
            </NavLink>
            <NavLink page="cart" go={go}>
              <span className="icon-wrap">
                <ShoppingBag size={23} />
                {count > 0 && <b>{count}</b>}
              </span>
              <small>Корзина</small>
            </NavLink>
            <NavLink page={user ? "account" : "auth"} go={go}>
              <UserRound size={23} />
              <small>{user ? "Кабинет" : "Войти"}</small>
            </NavLink>
          </nav>
        </div>
      </header>
    </>
  );
}
export function Footer({ go }) {
  return (
    <footer className="footer">
      <div className="wrap footer-grid">
        <div>
          <NavLink page="catalog" go={go} className="brand footer-brand">
            nortov<span>.</span>
          </NavLink>
          <p>
            Маркетплейс хороших находок
            <br />
            на каждый день.
          </p>
        </div>
        <div>
          <b>Покупателям</b>
          <NavLink page="catalog" go={go}>
            Каталог
          </NavLink>
          <NavLink page="orders" go={go}>
            Мои заказы
          </NavLink>
          <NavLink page="help" go={go}>
            Как это работает
          </NavLink>
        </div>
        <div>
          <b>Продавцам</b>
          <NavLink page="seller" go={go}>
            Личный кабинет
          </NavLink>
          <NavLink page="help" go={go}>
            Заказы и доставка
          </NavLink>
        </div>
        <div>
          <b>Аккаунт</b>
          <NavLink page="account" go={go}>
            Мой профиль
          </NavLink>
          <NavLink page="favorites" go={go}>
            Избранное
          </NavLink>
          <NavLink page="cart" go={go}>
            Корзина
          </NavLink>
        </div>
      </div>
      <div className="wrap footer-bottom">
        © {new Date().getFullYear()} Nortov{" "}
        <span>Сделано для хороших покупок</span>
      </div>
    </footer>
  );
}
export function ProductCard({ p, go, favorite, toggleFavorite, add }) {
  return (
    <article className="product-card">
      <div className="product-image">
        <NavLink
          page="product"
          id={p.id}
          go={go}
          aria-label={"Открыть " + p.name}
        >
          {p.image ? (
            <img src={p.image} alt="" loading="lazy" />
          ) : (
            <div className="image-placeholder">
              <ShoppingBag size={48} />
              <span>nortov.</span>
            </div>
          )}
        </NavLink>
        <button
          className={"favorite " + (favorite ? "selected" : "")}
          onClick={() => toggleFavorite(p.id)}
          aria-label={
            favorite ? "Убрать из избранного" : "Добавить в избранное"
          }
          aria-pressed={favorite}
        >
          <Heart size={19} fill={favorite ? "currentColor" : "none"} />
        </button>
        {!p.stock && <span className="sold-out">Нет в наличии</span>}
      </div>
      <div className="product-info">
        <strong className="product-price">{money(p.price)}</strong>
        <NavLink page="product" id={p.id} go={go} className="product-name">
          {p.name}
        </NavLink>
        <span className="product-seller">{p.seller}</span>
        <div className="rating">
          <Star size={14} fill="currentColor" />
          {p.rating || "Новый товар"}
          {p.review_count > 0 && <span> · {p.review_count} отзывов</span>}
        </div>
        <button
          className="product-add"
          disabled={!p.stock}
          onClick={() => add(p)}
        >
          {p.stock ? "В корзину" : "Нет в наличии"}
        </button>
      </div>
    </article>
  );
}
export function Empty({ icon = "bag", title, text, children }) {
  const Icon =
    icon === "heart"
      ? Heart
      : icon === "user"
        ? UserRound
        : icon === "store"
          ? Store
          : icon === "message"
            ? MessageCircle
            : ShoppingBag;
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={28} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Breadcrumb({ go, children }) {
  return (
    <div className="breadcrumb">
      <NavLink page="catalog" go={go}>
        Главная
      </NavLink>
      <ChevronRight size={14} />
      <span>{children}</span>
    </div>
  );
}
export function Back({ go, page = "catalog", children = "Назад" }) {
  return (
    <button className="back-link" onClick={() => go(page)}>
      <ArrowLeft size={16} />
      {children}
    </button>
  );
}
export function Status({ value }) {
  return (
    <span className={"status status-" + value}>
      {statusNames[value] || value}
    </span>
  );
}
export function OrderItem({ item, go, children }) {
  return (
    <div className="order-item">
      <div className="order-thumb">
        {item.image ? <img src={item.image} alt="" /> : <Package size={25} />}
      </div>
      <div className="order-item-main">
        <strong>{item.product_name}</strong>
        <span>
          {item.quantity} шт. · {money(item.price)} · {item.seller}
        </span>
        <div className="order-item-actions">
          <Status value={item.status} />
          <NavLink page="chat" id={item.id} go={go}>
            <MessageCircle size={15} /> Написать
          </NavLink>
        </div>
        {item.tracking && <span>Трек-номер: {item.tracking}</span>}
        {children}
      </div>
      <b>{money(item.price * item.quantity)}</b>
    </div>
  );
}
export function Field({ label, ...props }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}
export function Alert({ message, type = "error", dismiss }) {
  if (!message) return null;
  return (
    <div className={"alert " + type} role="status">
      <span>{message}</span>
      <button onClick={dismiss} aria-label="Закрыть">
        <X size={17} />
      </button>
    </div>
  );
}
export function MissingFavorites({ favorites, products, toggleFavorite }) {
  const unavailable = favorites.filter(
    (id) => !products.some((p) => p.id === id),
  );
  if (!unavailable.length) return null;
  return (
    <section className="unavailable-favorites">
      <h3>Недоступные товары</h3>
      {unavailable.map((id) => (
        <div className="admin-row" key={id}>
          <span>Товар № {id} больше не продаётся</span>
          <button className="text-button" onClick={() => toggleFavorite(id)}>
            Убрать из избранного
          </button>
        </div>
      ))}
    </section>
  );
}
export {
  ShoppingBag,
  Heart,
  UserRound,
  Package,
  Store,
  LogOut,
  Shield,
  Star,
  Minus,
  Plus,
  MessageCircle,
  ChevronRight,
  Search,
};
