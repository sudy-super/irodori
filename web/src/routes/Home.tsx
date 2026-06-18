import { Link } from 'react-router-dom'
import Logo from '../components/Logo'
import { useSavedVision } from '../lib/storage'

export default function Home() {
  const vision = useSavedVision()
  const locked = vision === null

  return (
    <div className="home-page">
      <section className="home-page__intro rise">
        <Logo size="xl" withSubtitle />
        <img
          src="/chick.png"
          alt=""
          aria-hidden="true"
          className="home-page__mascot"
        />
      </section>

      <section className="home-page__copy rise">
        <p>
          自分たちが当たり前に見えているこの世界と違う「当たり前」を持つ人がいます。
          先天性の色覚異常や加齢に伴う黄斑の異常で色に不便を抱える人たちと、
          正常色覚を持つ人をつなぐ色覚支援 Web サービスです。
        </p>
        <p>
          色覚を「修正する」のではなく、異なる見え方そのものを共有し合うことに価値を置いています。
          お題に合わせて絵を描き、誰かの絵を「相手の主観」で見て、互いの当たり前を体験的に理解できます。
        </p>
      </section>

      <section className="home-page__cards rise">
        <HomeCard to="/diagnose" title="診断する" />
        <HomeCard to="/draw" title="描く" locked={locked} />
        <HomeCard to="/gallery" title="見る" locked={locked} />
      </section>
    </div>
  )
}

function HomeCard({
  to,
  title,
  locked,
}: {
  to: string
  title: string
  locked?: boolean
}) {
  const baseStyle: React.CSSProperties = {
    textDecoration: 'none',
    color: 'var(--ink)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px 14px',
    fontSize: '1.15rem',
    fontWeight: 700,
  }

  if (locked) {
    return (
      <div
        className="card"
        aria-disabled="true"
        title="まず診断してください"
        style={{
          ...baseStyle,
          opacity: 0.35,
          cursor: 'not-allowed',
          boxShadow: 'none',
        }}
      >
        {title}
      </div>
    )
  }

  return (
    <Link to={to} className="card" style={baseStyle}>
      {title}
    </Link>
  )
}
