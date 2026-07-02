import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import logo from "@/assets/vfarm-logo.png";

const searchSchema = z.object({ name: z.string().optional() });

export const Route = createFileRoute("/welcome")({
  validateSearch: searchSchema,
  component: WelcomePage,
});

// Total time before navigating to dashboard
const DURATION_MS = 6000;
// When to start the exit fade
const EXIT_AT_MS = DURATION_MS - 600;
// How long the progress bar fill takes
const PROGRESS_MS = DURATION_MS - 800;

// Confetti colours — green, gold, white, accent teal
const CONFETTI_COLORS = [
  "#22c55e", "#16a34a", "#4ade80",   // greens
  "#f59e0b", "#fbbf24", "#fde68a",   // golds
  "#ffffff", "#e2e8f0",              // whites
  "#34d399", "#6ee7b7",              // teals
  "#a78bfa", "#c4b5fd",             // purples (pop!)
];

const CONFETTI_COUNT = 120;

interface ConfettiPiece {
  id: number;
  x: number;          // vw start position
  color: string;
  shape: "rect" | "circle" | "ribbon";
  size: number;       // px
  delay: number;      // ms
  duration: number;   // ms fall duration
  swayAmp: number;    // px horizontal sway
  swayDir: 1 | -1;
  rotation: number;   // deg initial
  rotSpeed: number;   // deg/s
}

function generateConfetti(): ConfettiPiece[] {
  return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    shape: (["rect", "rect", "circle", "ribbon"] as const)[Math.floor(Math.random() * 4)],
    size: 6 + Math.random() * 8,
    delay: Math.random() * 1200,
    duration: 2200 + Math.random() * 2000,
    swayAmp: 40 + Math.random() * 80,
    swayDir: Math.random() > 0.5 ? 1 : -1,
    rotation: Math.random() * 360,
    rotSpeed: 120 + Math.random() * 360,
  }));
}

