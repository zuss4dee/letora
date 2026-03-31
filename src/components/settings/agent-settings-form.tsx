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
import { saveSettings } from "@/lib/actions/user-settings";
import { type UserSettingsInput, userSettingsSchema } from "@/lib/validations/user-settings";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const sourceOptions: Array<UserSettingsInput["preferredSources"][number]> = [
  "Rightmove",
  "Zoopla",
  "OnTheMarket",
  "Referral",
  "Direct",
];

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

  function toggleSource(source: UserSettingsInput["preferredSources"][number], checked: boolean) {
    const current = form.getValues("preferredSources");
    const next = checked ? Array.from(new Set([...current, source])) : current.filter((s) => s !== source);
    form.setValue("preferredSources", next, { shouldDirty: true, shouldValidate: true });
  }

  async function onSubmit(values: UserSettingsInput) {
    const result = await saveSettings(values);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Settings saved successfully.");
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
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
      <Tabs defaultValue="agents" className="w-full gap-4">
        <TabsList className="grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="agents">Agents</TabsTrigger>
          <TabsTrigger value="email">Email &amp; Automation</TabsTrigger>
        </TabsList>

        <TabsContent value="agents" className="mt-0 flex flex-col gap-4 outline-none">
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Business Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input id="businessName" {...form.register("businessName")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="landlordName">Landlord Full Name</Label>
              <Input id="landlordName" {...form.register("landlordName")} />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="contactPhone">Contact Phone</Label>
              <Input id="contactPhone" {...form.register("contactPhone")} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="contactEmail">Contact Email</Label>
              <Input id="contactEmail" type="email" {...form.register("contactEmail")} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="businessAddress">Business Address</Label>
            <Textarea id="businessAddress" {...form.register("businessAddress")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Rent Chaser Agent Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Communication Tone</Label>
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
                  <SelectItem value="friendly_polite">Friendly & Polite</SelectItem>
                  <SelectItem value="formal_legal">Formal & Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>First Chase After</Label>
              <Select
                value={String(form.watch("firstChaseDays"))}
                onValueChange={(v) =>
                  form.setValue("firstChaseDays", Number(v), { shouldValidate: true, shouldDirty: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select interval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 day overdue</SelectItem>
                  <SelectItem value="3">3 days overdue</SelectItem>
                  <SelectItem value="7">7 days overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="emailSignoff">Email Sign-off</Label>
            <Input id="emailSignoff" {...form.register("emailSignoff")} />
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <Checkbox
              id="includePaymentPlan"
              checked={form.watch("includePaymentPlan")}
              onCheckedChange={(checked) =>
                form.setValue("includePaymentPlan", checked === true, { shouldDirty: true })
              }
            />
            <Label htmlFor="includePaymentPlan">
              Include payment plan offer for payments over 30 days?
            </Label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rentChaserInstructions">Custom Instructions</Label>
            <Textarea id="rentChaserInstructions" {...form.register("rentChaserInstructions")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Lead Qualifier Agent Settings</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-4">
          <div className="grid gap-2">
            <Label htmlFor="minLeadScore">Minimum acceptable lead score to auto-qualify</Label>
            <Input
              id="minLeadScore"
              type="number"
              min={1}
              max={100}
              {...form.register("minLeadScore", { valueAsNumber: true })}
            />
          </div>
          <div className="grid gap-2">
            <Label>Preferred tenant sources</Label>
            <div className="grid gap-2 md:grid-cols-2">
              {sourceOptions.map((source) => {
                const checked = form.watch("preferredSources").includes(source);
                return (
                  <div key={source} className="flex items-center gap-2 rounded-md border border-border p-2">
                    <Checkbox
                      id={`source-${source}`}
                      checked={checked}
                      onCheckedChange={(value) => toggleSource(source, value === true)}
                    />
                    <Label htmlFor={`source-${source}`}>{source}</Label>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-md border border-border p-3">
            <Checkbox
              id="disqualifyNoMovein"
              checked={form.watch("disqualifyNoMovein")}
              onCheckedChange={(checked) =>
                form.setValue("disqualifyNoMovein", checked === true, { shouldDirty: true })
              }
            />
            <Label htmlFor="disqualifyNoMovein">Disqualify if no move-in date provided?</Label>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="leadQualifierCriteria">Custom qualification criteria</Label>
            <Textarea id="leadQualifierCriteria" {...form.register("leadQualifierCriteria")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Contract Templates</CardTitle>
          <p className="text-sm text-muted-foreground">
            Upload your own contract templates. The AI will use these as a base instead of
            generating from scratch.
          </p>
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
        </TabsContent>

        <TabsContent value="email" className="mt-0 outline-none">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Email &amp; Automation</CardTitle>
              <p className="text-sm font-normal text-muted-foreground">
                Platform email uses your display name with the verified Letora sender address. Turn on
                auto-send per agent type when you are ready for emails to go out without review.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
              <div className="grid gap-2">
                <Label htmlFor="emailFromName">Display name (From)</Label>
                <Input
                  id="emailFromName"
                  placeholder="e.g. Smith Lettings"
                  {...form.register("emailFromName")}
                />
                <p className="text-xs text-muted-foreground">
                  Shown as the sender name; the email address is set by the platform.
                </p>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-border p-3">
                <Checkbox
                  id="autoSendRentChaser"
                  className="mt-0.5"
                  checked={form.watch("autoSendRentChaser")}
                  onCheckedChange={(checked) =>
                    form.setValue("autoSendRentChaser", checked === true, { shouldDirty: true })
                  }
                />
                <div className="grid gap-1">
                  <Label htmlFor="autoSendRentChaser">Rent chaser</Label>
                  <p className="text-xs text-muted-foreground">
                    Send rent reminder emails automatically after each run (when Resend is configured).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-border p-3">
                <Checkbox
                  id="autoSendMaintenanceUpdates"
                  className="mt-0.5"
                  checked={form.watch("autoSendMaintenanceUpdates")}
                  onCheckedChange={(checked) =>
                    form.setValue("autoSendMaintenanceUpdates", checked === true, { shouldDirty: true })
                  }
                />
                <div className="grid gap-1">
                  <Label htmlFor="autoSendMaintenanceUpdates">Maintenance updates</Label>
                  <p className="text-xs text-muted-foreground">
                    Reserved for maintenance agent emails (future).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-border p-3">
                <Checkbox
                  id="autoSendOnboardingEmails"
                  className="mt-0.5"
                  checked={form.watch("autoSendOnboardingEmails")}
                  onCheckedChange={(checked) =>
                    form.setValue("autoSendOnboardingEmails", checked === true, { shouldDirty: true })
                  }
                />
                <div className="grid gap-1">
                  <Label htmlFor="autoSendOnboardingEmails">Onboarding emails</Label>
                  <p className="text-xs text-muted-foreground">
                    Reserved for tenant onboarding flows (future).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-md border border-border p-3">
                <Checkbox
                  id="autoSendLeadUpdates"
                  className="mt-0.5"
                  checked={form.watch("autoSendLeadUpdates")}
                  onCheckedChange={(checked) =>
                    form.setValue("autoSendLeadUpdates", checked === true, { shouldDirty: true })
                  }
                />
                <div className="grid gap-1">
                  <Label htmlFor="autoSendLeadUpdates">Lead updates</Label>
                  <p className="text-xs text-muted-foreground">
                    Reserved for lead qualifier follow-ups (future).
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}

