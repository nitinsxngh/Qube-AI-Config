"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import {
  api,
  type CatalogFunction,
  type IntentForm,
  type IntentFormField,
  type IntentFormFieldType,
  type IntentFormSubmission,
} from "@/lib/api";

const FIELD_TYPES: IntentFormFieldType[] = [
  "text",
  "email",
  "phone",
  "number",
  "textarea",
  "select",
  "checkbox",
  "date",
];

type FormState = {
  name: string;
  description: string;
  function_name: string;
  intent_label: string;
  intent_prompt: string;
  intro_message: string;
  enabled: boolean;
  fields: IntentFormField[];
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  function_name: "",
  intent_label: "",
  intent_prompt: "",
  intro_message: "Please fill out the form below to continue.",
  enabled: true,
  fields: [],
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

function newField(order: number): IntentFormField {
  return {
    id: `field_${order + 1}`,
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    options: [],
    order,
  };
}

function parseError(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong";
  try {
    const parsed = JSON.parse(err.message) as { detail?: string };
    return parsed.detail || err.message;
  } catch {
    return err.message;
  }
}

export default function IntentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [rows, setRows] = useState<IntentForm[]>([]);
  const [catalogFunctions, setCatalogFunctions] = useState<CatalogFunction[]>(
    [],
  );
  const [submissions, setSubmissions] = useState<IntentFormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [showSubs, setShowSubs] = useState(false);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const [forms, funcs, subs] = await Promise.all([
        api.listIntentForms(false),
        api.listCatalogFunctions(false),
        api.listIntentFormSubmissions(undefined, 50).catch(() => []),
      ]);
      setRows(forms);
      setCatalogFunctions(funcs);
      setSubmissions(subs);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) loadData();
    else setLoading(false);
  }, [isAdmin]);

  const enabledFunctions = useMemo(
    () => catalogFunctions.filter((f) => f.enabled),
    [catalogFunctions],
  );

  const functionOptions = useMemo(() => {
    const map = new Map<string, CatalogFunction>();
    for (const f of enabledFunctions) map.set(f.name, f);
    // Keep currently selected / legacy values visible even if disabled
    if (form.function_name && !map.has(form.function_name)) {
      const existing = catalogFunctions.find(
        (f) => f.name === form.function_name,
      );
      map.set(
        form.function_name,
        existing || {
          id: form.function_name,
          name: form.function_name,
          label: form.function_name,
          description: "",
          enabled: false,
          created_at: "",
          updated_at: "",
        },
      );
    }
    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [catalogFunctions, enabledFunctions, form.function_name]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.function_name.toLowerCase().includes(q) ||
        r.intent_label.toLowerCase().includes(q),
    );
  }, [rows, query]);

  function startCreate() {
    setEditingId(null);
    const defaultFn = enabledFunctions[0]?.name || "";
    setForm({
      ...EMPTY_FORM,
      function_name: defaultFn,
      fields: [newField(0)],
    });
    setMessage("");
    setError("");
  }

  function startEdit(row: IntentForm) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      description: row.description,
      function_name: row.function_name,
      intent_label: row.intent_label,
      intent_prompt: row.intent_prompt,
      intro_message: row.intro_message,
      enabled: row.enabled,
      fields: row.fields.length ? row.fields : [newField(0)],
    });
    setMessage("");
    setError("");
  }

  function updateField(index: number, patch: Partial<IntentFormField>) {
    setForm((prev) => {
      const fields = prev.fields.map((f, i) =>
        i === index ? { ...f, ...patch } : f,
      );
      return { ...prev, fields };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        function_name: slugify(form.function_name),
        intent_label: slugify(form.intent_label) || slugify(form.name),
        intent_prompt: form.intent_prompt.trim(),
        intro_message: form.intro_message.trim(),
        enabled: form.enabled,
        fields: form.fields.map((f, i) => ({
          ...f,
          id: slugify(f.id) || `field_${i + 1}`,
          label: f.label.trim(),
          order: i,
          options:
            f.type === "select"
              ? f.options.map((o) => o.trim()).filter(Boolean)
              : [],
        })),
      };
      if (!payload.name || !payload.intent_prompt || !payload.function_name) {
        throw new Error(
          "Name, function name, and intent prompt are required. Add functions under Functions catalog first.",
        );
      }
      if (
        !catalogFunctions.some((f) => f.name === payload.function_name && f.enabled) &&
        !catalogFunctions.some((f) => f.name === payload.function_name)
      ) {
        throw new Error(
          `Unknown function “${payload.function_name}”. Add it on the Functions page first.`,
        );
      }
      if (editingId) {
        await api.updateIntentForm(editingId, payload);
        setMessage("Intent form updated.");
      } else {
        await api.createIntentForm(payload);
        setMessage("Intent form created.");
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(parseError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: IntentForm) {
    if (!confirm(`Delete intent form “${row.name}”?`)) return;
    try {
      await api.deleteIntentForm(row.id);
      if (editingId === row.id) {
        setEditingId(null);
        setForm(EMPTY_FORM);
      }
      await loadData();
    } catch (err) {
      setError(parseError(err));
    }
  }

  async function toggleEnabled(row: IntentForm) {
    try {
      await api.updateIntentForm(row.id, { enabled: !row.enabled });
      await loadData();
    } catch (err) {
      setError(parseError(err));
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-4 py-10">
        <Card>
          <h1 className="text-[20px] font-semibold text-[#1d1d1f]">Intents</h1>
          <p className="mt-2 text-[14px] text-[#86868b]">
            Intent form management is available to admin and superadmin only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-0 w-full max-w-[1280px] flex-1 space-y-5 overflow-y-auto px-4 pb-8 pt-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold text-[#1d1d1f]">
            Intent forms
          </h1>
          <p className="mt-1 text-[14px] text-[#86868b]">
            Build dynamic forms, assign a function name, and teach the classifier
            when to call them.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/rag/functions" className="apple-btn-secondary text-[13px]">
            Manage functions
          </Link>
          <button
            type="button"
            className="apple-btn-secondary text-[13px]"
            onClick={() => setShowSubs((v) => !v)}
          >
            {showSubs ? "Hide submissions" : "Submissions"}
          </button>
          <button
            type="button"
            className="apple-btn-primary text-[13px]"
            onClick={startCreate}
          >
            + New intent
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-[13px] text-[#ff3b30]">{error}</p>
      ) : null}
      {message ? (
        <p className="text-[13px] text-[#34c759]">{message}</p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search intents…"
              className="apple-input flex-1 text-[13px]"
            />
          </div>
          {loading ? (
            <p className="text-[13px] text-[#86868b]">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-[13px] text-[#86868b]">
              No intent forms yet. Create one to extend the classifier.
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-[2px] border border-black/[0.06] px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">
                      {row.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#86868b]">
                      label <code>{row.intent_label}</code> · fn{" "}
                      <code>{row.function_name}</code> · {row.fields.length}{" "}
                      field(s)
                    </p>
                    <p className="mt-1 line-clamp-2 text-[12px] text-[#6e6e73]">
                      {row.intent_prompt}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={row.enabled}
                      onClick={() => toggleEnabled(row)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        row.enabled ? "bg-[#34c759]" : "bg-[#d2d2d7]"
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                          row.enabled
                            ? "translate-x-[22px]"
                            : "translate-x-[2px]"
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      className="apple-btn-secondary text-[12px]"
                      onClick={() => startEdit(row)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-[2px] px-2 py-1 text-[12px] text-[#ff3b30] hover:bg-[#ff3b30]/10"
                      onClick={() => handleDelete(row)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
            {editingId ? "Edit intent form" : "Create intent form"}
          </h2>
          <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
            <label className="block text-[12px] font-medium text-[#6e6e73]">
              Name
              <input
                className="apple-input mt-1 w-full text-[13px]"
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    name,
                    intent_label: prev.intent_label || slugify(name),
                  }));
                }}
                required
                disabled={saving}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-[12px] font-medium text-[#6e6e73]">
                Function name
                <select
                  className="apple-input mt-1 w-full font-mono text-[13px]"
                  value={form.function_name}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      function_name: e.target.value,
                      intent_label: prev.intent_label || e.target.value,
                    }))
                  }
                  required
                  disabled={saving || functionOptions.length === 0}
                >
                  {functionOptions.length === 0 ? (
                    <option value="">Add functions in catalog first</option>
                  ) : (
                    <>
                      <option value="">Select function…</option>
                      {functionOptions.map((fn) => (
                        <option key={fn.id} value={fn.name}>
                          {fn.label} ({fn.name})
                          {!fn.enabled ? " · disabled" : ""}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <span className="mt-1 block text-[11px] font-normal text-[#86868b]">
                  Configure available names on{" "}
                  <Link href="/rag/functions" className="text-[#0071e3]">
                    Functions
                  </Link>
                  .
                </span>
              </label>
              <label className="block text-[12px] font-medium text-[#6e6e73]">
                Intent label
                <input
                  className="apple-input mt-1 w-full font-mono text-[13px]"
                  value={form.intent_label}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      intent_label: e.target.value,
                    }))
                  }
                  placeholder="collect_lead"
                  required
                  disabled={saving}
                />
              </label>
            </div>
            <label className="block text-[12px] font-medium text-[#6e6e73]">
              Intent classification prompt
              <textarea
                className="apple-input mt-1 min-h-[88px] w-full text-[13px]"
                value={form.intent_prompt}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    intent_prompt: e.target.value,
                  }))
                }
                placeholder="When the user wants to book a demo / leave contact details…"
                required
                disabled={saving}
              />
            </label>
            <label className="block text-[12px] font-medium text-[#6e6e73]">
              Intro message (shown in chat)
              <input
                className="apple-input mt-1 w-full text-[13px]"
                value={form.intro_message}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    intro_message: e.target.value,
                  }))
                }
                disabled={saving}
              />
            </label>
            <label className="block text-[12px] font-medium text-[#6e6e73]">
              Description
              <input
                className="apple-input mt-1 w-full text-[13px]"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                disabled={saving}
              />
            </label>

            <div className="border-t border-black/[0.06] pt-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
                  Dynamic form fields
                </h3>
                <button
                  type="button"
                  className="apple-btn-secondary text-[12px]"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      fields: [...prev.fields, newField(prev.fields.length)],
                    }))
                  }
                  disabled={saving}
                >
                  + Field
                </button>
              </div>
              <div className="space-y-3">
                {form.fields.map((field, index) => (
                  <div
                    key={`${field.id}-${index}`}
                    className="rounded-[2px] border border-black/[0.06] p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className="text-[11px] text-[#86868b]">
                        Field id
                        <input
                          className="apple-input mt-1 w-full font-mono text-[12px]"
                          value={field.id}
                          onChange={(e) =>
                            updateField(index, { id: e.target.value })
                          }
                          disabled={saving}
                        />
                      </label>
                      <label className="text-[11px] text-[#86868b]">
                        Label
                        <input
                          className="apple-input mt-1 w-full text-[12px]"
                          value={field.label}
                          onChange={(e) =>
                            updateField(index, { label: e.target.value })
                          }
                          required
                          disabled={saving}
                        />
                      </label>
                      <label className="text-[11px] text-[#86868b]">
                        Type
                        <select
                          className="apple-input mt-1 w-full text-[12px]"
                          value={field.type}
                          onChange={(e) =>
                            updateField(index, {
                              type: e.target.value as IntentFormFieldType,
                            })
                          }
                          disabled={saving}
                        >
                          {FIELD_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-[11px] text-[#86868b]">
                        Placeholder
                        <input
                          className="apple-input mt-1 w-full text-[12px]"
                          value={field.placeholder}
                          onChange={(e) =>
                            updateField(index, {
                              placeholder: e.target.value,
                            })
                          }
                          disabled={saving}
                        />
                      </label>
                    </div>
                    {field.type === "select" ? (
                      <label className="mt-2 block text-[11px] text-[#86868b]">
                        Options (comma-separated)
                        <input
                          className="apple-input mt-1 w-full text-[12px]"
                          value={field.options.join(", ")}
                          onChange={(e) =>
                            updateField(index, {
                              options: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          disabled={saving}
                        />
                      </label>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between">
                      <label className="flex items-center gap-2 text-[12px] text-[#1d1d1f]">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) =>
                            updateField(index, {
                              required: e.target.checked,
                            })
                          }
                          disabled={saving}
                        />
                        Required
                      </label>
                      <button
                        type="button"
                        className="text-[12px] text-[#ff3b30]"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            fields: prev.fields.filter((_, i) => i !== index),
                          }))
                        }
                        disabled={saving}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-[13px] text-[#1d1d1f]">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    enabled: e.target.checked,
                  }))
                }
                disabled={saving}
              />
              Enabled for classifier
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="apple-btn-primary text-[13px]"
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : editingId
                    ? "Update intent"
                    : "Create intent"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  className="apple-btn-secondary text-[13px]"
                  onClick={() => {
                    setEditingId(null);
                    setForm(EMPTY_FORM);
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>

      {showSubs ? (
        <Card>
          <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
            Recent submissions
          </h2>
          {submissions.length === 0 ? (
            <p className="mt-2 text-[13px] text-[#86868b]">No submissions yet.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="text-[#86868b]">
                  <tr>
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Function</th>
                    <th className="py-2 pr-3 font-medium">Session</th>
                    <th className="py-2 font-medium">Values</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => (
                    <tr key={s.id} className="border-t border-black/[0.06]">
                      <td className="py-2 pr-3 align-top text-[#6e6e73]">
                        {new Date(s.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <code>{s.function_name}</code>
                        {s.form_name ? (
                          <div className="text-[11px] text-[#86868b]">{s.form_name}</div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-3 align-top">
                        <div>{s.session_name}</div>
                        {s.page_url ? (
                          <div className="mt-0.5 max-w-[180px] truncate text-[11px] text-[#86868b]">
                            {s.page_url}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 align-top">
                        {s.field_details && s.field_details.length > 0 ? (
                          <dl className="space-y-1 text-[12px]">
                            {s.field_details.map((f) => (
                              <div key={f.id} className="flex gap-2">
                                <dt className="min-w-[88px] text-[#86868b]">{f.label}</dt>
                                <dd className="m-0 text-[#1d1d1f]">
                                  {typeof f.value === "boolean"
                                    ? f.value
                                      ? "Yes"
                                      : "No"
                                    : String(f.value ?? "—")}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <pre className="whitespace-pre-wrap font-mono text-[11px] text-[#1d1d1f]">
                            {JSON.stringify(s.values, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
    </div>
  );
}
