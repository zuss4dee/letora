"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";

import {
  deleteContractTemplate,
  getContractTemplates,
  setDefaultTemplate,
  uploadContractTemplate,
  type ContractTemplateRow,
} from "@/lib/actions/contract-templates";
import { saveUserSettings } from "@/lib/actions/user-settings";
import { type UserSettingsInput, userSettingsSchema } from "@/lib/validations/user-settings";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function AgentSettingsForm({
  initialValues,
  userId,
}: {
  initialValues: UserSettingsInput;
  userId: string;
}) {
  const router = useRouter();
  const form = useForm<UserSettingsInput>({
    resolver: zodResolver(userSettingsSchema) as Resolver<UserSettingsInput>,
    defaultValues: initialValues,
  });
  const [templates, setTemplates] = useState<ContractTemplateRow[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesEnabled, setTemplatesEnabled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const isSubmitting = form.formState.isSubmitting;

  async function loadTemplates() {
    if (!userId) return;
    setTemplatesLoading(true);
    const rows = await getContractTemplates(userId);
    setTemplates(rows);
    setTemplatesEnabled(rows.length > 0);
    setTemplatesLoading(false);
  }

  useEffect(() => {
    void loadTemplates();
  }, [userId]);

  async function onSubmit(values: UserSettingsInput) {
    const result = await saveUserSettings(values);
    if (!result.ok) {
      toast.error("Failed to save settings");
      return;
    }
    toast.success("Settings saved");
    router.refresh();
  }

  async function onUploadTemplate(file: File | null) {
    if (!file || !userId) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    const result = await uploadContractTemplate(fd, userId);
    setUploading(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Template uploaded.");
    await loadTemplates();
  }

  async function onSetDefault(templateId: string) {
    setActionLoadingId(templateId);
    const result = await setDefaultTemplate(templateId, userId);
    setActionLoadingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Default template updated.");
    await loadTemplates();
  }

  async function onDelete(templateId: string) {
    setActionLoadingId(templateId);
    const result = await deleteContractTemplate(templateId);
    setActionLoadingId(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Template deleted.");
    await loadTemplates();
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={form.handleSubmit(onSubmit)}>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Business profile</CardTitle>
          <CardDescription>How your business appears to tenants and in correspondence.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="businessName">Business name</Label>
              <Input
                id="businessName"
                placeholder="e.g. Manchester Lettings Ltd"
                {...form.register("businessName")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="landlordName">Landlord / contact name</Label>
              <Input
                id="landlordName"
                placeholder="e.g. Damilare Adeosun"
                {...form.register("landlordName")}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">Contact email</Label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="e.g. you@business.com"
                {...form.register("contactEmail")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactPhone">Contact phone</Label>
              <Input
                id="contactPhone"
                placeholder="e.g. 07700 900123"
                {...form.register("contactPhone")}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="businessAddress">Business address</Label>
            <Textarea
              id="businessAddress"
              placeholder="e.g. 12 King Street, Manchester"
              rows={3}
              {...form.register("businessAddress")}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="emailFromName">Email from name</Label>
            <Input
              id="emailFromName"
              placeholder="e.g. Damilare at Manchester Lettings"
              {...form.register("emailFromName")}
            />
            <p className="text-xs text-muted-foreground">
              The name shown in outgoing emails (sender display name).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Auto-send controls</CardTitle>
          <CardDescription>
            Choose which agent emails can send automatically without manual review.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 pt-4">
          <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="autoSendRentChaser" className="text-sm font-medium leading-none">
                Auto-send rent chaser emails
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically send overdue rent emails without review
              </p>
            </div>
            <Switch
              id="autoSendRentChaser"
              checked={form.watch("autoSendRentChaser")}
              onCheckedChange={(checked) =>
                form.setValue("autoSendRentChaser", checked, { shouldDirty: true })
              }
            />
          </div>
          <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="autoSendMaintenanceUpdates" className="text-sm font-medium leading-none">
                Auto-send maintenance update emails
              </Label>
              <p className="text-sm text-muted-foreground">
                Send AI-drafted maintenance updates to tenants and landlord
              </p>
            </div>
            <Switch
              id="autoSendMaintenanceUpdates"
              checked={form.watch("autoSendMaintenanceUpdates")}
              onCheckedChange={(checked) =>
                form.setValue("autoSendMaintenanceUpdates", checked, { shouldDirty: true })
              }
            />
          </div>
          <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="autoSendOnboardingEmails" className="text-sm font-medium leading-none">
                Auto-send tenant onboarding emails
              </Label>
              <p className="text-sm text-muted-foreground">
                Automatically send welcome emails to new tenants
              </p>
            </div>
            <Switch
              id="autoSendOnboardingEmails"
              checked={form.watch("autoSendOnboardingEmails")}
              onCheckedChange={(checked) =>
                form.setValue("autoSendOnboardingEmails", checked, { shouldDirty: true })
              }
            />
          </div>
          <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <Label htmlFor="autoSendLeadUpdates" className="text-sm font-medium leading-none">
                Auto-send lead update emails
              </Label>
              <p className="text-sm text-muted-foreground">
                Send qualification results to new leads automatically
              </p>
            </div>
            <Switch
              id="autoSendLeadUpdates"
              checked={form.watch("autoSendLeadUpdates")}
              onCheckedChange={(checked) =>
                form.setValue("autoSendLeadUpdates", checked, { shouldDirty: true })
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Agent preferences</CardTitle>
          <CardDescription>Rent chaser and lead qualifier defaults.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 pt-4">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold tracking-tight">Rent chaser</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label>Tone</Label>
                <Select
                  value={form.watch("rentChaserTone")}
                  onValueChange={(v) =>
                    form.setValue("rentChaserTone", v as UserSettingsInput["rentChaserTone"], {
                      shouldValidate: true,
                      shouldDirty: true,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional_firm">Professional & Firm</SelectItem>
                    <SelectItem value="friendly_reminder">Friendly Reminder</SelectItem>
                    <SelectItem value="formal_legal">Formal / Legal Tone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="firstChaseDays">First chase after (days)</Label>
                <Input
                  id="firstChaseDays"
                  type="number"
                  min={1}
                  max={30}
                  {...form.register("firstChaseDays", { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="emailSignoff">Email sign-off</Label>
              <Input
                id="emailSignoff"
                placeholder="e.g. Kind regards, Damilare"
                {...form.register("emailSignoff")}
              />
            </div>
            <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="includePaymentPlan" className="text-sm font-medium leading-none">
                  Include payment plan option
                </Label>
                <p className="text-sm text-muted-foreground">
                  Offer a structured payment plan when chasing overdue rent.
                </p>
              </div>
              <Switch
                id="includePaymentPlan"
                checked={form.watch("includePaymentPlan")}
                onCheckedChange={(checked) =>
                  form.setValue("includePaymentPlan", checked, { shouldDirty: true })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rentChaserInstructions">Custom instructions</Label>
              <Textarea
                id="rentChaserInstructions"
                placeholder="e.g. Always mention the bank details in the first email"
                rows={3}
                {...form.register("rentChaserInstructions")}
              />
              <p className="text-xs text-muted-foreground">Optional. Applied when drafting rent chaser emails.</p>
            </div>
          </div>

          <div className="space-y-4 border-t pt-6">
            <h3 className="text-sm font-semibold tracking-tight">Lead qualifier</h3>
            <div className="grid gap-2 md:max-w-xs">
              <Label htmlFor="minLeadScore">Minimum lead score to qualify</Label>
              <Input
                id="minLeadScore"
                type="number"
                min={0}
                max={100}
                {...form.register("minLeadScore", { valueAsNumber: true })}
              />
            </div>
            <div className="flex flex-row items-center justify-between gap-4 rounded-lg border border-border p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <Label htmlFor="disqualifyNoMovein" className="text-sm font-medium leading-none">
                  Disqualify leads with no move-in date
                </Label>
                <p className="text-sm text-muted-foreground">
                  Automatically disqualify when no move-in date is provided.
                </p>
              </div>
              <Switch
                id="disqualifyNoMovein"
                checked={form.watch("disqualifyNoMovein")}
                onCheckedChange={(checked) =>
                  form.setValue("disqualifyNoMovein", checked, { shouldDirty: true })
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="leadQualifierCriteria">Custom qualification criteria</Label>
              <Textarea
                id="leadQualifierCriteria"
                placeholder="e.g. Only qualify leads with income over £30,000"
                rows={3}
                {...form.register("leadQualifierCriteria")}
              />
              <p className="text-xs text-muted-foreground">Optional. Extra rules for the lead qualifier agent.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Contract templates</CardTitle>
          <CardDescription>
            Upload your own contract templates. The AI can use these as a base instead of generating from scratch.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4">
          <label
            htmlFor="contract-template-upload"
            className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50/60 p-8 text-center transition hover:bg-zinc-100/60 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/50"
          >
            <span className="text-sm font-medium">Drop a file here or click to upload</span>
            <span className="mt-1 text-xs text-muted-foreground">Accepted formats: .pdf, .docx</span>
            <input
              id="contract-template-upload"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => void onUploadTemplate(e.target.files?.[0] ?? null)}
              disabled={uploading}
            />
          </label>

          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <Checkbox
              id="use-template-base"
              checked={templatesEnabled}
              onCheckedChange={(checked) => setTemplatesEnabled(checked === true)}
            />
            <Label htmlFor="use-template-base">Use my template as base for AI drafting</Label>
          </div>

          {uploading ? <p className="text-sm text-muted-foreground">Uploading template...</p> : null}
          {templatesLoading ? <p className="text-sm text-muted-foreground">Loading templates...</p> : null}

          <div className="grid gap-2">
            {templates.length === 0 ? (
              <div className="rounded-md border border-border p-4 text-sm text-muted-foreground">
                No templates uploaded yet.
              </div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="flex flex-col gap-3 rounded-md border border-border p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="text-sm font-medium">{template.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      Uploaded{" "}
                      {template.createdAt
                        ? new Date(template.createdAt).toLocaleDateString("en-GB")
                        : "—"}
                      {template.isDefault ? " • Default" : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={template.isDefault || actionLoadingId === template.id}
                      onClick={() => void onSetDefault(template.id)}
                    >
                      Set as Default
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={actionLoadingId === template.id}
                      onClick={() => void onDelete(template.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
