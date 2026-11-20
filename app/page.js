"use client";
import { useState, useEffect, useCallback } from "react";
import { api, url } from "@/lib/client";
import { Header, Footer, Alert, MissingFavorites } from "@/components/ui";
import { Catalog, Product, Storefront } from "@/components/catalog";
import { Cart, Orders, Chat } from "@/components/buyer";
import { Auth, Account, Seller, Admin, Help } from "@/components/account";

const protectedPages = new Set([
  "account",
  "orders",
  "seller",
  "chat",
  "admin",
]);
export default function Home() {
  const [page, setPage] = useState("catalog"),
    [id, setId] = useState(null),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState("Все"),
    [sort, setSort] = useState("new");
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [products, setProducts] = useState([]),
    [cart, setCart] = useState({}),
    [favorites, setFavorites] = useState([]);
  const [config, setConfig] = useState({}),
    [authMode, setAuthMode] = useState("login"),
    [token, setToken] = useState(""),
    [returnTo, setReturnTo] = useState("account");
  const [detail, setDetail] = useState(null),
    [storefront, setStorefront] = useState(null),
    [seller, setSeller] = useState(null),
    [orders, setOrders] = useState(null),
    [chat, setChat] = useState(null),
    [admin, setAdmin] = useState(null),
    [alert, setAlert] = useState(null);
  const notify = (message, type = "success") => setAlert({ message, type });
  const go = useCallback((next, identifier = null) => {
    const query = url(next, identifier);
    if (window.location.pathname + window.location.search === query) return;
    if (next === "favorites") {
      setCategory("Все");
      setSearch("");
    }
    window.history.pushState({}, "", query);
    setPage(next);
    setId(identifier ? Number(identifier) : null);
    setAlert(null);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);
  const reloadProducts = useCallback(async () => {
    const result = await api("products");
    setProducts(result.products);
    return result.products;
  }, []);
  const loadPersonal = useCallback(async () => {
    const p = await api("personal");
    setCart(Object.fromEntries(p.cart.map((x) => [x.product_id, x.quantity])));
    setFavorites(p.favorites.map((x) => x.product_id));
  }, []);
  useEffect(() => {
    const readLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const reset = params.get("reset"),
        verify = params.get("verify");
      if (reset || verify) {
        setPage("auth");
        setAuthMode(reset ? "reset" : "verify");
        setToken(reset || verify);
        return;
      }
      setPage(params.get("page") || "catalog");
      setId(params.get("id") ? Number(params.get("id")) : null);
    };
    readLocation();
    window.addEventListener("popstate", readLocation);
    try {
      setCart(JSON.parse(localStorage.getItem("nortov-guest-cart") || "{}"));
      setFavorites(
        JSON.parse(localStorage.getItem("nortov-guest-favorites") || "[]"),
      );
    } catch {}
    Promise.allSettled([
      reloadProducts(),
      api("config").then(setConfig),
      api("me").then(async (r) => {
        setUser(r.user);
        if (r.user) await loadPersonal();
      }),
    ]).then((results) => {
      if (results[0].status === "rejected")
        notify("Не удалось загрузить каталог. Обновите страницу.", "error");
      setReady(true);
    });
    return () => window.removeEventListener("popstate", readLocation);
  }, [reloadProducts, loadPersonal]);
  useEffect(() => {
    if (!ready) return;
    if (protectedPages.has(page) && !user) {
      setReturnTo(page === "chat" ? "orders" : page);
      setAuthMode("login");
      go("auth");
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        if (page === "product") {
          setDetail(null);
          const r = await api("product", null, { id });
          if (!cancelled) setDetail(r);
        }
        if (page === "store") {
          setStorefront(null);
          const r = await api("store", null, { id });
          if (!cancelled) setStorefront(r);
        }
        if (page === "seller") {
          setSeller(null);
          const r = await api("seller");
          if (!cancelled) setSeller(r);
        }
        if (page === "orders") {
          setOrders(null);
          const r = await api("orders");
          if (!cancelled) setOrders(r);
        }
        if (page === "chat") {
          setChat(null);
          const r = await api("messages", null, { id });
          if (!cancelled) setChat(r);
        }
        if (page === "admin") {
          setAdmin(null);
          const r = await api("admin");
          if (!cancelled) setAdmin(r);
        }
      } catch (e) {
        if (!cancelled) notify(e.message, "error");
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [page, id, user, ready, go]);
  const action = async (name, data = {}) => {
    try {
      return await api("", { action: name, ...data });
    } catch (e) {
      notify(e.message, "error");
      return null;
    }
  };
  const authSubmit = async (mode, form) => {
    const result = await action(mode, form);
    if (!result) return false;
    if (result.user) {
      setUser(result.user);
      const guestCart = cart,
        guestFavorites = favorites;
      const merges = [
        ...Object.entries(guestCart).map(([id, quantity]) =>
          api("", { action: "cartSet", id: Number(id), quantity }),
        ),
        ...guestFavorites.map((id) =>
          api("", { action: "favoriteSet", id, enabled: true }),
        ),
      ];
      const settled = await Promise.allSettled(merges);
      if (settled.every((x) => x.status === "fulfilled")) {
        localStorage.removeItem("nortov-guest-cart");
        localStorage.removeItem("nortov-guest-favorites");
      }
      await loadPersonal();
      go(returnTo === "admin" && !result.user.is_admin ? "account" : returnTo);
      notify(
        settled.some((x) => x.status === "rejected")
          ? "Вы вошли. Некоторые товары из гостевой корзины недоступны."
          : "Вы вошли в аккаунт",
      );
      return true;
    }
    if (result.verificationPending) {
      setAuthMode("login");
      notify("Проверьте почту: мы отправили ссылку для подтверждения.");
      return true;
    }
    if (mode === "verify" || mode === "reset") {
      setToken("");
      setAuthMode("login");
      window.history.replaceState({}, "", url("auth"));
      notify(
        mode === "verify"
          ? "Почта подтверждена. Теперь можно войти."
          : "Пароль изменён. Войдите с новым паролем.",
      );
      return true;
    }
    notify("Если адрес зарегистрирован, письмо будет отправлено.");
    return true;
  };
  const logout = async () => {
    const result = await action("logout");
    if (!result) return;
    setUser(null);
    setCart({});
    setFavorites([]);
    setReturnTo("account");
    go("catalog");
    notify("Вы вышли из аккаунта");
  };
  const updateCart = async (id, quantity) => {
    if (user) {
      if (!(await action("cartSet", { id, quantity }))) return;
      await loadPersonal();
    } else {
      const next = { ...cart };
      if (quantity <= 0) delete next[id];
      else next[id] = quantity;
      setCart(next);
      localStorage.setItem("nortov-guest-cart", JSON.stringify(next));
    }
  };
  const add = async (p) => {
    const quantity = Math.min((cart[p.id] || 0) + 1, p.stock, 100);
    await updateCart(p.id, quantity);
  };
  const toggleFavorite = async (id) => {
    const enabled = !favorites.includes(id);
    if (user) {
      if (!(await action("favoriteSet", { id, enabled }))) return;
      await loadPersonal();
    } else {
      const next = enabled
        ? [...favorites, id]
        : favorites.filter((x) => x !== id);
      setFavorites(next);
      localStorage.setItem("nortov-guest-favorites", JSON.stringify(next));
    }
  };
  const checkout = async (form) => {
    const r = await action("order", form);
    if (!r) {
      await reloadProducts();
      return false;
    }
    await loadPersonal();
    await reloadProducts();
    go("orders");
    notify(
      "Заказ № " +
        r.orderId +
        " оформлен. Свяжитесь с продавцом в карточке заказа.",
    );
    return true;
  };
  const changeStatus = async (itemId, status, context, tracking = "") => {
    if (
      status === "cancelled" &&
      !window.confirm("Отменить этот товар в заказе?")
    )
      return;
    const r = await action("status", { id: itemId, status, tracking });
    if (!r) return;
    await reloadProducts();
    if (context === "orders") setOrders(await api("orders"));
    else setSeller(await api("seller"));
    notify("Статус обновлён");
  };
  const saveProduct = async (product) => {
    const r = await action("product", product);
    if (!r) return false;
    setSeller(await api("seller"));
    await reloadProducts();
    notify("Товар сохранён");
    return true;
  };
  const saveStore = async (profile) => {
    const r = await action("store", profile);
    if (!r) return false;
    setSeller(await api("seller"));
    await reloadProducts();
    notify("Магазин сохранён");
    return true;
  };
  const changeActive = async (p) => {
    const r = await action("archive", { id: p.id, active: !p.active });
    if (r) {
      setSeller(await api("seller"));
      await reloadProducts();
      notify("Статус товара обновлён");
    }
  };
  const upload = async (file) => {
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/upload", { method: "POST", body });
      const r = await response.json();
      if (!response.ok) throw Error(r.error);
      return r.url;
    } catch (e) {
      notify(e.message, "error");
      return null;
    }
  };
  const submitReview = async (id, rating, text) => {
    const r = await action("review", { id, rating: Number(rating), text });
    if (!r) return false;
    setDetail(await api("product", null, { id }));
    await reloadProducts();
    notify("Отзыв опубликован");
    return true;
  };
  const submitReport = async (id, reason) => {
    const r = await action("report", { id, reason });
    if (!r) return false;
    notify("Жалоба отправлена модератору");
    return true;
  };
  const sendMessage = async (id, message) => {
    const r = await action("message", { id, message });
    if (!r) return false;
    setChat(await api("messages", null, { id }));
    return true;
  };
  const accountAction = async (name, data) => {
    const r = await action(name, data);
    if (!r) return false;
    if (name === "password") {
      setUser(null);
      setCart({});
      setFavorites([]);
      go("auth");
      notify("Пароль обновлён. Войдите снова.");
    } else {
      setUser((await api("me")).user);
      notify("Изменения сохранены");
    }
    return true;
  };
  const adminAction = async (name, data) => {
    const r = await action(name, data);
    if (r) {
      setAdmin(await api("admin"));
      await reloadProducts();
      notify("Изменения сохранены");
    }
  };
  const count = Object.values(cart).reduce((sum, n) => sum + Number(n), 0);
  return (
    <div className="app">
      <Header
        go={go}
        user={user}
        search={search}
        setSearch={setSearch}
        count={count}
        favoriteCount={favorites.length}
      />
      <main className="wrap main-content">
        <Alert
          message={alert?.message}
          type={alert?.type}
          dismiss={() => setAlert(null)}
        />
        {!ready ? (
          <p className="loading">Загружаем Nortov…</p>
        ) : (
          <>
            {page === "catalog" && (
              <Catalog
                products={products}
                go={go}
                search={search}
                category={category}
                setCategory={setCategory}
                sort={sort}
                setSort={setSort}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                add={add}
              />
            )}
            {page === "favorites" && (
              <>
                <Catalog
                  onlyFavorites
                  products={products}
                  go={go}
                  search={search}
                  category={category}
                  setCategory={setCategory}
                  sort={sort}
                  setSort={setSort}
                  favorites={favorites}
                  toggleFavorite={toggleFavorite}
                  add={add}
                />
                <MissingFavorites
                  favorites={favorites}
                  products={products}
                  toggleFavorite={toggleFavorite}
                />
              </>
            )}
            {page === "product" && (
              <Product
                key={id}
                detail={detail}
                go={go}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                add={add}
                user={user}
                submitReview={submitReview}
                submitReport={submitReport}
              />
            )}
            {page === "cart" && (
              <Cart
                products={products}
                cart={cart}
                updateCart={updateCart}
                go={go}
                user={user}
                checkout={checkout}
                loginForCheckout={() => {
                  setReturnTo("cart");
                  setAuthMode("login");
                  go("auth");
                }}
              />
            )}
            {page === "store" && (
              <Storefront
                data={storefront}
                go={go}
                favorites={favorites}
                toggleFavorite={toggleFavorite}
                add={add}
              />
            )}
            {page === "auth" && (
              <Auth
                mode={authMode}
                setMode={setAuthMode}
                config={config}
                submit={authSubmit}
                token={token}
              />
            )}
            {page === "account" && user && (
              <Account
                user={user}
                go={go}
                submit={accountAction}
                logout={logout}
              />
            )}
            {page === "seller" && user && (
              <Seller
                data={seller}
                go={go}
                saveProduct={saveProduct}
                saveStore={saveStore}
                changeActive={changeActive}
                changeStatus={changeStatus}
                upload={upload}
              />
            )}
            {page === "orders" &&
              user &&
              (orders ? (
                <Orders {...orders} go={go} changeStatus={changeStatus} />
              ) : (
                <p className="loading">Загружаем заказы…</p>
              ))}
            {page === "chat" && user && (
              <Chat
                key={id}
                data={chat}
                user={user}
                go={go}
                sendMessage={sendMessage}
              />
            )}
            {page === "admin" && user && (
              <Admin data={admin} go={go} action={adminAction} />
            )}
            {page === "help" && <Help go={go} />}
          </>
        )}
      </main>
      <Footer go={go} />
    </div>
  );
}
