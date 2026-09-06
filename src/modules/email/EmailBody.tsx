"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Code2, FileText } from "lucide-react";
import { Button } from "@/components/ui/Button";

const FRAME_STYLE =
  "body{margin:0;padding:12px 14px;font:14px/1.5 -apple-system,system-ui,'Segoe UI',Roboto,sans-serif;color:#0f172a;overflow-wrap:anywhere;word-break:break-word}" +
  "img{max-width:100%;height:auto}table{max-width:100%}a{color:#1d4ed8}pre{white-space:pre-wrap}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #e2e8f0;color:#475569}";

function buildSrcDoc(html: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank" rel="noopener"><style>${FRAME_STYLE}</style></head><body>${html}</body></html>`;
}

/**
 * Corpo dell'email: HTML (già sanificato) dentro un iframe isolato che si adatta in altezza,
 * oppure testo semplice. Il toggle permette di passare da una vista all'altra.
 */
export function EmailBody({ bodyHtml, bodyText }: { bodyHtml: string | null; bodyText: string | null }) {
  const [plain, setPlain] = useState(!bodyHtml);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(240);

  const measure = useCallback(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;
    const h = Math.max(doc.documentElement?.scrollHeight ?? 0, doc.body?.scrollHeight ?? 0);
    if (h > 0) setHeight(Math.min(h + 24, 20000));
  }, []);

  useEffect(() => {
    if (plain) return;
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc?.body) return;
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => measure());
      observer.observe(doc.body);
    }
    const t = window.setTimeout(measure, 300);
    return () => {
      observer?.disconnect();
      window.clearTimeout(t);
    };
  }, [plain, measure]);

  const canToggle = !!bodyHtml && !!bodyText;

  return (
    <div>
      {canToggle && (
        <div className="mb-2 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setPlain((v) => !v)}>
            {plain ? <Code2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            {plain ? "Mostra formattato" : "Testo semplice"}
          </Button>
        </div>
      )}
      {plain || !bodyHtml ? (
        <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 font-sans text-sm text-slate-800">
          {bodyText || "(messaggio vuoto)"}
        </pre>
      ) : (
        <iframe
          ref={frameRef}
          title="Contenuto email"
          // Nessuno script può girare nel frame (manca allow-scripts): allow-same-origin serve solo
          // per misurarne l'altezza; allow-popups permette di aprire i link in una nuova scheda.
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          srcDoc={buildSrcDoc(bodyHtml)}
          onLoad={measure}
          style={{ height }}
          className="block w-full rounded-lg border border-slate-200 bg-white"
        />
      )}
    </div>
  );
}
