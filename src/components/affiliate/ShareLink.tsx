import { useMemo, useState } from "react";
import { Copy, Check, MessageCircle, Send as SendIcon, Twitter, Facebook } from "lucide-react";

export function ShareLink({ code }: { code: string }) {
  const link = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/auth?ref=${code}`;
  }, [code]);

  const defaultMsg = `🌱 I'm growing Seeds on VFarmers and earning real rewards every cycle. Plant your first Seed with my link and let's farm together: ${link}`;
  const [msg, setMsg] = useState(defaultMsg);
  const [copied, setCopied] = useState<"link" | "msg" | null>(null);

  const copy = async (what: "link" | "msg", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(what);
    setTimeout(() => setCopied(null), 1500);
  };

  const enc = encodeURIComponent(msg);
  const shares = [
    { label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${enc}` },
    { label: "Telegram", icon: SendIcon, href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${enc}` },
    { label: "X", icon: Twitter, href: `https://twitter.com/intent/tweet?text=${enc}` },
    {
      label: "Facebook",
      icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${enc}`,
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-5">
      <h3 className="text-sm font-semibold">Your affiliate link</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Share this link anywhere. New farmers signing up through it become your downline.
      </p>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
        <code className="flex-1 truncate text-xs">{link}</code>
        <button
          onClick={() => copy("link", link)}
          className="flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-xs text-primary hover:bg-primary/25"
        >
          {copied === "link" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied === "link" ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="mt-4">
        <label className="text-xs text-muted-foreground">Sales message (edit to fit your audience)</label>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-xs outline-none focus:border-primary/60"
        />
        <button
          onClick={() => copy("msg", msg)}
          className="mt-2 flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-xs text-primary hover:bg-primary/25"
        >
          {copied === "msg" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied === "msg" ? "Copied" : "Copy message"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {shares.map((s) => (
          <a
            key={s.label}
            href={s.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs hover:bg-card"
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.label}
          </a>
        ))}
      </div>
    </div>
  );
}
