"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui";
import { api, type CatalogFunction } from "@/lib/api";

const EMPTY_FORM = {
  name: "",
  label: "",
  description: "",
  enabled: true,
};

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

function Toggle({
  checked,
  onChange,
  title,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  title?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      disabled={disabled}
      onClick={onChange}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
        checked ? "bg-[#34c759]" : "bg-[#d2d2d7]"
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-[22px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}

export default function FunctionsPage() {
  const [functions, setFunctions] = useState<CatalogFunction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "enabled" | "disabled">(
    "all",
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      setFunctions(await api.listCatalogFunctions(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load functions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return functions.filter((row) => {
      if (statusFilter === "enabled" && !row.enabled) return false;
      if (statusFilter === "disabled" && row.enabled) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.label.toLowerCase().includes(q) ||
        row.description.toLowerCase().includes(q)
      );
    });
  }, [functions, query, statusFilter]);

  const enabledCount = functions.filter((f) => f.enabled).length;
  const isEditing = Boolean(editingId);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  function openEdit(row: CatalogFunction) {
    setEditingId(row.id);
    setForm({
      name: row.name,
      label: row.label,
      description: row.description,
      enabled: row.enabled,
    });
    setError("");
  }

  async function toggleEnabled(row: CatalogFunction) {
    setSaving(true);
    setError("");
    try {
      const updated = await api.updateCatalogFunction(row.id, {
        enabled: !row.enabled,
      });
      setFunctions((prev) => prev.map((f) => (f.id === row.id ? updated : f)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  async function removeFunction(id: string) {
    if (!confirm("Delete this function name from the catalog?")) return;
    setSaving(true);
    setError("");
    try {
      await api.deleteCatalogFunction(id);
      setFunctions((prev) => prev.filter((f) => f.id !== id));
      if (editingId === id) openCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        name: slugify(form.name) || slugify(form.label),
        label: form.label.trim() || form.name.trim(),
        description: form.description.trim(),
        enabled: form.enabled,
      };
      if (!payload.name || !payload.label) {
        throw new Error("Name and label are required.");
      }
      if (editingId) {
        const updated = await api.updateCatalogFunction(editingId, payload);
        setFunctions((prev) =>
          prev.map((f) => (f.id === editingId ? updated : f)),
        );
      } else {
        const created = await api.createCatalogFunction(payload);
        setFunctions((prev) => [created, ...prev]);
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save function");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto min-h-0 w-full max-w-[1280px] flex-1 overflow-y-auto px-3 pb-6 pt-2 sm:px-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-[#86868b]">
          Manage callable function names used by{" "}
          <Link href="/intents" className="text-[#8b0d64] hover:underline">
            Intent forms
          </Link>
          .
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            className="apple-btn-secondary !rounded-[2px]"
            disabled={loading || saving}
            onClick={() => loadData()}
          >
            Refresh
          </button>
          <button
            type="button"
            className="apple-btn-secondary !rounded-[2px]"
            disabled={loading || saving}
            onClick={async () => {
              setSaving(true);
              try {
                await api.seedCatalog();
                await loadData();
              } catch (err) {
                setError(
                  err instanceof Error ? err.message : "Seed failed",
                );
              } finally {
                setSaving(false);
              }
            }}
          >
            Seed defaults
          </button>
          <button
            type="button"
            className="apple-btn-primary"
            onClick={openCreate}
            disabled={saving}
          >
            Add function
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card className="!rounded-[2px] overflow-hidden !p-0">
          <div className="flex flex-col gap-3 border-b border-black/[0.06] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">
                Function catalog
              </h2>
              <p className="mt-0.5 text-[13px] text-[#86868b]">
                {loading
                  ? "Loading from backend…"
                  : `${filtered.length} of ${functions.length} shown · ${enabledCount} enabled`}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <div
                className="inline-flex h-9 shrink-0 items-center gap-0.5 self-start rounded-[2px] border-2 border-black/[0.08] bg-[#f5f5f7] p-0.5 sm:self-auto"
                role="group"
                aria-label="Filter by status"
              >
                {(
                  [
                    ["all", "All"],
                    ["enabled", "Enabled"],
                    ["disabled", "Disabled"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    className={`h-full rounded-[2px] px-3 text-[12px] font-semibold transition ${
                      statusFilter === value
                        ? "bg-white text-[#8b0d64] shadow-sm"
                        : "text-[#86868b] hover:text-[#1d1d1f]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search functions…"
                className="apple-input h-9 w-full !rounded-[2px] !py-0 sm:w-[220px]"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left">
              <thead>
                <tr className="border-b border-black/[0.06] bg-[#fafafa] text-[12px] font-medium uppercase tracking-wide text-[#86868b]">
                  <th className="px-5 py-3 font-medium">Label</th>
                  <th className="px-5 py-3 font-medium">Function name</th>
                  <th className="px-5 py-3 font-medium">Description</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-[14px] text-[#86868b]"
                    >
                      Loading functions…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-5 py-12 text-center text-[14px] text-[#86868b]"
                    >
                      No functions yet. Seed defaults or add one on the right.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => (
                    <tr
                      key={row.id}
                      className={`border-b border-black/[0.04] transition-colors hover:bg-[#f9f9fb] ${
                        editingId === row.id ? "bg-[#f0f7ff]" : ""
                      }`}
                    >
                      <td className="px-5 py-3.5">
                        <span className="text-[14px] font-semibold text-[#1d1d1f]">
                          {row.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[13px] text-[#1d1d1f]">
                        {row.name}
                      </td>
                      <td className="max-w-[260px] px-5 py-3.5 text-[13px] text-[#86868b]">
                        {row.description || "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-[13px] text-[#1d1d1f]">
                        {formatDate(row.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Toggle
                          checked={row.enabled}
                          disabled={saving}
                          onChange={() => toggleEnabled(row)}
                          title={row.enabled ? "Disable" : "Enable"}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="apple-btn-secondary !rounded-[2px] !px-3 !py-1.5 !text-[12px]"
                            onClick={() => openEdit(row)}
                            disabled={saving}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-[2px] px-3 py-1.5 text-[12px] font-medium text-[#ff3b30] transition hover:bg-[#ff3b30]/10"
                            onClick={() => removeFunction(row.id)}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="!rounded-[2px] h-fit self-start">
          <h2 className="text-[17px] font-semibold tracking-tight text-[#1d1d1f]">
            {isEditing ? "Edit function" : "New function"}
          </h2>
          <p className="mt-1 text-[13px] text-[#86868b]">
            Saved to MongoDB catalog — pick these on Intent forms.
          </p>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <label className="block">
              <span className="apple-label mb-1.5 block">Label</span>
              <input
                value={form.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setForm((f) => ({
                    ...f,
                    label,
                    name: f.name || slugify(label),
                  }));
                }}
                placeholder="e.g. Book Demo"
                className="apple-input !rounded-[2px]"
                required
              />
            </label>

            <label className="block">
              <span className="apple-label mb-1.5 block">Function name</span>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. book_demo"
                className="apple-input !rounded-[2px] font-mono"
                required
              />
            </label>

            <label className="block">
              <span className="apple-label mb-1.5 block">Description</span>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="What should this function do?"
                rows={3}
                className="apple-input !rounded-[2px] resize-y"
              />
            </label>

            <div className="flex items-center justify-between rounded-[2px] border-2 border-black/[0.08] bg-[#f5f5f7] px-3 py-3">
              <div>
                <p className="text-[14px] font-medium text-[#1d1d1f]">Enabled</p>
                <p className="text-[12px] text-[#86868b]">
                  Only enabled functions appear on Intent forms.
                </p>
              </div>
              <Toggle
                checked={form.enabled}
                onChange={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
              />
            </div>

            {error ? (
              <p className="text-[13px] text-[#ff3b30]">{error}</p>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                className="apple-btn-primary !rounded-[2px] flex-1"
                disabled={saving}
              >
                {saving
                  ? "Saving…"
                  : isEditing
                    ? "Save changes"
                    : "Create function"}
              </button>
              {isEditing ? (
                <button
                  type="button"
                  className="apple-btn-secondary !rounded-[2px]"
                  onClick={openCreate}
                  disabled={saving}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
