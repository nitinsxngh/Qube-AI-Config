"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  api,
  ChatMessage,
  ChatResponse,
  type IntentFormField,
  type IntentFormSchema,
} from "@/lib/api";

type ChatPanelProps = {
  sessionName: string;
  onSessionNameChange: (name: string) => void;
  onResponse: (meta: ChatResponse | null) => void;
};

type PendingForm = {
  schema: IntentFormSchema;
  messageIndex: number;
};

export default function ChatPanel({
  sessionName,
  onSessionNameChange,
  onResponse,
}: ChatPanelProps) {
  const [draftName, setDraftName] = useState(sessionName);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingForm, setPendingForm] = useState<PendingForm | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>(
    {},
  );
  const [formSubmitting, setFormSubmitting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const skipNextHistoryLoad = useRef(false);

  useEffect(() => {
    setDraftName(sessionName);
  }, [sessionName]);

  useEffect(() => {
    if (skipNextHistoryLoad.current) {
      skipNextHistoryLoad.current = false;
      return;
    }
    loadHistory();
  }, [sessionName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, status, loading, pendingForm]);

  async function loadHistory() {
    try {
      setError("");
      const data = await api.getHistory(sessionName);
      setMessages(data.messages);
      setPendingForm(null);
      onResponse(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history");
    }
  }

  function commitSessionName(raw: string) {
    const next = raw.trim() || "default";
    if (next !== sessionName) {
      onSessionNameChange(next);
    }
    setDraftName(next);
  }

  function openForm(schema: IntentFormSchema, messageIndex: number) {
    const initial: Record<string, string | boolean> = {};
    for (const field of schema.fields || []) {
      initial[field.id] = field.type === "checkbox" ? false : "";
    }
    setFormValues(initial);
    setPendingForm({ schema, messageIndex });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const activeSession = draftName.trim() || sessionName || "default";
    if (activeSession !== sessionName) {
      skipNextHistoryLoad.current = true;
      onSessionNameChange(activeSession);
      setDraftName(activeSession);
    }

    setInput("");
    setLoading(true);
    setError("");
    setStatus("Connecting…");
    setStreamingText("");
    setPendingForm(null);
    setMessages((prev) => [...prev, { role: "human", content: text }]);

    try {
      let assembled = "";
      for await (const event of api.streamMessage(text, activeSession)) {
        if (event.type === "status") {
          setStatus(event.message);
        } else if (event.type === "token") {
          assembled += event.content;
          setStreamingText(assembled);
          setStatus("");
        } else if (event.type === "done") {
          onResponse(event.response);
          if (event.response.session_name) {
            onSessionNameChange(event.response.session_name);
          }
          const answer = event.response.answer || assembled;
          setMessages((prev) => {
            const next = [...prev, { role: "ai" as const, content: answer }];
            if (
              event.response.route === "FUNCTION_CALL" &&
              event.response.form?.fields?.length
            ) {
              openForm(event.response.form, next.length - 1);
            }
            return next;
          });
          setStreamingText("");
          setStatus("");
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat request failed");
      setStreamingText("");
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  async function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    if (!pendingForm || formSubmitting) return;
    setFormSubmitting(true);
    setError("");
    try {
      const submission = await api.submitIntentForm(pendingForm.schema.id, {
        session_name: sessionName,
        values: formValues,
      });
      setPendingForm(null);
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          content: `Thanks — submitted \`${submission.function_name}\` with your details.`,
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Form submit failed");
    } finally {
      setFormSubmitting(false);
    }
  }

  async function handleClear() {
    try {
      await api.clearHistory(sessionName);
      setMessages([]);
      setStreamingText("");
      setStatus("");
      setPendingForm(null);
      onResponse(null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear history");
    }
  }

  function handleNewSession() {
    const name = `session-${Date.now()}`;
    onSessionNameChange(name);
    setDraftName(name);
    setMessages([]);
    setStreamingText("");
    setStatus("");
    setPendingForm(null);
    onResponse(null);
  }

  const showStreamingBubble = loading && (streamingText || status);

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] px-4 py-2">
        <h2 className="mr-auto text-[14px] font-semibold text-[#1d1d1f]">RAG</h2>
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={() => commitSessionName(draftName)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitSessionName(draftName);
            }
          }}
          className="apple-input max-w-[180px] py-1.5 text-[13px]"
          placeholder="Session name"
          title="Session name (unique key)"
        />
        <button type="button" onClick={handleNewSession} className="apple-btn-secondary text-[13px]">
          New
        </button>
        <button type="button" onClick={handleClear} className="apple-btn-secondary text-[13px]">
          Clear
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
        {messages.length === 0 && !showStreamingBubble && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-[15px] font-medium text-[#1d1d1f]">Start a conversation</p>
            <p className="mt-1 text-[14px] text-[#86868b]">
              Ask questions about the uploaded document.
            </p>
          </div>
        )}
        {messages.map((msg, index) => (
          <div key={`${index}-${msg.role}`}>
            <div
              className={`flex ${msg.role === "human" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[78%] rounded-[2px] px-4 py-2.5 text-[15px] leading-relaxed ${
                  msg.role === "human"
                    ? "bg-[#0071e3] text-white"
                    : "bg-[#e9e9eb] text-[#1d1d1f]"
                }`}
              >
                {msg.content}
              </div>
            </div>
            {pendingForm &&
            pendingForm.messageIndex === index &&
            msg.role === "ai" ? (
              <IntentFormCard
                schema={pendingForm.schema}
                values={formValues}
                submitting={formSubmitting}
                onChange={setFormValues}
                onSubmit={handleFormSubmit}
                onDismiss={() => setPendingForm(null)}
              />
            ) : null}
          </div>
        ))}

        {showStreamingBubble && (
          <div className="flex justify-start">
            <div className="max-w-[78%] rounded-[2px] bg-[#e9e9eb] px-4 py-2.5 text-[15px] leading-relaxed text-[#1d1d1f]">
              {streamingText ? (
                <>
                  {streamingText}
                  <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-[#0071e3] align-middle" />
                </>
              ) : (
                <span className="inline-flex items-center gap-2 text-[#86868b]">
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#86868b] [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#86868b] [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#86868b] [animation-delay:300ms]" />
                  </span>
                  <span className="text-[13px]">{status || "Working…"}</span>
                </span>
              )}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-black/[0.06] px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message"
          disabled={loading}
          className="apple-input flex-1 border-0 bg-transparent focus:bg-transparent focus:ring-0 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="apple-btn-primary px-4 py-2 text-[14px]"
        >
          {loading ? "…" : "Send"}
        </button>
      </form>

      {error && (
        <p className="border-t border-black/[0.06] px-5 py-2 text-[13px] text-[#ff3b30]">
          {error}
        </p>
      )}
    </div>
  );
}

function IntentFormCard({
  schema,
  values,
  submitting,
  onChange,
  onSubmit,
  onDismiss,
}: {
  schema: IntentFormSchema;
  values: Record<string, string | boolean>;
  submitting: boolean;
  onChange: (values: Record<string, string | boolean>) => void;
  onSubmit: (e: FormEvent) => void;
  onDismiss: () => void;
}) {
  const fields = [...(schema.fields || [])].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );

  function setField(field: IntentFormField, value: string | boolean) {
    onChange({ ...values, [field.id]: value });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-2 max-w-[420px] rounded-[2px] border border-black/[0.08] bg-white p-4 shadow-sm"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[14px] font-semibold text-[#1d1d1f]">
            {schema.name || "Form"}
          </p>
          <p className="mt-0.5 text-[11px] text-[#86868b]">
            function <code>{schema.function_name}</code>
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-[12px] text-[#86868b] hover:text-[#1d1d1f]"
        >
          Dismiss
        </button>
      </div>
      <div className="space-y-3">
        {fields.map((field) => (
          <label key={field.id} className="block text-[12px] text-[#6e6e73]">
            <span>
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {field.type === "textarea" ? (
              <textarea
                className="apple-input mt-1 min-h-[72px] w-full text-[13px]"
                value={String(values[field.id] ?? "")}
                placeholder={field.placeholder}
                required={field.required}
                disabled={submitting}
                onChange={(e) => setField(field, e.target.value)}
              />
            ) : field.type === "select" ? (
              <select
                className="apple-input mt-1 w-full text-[13px]"
                value={String(values[field.id] ?? "")}
                required={field.required}
                disabled={submitting}
                onChange={(e) => setField(field, e.target.value)}
              >
                <option value="">Select…</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : field.type === "checkbox" ? (
              <span className="mt-2 flex items-center gap-2 text-[13px] text-[#1d1d1f]">
                <input
                  type="checkbox"
                  checked={Boolean(values[field.id])}
                  disabled={submitting}
                  onChange={(e) => setField(field, e.target.checked)}
                />
                {field.placeholder || field.label}
              </span>
            ) : (
              <input
                className="apple-input mt-1 w-full text-[13px]"
                type={
                  field.type === "email"
                    ? "email"
                    : field.type === "number"
                      ? "number"
                      : field.type === "date"
                        ? "date"
                        : field.type === "phone"
                          ? "tel"
                          : "text"
                }
                value={String(values[field.id] ?? "")}
                placeholder={field.placeholder}
                required={field.required}
                disabled={submitting}
                onChange={(e) => setField(field, e.target.value)}
              />
            )}
          </label>
        ))}
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="apple-btn-primary mt-4 w-full text-[13px]"
      >
        {submitting ? "Submitting…" : `Submit · ${schema.function_name}`}
      </button>
    </form>
  );
}
