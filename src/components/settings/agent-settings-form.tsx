"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { saveSettings } from "@/lib/actions/user-settings";
import { type UserSettingsInput, userSettingsSchema } from "@/lib/validations/user-settings";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";

const sourceOptions: Array<UserSettingsInput["preferredSources"][number]> = [
  "Rightmove",
  "Zoopla",
  "OnTheMarket",
  "Referral",
  "Direct",
];

export function AgentSettingsForm({ initialValues }: { initialValues: UserSettingsInput }) {
  const router = useRouter();
  const form = useForm<UserSettingsInput>({
    resolver: zodResolver(userSettingsSchema),
    defaultValues: initialValues,
  });

  const isSubmitting = form.formState.isSubmitting;

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

  return (
    <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
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
            <Input id="minLeadScore" type="number" min={1} max={100} {...form.register("minLeadScore")} />
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

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}

