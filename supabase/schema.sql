-- =====================================================
-- نظام إدارة الكاشير - مخطط قاعدة البيانات (Supabase)
-- شغّل هذا الملف في SQL Editor داخل لوحة Supabase
-- =====================================================
create extension if not exists "uuid-ossp";

-- ---------- الملفات الشخصية / المستخدمون ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'cashier' check (role in ('admin','manager','cashier')),
  phone text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- إنشاء الملف الشخصي تلقائياً عند التسجيل
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email),
    case when (select count(*) from public.profiles) = 0 then 'admin' else 'cashier' end);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create or replace function current_role_name() returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;
create or replace function is_admin() returns boolean language sql stable as $$ select current_role_name() = 'admin' $$;
create or replace function is_manager() returns boolean language sql stable as $$ select current_role_name() in ('admin','manager') $$;

-- ---------- الإعدادات ----------
create table if not exists settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- ---------- التصنيفات ----------
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  color text default '#6366f1',
  icon text default '📦',
  created_at timestamptz default now()
);

-- ---------- الموردون ----------
create table if not exists suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text, email text, address text, notes text,
  balance numeric(14,2) default 0,
  created_at timestamptz default now()
);

-- ---------- العملاء ----------
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text, email text, address text,
  points integer default 0,
  balance numeric(14,2) default 0,
  notes text,
  created_at timestamptz default now()
);

-- ---------- المنتجات ----------
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  barcode text unique,
  name text not null,
  description text,
  category_id uuid references categories(id) on delete set null,
  supplier_id uuid references suppliers(id) on delete set null,
  cost_price numeric(14,2) default 0,
  sale_price numeric(14,2) not null default 0,
  wholesale_price numeric(14,2) default 0,
  stock numeric(14,3) default 0,
  min_stock numeric(14,3) default 5,
  unit text default 'قطعة',
  tax_rate numeric(5,2) default 0,
  image_url text,
  is_active boolean default true,
  expiry_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_products_barcode on products(barcode);
create index if not exists idx_products_name on products using gin (to_tsvector('simple', name));

-- ---------- الورديات / الصندوق ----------
create table if not exists shifts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  opening_cash numeric(14,2) default 0,
  closing_cash numeric(14,2),
  expected_cash numeric(14,2),
  total_sales numeric(14,2) default 0,
  status text default 'open' check (status in ('open','closed')),
  opened_at timestamptz default now(),
  closed_at timestamptz,
  notes text
);

-- ---------- الخصومات ----------
create table if not exists discounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  code text unique,
  type text default 'percent' check (type in ('percent','fixed')),
  value numeric(14,2) not null,
  min_amount numeric(14,2) default 0,
  starts_at date, ends_at date,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ---------- المبيعات ----------
create sequence if not exists sale_number_seq;
create table if not exists sales (
  id uuid primary key default uuid_generate_v4(),
  sale_number bigint default nextval('sale_number_seq') unique,
  customer_id uuid references customers(id) on delete set null,
  user_id uuid references profiles(id),
  shift_id uuid references shifts(id),
  subtotal numeric(14,2) default 0,
  discount numeric(14,2) default 0,
  tax numeric(14,2) default 0,
  total numeric(14,2) default 0,
  paid numeric(14,2) default 0,
  change_due numeric(14,2) default 0,
  payment_method text default 'cash' check (payment_method in ('cash','card','credit','mixed')),
  status text default 'completed' check (status in ('completed','pending','refunded','partial_refund','cancelled')),
  notes text,
  created_at timestamptz default now()
);
create table if not exists sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid references sales(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  barcode text,
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  discount numeric(14,2) default 0,
  tax numeric(14,2) default 0,
  total numeric(14,2) not null
);

-- ---------- المرتجعات ----------
create table if not exists returns (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid references sales(id),
  user_id uuid references profiles(id),
  total numeric(14,2) default 0,
  reason text,
  created_at timestamptz default now()
);
create table if not exists return_items (
  id uuid primary key default uuid_generate_v4(),
  return_id uuid references returns(id) on delete cascade,
  product_id uuid references products(id),
  quantity numeric(14,3) not null,
  unit_price numeric(14,2) not null,
  total numeric(14,2) not null
);

