"use client";

import { useState, useEffect } from "react";

interface Props {
  hasAccess: boolean;
  authenticated: boolean;
  checkoutUrl: string;
  isAdmin?: boolean;
}

interface PlayData {
  imageBase64: string;
  gameTime: string;
  title: string;
  updatedAt: string;
}

export default function MaxBetClient({ hasAccess, authenticated, checkoutUrl, isAdmin }: Props) {
  const [play, setPlay] = useState<PlayData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });
  const [purchaseCount] = useState(() => Math.floor(Math.random() * 30) + 45);
  const [viewerCount] = useState(() => Math.floor(Math.random() * 80) + 120);
  const [adminAction, setAdminAction] = useState<string | null>(null);

  // Admin: upload play
  const [adminTitle, setAdminTitle] = useState("Max Bet Play of the Day");
  const [adminGameTime, setAdminGameTime] = useState("");
  const [adminImage, setAdminImage] = useState<string | null>(null);
  const [adminImagePreview, setAdminImagePreview] = useState<string | null>(null);
  const [adminSecret, setAdminSecret] = useState("");
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [adminLoading, setAdminLoading] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

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
    if (!adminImage || !adminGameTime || !adminSecret) {
      setAdminStatus("Missing required fields");
      return;
    }
    setAdminLoading(true);
    setAdminStatus(null);
    try {
      const res = await fetch("/api/play", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-secret": adminSecret },
        body: JSON.stringify({ imageBase64: adminImage, gameTime: adminGameTime, title: adminTitle }),
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
    if (!confirm("Delete today's play?")) return;
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

  return (
    <>
      <style>{styles}</style>
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
              /* UNLOCKED */
              <div className="play-unlocked">
                <div className="unlocked-header">
                  <span className="unlocked-badge">🔓 UNLOCKED</span>
                </div>
                <img
                  src={play.imageBase64}
                  alt="Max Bet Play"
                  className="play-image"
                />
              </div>
            ) : (
              /* LOCKED — FOMO MODE */
              <div className="play-locked">
                <div className="blur-container">
                  <img
                    src={play.imageBase64}
                    alt=""
                    className="play-image-blurred"
                  />
                  <div className="blur-overlay" />
                </div>

                <div className="lock-content">
                  <div className="lock-icon-wrap">
                    <span className="lock-icon">🔒</span>
                    <div className="lock-ring" />
                    <div className="lock-ring lock-ring-2" />
                  </div>
                  <h2 className="lock-title">This Play Is Locked</h2>
                  <p className="lock-desc">
                    Unlock today&apos;s highest-conviction pick before game time.
                    {!timeLeft.expired && (
                      <><br /><strong>Only {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)} left.</strong></>
                    )}
                  </p>

                  <a
                    href={checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="unlock-btn"
                  >
                    <span className="unlock-btn-text">
                      Unlock Now — $49.99
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
                    <label>Play Title</label>
                    <input type="text" value={adminTitle} onChange={(e) => setAdminTitle(e.target.value)} />
                  </div>

                  <div className="admin-field">
                    <label>Game Time (ET)</label>
                    <input type="datetime-local" value={adminGameTime} onChange={(e) => setAdminGameTime(e.target.value)} />
                  </div>

                  <div className="admin-field">
                    <label>Bet Slip Image</label>
                    <input type="file" accept="image/*" onChange={handleAdminImage} />
                    {adminImagePreview && <img src={adminImagePreview} alt="Preview" className="admin-preview" />}
                  </div>

                  <button className="admin-upload-btn" onClick={handleAdminUpload} disabled={adminLoading}>
                    {adminLoading ? "Uploading..." : "Upload Play"}
                  </button>

                  {play && (
                    <button className="admin-delete-btn" onClick={handleAdminDelete} disabled={adminLoading}>
                      {adminLoading ? "Deleting..." : "Delete Current Play"}
                    </button>
                  )}

                  {adminStatus && (
                    <p className={`admin-status${adminStatus.startsWith("Error") || adminStatus.includes("failed") ? " err" : ""}`}>
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
.play-image{width:100%;display:block}

/* Locked — FOMO */
.play-locked{position:relative;overflow:hidden}
.blur-container{position:relative;width:100%;min-height:300px}
.play-image-blurred{
  width:100%;display:block;
  filter:blur(28px) brightness(.7) saturate(.5);
  transform:scale(1.08);
}
.blur-overlay{
  position:absolute;inset:0;
  background:linear-gradient(180deg,
    rgba(0,0,0,.3) 0%,
    rgba(0,0,0,.6) 40%,
    rgba(0,0,0,.85) 100%
  );
}

.lock-content{
  position:absolute;inset:0;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:30px 24px;text-align:center;
}

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
`;
