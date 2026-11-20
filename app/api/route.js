import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { db, createPassword, verifyPassword, sessionUser, createSession, deleteSession } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const fail = (message, status=400) => NextResponse.json({error:message},{status});
const text = (x, max) => typeof x === 'string' ? x.trim().slice(0,max) : '';
const integer = x => Number.isSafeInteger(Number(x)) ? Number(x) : -1;
async function current() { const jar=await cookies(); return sessionUser(jar.get('session')?.value); }
function cookie(response, token) { response.cookies.set('session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production' && process.env.COOKIE_SECURE!=='false',sameSite:'lax',path:'/',maxAge:token?30*86400:0}); return response; }
function originAllowed(h) { const origin=h.get('origin'); if (!origin) return false; try { return new URL(origin).host === h.get('host'); } catch { return false; } }
export async function GET(req) {
  const url=new URL(req.url), view=url.searchParams.get('view'); const user=await current();
  if(view==='me') return NextResponse.json({user});
  if(view==='products') { const products=db.prepare(`SELECT p.id,p.seller_id,p.name,p.description,p.category,p.price,p.stock,p.image,u.name seller FROM products p JOIN users u ON u.id=p.seller_id WHERE p.active=1 ORDER BY p.id DESC`).all(); return NextResponse.json({products}); }
  if(!user) return fail('Войдите в аккаунт',401);
  if(view==='seller') return NextResponse.json({products:db.prepare('SELECT * FROM products WHERE seller_id=? ORDER BY id DESC').all(user.id), items:db.prepare(`SELECT i.*,o.name,o.phone,o.address,o.created_at FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.seller_id=? ORDER BY i.id DESC`).all(user.id)});
  if(view==='orders') { const orders=db.prepare('SELECT * FROM orders WHERE buyer_id=? ORDER BY id DESC').all(user.id); const items=db.prepare('SELECT i.* FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.buyer_id=? ORDER BY i.id DESC').all(user.id); return NextResponse.json({orders,items}); }
  return fail('Неизвестный запрос',404);
}
export async function POST(req) {
  if(!originAllowed(await headers())) return fail('Недопустимый источник запроса',403);
  let body; try { body=await req.json(); } catch { return fail('Некорректные данные'); }
  const action=body?.action; const jar=await cookies(); const user=await current();
  try {
    if(action==='register' || action==='login') {
      const email=text(body.email,254).toLowerCase(), password=typeof body.password==='string'?body.password:'';
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<8 || password.length>128) return fail('Укажите email и пароль длиной от 8 до 128 символов');
      let account=db.prepare('SELECT * FROM users WHERE email=?').get(email);
      if(action==='register') { const name=text(body.name,80); if(name.length<2) return fail('Укажите имя'); if(account) return fail('Этот email уже зарегистрирован'); const result=db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run(name,email,createPassword(password)); account={id:Number(result.lastInsertRowid),name,email}; }
      else if(!account || !verifyPassword(password,account.password)) return fail('Неверный email или пароль',401);
      return cookie(NextResponse.json({user:{id:account.id,name:account.name,email:account.email}}),createSession(account.id));
    }
    if(action==='logout') { deleteSession(jar.get('session')?.value); return cookie(NextResponse.json({ok:true}),''); }
    if(!user) return fail('Войдите в аккаунт',401);
    if(action==='product') {
      const name=text(body.name,120), description=text(body.description,3000), category=text(body.category,80), image=text(body.image,1000), price=integer(body.price), stock=integer(body.stock), id=integer(body.id);
      if(name.length<2 || !description || !category || price<1 || price>100000000 || stock<0 || stock>1000000) return fail('Проверьте название, описание, категорию, цену и остаток');
      if(image) { try { const url=new URL(image); if(url.protocol!=='https:') throw Error(); } catch { return fail('Ссылка на изображение должна начинаться с https://'); } }
      if(id>0) { const result=db.prepare('UPDATE products SET name=?,description=?,category=?,image=?,price=?,stock=? WHERE id=? AND seller_id=?').run(name,description,category,image,price,stock,id,user.id); if(!result.changes) return fail('Товар не найден',404); }
      else db.prepare('INSERT INTO products(seller_id,name,description,category,image,price,stock) VALUES(?,?,?,?,?,?,?)').run(user.id,name,description,category,image,price,stock);
      return NextResponse.json({ok:true});
    }
    if(action==='archive') { const result=db.prepare('UPDATE products SET active=? WHERE id=? AND seller_id=?').run(body.active?1:0,integer(body.id),user.id); if(!result.changes) return fail('Товар не найден',404); return NextResponse.json({ok:true}); }
    if(action==='order') {
      const name=text(body.name,100),phone=text(body.phone,40),address=text(body.address,500),comment=text(body.comment,1000);
      if(name.length<2 || phone.length<5 || address.length<5 || !Array.isArray(body.items) || body.items.length<1 || body.items.length>50) return fail('Укажите получателя, телефон, адрес и товары');
      const lines=new Map(); for(const item of body.items) { const id=integer(item.id), qty=integer(item.quantity); if(id<1||qty<1||qty>100||lines.has(id)) return fail('Некорректная корзина'); lines.set(id,qty); }
      db.exec('BEGIN IMMEDIATE');
      try { let total=0; const selected=[]; for(const [id,quantity] of lines) { const p=db.prepare('SELECT * FROM products WHERE id=? AND active=1').get(id); if(!p || p.stock<quantity) throw Error('Товар отсутствует или его остаток изменился'); if(p.seller_id===user.id) throw Error('Нельзя заказать собственный товар'); total+=p.price*quantity; if(!Number.isSafeInteger(total)) throw Error('Сумма заказа слишком велика'); selected.push({p,quantity}); }
        const result=db.prepare('INSERT INTO orders(buyer_id,name,phone,address,comment,total) VALUES(?,?,?,?,?,?)').run(user.id,name,phone,address,comment,total); const orderId=Number(result.lastInsertRowid);
        for(const {p,quantity} of selected) { db.prepare('UPDATE products SET stock=stock-? WHERE id=?').run(quantity,p.id); db.prepare('INSERT INTO order_items(order_id,product_id,seller_id,product_name,price,quantity) VALUES(?,?,?,?,?,?)').run(orderId,p.id,p.seller_id,p.name,p.price,quantity); }
        db.exec('COMMIT'); return NextResponse.json({ok:true,orderId});
      } catch(e) { db.exec('ROLLBACK'); return fail(e.message); }
    }
    if(action==='status') { const status=text(body.status,20); if(!['new','accepted','shipped','completed','cancelled'].includes(status)) return fail('Недопустимый статус'); db.exec('BEGIN IMMEDIATE'); try { const item=db.prepare('SELECT * FROM order_items WHERE id=? AND seller_id=?').get(integer(body.id),user.id); if(!item) { db.exec('ROLLBACK'); return fail('Позиция не найдена',404); } if(item.status==='cancelled'||item.status==='completed') { db.exec('ROLLBACK'); return fail('Статус закрытого заказа изменить нельзя'); } if(status==='cancelled') db.prepare('UPDATE products SET stock=stock+? WHERE id=?').run(item.quantity,item.product_id); db.prepare('UPDATE order_items SET status=? WHERE id=?').run(status,item.id); db.exec('COMMIT'); return NextResponse.json({ok:true}); } catch(e){ db.exec('ROLLBACK'); throw e; } }
    return fail('Неизвестное действие',404);
  } catch(e) { console.error('API error:',e.message); return fail('Не удалось выполнить запрос',500); }
}

