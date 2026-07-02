import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import logo from "@/assets/vfarm-logo.png";

const searchSchema = z.object({ name: z.string().optional() });

export const Route = createFileRoute("/welcome")({
  validateSearch: searchSchema,
  component: WelcomePage,
});

const DURATION_MS = 3200;

function WelcomePage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/welcome" });
  const firstName = search.name ?? "Farmer";

  const [phase, setPhase] = useState<"enter" | "show" | "exit">("enter");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // enter → show
    timerRef.current = setTimeout(() => setPhase("show"), 80);
    // show → exit
    const exitTimer = setTimeout(() => setPhase("exit"), DURATION_MS - 400);
    // exit → navigate
    const navTimer = setTimeout(() => {
      navigate({ to: "/dashboard", replace: true });
    }, DURATION_MS);

    return () => {
      clearTimeout(timerRef.current!);
      clearTimeout(exitTimer);
      clearTimeout(navTimer);
    };
  }, [navigate]);

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-hero"
      aria-live="polite"
      aria-label="Welcome animation"
    >
      {/* Ambient glow orbs */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ transition: "opacity 0.6s ease", opacity: phase === "show" ? 1 : 0 }}
      >
        <div
          className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.72 0.20 142 / 0.18) 0%, transparent 70%)",
            animation: phase === "show" ? "glow-pulse 3s ease-in-out infinite" : "none",
          }}
        />
        <div
          className="absolute left-1/4 top-1/4 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, oklch(0.82 0.14 85 / 0.08) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Floating seed particles */}
      {phase === "show" && <SeedParticles />}

      {/* Main card */}
      <div
        className="relative z-10 flex flex-col items-center gap-6 px-6 text-center"
        style={{
          opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
          transform:
            phase === "enter"
              ? "translateY(24px) scale(0.95)"
              : phase === "exit"
                ? "translateY(-16px) scale(1.02)"
                : "translateY(0) scale(1)",
          transition:
            phase === "enter"
              ? "opacity 0.5s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)"
              : "opacity 0.4s ease, transform 0.4s ease-in",
        }}
      >
        {/* Logo with glow ring */}
        <div className="relative">
          <div
            className="absolute inset-0 rounded-2xl"
            style={{
              boxShadow: "0 0 48px oklch(0.72 0.20 142 / 0.55)",
              borderRadius: "20px",
            }}
          />
          <img
            src={logo}
            alt="VFarmers"
            className="relative h-24 w-24 rounded-[20px]"
            style={{ filter: "drop-shadow(0 4px 24px oklch(0.72 0.20 142 / 0.4))" }}
          />
        </div>

        {/* Brand name */}
        <div>
          <p className="text-sm font-medium tracking-widest text-primary/70 uppercase">
            Welcome to
          </p>
          <h1 className="mt-1 text-4xl font-bold tracking-tight text-foreground">
            V<span className="text-gradient-primary">Farmers</span>
          </h1>
        </div>

        {/* Personalised greeting */}
        <div className="glass rounded-2xl px-8 py-5">
          <p className="text-lg font-semibold text-foreground">
            Hey {firstName}! 🌱
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your farm is ready. Let's start growing.
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-48 overflow-hidden rounded-full bg-primary/20">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            style={{
              width: phase === "show" ? "100%" : "0%",
              transition: phase === "show" ? `width ${DURATION_MS - 600}ms linear` : "none",
            }}
          />
        </div>
      </div>
    </div>
  );
}

/** Small animated seed emoji particles scattered around the screen */
function SeedParticles() {
  const particles = [
    { emoji: "🌱", x: "12%", y: "20%", delay: "0s", dur: "4s", size: "1.4rem" },
    { emoji: "🌿", x: "80%", y: "15%", delay: "0.3s", dur: "5s", size: "1.1rem" },
    { emoji: "🍃", x: "88%", y: "70%", delay: "0.8s", dur: "4.5s", size: "1.3rem" },
    { emoji: "🌾", x: "8%",  y: "75%", delay: "0.5s", dur: "5.5s", size: "1.2rem" },
    { emoji: "✨", x: "50%", y: "10%", delay: "0.2s", dur: "3.5s", size: "1rem"   },
    { emoji: "💚", x: "72%", y: "82%", delay: "1s",   dur: "4.2s", size: "0.9rem" },
    { emoji: "🌱", x: "25%", y: "88%", delay: "0.6s", dur: "5s",   size: "1rem"   },
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
            opacity: 0.7,
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