-- ---------- المشتريات ----------
create table if not exists purchases (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid references suppliers(id),
  user_id uuid references profiles(id),
  invoice_ref text,
  total numeric(14,2) default 0,
  paid numeric(14,2) default 0,
  status text default 'received' check (status in ('received','pending','cancelled')),
  notes text,
  created_at timestamptz default now()
);
create table if not exists purchase_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid references purchases(id) on delete cascade,
  product_id uuid references products(id),
  quantity numeric(14,3) not null,
  cost_price numeric(14,2) not null,
  total numeric(14,2) not null
);

-- ---------- حركات المخزون ----------
create table if not exists stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) on delete cascade,
  type text not null check (type in ('sale','purchase','return','adjustment','transfer','damage')),
  quantity numeric(14,3) not null,
  reference_id uuid,
  user_id uuid references profiles(id),
  notes text,
  created_at timestamptz default now()
);

-- ---------- المصروفات ----------
create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  category text default 'عام',
  amount numeric(14,2) not null,
  user_id uuid references profiles(id),
  shift_id uuid references shifts(id),
  notes text,
  created_at timestamptz default now()
);

-- ---------- سجل النشاط ----------
create table if not exists activity_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id),
  action text not null,
  entity text,
  entity_id text,
  details jsonb,
  created_at timestamptz default now()
);

-- ---------- أحداث المسح (من تطبيق الهاتف) ----------
create table if not exists scan_events (
  id uuid primary key default uuid_generate_v4(),
  barcode text not null,
  device_id text,
  user_id uuid references profiles(id),
  target text default 'products' check (target in ('products','pos','inventory')),
  quantity numeric(14,3) default 1,
  consumed boolean default false,
  created_at timestamptz default now()
);
create index if not exists idx_scan_events_created on scan_events(created_at desc);

-- ---------- Realtime ----------
-- آمن لإعادة التشغيل: لا يضيف الجدول إن كان مضافاً مسبقاً
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='scan_events') then
      alter publication supabase_realtime add table scan_events;
    end if;
    if not exists (select 1 from pg_publication_tables
                   where pubname='supabase_realtime' and schemaname='public' and tablename='products') then
      alter publication supabase_realtime add table products;
    end if;
  end if;
end $$;

