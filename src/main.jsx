import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import DesignLab from './DesignLab.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DesignLab />
  </StrictMode>,
)
