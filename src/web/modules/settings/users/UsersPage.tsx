/**
 * UsersSection — user management panel in Settings dialog.
 *
 * Lists all users, allows create/edit/delete/reset-password.
 * Data fetched locally (dialog-level) per coding rules.
 */

import { PenNewSquare, Restart, TrashBinMinimalistic, UserPlus } from "@solar-icons/react";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "src/common/api";
import type { User } from "src/common/types";
import RenderIf from "src/components/ui/RenderIf";
import { Button } from "src/components/ui/button";
import { SimpleDialog } from "src/components/ui/dialog";
import { Input } from "src/components/ui/input";
import { Field } from "src/components/ui/label";
import { Select } from "src/components/ui/select";
import { toast } from "src/components/ui/toast";

// ─── Role badge ──────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<string, string> = {
  admin: "bg-[#e8a849]/15 text-[#b07c2e] border-[#e8a849]/25",
  member: "bg-border text-muted border-border-hover",
};

function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={[
        "inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border",
        ROLE_STYLES[role] ?? ROLE_STYLES.member,
      ].join(" ")}
    >
      {role}
    </span>
  );
}

// ─── User Form Dialog ────────────────────────────────────────────────────────

interface UserFormProps {
  user?: User | null;
  onClose: () => void;
  onSaved: () => void;
}

function UserFormDialog({ user, onClose, onSaved }: UserFormProps) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    username: user?.username ?? "",
    email: user?.email ?? "",
    name: user?.name ?? "",
    password: "",
    role: user?.role ?? "member",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      if (isEdit) {
        await apiClient.put(`/api/users/${user.id}`, {
          username: form.username,
          email: form.email,
          name: form.name,
          role: form.role,
        });
        toast.success(`User ${form.username} updated`);
      } else {
        await apiClient.post("/api/users", {
          username: form.username,
          email: form.email,
          name: form.name,
          password: form.password,
          role: form.role,
        });
        toast.success(`User ${form.username} created`);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  const roleOptions = [
    { value: "member", label: "Member" },
    { value: "admin", label: "Admin" },
  ];

  return (
    <SimpleDialog
      open
      onClose={onClose}
      title={isEdit ? "Edit User" : "Add User"}
      icon={isEdit ? <PenNewSquare size={16} /> : <UserPlus size={16} />}
      width={440}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} loading={saving}>
            {isEdit ? "Save" : "Create"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <Field label="Username" required>
          <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="john_doe" />
        </Field>

        <Field label="Email" required>
          <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
        </Field>

        <Field label="Name" required>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Doe" />
        </Field>

        <RenderIf condition={!isEdit}>
          <Field label="Password" required>
            <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 8 characters" />
          </Field>
        </RenderIf>

        <Field label="Role" required>
          <Select value={form.role} onChange={(val) => setForm({ ...form, role: val as "admin" | "member" })} options={roleOptions} disabled={false} />
        </Field>

        <RenderIf condition={!!error}>
          <div className="px-3 py-2 rounded-lg bg-danger/10 border border-danger/20">
            <p className="text-xs text-danger font-medium">{error}</p>
          </div>
        </RenderIf>
      </form>
    </SimpleDialog>
  );
}

// ─── Reset Password Dialog ───────────────────────────────────────────────────

interface ResetPasswordDialogProps {
  user: User;
  onClose: () => void;
}

function ResetPasswordDialog({ user, onClose }: ResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleReset = async () => {
    setError("");
    setSaving(true);
    try {
      const result = await apiClient.post<{ password: string }>(`/api/users/${user.id}/reset-password`, {
        password: password || undefined,
      });
      setGeneratedPassword(result.password);
      toast.success(`Password reset for ${user.username}`);
    } catch (err: any) {
      setError(err.message || "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SimpleDialog
      open
      onClose={onClose}
      title={`Reset Password — ${user.username}`}
      icon={<Restart size={16} />}
      width={400}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          <RenderIf condition={!generatedPassword}>
            <Button variant="primary" size="sm" onClick={handleReset} loading={saving}>
              Reset Password
            </Button>
          </RenderIf>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <RenderIf condition={!generatedPassword}>
          <Field label="New Password" optional>
            <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to auto-generate" />
          </Field>
        </RenderIf>

        <RenderIf condition={!!generatedPassword}>
          {() => (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-soft">
                New password for <strong>{user.username}</strong>:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-surface-raised border border-border font-mono text-sm text-main select-all">
                  {generatedPassword}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedPassword);
                    toast.success("Password copied to clipboard");
                  }}
                >
                  Copy
                </Button>
              </div>
              <p className="text-[10px] text-muted mt-1">Make sure to save this password. It won't be shown again.</p>
            </div>
          )}
        </RenderIf>

        <RenderIf condition={!!error}>
          <div className="px-3 py-2 rounded-lg bg-danger/10 border border-danger/20">
            <p className="text-xs text-danger font-medium">{error}</p>
          </div>
        </RenderIf>
      </div>
    </SimpleDialog>
  );
}

