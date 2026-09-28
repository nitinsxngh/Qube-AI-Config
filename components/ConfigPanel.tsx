"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  api,
  CatalogLanguage,
  CatalogModel,
  ConfigField,
  DataCollection,
  DatasetCategory,
  PublishedConfig,
} from "@/lib/api";

const CATEGORY_LABELS: Record<string, string> = {
  model: "Model",
  retrieval: "Retrieval",
  chat: "Chat",
  assistant: "Assistant",
  session: "Session",
  pinecone: "Pinecone",
  mongodb: "MongoDB",
  ingest: "Ingest",
  openai: "OpenAI",
  langsmith: "LangSmith",
};

/** Identity / copy — shown in a simple section, not mixed with RAG knobs. */
const SIMPLE_CATEGORY = "assistant";

const TECHNICAL_CATEGORIES = [
  "model",
  "retrieval",
  "chat",
  "session",
  "pinecone",
  "mongodb",
  "ingest",
  "openai",
  "langsmith",
] as const;

const SIMPLE_FIELD_ORDER = [
  "ASSISTANT_NAME",
  "ASSISTANT_ROLE",
  "ASSISTANT_ORGANISATION",
  "LANGUAGE",
  "LOW_CONFIDENCE_REPLY",
];

const FALLBACK_CHAT_MODELS = ["gpt-4o-mini"];

const FALLBACK_EMBEDDING_MODELS = ["text-embedding-3-small"];

const FALLBACK_LANGUAGES: CatalogLanguage[] = [
  {
    id: "fallback-en",
    name: "English",
    code: "en",
    native_name: "English",
    enabled: true,
    created_at: "",
    updated_at: "",
  },
];

const MODEL_SELECT_KEYS = new Set(["MODEL_NAME", "EMBEDDING_MODEL"]);

type ConfigPanelProps = {
  /** When set, load/save config for this session in MongoDB */
  sessionName?: string;
  publishedConfigs?: PublishedConfig[];
  selectedConfigId?: string;
  onSelectConfig?: (configId: string) => void;
  onNew?: () => void;
  onPublished?: (config: PublishedConfig) => void;
};

function optionsForField(
  key: string,
  currentValue: string,
  catalogModels: CatalogModel[],
): string[] {
  const enabled = catalogModels.filter((m) => m.enabled);
  const fromCatalog =
    key === "EMBEDDING_MODEL"
      ? enabled.filter((m) => m.kind === "embedding").map((m) => m.name)
      : enabled.filter((m) => m.kind === "model").map((m) => m.name);

  const fallback =
    key === "EMBEDDING_MODEL" ? FALLBACK_EMBEDDING_MODELS : FALLBACK_CHAT_MODELS;

  const merged = [...fromCatalog, ...fallback];
  if (currentValue && !merged.includes(currentValue)) {
    merged.unshift(currentValue);
  }

  return Array.from(new Set(merged));
}

