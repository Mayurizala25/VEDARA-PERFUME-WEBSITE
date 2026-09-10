import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './lib/commerce'; // registers the auth-aware cart/wishlist sync

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
