import {
  authHeaders,
  clearAuthSession,
  type AuthUser,
  type LoginResponse,
} from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options?.headers || {}),
    },
  });

  if (res.status === 401 && typeof window !== "undefined") {
    const isLogin = path.includes("/api/auth/login");
    if (!isLogin) {
      clearAuthSession();
      if (!window.location.pathname.startsWith("/login")) {
        const next = encodeURIComponent(window.location.pathname || "/rag");
        window.location.href = `/login?next=${next}`;
      }
    }
  }

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || `Request failed (${res.status})`);
  }

  return res.json() as Promise<T>;
}

export type ConfigField = {
  key: string;
  label: string;
  type: string;
  value: string | number | boolean;
  default?: string | number | boolean;
  has_value: boolean;
  secret: boolean;
  editable?: boolean;
};

export type ConfigResponse = {
  categories: Record<string, ConfigField[]>;
  session_name?: string | null;
  session_scoped?: boolean;
};

export type ChatMessage = {
  role: "human" | "ai";
  content: string;
};

export type ChunkTrace = {
  rank: number;
  score: number;
  page: string;
  topic: string;
  snippet: string;
};

export type RetrievalAttempt = {
  attempt: number;
  query: string;
  metadata_filter?: string;
  filter_fallback: boolean;
  flashrank_score: number;
  pinecone_score: number;
  confidence_score: number;
  band: string;
  chunks: ChunkTrace[];
};

export type ChatTrace = {
  logs: string[];
  intent_detail?: string | { raw: string; fallback: string };
  retrieval_attempts: RetrievalAttempt[];
  summary?: {
    intent?: string;
    route?: string;
    latency_ms?: number;
    search_query?: string;
    retry_queries?: string[];
    band?: string;
    flashrank_score?: number;
    pinecone_score?: number;
    confidence_score?: number;
    pages?: number[];
    topics?: string[];
  };
  thresholds?: Record<string, number>;
};

export type ChatResponse = {
  answer: string;
  session_name: string;
  session_id: string;
  intent?: string;
  route?: string;
  band?: string;
  latency_ms?: number;
  confidence_score?: number;
  flashrank_score?: number;
  pinecone_score?: number;
  search_query?: string;
  pages?: number[];
  topics?: string[];
  security_blocked?: boolean;
  function_name?: string;
  intent_form_id?: string;
  form?: IntentFormSchema;
  trace?: ChatTrace;
};

export type IntentFormFieldType =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "textarea"
  | "select"
  | "checkbox"
  | "date";

export type IntentFormField = {
  id: string;
  label: string;
  type: IntentFormFieldType;
  required: boolean;
  placeholder: string;
  options: string[];
  order: number;
};

export type IntentForm = {
  id: string;
  name: string;
  description: string;
  function_name: string;
  intent_label: string;
  intent_prompt: string;
  intro_message: string;
  fields: IntentFormField[];
  enabled: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type IntentFormSchema = {
  id: string;
  name: string;
  function_name: string;
  intent_label: string;
  intro_message: string;
  fields: IntentFormField[];
};

export type IntentFormSubmission = {
  id: string;
  intent_form_id: string;
  function_name: string;
  intent_label: string;
  session_name: string;
  values: Record<string, string | boolean | number>;
  created_at: string;
  form_name?: string;
  chatbot_id?: string | null;
  page_url?: string | null;
  field_details?: {
    id: string;
    label: string;
    type: string;
    value: unknown;
  }[];
};

export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "token"; content: string }
  | { type: "done"; response: ChatResponse }
  | { type: "error"; message: string };

export type IngestDocumentResult = {
  pdf_path: string;
  document_id?: string;
  source_name?: string;
  pages: number;
  blocks?: number;
  chunks: number;
  topic_distribution?: Record<string, number>;
  document_title?: string;
  domain?: string;
  assistant_role?: string;
  discovery_method?: string;
  topics?: Record<string, string[]>;
};

export type DataCollection = {
  id: string;
  name: string;
  description: string;
  namespace: string;
  enabled: boolean;
  document_count: number;
  pages: number;
  chunks: number;
  document_title?: string | null;
  domain?: string | null;
  topics?: Record<string, string[]>;
  source_files?: string[];
  created_at: string;
  updated_at: string;
};

