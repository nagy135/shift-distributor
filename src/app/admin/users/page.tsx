"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { USER_ROLES, type UserRole } from "@/lib/roles";

type AdminUser = {
  id: number;
  email: string;
  role: UserRole;
  doctorId?: number | null;
  doctorName?: string | null;
  createdAt?: number | string | null;
};

type DoctorOption = {
  id: number;
  name: string;
};

const formatDate = (value?: number | string | null) => {
  if (!value) return "-";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString();
};

export default function AdminUsersPage() {
  const { user, accessToken, isLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [isDoctorsFetching, setIsDoctorsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [isDoctorDialogOpen, setIsDoctorDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");

  const canManage = user?.role === "admin";

  const loadUsers = useCallback(async () => {
    if (!accessToken) return;
    setIsFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as AdminUser[];
      setUsers(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load users");
    } finally {
      setIsFetching(false);
    }
  }, [accessToken]);

  const loadDoctors = useCallback(async () => {
    setIsDoctorsFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/doctors");
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const data = (await res.json()) as DoctorOption[];
      setDoctors(data.slice().sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      console.error(err);
      setError("Failed to load doctors");
    } finally {
      setIsDoctorsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (canManage && accessToken) {
      loadUsers();
      loadDoctors();
    }
  }, [canManage, accessToken, loadUsers, loadDoctors]);

  const handleRoleChange = async (userId: number, role: UserRole) => {
    if (!accessToken) return;
    setBusyUserId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const updated = (await res.json()) as Pick<AdminUser, "id" | "role">;
      setUsers((prev) =>
        prev.map((item) =>
          item.id === updated.id ? { ...item, role: updated.role } : item,
        ),
      );
    } catch (err) {
      console.error(err);
      setError("Failed to update role");
    } finally {
      setBusyUserId(null);
    }
  };

  const handleDelete = async (userId: number) => {
    if (!accessToken) return;
    const confirmed = window.confirm("Delete this user?");
    if (!confirmed) return;
    setBusyUserId(userId);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      setUsers((prev) => prev.filter((item) => item.id !== userId));
    } catch (err) {
      console.error(err);
      setError("Failed to delete user");
    } finally {
      setBusyUserId(null);
    }
  };

  const openDoctorDialog = (row: AdminUser) => {
    setSelectedUser(row);
    setSelectedDoctorId(row.doctorId ? String(row.doctorId) : "");
    setIsDoctorDialogOpen(true);
  };

  const handleDoctorSave = async () => {
    if (!accessToken || !selectedUser) return;
    if (!selectedDoctorId) return;
    setBusyUserId(selectedUser.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ doctorId: Number(selectedDoctorId) }),
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      const updated = (await res.json()) as Pick<
        AdminUser,
        "id" | "doctorId" | "doctorName"
      >;
      setUsers((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                doctorId: updated.doctorId ?? null,
                doctorName: updated.doctorName ?? null,
              }
            : item,
        ),
      );
      setIsDoctorDialogOpen(false);
    } catch (err) {
      console.error(err);
      setError("Failed to update doctor");
    } finally {
      setBusyUserId(null);
    }
  };

  if (!isLoading && !canManage) {
    return (
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Users</h2>
        <p className="text-sm text-muted-foreground">
          You do not have permission to view this page.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Users</h2>
          <p className="text-sm text-muted-foreground">
            Manage user roles and access.
          </p>
        </div>
        <Button onClick={loadUsers} disabled={isFetching}>
          Refresh
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}

      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Doctor</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((row) => {
              const isBusy = busyUserId === row.id;
              return (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3">
                    <Select
                      value={row.role}
                      onValueChange={(value) =>
                        handleRoleChange(row.id, value as UserRole)
                      }
                      disabled={isBusy}
                    >
                      <SelectTrigger size="sm">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {USER_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    {row.doctorName ? (
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => openDoctorDialog(row)}
                        disabled={isBusy}
                      >
                        {row.doctorName}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDoctorDialog(row)}
                        disabled={isBusy}
                      >
                        Connect doctor
                      </Button>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(row.id)}
                      disabled={isBusy}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && !isFetching && (
              <tr>
                <td
                  className="px-4 py-6 text-center text-muted-foreground"
                  colSpan={5}
                >
                  No users found.
                </td>
              </tr>
            )}
            {isFetching && users.length === 0 && (
              <tr>
                <td
                  className="px-4 py-6 text-center text-muted-foreground"
                  colSpan={5}
                >
                  Loading users...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isDoctorDialogOpen} onOpenChange={setIsDoctorDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Connect doctor</DialogTitle>
            <DialogDescription>
              Choose the doctor linked to this user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Select
              value={selectedDoctorId}
              onValueChange={setSelectedDoctorId}
              disabled={isDoctorsFetching || doctors.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isDoctorsFetching ? "Loading doctors..." : "Select doctor"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={String(doctor.id)}>
                    {doctor.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {doctors.length === 0 && !isDoctorsFetching && (
              <p className="text-sm text-muted-foreground">
                No doctors available.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsDoctorDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDoctorSave}
              disabled={
                !selectedDoctorId ||
                busyUserId === selectedUser?.id ||
                isDoctorsFetching ||
                doctors.length === 0
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
