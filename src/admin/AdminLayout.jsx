import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getDashboardStats } from './lib/adminApi';
import { Icon } from './components/ui';
import s from './admin.module.css';

const NAV = [
  { section: 'Overview' },
  { to: '/', label: 'Dashboard', icon: 'dashboard', end: true },
  { section: 'Catalogue' },
  { to: '/products', label: 'Products', icon: 'box' },
  { to: '/categories', label: 'Categories', icon: 'layers' },
  { to: '/inventory', label: 'Inventory', icon: 'tag', badge: 'stock' },
  { section: 'Sales' },
  { to: '/orders', label: 'Orders', icon: 'cart', badge: 'orders' },
  { to: '/customers', label: 'Customers', icon: 'users' },
  { to: '/reports', label: 'Reports', icon: 'chart' },
  { to: '/coupons', label: 'Coupons', icon: 'ticket' },
  { section: 'Engagement' },
  // { to: '/reviews', label: 'Reviews', icon: 'star', badge: 'reviews' },
  { to: '/contact-enquiries', label: 'Enquiries', icon: 'mail', badge: 'enquiries' },
  { section: 'Account' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
];

const TITLES = {
  '/': 'Dashboard', '/products': 'Products', '/categories': 'Categories', '/inventory': 'Inventory',
  '/orders': 'Orders', '/customers': 'Customers', '/reports': 'Reports', '/coupons': 'Coupons', '/reviews': 'Reviews',
  '/contact-enquiries': 'Contact Enquiries', '/settings': 'Settings',
};

export default function AdminLayout() {
  const { user, profile, name, signOut } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [badges, setBadges] = useState({});

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  useEffect(() => {
    let alive = true;
    const load = () => getDashboardStats()
      .then((st) => { if (alive) setBadges({ orders: st.orders_pending, reviews: st.reviews_pending, enquiries: st.enquiries_new, stock: (st.low_stock || 0) + (st.out_of_stock || 0) }); })
      .catch(() => { });
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
    // Poll once on mount + every 60s — not on every admin route change.
  }, []);

  const title = TITLES[loc.pathname] || TITLES[`/${loc.pathname.split('/')[1]}`] || 'Admin';

  return (
    <div className={s.app}>
      <div className={s.shell}>
        {open ? <div className={s.scrim} onClick={() => setOpen(false)} /> : null}
        <aside className={s.sidebar} data-open={open || undefined}>
          <div className={s.brand}>
            <div>
              <div className={s.brandMark}>VEDARA</div>
              <div className={s.brandTag}>Owner Panel</div>
            </div>
          </div>
          <nav className={s.nav}>
            {NAV.map((item, i) => item.section ? (
              <div key={`sec-${i}`} className={s.navSection}>{item.section}</div>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `${s.navLink}${isActive ? ` ${s.navLinkActive}` : ''}`}
              >
                <Icon name={item.icon} size={17} />
                <span>{item.label}</span>
                {item.badge && badges[item.badge] ? <span className={s.navBadge}>{badges[item.badge]}</span> : null}
              </NavLink>
            ))}
          </nav>
          <div className={s.sidebarFoot}>
            <a href="/" target="_blank" rel="noreferrer">View store ↗</a>
          </div>
        </aside>

        <div className={s.main}>
          <header className={s.topbar}>
            <button className={`${s.btn} ${s.btnGhost} ${s.btnIcon} ${s.menuBtn}`} onClick={() => setOpen((v) => !v)} aria-label="Menu">
              <Icon name="menu" size={18} />
            </button>
            <span className={s.topbarTitle}>{title}</span>
            <span className={s.topbarSpacer} />
            <span className={s.topbarUser}>
              <strong>{name || profile?.full_name || user?.email}</strong>
              <button className={`${s.btn} ${s.btnGhost} ${s.btnSm}`} onClick={async () => { await signOut(); nav('/login', { replace: true }); }}>
                Sign out
              </button>
            </span>
          </header>
          <main className={s.content}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
