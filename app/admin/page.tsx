"use client";

import { useState } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [title, setTitle] = useState("Max Bet Play of the Day");
  const [gameTime, setGameTime] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Compress image client-side to stay under Vercel's body limit
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
        setImagePreview(compressed);
        setImageBase64(compressed);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!imageBase64 || !gameTime || !secret) {
      setStatus("Missing required fields");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const res = await fetch("/api/play", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": secret,
        },
        body: JSON.stringify({ imageBase64, gameTime, title }),
      });

      if (res.ok) {
        setStatus("Play uploaded successfully!");
      } else {
        const data = await res.json();
        setStatus(`Error: ${data.error}`);
      }
    } catch {
      setStatus("Failed to upload");
    }
    setLoading(false);
  };

  return (
    <>
      <style>{`
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'DM Sans',system-ui,sans-serif}
        .admin{max-width:500px;margin:40px auto;padding:0 20px;color:var(--txt)}
        :root{--txt:#f5f1eb;--txt2:rgba(245,241,235,.55);--border:rgba(255,255,255,.1);--card:rgba(255,255,255,.04)}
        @media(prefers-color-scheme:light){:root{--txt:#1a1a1a;--txt2:rgba(0,0,0,.5);--border:rgba(0,0,0,.1);--card:rgba(0,0,0,.04)}}
        .admin h1{font-family:'Bebas Neue',sans-serif;font-size:2rem;margin-bottom:24px}
        .field{margin-bottom:18px}
        .field label{display:block;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--txt2);margin-bottom:6px}
        .field input,.field textarea{width:100%;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--card);color:var(--txt);font-family:inherit;font-size:14px}
        .field input:focus{outline:none;border-color:#d4a843}
        .preview{max-width:100%;border-radius:10px;margin-top:8px}
        .submit-btn{width:100%;padding:14px;border-radius:10px;border:none;background:linear-gradient(135deg,#e8522a,#c23a1a);color:#fff;font-family:'Oswald',sans-serif;font-weight:600;font-size:14px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:transform .2s}
        .submit-btn:hover{transform:scale(1.02)}
        .submit-btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
        .status{margin-top:14px;font-size:13px;text-align:center;color:#4ade80}
        .status.err{color:#ef4444}
      `}</style>
      <div className="admin">
        <h1>Upload Today&apos;s Play</h1>

        <div className="field">
          <label>Admin Secret</label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter admin secret"
          />
        </div>

        <div className="field">
          <label>Play Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Max Bet Play of the Day"
          />
        </div>

        <div className="field">
          <label>Game Time (ET)</label>
          <input
            type="datetime-local"
            value={gameTime}
            onChange={(e) => setGameTime(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Bet Slip Image</label>
          <input type="file" accept="image/*" onChange={handleImageChange} />
          {imagePreview && (
            <img src={imagePreview} alt="Preview" className="preview" />
          )}
        </div>

        <button
          className="submit-btn"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Uploading..." : "Upload Play"}
        </button>

        {status && (
          <p className={`status${status.startsWith("Error") ? " err" : ""}`}>
            {status}
          </p>
        )}
      </div>
    </>
  );
}
