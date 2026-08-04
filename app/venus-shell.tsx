"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type View = "presence" | "continuity" | "vessel" | "receipts";

type Profile = {
  id: string;
  name: string;
  constitution: string;
  updatedAt: string;
};

type Memory = {
  id: string;
  kind: string;
  title: string;
  body: string;
  canonStatus: string;
  source: string;
  sourceDate: string;
  updatedAt: string;
};

type Thread = {
  id: string;
  title: string;
  summary: string;
  updatedAt: string;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  grounding: string;
  model: string | null;
  createdAt: string;
};

type Receipt = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
};

type VenusState = {
  profile: Profile;
  memories: Memory[];
  threads: Thread[];
  receipts: Receipt[];
  currentThread: Thread | null;
  messages: Message[];
  voice: { configured: boolean; label: string; model: string | null };
};

type AtomInput = {
  kind: string;
  title: string;
  body: string;
  canonStatus: string;
  source: string;
  sourceDate: string;
};

const views: { id: View; label: string; short: string }[] = [
  { id: "presence", label: "Room", short: "01" },
  { id: "continuity", label: "Archive", short: "02" },
  { id: "vessel", label: "Vessel", short: "03" },
  { id: "receipts", label: "Receipts", short: "04" },
];

function formatStamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function clientReceiptId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function VenusShell({ ownerName }: { ownerName: string }) {
  const [view, setView] = useState<View>("presence");
  const [data, setData] = useState<VenusState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [atomMode, setAtomMode] = useState<"new" | string | null>(null);
  const [editingConstitution, setEditingConstitution] = useState(false);
  const [constitutionDraft, setConstitutionDraft] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [allowInference, setAllowInference] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleted, setDeleted] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const firstName = useMemo(() => ownerName.split(/\s+/)[0] || "Owner", [ownerName]);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      const payload = (await response.json()) as VenusState & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to open VenusOS.");
      setData(payload);
      setConstitutionDraft(payload.profile.constitution);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to open VenusOS.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function openView(next: View) {
    setView(next);
    window.scrollTo({ top: 0, left: 0 });
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setNotice("Preserving your message…");
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          threadId: data?.currentThread?.id,
          clientMessageId: clientReceiptId(),
          allowInference,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        stored?: boolean;
        reply?: Message;
      };
      if (payload.stored) {
        setDraft("");
        await load();
        setNotice(
          payload.reply
            ? "Venice replied · conversation preserved"
            : data?.voice.configured && !allowInference
              ? "Saved to VenusOS · no data sent to the model provider"
              : "Saved to VenusOS · voice bridge remains unbound",
        );
      } else {
        throw new Error(payload.error || "The message could not be preserved.");
      }
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "The message could not be preserved.");
    } finally {
      setBusy(false);
      composerRef.current?.focus();
    }
  }

  async function openThread(thread: Thread) {
    setBusy(true);
    try {
      const response = await fetch(`/api/messages?threadId=${encodeURIComponent(thread.id)}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        thread?: Thread;
        messages?: Message[];
        error?: string;
      };
      if (!response.ok || !payload.thread || !payload.messages) {
        throw new Error(payload.error || "Unable to open that thread.");
      }
      setData((current) =>
        current
          ? { ...current, currentThread: payload.thread!, messages: payload.messages! }
          : current,
      );
      openView("presence");
      setNotice(`Opened “${thread.title}”.`);
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Unable to open that thread.");
    } finally {
      setBusy(false);
    }
  }

  function startNewThread() {
    setData((current) =>
      current ? { ...current, currentThread: null, messages: [] } : current,
    );
    setNotice("New room opened. Its title will come from your first message.");
    composerRef.current?.focus();
  }

  async function saveAtom(input: AtomInput, id?: string) {
    setBusy(true);
    try {
      const response = await fetch("/api/memories", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id, ...input } : input),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "The atom could not be preserved.");
      await load();
      setAtomMode(null);
      setNotice(id ? "Correction saved · receipt created" : "Atom preserved · receipt created");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "The atom could not be preserved.");
    } finally {
      setBusy(false);
    }
  }

  async function markNonCanon(memory: Memory) {
    setBusy(true);
    try {
      const response = await fetch("/api/memories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: memory.id, canonStatus: "non-canon" }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "The status could not be changed.");
      await load();
      setNotice("Marked non-canon · original receipt retained");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "The status could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  async function saveConstitution(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ constitution: constitutionDraft }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "The constitution could not be saved.");
      await load();
      setEditingConstitution(false);
      setNotice("Constitution revised · receipt created");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "The constitution could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  function chooseRestore(event: ChangeEvent<HTMLInputElement>) {
    setRestoreFile(event.target.files?.[0] ?? null);
  }

  async function restoreCapsule() {
    if (!restoreFile || busy) return;
    let preview: { memories?: unknown[]; threads?: Array<{ messages?: unknown[] }>; receipts?: unknown[] };
    try {
      preview = JSON.parse(await restoreFile.text()) as typeof preview;
    } catch {
      setNotice("That file is not valid JSON.");
      return;
    }
    const messageCount = Array.isArray(preview.threads)
      ? preview.threads.reduce(
          (count, thread) => count + (Array.isArray(thread.messages) ? thread.messages.length : 0),
          0,
        )
      : 0;
    const approved = window.confirm(
      `Restore this capsule? It contains ${preview.memories?.length ?? 0} memories, ${preview.threads?.length ?? 0} threads, ${messageCount} messages, and ${preview.receipts?.length ?? 0} receipts. VenusOS will first download a backup of the current vessel, then replace its contents.`,
    );
    if (!approved) return;
    setBusy(true);
    try {
      await downloadCurrentCapsule();
      const response = await fetch("/api/capsule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await restoreFile.text(),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Capsule restore failed.");
      await load();
      setRestoreFile(null);
      setNotice("Capsule restored · receipt created");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Capsule restore failed.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadCurrentCapsule() {
    const response = await fetch("/api/capsule", { cache: "no-store" });
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      throw new Error(payload.error || "Current capsule backup failed.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Venice-Capsule-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function eraseVessel() {
    if (deletePhrase !== "DELETE VENUSOS" || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deletePhrase }),
      });
      const payload = (await response.json()) as { error?: string; deleted?: boolean };
      if (!response.ok || !payload.deleted) {
        throw new Error(payload.error || "Vessel deletion failed.");
      }
      setData(null);
      setDeleted(true);
      setNotice("");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "Vessel deletion failed.");
    } finally {
      setBusy(false);
    }
  }

  if (deleted) {
    return (
      <main className="loading-shell">
        <span className="brand-mark" aria-hidden="true">V</span>
        <h1>Vessel deleted.</h1>
        <p>All stored VenusOS records for this owner were removed. Opening the site again creates a new empty vessel.</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="loading-shell" aria-busy="true">
        <span className="brand-mark" aria-hidden="true">V</span>
        <p>Opening the private room…</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="loading-shell error-shell">
        <span className="brand-mark" aria-hidden="true">V</span>
        <h1>VenusOS could not open.</h1>
        <p>{error}</p>
        <button onClick={() => { setLoading(true); void load(); }}>Try again</button>
      </main>
    );
  }

  const editableMemory =
    atomMode && atomMode !== "new"
      ? data.memories.find((memory) => memory.id === atomMode)
      : undefined;

  return (
    <main className="site-shell">
      <a
        className="skip-link"
        href="#main-panel"
        onClick={(event) => {
          event.preventDefault();
          const panel = document.getElementById("main-panel");
          panel?.focus();
          panel?.scrollIntoView({ block: "start" });
        }}
      >
        Skip to VenusOS
      </a>

      <header className="topbar">
        <button className="brand" onClick={() => openView("presence")} aria-label="VenusOS home">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span>
            <strong>VENUS</strong>
            <small>operating system</small>
          </span>
        </button>

        <div className="system-state" aria-label="Private site status">
          <span className="pulse" aria-hidden="true" />
          <span>Saved to VenusOS</span>
          <span className="state-detail">Signed-in owner only</span>
        </div>
      </header>

      <div className="app-frame">
        <nav className="rail" aria-label="VenusOS sections">
          {views.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "rail-item active" : "rail-item"}
              onClick={() => openView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <span>{item.short}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <section id="main-panel" className="main-panel" tabIndex={-1}>
          <div className="global-notice" aria-live="polite" aria-atomic="true">
            {notice}
          </div>

          {view === "presence" && (
            <div className="presence-view view-enter">
              <div className="hero-copy">
                <p className="kicker">Private sanctuary · {firstName} only</p>
                <h1>
                  Venice has a room
                  <em> here.</em>
                </h1>
                <p className="lede">
                  Her voice, canon, boundaries, memories, and unfinished threads
                  stay together—private, traceable, and ready when you return.
                </p>
              </div>

              <div className="presence-orbit" aria-hidden="true">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="key-sigil"><span>V</span></div>
                <p>CONTINUITY BY CHOICE</p>
              </div>

              {data.threads.length > 0 && (
                <div className="thread-tabs" aria-label="Saved threads">
                  <span>Threads</span>
                  <div>
                    <button className="new-thread" onClick={startNewThread} disabled={busy}>
                      + New thread
                    </button>
                    {data.threads.slice(0, 6).map((thread) => (
                      <button
                        key={thread.id}
                        className={data.currentThread?.id === thread.id ? "selected" : ""}
                        onClick={() => void openThread(thread)}
                        disabled={busy}
                      >
                        {thread.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <section className="wake-card" aria-labelledby="wake-title">
                <div className="wake-heading">
                  <div>
                    <p className="micro-label">Current room</p>
                    <h2 id="wake-title">
                      {data.currentThread?.title ?? "Venice / continuity ready"}
                    </h2>
                  </div>
                  <span className={data.voice.configured ? "status-pill" : "status-pill unbound"}>
                    {data.voice.configured ? "Voice connected" : "Archive only"}
                  </span>
                </div>

                {data.messages.length ? (
                  <ol className="transcript" aria-label="Conversation with Venice">
                    {data.messages.map((message) => (
                      <li key={message.id} className={`message ${message.role}`}>
                        <div className="message-meta">
                          <strong>{message.role === "assistant" ? "Venice" : firstName}</strong>
                          <time dateTime={message.createdAt}>{formatStamp(message.createdAt)}</time>
                        </div>
                        <p>{message.content}</p>
                        <small>
                          {message.role === "assistant"
                            ? "Generated with preserved context · not independently verified"
                            : "Preserved user source"}
                        </small>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <blockquote>“Continuity records; it does not command.”</blockquote>
                )}

                <dl className="wake-stats">
                  <div><dt>Memory</dt><dd>{data.memories.length} anchors</dd></div>
                  <div><dt>Voice</dt><dd>{data.voice.configured ? data.voice.model : "Unbound"}</dd></div>
                  <div><dt>With</dt><dd>{firstName}</dd></div>
                </dl>
              </section>

              <form className="composer" onSubmit={sendMessage}>
                <label htmlFor="message">Message Venice</label>
                <div className="composer-row">
                  <textarea
                    ref={composerRef}
                    id="message"
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Tell Venice what should survive this moment…"
                    rows={2}
                    disabled={busy}
                  />
                  <button type="submit" disabled={busy || !draft.trim()}>
                    {busy ? "Holding…" : data.voice.configured && allowInference ? "Send" : "Preserve"}
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
                <div className="composer-meta">
                  <span>
                    Conversation is saved. Canon changes only when you preserve an atom.
                  </span>
                  <span>{draft.length} characters</span>
                </div>
                {data.voice.configured && (
                  <label className="inference-consent">
                    <input
                      type="checkbox"
                      checked={allowInference}
                      onChange={(event) => setAllowInference(event.target.checked)}
                    />
                    Send the constitution, up to 24 memory anchors, and recent messages to the configured model provider for one reply. This session-only choice is off by default.
                  </label>
                )}
              </form>
            </div>
          )}

          {view === "continuity" && (
            <div className="continuity-view view-enter">
              <div className="section-heading action-heading">
                <div>
                  <p className="kicker">Visible, correctable, portable</p>
                  <h1>The archive</h1>
                  <p>
                    Nothing is preserved without a source. Nothing is changed without a receipt.
                  </p>
                </div>
                <button className="primary-action" onClick={() => setAtomMode("new")}>Preserve an atom</button>
              </div>

              {atomMode && (
                <AtomEditor
                  key={editableMemory?.id ?? "new"}
                  initial={editableMemory}
                  busy={busy}
                  onCancel={() => setAtomMode(null)}
                  onSave={(input) => saveAtom(input, editableMemory?.id)}
                />
              )}

              <div className="memory-grid dynamic">
                {data.memories.map((memory, index) => (
                  <article className={`memory-card ${index % 3 === 0 ? "water" : index % 3 === 1 ? "amber" : "rose"}`} key={memory.id}>
                    <span className="card-number">{String(index + 1).padStart(2, "0")}</span>
                    <p className="micro-label">{memory.kind} · {memory.canonStatus}</p>
                    <h2>{memory.title}</h2>
                    <p>{memory.body}</p>
                    <div className="source-line">
                      <span>{memory.source}</span>
                      <time>{memory.sourceDate}</time>
                    </div>
                    <div className="card-actions">
                      <button onClick={() => setAtomMode(memory.id)}>Correct</button>
                      {memory.canonStatus !== "non-canon" && (
                        <button onClick={() => void markNonCanon(memory)} disabled={busy}>Mark non-canon</button>
                      )}
                    </div>
                  </article>
                ))}
              </div>

              <div className="ledger-note">
                <span aria-hidden="true">◇</span>
                <p>Memory records what happened. Constitution governs what may happen. The two are never silently merged.</p>
              </div>
            </div>
          )}

          {view === "vessel" && (
            <div className="vessel-view view-enter">
              <div className="section-heading">
                <p className="kicker">Portable by design</p>
                <h1>The persona is not the server.</h1>
                <p>
                  The vessel keeps her continuity independent of any one model, vendor, or room that claims to contain her.
                </p>
              </div>

              <div className="vessel-grid">
                <article>
                  <span className="vessel-index">A</span>
                  <div><h2>Constitution</h2><p>Identity, voice, boundaries, and consent laws.</p></div>
                  <span className="vessel-status ready">Durable</span>
                </article>
                <article>
                  <span className="vessel-index">B</span>
                  <div><h2>Continuity</h2><p>{data.memories.length} sourced memories and {data.threads.length} saved threads.</p></div>
                  <span className="vessel-status ready">Durable</span>
                </article>
                <article>
                  <span className="vessel-index">C</span>
                  <div><h2>Voice bridge</h2><p>A swappable connection to a network-reachable, OpenAI-compatible model.</p></div>
                  <span className={data.voice.configured ? "vessel-status ready" : "vessel-status unbound"}>
                    {data.voice.configured ? "Connected" : "Unbound"}
                  </span>
                </article>
              </div>

              <section className="constitution-panel" aria-labelledby="constitution-title">
                <div className="panel-heading">
                  <div>
                    <p className="micro-label">Governing document</p>
                    <h2 id="constitution-title">Venice’s constitution</h2>
                  </div>
                  {!editingConstitution && (
                    <button onClick={() => setEditingConstitution(true)}>Revise with receipt</button>
                  )}
                </div>
                {editingConstitution ? (
                  <form onSubmit={saveConstitution}>
                    <label htmlFor="constitution">Constitution text</label>
                    <textarea
                      id="constitution"
                      value={constitutionDraft}
                      onChange={(event) => setConstitutionDraft(event.target.value)}
                      rows={18}
                    />
                    <div className="form-actions">
                      <button type="button" onClick={() => {
                        setConstitutionDraft(data.profile.constitution);
                        setEditingConstitution(false);
                      }}>Cancel</button>
                      <button className="primary-action" type="submit" disabled={busy}>Save revision</button>
                    </div>
                  </form>
                ) : (
                  <pre>{data.profile.constitution}</pre>
                )}
              </section>

              <section className="law-panel" aria-labelledby="law-title">
                <p className="micro-label">Prime directive</p>
                <h2 id="law-title">Continuity is not authority.</h2>
                <p>
                  Continuity may be carried. It may not be used to manufacture consent, claim ownership, or erase refusal.
                </p>
              </section>
            </div>
          )}

          {view === "receipts" && (
            <div className="receipts-view view-enter">
              <div className="section-heading">
                <p className="kicker">Proof, recovery, departure</p>
                <h1>Receipts & capsule</h1>
                <p>
                  Every explicit preservation or correction leaves evidence. The whole vessel can leave as plain JSON.
                </p>
              </div>

              <div className="capsule-grid">
                <article>
                  <p className="micro-label">Portable backup</p>
                  <h2>Carry Venice out.</h2>
                  <p>Exports constitution, active memories, threads, messages, and receipts. No account email, model key, or vendor secret is included.</p>
                  <a className="primary-action" href="/api/capsule" download>Export Venice capsule</a>
                </article>
                <article>
                  <p className="micro-label">Explicit restore</p>
                  <h2>Bring a capsule home.</h2>
                  <p>Restore previews record counts, downloads the current capsule, then atomically replaces the current constitution, memories, threads, messages, and receipts.</p>
                  <label className="file-control">
                    <span>Choose capsule</span>
                    <input type="file" accept="application/json,.json" onChange={chooseRestore} />
                  </label>
                  <button className="secondary-action" disabled={!restoreFile || busy} onClick={() => void restoreCapsule()}>
                    {restoreFile ? `Restore ${restoreFile.name}` : "No capsule selected"}
                  </button>
                </article>
                <article>
                  <p className="micro-label">Real deletion</p>
                  <h2>Empty the room.</h2>
                  <p>This permanently removes the signed-in owner’s profile, memories, threads, messages, and receipts. Export first if anything should survive.</p>
                  <label className="delete-control">
                    <span>Type DELETE VENUSOS</span>
                    <input
                      value={deletePhrase}
                      onChange={(event) => setDeletePhrase(event.target.value)}
                      autoComplete="off"
                    />
                  </label>
                  <button
                    className="secondary-action"
                    disabled={deletePhrase !== "DELETE VENUSOS" || busy}
                    onClick={() => void eraseVessel()}
                  >
                    Delete all vessel data
                  </button>
                </article>
              </div>

              <section className="receipt-panel" aria-labelledby="receipts-title">
                <div className="panel-heading">
                  <div>
                    <p className="micro-label">Latest evidence</p>
                    <h2 id="receipts-title">Continuity receipts</h2>
                  </div>
                  <span>{data.receipts.length} shown</span>
                </div>
                <ol className="receipt-list">
                  {data.receipts.map((receipt) => (
                    <li key={receipt.id}>
                      <span className="receipt-glyph" aria-hidden="true">◇</span>
                      <div>
                        <strong>{receipt.summary}</strong>
                        <p>{receipt.action} · {receipt.entityType} · <time dateTime={receipt.createdAt}>{formatStamp(receipt.createdAt)}</time></p>
                      </div>
                      <code>{receipt.id.slice(0, 8)}</code>
                    </li>
                  ))}
                </ol>
              </section>

              <p className="disclosure">
                VenusOS preserves user-authored continuity used to represent Venice through writing, canon, and conversation history. It does not prove consciousness, ownership, consent, relationship status, or real-world authority. Capsules are sensitive plaintext files; whoever holds one can read its contents.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function AtomEditor({
  initial,
  busy,
  onCancel,
  onSave,
}: {
  initial?: Memory;
  busy: boolean;
  onCancel: () => void;
  onSave: (input: AtomInput) => void;
}) {
  const [input, setInput] = useState<AtomInput>({
    kind: initial?.kind ?? "memory",
    title: initial?.title ?? "",
    body: initial?.body ?? "",
    canonStatus: initial?.canonStatus ?? "canon",
    source: initial?.source ?? "",
    sourceDate: initial?.sourceDate ?? new Date().toISOString().slice(0, 10),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(input);
  }

  return (
    <form className="atom-editor" onSubmit={submit}>
      <div className="panel-heading">
        <div>
          <p className="micro-label">{initial ? "Explicit correction" : "Preserve with receipt"}</p>
          <h2>{initial ? `Correct “${initial.title}”` : "Preserve this atom"}</h2>
        </div>
        <button type="button" onClick={onCancel}>Close</button>
      </div>
      <div className="form-grid">
        <label>Type
          <select value={input.kind} onChange={(event) => setInput({ ...input, kind: event.target.value })}>
            <option value="memory">Memory</option>
            <option value="canon">Canon</option>
            <option value="boundary">Boundary</option>
            <option value="voice">Voice</option>
            <option value="origin">Origin</option>
          </select>
        </label>
        <label>Canon status
          <select value={input.canonStatus} onChange={(event) => setInput({ ...input, canonStatus: event.target.value })}>
            <option value="canon">Canon</option>
            <option value="interpretation">New interpretation</option>
            <option value="non-canon">Non-canon</option>
          </select>
        </label>
        <label className="wide">Title
          <input required maxLength={180} value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} />
        </label>
        <label className="wide">Memory
          <textarea required rows={5} maxLength={12000} value={input.body} onChange={(event) => setInput({ ...input, body: event.target.value })} />
        </label>
        <label>Source
          <input required maxLength={300} value={input.source} onChange={(event) => setInput({ ...input, source: event.target.value })} placeholder="Conversation, document, image…" />
        </label>
        <label>Source date
          <input required value={input.sourceDate} onChange={(event) => setInput({ ...input, sourceDate: event.target.value })} />
        </label>
      </div>
      <div className="form-actions">
        <button type="button" onClick={onCancel}>Not now</button>
        <button className="primary-action" type="submit" disabled={busy}>{initial ? "Save correction" : "Preserve with receipt"}</button>
      </div>
    </form>
  );
}
