import { useState } from 'react'
import type { GameMode, SetupConfig } from '../game/types'

export type StartRequest =
  | { kind: 'local'; config: SetupConfig }
  | { kind: 'create'; config: SetupConfig }
  | { kind: 'join'; code: string }

interface Props {
  onStart: (request: StartRequest) => void
  busy: boolean
  error: string | null
  onlineReady: boolean
}

interface PlayerDraft {
  name: string
  isBot: boolean
}

export function SetupScreen({ onStart, busy, error, onlineReady }: Props) {
  const [mode, setMode] = useState<GameMode>('millionaires')
  const [players, setPlayers] = useState<PlayerDraft[]>([
    { name: 'Sen', isBot: false },
    { name: 'Bot 1', isBot: true },
    { name: 'Bot 2', isBot: true },
  ])
  const [connection, setConnection] = useState<'local' | 'online'>('local')
  const [code, setCode] = useState('')

  function updatePlayer(index: number, patch: Partial<PlayerDraft>) {
    setPlayers((current) => current.map((p, i) => (i === index ? { ...p, ...patch } : p)))
  }

  function buildConfig(): SetupConfig {
    return { mode, players: players.map((p) => ({ name: p.name.trim() || 'Oyuncu', isBot: p.isBot })) }
  }

  return (
    <div className="setup">
      <header className="setup__hero">
        <div className="setup__crest">💎</div>
        <h1>AELSA <span>MİLYONER</span></h1>
        <p>Al, sat, riske at — ilk milyonun ya da 12 VIP kartın senin olsun.</p>
      </header>

      <div className="setup__grid">
        <section className="panel setup__panel">
          <h2 className="panel__title">1 · Oyunu seç</h2>
          <div className="mode-cards">
            <button
              className={`mode-card ${mode === 'millionaires' ? 'mode-card--on' : ''}`}
              onClick={() => setMode('millionaires')}
            >
              <span className="mode-card__icon">💰</span>
              <strong>Milyonerler</strong>
              <small>50.000 ₺ ile başla, ilk 1.000.000 ₺'ye ulaş.</small>
              <span className="mode-card__tag">AL · SAT · KÂR</span>
            </button>
            <button
              className={`mode-card ${mode === 'walletBattle' ? 'mode-card--on' : ''}`}
              onClick={() => setMode('walletBattle')}
            >
              <span className="mode-card__icon">👛</span>
              <strong>Cüzdan Savaşı</strong>
              <small>1.000.000 ₺ ile başla, ilk 12 VIP kartı topla.</small>
              <span className="mode-card__tag">HIZLI · ACIMASIZ</span>
            </button>
          </div>
        </section>

        <section className="panel setup__panel">
          <h2 className="panel__title">2 · Oyuncular</h2>
          <div className="player-editor">
            {players.map((p, i) => (
              <div className="player-editor__row" key={i}>
                <span className="player-editor__color" data-index={i} />
                <input
                  value={p.name}
                  maxLength={14}
                  onChange={(e) => updatePlayer(i, { name: e.target.value })}
                  aria-label={`${i + 1}. oyuncu adı`}
                />
                <button
                  className={`toggle ${p.isBot ? 'toggle--on' : ''}`}
                  onClick={() => updatePlayer(i, { isBot: !p.isBot })}
                  title="Bot oyuncu"
                >
                  {p.isBot ? '🤖' : '👤'}
                </button>
                <button
                  className="icon-btn"
                  disabled={players.length <= 2}
                  onClick={() => setPlayers((current) => current.filter((_, idx) => idx !== i))}
                  title="Oyuncuyu kaldır"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            className="btn btn--ghost btn--wide"
            disabled={players.length >= 6}
            onClick={() => setPlayers((current) => [...current, { name: `Oyuncu ${current.length + 1}`, isBot: false }])}
          >
            ＋ Oyuncu Ekle ({players.length}/6)
          </button>
        </section>

        <section className="panel setup__panel setup__panel--wide">
          <h2 className="panel__title">3 · Nasıl oynayalım?</h2>
          <div className="tabs">
            <button className={connection === 'local' ? 'tab tab--on' : 'tab'} onClick={() => setConnection('local')}>
              🖥️ Aynı Cihaz
            </button>
            <button
              className={connection === 'online' ? 'tab tab--on' : 'tab'}
              onClick={() => setConnection('online')}
              disabled={!onlineReady}
              title={onlineReady ? 'Supabase Realtime ile online oyun' : 'Supabase env değişkenleri eksik'}
            >
              🌐 Online (Supabase)
            </button>
          </div>

          {connection === 'local' ? (
            <div className="connection-body">
              <p className="muted">Oyuncular aynı ekranda sırayla hamle yapar. Botlar otomatik oynar.</p>
              <button className="btn btn--primary btn--wide" disabled={busy} onClick={() => onStart({ kind: 'local', config: buildConfig() })}>
                🚀 Oyunu Başlat
              </button>
            </div>
          ) : (
            <div className="connection-body">
              <div className="online-actions">
                <div>
                  <h3>Oda oluştur</h3>
                  <p className="muted">Oda kodu oluşturulur, arkadaşların katılır.</p>
                  <button className="btn btn--primary" disabled={busy} onClick={() => onStart({ kind: 'create', config: buildConfig() })}>
                    🔗 Oda Oluştur
                  </button>
                </div>
                <div>
                  <h3>Odaya katıl</h3>
                  <p className="muted">Arkadaşının verdiği kodu gir.</p>
                  <div className="inline-form">
                    <input
                      value={code}
                      maxLength={6}
                      placeholder="ABC123"
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                    />
                    <button className="btn btn--small" disabled={busy || code.length < 4} onClick={() => onStart({ kind: 'join', code })}>
                      Katıl
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && <div className="error-box">⚠️ {error}</div>}
        </section>
      </div>

      <details className="rules">
        <summary>📖 Kural özeti</summary>
        <ul>
          <li>İki zar atılır, toplam kadar ilerlenir. Çift gelirse tekrar at; üst üste üçüncü çift hapis cezasıdır.</li>
          <li>Renkli karede desteden üst kart çekilir. <strong>Alış ve satış fiyatı = kart değeri × kare çarpanı.</strong> Ucuz al, pahalı sat.</li>
          <li>El sınırı 5 karttır (Cüzdan Savaşı'nda sınır yoktur). START'tan geçerken ücretsiz kart ve banker maaşı alınır.</li>
          <li>Soyguncu nakdin yarısını alır (tabanca korur). Hapis en değerli kartı eler (avukat kurtarır). Kumarhanede tutulan sayı 2×/3× kazandırır.</li>
          <li>Milyonerler: ilk 1 milyon nakit kazanır. Cüzdan Savaşı: ilk 12 VIP kart kazanır; ödeyemeyen oyundan düşer.</li>
        </ul>
      </details>
    </div>
  )
}
