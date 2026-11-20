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
    "Order not found",
    404,
  );
  return item;
}
function validProduct(body) {
  const name = requiredText(body.name, "Name", 2, 120),
    description = requiredText(body.description, "Description", 3, 3000),
    category = requiredText(body.category, "Category", 2, 80);
  const price = int(body.price, "price", 1, 100000000),
    stock = int(body.stock, "remainder", 0, 1000000),
    image = optionalText(body.image, "link to photo", 1000);
  if (image && !/^\/media\/[a-f0-9]{32}\.webp$/.test(image)) {
    try {
      assert(
        new URL(image).protocol === "https:",
        "The photo link must begin with https://",
      );
    } catch {
      assert(false, "The photo link must begin with https://");
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
function audit(user, action, type, id, detail = "") {
  db.prepare(
    "INSERT INTO admin_audit(admin_id,action,target_type,target_id,detail) VALUES(?,?,?,?,?)",
  ).run(user.id, action, type, id, detail);
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
    const id = int(params.get("id"), "shop", 1, Number.MAX_SAFE_INTEGER);
    const store = db
      .prepare(
        "SELECT u.id,COALESCE(s.store_name,u.name) AS name,COALESCE(s.description,'') AS description FROM users u LEFT JOIN seller_profiles s ON s.user_id=u.id WHERE u.id=? AND u.suspended=0",
      )
      .get(id);
    assert(store, "Store not found", 404);
    const products = db
      .prepare(
        `${publicProduct} WHERE p.seller_id=? AND ${visible} ORDER BY p.id DESC`,
      )
      .all(id);
    return { store, products };
  }
  if (view === "product") {
    const id = int(params.get("id"), "product", 1, Number.MAX_SAFE_INTEGER);
    const product = db
      .prepare(`${publicProduct} WHERE p.id=? AND ${visible}`)
      .get(id);
    assert(product, "Product not found", 404);
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
      int(params.get("id"), "order", 1, Number.MAX_SAFE_INTEGER),
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
      stats: db
        .prepare(
          `SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM products p JOIN users u ON u.id=p.seller_id WHERE p.active=1 AND p.moderation='approved' AND u.suspended=0) AS products,
        (SELECT COUNT(*) FROM orders) AS orders,
        (SELECT COUNT(*) FROM reports WHERE status='open') AS open_reports`,
        )
        .get(),
      orders: db
        .prepare(
          `SELECT o.id,o.created_at,o.total,u.name AS buyer,
        COUNT(i.id) AS item_count,
        SUM(CASE WHEN i.status IN ('new','accepted','shipped') THEN 1 ELSE 0 END) AS active_items
        FROM orders o JOIN users u ON u.id=o.buyer_id
        JOIN order_items i ON i.order_id=o.id GROUP BY o.id ORDER BY o.id DESC LIMIT 500`,
        )
        .all(),
      audit: db
        .prepare(
          `SELECT a.id,a.action,a.target_type,a.target_id,a.detail,a.created_at,u.name AS admin
        FROM admin_audit a JOIN users u ON u.id=a.admin_id ORDER BY a.id DESC LIMIT 500`,
        )
        .all(),
      users: db
        .prepare(
          "SELECT id,name,email,is_admin,suspended,email_verified,created_at FROM users ORDER BY id DESC LIMIT 500",
        )
        .all(),
      products: db
        .prepare(
          `${publicProduct.replace("p.created_at,", "p.created_at,p.active,p.moderation,")} ORDER BY p.id DESC LIMIT 500`,
        )
        .all(),
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
  assert(false, "Unknown request", 404);
}
export function marketAction(action, body, user) {
  requireUser(user);
  if (action === "product") {
    const p = validProduct(body);
    const id = body.id
      ? int(body.id, "product", 1, Number.MAX_SAFE_INTEGER)
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
      assert(r.changes, "Product not found", 404);
    } else {
      assert(
        rateLimit("product:" + user.id, 100, 86400_000),
        "The limit of new products for today has been exhausted",
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
    const id = int(body.id, "product", 1, Number.MAX_SAFE_INTEGER);
    assert(typeof body.active === "boolean", "Check status");
    const r = db
      .prepare("UPDATE products SET active=? WHERE id=? AND seller_id=?")
      .run(body.active ? 1 : 0, id, user.id);
    assert(r.changes, "Product not found", 404);
    return { ok: true };
  }
  if (action === "store") {
    const name = requiredText(body.name, "Store name", 2, 80),
      description = optionalText(body.description, "description", 1000);
    db.prepare(
      "INSERT INTO seller_profiles(user_id,store_name,description) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET store_name=excluded.store_name,description=excluded.description",
    ).run(user.id, name, description);
    return { ok: true };
  }
  if (action === "cartSet" || action === "favoriteSet") {
    const id = int(body.id, "product", 1, Number.MAX_SAFE_INTEGER);
    if (action === "cartSet") {
      const quantity = int(body.quantity, "quantity", 0, 100);
      if (quantity === 0)
        db.prepare(
          "DELETE FROM cart_items WHERE user_id=? AND product_id=?",
        ).run(user.id, id);
      else {
        const p = db
          .prepare(`${publicProduct} WHERE p.id=? AND ${visible}`)
          .get(id);
        assert(p, "Product unavailable", 404);
        assert(quantity <= p.stock, "Not enough product in stock");
        db.prepare(
          "INSERT INTO cart_items VALUES(?,?,?) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=excluded.quantity",
        ).run(user.id, id, quantity);
      }
    } else {
      assert(typeof body.enabled === "boolean", "Invalid value");
      if (body.enabled) {
        const p = db
          .prepare(`${publicProduct} WHERE p.id=? AND ${visible}`)
          .get(id);
        assert(p, "Product unavailable", 404);
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
    const name = requiredText(body.name, "Recipient’s name", 2, 100),
      phone = requiredText(body.phone, "Telephone", 5, 40),
      address = requiredText(body.address, "Delivery address", 5, 500),
      comment = optionalText(body.comment, "comment", 1000);
    const key = requiredText(body.key, "Order ID", 16, 100);
    assert(/^[\w-]+$/.test(key), "Invalid order ID");
    assert(
      Array.isArray(body.items) &&
        body.items.length > 0 &&
        body.items.length <= 50,
      "Add from 1 to 50 products",
    );
    const lines = new Map();
    for (const line of body.items) {
      const id = int(line?.id, "product", 1, Number.MAX_SAFE_INTEGER),
        quantity = int(line?.quantity, "quantity", 1, 100),
        price = int(line?.price, "price", 1, 100000000);
      assert(!lines.has(id), "Product listed again");
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
          "Reorder details have changed",
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
          "The product is missing or its balance has changed",
          409,
        );
        assert(
          p.price === price,
          "The price of the product has changed. Check your cart and place your order again.",
          409,
        );
        assert(p.seller_id !== user.id, "You cannot order your own product");
        total += p.price * quantity;
        assert(Number.isSafeInteger(total), "The order amount is too large");
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
    const id = int(body.id, "order", 1, Number.MAX_SAFE_INTEGER),
      status = requiredText(body.status, "Status", 3, 20),
      tracking = optionalText(body.tracking, "track number", 100);
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
      assert(allowed.includes(status), "Invalid status change", 409);
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
    const id = int(body.id, "order", 1, Number.MAX_SAFE_INTEGER),
      message = requiredText(body.message, "Message", 1, 2000);
    ownedItem(id, user);
    assert(
      rateLimit("message:" + user.id, 100, 3600_000),
      "Too many messages",
      429,
    );
    db.prepare(
      "INSERT INTO messages(item_id,sender_id,body) VALUES(?,?,?)",
    ).run(id, user.id, message);
    return { ok: true };
  }
  if (action === "report") {
    const id = int(body.id, "product", 1, Number.MAX_SAFE_INTEGER),
      reason = requiredText(body.reason, "Reason for complaint", 5, 1000);
    const p = db
      .prepare(`${publicProduct} WHERE p.id=? AND ${visible}`)
      .get(id);
    assert(p, "Product not found", 404);
    assert(p.seller_id !== user.id, "You can’t complain about your product");
    assert(
      rateLimit("report:" + user.id, 20, 86400_000),
      "The complaint limit has been reached for today.",
      429,
    );
    db.prepare(
      "INSERT INTO reports(product_id,reporter_id,reason) VALUES(?,?,?)",
    ).run(id, user.id, reason);
    return { ok: true };
  }
  if (action === "review") {
    const id = int(body.id, "product", 1, Number.MAX_SAFE_INTEGER),
      rating = int(body.rating, "assessment", 1, 5),
      text = requiredText(body.text, "Review", 3, 2000);
    assert(
      db
        .prepare(
          "SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=? AND o.buyer_id=? AND i.status='completed' LIMIT 1",
        )
        .get(id, user.id),
      "Feedback is available after receiving the product",
      403,
    );
    db.prepare(
      "INSERT INTO reviews(product_id,buyer_id,rating,body) VALUES(?,?,?,?) ON CONFLICT(product_id,buyer_id) DO UPDATE SET rating=excluded.rating,body=excluded.body,created_at=CURRENT_TIMESTAMP",
    ).run(id, user.id, rating, text);
    return { ok: true };
  }
  if (action === "adminProduct") {
    requireAdmin(user);
    const id = int(body.id, "product", 1, Number.MAX_SAFE_INTEGER);
    assert(["approved", "hidden"].includes(body.moderation), "Invalid status");
    return transaction(() => {
      const r = db
        .prepare("UPDATE products SET moderation=? WHERE id=?")
        .run(body.moderation, id);
      assert(r.changes, "Product not found", 404);
      audit(user, action, "product", id, body.moderation);
      return { ok: true };
    });
  }
  if (action === "adminUser") {
    requireAdmin(user);
    const id = int(body.id, "user", 1, Number.MAX_SAFE_INTEGER);
    assert(
      id !== user.id && typeof body.suspended === "boolean",
      "This account cannot be changed",
    );
    return transaction(() => {
      const target = db
        .prepare("SELECT is_admin FROM users WHERE id=?")
        .get(id);
      assert(target && !target.is_admin, "User not found", 404);
      db.prepare("UPDATE users SET suspended=? WHERE id=?").run(
        body.suspended ? 1 : 0,
        id,
      );
      if (body.suspended)
        db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
      audit(user, action, "user", id, body.suspended ? "suspended" : "active");
      return { ok: true };
    });
  }
  if (action === "adminReview") {
    requireAdmin(user);
    const id = int(body.id, "review", 1, Number.MAX_SAFE_INTEGER);
    return transaction(() => {
      const r = db.prepare("DELETE FROM reviews WHERE id=?").run(id);
      assert(r.changes, "Review not found", 404);
      audit(user, action, "review", id, "deleted");
      return { ok: true };
    });
  }
  if (action === "adminReport") {
    requireAdmin(user);
    const id = int(body.id, "complaint", 1, Number.MAX_SAFE_INTEGER);
    assert(["open", "resolved"].includes(body.status), "Invalid status");
    return transaction(() => {
      const r = db
        .prepare("UPDATE reports SET status=? WHERE id=?")
        .run(body.status, id);
      assert(r.changes, "Complaint not found", 404);
      audit(user, action, "report", id, body.status);
      return { ok: true };
    });
  }
  assert(false, "Unknown action", 404);
}