-- ---------- دوال مساعدة ----------
-- تحديث المخزون عند البيع (ذري)
create or replace function adjust_stock(p_product_id uuid, p_qty numeric, p_type text, p_ref uuid default null, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_active_user() then raise exception 'الحساب غير مفعّل'; end if;
  if p_qty is null or p_qty = 0 then return; end if;
  update products set stock = stock + p_qty, updated_at = now() where id = p_product_id;
  insert into stock_movements(product_id, type, quantity, reference_id, user_id, notes)
  values (p_product_id, p_type, p_qty, p_ref, auth.uid(), p_notes);
end $$;

-- إتمام عملية بيع كاملة في معاملة واحدة
create or replace function complete_sale(p_sale jsonb, p_items jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_sale_id uuid; v_item jsonb;
begin
  if not is_active_user() then raise exception 'الحساب غير مفعّل'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'لا أصناف في الفاتورة';
  end if;
  insert into sales(customer_id, user_id, shift_id, subtotal, discount, tax, total, paid, change_due, payment_method, status, notes)
  values ((p_sale->>'customer_id')::uuid, auth.uid(), (p_sale->>'shift_id')::uuid,
    (p_sale->>'subtotal')::numeric, (p_sale->>'discount')::numeric, (p_sale->>'tax')::numeric,
    (p_sale->>'total')::numeric, (p_sale->>'paid')::numeric, (p_sale->>'change_due')::numeric,
    coalesce(p_sale->>'payment_method','cash'), coalesce(p_sale->>'status','completed'), p_sale->>'notes')
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    -- حماية: لا كمية سالبة/صفرية ولا سعر سالب (وإلا أمكن التلاعب بالمخزون)
    if coalesce((v_item->>'quantity')::numeric, 0) <= 0 then raise exception 'كمية غير صالحة في الفاتورة'; end if;
    if coalesce((v_item->>'unit_price')::numeric, 0) < 0 or coalesce((v_item->>'total')::numeric, 0) < 0 then
      raise exception 'قيمة غير صالحة في الفاتورة';
    end if;
    insert into sale_items(sale_id, product_id, product_name, barcode, quantity, unit_price, discount, tax, total)
    values (v_sale_id, (v_item->>'product_id')::uuid, v_item->>'product_name', v_item->>'barcode',
      (v_item->>'quantity')::numeric, (v_item->>'unit_price')::numeric, coalesce((v_item->>'discount')::numeric,0),
      coalesce((v_item->>'tax')::numeric,0), (v_item->>'total')::numeric);
    perform adjust_stock((v_item->>'product_id')::uuid, -((v_item->>'quantity')::numeric), 'sale', v_sale_id, null);
  end loop;

  if (p_sale->>'customer_id') is not null then
    update customers set points = points + floor((p_sale->>'total')::numeric / 10),
      balance = balance + case when p_sale->>'payment_method' = 'credit' then (p_sale->>'total')::numeric - (p_sale->>'paid')::numeric else 0 end
    where id = (p_sale->>'customer_id')::uuid;
  end if;
  if (p_sale->>'shift_id') is not null then
    update shifts set total_sales = total_sales + (p_sale->>'total')::numeric where id = (p_sale->>'shift_id')::uuid;
  end if;
  return v_sale_id;
end $$;

-- إحصائيات لوحة التحكم
create or replace function dashboard_stats() returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_active_user() then raise exception 'الحساب غير مفعّل'; end if;
  return (select jsonb_build_object(
    'today_sales', coalesce((select sum(total) from sales where created_at::date = current_date and status='completed'),0),
    'today_count', (select count(*) from sales where created_at::date = current_date),
    'month_sales', coalesce((select sum(total) from sales where date_trunc('month',created_at)=date_trunc('month',now()) and status='completed'),0),
    'products', (select count(*) from products where is_active),
    'low_stock', (select count(*) from products where stock <= min_stock and is_active),
    'customers', (select count(*) from customers),
    'today_expenses', coalesce((select sum(amount) from expenses where created_at::date=current_date),0),
    'week', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'v', v) order by d),'[]'::jsonb) from (
        select g::date d, coalesce(sum(s.total),0) v from generate_series(current_date-6, current_date, '1 day') g
        left join sales s on s.created_at::date = g::date and s.status='completed' group by g) w)
  ));
end $$;

-- ---------- RLS ----------
do $$ declare t text; begin
  foreach t in array array['profiles','settings','categories','suppliers','customers','products','shifts','discounts','sales','sale_items','returns','return_items','purchases','purchase_items','stock_movements','expenses','activity_logs','scan_events'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "auth_select_%s" on %I', t, t);
    execute format('create policy "auth_select_%s" on %I for select to authenticated using (true)', t, t);
  end loop;
end $$;

-- الكتابة: المستخدمون المفعّلون
create or replace function is_active_user() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false)
$$;

do $$ declare t text; begin
  foreach t in array array['categories','suppliers','customers','products','shifts','sales','sale_items','returns','return_items','purchases','purchase_items','stock_movements','expenses','activity_logs','scan_events'] loop
    execute format('drop policy if exists "auth_insert_%s" on %I', t, t);
    execute format('create policy "auth_insert_%s" on %I for insert to authenticated with check (is_active_user())', t, t);
    execute format('drop policy if exists "auth_update_%s" on %I', t, t);
    execute format('create policy "auth_update_%s" on %I for update to authenticated using (is_active_user())', t, t);
  end loop;
end $$;

