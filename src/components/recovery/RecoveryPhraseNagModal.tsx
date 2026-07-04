/**
 * RecoveryPhraseNagModal
 *
 * Shown on the dashboard when the user has not yet set up a recovery phrase.
 * Cannot be dismissed without ticking the confirmation checkbox.
 *
 * Flow:
 *   Step 1 — Display 12 words in a numbered grid
 *   Step 2 — Confirm the user has written them down
 *   → calls setupRecoveryPhrase server fn → marks done
 */

import { useEffect, useRef, useState } from "react";
import {
  ShieldCheck, Copy, Check, AlertTriangle, Loader2, Eye, EyeOff,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { setupRecoveryPhrase } from "@/lib/recovery-phrase.functions";

// ── Word list (BIP-39 subset — 256 common English words) ------------------
// Using a curated subset that is easy to write and remember
const WORD_POOL = [
  "apple","river","stone","flame","cloud","dream","field","horse","light",
  "money","night","ocean","peace","queen","rapid","solar","tiger","uncle",
  "vivid","water","extra","young","zebra","amber","brave","crisp","delta",
  "eagle","fresh","giant","happy","ivory","jewel","kneel","lemon","maple",
  "noble","olive","piano","quiet","robin","sharp","toast","urban","viola",
  "wheat","xenon","yacht","arena","blaze","cedar","dance","earth","forge",
  "grace","heron","inlet","joust","karma","lunar","magic","nerve","orbit",
  "pilot","quill","ridge","storm","trout","unity","venom","waltz","exact",
  "yield","azure","birch","creek","dunes","ember","frost","grove","haven",
  "irony","jewel","knave","lilac","marsh","north","oasis","prism","quake",
  "realm","stone","thorn","ultra","vapor","weave","xylem","yours","zonal",
  "abbey","banjo","coral","depot","elbow","flair","gloom","husky","image",
  "joker","kudos","lofty","manor","nexus","optic","probe","quirk","rebel",
  "scout","trend","usher","verge","wrath","xylem","yearn","zesty","acorn",
  "bluff","crest","dwell","erode","flute","glide","helix","igloo","joust",
  "knack","lapse","melon","nymph","onion","plumb","quota","rivet","swamp",
  "tidal","unify","vouch","windy","expel","yodel","zoned","atlas","boron",
  "cacao","daisy","easel","fjord","guava","hatch","idiom","jelly","kayak",
  "llama","mango","notch","oxide","peach","query","raven","skimp","talon",
  "udder","vinyl","whelp","oxide","yucca","zonal","anvil","basil","cobra",
  "drape","elixir","fungi","graze","hoist","input","jaunt","kiosk","lyric",
  "maxim","navel","ovary","plaid","quaff","repel","snare","taboo","undue",
  "valve","waltz","xylem","yawl","zippy","adorn","bison","crane","dwarf",
  "ethos","finch","gully","hinge","issue","joule","knoll","lyric","merge",
  "nymph","onset","pixel","quart","risky","slate","tulip","umbra","viper",
  "woven","xeric","yeoman","zappy",
];

function generateWords(): string[] {
  const pool = [...WORD_POOL];
  const chosen: string[] = [];
  for (let i = 0; i < 12; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return chosen;
}

interface Props {
  onDismiss: () => void;
}

type Step = "display" | "confirm";

export function RecoveryPhraseNagModal({ onDismiss }: Props) {
  const [words] = useState<string[]>(() => generateWords());
  const [step, setStep] = useState<Step>("display");
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const setupFn = useServerFn(setupRecoveryPhrase);
  const hasSaved = useRef(false);

  // Auto-reveal on step 2
  useEffect(() => {
    if (step === "confirm") setRevealed(true);
  }, [step]);

  const handleCopy = () => {
    const text = words.map((w, i) => `${i + 1}. ${w}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleConfirm = async () => {
    if (!checked || hasSaved.current) return;
    hasSaved.current = true;
    setSaving(true);
    try {
      await setupFn({ data: { words } });
      toast.success("Recovery phrase saved securely.");
      onDismiss();
    } catch (err) {
      hasSaved.current = false;
      toast.error(err instanceof Error ? err.message : "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    // Full-screen backdrop — not dismissible by clicking outside
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-modal-title"
    >
      <div className="glass w-full max-w-lg rounded-3xl p-6 shadow-elegant">

        {/* Header */}
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h2 id="recovery-modal-title" className="text-base font-semibold text-foreground">
              Set up your Recovery Phrase
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              These 12 words are your account recovery key. Write them down in order and store them somewhere safe — never share them with anyone.
            </p>
          </div>
        </div>

        {/* Warning banner */}
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-[11px] text-amber-300/90 leading-relaxed">
            <span className="font-semibold text-amber-300">If you lose these words, you lose access to your account.</span>{" "}
            There is no other way to recover without email. Write them down now.
          </p>
        </div>

        {/* Phrase grid */}
        <div className="relative mb-4">
          <div
            className="grid grid-cols-3 gap-2"
            style={{ filter: revealed ? "none" : "blur(8px)", transition: "filter 0.3s ease" }}
          >
            {words.map((word, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-3 py-2"
              >
                <span className="w-5 shrink-0 text-center text-[10px] font-bold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-foreground">{word}</span>
              </div>
            ))}
          </div>

          {/* Reveal overlay */}
          {!revealed && (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-black/40 text-sm font-medium text-white backdrop-blur-none"
            >
              <Eye className="h-5 w-5" />
              Tap to reveal
            </button>
          )}
        </div>

        {/* Actions row */}
        <div className="mb-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {revealed ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!revealed}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-card disabled:opacity-40"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Copy all"}
          </button>
        </div>

        {/* Divider */}
        <div className="mb-4 border-t border-border/40" />

        {/* Confirmation checkbox */}
        <label className="flex cursor-pointer items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-border transition-colors" style={{ borderColor: checked ? "var(--color-primary)" : undefined, backgroundColor: checked ? "var(--color-primary)" : undefined }}>
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            {checked && <Check className="h-3 w-3 text-primary-foreground" />}
          </div>
          <span className="text-xs text-muted-foreground leading-relaxed">
            I have written down all 12 words in order and stored them in a safe place. I understand that losing these words means losing access to my account.
          </span>
        </label>

        {/* Submit */}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!checked || saving}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {saving ? "Saving…" : "I've written it down — continue"}
        </button>

        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          You can update your recovery phrase later in your{" "}
          <span className="text-primary">Profile</span> settings.
        </p>
      </div>
    </div>
  );
}