function languageOptions(
  currentCode: string,
  catalogLanguages: CatalogLanguage[],
): CatalogLanguage[] {
  const enabled = catalogLanguages.filter((l) => l.enabled);
  const base = enabled.length > 0 ? enabled : FALLBACK_LANGUAGES;
  const byCode = new Map(base.map((l) => [l.code.toLowerCase(), l]));
  if (currentCode && !byCode.has(currentCode.toLowerCase())) {
    byCode.set(currentCode.toLowerCase(), {
      id: `current-${currentCode}`,
      name: currentCode,
      code: currentCode,
      native_name: currentCode,
      enabled: true,
      created_at: "",
      updated_at: "",
    });
  }
  return Array.from(byCode.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export default function ConfigPanel({
  sessionName,
  publishedConfigs = [],
  selectedConfigId = "",
  onSelectConfig,
  onNew,
  onPublished,
}: ConfigPanelProps) {
  const [categories, setCategories] = useState<Record<string, ConfigField[]>>({});
  const [catalogModels, setCatalogModels] = useState<CatalogModel[]>([]);
  const [catalogLanguages, setCatalogLanguages] = useState<CatalogLanguage[]>([]);
  const [dataCollections, setDataCollections] = useState<DataCollection[]>([]);
  const [datasetCategories, setDatasetCategories] = useState<DatasetCategory[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(Boolean(sessionName));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishName, setPublishName] = useState("");
  const [publishDescription, setPublishDescription] = useState("");
  const [publishCategory, setPublishCategory] = useState("");
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<string>("model");
  const [formKey, setFormKey] = useState(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistSeq = useRef(0);

  useEffect(() => {
    if (!sessionName) {
      setCategories({});
      setDraft({});
      setLoading(false);
      return;
    }
    loadConfig();
  }, [sessionName]);

  async function loadConfig() {
    setLoading(true);
    setError("");
    try {
      const [data, models, languages, collections, categoriesList] =
        await Promise.all([
          api.getConfig(sessionName),
          api.listCatalogModels().catch(() => [] as CatalogModel[]),
          api.listCatalogLanguages().catch(() => [] as CatalogLanguage[]),
          api.listDataCollections(true).catch(() => [] as DataCollection[]),
          api.listDatasetCategories().catch(() => [] as DatasetCategory[]),
        ]);
      setCategories(data.categories);
      setCatalogModels(models);
      setCatalogLanguages(languages);
      setDataCollections(collections);
      setDatasetCategories(categoriesList.filter((c) => c.enabled));
      setDraft({});
      setFormKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    return () => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
    };
  }, []);

  const technicalCategories = useMemo(
    () => TECHNICAL_CATEGORIES.filter((key) => categories[key]?.length),
    [categories],
  );

  const simpleFields = useMemo(() => {
    const fields = categories[SIMPLE_CATEGORY] || [];
    const byKey = new Map(fields.map((f) => [f.key, f]));
    const ordered = SIMPLE_FIELD_ORDER.map((key) => byKey.get(key)).filter(
      (f): f is ConfigField => Boolean(f),
    );
    const extras = fields.filter((f) => !SIMPLE_FIELD_ORDER.includes(f.key));
    return [...ordered, ...extras];
  }, [categories]);

  function updatesFromDraft(
    source: Record<string, string>,
  ): Record<string, string | number | boolean> {
    const updates: Record<string, string | number | boolean> = {};
    const fields = Object.values(categories).flat();
    for (const [key, value] of Object.entries(source)) {
      const field = fields.find((item) => item.key === key);
      if (!field || field.editable === false) continue;
      if (field.type === "int") updates[key] = Number(value);
      else if (field.type === "float") updates[key] = Number(value);
      else if (field.type === "bool") updates[key] = value === "true";
      else updates[key] = value;
    }
    return updates;
  }

  async function persistDraft(source: Record<string, string>) {
    if (!sessionName) return;
    const updates = updatesFromDraft(source);
    if (Object.keys(updates).length === 0) return;

    const seq = ++persistSeq.current;
    setSaving(true);
    setError("");
    try {
      const result = await api.updateConfig(updates, sessionName);
      if (seq !== persistSeq.current) return;
      setCategories(result.config.categories);
      setDraft((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(source)) {
          if (next[key] === source[key]) delete next[key];
        }
        return next;
      });
      setMessage("Saved");
      window.setTimeout(() => {
        setMessage((current) => (current === "Saved" ? "" : current));
      }, 1500);
    } catch (err) {
      if (seq !== persistSeq.current) return;
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      if (seq === persistSeq.current) setSaving(false);
    }
  }

  function queuePersist(source: Record<string, string>, immediate: boolean) {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current);
      persistTimer.current = null;
    }
    persistTimer.current = setTimeout(
      () => {
        persistTimer.current = null;
        void persistDraft(source);
      },
      immediate ? 0 : 450,
    );
  }

  function handleChange(key: string, value: string) {
    const field = Object.values(categories)
      .flat()
      .find((item) => item.key === key);
    if (field && field.editable === false) return;
    const next = { ...draft, [key]: value };
    if (key === "DATA_COLLECTION_ID") {
      const match = dataCollections.find((c) => c.id === value);
      next.PINECONE_NAMESPACE = match?.namespace || "";
    }
    setDraft(next);
    const instant =
      field?.type === "bool" ||
      MODEL_SELECT_KEYS.has(key) ||
      key === "LANGUAGE" ||
      key === "DATA_COLLECTION_ID";
    queuePersist(next, instant);
  }

  function buildUpdatesFromDraft(): Record<string, string | number | boolean> {
    return updatesFromDraft(draft);
  }

  function buildConfigSnapshot(): Record<string, string | number | boolean> {
    const snapshot: Record<string, string | number | boolean> = {};
    for (const fields of Object.values(categories)) {
      for (const field of fields) {
        if (field.secret || field.editable === false) continue;
        const raw = draft[field.key] ?? String(field.value ?? "");
        if (field.type === "int") snapshot[field.key] = Number(raw);
        else if (field.type === "float") snapshot[field.key] = Number(raw);
        else if (field.type === "bool") snapshot[field.key] = raw === "true";
        else snapshot[field.key] = raw;
      }
    }
    return snapshot;
  }

  function openPublishModal() {
    setError("");
    setMessage("");
    const current =
      publishedConfigs.find((c) => c.id === selectedConfigId) ||
      publishedConfigs.find(
        (c) =>
          c.name.toLowerCase() === (sessionName || "").toLowerCase() ||
          (c.session_name || "").toLowerCase() === (sessionName || "").toLowerCase(),
      );
    setPublishName(current?.name || sessionName || "");
    setPublishDescription(current?.description || "");
    setPublishCategory(
      current?.dataset_category || datasetCategories[0]?.name || "",
    );
    setPublishOpen(true);
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
  }

  async function handlePublish() {
    if (!publishName.trim()) {
      setError("Enter a name for this published config");
      return;
    }
    if (!publishCategory.trim()) {
      setError("Select a dataset category");
      return;
    }

    setPublishing(true);
    setSaving(true);
    setError("");
    setMessage("");

    try {
      // Persist draft to the session first so chat uses the same values
      const updates = buildUpdatesFromDraft();
      const snapshot = { ...buildConfigSnapshot(), ...updates };

      if (Object.keys(updates).length > 0) {
        const result = await api.updateConfig(updates, sessionName);
        setCategories(result.config.categories);
        setDraft({});
        setFormKey((k) => k + 1);
      }

      const name = publishName.trim();
      const existing =
        publishedConfigs.find((c) => c.id === selectedConfigId) ||
        publishedConfigs.find((c) => c.name.toLowerCase() === name.toLowerCase());
      const body = {
        name,
        description: publishDescription.trim(),
        dataset_category: publishCategory.trim(),
        settings: snapshot,
        session_name: sessionName || null,
        enabled: true,
      };
      const published = existing
        ? await api.updatePublishedConfig(existing.id, body)
        : await api.createPublishedConfig(body);

      setPublishOpen(false);
      onPublished?.(published);
      setMessage(
        existing
          ? `Updated “${published.name}”.`
          : `Published “${published.name}” under ${published.dataset_category}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to publish");
    } finally {
      setPublishing(false);
      setSaving(false);
    }
  }

  async function handleResetAll() {
    const ok = window.confirm(
      sessionName
        ? `Reset editable session settings for “${sessionName}” to defaults?\n\nGlobal settings (API keys, MongoDB, ingest) are unchanged.`
        : "Reset all settings to defaults?\n\nAPI keys (OpenAI, Pinecone, LangSmith) will be kept.",
    );
    if (!ok) return;

    setResetting(true);
    setMessage("");
    setError("");

    try {
      const result = await api.resetConfig({ sessionName });
      setCategories(result.config.categories);
      setDraft({});
      setFormKey((k) => k + 1);
      setMessage(
        `Reset ${result.updated.length} setting${result.updated.length === 1 ? "" : "s"} to defaults.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setResetting(false);
    }
  }

  async function handleResetCategory(category: string) {
    const fields = (categories[category] || []).filter(
      (f) => !f.secret && f.editable !== false,
    );
    if (fields.length === 0) {
      setMessage("Nothing editable to reset in this section.");
      return;
    }

    const label = CATEGORY_LABELS[category] || category;
    const ok = window.confirm(`Reset “${label}” editable settings to defaults?`);
    if (!ok) return;

    setResetting(true);
    setMessage("");
    setError("");

    try {
      const result = await api.resetConfig({
        keys: fields.map((f) => f.key),
        sessionName,
      });
      setCategories(result.config.categories);
      setDraft({});
      setFormKey((k) => k + 1);
      setMessage(`Reset ${label} to defaults.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset");
    } finally {
      setResetting(false);
    }
  }

  const busy = saving || resetting || publishing;

  function renderField(field: ConfigField, simple = false) {
    const editable = field.editable !== false;
    const current = draft[field.key] ?? String(field.value ?? "");
    const isTextarea = field.key === "LOW_CONFIDENCE_REPLY";
    return (
      <label
        key={field.key}
        className={`block ${editable ? "" : "opacity-70"}`}
      >
        <span
          className={`mb-1.5 block truncate text-[13px] font-medium ${
            simple ? "text-[#1d1d1f]" : "text-[#86868b]"
          }`}
        >
          {field.label}
          {!editable && (
            <span className="ml-1 font-normal text-[#86868b]/60">
              (global)
            </span>
          )}
        </span>
        {field.type === "bool" ? (
          <select
            value={draft[field.key] ?? String(field.value)}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={!editable || busy}
            className="apple-input py-2 text-[13px] disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        ) : MODEL_SELECT_KEYS.has(field.key) ? (
          <select
            value={current}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={!editable || busy}
            className="apple-input py-2 text-[13px] disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
          >
            {optionsForField(
              field.key,
              String(draft[field.key] ?? field.value ?? ""),
              catalogModels,
            ).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        ) : field.key === "LANGUAGE" ? (
          <select
            value={draft[field.key] ?? String(field.value ?? "en")}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={!editable || busy}
            className="apple-input py-2 text-[13px] disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
          >
            {languageOptions(
              String(draft[field.key] ?? field.value ?? "en"),
              catalogLanguages,
            ).map((lang) => (
              <option key={lang.code} value={lang.code}>
                {simple
                  ? lang.name
                  : `${lang.name} (${lang.code})${
                      lang.native_name && lang.native_name !== lang.name
                        ? ` — ${lang.native_name}`
                        : ""
                    }`}
              </option>
            ))}
          </select>
        ) : field.key === "DATA_COLLECTION_ID" ? (
          <select
            value={draft[field.key] ?? String(field.value ?? "")}
            onChange={(e) => handleChange(field.key, e.target.value)}
            disabled={!editable || busy}
            className="apple-input py-2 text-[13px] disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
          >
            <option value="">Default namespace</option>
            {dataCollections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.namespace})
              </option>
            ))}
          </select>
        ) : isTextarea ? (
          <textarea
            readOnly={!editable}
            disabled={!editable || busy}
            defaultValue={String(field.value ?? "")}
            placeholder={
              field.default !== undefined ? String(field.default) : field.key
            }
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="apple-input min-h-[72px] resize-y py-2 text-[13px] disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
          />
        ) : (
          <input
            type={
              field.secret
                ? "password"
                : field.type === "int" || field.type === "float"
                  ? "number"
                  : "text"
            }
            step={field.type === "float" ? "any" : undefined}
            readOnly={!editable}
            disabled={!editable || busy}
            defaultValue={
              field.secret && field.has_value ? "" : String(field.value ?? "")
            }
            placeholder={
              field.secret && field.has_value
                ? String(field.value)
                : field.default !== undefined
                  ? String(field.default)
                  : field.key
            }
            onChange={(e) => handleChange(field.key, e.target.value)}
            className="apple-input py-2 text-[13px] disabled:cursor-not-allowed disabled:bg-[#f5f5f7]"
          />
        )}
      </label>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-[14px] text-[#86868b]">Loading settings…</p>
      </div>
    );
  }

  return (
    <>
    <form key={formKey} onSubmit={handleFormSubmit} className="flex h-full flex-col">
      <div className="border-b border-black/[0.06] px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-semibold text-[#1d1d1f]">Settings</h2>
          {onNew && (
            <button
              type="button"
              onClick={onNew}
              className="rounded-[2px] px-2 py-1 text-[12px] font-medium text-[#8b0d64] hover:bg-[#8b0d64]/8"
            >
              New
            </button>
          )}
        </div>
        <label className="mt-2 block">
          <span className="sr-only">Config</span>
          <select
            value={selectedConfigId}
            onChange={(e) => onSelectConfig?.(e.target.value)}
            className="apple-input py-2 text-[13px]"
          >
            <option value="">Select a config</option>
            {publishedConfigs.map((config) => (
              <option key={config.id} value={config.id}>
                {config.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!sessionName ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center">
          <p className="text-[13px] leading-relaxed text-[#86868b]">
            Select a config or click New to name one.
          </p>
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto px-2 py-2">
        <p className="px-3 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-[#86868b]">
          RAG &amp; technical
        </p>
        {technicalCategories.map((category) => {
          const isOpen = expanded === category;
          const editableInCategory = (categories[category] || []).some(
            (f) => f.editable !== false && !f.secret,
          );
          return (
            <div key={category} className="mb-1">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? "" : category)}
                  className="flex min-w-0 flex-1 items-center justify-between rounded-lg px-3 py-2.5 text-left text-[14px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7]"
                >
                  {CATEGORY_LABELS[category] || category}
                  <span className="text-[12px] text-[#86868b]">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && editableInCategory && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleResetCategory(category)}
                    className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:opacity-40"
                    title="Reset editable fields in this section"
                  >
                    Reset
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="space-y-3 px-3 pb-3 pt-1">
                  {(categories[category] || []).map((field) => renderField(field))}
                </div>
              )}
            </div>
          );
        })}

        {simpleFields.length > 0 && (
          <div className="mt-3 border-t border-black/[0.06] px-3 pb-3 pt-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-[14px] font-semibold text-[#1d1d1f]">
                Assistant
              </h3>
              {simpleFields.some((f) => f.editable !== false && !f.secret) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleResetCategory(SIMPLE_CATEGORY)}
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-medium text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f] disabled:opacity-40"
                  title="Reset assistant fields to defaults"
                >
                  Reset
                </button>
              )}
            </div>
            <div className="space-y-4">
              {simpleFields.map((field) => renderField(field, true))}
            </div>
          </div>
        )}
      </div>
      )}

      {sessionName && (
      <div className="space-y-2 border-t border-black/[0.06] px-4 py-3">
        <button
          type="button"
          disabled={busy}
          onClick={openPublishModal}
          className="apple-btn-secondary w-full text-[13px]"
        >
          Publish config
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleResetAll}
          className="apple-btn-secondary w-full text-[13px]"
        >
          {resetting ? "Resetting…" : "Reset to defaults"}
        </button>
        <p
          className={`min-h-[16px] text-center text-[12px] ${
            error && !publishOpen ? "text-[#ff3b30]" : "text-[#86868b]"
          }`}
        >
          {error && !publishOpen
            ? error
            : saving && !publishing
              ? "Saving…"
              : message}
        </p>
      </div>
      )}
    </form>

    {publishOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-config-title"
          className="w-full max-w-md rounded-[2px] bg-white p-5 shadow-lg"
        >
          <h3
            id="publish-config-title"
            className="text-[17px] font-semibold text-[#1d1d1f]"
          >
            Publish config
          </h3>
          <p className="mt-1 text-[13px] text-[#86868b]">
            Save this configuration under a dataset category so you can reuse it later.
          </p>

          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="apple-label mb-1.5 block">Name</span>
              <input
                value={publishName}
                onChange={(e) => setPublishName(e.target.value)}
                className="apple-input"
                placeholder="e.g. Marketing RAG v1"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="apple-label mb-1.5 block">Category</span>
              <select
                value={publishCategory}
                onChange={(e) => setPublishCategory(e.target.value)}
                className="apple-input"
              >
                {datasetCategories.length === 0 ? (
                  <option value="">No categories — create one first</option>
                ) : (
                  datasetCategories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block">
              <span className="apple-label mb-1.5 block">Description</span>
              <textarea
                value={publishDescription}
                onChange={(e) => setPublishDescription(e.target.value)}
                className="apple-input min-h-[72px] resize-y"
                placeholder="Optional notes"
              />
            </label>
          </div>

          {error && (
            <p className="mt-3 text-[12px] text-[#ff3b30]">{error}</p>
          )}

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              disabled={publishing || !publishCategory}
              onClick={handlePublish}
              className="apple-btn-primary flex-1 text-[14px]"
            >
              {publishing ? "Publishing…" : "Publish"}
            </button>
            <button
              type="button"
              disabled={publishing}
              onClick={() => {
                setPublishOpen(false);
                setError("");
              }}
              className="apple-btn-secondary text-[14px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