export type IngestResponse = {
  status: string;
  pdf_path: string;
  pdf_paths?: string[];
  pages: number;
  chunks: number;
  index_name: string;
  namespace?: string;
  collection_id?: string | null;
  collection?: DataCollection | null;
  topic_distribution: Record<string, number>;
  document_title?: string;
  domain?: string;
  assistant_role?: string;
  discovery_method?: string;
  topics?: Record<string, string[]>;
  documents?: IngestDocumentResult[];
  document_count?: number;
  stored_documents?: Record<string, unknown>[];
};

export type CatalogModel = {
  id: string;
  name: string;
  dataset_category: string;
  kind: "model" | "embedding";
  launch_date: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type DatasetCategory = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type PublishedConfig = {
  id: string;
  name: string;
  description: string;
  dataset_category: string;
  settings: Record<string, string | number | boolean>;
  session_name?: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type CatalogLanguage = {
  id: string;
  name: string;
  code: string;
  native_name: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type CatalogFunction = {
  id: string;
  name: string;
  label: string;
  description: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

function sessionQuery(sessionName?: string) {
  return sessionName ? `?session_name=${encodeURIComponent(sessionName)}` : "";
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  authMe: () => request<AuthUser>("/api/auth/me"),

  changePassword: (current_password: string, new_password: string) =>
    request<{ ok: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password }),
    }),

  listMyApiKeys: () =>
    request<{ keys: Array<{
      id: string;
      name: string;
      prefix: string;
      created_at: string;
      last_used_at?: string | null;
      enabled: boolean;
      user_id: string;
    }> }>("/api/auth/api-keys"),

  createMyApiKey: (name: string) =>
    request<{
      id: string;
      name: string;
      prefix: string;
      api_key: string;
      created_at: string;
      user_id: string;
    }>("/api/auth/api-keys", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  revokeMyApiKey: (keyId: string) =>
    request<{ deleted: boolean; id: string }>(`/api/auth/api-keys/${keyId}`, {
      method: "DELETE",
    }),

  listUsers: (options?: { role?: string; enabled_only?: boolean }) => {
    const params = new URLSearchParams();
    if (options?.role) params.set("role", options.role);
    if (options?.enabled_only) params.set("enabled_only", "true");
    const qs = params.toString();
    return request<{ users: AuthUser[]; total: number }>(
      `/api/users${qs ? `?${qs}` : ""}`,
    );
  },

  createUser: (body: {
    email: string;
    password: string;
    full_name?: string;
    role?: "superadmin" | "admin" | "user";
    enabled?: boolean;
  }) =>
    request<AuthUser>("/api/users", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateUser: (
    id: string,
    body: Partial<{
      email: string;
      full_name: string;
      role: "superadmin" | "admin" | "user";
      enabled: boolean;
      password: string;
    }>,
  ) =>
    request<AuthUser>(`/api/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteUser: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/users/${id}`, {
      method: "DELETE",
    }),

  listUserApiKeys: (userId: string) =>
    request<{
      keys: Array<{
        id: string;
        name: string;
        prefix: string;
        created_at: string;
        last_used_at?: string | null;
        enabled: boolean;
        user_id: string;
      }>;
    }>(`/api/users/${userId}/api-keys`),

  createUserApiKey: (userId: string, name: string) =>
    request<{
      id: string;
      name: string;
      prefix: string;
      api_key: string;
      created_at: string;
      user_id: string;
    }>(`/api/users/${userId}/api-keys`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  revokeUserApiKey: (userId: string, keyId: string) =>
    request<{ deleted: boolean; id: string; user_id: string }>(
      `/api/users/${userId}/api-keys/${keyId}`,
      { method: "DELETE" },
    ),

  health: () => request<{ status: string }>("/api/health"),

  getConfig: (sessionName?: string) =>
    request<ConfigResponse>(`/api/config${sessionQuery(sessionName)}`),

  updateConfig: (
    updates: Record<string, string | number | boolean>,
    sessionName?: string,
  ) =>
    request<{ updated: string[]; config: ConfigResponse; session_name?: string }>(
      "/api/config",
      {
        method: "PATCH",
        body: JSON.stringify({
          updates,
          session_name: sessionName || null,
        }),
      },
    ),

  resetConfig: (options?: {
    keys?: string[];
    include_secrets?: boolean;
    sessionName?: string;
  }) =>
    request<{ updated: string[]; config: ConfigResponse; session_name?: string }>(
      "/api/config/reset",
      {
        method: "POST",
        body: JSON.stringify({
          keys: options?.keys ?? null,
          include_secrets: options?.include_secrets ?? false,
          session_name: options?.sessionName || null,
        }),
      },
    ),

  runIngest: (options?: {
    pdf_path?: string;
    pdf_paths?: string[];
    replace_all?: boolean;
    collection_id?: string;
    create_collection?: {
      name: string;
      description?: string;
      namespace?: string;
      enabled?: boolean;
    };
    replace_namespace?: boolean;
  }) =>
    request<IngestResponse>("/api/ingest/run", {
      method: "POST",
      body: JSON.stringify({
        pdf_path: options?.pdf_path || null,
        pdf_paths: options?.pdf_paths || null,
        replace_all: options?.replace_all ?? false,
        collection_id: options?.collection_id || null,
        create_collection: options?.create_collection || null,
        replace_namespace: options?.replace_namespace ?? false,
      }),
    }),

  uploadIngest: async (
    file: File,
    options?: {
      collection_id?: string;
      collection_name?: string;
      collection_description?: string;
      collection_namespace?: string;
      replace_namespace?: boolean;
    },
  ) => {
    const form = new FormData();
    form.append("file", file);
    if (options?.collection_id) form.append("collection_id", options.collection_id);
    if (options?.collection_name) form.append("collection_name", options.collection_name);
    if (options?.collection_description)
      form.append("collection_description", options.collection_description);
    if (options?.collection_namespace)
      form.append("collection_namespace", options.collection_namespace);
    if (options?.replace_namespace) form.append("replace_namespace", "true");
    const res = await fetch(`${API_BASE}/api/ingest/upload`, {
      method: "POST",
      headers: {
        ...authHeaders(),
      },
      body: form,
    });
    if (res.status === 401 && typeof window !== "undefined") {
      clearAuthSession();
      window.location.href = "/login";
    }
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `Upload failed (${res.status})`);
    }
    return res.json() as Promise<IngestResponse>;
  },

  uploadIngestBatch: async (
    files: File[],
    options?: {
      collection_id?: string;
      collection_name?: string;
      collection_description?: string;
      collection_namespace?: string;
      replace_namespace?: boolean;
    },
  ) => {
    if (!files.length) {
      throw new Error("No files provided");
    }
    let collectionId = options?.collection_id || "";
    let last: IngestResponse | null = null;
    const stored: Record<string, unknown>[] = [];
    let pages = 0;
    let chunks = 0;
    let documentCount = 0;

    for (let i = 0; i < files.length; i++) {
      const ingest = await api.uploadIngest(files[i], {
        collection_id: collectionId || undefined,
        collection_name: collectionId ? undefined : options?.collection_name,
        collection_description: collectionId
          ? undefined
          : options?.collection_description,
        collection_namespace: collectionId
          ? undefined
          : options?.collection_namespace,
        replace_namespace: i === 0 ? options?.replace_namespace : false,
      });
      last = ingest;
      collectionId = ingest.collection_id || ingest.collection?.id || collectionId;
      stored.push(...(ingest.stored_documents || []));
      pages += ingest.pages || 0;
      chunks += ingest.chunks || 0;
      documentCount += ingest.document_count || 1;
    }

    if (!last) {
      throw new Error("Batch upload finished with no response");
    }
    return {
      ...last,
      pages,
      chunks,
      document_count: documentCount,
      stored_documents: stored,
    };
  },

  listDataCollections: (enabledOnly = false) =>
    request<DataCollection[]>(
      `/api/data-collections${enabledOnly ? "?enabled_only=true" : ""}`,
    ),

  createDataCollection: (body: {
    name: string;
    description?: string;
    namespace?: string;
    enabled?: boolean;
  }) =>
    request<DataCollection>("/api/data-collections", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateDataCollection: (
    id: string,
    body: Partial<{ name: string; description: string; enabled: boolean }>,
  ) =>
    request<DataCollection>(`/api/data-collections/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteDataCollection: (id: string, clearVectors = true) =>
    request<{
      deleted: boolean;
      id: string;
      namespace?: string;
      vectors_cleared?: boolean;
      warning?: string;
    }>(
      `/api/data-collections/${id}?clear_vectors=${clearVectors ? "true" : "false"}`,
      { method: "DELETE" },
    ),

  listIntentForms: (enabledOnly = false) => {
    const qs = enabledOnly ? "?enabled_only=true" : "";
    return request<IntentForm[]>(`/api/intent-forms${qs}`);
  },

  getIntentForm: (id: string) =>
    request<IntentForm>(`/api/intent-forms/${id}`),

  createIntentForm: (body: {
    name: string;
    description?: string;
    function_name: string;
    intent_label: string;
    intent_prompt: string;
    intro_message?: string;
    fields?: IntentFormField[];
    enabled?: boolean;
  }) =>
    request<IntentForm>("/api/intent-forms", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateIntentForm: (
    id: string,
    body: Partial<{
      name: string;
      description: string;
      function_name: string;
      intent_label: string;
      intent_prompt: string;
      intro_message: string;
      fields: IntentFormField[];
      enabled: boolean;
    }>,
  ) =>
    request<IntentForm>(`/api/intent-forms/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteIntentForm: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/intent-forms/${id}`, {
      method: "DELETE",
    }),

  submitIntentForm: (
    id: string,
    body: {
      session_name?: string;
      values: Record<string, string | boolean | number>;
    },
  ) =>
    request<IntentFormSubmission>(`/api/intent-forms/${id}/submit`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listIntentFormSubmissions: (intentFormId?: string, limit = 100) => {
    const qs = new URLSearchParams();
    if (intentFormId) qs.set("intent_form_id", intentFormId);
    qs.set("limit", String(limit));
    return request<IntentFormSubmission[]>(
      `/api/intent-forms/submissions?${qs.toString()}`,
    );
  },

  sendMessage: (message: string, sessionName?: string) =>
    request<ChatResponse>("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        session_name: sessionName || null,
      }),
    }),

  streamMessage: async function* (
    message: string,
    sessionName?: string,
  ): AsyncGenerator<StreamEvent, void> {
    const res = await fetch(`${API_BASE}/api/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        message,
        session_name: sessionName || null,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(detail || `Stream failed (${res.status})`);
    }

    if (!res.body) {
      throw new Error("No response body for stream");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const line = part
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.startsWith("data:"));
        if (!line) continue;
        const raw = line.replace(/^data:\s*/, "");
        if (!raw) continue;
        try {
          yield JSON.parse(raw) as StreamEvent;
        } catch {
          /* skip malformed chunk */
        }
      }
    }
  },

  getHistory: (sessionName?: string) =>
    request<{ session_name: string; session_id: string; messages: ChatMessage[] }>(
      `/api/chat/history${sessionQuery(sessionName)}`,
    ),

  clearHistory: (sessionName?: string) =>
    request<{ session_name: string; session_id: string; cleared: boolean }>(
      `/api/chat/history${sessionQuery(sessionName)}`,
      { method: "DELETE" },
    ),

  listSessions: () =>
    request<{ sessions: string[] }>("/api/chat/sessions"),

  executeFlowHttp: (body: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    body?: string | null;
    timeout_seconds?: number;
  }) =>
    request<{
      ok: boolean;
      status: number;
      body: string;
      json_data: unknown;
      error: string | null;
    }>("/api/flow/http", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  executeFlowMysql: (body: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    sql: string;
    result_mode: string;
    max_rows?: number;
  }) =>
    request<{
      ok: boolean;
      rows: Record<string, unknown>[];
      columns: string[];
      row_count: number;
      scalar: unknown;
      first_row: Record<string, unknown> | null;
      preview: string;
      error: string | null;
    }>("/api/flow/mysql", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  listCatalogModels: () => request<CatalogModel[]>("/api/catalog/models"),

  createCatalogModel: (body: {
    name: string;
    dataset_category: string;
    kind: "model" | "embedding";
    launch_date: string;
    enabled: boolean;
  }) =>
    request<CatalogModel>("/api/catalog/models", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateCatalogModel: (
    id: string,
    body: Partial<{
      name: string;
      dataset_category: string;
      kind: "model" | "embedding";
      launch_date: string;
      enabled: boolean;
    }>,
  ) =>
    request<CatalogModel>(`/api/catalog/models/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteCatalogModel: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/catalog/models/${id}`, {
      method: "DELETE",
    }),

  listDatasetCategories: () =>
    request<DatasetCategory[]>("/api/catalog/dataset-categories"),

  createDatasetCategory: (body: {
    name: string;
    description: string;
    enabled: boolean;
  }) =>
    request<DatasetCategory>("/api/catalog/dataset-categories", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateDatasetCategory: (
    id: string,
    body: Partial<{
      name: string;
      description: string;
      enabled: boolean;
    }>,
  ) =>
    request<DatasetCategory>(`/api/catalog/dataset-categories/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteDatasetCategory: (id: string) =>
    request<{ deleted: boolean; id: string }>(
      `/api/catalog/dataset-categories/${id}`,
      { method: "DELETE" },
    ),

  listCatalogLanguages: () =>
    request<CatalogLanguage[]>("/api/catalog/languages"),

  createCatalogLanguage: (body: {
    name: string;
    code: string;
    native_name: string;
    enabled: boolean;
  }) =>
    request<CatalogLanguage>("/api/catalog/languages", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateCatalogLanguage: (
    id: string,
    body: Partial<{
      name: string;
      code: string;
      native_name: string;
      enabled: boolean;
    }>,
  ) =>
    request<CatalogLanguage>(`/api/catalog/languages/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteCatalogLanguage: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/catalog/languages/${id}`, {
      method: "DELETE",
    }),

  listCatalogFunctions: (enabledOnly = false) => {
    const qs = enabledOnly ? "?enabled_only=true" : "";
    return request<CatalogFunction[]>(`/api/catalog/functions${qs}`);
  },

  createCatalogFunction: (body: {
    name: string;
    label: string;
    description?: string;
    enabled?: boolean;
  }) =>
    request<CatalogFunction>("/api/catalog/functions", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateCatalogFunction: (
    id: string,
    body: Partial<{
      name: string;
      label: string;
      description: string;
      enabled: boolean;
    }>,
  ) =>
    request<CatalogFunction>(`/api/catalog/functions/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deleteCatalogFunction: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/catalog/functions/${id}`, {
      method: "DELETE",
    }),

  seedCatalog: () => request<Record<string, unknown>>("/api/catalog/seed"),

  listPublishedConfigs: (options?: {
    dataset_category?: string;
    enabled_only?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (options?.dataset_category)
      params.set("dataset_category", options.dataset_category);
    if (options?.enabled_only) params.set("enabled_only", "true");
    const qs = params.toString();
    return request<PublishedConfig[]>(
      `/api/published-configs${qs ? `?${qs}` : ""}`,
    );
  },

  getPublishedConfig: (id: string) =>
    request<PublishedConfig>(`/api/published-configs/${id}`),

  createPublishedConfig: (body: {
    name: string;
    description?: string;
    dataset_category: string;
    settings: Record<string, string | number | boolean>;
    session_name?: string | null;
    enabled?: boolean;
  }) =>
    request<PublishedConfig>("/api/published-configs", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updatePublishedConfig: (
    id: string,
    body: Partial<{
      name: string;
      description: string;
      dataset_category: string;
      settings: Record<string, string | number | boolean>;
      session_name: string | null;
      enabled: boolean;
    }>,
  ) =>
    request<PublishedConfig>(`/api/published-configs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  deletePublishedConfig: (id: string) =>
    request<{ deleted: boolean; id: string }>(`/api/published-configs/${id}`, {
      method: "DELETE",
    }),
};
