import './assets/styles/variables.css'
import './assets/styles/global.css'
import './index.css'
import './assets/styles/font.css'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PDFParse } from 'pdf-parse'

// 配置 PDF.js worker 路径
PDFParse.setWorker('/pdf-worker/pdf.worker.mjs')

createRoot(document.getElementById('root')!).render(
    <App />
)