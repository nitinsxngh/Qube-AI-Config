"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ChatPanel from "@/components/ChatPanel";
import ConfigPanel from "@/components/ConfigPanel";
import ResponsePanel from "@/components/ResponsePanel";
import { Card } from "@/components/ui";
import { api, ChatResponse, type PublishedConfig } from "@/lib/api";

function sessionForConfig(config: PublishedConfig) {
  return (config.session_name || config.name || "").trim();
}

function RagPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const configId = searchParams.get("config")?.trim() || "";
  const sessionFromUrl = searchParams.get("session")?.trim() || "";

  const [sessionName, setSessionName] = useState(sessionFromUrl);
  const [publishedConfigs, setPublishedConfigs] = useState<PublishedConfig[]>(
    [],
  );
  const [selectedConfigId, setSelectedConfigId] = useState(configId);
  const [responseMeta, setResponseMeta] = useState<ChatResponse | null>(null);
  const [testingConfig, setTestingConfig] = useState<{
    id: string;
    name: string;
    category: string;
  } | null>(null);
  const [configReady, setConfigReady] = useState(!configId);
  const [configError, setConfigError] = useState("");
  const [configPanelKey, setConfigPanelKey] = useState(0);
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    api
      .listPublishedConfigs()
      .then(setPublishedConfigs)
      .catch(() => setPublishedConfigs([]));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function applyFromUrl() {
      if (!configId) {
        setTestingConfig(null);
        setConfigReady(true);
        setConfigError("");
        return;
      }

      setConfigReady(false);
      setConfigError("");

      try {
        const published = await api.getPublishedConfig(configId);
        if (cancelled) return;
        const targetSession = sessionFromUrl || sessionForConfig(published);
        if (!targetSession) {
          throw new Error("This config has no name to open.");
        }

        await api.updateConfig(published.settings || {}, targetSession);
        if (cancelled) return;

        setSessionName(targetSession);
        setSelectedConfigId(published.id);
        setTestingConfig({
          id: published.id,
          name: published.name,
          category: published.dataset_category,
        });
        setConfigPanelKey((k) => k + 1);
        setConfigReady(true);
      } catch (err) {
        if (cancelled) return;
        setConfigError(
          err instanceof Error ? err.message : "Failed to apply published config",
        );
        setConfigReady(true);
      }
    }

    applyFromUrl();
    return () => {
      cancelled = true;
    };
  }, [configId, sessionFromUrl]);

  function syncUrl(nextSession: string, nextConfigId = "") {
    const params = new URLSearchParams();
    if (nextSession) params.set("session", nextSession);
    if (nextConfigId) params.set("config", nextConfigId);
    const qs = params.toString();
    router.replace(qs ? `/rag?${qs}` : "/rag", { scroll: false });
  }

  async function applyPublishedConfig(config: PublishedConfig) {
    const targetSession = sessionForConfig(config);
    if (!targetSession) {
      setConfigError("This config has no name to open.");
      return;
    }
    setConfigReady(false);
    setConfigError("");
    try {
      await api.updateConfig(config.settings || {}, targetSession);
      setSessionName(targetSession);
      setSelectedConfigId(config.id);
      setTestingConfig({
        id: config.id,
        name: config.name,
        category: config.dataset_category,
      });
      setConfigPanelKey((k) => k + 1);
      syncUrl(targetSession, config.id);
    } catch (err) {
      setConfigError(
        err instanceof Error ? err.message : "Failed to apply published config",
      );
    } finally {
      setConfigReady(true);
    }
  }

  function handleSelectConfig(id: string) {
    if (!id) {
      setSelectedConfigId("");
      setTestingConfig(null);
      setSessionName("");
      setResponseMeta(null);
      syncUrl("", "");
      return;
    }
    const config = publishedConfigs.find((c) => c.id === id);
    if (config) {
      void applyPublishedConfig(config);
    }
  }

  function handleSessionNameChange(name: string) {
    const next = name.trim();
    setSessionName(next);
    if (testingConfig) {
      syncUrl(next, testingConfig.id);
    }
  }

  function openNew() {
    setNewName("");
    setConfigError("");
    setNewOpen(true);
  }

  function handleCreateOrOpen(e?: FormEvent) {
    e?.preventDefault();
    const name = newName.trim();
    if (!name) {
      setConfigError("Enter a config name.");
      return;
    }
    const existing = publishedConfigs.find(
      (c) =>
        c.name.toLowerCase() === name.toLowerCase() ||
        (c.session_name || "").toLowerCase() === name.toLowerCase(),
    );
    setNewOpen(false);
    setNewName("");
    if (existing) {
      void applyPublishedConfig(existing);
      return;
    }
    setSelectedConfigId("");
    setTestingConfig(null);
    setSessionName(name);
    setConfigPanelKey((k) => k + 1);
    setResponseMeta(null);
    syncUrl(name, "");
  }

  function clearTesting() {
    setTestingConfig(null);
    setSelectedConfigId("");
    setSessionName("");
    setConfigError("");
    setResponseMeta(null);
    router.replace("/rag", { scroll: false });
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col gap-2 overflow-hidden px-3 py-2 sm:px-4">
      {testingConfig && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-[2px] border border-[#8b0d64]/25 bg-[#8b0d64]/08 px-3 py-2">
          <div className="min-w-0 text-[13px] text-[#1d1d1f]">
            <span className="font-semibold">Active config:</span>{" "}
            <span className="font-medium">{testingConfig.name}</span>
            {testingConfig.category ? (
              <span className="text-[#86868b]"> · {testingConfig.category}</span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <a
              href="/rag/published-configs"
              className="apple-btn-secondary !px-3 !py-1.5 !text-[12px]"
            >
              All configs
            </a>
            <button
              type="button"
              onClick={clearTesting}
              className="rounded-[2px] px-3 py-1.5 text-[12px] font-medium text-[#86868b] hover:bg-white/80"
            >
              Exit
            </button>
          </div>
        </div>
      )}

      {configError && (
        <p className="rounded-[2px] bg-[#ff3b30]/8 px-3 py-2 text-[13px] text-[#ff3b30]">
          {configError}
        </p>
      )}

      {!configReady ? (
        <div className="flex flex-1 items-center justify-center text-[14px] text-[#86868b]">
          Opening config…
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-2 overflow-hidden lg:grid-cols-[260px_1fr_280px]">
          <Card className="flex min-h-0 flex-col overflow-hidden !rounded-[2px] p-0">
            <ConfigPanel
              key={`${sessionName}-${configPanelKey}`}
              sessionName={sessionName || undefined}
              publishedConfigs={publishedConfigs}
              selectedConfigId={selectedConfigId}
              onSelectConfig={handleSelectConfig}
              onNew={openNew}
              onPublished={(config) => {
                setPublishedConfigs((prev) => [
                  config,
                  ...prev.filter((c) => c.id !== config.id),
                ]);
                setSelectedConfigId(config.id);
                setTestingConfig({
                  id: config.id,
                  name: config.name,
                  category: config.dataset_category,
                });
                syncUrl(sessionName, config.id);
              }}
            />
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden !rounded-[2px] p-0">
            <ChatPanel
              sessionName={sessionName}
              onSessionNameChange={handleSessionNameChange}
              onNew={openNew}
              onResponse={setResponseMeta}
            />
          </Card>

          <Card className="flex min-h-0 flex-col overflow-hidden !rounded-[2px] p-0">
            <ResponsePanel meta={responseMeta} />
          </Card>
        </div>
      )}

      {newOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleCreateOrOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-config-title"
            className="w-full max-w-sm rounded-[2px] bg-white p-5 shadow-lg"
          >
            <h3
              id="new-config-title"
              className="text-[17px] font-semibold text-[#1d1d1f]"
            >
              New config
            </h3>
            <p className="mt-1 text-[13px] text-[#86868b]">
              Enter a name. If it already exists, that config will open.
            </p>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="apple-input mt-4"
              placeholder="Config name"
              autoFocus
            />
            <div className="mt-5 flex gap-2">
              <button type="submit" className="apple-btn-primary flex-1 text-[14px]">
                Open
              </button>
              <button
                type="button"
                onClick={() => {
                  setNewOpen(false);
                  setNewName("");
                }}
                className="apple-btn-secondary text-[14px]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function RagPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-[14px] text-[#86868b]">
          Loading RAG…
        </div>
      }
    >
      <RagPageInner />
    </Suspense>
  );
}
