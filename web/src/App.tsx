import { Link, Route, Routes, useLocation } from 'react-router-dom'
import ColorFilterDefs from './components/ColorFilterDefs'
import Logo from './components/Logo'
import { useSavedVision } from './lib/storage'
import Diagnose from './routes/Diagnose'
import Draw from './routes/Draw'
import Gallery from './routes/Gallery'
import Home from './routes/Home'
import Post from './routes/Post'

export default function App() {
  const loc = useLocation()
  const isHome = loc.pathname === '/'
  const isDraw = loc.pathname === '/draw'
  const isFit = isDraw || isHome
  const vision = useSavedVision()
  const locked = vision === null

  return (
    <>
      <ColorFilterDefs />
      <div className={`page-frame rise${isFit ? ' page-frame--fit' : ''}`}>
        <header className="page-header">
          <Link to="/" className="brand" aria-label="irodori トップへ" style={{ textDecoration: 'none', visibility: isHome ? 'hidden' : 'visible' }}>
            <Logo size="xs" />
          </Link>
          <nav className="page-nav" aria-label="主要ナビゲーション">
            <Link to="/diagnose">診断</Link>
            <NavSlot to="/draw" locked={locked}>描く</NavSlot>
            <NavSlot to="/gallery" locked={locked}>見る</NavSlot>
          </nav>
        </header>
        <main className="page-body">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/diagnose" element={<Diagnose />} />
            <Route path="/draw" element={<Draw />} />
            <Route path="/gallery" element={<Gallery />} />
            <Route path="/post/:id" element={<Post />} />
          </Routes>
        </main>
        <footer className="page-footer">irodori</footer>
      </div>
    </>
  )
}

function NavSlot({
  to,
  locked,
  children,
}: {
  to: string
  locked: boolean
  children: React.ReactNode
}) {
  if (locked) {
    return (
      <span
        aria-disabled="true"
        title="まず診断してください"
        style={{ opacity: 0.35, cursor: 'not-allowed', pointerEvents: 'none' }}
      >
        {children}
      </span>
    )
  }
  return <Link to={to}>{children}</Link>
}
