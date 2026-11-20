import { db, digest, transaction, rateLimit } from "./db";
import {
  assert,
  int,
  optionalText,
  requiredText,
  requireUser,
  requireAdmin,
} from "./validation";

const publicProduct = `SELECT p.id,p.seller_id,p.name,p.description,p.category,p.price,p.stock,p.image,p.created_at,
 COALESCE(s.store_name,u.name) AS seller, COALESCE(s.description,'') AS store_description,
 (SELECT ROUND(AVG(r.rating),1) FROM reviews r WHERE r.product_id=p.id) AS rating,
 (SELECT COUNT(*) FROM reviews r WHERE r.product_id=p.id) AS review_count
 FROM products p JOIN users u ON u.id=p.seller_id LEFT JOIN seller_profiles s ON s.user_id=u.id`;
const visible = "p.active=1 AND p.moderation='approved' AND u.suspended=0";
const orderItems = `SELECT i.*,o.buyer_id,o.name AS recipient,o.phone,o.address,o.comment,o.created_at,
 p.image,COALESCE(s.store_name,u.name) AS seller FROM order_items i
 JOIN orders o ON o.id=i.order_id JOIN products p ON p.id=i.product_id
 JOIN users u ON u.id=i.seller_id LEFT JOIN seller_profiles s ON s.user_id=u.id`;
