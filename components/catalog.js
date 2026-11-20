"use client";
import { useState } from "react";
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
  go,
  search,
  category,
  setCategory,
  sort,
  setSort,
  favorites,
  toggleFavorite,
  add,
  onlyFavorites = false,
}) {
  const categories = ["Все", ...new Set(products.map((p) => p.category))];
  let visible = products.filter(
    (p) =>
      (category === "Все" || category === p.category) &&
      `${p.name} ${p.description} ${p.seller}`
        .toLowerCase()
        .includes(search.toLowerCase().trim()) &&
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
          <div className="category-bar" aria-label="Категории">
            {categories.map((c) => (
              <button
                className={category === c ? "active" : ""}
                key={c}
                onClick={() => setCategory(c)}
              >
                {c === "Все" ? "Все товары" : c}
              </button>
            ))}
          </div>
          <section className="hero">
            <div className="hero-content">
              <span className="hero-kicker">
                <span /> НАХОДИТЕ СВОЁ
              </span>
              <h1>
                Всё, что
                <br />
                <em>нравится вам.</em>
              </h1>
              <p>
                Место, где встречаются хорошие вещи и люди, которые их выбирают.
              </p>
              <button
                className="button light"
                onClick={() =>
                  document
                    .getElementById("catalog-list")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Смотреть каталог
              </button>
            </div>
            <div className="hero-shape hero-shape-one" />
            <div className="hero-shape hero-shape-two" />
            <div className="hero-stamp">
              <ShoppingBag size={32} />
              <span>
                выбирайте
                <br />с удовольствием
              </span>
            </div>
            <div className="hero-label">
              ХОРОШИЕ ВЕЩИ
              <br />
              <b>РЯДОМ.</b>
            </div>
          </section>
          <div className="benefit-bar">
            <span>Открывайте новые магазины</span>
            <span>Общайтесь с продавцами</span>
            <span>Выбирайте в своём ритме</span>
          </div>
        </>
      )}
      <section id="catalog-list" className="listing">
        <div className="section-heading">
          <div>
            <span className="eyebrow">
              {onlyFavorites ? "ВАША ПОДБОРКА" : "НАХОДКИ ДЛЯ ВАС"}
            </span>
            <h2>
              {onlyFavorites
                ? "Избранное"
                : search
                  ? `Поиск: ${search}`
                  : category === "Все"
                    ? "Каталог товаров"
                    : category}
            </h2>
            <p>
              {visible.length
                ? `${visible.length} товаров`
                : "Пока ничего не найдено"}
            </p>
          </div>
          <label className="sort-label">
            Сортировка{" "}
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="new">Сначала новые</option>
              <option value="low">Сначала дешевле</option>
              <option value="high">Сначала дороже</option>
              <option value="rating">По рейтингу</option>
            </select>
          </label>
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
              onlyFavorites
                ? "Сохраняйте то, что нравится"
                : "Здесь скоро появятся товары"
            }
            text={
              onlyFavorites
                ? "Нажмите на сердечко на карточке товара, чтобы вернуться к нему позже."
                : products.length
                  ? "Попробуйте изменить запрос или выбрать другую категорию."
                  : "Продавцы могут добавить товары в своём личном кабинете."
            }
          >
            <button
              className="button secondary"
              onClick={() => {
                setCategory("Все");
                go(onlyFavorites ? "catalog" : "seller");
              }}
            >
              {onlyFavorites
                ? "Перейти в каталог"
                : products.length
                  ? "Сбросить категорию"
                  : "Открыть кабинет продавца"}
            </button>
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
  if (!detail) return <p className="loading">Загружаем товар…</p>;
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
              <span>nortov.</span>
            </div>
          )}
        </div>
        <div className="detail-body">
          <span className="eyebrow">{p.category.toUpperCase()}</span>
          <h1>{p.name}</h1>
          <div className="rating">
            <Star size={16} fill="currentColor" /> {p.rating || "Новый товар"}{" "}
            {p.review_count > 0 && <span>· {p.review_count} отзывов</span>}
          </div>
          <p className="detail-seller">
            Продавец{" "}
            <NavLink page="store" id={p.seller_id} go={go}>
              <b>{p.seller}</b>
            </NavLink>
          </p>
          <div className="detail-price">{money(p.price)}</div>
          <p className={p.stock ? "availability" : "availability unavailable"}>
            {p.stock ? `В наличии: ${p.stock} шт.` : "Нет в наличии"}
          </p>
          <div className="detail-buttons">
            <button
              disabled={!p.stock}
              className="button primary"
              onClick={() => add(p)}
            >
              Добавить в корзину
            </button>
            <button
              className="icon-button"
              onClick={() => toggleFavorite(p.id)}
              aria-label="Добавить в избранное"
            >
              <Heart
                size={21}
                fill={favorites.includes(p.id) ? "currentColor" : "none"}
              />
            </button>
          </div>
          <div className="detail-note">
            Доставка и способ расчёта согласуются с продавцом после оформления
            заказа.
          </div>
          <h3>О товаре</h3>
          <p className="description-text">{p.description}</p>
          {p.store_description && (
            <>
              <h3>О магазине</h3>
              <p className="description-text">{p.store_description}</p>
            </>
          )}
        </div>
      </div>
      <section className="reviews">
        <div className="section-heading">
          <div>
            <span className="eyebrow">МНЕНИЕ ПОКУПАТЕЛЕЙ</span>
            <h2>Отзывы</h2>
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
            Пока нет отзывов. Первым может поделиться впечатлением покупатель,
            получивший товар.
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
            <h3>Ваш отзыв</h3>
            <label className="field">
              <span>Оценка</span>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} из 5
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Расскажите о товаре</span>
              <textarea
                required
                minLength={3}
                maxLength={2000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <button className="button primary" disabled={busy}>
              Опубликовать отзыв
            </button>
          </form>
        )}
        {user && <ReportForm productId={p.id} submitReport={submitReport} />}
        {!user && (
          <p className="muted">
            <NavLink page="auth" go={go}>
              Войдите
            </NavLink>
            , чтобы оставить отзыв после покупки.
          </p>
        )}
      </section>
    </>
  );
}
export function Storefront({ data, go, favorites, toggleFavorite, add }) {
  if (!data) return <p className="loading">Загружаем магазин…</p>;
  return (
    <>
      <Breadcrumb go={go}>Магазин</Breadcrumb>
      <div className="page-heading">
        <span className="eyebrow">МАГАЗИН НА NORTOV</span>
        <h1>{data.store.name}</h1>
        {data.store.description && (
          <p className="description-text">{data.store.description}</p>
        )}
      </div>
      <div className="section-heading">
        <h2>Товары магазина</h2>
        <span className="muted">{data.products.length} товаров</span>
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
          title="В магазине пока нет товаров"
          text="Посмотрите другие предложения в каталоге."
        >
          <button className="button primary" onClick={() => go("catalog")}>
            Открыть каталог
          </button>
        </Empty>
      )}
    </>
  );
}
