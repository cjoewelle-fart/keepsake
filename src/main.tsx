import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled with the app (no requests to font servers).
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import '@fontsource-variable/bricolage-grotesque'
import './ui/app.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