-- الحذف: المدراء فقط
do $$ declare t text; begin
  foreach t in array array['categories','suppliers','customers','products','discounts','sales','purchases','expenses','scan_events','returns'] loop
    execute format('drop policy if exists "mgr_delete_%s" on %I', t, t);
    execute format('create policy "mgr_delete_%s" on %I for delete to authenticated using (is_manager())', t, t);
  end loop;
end $$;

-- الملفات الشخصية: المستخدم يعدّل ملفه، المدير يعدّل الجميع
drop policy if exists "profile_update" on profiles;
create policy "profile_update" on profiles for update to authenticated
  using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- منع المستخدم من رفع صلاحياته أو تفعيل حسابه بنفسه (تعديل role / is_active للمدراء فقط)
create or replace function protect_profile_privileges() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if; -- وصول مباشر من قاعدة البيانات مسموح
  if (new.role is distinct from old.role) or (new.is_active is distinct from old.is_active) then
    if not is_admin() then
      raise exception 'تعديل الصلاحية أو حالة الحساب متاح لمدير النظام فقط';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_protect_profile_privileges on profiles;
create trigger trg_protect_profile_privileges before update on profiles
  for each row execute function protect_profile_privileges();
-- الإعدادات والخصومات: المدراء
drop policy if exists "settings_write" on settings;
create policy "settings_write" on settings for all to authenticated using (is_manager()) with check (is_manager());
drop policy if exists "discounts_write" on discounts;
create policy "discounts_write" on discounts for insert to authenticated with check (is_manager());
drop policy if exists "discounts_upd" on discounts;
create policy "discounts_upd" on discounts for update to authenticated using (is_manager());

-- ---------- تخزين صور المنتجات (Supabase Storage) ----------
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('products','products', true)
    on conflict (id) do update set public = true;

    execute 'drop policy if exists "products_read" on storage.objects';
    execute 'create policy "products_read" on storage.objects for select using (bucket_id = ''products'')';
    execute 'drop policy if exists "products_insert" on storage.objects';
    execute 'create policy "products_insert" on storage.objects for insert to authenticated with check (bucket_id = ''products'' and is_active_user())';
    execute 'drop policy if exists "products_update" on storage.objects';
    execute 'create policy "products_update" on storage.objects for update to authenticated using (bucket_id = ''products'' and is_active_user())';
    execute 'drop policy if exists "products_delete" on storage.objects';
    execute 'create policy "products_delete" on storage.objects for delete to authenticated using (bucket_id = ''products'' and is_manager())';
  end if;
end $$;

-- ---------- صلاحيات تنفيذ الدوال ----------
-- الدوال security definer تتجاوز RLS، لذلك نمنع استدعاءها من anon/بدون حساب
-- ونتركها للمستخدمين المسجّلين (مع التحقق من التفعيل داخل الدالة)
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on function adjust_stock(uuid, numeric, text, uuid, text) from public';
    execute 'revoke all on function complete_sale(jsonb, jsonb) from public';
    execute 'revoke all on function dashboard_stats() from public';
    execute 'grant execute on function adjust_stock(uuid, numeric, text, uuid, text) to authenticated';
    execute 'grant execute on function complete_sale(jsonb, jsonb) to authenticated';
    execute 'grant execute on function dashboard_stats() to authenticated';
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on function adjust_stock(uuid, numeric, text, uuid, text) from anon';
    execute 'revoke all on function complete_sale(jsonb, jsonb) from anon';
    execute 'revoke all on function dashboard_stats() from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function adjust_stock(uuid, numeric, text, uuid, text) to service_role';
    execute 'grant execute on function complete_sale(jsonb, jsonb) to service_role';
    execute 'grant execute on function dashboard_stats() to service_role';
  end if;
end $$;

-- بيانات أولية
insert into settings(key,value) values
 ('store', '{"name":"متجري","phone":"","address":"","currency":"د.ج","tax_rate":0,"receipt_footer":"شكراً لزيارتكم"}')
on conflict do nothing;
insert into categories(name,icon,color) values ('عام','📦','#6366f1'),('مشروبات','🥤','#06b6d4'),('أغذية','🍞','#f59e0b')
on conflict do nothing;
