"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ReportForm } from "./reports";
import {
  ProductCard,
  Empty,
  Breadcrumb,
  NavLink,
  Heart,
  ShoppingBag,
  Star,
} from "./ui";
import { money, date } from "@/lib/client";

export function Catalog({
  products,
  categories = [],
  go,
  search,
  setSearch,
  category = null,
  setCategory,
  sort,
  setSort,
  favorites,
  toggleFavorite,
  add,
  onlyFavorites = false,
}) {
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const categoryBar = useRef(null);
  const [categoryScroll, setCategoryScroll] = useState({
    left: false,
    right: false,
  });
  const options = [
    ...new Set([...categories, ...products.map((p) => p.category)]),
  ];
  const categoryNames = JSON.stringify(options);
  const selected = options.includes(category) ? category : null;
  useEffect(() => {
    const bar = categoryBar.current;
    if (!bar) return;
    const updateScroll = () => {
      setCategoryScroll({
        left: bar.scrollLeft > 1,
        right: bar.scrollLeft + bar.clientWidth < bar.scrollWidth - 1,
      });
    };
    const observer = new ResizeObserver(updateScroll);
    observer.observe(bar);
    bar.addEventListener("scroll", updateScroll, { passive: true });
    updateScroll();
    return () => {
      observer.disconnect();
      bar.removeEventListener("scroll", updateScroll);
    };
  }, [categoryNames, onlyFavorites]);
  const term = search.toLowerCase().trim();
  const visible = products.filter(
    (p) =>
      (selected === null || selected === p.category) &&
      (!inStock || p.stock > 0) &&
      (maxPrice === "" || p.price <= Number(maxPrice)) &&
      `${p.name} ${p.description} ${p.seller} ${p.category}`
        .toLowerCase()
        .includes(term) &&
      (!onlyFavorites || favorites.includes(p.id)),
  );
  if (sort === "low") visible.sort((a, b) => a.price - b.price);
  else if (sort === "high") visible.sort((a, b) => b.price - a.price);
  else if (sort === "rating")
    visible.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return (
    <>
      {!onlyFavorites && (
        <>
          <div className="category-navigation">
            <button
              className="category-arrow"
              type="button"
              aria-label="Scroll categories left"
              disabled={!categoryScroll.left}
              onClick={() =>
                categoryBar.current?.scrollBy({
                  left: -categoryBar.current.clientWidth * 0.8,
                  behavior: "smooth",
                })
              }
            >
              <ChevronLeft size={20} />
            </button>
            <div
              className="category-bar"
              ref={categoryBar}
              aria-label="Categories"
            >
              {[null, ...options].map((c) => (
                <button
                  aria-pressed={selected === c}
                  className={selected === c ? "active" : ""}
                  key={c === null ? "all-products" : `category-${c}`}
                  onClick={() => setCategory(c)}
                >
                  {c ?? "All products"}
                </button>
              ))}
            </div>
            <button
              className="category-arrow"
              type="button"
              aria-label="Scroll categories right"
              disabled={!categoryScroll.right}
              onClick={() =>
                categoryBar.current?.scrollBy({
                  left: categoryBar.current.clientWidth * 0.8,
                  behavior: "smooth",
                })
              }
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <section className="hero">
            <div className="hero-content">
              <span className="hero-kicker">
                <span /> FIND YOURS
              </span>
              <h1>
                Everything
                <br />
                <em>you love.</em>
              </h1>
              <p>
                A place where good things and the people who choose them meet.
              </p>
              <button
                className="button light"
                onClick={() =>
                  document
                    .getElementById("catalog-list")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                View catalog
              </button>
            </div>
            <div className="hero-shape hero-shape-one" />
            <div className="hero-shape hero-shape-two" />
            <div className="hero-stamp">
              <ShoppingBag size={32} />
              <span>
                choose
                <br />
                with pleasure
              </span>
            </div>
            <div className="hero-label">
              GOOD THINGS
              <br />
              <b>NEAR.</b>
            </div>
          </section>
          <div className="benefit-bar">
            <span>Discover new stores</span>
            <span>Chat with sellers</span>
            <span>Choose at your own pace</span>
          </div>
        </>
      )}
      <section id="catalog-list" className="listing">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {onlyFavorites ? "YOUR SELECTION" : "FINDS FOR YOU"}
            </span>
            <h2>
              {onlyFavorites
                ? "Favorites"
                : search
                  ? `Search: ${search}`
                  : (selected ?? "Product catalog")}
            </h2>
            <p>
              {visible.length
                ? `${visible.length} products`
                : "Nothing found yet"}
            </p>
          </div>
          <label className="sort-label">
            Sorting{" "}
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="new">Newest first</option>
              <option value="low">Price: low to high</option>
              <option value="high">Price: high to low</option>
              <option value="rating">By rating</option>
            </select>
          </label>
        </div>
        <div className="catalog-filters">
          <label className="field">
            <span>Maximum price, ₽</span>
            <input
              type="number"
              min="0"
              step="1"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              placeholder="Any price"
            />
          </label>
          <label className="stock-filter">
            <input
              type="checkbox"
              checked={inStock}
              onChange={(e) => setInStock(e.target.checked)}
            />
            In stock only
          </label>
          {(term || selected !== null || maxPrice !== "" || inStock) && (
            <button
              className="button ghost small"
              onClick={() => {
                setSearch("");
                setCategory?.(null);
                setMaxPrice("");
                setInStock(false);
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        {visible.length ? (
          <div className="product-grid">
            {visible.map((p) => (
              <ProductCard
                key={p.id}
                p={p}
                go={go}
                favorite={favorites.includes(p.id)}
                toggleFavorite={toggleFavorite}
                add={add}
              />
            ))}
          </div>
        ) : (
          <Empty
            icon={onlyFavorites ? "heart" : "bag"}
            title={
              onlyFavorites && favorites.length === 0
                ? "Save what you like"
                : !products.length && !onlyFavorites
                  ? "Products coming here soon"
                  : "No matching products"
            }
            text={
              onlyFavorites && favorites.length === 0
                ? "Click on the heart on the product card to return to it later."
                : products.length || onlyFavorites
                  ? "Try changing your search or filters."
                  : "Sellers can add products in their personal account."
            }
          >
            {(onlyFavorites || products.length === 0) && (
              <button
                className="button secondary"
                onClick={() => go(onlyFavorites ? "catalog" : "seller")}
              >
                {onlyFavorites ? "Go to catalog" : "Open seller’s account"}
              </button>
            )}
          </Empty>
        )}
      </section>
    </>
  );
}
export function Product({
  detail,
  go,
  favorites,
  toggleFavorite,
  add,
  user,
  submitReview,
  submitReport,
}) {
  const [rating, setRating] = useState("5"),
    [text, setText] = useState(""),
    [busy, setBusy] = useState(false);
  if (!detail) return <p className="loading">Loading product...</p>;
  const { product: p, reviews, canReview } = detail;
  return (
    <>
      <Breadcrumb go={go}>{p.category}</Breadcrumb>
      <div className="detail-layout">
        <div className="detail-image">
          {p.image ? (
            <img src={p.image} alt={p.name} />
          ) : (
            <div className="image-placeholder">
              <ShoppingBag size={72} />
              <span>antitrump.</span>
            </div>
          )}
        </div>
        <div className="detail-body">
          <span className="eyebrow">{p.category.toUpperCase()}</span>
          <h1>{p.name}</h1>
          <div className="rating">
            <Star size={16} fill="currentColor" /> {p.rating || "New product"}{" "}
            {p.review_count > 0 && <span>· {p.review_count} reviews</span>}
          </div>
          <p className="detail-seller">
            Salesman{" "}
            <NavLink page="store" id={p.seller_id} go={go}>
              <b>{p.seller}</b>
            </NavLink>
          </p>
          <div className="detail-price">{money(p.price)}</div>
          <p className={p.stock ? "availability" : "availability unavailable"}>
            {p.stock ? `In stock: ${p.stock} pcs.` : "Not available"}
          </p>
          <div className="detail-buttons">
            <button
              disabled={!p.stock}
              className="button primary"
              onClick={() => add(p)}
            >
              Add to cart
            </button>
            <button
              className="icon-button"
              onClick={() => toggleFavorite(p.id)}
              aria-label="Add to favorites"
            >
              <Heart
                size={21}
                fill={favorites.includes(p.id) ? "currentColor" : "none"}
              />
            </button>
          </div>
          <div className="detail-note">
            Arrange delivery and payment with the seller after placing your
            order.
          </div>
          <h3>About the product</h3>
          <p className="description-text">{p.description}</p>
          {p.store_description && (
            <>
              <h3>About the store</h3>
              <p className="description-text">{p.store_description}</p>
            </>
          )}
        </div>
      </div>
      <section className="reviews">
        <div className="section-heading">
          <div>
            <span className="eyebrow">BUYERS’ OPINION</span>
            <h2>Reviews</h2>
          </div>
        </div>
        {reviews.length ? (
          reviews.map((r) => (
            <div className="review" key={r.id}>
              <div>
                <b>{r.name}</b>
                <span>{date(r.created_at)}</span>
              </div>
              <div className="review-stars">
                {"★".repeat(r.rating)}
                {"☆".repeat(5 - r.rating)}
              </div>
              <p>{r.body}</p>
            </div>
          ))
        ) : (
          <p className="muted">
            There are no reviews yet. Be the first to leave a review after
            receiving the product.
          </p>
        )}
        {canReview && (
          <form
            className="review-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (await submitReview(p.id, rating, text)) setText("");
              setBusy(false);
            }}
          >
            <h3>Your review</h3>
            <label className="field">
              <span>Grade</span>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} from 5
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Tell us about the product</span>
              <textarea
                required
                minLength={3}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <button className="button primary" disabled={busy}>
              Post a review
            </button>
          </form>
        )}
        {user && <ReportForm productId={p.id} submitReport={submitReport} />}
        {!user && (
          <p className="muted">
            <NavLink page="auth" go={go}>
              Sign in
            </NavLink>
            , to leave feedback after purchase.
          </p>
        )}
      </section>
    </>
  );
}
export function Storefront({ data, go, favorites, toggleFavorite, add }) {
  if (!data) return <p className="loading">Loading the store...</p>;
  return (
    <>
      <Breadcrumb go={go}>Shop</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">STORE AT ANTITRUMP</span>
        <h1>{data.store.name}</h1>
        {data.store.description && (
          <p className="description-text">{data.store.description}</p>
        )}
      </div>
      <div className="section-heading">
        <h2>Store products</h2>
        <span className="muted">{data.products.length} products</span>
      </div>
      {data.products.length ? (
        <div className="product-grid">
          {data.products.map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              go={go}
              favorite={favorites.includes(p.id)}
              toggleFavorite={toggleFavorite}
              add={add}
            />
          ))}
        </div>
      ) : (
        <Empty
          icon="store"
          title="There are no products in the store yet"
          text="Check out other offers in the catalog."
        >
          <button className="button primary" onClick={() => go("catalog")}>
            Open catalog
          </button>
        </Empty>
      )}
    </>
  );
}
