"use client";
import { useEffect, useMemo, useRef, useState, useTransition, type KeyboardEvent } from "react";
import useSWR from "swr";
import { format, isToday, isYesterday } from "date-fns";
import { it } from "date-fns/locale";
import { AtSign, History, Send, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { deleteChatMessageAction } from "./actions";
import type { ChatMessageDto, StaffUserDto } from "./service";
import { buildMessageRegex, renderMessageText } from "./text";

const MAX_LEN = 4000;

interface Props {
  clientId: string;
  currentUser: { id: string; nome: string; ruolo: string };
  staff: StaffUserDto[];
  initialMessages: ChatMessageDto[];
  /** true se esistono messaggi più vecchi di quelli iniziali (mostra "Carica messaggi precedenti") */
  initialHasMore?: boolean;
  /** classe Tailwind per l'altezza del pannello (es. "h-[70vh]") */
  heightClass?: string;
}

interface MessagesResponse {
  messages: ChatMessageDto[];
  /** presente con ?before= */
  hasMore?: boolean;
  /** presente con ?from=: numero di messaggi sul server con data >= from */
  count?: number;
}

function dayLabel(d: Date) {
  if (isToday(d)) return "Oggi";
  if (isYesterday(d)) return "Ieri";
  return format(d, "EEEE d MMMM yyyy", { locale: it });
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

async function fetchMessages(url: string): Promise<MessagesResponse> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Errore ${res.status}`);
  return res.json();
}

function mentionQuery(value: string, caret: number) {
  const before = value.slice(0, caret);
  const m = /(?:^|\s)@([^\n@]{0,40})$/.exec(before);
  if (!m) return null;
  return { query: m[1], start: caret - m[1].length - 1 };
}

export function ChatConversation({ clientId, currentUser, staff, initialMessages, initialHasMore = false, heightClass = "h-[70vh]" }: Props) {
  const [messages, setMessages] = useState<ChatMessageDto[]>(initialMessages);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [dismissedText, setDismissedText] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottomRef = useRef(true);
  const messagesRef = useRef(messages);
  const reconcilingRef = useRef(false);
  /** altezza/posizione dello scroll prima di un prepend, per mantenere la vista ferma */
  const prependScrollRef = useRef<{ height: number; top: number } | null>(null);

  const regex = useMemo(() => buildMessageRegex(staff.map((s) => s.nome)), [staff]);
  const firstIso = messages.length ? messages[0].createdAt : "";
  const lastIso = messages.length ? messages[messages.length - 1].createdAt : "";
  const pollParams = new URLSearchParams();
  if (lastIso) pollParams.set("after", lastIso);
  if (firstIso) pollParams.set("from", firstIso);
  const pollUrl = `/api/chat/${clientId}/messages${pollParams.size ? `?${pollParams}` : ""}`;

  /**
   * Unico punto di aggiornamento dell'elenco: tiene `messagesRef` allineato in modo sincrono, così le
   * risposte del polling (asincrone) non sovrascrivono un messaggio appena inviato o eliminato.
   */
  function updateMessages(fn: (prev: ChatMessageDto[]) => ChatMessageDto[]) {
    const next = fn(messagesRef.current);
    if (next === messagesRef.current) return next;
    messagesRef.current = next;
    setMessages(next);
    return next;
  }

  function mergeIncoming(prev: ChatMessageDto[], incoming: ChatMessageDto[]) {
    const ids = new Set(prev.map((m) => m.id));
    const add = incoming.filter((m) => !ids.has(m.id));
    return add.length ? [...prev, ...add] : prev;
  }

  /** Ricarica l'intera finestra visualizzata: serve quando un collega ha eliminato un messaggio. */
  async function reconcile(from: string) {
    if (reconcilingRef.current) return;
    reconcilingRef.current = true;
    try {
      const data = await fetchMessages(`/api/chat/${clientId}/messages?from=${encodeURIComponent(from)}`);
      if (Array.isArray(data.messages)) updateMessages(() => data.messages);
    } catch {
      // ignorato: il prossimo polling riproverà
    } finally {
      reconcilingRef.current = false;
    }
  }

  useSWR(pollUrl, fetchMessages, {
    refreshInterval: 5000,
    revalidateOnFocus: true,
    dedupingInterval: 1500,
    onSuccess: (data) => {
      if (!Array.isArray(data?.messages)) return;
      const merged = updateMessages((prev) => mergeIncoming(prev, data.messages));
      // Sul server ci sono meno messaggi di quelli visualizzati: qualcuno è stato eliminato da un altro utente.
      if (firstIso && typeof data.count === "number" && data.count < merged.length) void reconcile(firstIso);
    },
  });

  async function loadOlder() {
    if (!firstIso || loadingOlder) return;
    setLoadingOlder(true);
    setError(null);
    try {
      const data = await fetchMessages(`/api/chat/${clientId}/messages?before=${encodeURIComponent(firstIso)}`);
      const el = listRef.current;
      prependScrollRef.current = el ? { height: el.scrollHeight, top: el.scrollTop } : null;
      stickToBottomRef.current = false;
      updateMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const older = data.messages.filter((m) => !ids.has(m.id));
        return older.length ? [...older, ...prev] : prev;
      });
      setHasMore(!!data.hasMore);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingOlder(false);
    }
  }

  // Scorri in fondo all'apertura e quando arrivano nuovi messaggi (se l'utente era già in fondo);
  // dopo aver caricato lo storico mantieni ferma la vista sul primo messaggio che era visibile.
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const prepend = prependScrollRef.current;
    if (prepend) {
      prependScrollRef.current = null;
      el.scrollTop = el.scrollHeight - prepend.height + prepend.top;
      return;
    }
    if (stickToBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  function onScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  const mention = mentionQuery(text, caret);
  const mentionQ = mention?.query.toLowerCase() ?? null;
  const suggestions = mentionQ === null ? [] : staff.filter((s) => s.nome.toLowerCase().includes(mentionQ)).slice(0, 6);
  const showSuggestions = !!mention && suggestions.length > 0 && dismissedText !== text;

  function insertMention(user: StaffUserDto) {
    if (!mention) return;
    const before = text.slice(0, mention.start);
    const after = text.slice(caret);
    const inserted = `@${user.nome} `;
    const next = `${before}${inserted}${after}`;
    const newCaret = before.length + inserted.length;
    setText(next);
    setCaret(newCaret);
    setActiveSuggestion(0);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(newCaret, newCaret);
      autoGrow(ta);
    });
  }

  function autoGrow(ta: HTMLTextAreaElement) {
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }

  async function send() {
    const testo = text.trim();
    if (!testo || sending) return;
    if (testo.length > MAX_LEN) {
      setError(`Il messaggio supera i ${MAX_LEN} caratteri.`);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/chat/${clientId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testo }),
      });
      const data = (await res.json()) as { message?: ChatMessageDto; error?: string };
      if (!res.ok || !data.message) throw new Error(data.error ?? "Invio non riuscito.");
      const msg = data.message;
      stickToBottomRef.current = true;
      updateMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      setText("");
      setCaret(0);
      const ta = textareaRef.current;
      if (ta) {
        ta.style.height = "auto";
        ta.focus();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (showSuggestions) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((i) => (i + 1) % suggestions.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((i) => (i - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[activeSuggestion] ?? suggestions[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDismissedText(text);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
      if (desktop) {
        e.preventDefault();
        void send();
      }
    }
  }

  function remove(id: string) {
    if (!window.confirm("Eliminare questo messaggio?")) return;
    startDelete(async () => {
      const r = await deleteChatMessageAction(id);
      if (r.ok) updateMessages((prev) => prev.filter((m) => m.id !== id));
      else setError(r.error ?? "Eliminazione non riuscita.");
    });
  }

  // Raggruppa per giorno
  const groups: { key: string; label: string; items: ChatMessageDto[] }[] = [];
  for (const m of messages) {
    const d = new Date(m.createdAt);
    const key = dayKey(d);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(m);
    else groups.push({ key, label: dayLabel(d), items: [m] });
  }

  return (
    <div className={cn("flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50", heightClass)}>
      <div ref={listRef} onScroll={onScroll} className="flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-sm text-slate-500">
            <p className="font-medium text-slate-700">Nessun messaggio</p>
            <p className="mt-1 max-w-xs">Inizia la conversazione interna su questo cliente. Usa @ per menzionare un collega.</p>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="mb-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => void loadOlder()}
                  disabled={loadingOlder}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-100 disabled:opacity-60"
                >
                  {loadingOlder ? <Spinner className="h-3.5 w-3.5" /> : <History className="h-3.5 w-3.5" />}
                  {loadingOlder ? "Caricamento…" : "Carica messaggi precedenti"}
                </button>
              </div>
            )}
            {groups.map((g) => (
              <div key={g.key} className="mb-3">
                <div className="my-2 flex items-center gap-3">
                  <span className="h-px flex-1 bg-slate-200" />
                  <span className="text-xs font-medium capitalize text-slate-500" suppressHydrationWarning>
                    {g.label}
                  </span>
                  <span className="h-px flex-1 bg-slate-200" />
                </div>
                <ul className="space-y-2">
                  {g.items.map((m) => {
                    const own = m.author.id === currentUser.id;
                    const canDelete = own || currentUser.ruolo === "ADMIN";
                    return (
                      <li key={m.id} className={cn("group flex items-end gap-2", own ? "flex-row-reverse" : "flex-row")}>
                        <Avatar nome={m.author.nome} colore={m.author.colore} size="sm" className="mb-0.5 hidden sm:inline-flex" />
                        <div className={cn("flex max-w-[85%] flex-col sm:max-w-[75%]", own ? "items-end" : "items-start")}>
                          <div className={cn("mb-0.5 flex items-baseline gap-2 px-1 text-[11px] text-slate-500", own && "flex-row-reverse")}>
                            <span className="font-medium text-slate-700">{own ? "Tu" : m.author.nome}</span>
                            <time dateTime={m.createdAt} suppressHydrationWarning>
                              {format(new Date(m.createdAt), "HH:mm")}
                            </time>
                          </div>
                          <div className={cn("flex items-center gap-1", own ? "flex-row-reverse" : "flex-row")}>
                            <div
                              className={cn(
                                "whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm shadow-sm",
                                own ? "rounded-br-sm bg-blue-600 text-white" : "rounded-bl-sm border border-slate-200 bg-white text-slate-800",
                              )}
                            >
                              {renderMessageText(m.testo, regex, { own })}
                            </div>
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => remove(m.id)}
                                disabled={deleting}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-red-600 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
                                title="Elimina messaggio"
                                aria-label="Elimina messaggio"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="relative border-t border-slate-200 bg-white p-2 sm:p-3">
        {showSuggestions && (
          <ul
            className="absolute bottom-full left-2 right-2 z-10 mb-1 max-h-56 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg sm:left-3 sm:w-72 sm:right-auto"
            role="listbox"
            aria-label="Menziona un collega"
          >
            {suggestions.map((s, i) => (
              <li key={s.id} role="option" aria-selected={i === activeSuggestion}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMention(s)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    i === activeSuggestion ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <Avatar nome={s.nome} colore={s.colore} size="xs" />
                  <span className="truncate">{s.nome}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
        <div className="flex items-end gap-2">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            title="Menziona un collega"
            aria-label="Menziona un collega"
            onClick={() => {
              const ta = textareaRef.current;
              const pos = ta ? ta.selectionStart : text.length;
              const before = text.slice(0, pos);
              const needsSpace = before.length > 0 && !/\s$/.test(before);
              const inserted = `${needsSpace ? " " : ""}@`;
              const next = `${before}${inserted}${text.slice(pos)}`;
              const newCaret = before.length + inserted.length;
              setText(next);
              setCaret(newCaret);
              requestAnimationFrame(() => {
                ta?.focus();
                ta?.setSelectionRange(newCaret, newCaret);
              });
            }}
          >
            <AtSign className="h-5 w-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            rows={1}
            maxLength={MAX_LEN}
            placeholder="Scrivi un messaggio…"
            aria-label="Messaggio"
            className="block max-h-40 min-h-10 flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            onChange={(e) => {
              setText(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
              setActiveSuggestion(0);
              autoGrow(e.target);
            }}
            onSelect={(e) => setCaret((e.target as HTMLTextAreaElement).selectionStart ?? 0)}
            onKeyDown={onKeyDown}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !text.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            title="Invia"
            aria-label="Invia messaggio"
          >
            {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-1 hidden text-[11px] text-slate-400 lg:block">Invio per inviare · Maiusc+Invio per andare a capo</p>
      </div>
    </div>
  );
}
