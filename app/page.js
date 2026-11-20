'use client';
import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = '/app.js';
    document.body.appendChild(script);
    return () => script.remove();
  }, []);
  return <><div className="top"><span>Покупки для каждого дня</span><span>Витрина товаров</span></div><header><a className="logo" href="/">nortov<span>.</span></a><button id="catalog" className="catalog">☰ &nbsp; Каталог</button><label className="search"><span>⌕</span><input id="search" placeholder="Найти на Nortov" aria-label="Поиск товаров" /></label><button className="headbutton" id="favButton">♡ <small>Избранное</small></button><button className="headbutton" id="cartButton">▢ <small>Корзина <b id="count"></b></small></button></header><main><nav id="categories"></nav><section className="hero"><div><span className="eyebrow">НОВЫЙ СЕЗОН · НОВЫЕ ИДЕИ</span><h1>Всё, что<br/>нравится вам</h1><p>Находки для дома, гардероба и каждого дня — в одном месте.</p><button id="shop">Смотреть товары</button></div><div className="hero-art"><span>✳</span><strong>Хорошие<br/>вещи<br/>рядом.</strong></div></section><div className="benefits"><span>✳ &nbsp; Находки на каждый день</span><span>♡ &nbsp; Сохраняйте избранное</span><span>▢ &nbsp; Удобная корзина</span></div><section id="products"><div className="section-head"><div><p className="eyebrow dark">ВЫБИРАЙТЕ С УДОВОЛЬСТВИЕМ</p><h2>Вам может понравиться</h2></div><select id="sort" aria-label="Сортировка"><option value="popular">Сначала популярные</option><option value="low">Сначала дешевле</option><option value="high">Сначала дороже</option></select></div><p id="result"></p><div id="grid" className="grid"></div></section></main><footer><b>nortov.</b><span>Вещи, которые хочется выбрать</span><span>© Nortov</span></footer><dialog id="cart"><div className="dialog-head"><h2>Корзина</h2><button id="close" aria-label="Закрыть">✕</button></div><div id="cartItems"></div><div className="total" id="total"></div><p className="notice">Витрина демонстрационная: оформление заказа и оплата пока недоступны.</p></dialog></>;
}
