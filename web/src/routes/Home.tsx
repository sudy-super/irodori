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
          自分たちが<wbr />当たり前に<wbr />見えている<wbr />この世界と違う<wbr />
          <span style={{ whiteSpace: 'nowrap' }}>「当たり前」を持つ人が</span>います。
          先天性の<wbr />色覚異常や<wbr />加齢に伴う<wbr />黄斑の異常で<wbr />色に不便を<wbr />抱える人たちと、<wbr />
          正常色覚を<wbr />持つ人を<wbr />つなぐ<wbr />色覚支援 Web サービスです。
        </p>
        <p>
          色覚を<wbr />「修正する」のではなく、<wbr />異なる<wbr />見え方そのものを<wbr />共有し合うことに<wbr />価値を<wbr />置いています。
          お題に合わせて<wbr />絵を描き、<wbr />誰かの絵を<wbr />「相手の主観」で<wbr />見て、<wbr />
          互いの当たり前を<wbr />体験的に<wbr />理解できます。
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
