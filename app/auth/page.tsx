"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { useAuth } from "@/components/AuthProvider";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";

type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at?: string | null;
  enabled: boolean;
  user_id: string;
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseApiError(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong";
  try {
    const parsed = JSON.parse(err.message) as { detail?: string };
    return parsed.detail || err.message;
  } catch {
    return err.message;
  }
}

export default function AuthPage() {
  const { user, refreshMe } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const isSuper = user?.role === "superadmin";

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [myKeys, setMyKeys] = useState<ApiKeyRow[]>([]);
  const [keyName, setKeyName] = useState("default");
  const [newKeyPlain, setNewKeyPlain] = useState("");
  const [keysBusy, setKeysBusy] = useState(false);

  const [users, setUsers] = useState<AuthUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createRole, setCreateRole] = useState<"user" | "admin" | "superadmin">(
    "user",
  );
  const [createBusy, setCreateBusy] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userKeys, setUserKeys] = useState<ApiKeyRow[]>([]);
  const [userKeyName, setUserKeyName] = useState("default");
  const [userKeyPlain, setUserKeyPlain] = useState("");

  const loadMyKeys = useCallback(async () => {
    const res = await api.listMyApiKeys();
    setMyKeys(res.keys);
  }, []);

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const res = await api.listUsers();
      setUsers(res.users);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadMyKeys().catch((err) => setError(parseApiError(err)));
    loadUsers();
  }, [loadMyKeys, loadUsers]);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordBusy(true);
    setError("");
    setMessage("");
    try {
      await api.changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setMessage("Password updated.");
      await refreshMe();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setPasswordBusy(false);
    }
  }

  async function handleCreateMyKey(e: FormEvent) {
    e.preventDefault();
    setKeysBusy(true);
    setError("");
    setMessage("");
    setNewKeyPlain("");
    try {
      const created = await api.createMyApiKey(keyName.trim() || "default");
      setNewKeyPlain(created.api_key);
      setMessage("API key created — copy it now; it won’t be shown again.");
      await loadMyKeys();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setKeysBusy(false);
    }
  }

  async function handleRevokeMyKey(keyId: string) {
    if (!confirm("Revoke this API key?")) return;
    setKeysBusy(true);
    setError("");
    try {
      await api.revokeMyApiKey(keyId);
      setMessage("API key revoked.");
      if (newKeyPlain) setNewKeyPlain("");
      await loadMyKeys();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setKeysBusy(false);
    }
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault();
    setCreateBusy(true);
    setError("");
    setMessage("");
    try {
      await api.createUser({
        email: createEmail.trim(),
        password: createPassword,
        full_name: createName.trim(),
        role: createRole,
        enabled: true,
      });
      setCreateEmail("");
      setCreateName("");
      setCreatePassword("");
      setCreateRole("user");
      setMessage("User created.");
      await loadUsers();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setCreateBusy(false);
    }
  }

  async function handleToggleUser(u: AuthUser) {
    setError("");
    try {
      await api.updateUser(u.id, { enabled: !u.enabled });
      setMessage(`${u.enabled ? "Disabled" : "Enabled"} ${u.email}.`);
      await loadUsers();
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function handleDeleteUser(u: AuthUser) {
    if (!confirm(`Delete user “${u.email}”? This also removes their API keys.`))
      return;
    setError("");
    try {
      await api.deleteUser(u.id);
      if (selectedUserId === u.id) {
        setSelectedUserId(null);
        setUserKeys([]);
      }
      setMessage(`Deleted ${u.email}.`);
      await loadUsers();
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function selectUser(u: AuthUser) {
    setSelectedUserId(u.id);
    setUserKeyPlain("");
    setError("");
    try {
      const res = await api.listUserApiKeys(u.id);
      setUserKeys(res.keys);
    } catch (err) {
      setError(parseApiError(err));
      setUserKeys([]);
    }
  }

  async function handleCreateUserKey(e: FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;
    setError("");
    setUserKeyPlain("");
    try {
      const created = await api.createUserApiKey(
        selectedUserId,
        userKeyName.trim() || "default",
      );
      setUserKeyPlain(created.api_key);
      setMessage("User API key created — copy it now.");
      const res = await api.listUserApiKeys(selectedUserId);
      setUserKeys(res.keys);
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function handleRevokeUserKey(keyId: string) {
    if (!selectedUserId) return;
    if (!confirm("Revoke this API key?")) return;
    try {
      await api.revokeUserApiKey(selectedUserId, keyId);
      setMessage("API key revoked.");
      setUserKeyPlain("");
      const res = await api.listUserApiKeys(selectedUserId);
      setUserKeys(res.keys);
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  const selectedUser = users.find((u) => u.id === selectedUserId) || null;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col overflow-hidden px-3 pb-3 pt-2 sm:px-4">
      <div className="mb-3 shrink-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-[#1d1d1f]">
          Auth
        </h1>
        <p className="mt-0.5 text-[13px] text-[#86868b]">
          Account, API keys, and user management — separate from RAG Settings.
        </p>
      </div>

      {(error || message) && (
        <p
          className={`mb-2 shrink-0 text-[13px] ${
            error ? "text-[#ff3b30]" : "text-[#34c759]"
          }`}
        >
          {error || message}
        </p>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-2">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
              Your account
            </h2>
            {user && (
              <dl className="mt-3 space-y-2 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#86868b]">Email</dt>
                  <dd className="font-medium text-[#1d1d1f]">{user.email}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#86868b]">Name</dt>
                  <dd className="font-medium text-[#1d1d1f]">
                    {user.full_name || "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#86868b]">Role</dt>
                  <dd className="font-medium uppercase tracking-wide text-[#1d1d1f]">
                    {user.role}
                  </dd>
                </div>
              </dl>
            )}

            <form onSubmit={handleChangePassword} className="mt-5 space-y-3">
              <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
                Change password
              </h3>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="apple-input"
                placeholder="Current password"
                required
                disabled={passwordBusy}
              />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="apple-input"
                placeholder="New password (min 8)"
                minLength={8}
                required
                disabled={passwordBusy}
              />
              <button
                type="submit"
                disabled={passwordBusy}
                className="apple-btn-primary w-full !text-[13px]"
              >
                {passwordBusy ? "Updating…" : "Update password"}
              </button>
            </form>
          </Card>

          <Card>
            <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
              Your API keys
            </h2>
            <p className="mt-1 text-[12px] text-[#86868b]">
              Use as <code className="text-[11px]">Authorization: Bearer cav_…</code>{" "}
              or <code className="text-[11px]">X-API-Key</code>.
            </p>

            <form
              onSubmit={handleCreateMyKey}
              className="mt-4 flex flex-wrap gap-2"
            >
              <input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="apple-input min-w-0 flex-1 !py-2"
                placeholder="Key name"
                disabled={keysBusy}
              />
              <button
                type="submit"
                disabled={keysBusy}
                className="apple-btn-primary !px-4 !py-2 !text-[13px]"
              >
                Create key
              </button>
            </form>

            {newKeyPlain && (
              <div className="mt-3 rounded-[2px] bg-[#f5f5f7] px-3 py-2">
                <p className="text-[11px] font-medium text-[#86868b]">
                  New key (copy now)
                </p>
                <p className="mt-1 break-all font-mono text-[12px] text-[#1d1d1f]">
                  {newKeyPlain}
                </p>
              </div>
            )}

            <ul className="mt-4 divide-y divide-black/[0.06]">
              {myKeys.length === 0 ? (
                <li className="py-3 text-[13px] text-[#86868b]">No keys yet.</li>
              ) : (
                myKeys.map((key) => (
                  <li
                    key={key.id}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-[#1d1d1f]">
                        {key.name}{" "}
                        <span className="font-mono text-[11px] text-[#86868b]">
                          {key.prefix}…
                        </span>
                      </p>
                      <p className="text-[11px] text-[#aeaeb2]">
                        Created {formatDate(key.created_at)}
                        {key.last_used_at
                          ? ` · last used ${formatDate(key.last_used_at)}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={keysBusy}
                      onClick={() => handleRevokeMyKey(key.id)}
                      className="shrink-0 text-[12px] font-medium text-[#ff3b30] hover:underline"
                    >
                      Revoke
                    </button>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>

        {isAdmin && (
          <Card className="!p-0 overflow-hidden">
            <div className="border-b border-black/[0.06] px-6 py-4">
              <h2 className="text-[15px] font-semibold text-[#1d1d1f]">
                Users
              </h2>
              <p className="mt-0.5 text-[12px] text-[#86868b]">
                {isSuper
                  ? "Superadmin can create admins and users."
                  : "Admins can create and manage users (role=user)."}
              </p>
            </div>

            <form
              onSubmit={handleCreateUser}
              className="grid gap-3 border-b border-black/[0.06] px-6 py-4 sm:grid-cols-2 lg:grid-cols-5"
            >
              <input
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                className="apple-input !py-2"
                placeholder="Email"
                type="email"
                required
                disabled={createBusy}
              />
              <input
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="apple-input !py-2"
                placeholder="Full name"
                disabled={createBusy}
              />
              <input
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
                className="apple-input !py-2"
                placeholder="Password (min 8)"
                type="password"
                minLength={8}
                required
                disabled={createBusy}
              />
              <select
                value={createRole}
                onChange={(e) =>
                  setCreateRole(
                    e.target.value as "user" | "admin" | "superadmin",
                  )
                }
                className="apple-input !py-2"
                disabled={createBusy}
              >
                <option value="user">user</option>
                {isSuper && <option value="admin">admin</option>}
                {isSuper && <option value="superadmin">superadmin</option>}
              </select>
              <button
                type="submit"
                disabled={createBusy}
                className="apple-btn-primary !py-2 !text-[13px]"
              >
                {createBusy ? "Creating…" : "Add user"}
              </button>
            </form>

            <div className="grid min-h-[280px] lg:grid-cols-[1fr_320px]">
              <div className="min-h-0 overflow-y-auto">
                {usersLoading ? (
                  <p className="px-6 py-8 text-center text-[13px] text-[#86868b]">
                    Loading users…
                  </p>
                ) : users.length === 0 ? (
                  <p className="px-6 py-8 text-center text-[13px] text-[#86868b]">
                    No users found.
                  </p>
                ) : (
                  <ul className="divide-y divide-black/[0.06]">
                    {users.map((u) => (
                      <li
                        key={u.id}
                        className={`flex flex-wrap items-center justify-between gap-2 px-6 py-3 ${
                          selectedUserId === u.id ? "bg-[#8b0d64]/05" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => selectUser(u)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-[14px] font-medium text-[#1d1d1f]">
                            {u.email}
                          </p>
                          <p className="text-[12px] text-[#86868b]">
                            {u.full_name || "—"} ·{" "}
                            <span className="uppercase">{u.role}</span>
                            {!u.enabled ? " · disabled" : ""}
                          </p>
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleUser(u)}
                            className="apple-btn-secondary !px-2.5 !py-1 !text-[11px]"
                          >
                            {u.enabled ? "Disable" : "Enable"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="rounded-[2px] px-2.5 py-1 text-[11px] font-medium text-[#ff3b30] hover:bg-[#ff3b30]/10"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="border-t border-black/[0.06] px-5 py-4 lg:border-l lg:border-t-0">
                <h3 className="text-[13px] font-semibold text-[#1d1d1f]">
                  User API keys
                </h3>
                {!selectedUser ? (
                  <p className="mt-2 text-[12px] text-[#86868b]">
                    Select a user to manage their keys.
                  </p>
                ) : (
                  <>
                    <p className="mt-1 truncate text-[12px] text-[#86868b]">
                      {selectedUser.email}
                    </p>
                    <form
                      onSubmit={handleCreateUserKey}
                      className="mt-3 flex gap-2"
                    >
                      <input
                        value={userKeyName}
                        onChange={(e) => setUserKeyName(e.target.value)}
                        className="apple-input min-w-0 flex-1 !py-1.5 !text-[13px]"
                        placeholder="Key name"
                      />
                      <button
                        type="submit"
                        className="apple-btn-primary !px-3 !py-1.5 !text-[12px]"
                      >
                        Create
                      </button>
                    </form>
                    {userKeyPlain && (
                      <p className="mt-2 break-all rounded-[2px] bg-[#f5f5f7] px-2 py-2 font-mono text-[11px] text-[#1d1d1f]">
                        {userKeyPlain}
                      </p>
                    )}
                    <ul className="mt-3 space-y-2">
                      {userKeys.length === 0 ? (
                        <li className="text-[12px] text-[#86868b]">No keys.</li>
                      ) : (
                        userKeys.map((key) => (
                          <li
                            key={key.id}
                            className="flex items-start justify-between gap-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-medium text-[#1d1d1f]">
                                {key.name}{" "}
                                <span className="font-mono text-[#86868b]">
                                  {key.prefix}…
                                </span>
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRevokeUserKey(key.id)}
                              className="shrink-0 text-[11px] text-[#ff3b30]"
                            >
                              Revoke
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  </>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