const sellerTransitions = {
  new: ["accepted", "cancelled"],
  accepted: ["shipped", "cancelled"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};
function ownedItem(id, user) {
  const item = db.prepare(orderItems + " WHERE i.id=?").get(id);
  assert(
    item && (item.buyer_id === user.id || item.seller_id === user.id),
    "Заказ не найден",
    404,
  );
  return item;
}
function validProduct(body) {
  const name = requiredText(body.name, "Название", 2, 120),
    description = requiredText(body.description, "Описание", 3, 3000),
    category = requiredText(body.category, "Категория", 2, 80);
  const price = int(body.price, "цену", 1, 100000000),
    stock = int(body.stock, "остаток", 0, 1000000),
    image = optionalText(body.image, "ссылку на фото", 1000);
  if (image && !/^\/media\/[a-f0-9]{32}\.webp$/.test(image)) {
    try {
      assert(
        new URL(image).protocol === "https:",
        "Ссылка на фото должна начинаться с https://",
      );
    } catch {
      assert(false, "Ссылка на фото должна начинаться с https://");
    }
  }
  return { name, description, category, price, stock, image };
}
function updateItemStatus(item, status) {
  if (status === "cancelled")
    db.prepare("UPDATE products SET stock=stock+? WHERE id=?").run(
      item.quantity,
      item.product_id,
    );
  db.prepare("UPDATE order_items SET status=? WHERE id=?").run(status, item.id);
}
export function readView(view, params, user) {
  if (view === "products") {
    return {
      products: db
        .prepare(`${publicProduct} WHERE ${visible} ORDER BY p.id DESC`)
        .all(),
    };
  }
  if (view === "store") {
    const id = int(params.get("id"), "магазин", 1, Number.MAX_SAFE_INTEGER);
    const store = db
      .prepare(
        "SELECT u.id,COALESCE(s.store_name,u.name) AS name,COALESCE(s.description,'') AS description FROM users u LEFT JOIN seller_profiles s ON s.user_id=u.id WHERE u.id=? AND u.suspended=0",
      )
      .get(id);
    assert(store, "Магазин не найден", 404);
    const products = db
      .prepare(
        `${publicProduct} WHERE p.seller_id=? AND ${visible} ORDER BY p.id DESC`,
      )
      .all(id);
    return { store, products };
  }
  if (view === "product") {
    const id = int(params.get("id"), "товар", 1, Number.MAX_SAFE_INTEGER);
    const product = db
      .prepare(`${publicProduct} WHERE p.id=? AND ${visible}`)
      .get(id);
    assert(product, "Товар не найден", 404);
    const reviews = db
      .prepare(
        "SELECT r.id,r.rating,r.body,r.created_at,u.name FROM reviews r JOIN users u ON u.id=r.buyer_id WHERE r.product_id=? ORDER BY r.id DESC LIMIT 100",
      )
      .all(id);
    const canReview =
      !!user &&
      !!db
        .prepare(
          "SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=? AND o.buyer_id=? AND i.status='completed' LIMIT 1",
        )
        .get(id, user.id);
    return { product, reviews, canReview };
  }
  if (view === "me") return { user };
  requireUser(user);
  if (view === "personal")
    return {
      cart: db
        .prepare("SELECT product_id,quantity FROM cart_items WHERE user_id=?")
        .all(user.id),
      favorites: db
        .prepare("SELECT product_id FROM favorites WHERE user_id=?")
        .all(user.id),
    };
  if (view === "seller")
    return {
      profile: db
        .prepare(
          "SELECT store_name,description FROM seller_profiles WHERE user_id=?",
        )
        .get(user.id) || { store_name: user.name, description: "" },
      products: db
        .prepare("SELECT * FROM products WHERE seller_id=? ORDER BY id DESC")
        .all(user.id),
      items: db
        .prepare(
          orderItems + " WHERE i.seller_id=? ORDER BY i.id DESC LIMIT 500",
        )
        .all(user.id),
    };
  if (view === "orders")
    return {
      orders: db
        .prepare(
          "SELECT * FROM orders WHERE buyer_id=? ORDER BY id DESC LIMIT 500",
        )
        .all(user.id),
      items: db
        .prepare(
          orderItems + " WHERE o.buyer_id=? ORDER BY i.id DESC LIMIT 1000",
        )
        .all(user.id),
    };
  if (view === "messages") {
    const item = ownedItem(
      int(params.get("id"), "заказ", 1, Number.MAX_SAFE_INTEGER),
      user,
    );
    return {
      item,
      messages: db
        .prepare(
          "SELECT m.*,u.name AS sender FROM messages m JOIN users u ON u.id=m.sender_id WHERE m.item_id=? ORDER BY m.id LIMIT 500",
        )
        .all(item.id),
    };
  }
  if (view === "admin") {
    requireAdmin(user);
    return {
      users: db
        .prepare(
          "SELECT id,name,email,is_admin,suspended,email_verified,created_at FROM users ORDER BY id DESC LIMIT 500",
        )
        .all(),
      products: db
        .prepare(`${publicProduct} WHERE 1=1 ORDER BY p.id DESC LIMIT 500`)
        .all()
        .map((p) => ({
          ...p,
          ...db
            .prepare("SELECT active,moderation FROM products WHERE id=?")
            .get(p.id),
        })),
      reviews: db
        .prepare(
          "SELECT r.*,u.name,p.name product_name FROM reviews r JOIN users u ON u.id=r.buyer_id JOIN products p ON p.id=r.product_id ORDER BY r.id DESC LIMIT 500",
        )
        .all(),
      reports: db
        .prepare(
          "SELECT r.*,u.name reporter,p.name product_name,p.moderation FROM reports r JOIN users u ON u.id=r.reporter_id JOIN products p ON p.id=r.product_id ORDER BY r.id DESC LIMIT 500",
        )
        .all(),
    };
  }
  assert(false, "Неизвестный запрос", 404);
}
export function marketAction(action, body, user) {
  requireUser(user);
  if (action === "product") {
    const p = validProduct(body);
    const id = body.id
      ? int(body.id, "товар", 1, Number.MAX_SAFE_INTEGER)
      : null;
    if (id) {
      const r = db
        .prepare(
          "UPDATE products SET name=?,description=?,category=?,image=?,price=?,stock=? WHERE id=? AND seller_id=?",
        )
        .run(
          p.name,
          p.description,
          p.category,
          p.image,
          p.price,
          p.stock,
          id,
          user.id,
        );
      assert(r.changes, "Товар не найден", 404);
    } else {
      assert(
        rateLimit("product:" + user.id, 100, 86400_000),
        "Лимит новых товаров на сегодня исчерпан",
        429,
      );
      db.prepare(
        "INSERT INTO products(seller_id,name,description,category,image,price,stock) VALUES(?,?,?,?,?,?,?)",
      ).run(
        user.id,
        p.name,
        p.description,
        p.category,
        p.image,
        p.price,
        p.stock,
      );
    }
    return { ok: true };
  }
  if (action === "archive") {
    const id = int(body.id, "товар", 1, Number.MAX_SAFE_INTEGER);
    assert(typeof body.active === "boolean", "Проверьте статус");
    const r = db
      .prepare("UPDATE products SET active=? WHERE id=? AND seller_id=?")
      .run(body.active ? 1 : 0, id, user.id);
    assert(r.changes, "Товар не найден", 404);
    return { ok: true };
  }
  if (action === "store") {
    const name = requiredText(body.name, "Название магазина", 2, 80),
      description = optionalText(body.description, "описание", 1000);
    db.prepare(
      "INSERT INTO seller_profiles(user_id,store_name,description) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET store_name=excluded.store_name,description=excluded.description",
    ).run(user.id, name, description);
    return { ok: true };
  }
  if (action === "cartSet" || action === "favoriteSet") {
    const id = int(body.id, "товар", 1, Number.MAX_SAFE_INTEGER);
    if (action === "cartSet") {
      const quantity = int(body.quantity, "количество", 0, 100);
      if (quantity === 0)
        db.prepare(
          "DELETE FROM cart_items WHERE user_id=? AND product_id=?",
        ).run(user.id, id);
      else {
        const p = db
          .prepare(`${publicProduct} WHERE p.id=? AND ${visible}`)
          .get(id);
        assert(p, "Товар недоступен", 404);
        assert(quantity <= p.stock, "Недостаточно товара на складе");
        db.prepare(
          "INSERT INTO cart_items VALUES(?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=excluded.quantity",
        ).run(user.id, id, quantity);
      }
    } else {
      assert(typeof body.enabled === "boolean", "Некорректное значение");
      if (body.enabled) {
        const p = db
          .prepare(`${publicProduct} WHERE p.id=? AND ${visible}`)
          .get(id);
        assert(p, "Товар недоступен", 404);
        db.prepare("INSERT OR IGNORE INTO favorites VALUES(?,?)").run(
          user.id,
          id,
        );
      } else
        db.prepare(
          "DELETE FROM favorites WHERE user_id=? AND product_id=?",
        ).run(user.id, id);
    }
    return { ok: true };
  }
  if (action === "order") {
    const name = requiredText(body.name, "Имя получателя", 2, 100),
      phone = requiredText(body.phone, "Телефон", 5, 40),
      address = requiredText(body.address, "Адрес доставки", 5, 500),
      comment = optionalText(body.comment, "комментарий", 1000);
    const key = requiredText(body.key, "Идентификатор заказа", 16, 100);
    assert(/^[\w-]+$/.test(key), "Некорректный идентификатор заказа");
    assert(
      Array.isArray(body.items) &&
        body.items.length > 0 &&
        body.items.length <= 50,
      "Добавьте от 1 до 50 товаров",
    );
    const lines = new Map();
    for (const line of body.items) {
      const id = int(line?.id, "товар", 1, Number.MAX_SAFE_INTEGER),
        quantity = int(line?.quantity, "количество", 1, 100),
        price = int(line?.price, "цену", 1, 100000000);
      assert(!lines.has(id), "Товар указан повторно");
      lines.set(id, { quantity, price });
    }
    const fingerprint = digest(
      JSON.stringify({
        name,
        phone,
        address,
        comment,
        items: [...lines].sort((a, b) => a[0] - b[0]),
      }),
    );
    return transaction(() => {
      const existing = db
        .prepare("SELECT * FROM checkout_keys WHERE buyer_id=? AND key=?")
        .get(user.id, key);
      if (existing) {
        assert(
          existing.fingerprint === fingerprint,
          "Данные повторного заказа изменились",
          409,
        );
        return { ok: true, orderId: existing.order_id };
      }
      let total = 0;
      const selected = [];
      for (const [id, line] of lines) {
        const { quantity, price } = line;
        const p = db
          .prepare(`${publicProduct} WHERE p.id=? AND ${visible}`)
          .get(id);
        assert(
          p && p.stock >= quantity,
          "Товар отсутствует или его остаток изменился",
          409,
        );
        assert(
          p.price === price,
          "Цена товара изменилась. Проверьте корзину и оформите заказ ещё раз.",
          409,
        );
        assert(p.seller_id !== user.id, "Нельзя заказать собственный товар");
        total += p.price * quantity;
        assert(Number.isSafeInteger(total), "Сумма заказа слишком велика");
        selected.push({ p, quantity });
      }
      const result = db
        .prepare(
          "INSERT INTO orders(buyer_id,name,phone,address,comment,total) VALUES(?,?,?,?,?,?)",
        )
        .run(user.id, name, phone, address, comment, total);
      const orderId = Number(result.lastInsertRowid);
      for (const { p, quantity } of selected) {
        db.prepare("UPDATE products SET stock=stock-? WHERE id=?").run(
          quantity,
          p.id,
        );
        db.prepare(
          "INSERT INTO order_items(order_id,product_id,seller_id,product_name,price,quantity) VALUES(?,?,?,?,?,?)",
        ).run(orderId, p.id, p.seller_id, p.name, p.price, quantity);
        db.prepare(
          "DELETE FROM cart_items WHERE user_id=? AND product_id=?",
        ).run(user.id, p.id);
      }
      db.prepare("INSERT INTO checkout_keys VALUES(?,?,?,?)").run(
        user.id,
        key,
        fingerprint,
        orderId,
      );
      return { ok: true, orderId };
    });
  }
  if (action === "status") {
    const id = int(body.id, "заказ", 1, Number.MAX_SAFE_INTEGER),
      status = requiredText(body.status, "Статус", 3, 20),
      tracking = optionalText(body.tracking, "трек-номер", 100);
    return transaction(() => {
      const item = ownedItem(id, user);
      const allowed =
        item.seller_id === user.id
          ? sellerTransitions[item.status] || []
          : item.status === "new"
            ? ["cancelled"]
            : item.status === "shipped"
              ? ["completed"]
              : [];
      assert(allowed.includes(status), "Недопустимое изменение статуса", 409);
      updateItemStatus(item, status);
      if (status === "shipped")
        db.prepare("UPDATE order_items SET tracking=? WHERE id=?").run(
          tracking,
          id,
        );
      return { ok: true };
    });
  }
  if (action === "message") {
    const id = int(body.id, "заказ", 1, Number.MAX_SAFE_INTEGER),
      message = requiredText(body.message, "Сообщение", 1, 2000);
    ownedItem(id, user);
    assert(
      rateLimit("message:" + user.id, 100, 3600_000),
      "Слишком много сообщений",
      429,
    );
    db.prepare(
      "INSERT INTO messages(item_id,sender_id,body) VALUES(?,?,?)",
    ).run(id, user.id, message);
    return { ok: true };
  }
  if (action === "report") {
    const id = int(body.id, "товар", 1, Number.MAX_SAFE_INTEGER),
      reason = requiredText(body.reason, "Причина жалобы", 5, 1000);
    const p = db
      .prepare(`${publicProduct} WHERE p.id=? AND ${visible}`)
      .get(id);
    assert(p, "Товар не найден", 404);
    assert(p.seller_id !== user.id, "Нельзя пожаловаться на свой товар");
    assert(
      rateLimit("report:" + user.id, 20, 86400_000),
      "Лимит жалоб на сегодня исчерпан",
      429,
    );
    db.prepare(
      "INSERT INTO reports(product_id,reporter_id,reason) VALUES(?,?,?)",
    ).run(id, user.id, reason);
    return { ok: true };
  }
  if (action === "review") {
    const id = int(body.id, "товар", 1, Number.MAX_SAFE_INTEGER),
      rating = int(body.rating, "оценку", 1, 5),
      text = requiredText(body.text, "Отзыв", 3, 2000);
    assert(
      db
        .prepare(
          "SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=? AND o.buyer_id=? AND i.status='completed' LIMIT 1",
        )
        .get(id, user.id),
      "Отзыв доступен после получения товара",
      403,
    );
    db.prepare(
      "INSERT INTO reviews(product_id,buyer_id,rating,body) VALUES(?,?,?,?) ON CONFLICT(product_id,buyer_id) DO UPDATE SET rating=excluded.rating,body=excluded.body,created_at=CURRENT_TIMESTAMP",
    ).run(id, user.id, rating, text);
    return { ok: true };
  }
  if (action === "adminProduct") {
    requireAdmin(user);
    const id = int(body.id, "товар", 1, Number.MAX_SAFE_INTEGER);
    assert(["approved", "hidden"].includes(body.moderation), "Неверный статус");
    const r = db
      .prepare("UPDATE products SET moderation=? WHERE id=?")
      .run(body.moderation, id);
    assert(r.changes, "Товар не найден", 404);
    return { ok: true };
  }
  if (action === "adminUser") {
    requireAdmin(user);
    const id = int(body.id, "пользователя", 1, Number.MAX_SAFE_INTEGER);
    assert(
      id !== user.id && typeof body.suspended === "boolean",
      "Невозможно изменить этот аккаунт",
    );
    return transaction(() => {
      const target = db
        .prepare("SELECT is_admin FROM users WHERE id=?")
        .get(id);
      assert(target && !target.is_admin, "Пользователь не найден", 404);
      db.prepare("UPDATE users SET suspended=? WHERE id=?").run(
        body.suspended ? 1 : 0,
        id,
      );
      if (body.suspended)
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
      return { ok: true };
    });
  }
  if (action === "adminReview") {
    requireAdmin(user);
    const r = db
      .prepare("DELETE FROM reviews WHERE id=?")
      .run(int(body.id, "отзыв", 1, Number.MAX_SAFE_INTEGER));
    assert(r.changes, "Отзыв не найден", 404);
    return { ok: true };
  }
  if (action === "adminReport") {
    requireAdmin(user);
    const id = int(body.id, "жалобу", 1, Number.MAX_SAFE_INTEGER);
    assert(["open", "resolved"].includes(body.status), "Неверный статус");
    const r = db
      .prepare("UPDATE reports SET status=? WHERE id=?")
      .run(body.status, id);
    assert(r.changes, "Жалоба не найдена", 404);
    return { ok: true };
  }
  assert(false, "Неизвестное действие", 404);
}