// ─── Delete Confirm Dialog ───────────────────────────────────────────────────

interface DeleteConfirmProps {
  user: User;
  onClose: () => void;
  onDeleted: () => void;
}

function DeleteConfirmDialog({ user, onClose, onDeleted }: DeleteConfirmProps) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await apiClient.delete(`/api/users/${user.id}`);
      toast.success(`Deleted user ${user.username}`);
      onDeleted();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SimpleDialog
      open
      onClose={onClose}
      title="Delete User"
      icon={<TrashBinMinimalistic size={16} />}
      width={380}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      }
    >
      <p className="text-sm text-soft leading-relaxed">
        Are you sure you want to delete user <strong className="text-main">{user.username}</strong>? This action cannot be undone.
      </p>
    </SimpleDialog>
  );
}

// ─── Main Section ────────────────────────────────────────────────────────────

export function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.get<{ items: User[]; total: number }>("/api/users", { page: 1, limit: 100, sorts: "-createdAt" });
      setUsers(result.items);
    } catch {
      // ignore — likely not admin
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-main">User Management</h3>
          <p className="text-[11px] text-muted mt-0.5">
            {users.length} user{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button id="settings-add-user" variant="primary" size="sm" icon={<UserPlus width={11} height={11} />} onClick={() => setShowCreate(true)}>
          Add User
        </Button>
      </div>

      {/* User List */}
      <RenderIf condition={loading}>
        <div className="flex items-center justify-center h-32 gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </RenderIf>

      <RenderIf condition={!loading}>
        <div className="flex flex-col gap-1.5">
          {users.map((user) => (
            <div
              key={user.id}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-surface hover:border-border-hover transition-colors"
            >
              {/* Avatar initial */}
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary uppercase">{user.name?.charAt(0) || user.username.charAt(0)}</span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-main truncate">{user.name || user.username}</span>
                  <RoleBadge role={user.role} />
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-muted truncate">@{user.username}</span>
                  <span className="text-muted">·</span>
                  <span className="text-[11px] text-muted truncate">{user.email}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="sm" icon={<PenNewSquare width={12} height={12} />} onClick={() => setEditUser(user)} className="!px-1.5" />
                <Button variant="ghost" size="sm" icon={<Restart width={12} height={12} />} onClick={() => setResetUser(user)} className="!px-1.5" />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<TrashBinMinimalistic width={12} height={12} />}
                  onClick={() => setDeleteUser(user)}
                  className="!px-1.5 text-danger hover:text-danger"
                />
              </div>
            </div>
          ))}

          <RenderIf condition={users.length === 0}>
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-muted">No users found</p>
            </div>
          </RenderIf>
        </div>
      </RenderIf>

      {/* Dialogs */}
      <RenderIf condition={showCreate}>
        <UserFormDialog onClose={() => setShowCreate(false)} onSaved={fetchUsers} />
      </RenderIf>

      <RenderIf condition={!!editUser}>{() => <UserFormDialog user={editUser} onClose={() => setEditUser(null)} onSaved={fetchUsers} />}</RenderIf>

      <RenderIf condition={!!resetUser}>{() => <ResetPasswordDialog user={resetUser as User} onClose={() => setResetUser(null)} />}</RenderIf>

      <RenderIf condition={!!deleteUser}>
        {() => <DeleteConfirmDialog user={deleteUser as User} onClose={() => setDeleteUser(null)} onDeleted={fetchUsers} />}
      </RenderIf>
    </div>
  );
}
