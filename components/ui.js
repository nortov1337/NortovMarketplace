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
          <span>Buy from independent sellers</span>
          <div>
            <NavLink page="seller" go={go}>
              Sell ​​on antitrump
            </NavLink>
            <NavLink page="help" go={go}>
              Help
            </NavLink>
            {user?.is_admin ? (
              <NavLink page="admin" go={go}>
                Administration
              </NavLink>
            ) : null}
          </div>
        </div>
      </div>
      <header className="site-header">
        <div className="wrap header-inner">
          <NavLink page="catalog" go={go} className="brand">
            antitrump<span>.</span>
          </NavLink>
          <button
            className="catalog-button"
            aria-label="Catalog"
            onClick={() => go("catalog")}
          >
            <Menu size={20} />
            <span>Catalog</span>
          </button>
          <label className="search-box">
            <Search size={21} />
            <input
              aria-label="Search for products"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                go("catalog");
              }}
              placeholder="Find anything"
            />
            <kbd>Search</kbd>
          </label>
          <nav className="header-actions" aria-label="Main navigation">
            <NavLink page="favorites" go={go}>
              <span className="icon-wrap">
                <Heart size={23} />
                {favoriteCount > 0 && <b>{favoriteCount}</b>}
              </span>
              <small>Favorites</small>
            </NavLink>
            <NavLink page="cart" go={go}>
              <span className="icon-wrap">
                <ShoppingBag size={23} />
                {count > 0 && <b>{count}</b>}
              </span>
              <small>Basket</small>
            </NavLink>
            <NavLink page={user ? "account" : "auth"} go={go}>
              <UserRound size={23} />
              <small>{user ? "Account" : "Sign in"}</small>
            </NavLink>
          </nav>
        </div>
      </header>
    </>
  );
}
export function ProductCard({ p, go, favorite, toggleFavorite, add }) {
  return (
    <article className="product-card">
      <div className="product-image">
        <NavLink page="product" id={p.id} go={go} aria-label={"Open " + p.name}>
          {p.image ? (
            <img src={p.image} alt="" loading="lazy" />
          ) : (
            <div className="image-placeholder">
              <ShoppingBag size={48} />
              <span>antitrump.</span>
            </div>
          )}
        </NavLink>
        <button
          className={"favorite " + (favorite ? "selected" : "")}
          onClick={() => toggleFavorite(p.id)}
          aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={favorite}
        >
          <Heart size={19} fill={favorite ? "currentColor" : "none"} />
        </button>
        {!p.stock && <span className="sold-out">Not available</span>}
      </div>
      <div className="product-info">
        <strong className="product-price">{money(p.price)}</strong>
        <NavLink page="product" id={p.id} go={go} className="product-name">
          {p.name}
        </NavLink>
        <span className="product-seller">{p.seller}</span>
        <div className="rating">
          <Star size={14} fill="currentColor" />
          {p.rating || "New product"}
          {p.review_count > 0 && <span> · {p.review_count} reviews</span>}
        </div>
        <button
          className="product-add"
          disabled={!p.stock}
          onClick={() => add(p)}
        >
          {p.stock ? "Add to cart" : "Not available"}
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
        Home
      </NavLink>
      <ChevronRight size={14} />
      <span>{children}</span>
    </div>
  );
}
export function Back({ go, page = "catalog", children = "Back" }) {
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
          {item.quantity} pcs. · {money(item.price)} · {item.seller}
        </span>
        <div className="order-item-actions">
          <Status value={item.status} />
          <NavLink page="chat" id={item.id} go={go}>
            <MessageCircle size={15} /> Write
          </NavLink>
        </div>
        {item.tracking && <span>Track number: {item.tracking}</span>}
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
      <button onClick={dismiss} aria-label="Close">
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
      <h3>Unavailable products</h3>
      {unavailable.map((id) => (
        <div className="admin-row" key={id}>
          <span>Product № {id} no longer sold</span>
          <button className="text-button" onClick={() => toggleFavorite(id)}>
            Remove from favorites
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