// Inject the confetti keyframes once into the document
function injectConfettiStyles() {
  const id = "vf-confetti-styles";
  if (typeof document === "undefined" || document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    @keyframes confetti-fall {
      0%   { transform: translateY(-40px) translateX(0) rotate(var(--rot-start)); opacity: 1; }
      80%  { opacity: 1; }
      100% { transform: translateY(110vh) translateX(var(--sway-end)) rotate(var(--rot-end)); opacity: 0; }
    }
    @keyframes logo-pop {
      0%   { transform: scale(0.6) rotate(-8deg); opacity: 0; }
      60%  { transform: scale(1.12) rotate(3deg); opacity: 1; }
      80%  { transform: scale(0.96) rotate(-1deg); }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes text-slide-up {
      0%   { transform: translateY(20px); opacity: 0; }
      100% { transform: translateY(0);    opacity: 1; }
    }
    @keyframes card-bounce-in {
      0%   { transform: scale(0.85) translateY(16px); opacity: 0; }
      65%  { transform: scale(1.04) translateY(-4px); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes burst-ring {
      0%   { transform: scale(0.4); opacity: 0.8; }
      100% { transform: scale(2.4); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function WelcomePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/welcome" });
  const firstName = search.name ?? "Farmer";

  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");
  const [confetti] = useState<ConfettiPiece[]>(() => generateConfetti());

  useEffect(() => {
    injectConfettiStyles();
    const t1 = setTimeout(() => setPhase("show"), 80);
    const t2 = setTimeout(() => setPhase("exit"), EXIT_AT_MS);
    const t3 = setTimeout(() => navigate({ to: "/dashboard", replace: true }), DURATION_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [navigate]);

  const visible = phase === "show";

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-hero"
      aria-live="polite"
      aria-label="Welcome to VFarmers"
    >
      {/* ── Ambient glow orbs ── */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.8s ease" }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background: "radial-gradient(circle, oklch(0.72 0.20 142 / 0.20) 0%, transparent 70%)",
            animation: visible ? "glow-pulse 3s ease-in-out infinite" : "none",
          }}
        />
        <div
          className="absolute left-1/4 top-1/4 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.82 0.14 85 / 0.10) 0%, transparent 70%)" }}
        />
        <div
          className="absolute right-1/4 bottom-1/4 h-[280px] w-[280px] translate-x-1/2 translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.15 260 / 0.08) 0%, transparent 70%)" }}
        />
      </div>

      {/* ── Burst ring (fires once on show) ── */}
      {visible && (
        <>
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/60"
            style={{ animation: "burst-ring 0.9s ease-out forwards" }}
          />
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/50"
            style={{ animation: "burst-ring 0.9s 0.15s ease-out forwards" }}
          />
        </>
      )}

      {/* ── Confetti ── */}
      {visible && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {confetti.map((p) => (
            <div
              key={p.id}
              style={{
                position: "absolute",
                top: 0,
                left: `${p.x}vw`,
                width: p.shape === "ribbon" ? p.size * 0.4 : p.size,
                height: p.shape === "ribbon" ? p.size * 3 : p.size,
                borderRadius: p.shape === "circle" ? "50%" : p.shape === "ribbon" ? "2px" : "2px",
                backgroundColor: p.color,
                opacity: 0,
                "--rot-start": `${p.rotation}deg`,
                "--rot-end": `${p.rotation + p.rotSpeed}deg`,
                "--sway-end": `${p.swayDir * p.swayAmp}px`,
                animation: `confetti-fall ${p.duration}ms ${p.delay}ms ease-in forwards`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      {/* ── Floating seed particles ── */}
      {visible && <SeedParticles />}

      {/* ── Main content ── */}
      <div
        className="relative z-10 flex flex-col items-center gap-7 px-6 text-center"
        style={{
          opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
          transform: phase === "enter" ? "scale(0.92)" : phase === "exit" ? "scale(1.04)" : "scale(1)",
          transition: phase === "enter"
            ? "opacity 0.5s ease, transform 0.5s ease"
            : "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        {/* Logo */}
        <div
          className="relative"
          style={{ animation: visible ? "logo-pop 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none" }}
        >
          {/* Pulsing glow ring */}
          <div
            className="absolute inset-0 rounded-[20px]"
            style={{
              boxShadow: "0 0 0 0 oklch(0.72 0.20 142 / 0.6)",
              animation: visible ? "glow-pulse 2s ease-in-out infinite" : "none",
              borderRadius: "20px",
            }}
          />
          <img
            src={logo}
            alt="VFarmers"
            className="relative h-28 w-28 rounded-[20px]"
            style={{ filter: "drop-shadow(0 6px 32px oklch(0.72 0.20 142 / 0.5))" }}
          />
        </div>

        {/* Brand */}
        <div style={{ animation: visible ? "text-slide-up 0.55s 0.25s ease both" : "none" }}>
          <p className="text-xs font-semibold tracking-[0.25em] text-primary/60 uppercase">
            Welcome to
          </p>
          <h1 className="mt-1 text-5xl font-bold tracking-tight">
            V<span className="text-gradient-primary">Farmers</span>
          </h1>
        </div>

        {/* Greeting card */}
        <div
          className="glass rounded-2xl px-10 py-6"
          style={{ animation: visible ? "card-bounce-in 0.6s 0.45s cubic-bezier(0.34,1.56,0.64,1) both" : "none" }}
        >
          <p className="text-xl font-bold text-foreground">
            Hey {firstName}! 🎉
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
            Your farm is ready.<br />Let's start growing together.
          </p>
        </div>

        {/* Tagline */}
        <p
          className="text-xs text-primary/50 tracking-widest uppercase"
          style={{ animation: visible ? "text-slide-up 0.5s 0.7s ease both" : "none" }}
        >
          Grow Together · Earn Together
        </p>

        {/* Progress bar */}
        <div
          className="h-1 w-56 overflow-hidden rounded-full bg-white/10"
          style={{ animation: visible ? "text-slide-up 0.4s 0.8s ease both" : "none" }}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary"
            style={{
              width: visible ? "100%" : "0%",
              transition: visible ? `width ${PROGRESS_MS}ms linear` : "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Floating botanical particles */
function SeedParticles() {
  const particles = [
    { emoji: "🌱", x: "8%",  y: "18%", delay: "0s",    dur: "5s",   size: "1.5rem" },
    { emoji: "🌿", x: "82%", y: "12%", delay: "0.4s",  dur: "6s",   size: "1.2rem" },
    { emoji: "🍃", x: "90%", y: "65%", delay: "0.9s",  dur: "5.5s", size: "1.4rem" },
    { emoji: "🌾", x: "6%",  y: "72%", delay: "0.6s",  dur: "6.5s", size: "1.3rem" },
    { emoji: "✨", x: "48%", y: "8%",  delay: "0.2s",  dur: "4s",   size: "1.1rem" },
    { emoji: "💚", x: "70%", y: "85%", delay: "1.1s",  dur: "5s",   size: "1rem"   },
    { emoji: "🌱", x: "22%", y: "90%", delay: "0.7s",  dur: "5.5s", size: "1rem"   },
    { emoji: "⭐", x: "15%", y: "45%", delay: "1.3s",  dur: "4.5s", size: "0.9rem" },
    { emoji: "🎊", x: "60%", y: "20%", delay: "0.3s",  dur: "5s",   size: "1.2rem" },
    { emoji: "🎉", x: "35%", y: "80%", delay: "0.8s",  dur: "6s",   size: "1.1rem" },
  ];

  return (
    <>
      {particles.map((p, i) => (
        <span
          key={i}
          className="pointer-events-none absolute select-none"
          style={{
            left: p.x,
            top: p.y,
            fontSize: p.size,
            opacity: 0.75,
            animation: `float ${p.dur} ease-in-out ${p.delay} infinite`,
          }}
          aria-hidden="true"
        >
          {p.emoji}
        </span>
      ))}
    </>
  );
}
