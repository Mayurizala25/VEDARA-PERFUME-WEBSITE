import { Component } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './ToastContext';
import AdminGuard from './AdminGuard';
import AdminLayout from './AdminLayout';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import ProductForm from './pages/ProductForm';
import Categories from './pages/Categories';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import SheetOrders from './pages/SheetOrders';
import Customers from './pages/Customers';
import Inventory from './pages/Inventory';

import Coupons from './pages/Coupons';
import Reports from './pages/Reports';
import Enquiries from './pages/Enquiries';
import Settings from './pages/Settings';
import './admin.module.css';

/**
 * Keeps a render error on one admin page from blanking the whole panel.
 * RLS/auth errors still surface through each page's own ErrorState.
 */
class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ maxWidth: '26rem', display: 'grid', gap: '0.8rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem' }}>This page hit an error</h2>
          <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem' }}>{this.state.error?.message || 'Something went wrong rendering this screen.'}</p>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
            <button type="button" onClick={() => { window.location.href = '/admin'; }}>Back to dashboard</button>
            <button type="button" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      </div>
    );
  }
}

/** VEDARA owner panel. Mounted by App.jsx for any /admin* path. */
export default function AdminApp() {
  return (
    <BrowserRouter basename="/admin" future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ToastProvider>
        <AdminErrorBoundary>
        <Routes>
          <Route path="login" element={<AdminLogin />} />
          <Route element={<AdminGuard />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="products/new" element={<ProductForm />} />
              <Route path="products/:id/edit" element={<ProductForm />} />
              <Route path="categories" element={<Categories />} />
              <Route path="orders" element={<Orders />} />
              <Route path="orders/:id" element={<OrderDetail />} />
              <Route path="sheet-orders" element={<SheetOrders />} />
              <Route path="customers" element={<Customers />} />
              <Route path="inventory" element={<Inventory />} />
              <Route path="reports" element={<Reports />} />
              <Route path="coupons" element={<Coupons />} />
              <Route path="contact-enquiries" element={<Enquiries />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
        </AdminErrorBoundary>
      </ToastProvider>
    </BrowserRouter>
  );
}
