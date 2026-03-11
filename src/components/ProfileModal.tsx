"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Mail, Stethoscope, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-client";
import { useApiClient } from "@/lib/use-api-client";
import { useAuthorizedFetch } from "@/lib/use-authorized-fetch";
import { useQuery } from "@tanstack/react-query";
import { ROLE_LABELS } from "@/lib/roles";

type ProfileModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProfileModal({ open, onOpenChange }: ProfileModalProps) {
  const { user } = useAuth();
  const { doctorsApi } = useApiClient();
  const authorizedFetch = useAuthorizedFetch();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: doctors = [] } = useQuery({
    queryKey: ["doctors"],
    queryFn: () => doctorsApi.getAll(),
    enabled: open && !!user,
  });

  const connectedDoctor = user?.doctorId
    ? doctors.find((d) => d.id === user.doctorId)
    : null;

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open]);

  const passwordsMatch = newPassword === confirmPassword;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    passwordsMatch;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSaving(true);
    try {
      const response = await authorizedFetch("/api/auth/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Fehler beim Ändern des Passworts");
      }

      toast.success("Passwort erfolgreich geändert");
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fehler beim Ändern des Passworts");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md min-w-0">
        <DialogHeader>
          <DialogTitle>Profil</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic info section */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">E-Mail</p>
                <p className="truncate text-sm font-medium">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Rolle</p>
                <p className="text-sm font-medium">{user?.role ? ROLE_LABELS[user.role] : "—"}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Stethoscope className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Verbundener Arzt</p>
                <p className="text-sm font-medium">
                  {connectedDoctor ? connectedDoctor.name : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Password section */}
          {!showPasswordForm ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowPasswordForm(true)}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              Passwort ändern
            </Button>
          ) : (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="current-password">Aktuelles Passwort</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="new-password">Neues Passwort</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {newPassword.length > 0 && newPassword.length < 8 && (
                  <p className="text-xs text-destructive">
                    Mindestens 8 Zeichen erforderlich
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="confirm-password">Passwort bestätigen</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-destructive">
                    Passwörter stimmen nicht überein
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="submit"
                  className="w-full sm:flex-1"
                  disabled={!canSubmit || isSaving}
                >
                  {isSaving ? "Wird gespeichert..." : "Speichern"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:flex-1"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Abbrechen
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
