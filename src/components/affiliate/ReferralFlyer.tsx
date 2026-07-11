/**
 * ReferralFlyer
 *
 * Uses the HTML5 Canvas API to composite the referral flyer template with the
 * member's unique referral code drawn into the white dashed box, then allows
 * download or native share.
 *
 * Template image: /public/referral-flyer-template.png
 * Code placement: centred inside the white dashed rectangle
 *   - x: ~5% from left edge
 *   - y: ~75.5% from top edge
 *   - width: ~54% of image width
 *   - height: ~8.5% of image height
 *
 * These percentages were measured from the uploaded template image and can
 * be tweaked if the template is ever updated.
 */

import { useEffect, useRef, useState } from "react";
import { Download, Share2, Loader2, ImageIcon } from "lucide-react";

// ── Code box geometry (all values as fraction of image dimensions) ──────────
// Measured from the white dashed rectangle in the template
const BOX = {
  x:      0.052,   // left edge of the white box
  y:      0.749,   // top edge of the white box
  w:      0.540,   // width of the white box
  h:      0.085,   // height of the white box
};

interface Props {
  code: string;
  memberName?: string;
}

export function ReferralFlyer({ code, memberName }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const [ready,    setReady]    = useState(false);
  const [error,    setError]    = useState(false);
  const [sharing,  setSharing]  = useState(false);

  // Draw the flyer onto the canvas whenever the code changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setReady(false);
    setError(false);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = "/referral-flyer-template.png";

    img.onload = () => {
      const W = img.naturalWidth;
      const H = img.naturalHeight;
      canvas.width  = W;
      canvas.height = H;

      // 1. Draw the base template
      ctx.drawImage(img, 0, 0, W, H);

      // 2. Calculate the code box in absolute pixels
      const bx = BOX.x * W;
      const by = BOX.y * H;
      const bw = BOX.w * W;
      const bh = BOX.h * H;

      // 3. Optionally fill a semi-transparent white overlay to ensure legibility
      //    even if the box background varies slightly across template versions.
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.roundRect(bx, by, bw, bh, 10);
      ctx.fill();

      // 4. Draw the referral code — large, bold, centred in the box
      const fontSize = Math.round(bh * 0.48);
      ctx.font        = `900 ${fontSize}px 'Arial Black', Arial, sans-serif`;
      ctx.fillStyle   = "#1a4d1a";
      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      ctx.letterSpacing = "6px";
      ctx.fillText(code, bx + bw / 2, by + bh / 2, bw - 24);

      // 5. Optionally add a subtle label above the code
      const labelSize = Math.round(bh * 0.20);
      ctx.font        = `600 ${labelSize}px Arial, sans-serif`;
      ctx.fillStyle   = "#2d7a2d";
      ctx.letterSpacing = "2px";
      ctx.fillText("REFERRAL CODE", bx + bw / 2, by + bh * 0.18, bw - 24);

      setReady(true);
    };

    img.onerror = () => {
      setError(true);
    };
  }, [code]);

  // ── Download ──────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    const dataUrl = canvas.toDataURL("image/png", 1.0);
    const a = document.createElement("a");
    a.href     = dataUrl;
    a.download = `vfarmers-referral-${code}.png`;
    a.click();
  };

  // ── Native share (mobile) ─────────────────────────────────────────────────
  const handleShare = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    setSharing(true);
    try {
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), "image/png", 1.0),
      );
      if (!blob) throw new Error("Failed to generate image");

      const file = new File([blob], `vfarmers-referral-${code}.png`, { type: "image/png" });
      const shareUrl = `${window.location.origin}/auth?ref=${code}`;

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "Join me on VFarmers",
          text: `🌱 Use my referral code ${code} to join VFarmers and start earning! ${shareUrl}`,
          files: [file],
        });
      } else if (navigator.share) {
        // Fallback: share URL only (older browsers / desktop)
        await navigator.share({
          title: "Join me on VFarmers",
          text: `🌱 Use my referral code ${code} to join VFarmers and start earning!`,
          url: shareUrl,
        });
      } else {
        // No Web Share API — fall back to download
        handleDownload();
      }
    } catch (e) {
      // User cancelled or share failed — silently ignore
      if (e instanceof Error && e.name !== "AbortError") {
        console.warn("[ReferralFlyer] Share failed:", e.message);
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Canvas preview */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted/20">
        {!ready && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <ImageIcon className="h-8 w-8 opacity-40" />
            <p>Flyer template not found.</p>
            <p className="text-xs">Upload <code className="rounded bg-muted px-1 py-0.5">referral-flyer-template.png</code> to <code className="rounded bg-muted px-1 py-0.5">/public/</code></p>
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ display: ready ? "block" : "none" }}
          aria-label={`Referral flyer with code ${code}`}
        />
      </div>

      {/* Action buttons */}
      {ready && (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
          >
            <Download className="h-4 w-4" />
            Download flyer
          </button>

          {"share" in navigator && (
            <button
              type="button"
              onClick={handleShare}
              disabled={sharing}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card/60 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-card disabled:opacity-60"
            >
              {sharing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
              Share flyer
            </button>
          )}
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        Your code <span className="font-mono font-semibold text-foreground">{code}</span> is embedded in the image — every download is unique to you.
      </p>
    </div>
  );
}
