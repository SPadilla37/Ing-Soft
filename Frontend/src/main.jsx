import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import { esES } from '@clerk/localizations'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './assets/styles.css'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key")
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider 
      publishableKey={PUBLISHABLE_KEY}
      localization={esES}
      appearance={{
        layout: {
          socialButtonsVariant: 'blockButton',
          shimmer: true
        },
        variables: {
          colorPrimary: '#4ca5ff', // var(--blue)
          colorText: '#f6fbff',    // var(--text)
          colorBackground: '#12243d', // var(--bg-b)
          borderRadius: '0.75rem',
          colorInputText: '#f6fbff',
          colorInputBackground: 'rgba(255, 255, 255, 0.05)',
        },
        elements: {
          card: 'glass-clerk', // Podemos pasar clases de tu CSS
          formButtonPrimary: 'primary-btn-clerk',
          footerActionLink: 'text-primary-clerk',
          identityPreviewEditButtonIcon: 'text-primary-clerk',
          dividerLine: 'clerk-divider',
          socialButtonsBlockButton: 'clerk-social-button'
        }
      }}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </ClerkProvider>
  </React.StrictMode>,
)
