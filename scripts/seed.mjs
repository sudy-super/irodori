// scripts/seed.mjs
// ローカルの Worker (wrangler dev) に向けてサンプル投稿を流し込むスクリプト。
// 使い方:
//   1. 別ターミナルで `npm run dev:worker` を起動
//   2. このスクリプトを `npm run seed` で実行
//
// 各色覚プロファイル (正常 / 1型 / 2型 / 3型 / 黄斑変性) を持つ仮想の投稿者として、
// シェーディング込みの SVG を sharp で PNG 化して POST する。
// 画像自体は canonical な RGB で保存し、鑑賞時に投稿者の色覚フィルタを CSS で
// 重ねるかどうかをユーザーが切り替える設計。

import sharp from 'sharp'

const API_BASE = process.env.API_BASE ?? 'http://localhost:8787'

const W = 600
const H = 400

const ZERO = Object.freeze({ protan: 0, deutan: 0, tritan: 0, macular: 0 })
const profile = (overrides) => ({ ...ZERO, ...overrides })

function isNormal(p) {
  return p.protan < 0.05 && p.deutan < 0.05 && p.tritan < 0.05 && p.macular < 0.05
}

// ===== SVG 絵柄 =====
// それぞれ 600x400。主役には 2-3 階調 (シャドウ・ベース・ハイライト) を入れて
// カラーホイール導入後の「自由な色選び」感を出している。

const bg = (fill) => `<rect width="${W}" height="${H}" fill="${fill}"/>`

