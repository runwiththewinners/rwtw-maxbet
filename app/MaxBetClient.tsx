"use client";

import { useState, useEffect } from "react";

interface Props {
  hasAccess: boolean;
  authenticated: boolean;
  checkoutUrl: string;
  isAdmin?: boolean;
}

interface PlayData {
  imageBase64?: string;
  gameTime: string;
  title: string;
  updatedAt: string;
  description?: string;
  odds?: string;
  matchup?: string;
  betType?: string;
}

export default function MaxBetClient({ hasAccess, authenticated, checkoutUrl, isAdmin }: Props) {
  const [play, setPlay] = useState<PlayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });
  const [purchaseCount, setPurchaseCount] = useState(0);
  const [viewerCount, setViewerCount] = useState(0);
  const [adminAction, setAdminAction] = useState<string | null>(null);

  // Dynamic social proof: ramp up as game time approaches (4hr window typical)
  useEffect(() => {
    if (!play?.gameTime) return;

    const calcCounts = () => {
      const now = Date.now();
      const game = new Date(play.gameTime).getTime();
      const totalWindow = 4 * 60 * 60 * 1000; // assume 4hr window
      const timeToGame = game - now;

      // Progress from 0 (4hrs out) to 1 (game time), can exceed 1 after game starts
      const progress = Math.max(0, Math.min(1, 1 - timeToGame / totalWindow));

      // Viewers: 45-60 right when posted → 350+ at game time
      const baseViewers = Math.floor(45 + progress * progress * 310);
      const viewerJitter = Math.floor(Math.random() * 16) - 8;
      setViewerCount(Math.max(30, baseViewers + viewerJitter));

      // Purchases: 12-18 right when posted → 95+ at game time
      const basePurchases = Math.floor(12 + progress * progress * 85);
      const purchaseJitter = Math.floor(Math.random() * 5) - 2;
      setPurchaseCount(Math.max(8, basePurchases + purchaseJitter));
    };

    calcCounts();
    const interval = setInterval(calcCounts, 15000);
    return () => clearInterval(interval);
  }, [play?.gameTime, play?.updatedAt]);

  // Admin: upload play
  const [adminTitle, setAdminTitle] = useState("Max Bet Play of the Day");
  const [adminGameTime, setAdminGameTime] = useState("");
  const [adminImage, setAdminImage] = useState<string | null>(null);
  const [adminImagePreview, setAdminImagePreview] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState("");
  const [adminDescription, setAdminDescription] = useState("");
  const [adminOdds, setAdminOdds] = useState("");
  const [adminMatchup, setAdminMatchup] = useState("");
  const [adminBetType, setAdminBetType] = useState("");
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [betAmount, setBetAmount] = useState(100);
  const [scanning, setScanning] = useState(false);

  const handleScanSlip = async () => {
    if (!adminImage) { setAdminStatus("Upload an image first"); return; }
    if (!adminSecret) { setAdminStatus("Enter admin secret"); return; }
    setScanning(true);
    setAdminStatus("Scanning bet slip with AI...");
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
        body: JSON.stringify({ imageBase64: adminImage }),
      });
      if (res.ok) {
        const { data } = await res.json();
        if (data.title) setAdminTitle(data.title);
        if (data.odds) setAdminOdds(data.odds);
        if (data.gameTime) setAdminGameTime(data.gameTime);
        if (data.description) setAdminDescription(data.description);
        if (data.matchup) setAdminMatchup(data.matchup);
        if (data.betType) setAdminBetType(data.betType);
        setAdminStatus("Scan complete — review and post!");
      } else {
        const err = await res.json();
        setAdminStatus("Scan error: " + err.error);
      }
    } catch { setAdminStatus("Scan failed"); }
    setScanning(false);
  };

  const handleAdminImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new window.Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxW = 800;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.7);
        setAdminImagePreview(compressed);
        setAdminImage(compressed);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAdminUpload = async () => {
    if (!adminTitle || !adminGameTime || !adminSecret) {
      setAdminStatus("Missing required fields (pick + game time)");
      return;
    }
    setAdminLoading(true);
    setAdminStatus(null);
    try {
      const res = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
        body: JSON.stringify({ imageBase64: adminImage, gameTime: adminGameTime, title: adminTitle, description: adminDescription, odds: adminOdds, matchup: adminMatchup, betType: adminBetType }),
      });
      if (res.ok) {
        setAdminStatus("Play uploaded!");
        setAdminImage(null);
        setAdminImagePreview(null);
        // Refresh play data
        const playRes = await fetch("/api/play");
        const playData = await playRes.json();
        setPlay(playData.play || null);
      } else {
        const data = await res.json();
        setAdminStatus("Error: " + data.error);
      }
    } catch { setAdminStatus("Upload failed"); }
    setAdminLoading(false);
  };

  const handleAdminDelete = async () => {
    if (!adminSecret) { setAdminStatus("Enter admin secret"); return; }
    setAdminLoading(true);
    setAdminStatus(null);
    try {
      const res = await fetch("/api/play", {
        method: "DELETE",
        headers: { "x-admin-secret": adminSecret },
      });
      if (res.ok) {
        setAdminStatus("Play deleted");
        setPlay(null);
      } else {
        const data = await res.json();
        setAdminStatus("Error: " + data.error);
      }
    } catch { setAdminStatus("Delete failed"); }
    setAdminLoading(false);
  };

  // Fetch play data + auto-refresh every 30s
  useEffect(() => {
    const fetchPlay = () => {
      fetch("/api/play")
        .then((r) => r.json())
        .then((data) => {
          setPlay(data.play || null);
          setLoading(false);
        })
        .catch(() => {
          setPlay(null);
          setLoading(false);
        });
    };

    fetchPlay();
    const interval = setInterval(fetchPlay, 30000);
    return () => clearInterval(interval);
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!play?.gameTime) return;

    const target = new Date(play.gameTime).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }

      setTimeLeft({
        hours: Math.floor(diff / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        expired: false,
      });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [play?.gameTime]);

  const pad = (n: number) => String(n).padStart(2, "0");

  const calcPayout = (bet: number, oddsStr: string) => {
    const odds = parseInt(oddsStr);
    if (isNaN(odds) || bet <= 0) return { profit: 0, total: 0 };
    const profit = odds < 0 ? bet * (100 / Math.abs(odds)) : bet * (odds / 100);
    return { profit: Math.round(profit * 100) / 100, total: Math.round((bet + profit) * 100) / 100 };
  };

  // Recent purchase toast
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!play || hasAccess) return;

    const names = [
      "Alex M.", "Jordan R.", "Mike T.", "Chris B.", "Tyler S.",
      "Jake W.", "Ryan P.", "Matt D.", "Brandon L.", "Kevin H.",
      "Derek C.", "Austin F.", "Zach G.", "Nick E.", "Marcus J.",
      "Darius K.", "Trevor A.", "Sean O.", "Dylan V.", "Cameron N.",
    ];
    const times = ["just now", "1 min ago", "2 min ago", "3 min ago", "30 sec ago"];

    const showToast = () => {
      const name = names[Math.floor(Math.random() * names.length)];
      const time = times[Math.floor(Math.random() * times.length)];
      setToast(`${name} unlocked this ${time}`);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 4000);
    };

    // First toast after 8-15 seconds
    const firstDelay = setTimeout(showToast, (Math.random() * 7000) + 8000);

    // Recurring toasts every 20-45 seconds
    const interval = setInterval(() => {
      showToast();
    }, (Math.random() * 25000) + 20000);

    return () => {
      clearTimeout(firstDelay);
      clearInterval(interval);
    };
  }, [play, hasAccess]);

  return (
    <>
      <style>{styles}</style>

      {/* Purchase toast */}
      {toast && (
        <div className={`purchase-toast${toastVisible ? " show" : ""}`}>
          <span className="toast-icon">🔓</span>
          <span className="toast-text">{toast}</span>
        </div>
      )}
      <div className="mbp-wrap">
        <div className="mbp-content">
          {/* Header */}
          <header className="mbp-hero">
            {play ? (
              <div className="live-badge">
                <span className="live-dot" />
                Today&apos;s Play Is Live
              </div>
            ) : !loading ? (
              <div className="waiting-badge">
                <span className="waiting-dot" />
                Waiting For Today&apos;s Play
              </div>
            ) : null}
            <h1 className="mbp-title">
              Max Bet<br />
              <span className="gold">Play of the Day</span>
            </h1>
            <p className="mbp-sub">
              Our highest-conviction, most researched pick. One play. Max confidence.
            </p>
          </header>

          {/* Stats bar — only when play is live */}
          {play && (
            <div className="stats-bar">
              <div className="stat">
                <span className="stat-icon">👥</span>
                <span className="stat-val">{viewerCount}</span>
                <span className="stat-label">viewing now</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-icon">🔥</span>
                <span className="stat-val">{purchaseCount}</span>
                <span className="stat-label">bought today</span>
              </div>
            </div>
          )}

          {/* Countdown */}
          {play && !timeLeft.expired && (
            <div className="countdown-section">
              <span className="countdown-label">Game starts in</span>
              <div className="countdown">
                <div className="count-block">
                  <span className="count-num">{pad(timeLeft.hours)}</span>
                  <span className="count-unit">HRS</span>
                </div>
                <span className="count-sep">:</span>
                <div className="count-block">
                  <span className="count-num">{pad(timeLeft.minutes)}</span>
                  <span className="count-unit">MIN</span>
                </div>
                <span className="count-sep">:</span>
                <div className="count-block">
                  <span className="count-num">{pad(timeLeft.seconds)}</span>
                  <span className="count-unit">SEC</span>
                </div>
              </div>
              <div className="urgency-text">
                <span className="urgency-dot" />
                Lock in before game time
              </div>
            </div>
          )}

          {play && timeLeft.expired && (
            <div className="countdown-section">
              <div className="expired-badge">GAME IN PROGRESS</div>
            </div>
          )}

          {/* Play card */}
          <div className="play-card">
            {loading ? (
              <div className="play-loading">
                <div className="spinner" />
                <p>Loading today&apos;s play...</p>
              </div>
            ) : !play ? (
              <div className="no-play">
                <div className="no-play-pulse" />
                <span className="no-play-icon">🔥</span>
                <h3>Today&apos;s Play Drops Soon</h3>
                <p>
                  Our team is finalizing today&apos;s highest-conviction pick.
                  <br />
                  This page updates automatically — don&apos;t leave.
                </p>
                <div className="no-play-alert">
                  <span className="alert-dot" />
                  You&apos;ll be the first to see it
                </div>
              </div>
            ) : hasAccess ? (
              /* UNLOCKED — SHOW BET SLIP IMAGE */
              <div className="play-unlocked">
                <div className="unlocked-header">
                  <span className="unlocked-badge">🔓 UNLOCKED</span>
                </div>
                {play.imageBase64 && (
                  <div className="play-image-wrap">
                    <img src={play.imageBase64} className="play-image" alt="Today's pick" />
                  </div>
                )}
                {play.description && (
                  <div className="play-breakdown">
                    <h4 className="breakdown-title">Why We Love This Play</h4>
                    <p className="breakdown-text">{play.description}</p>
                  </div>
                )}
              </div>
            ) : (
              /* LOCKED — FOMO MODE */
              <div className="play-locked">
                {play.imageBase64 ? (
                  <div className="play-image-wrap play-image-locked-wrap">
                    <img src={play.imageBase64} className="play-image play-image-blurred" alt="Pick hidden" />
                    <div className="play-image-overlay">
                      <span className="lock-icon">🔒</span>
                    </div>
                  </div>
                ) : (
                  <div className="pick-card pick-card-locked">
                    <div className="pick-matchup blurred">Matchup Hidden</div>
                    <div className="pick-row">
                      <div>
                        <div className="pick-name blurred">Pick Hidden</div>
                        <div className="pick-type blurred">Bet Type</div>
                      </div>
                      <div className="pick-odds blurred">-000</div>
                    </div>
                  </div>
                )}

                <div className="lock-content">
                  <h2 className="lock-title">This Play Is Locked</h2>
                  <p className="lock-desc">
                    Unlock today&apos;s highest-conviction pick before game time.
                    {!timeLeft.expired && (
                      <><br /><strong>Only {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)} left.</strong></>
                    )}
                  </p>
                </div>

                <div className="lock-btn-section">
                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="unlock-btn"
                  >
                    <span className="unlock-btn-text">
                      Unlock Now — $24.99
                    </span>
                    <span className="unlock-btn-sub">One-time purchase</span>
                  </a>

                  <div className="social-proof">
                    <span className="proof-dot" />
                    {purchaseCount} people unlocked this today
                  </div>

                  <div className="trust-row">
                    <span className="trust-item">💎 Premium members get this free</span>
                    <span className="trust-item">👑 High Rollers get this free</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payout Calculator */}
          {play && play.odds && (
            <div className="calc-card">
              <div className="calc-header">
                <span className="calc-title">Payout Calculator</span>
                <span className="calc-subtitle">{hasAccess ? "See what you could win" : "Unlock to see full payout"}</span>
              </div>
              <div className="calc-body">
                <div className="calc-odds-row">
                  <span className="calc-odds-label">Odds</span>
                  <span className={`calc-odds-value${hasAccess ? "" : " blurred"}`}>{play.odds}</span>
                </div>
                <div className="quick-bets">
                  {[25, 50, 100, 250].map((amt) => (
                    <button
                      key={amt}
                      className={`quick-bet${betAmount === amt ? " active" : ""}`}
                      onClick={() => setBetAmount(amt)}
                    >
                      ${amt}
                    </button>
                  ))}
                </div>
                <div className="calc-input-wrap">
                  <label className="calc-label">Your Bet</label>
                  <div className="calc-input-row">
                    <span className="calc-dollar">$</span>
                    <input
                      type="number"
                      className="calc-input"
                      value={betAmount}
                      onChange={(e) => setBetAmount(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
              <div className={`calc-payout${hasAccess ? "" : " calc-payout-locked"}`}>
                {hasAccess ? (
                  <>
                    <div className="payout-row">
                      <span className="payout-label">Bet</span>
                      <span className="payout-value">${betAmount.toFixed(2)}</span>
                    </div>
                    <div className="payout-row">
                      <span className="payout-label">Profit</span>
                      <span className="payout-value">${calcPayout(betAmount, play.odds!).profit.toFixed(2)}</span>
                    </div>
                    <div className="payout-row payout-total-row">
                      <span className="payout-label">Total Payout</span>
                      <span className="payout-value payout-highlight">${calcPayout(betAmount, play.odds!).total.toFixed(2)}</span>
                    </div>
                  </>
                ) : (
                  <div className="payout-locked-content">
                    <p className="payout-locked-text">
                      Your <strong>${betAmount}</strong> bet could pay out...
                    </p>
                    <span className="payout-locked-amount">${calcPayout(betAmount, play.odds!).total.toFixed(2)}</span>
                    <p className="payout-locked-sub">Unlock to see the pick and your exact payout</p>
                    <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="payout-unlock-btn">
                      Unlock Now — $24.99
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom CTA for non-access */}
          {!hasAccess && play && (
            <div className="bottom-cta">
              <p className="bottom-text">
                Want the Max Bet Play every day? <strong>Join Premium</strong> — it&apos;s included.
              </p>
              <a
                href="https://whop.com/rwtw/rwtw/"
                target="_blank"
                rel="noopener noreferrer"
                className="bottom-btn"
              >
                Join Premium — Starting at $29.99
              </a>
            </div>
          )}

          {/* Admin Panel */}
          {isAdmin && (
            <div className="admin-panel">
              <button className="admin-toggle" onClick={() => setShowAdmin(!showAdmin)}>
                {showAdmin ? "▲ Hide Admin" : "⚙ Admin Controls"}
              </button>

              {showAdmin && (
                <div className="admin-body">
                  <div className="admin-field">
                    <label>Admin Secret</label>
                    <input type="password" value={adminSecret} onChange={(e) => setAdminSecret(e.target.value)} placeholder="Enter secret" />
                  </div>

                  <div className="admin-field">
                    <label>Scan Bet Slip (optional — auto-fills fields)</label>
                    <input type="file" accept="image/*" onChange={handleAdminImage} />
                    {adminImagePreview && <img src={adminImagePreview} alt="Preview" className="admin-preview" />}
                  </div>

                  {adminImagePreview && (
                    <button className="admin-scan-btn" onClick={handleScanSlip} disabled={scanning}>
                      {scanning ? "🔍 Scanning..." : "🤖 Scan Slip with AI"}
                    </button>
                  )}

                  <div className="admin-divider" />

                  <div className="admin-field">
                    <label>Pick (e.g. Duke -9.5)</label>
                    <input type="text" value={adminTitle} onChange={(e) => setAdminTitle(e.target.value)} placeholder="Duke -9.5" />
                  </div>

                  <div className="admin-field">
                    <label>Matchup (e.g. Clemson @ Duke)</label>
                    <input type="text" value={adminMatchup} onChange={(e) => setAdminMatchup(e.target.value)} placeholder="Clemson @ Duke" />
                  </div>

                  <div className="admin-field">
                    <label>Bet Type (e.g. Alternate Spread, Moneyline)</label>
                    <input type="text" value={adminBetType} onChange={(e) => setAdminBetType(e.target.value)} placeholder="Alternate Spread" />
                  </div>

                  <div className="admin-field">
                    <label>Game Time (ET)</label>
                    <input type="datetime-local" value={adminGameTime} onChange={(e) => setAdminGameTime(e.target.value)} />
                  </div>

                  <div className="admin-field">
                    <label>Odds (e.g. -110, +150)</label>
                    <input type="text" value={adminOdds} onChange={(e) => setAdminOdds(e.target.value)} placeholder="-110" />
                  </div>

                  <div className="admin-field">
                    <label>Play Description (visible to members only)</label>
                    <textarea
                      className="admin-textarea"
                      value={adminDescription}
                      onChange={(e) => setAdminDescription(e.target.value)}
                      placeholder="Why we love this play..."
                      rows={4}
                    />
                  </div>

                  <button className="admin-upload-btn" onClick={handleAdminUpload} disabled={adminLoading}>
                    {adminLoading ? "Uploading..." : "Upload Play"}
                  </button>

                  <button className="admin-delete-btn" onClick={handleAdminDelete} disabled={adminLoading}>
                    {adminLoading ? "Deleting..." : "Delete Current Play"}
                  </button>

                  {adminStatus && (
                    <p className={`admin-status${adminStatus.startsWith("Error") || adminStatus.includes("failed") || adminStatus.includes("error") ? " err" : ""}`}>
                      {adminStatus}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const styles = `
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}

:root{
  --gold:#d4a843;--gold-hi:#f0c95c;--gold-lo:#a07c2e;
  --fire:#e8522a;--fire-hi:#ff7043;
  --blue:#4ea8f6;
  --txt:#f5f1eb;
  --txt2:rgba(245,241,235,.55);
  --txt3:rgba(245,241,235,.3);
  --border:rgba(255,255,255,.08);
  --glass:rgba(255,255,255,.03);
  --card-bg:rgba(255,255,255,.03);
  --strong:rgba(255,255,255,.85);
}

@media(prefers-color-scheme:light){
  :root{
    --txt:#1a1a1a;
    --txt2:rgba(26,26,26,.6);
    --txt3:rgba(26,26,26,.35);
    --border:rgba(0,0,0,.1);
    --glass:rgba(0,0,0,.03);
    --card-bg:rgba(0,0,0,.03);
    --strong:rgba(0,0,0,.85);
  }
}

.mbp-wrap{
  min-height:100vh;overflow-x:hidden;-webkit-font-smoothing:antialiased;
  font-family:'DM Sans',system-ui,sans-serif;color:var(--txt);
}
.mbp-content{max-width:500px;margin:0 auto;padding:0 20px}

/* === Hero === */
.mbp-hero{text-align:center;padding:50px 0 24px}
.live-badge{
  display:inline-flex;align-items:center;gap:8px;
  padding:7px 18px;border-radius:100px;
  border:1px solid rgba(74,222,128,.2);background:rgba(74,222,128,.06);
  font-size:10.5px;font-weight:700;letter-spacing:3px;text-transform:uppercase;
  color:#4ade80;margin-bottom:28px;animation:fadeUp .6s ease both;
}
.live-dot{
  width:7px;height:7px;border-radius:50%;background:#4ade80;
  box-shadow:0 0 12px #4ade80;animation:pulse 1.5s ease-in-out infinite;
}
.waiting-badge{
  display:inline-flex;align-items:center;gap:8px;
  padding:7px 18px;border-radius:100px;
  border:1px solid rgba(212,168,67,.2);background:rgba(212,168,67,.06);
  font-size:10.5px;font-weight:700;letter-spacing:3px;text-transform:uppercase;
  color:var(--gold);margin-bottom:28px;animation:fadeUp .6s ease both;
}
.waiting-dot{
  width:7px;height:7px;border-radius:50%;background:var(--gold);
  box-shadow:0 0 12px var(--gold);animation:pulse 1.5s ease-in-out infinite;
}
.mbp-title{
  font-family:'Bebas Neue','Oswald',sans-serif;
  font-size:clamp(3rem,10vw,5.5rem);line-height:.88;letter-spacing:-1px;
  animation:fadeUp .6s ease .1s both;
}
.gold{
  background:linear-gradient(135deg,var(--gold-hi),var(--gold),var(--gold-lo));
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
}
.mbp-sub{
  font-size:15px;font-weight:300;color:var(--txt2);
  margin-top:16px;line-height:1.6;animation:fadeUp .6s ease .2s both;
}

/* === Stats bar === */
.stats-bar{
  display:flex;align-items:center;justify-content:center;gap:20px;
  padding:14px 0;margin-bottom:8px;animation:fadeUp .6s ease .25s both;
}
.stat{display:flex;align-items:center;gap:6px}
.stat-icon{font-size:14px}
.stat-val{font-family:'Oswald',sans-serif;font-weight:600;font-size:16px;color:var(--txt)}
.stat-label{font-size:11px;color:var(--txt3);letter-spacing:.3px}
.stat-divider{width:1px;height:20px;background:var(--border)}

/* === Countdown === */
.countdown-section{text-align:center;margin-bottom:20px;animation:fadeUp .6s ease .3s both}
.countdown-label{
  font-size:10px;font-weight:600;letter-spacing:4px;text-transform:uppercase;
  color:var(--fire);display:block;margin-bottom:12px;
}
.countdown{display:flex;align-items:center;justify-content:center;gap:6px}
.count-block{
  display:flex;flex-direction:column;align-items:center;
  background:var(--card-bg);border:1px solid var(--border);border-radius:10px;
  padding:10px 16px;min-width:68px;
}
.count-num{
  font-family:'Bebas Neue',sans-serif;font-size:32px;line-height:1;
  color:var(--txt);letter-spacing:1px;
}
.count-unit{font-size:8px;font-weight:700;letter-spacing:2px;color:var(--txt3);margin-top:2px}
.count-sep{font-family:'Bebas Neue',sans-serif;font-size:28px;color:var(--fire);animation:blink 1s step-end infinite}
@keyframes blink{50%{opacity:0}}

.urgency-text{
  display:inline-flex;align-items:center;gap:6px;
  margin-top:12px;font-size:11px;font-weight:600;
  color:var(--fire);letter-spacing:.5px;
}
.urgency-dot{width:5px;height:5px;border-radius:50%;background:var(--fire);animation:pulse 1.2s ease-in-out infinite}

.expired-badge{
  display:inline-block;padding:10px 24px;border-radius:10px;
  background:rgba(232,82,42,.1);border:1px solid rgba(232,82,42,.2);
  font-family:'Oswald',sans-serif;font-weight:700;font-size:14px;
  letter-spacing:3px;color:var(--fire);
}

/* === Play card === */
.play-card{
  border-radius:16px;overflow:hidden;
  border:1px solid var(--border);background:var(--card-bg);
  animation:fadeUp .6s ease .35s both;
  margin-bottom:20px;
}

.play-loading{text-align:center;padding:80px 20px;color:var(--txt2)}
.play-loading p{margin-top:16px;font-size:13px}
.spinner{width:30px;height:30px;border:2px solid var(--border);border-top-color:var(--gold);border-radius:50%;margin:0 auto;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

.no-play{text-align:center;padding:60px 30px;position:relative;overflow:hidden}
.no-play-pulse{
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:200px;height:200px;border-radius:50%;
  background:radial-gradient(circle,rgba(232,82,42,.08) 0%,transparent 70%);
  animation:breathe 3s ease-in-out infinite;
}
@keyframes breathe{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.6}50%{transform:translate(-50%,-50%) scale(1.4);opacity:1}}
.no-play-icon{font-size:40px;display:block;margin-bottom:16px;position:relative;z-index:1;animation:iconBob 2s ease-in-out infinite}
@keyframes iconBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.no-play h3{
  font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1.5px;
  margin-bottom:10px;color:var(--txt);position:relative;z-index:1;
}
.no-play p{font-size:13px;color:var(--txt2);line-height:1.7;position:relative;z-index:1}
.no-play-alert{
  display:inline-flex;align-items:center;gap:6px;
  margin-top:18px;font-size:11px;font-weight:600;
  color:var(--gold);letter-spacing:.5px;position:relative;z-index:1;
}
.alert-dot{width:6px;height:6px;border-radius:50%;background:var(--gold);box-shadow:0 0 10px var(--gold);animation:pulse 1.5s ease-in-out infinite}

/* Unlocked */
.play-unlocked{position:relative}
.unlocked-header{padding:14px 18px;display:flex;align-items:center}
.unlocked-badge{
  font-family:'Oswald',sans-serif;font-weight:700;font-size:12px;
  letter-spacing:2px;color:#4ade80;
}
.play-image-wrap{border-radius:12px;overflow:hidden;margin-bottom:16px;border:1px solid var(--border)}
.play-image{width:100%;display:block}

/* Locked — FOMO */
.play-locked{position:relative;overflow:hidden}
.play-image-locked-wrap{position:relative;border-radius:12px;overflow:hidden;margin-bottom:16px;border:1px solid var(--border)}
.play-image-blurred{
  width:100%;display:block;
  filter:blur(28px) brightness(.7) saturate(.5);
  transform:scale(1.08);
}
.play-image-overlay{
  position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(0,0,0,.2) 0%,rgba(0,0,0,.5) 50%,rgba(0,0,0,.7) 100%);
  display:flex;align-items:center;justify-content:center;
}
.play-image-overlay .lock-icon{font-size:48px;filter:drop-shadow(0 4px 12px rgba(0,0,0,.5))}
.blur-container{position:relative;width:100%;min-height:300px}
.blur-overlay{
  position:absolute;inset:0;
  background:linear-gradient(180deg,
    rgba(0,0,0,.3) 0%,
    rgba(0,0,0,.6) 40%,
    rgba(0,0,0,.85) 100%
  );
}

.lock-content{
  text-align:center;
  padding:28px 24px 16px;
}
.lock-btn-section{text-align:center;padding:0 20px 32px}

.lock-icon-wrap{position:relative;margin-bottom:16px}
.lock-icon{font-size:36px;position:relative;z-index:2}
.lock-ring{
  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
  width:70px;height:70px;border-radius:50%;
  border:2px solid rgba(232,82,42,.3);
  animation:ringPulse 2s ease-in-out infinite;
}
.lock-ring-2{
  width:90px;height:90px;
  border-color:rgba(232,82,42,.15);
  animation-delay:.5s;
}
@keyframes ringPulse{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:1}50%{transform:translate(-50%,-50%) scale(1.15);opacity:.3}}

.lock-title{
  font-family:'Bebas Neue',sans-serif;font-size:clamp(1.6rem,5vw,2.2rem);
  letter-spacing:1px;color:#fff;margin-bottom:8px;
}
.lock-desc{font-size:13px;color:rgba(255,255,255,.6);line-height:1.6;max-width:320px;margin-bottom:20px}
.lock-desc strong{color:var(--fire);font-weight:700}

.unlock-btn{
  display:flex;flex-direction:column;align-items:center;
  padding:16px 40px;border-radius:12px;border:none;
  background:linear-gradient(135deg,var(--fire),#c23a1a);
  text-decoration:none;cursor:pointer;
  transition:transform .2s,box-shadow .2s;
  box-shadow:0 4px 24px rgba(232,82,42,.3);
  animation:btnGlow 2s ease-in-out infinite;
}
.unlock-btn:hover{transform:scale(1.04);box-shadow:0 6px 32px rgba(232,82,42,.5)}
@keyframes btnGlow{0%,100%{box-shadow:0 4px 24px rgba(232,82,42,.3)}50%{box-shadow:0 4px 36px rgba(232,82,42,.5)}}

.unlock-btn-text{
  font-family:'Oswald',sans-serif;font-weight:700;font-size:16px;
  letter-spacing:2px;text-transform:uppercase;color:#fff;
}
.unlock-btn-sub{font-size:10px;color:rgba(255,255,255,.6);margin-top:2px;letter-spacing:.5px}

.social-proof{
  display:inline-flex;align-items:center;gap:6px;
  margin-top:16px;font-size:11px;font-weight:500;
  color:rgba(255,255,255,.45);letter-spacing:.3px;
}
.proof-dot{width:5px;height:5px;border-radius:50%;background:#4ade80;animation:pulse 1.5s ease-in-out infinite}

.trust-row{
  display:flex;flex-direction:column;gap:4px;margin-top:12px;
}
.trust-item{font-size:10px;color:rgba(255,255,255,.35);letter-spacing:.3px}

/* === Bottom CTA === */
.bottom-cta{
  text-align:center;padding:20px 0 60px;
  animation:fadeUp .6s ease .4s both;
}
.bottom-text{font-size:13px;color:var(--txt2);margin-bottom:12px}
.bottom-text strong{color:var(--blue);font-weight:600}
.bottom-btn{
  display:inline-block;padding:13px 28px;border-radius:10px;
  background:linear-gradient(135deg,var(--blue),#2b7de9);
  font-family:'Oswald',sans-serif;font-weight:600;font-size:13px;
  letter-spacing:2px;text-transform:uppercase;text-decoration:none;
  color:#fff;transition:transform .2s;
}
.bottom-btn:hover{transform:scale(1.03)}

/* === Animations === */
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}

/* === Purchase Toast === */
.purchase-toast{
  position:fixed;bottom:20px;left:50%;transform:translateX(-50%) translateY(100px);
  display:flex;align-items:center;gap:10px;
  padding:12px 20px;border-radius:12px;
  background:var(--card-bg);border:1px solid var(--border);
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  box-shadow:0 8px 32px rgba(0,0,0,.2);
  font-size:13px;color:var(--txt);white-space:nowrap;
  opacity:0;transition:all .5s cubic-bezier(.16,1,.3,1);z-index:100;
  pointer-events:none;
}
.purchase-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.toast-icon{font-size:16px}
.toast-text{font-weight:500}

/* === Responsive === */
@media(max-width:600px){
  .mbp-hero{padding:36px 0 20px}
  .mbp-title{font-size:clamp(2.5rem,12vw,4rem)}
  .mbp-sub{font-size:14px}
  .count-block{padding:8px 12px;min-width:56px}
  .count-num{font-size:26px}
  .stats-bar{gap:14px}
  .stat-val{font-size:14px}
  .lock-content{padding:24px 18px}
  .unlock-btn{padding:14px 30px}
}

/* === Payout Calculator === */
.calc-card{
  border-radius:14px;border:1px solid var(--border);
  background:var(--card-bg);overflow:hidden;margin-top:16px;
  animation:fadeUp .6s ease .35s both;
}
.calc-header{
  padding:14px 20px;border-bottom:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;
}
.calc-title{font-family:'Oswald',sans-serif;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:var(--gold)}
.calc-subtitle{font-size:11px;color:var(--txt3)}
.calc-body{padding:16px 20px}
.calc-odds-row{
  display:flex;align-items:center;justify-content:space-between;
  padding:10px 14px;border-radius:10px;background:var(--glass);
  border:1px solid var(--border);margin-bottom:14px;
}
.calc-odds-label{font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:var(--txt2)}
.calc-odds-value{font-family:'Oswald',sans-serif;font-size:20px;font-weight:700;color:#4ade80}
.calc-odds-value.blurred{filter:blur(8px);user-select:none}
.quick-bets{display:flex;gap:8px;margin-bottom:14px}
.quick-bet{
  flex:1;padding:8px;border-radius:8px;
  border:1px solid var(--border);background:var(--glass);
  color:var(--txt2);font-family:'Oswald',sans-serif;font-size:13px;
  font-weight:600;cursor:pointer;transition:all .2s;text-align:center;
}
.quick-bet:hover{border-color:var(--gold);color:var(--gold)}
.quick-bet.active{border-color:var(--gold);background:rgba(212,168,67,.1);color:var(--gold)}
.calc-input-wrap{margin-bottom:4px}
.calc-label{display:block;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--txt2);margin-bottom:6px}
.calc-input-row{display:flex;align-items:center;border-radius:10px;border:1px solid var(--border);background:var(--glass);overflow:hidden}
.calc-dollar{padding:0 0 0 14px;font-family:'Oswald',sans-serif;font-size:18px;font-weight:600;color:var(--txt2)}
.calc-input{
  flex:1;padding:12px 14px 12px 6px;border:none;background:transparent;
  color:var(--txt);font-family:'Oswald',sans-serif;font-size:18px;font-weight:600;
  outline:none;
}
.calc-input::-webkit-inner-spin-button,.calc-input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
.calc-input[type=number]{-moz-appearance:textfield}
.calc-payout{padding:16px 20px;border-top:1px solid var(--border);background:rgba(74,222,128,.03)}
.payout-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
.payout-row:last-child{margin-bottom:0}
.payout-label{font-size:12px;color:var(--txt2);font-weight:500}
.payout-value{font-family:'Oswald',sans-serif;font-size:15px;font-weight:600;color:var(--txt)}
.payout-total-row{padding-top:8px;border-top:1px solid var(--border);margin-top:6px}
.payout-highlight{font-size:22px;color:#4ade80}
.calc-payout-locked{text-align:center;background:rgba(232,82,42,.03)}
.payout-locked-content{padding:4px 0}
.payout-locked-text{font-size:13px;color:var(--txt2);margin-bottom:6px}
.payout-locked-text strong{color:var(--txt)}
.payout-locked-amount{
  display:block;font-family:'Oswald',sans-serif;font-size:28px;font-weight:700;
  color:#4ade80;filter:blur(8px);user-select:none;margin-bottom:8px;
}
.payout-locked-sub{font-size:11px;color:var(--txt3);margin-bottom:14px}
.payout-unlock-btn{
  display:inline-flex;align-items:center;gap:6px;
  padding:10px 24px;border-radius:10px;border:none;
  background:linear-gradient(135deg,var(--fire),#c23a1a);
  color:#fff;font-family:'Oswald',sans-serif;font-weight:600;
  font-size:12px;letter-spacing:1.5px;text-transform:uppercase;
  cursor:pointer;text-decoration:none;transition:transform .2s;
}
.payout-unlock-btn:hover{transform:scale(1.03)}

/* === Admin Panel === */
.admin-panel{margin-top:24px;animation:fadeUp .6s ease both .4s}
.admin-toggle{
  width:100%;padding:12px;border-radius:10px;border:1px solid var(--border);
  background:var(--card-bg);color:var(--txt2);font-family:'Oswald',sans-serif;
  font-size:13px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;
  transition:all .2s;
}
.admin-toggle:hover{color:var(--txt);border-color:var(--gold)}
.admin-body{margin-top:14px;padding:20px;border-radius:12px;border:1px solid var(--border);background:var(--card-bg)}
.admin-field{margin-bottom:14px}
.admin-field label{display:block;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--txt2);margin-bottom:5px}
.admin-field input{width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--glass);color:var(--txt);font-family:inherit;font-size:13px}
.admin-field input:focus{outline:none;border-color:var(--gold)}
.admin-preview{max-width:100%;border-radius:8px;margin-top:8px}
.admin-textarea{
  width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);
  background:var(--glass);color:var(--txt);font-family:inherit;font-size:13px;
  resize:vertical;line-height:1.6;
}
.admin-textarea:focus{outline:none;border-color:var(--gold)}
/* === Pick Card === */
.pick-card{padding:20px;border-bottom:1px solid var(--border)}
.pick-card-locked{position:relative}
.pick-matchup{font-size:12px;color:var(--blue);font-weight:600;letter-spacing:.5px;margin-bottom:10px}
.pick-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
.pick-name{font-family:'Oswald',sans-serif;font-size:22px;font-weight:600;color:var(--txt);line-height:1.2}
.pick-type{font-size:11px;color:var(--txt3);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-top:4px}
.pick-odds{font-family:'Oswald',sans-serif;font-size:24px;font-weight:700;color:#4ade80;white-space:nowrap}
.pick-odds.negative{color:var(--gold)}
.blurred{filter:blur(10px);user-select:none}

.play-breakdown{
  padding:20px;border-top:1px solid var(--border);
}
.breakdown-title{
  font-family:'Oswald',sans-serif;font-size:14px;letter-spacing:1px;
  text-transform:uppercase;color:var(--gold);margin-bottom:10px;
}
.breakdown-text{
  font-size:14px;color:var(--txt2);line-height:1.7;white-space:pre-wrap;
}
.admin-upload-btn{
  width:100%;padding:12px;border-radius:10px;border:none;
  background:linear-gradient(135deg,var(--fire),#c23a1a);color:#fff;
  font-family:'Oswald',sans-serif;font-weight:600;font-size:13px;
  letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:transform .2s;
}
.admin-upload-btn:hover{transform:scale(1.02)}
.admin-upload-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.admin-delete-btn{
  width:100%;padding:12px;border-radius:10px;margin-top:10px;
  border:1px solid rgba(239,68,68,.3);background:transparent;color:#ef4444;
  font-family:'Oswald',sans-serif;font-weight:600;font-size:13px;
  letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .2s;
}
.admin-delete-btn:hover{background:rgba(239,68,68,.1);transform:scale(1.02)}
.admin-delete-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.admin-status{margin-top:10px;font-size:12px;text-align:center;color:#4ade80}
.admin-status.err{color:#ef4444}
.admin-scan-btn{
  width:100%;padding:12px;border-radius:10px;margin-bottom:14px;
  border:1px solid rgba(78,168,246,.3);background:rgba(78,168,246,.08);
  color:var(--blue);font-family:'Oswald',sans-serif;font-weight:600;
  font-size:13px;letter-spacing:2px;text-transform:uppercase;
  cursor:pointer;transition:all .2s;
}
.admin-scan-btn:hover{background:rgba(78,168,246,.15);transform:scale(1.02)}
.admin-scan-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
.admin-divider{height:1px;background:var(--border);margin:14px 0}
`;