const drawings = {
  tomato: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${bg('#fffaf3')}
    <ellipse cx="305" cy="265" rx="150" ry="125" fill="#9b2727"/>
    <ellipse cx="300" cy="255" rx="140" ry="118" fill="#d54545"/>
    <ellipse cx="265" cy="218" rx="42" ry="22" fill="#f3a8a8" opacity="0.7"/>
    <path d="M 260 130 L 340 130 L 318 178 L 282 178 Z" fill="#3e8a3e"/>
    <path d="M 272 138 L 328 138 L 312 168 L 288 168 Z" fill="#5aab5a"/>
    <rect x="296" y="100" width="9" height="38" fill="#3e8a3e" rx="2"/>
    <path d="M 300 100 Q 320 88 332 102" stroke="#3e8a3e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="300" cy="255" rx="140" ry="118" fill="none" stroke="#1a1a1a" stroke-width="3"/>
    <path d="M 260 130 L 340 130 L 318 178 L 282 178 Z" fill="none" stroke="#1a1a1a" stroke-width="2"/>
  </svg>`,

  tomato_branch: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${bg('#fffaf3')}
    <path d="M 80 80 Q 200 110 320 90 T 540 110" stroke="#5a3a1f" stroke-width="6" fill="none"/>
    <g>
      <ellipse cx="170" cy="180" rx="55" ry="50" fill="#9b2727"/>
      <ellipse cx="168" cy="175" rx="50" ry="46" fill="#d54545"/>
      <ellipse cx="155" cy="160" rx="14" ry="8" fill="#f3a8a8" opacity="0.8"/>
      <path d="M 145 130 L 195 130 L 180 150 L 160 150 Z" fill="#3e8a3e"/>
    </g>
    <g>
      <ellipse cx="320" cy="220" rx="68" ry="62" fill="#9b2727"/>
      <ellipse cx="318" cy="215" rx="62" ry="58" fill="#d54545"/>
      <ellipse cx="302" cy="195" rx="18" ry="10" fill="#f3a8a8" opacity="0.8"/>
      <path d="M 290 150 L 350 150 L 332 178 L 308 178 Z" fill="#3e8a3e"/>
    </g>
    <g>
      <ellipse cx="470" cy="200" rx="48" ry="44" fill="#9b2727"/>
      <ellipse cx="468" cy="196" rx="44" ry="40" fill="#d54545"/>
      <path d="M 450 160 L 490 160 L 478 180 L 462 180 Z" fill="#3e8a3e"/>
    </g>
  </svg>`,

  apple: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${bg('#fffaf3')}
    <path d="M 300 130 C 220 130 180 200 220 280 C 240 330 270 350 300 350 C 330 350 360 330 380 280 C 420 200 380 130 300 130 Z" fill="#a02828"/>
    <path d="M 305 145 C 240 145 205 210 240 285 C 260 332 285 348 300 348 C 315 348 340 332 360 285 C 395 210 360 145 305 145 Z" fill="#c54141"/>
    <ellipse cx="265" cy="200" rx="22" ry="40" fill="#f3a0a0" opacity="0.55"/>
    <rect x="296" y="100" width="8" height="40" fill="#5a3a1f"/>
    <path d="M 304 115 Q 360 88 372 130" stroke="#3e8a3e" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="358" cy="118" rx="14" ry="8" fill="#5aab5a"/>
    <path d="M 300 130 C 220 130 180 200 220 280 C 240 330 270 350 300 350 C 330 350 360 330 380 280 C 420 200 380 130 300 130 Z" fill="none" stroke="#1a1a1a" stroke-width="3"/>
  </svg>`,

  rainbow: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${bg('#e8f4fa')}
    <path d="M 60 340 A 240 240 0 0 1 540 340" stroke="#d54545" stroke-width="22" fill="none"/>
    <path d="M 82 340 A 218 218 0 0 1 518 340" stroke="#e08b3a" stroke-width="22" fill="none"/>
    <path d="M 104 340 A 196 196 0 0 1 496 340" stroke="#e3c83a" stroke-width="22" fill="none"/>
    <path d="M 126 340 A 174 174 0 0 1 474 340" stroke="#5aab5a" stroke-width="22" fill="none"/>
    <path d="M 148 340 A 152 152 0 0 1 452 340" stroke="#3973c2" stroke-width="22" fill="none"/>
    <path d="M 170 340 A 130 130 0 0 1 430 340" stroke="#9156a8" stroke-width="22" fill="none"/>
    <ellipse cx="120" cy="345" rx="90" ry="22" fill="#ffffff" opacity="0.85"/>
    <ellipse cx="480" cy="345" rx="100" ry="24" fill="#ffffff" opacity="0.85"/>
  </svg>`,

  strawberry: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${bg('#fffaf3')}
    <path d="M 300 140 C 220 140 218 222 240 282 C 260 332 290 352 300 352 C 310 352 340 332 360 282 C 382 222 380 140 300 140 Z" fill="#a32a2a"/>
    <path d="M 300 152 C 232 152 232 230 250 282 C 268 326 292 346 300 346 C 308 346 332 326 350 282 C 368 230 368 152 300 152 Z" fill="#d54545"/>
    <ellipse cx="275" cy="195" rx="20" ry="30" fill="#f0a8a8" opacity="0.6"/>
    <path d="M 240 138 L 360 138 L 332 108 L 300 132 L 268 108 Z" fill="#3e8a3e"/>
    <path d="M 252 138 L 348 138 L 326 116 L 300 132 L 274 116 Z" fill="#5aab5a"/>
    <g fill="#f5d36a">
      <ellipse cx="265" cy="200" rx="5" ry="6"/>
      <ellipse cx="305" cy="216" rx="5" ry="6"/>
      <ellipse cx="338" cy="200" rx="5" ry="6"/>
      <ellipse cx="280" cy="250" rx="5" ry="6"/>
      <ellipse cx="320" cy="250" rx="5" ry="6"/>
      <ellipse cx="298" cy="288" rx="5" ry="6"/>
      <ellipse cx="262" cy="232" rx="4" ry="5"/>
      <ellipse cx="334" cy="232" rx="4" ry="5"/>
    </g>
  </svg>`,

  strawberry_basket: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${bg('#fffaf3')}
    <rect x="160" y="280" width="280" height="100" fill="#8a5a32" rx="14"/>
    <rect x="160" y="280" width="280" height="14" fill="#6b4321"/>
    <g transform="translate(220, 230) scale(0.45)">
      <path d="M 0 0 C -80 0 -80 80 -60 140 C -40 190 -10 210 0 210 C 10 210 40 190 60 140 C 80 80 80 0 0 0 Z" fill="#d54545"/>
      <path d="M -60 -2 L 60 -2 L 30 -28 L 0 -8 L -30 -28 Z" fill="#5aab5a"/>
    </g>
    <g transform="translate(290, 240) scale(0.5)">
      <path d="M 0 0 C -80 0 -80 80 -60 140 C -40 190 -10 210 0 210 C 10 210 40 190 60 140 C 80 80 80 0 0 0 Z" fill="#c93535"/>
      <path d="M -60 -2 L 60 -2 L 30 -28 L 0 -8 L -30 -28 Z" fill="#5aab5a"/>
    </g>
    <g transform="translate(370, 230) scale(0.45)">
      <path d="M 0 0 C -80 0 -80 80 -60 140 C -40 190 -10 210 0 210 C 10 210 40 190 60 140 C 80 80 80 0 0 0 Z" fill="#d54545"/>
      <path d="M -60 -2 L 60 -2 L 30 -28 L 0 -8 L -30 -28 Z" fill="#5aab5a"/>
    </g>
    <g transform="translate(255, 280) scale(0.35)">
      <path d="M 0 0 C -80 0 -80 80 -60 140 C -40 190 -10 210 0 210 C 10 210 40 190 60 140 C 80 80 80 0 0 0 Z" fill="#b53030"/>
    </g>
    <g transform="translate(330, 280) scale(0.35)">
      <path d="M 0 0 C -80 0 -80 80 -60 140 C -40 190 -10 210 0 210 C 10 210 40 190 60 140 C 80 80 80 0 0 0 Z" fill="#b53030"/>
    </g>
  </svg>`,

  forest: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${W}" height="${H}" fill="#cfe0ef"/>
    <rect width="${W}" height="200" y="${H - 200}" fill="#d8c2a3"/>
    <rect width="${W}" height="60" y="${H - 60}" fill="#8a6a3f"/>
    <polygon points="60,340 130,170 200,340" fill="#3e7a3e"/>
    <polygon points="60,340 130,200 200,340" fill="#5aab5a"/>
    <polygon points="160,340 250,140 340,340" fill="#2f5e2f"/>
    <polygon points="160,340 250,170 340,340" fill="#3aa055"/>
    <polygon points="300,340 380,160 460,340" fill="#3e7a3e"/>
    <polygon points="300,340 380,190 460,340" fill="#5aab5a"/>
    <polygon points="420,340 510,200 600,340" fill="#2f5e2f"/>
    <polygon points="420,340 510,225 600,340" fill="#3aa055"/>
    <circle cx="80" cy="80" r="30" fill="#fff5b8"/>
  </svg>`,

  sky: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#7ab9e0"/>
        <stop offset="1" stop-color="#cfe7f3"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#skyGrad)"/>
    <circle cx="500" cy="80" r="42" fill="#fff09a"/>
    <circle cx="500" cy="80" r="34" fill="#ffd84a"/>
    <ellipse cx="160" cy="160" rx="80" ry="32" fill="#ffffff"/>
    <ellipse cx="220" cy="180" rx="58" ry="26" fill="#ffffff"/>
    <ellipse cx="180" cy="170" rx="40" ry="18" fill="#e0eef6"/>
    <ellipse cx="380" cy="240" rx="70" ry="30" fill="#ffffff"/>
    <ellipse cx="440" cy="260" rx="50" ry="22" fill="#ffffff"/>
    <ellipse cx="410" cy="250" rx="35" ry="14" fill="#e0eef6"/>
  </svg>`,

  sky_balloon: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="skyGrad2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#86c1e3"/>
        <stop offset="1" stop-color="#dcecf4"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#skyGrad2)"/>
    <ellipse cx="120" cy="140" rx="70" ry="28" fill="#ffffff"/>
    <ellipse cx="480" cy="100" rx="60" ry="24" fill="#ffffff"/>
    <ellipse cx="300" cy="160" rx="80" ry="100" fill="#d54545"/>
    <ellipse cx="300" cy="160" rx="40" ry="50" fill="#f0a8a8" opacity="0.55"/>
    <path d="M 250 240 L 350 240 L 320 280 L 280 280 Z" fill="#5a3a1f"/>
    <rect x="280" y="280" width="40" height="40" fill="#8a6a3f"/>
    <line x1="240" y1="240" x2="280" y2="280" stroke="#1a1a1a" stroke-width="1.5"/>
    <line x1="360" y1="240" x2="320" y2="280" stroke="#1a1a1a" stroke-width="1.5"/>
  </svg>`,

  sea: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="seaGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5fa9d8"/>
        <stop offset="1" stop-color="#2858a8"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="220" fill="url(#seaGrad)"/>
    <rect y="220" width="${W}" height="180" fill="#e8c87a"/>
    <path d="M 0 220 Q 100 200 200 220 T 400 220 T 600 220 L 600 240 L 0 240 Z" fill="#9ed1e8"/>
    <path d="M 0 240 Q 80 230 180 245 T 380 240 T 600 250 L 600 260 L 0 260 Z" fill="#bcd9e8" opacity="0.7"/>
    <circle cx="120" cy="80" r="36" fill="#fff09a"/>
    <circle cx="120" cy="80" r="28" fill="#ffd84a"/>
    <polygon points="430,210 430,140 480,210" fill="#ffffff" stroke="#1a1a1a" stroke-width="2"/>
    <polygon points="435,210 435,150 470,210" fill="#d54545"/>
    <rect x="426" y="208" width="60" height="14" fill="#5a3a1f"/>
  </svg>`,

  sunflower: (() => {
    const petals = []
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 * Math.PI) / 180
      const cx = Math.cos(angle) * 80
      const cy = Math.sin(angle) * 80
      petals.push(
        `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="42" ry="20" fill="#e3c83a" transform="rotate(${i * 30} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`,
        `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="35" ry="14" fill="#f5dd6a" transform="rotate(${i * 30} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`,
      )
    }
    return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      ${bg('#e8f0d8')}
      <rect x="292" y="220" width="16" height="170" fill="#3e7a3e"/>
      <path d="M 295 320 Q 250 305 240 280" stroke="#3e7a3e" stroke-width="14" fill="none" stroke-linecap="round"/>
      <ellipse cx="232" cy="278" rx="30" ry="14" fill="#5aab5a"/>
      <g transform="translate(300, 200)">
        ${petals.join('\n        ')}
        <circle r="52" fill="#6b4321"/>
        <circle r="46" fill="#8a5a32"/>
      </g>
    </svg>`
  })(),

  autumn: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${bg('#f4ead0')}
    <rect x="278" y="240" width="44" height="160" fill="#5a3a1f"/>
    <rect x="282" y="240" width="36" height="160" fill="#8a5a32"/>
    <circle cx="200" cy="170" r="60" fill="#c47532"/>
    <circle cx="200" cy="170" r="50" fill="#e08b3a"/>
    <circle cx="300" cy="130" r="80" fill="#a02828"/>
    <circle cx="300" cy="130" r="68" fill="#d54545"/>
    <circle cx="400" cy="170" r="60" fill="#c4a432"/>
    <circle cx="400" cy="170" r="50" fill="#e3c83a"/>
    <circle cx="240" cy="230" r="50" fill="#a02828"/>
    <circle cx="240" cy="230" r="42" fill="#d54545"/>
    <circle cx="360" cy="230" r="50" fill="#c47532"/>
    <circle cx="360" cy="230" r="42" fill="#e08b3a"/>
    <rect x="0" y="380" width="${W}" height="20" fill="#8a6a3f"/>
  </svg>`,

  fish: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a8d8e8"/>
        <stop offset="1" stop-color="#5fa9d8"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#waterGrad)"/>
    <path d="M 200 200 Q 280 130 380 200 Q 280 270 200 200 Z" fill="#c4621f"/>
    <path d="M 210 200 Q 285 145 370 200 Q 285 255 210 200 Z" fill="#e08b3a"/>
    <path d="M 380 200 L 440 160 L 440 240 Z" fill="#c4621f"/>
    <circle cx="240" cy="190" r="8" fill="#fffff0"/>
    <circle cx="240" cy="190" r="5" fill="#1a1a1a"/>
    <path d="M 200 200 Q 280 195 360 200" stroke="#1a1a1a" stroke-width="1.5" fill="none"/>
    <circle cx="120" cy="80" r="6" fill="#ffffff" opacity="0.7"/>
    <circle cx="100" cy="120" r="4" fill="#ffffff" opacity="0.7"/>
    <circle cx="500" cy="100" r="5" fill="#ffffff" opacity="0.7"/>
    <circle cx="480" cy="60" r="3" fill="#ffffff" opacity="0.7"/>
  </svg>`,

  bouquet: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${bg('#fff8e8')}
    <path d="M 280 350 L 300 240 L 320 350 Z" fill="#5a3a1f"/>
    <g>
      <circle cx="240" cy="200" r="32" fill="#d54545"/>
      <circle cx="240" cy="200" r="18" fill="#f5a0a0"/>
      <circle cx="240" cy="200" r="6" fill="#e3c83a"/>
    </g>
    <g>
      <circle cx="360" cy="200" r="32" fill="#9156a8"/>
      <circle cx="360" cy="200" r="18" fill="#c5a0d8"/>
      <circle cx="360" cy="200" r="6" fill="#e3c83a"/>
    </g>
    <g>
      <circle cx="300" cy="160" r="36" fill="#e3c83a"/>
      <circle cx="300" cy="160" r="22" fill="#f5dd6a"/>
      <circle cx="300" cy="160" r="6" fill="#5a3a1f"/>
    </g>
    <g>
      <circle cx="200" cy="170" r="26" fill="#3973c2"/>
      <circle cx="200" cy="170" r="14" fill="#86b5db"/>
    </g>
    <g>
      <circle cx="400" cy="170" r="26" fill="#e08b3a"/>
      <circle cx="400" cy="170" r="14" fill="#f0b878"/>
    </g>
    <path d="M 285 240 Q 230 240 220 200" stroke="#3e7a3e" stroke-width="4" fill="none"/>
    <path d="M 315 240 Q 370 240 380 200" stroke="#3e7a3e" stroke-width="4" fill="none"/>
    <path d="M 300 240 Q 300 200 300 175" stroke="#3e7a3e" stroke-width="4" fill="none"/>
    <ellipse cx="245" cy="225" rx="15" ry="6" fill="#5aab5a"/>
    <ellipse cx="355" cy="225" rx="15" ry="6" fill="#5aab5a"/>
  </svg>`,

  sunset: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sunsetGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3c3680"/>
        <stop offset="0.5" stop-color="#e85c3a"/>
        <stop offset="1" stop-color="#f5b878"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sunsetGrad)"/>
    <circle cx="300" cy="270" r="60" fill="#f0d878" opacity="0.7"/>
    <circle cx="300" cy="270" r="44" fill="#fff5b8"/>
    <rect y="${H - 40}" width="${W}" height="40" fill="#3a2a4a"/>
    <path d="M 0 360 L 80 320 L 160 340 L 240 305 L 320 335 L 400 310 L 480 330 L 600 305 L 600 400 L 0 400 Z" fill="#2a1f3a"/>
  </svg>`,

  pepper: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${bg('#f0eed8')}
    <path d="M 220 130 Q 200 200 210 270 Q 220 360 290 365 Q 380 365 390 270 Q 400 200 380 130 L 220 130 Z" fill="#2f7a30"/>
    <path d="M 232 145 Q 215 210 225 270 Q 235 350 295 355 Q 370 355 380 270 Q 388 210 370 145 L 232 145 Z" fill="#5aab5a"/>
    <path d="M 250 165 Q 240 220 250 270" stroke="#84c486" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.6"/>
    <path d="M 280 100 L 280 145 L 320 145 L 320 100 Z" fill="#3e7a3e"/>
    <rect x="293" y="80" width="14" height="30" fill="#5a3a1f"/>
  </svg>`,

  night: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="nightGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0e1538"/>
        <stop offset="1" stop-color="#3a3068"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#nightGrad)"/>
    <circle cx="450" cy="120" r="60" fill="#fff5b8" opacity="0.4"/>
    <circle cx="450" cy="120" r="48" fill="#fff5b8"/>
    <circle cx="436" cy="108" r="8" fill="#e0d090" opacity="0.5"/>
    <circle cx="460" cy="135" r="6" fill="#e0d090" opacity="0.5"/>
    <g fill="#fffacd">
      <circle cx="80" cy="60" r="2"/>
      <circle cx="160" cy="100" r="1.5"/>
      <circle cx="220" cy="50" r="2"/>
      <circle cx="300" cy="90" r="1.5"/>
      <circle cx="380" cy="40" r="2"/>
      <circle cx="120" cy="180" r="1.5"/>
      <circle cx="540" cy="60" r="1.5"/>
      <circle cx="560" cy="160" r="2"/>
      <circle cx="40" cy="240" r="1.5"/>
      <circle cx="200" cy="260" r="2"/>
      <circle cx="380" cy="280" r="1.5"/>
    </g>
    <polygon points="80,55 82,62 88,62 83,66 85,72 80,68 75,72 77,66 72,62 78,62" fill="#fffacd" opacity="0.8"/>
    <polygon points="540,55 542,62 548,62 543,66 545,72 540,68 535,72 537,66 532,62 538,62" fill="#fffacd" opacity="0.8"/>
    <rect x="0" y="${H - 30}" width="${W}" height="30" fill="#0a0c20"/>
  </svg>`,

  tulip: `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    ${bg('#fff5e8')}
    <rect x="294" y="200" width="12" height="200" fill="#3e7a3e"/>
    <path d="M 250 200 L 350 200 L 300 240 Z" fill="#a02828"/>
    <path d="M 250 200 Q 250 130 300 130 Q 350 130 350 200 Q 320 170 300 200 Q 280 170 250 200 Z" fill="#d54545"/>
    <path d="M 260 200 Q 260 145 300 145 Q 340 145 340 200 Q 320 180 300 200 Q 280 180 260 200 Z" fill="#e87c7c"/>
    <ellipse cx="270" cy="170" rx="10" ry="20" fill="#f5b8b8" opacity="0.7"/>
    <path d="M 305 280 Q 360 270 380 300" stroke="#3e7a3e" stroke-width="6" fill="none" stroke-linecap="round"/>
    <path d="M 300 320 Q 250 320 230 290" stroke="#3e7a3e" stroke-width="6" fill="none" stroke-linecap="round"/>
    <ellipse cx="370" cy="295" rx="22" ry="10" fill="#5aab5a"/>
    <ellipse cx="245" cy="295" rx="22" ry="10" fill="#5aab5a"/>
  </svg>`,
}

// ===== サンプル投稿の定義 (コメントなし) =====

const samples = [
  // 正常色覚
  { topic: 'トマト', profile: ZERO, drawing: 'tomato' },
  { topic: 'いちご', profile: ZERO, drawing: 'strawberry' },
  { topic: '虹', profile: ZERO, drawing: 'rainbow' },
  { topic: '花束', profile: ZERO, drawing: 'bouquet' },

  // 1型色覚
  { topic: 'トマト', profile: profile({ protan: 0.7 }), drawing: 'tomato_branch' },
  { topic: '紅葉', profile: profile({ protan: 0.5 }), drawing: 'autumn' },
  { topic: '夕焼け', profile: profile({ protan: 0.3 }), drawing: 'sunset' },

  // 2型色覚
  { topic: 'いちご', profile: profile({ deutan: 0.6 }), drawing: 'strawberry_basket' },
  { topic: '森', profile: profile({ deutan: 0.7 }), drawing: 'forest' },
  { topic: 'ピーマン', profile: profile({ deutan: 0.5 }), drawing: 'pepper' },

  // 3型色覚
  { topic: '青空と気球', profile: profile({ tritan: 0.7 }), drawing: 'sky_balloon' },
  { topic: '海と砂浜', profile: profile({ tritan: 0.5 }), drawing: 'sea' },
  { topic: '夜空と月', profile: profile({ tritan: 0.6 }), drawing: 'night' },

  // 黄斑変性
  { topic: 'ひまわり', profile: profile({ macular: 0.6 }), drawing: 'sunflower' },
  { topic: '金魚', profile: profile({ macular: 0.4 }), drawing: 'fish' },
  { topic: 'チューリップ', profile: profile({ macular: 0.3 }), drawing: 'tulip' },
]

function profileTag(p) {
  if (isNormal(p)) return '正常'
  const t = []
  if (p.protan > 0) t.push(`1型 ${Math.round(p.protan * 100)}%`)
  if (p.deutan > 0) t.push(`2型 ${Math.round(p.deutan * 100)}%`)
  if (p.tritan > 0) t.push(`3型 ${Math.round(p.tritan * 100)}%`)
  if (p.macular > 0) t.push(`黄変 ${Math.round(p.macular * 100)}%`)
  return t.join(' + ')
}

async function renderPng(svg) {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
}

async function postOne(s) {
  const svg = drawings[s.drawing]
  if (!svg) throw new Error(`unknown drawing: ${s.drawing}`)
  const png = await renderPng(svg)

  const fd = new FormData()
  fd.set('image', new Blob([png], { type: 'image/png' }), 'drawing.png')
  fd.set(
    'meta',
    JSON.stringify({
      topic: s.topic,
      artist_profile: s.profile,
      comment: null,
      width: W,
      height: H,
    }),
  )

  const res = await fetch(`${API_BASE}/api/posts`, { method: 'POST', body: fd })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`HTTP ${res.status}: ${body}`)
  }
  return res.json()
}

async function main() {
  console.log(`Seeding to ${API_BASE} …`)
  let ok = 0
  let fail = 0
  for (const s of samples) {
    try {
      const r = await postOne(s)
      console.log(`✓ ${s.topic.padEnd(10, '　')}  ${profileTag(s.profile).padEnd(18, ' ')}  ${r.id}`)
      ok++
    } catch (e) {
      console.error(`✗ ${s.topic}: ${e.message}`)
      fail++
    }
  }
  console.log(`\nDone: ${ok} succeeded, ${fail} failed`)
  if (fail > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
