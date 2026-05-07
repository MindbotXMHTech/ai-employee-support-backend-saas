"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { Textarea } from "@/components/ui/textarea";
import type { PlatformAiSettings } from "@/lib/services/platformAiSettingsService";

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: keyof Pick<
    PlatformAiSettings,
    "rag_enabled" | "mental_health_enabled" | "safety_enabled" | "handoff_enabled" | "classification_enabled"
  >;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="mt-1 h-4 w-4 rounded border-slate-300" />
      <span>
        <span className="block text-sm font-medium text-slate-950">{label}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </label>
  );
}

function LanguageCheckboxes({ defaultLanguage }: { defaultLanguage: string }) {
  const selected = new Set(defaultLanguage.split(",").map((language) => language.trim()).filter(Boolean));
  const thChecked = selected.size === 0 || selected.has("th");
  const enChecked = selected.has("en");

  return (
    <div className="space-y-2">
      <Label>Default Language</Label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
          <input name="default_language" type="checkbox" value="th" defaultChecked={thChecked} className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>
            <span className="block text-sm font-medium text-slate-950">ไทย</span>
            <span className="block text-xs text-slate-500">ตอบภาษาไทยเป็นค่าเริ่มต้น</span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3">
          <input name="default_language" type="checkbox" value="en" defaultChecked={enChecked} className="mt-1 h-4 w-4 rounded border-slate-300" />
          <span>
            <span className="block text-sm font-medium text-slate-950">English</span>
            <span className="block text-xs text-slate-500">Allow English as a default language</span>
          </span>
        </label>
      </div>
      <p className="text-xs text-slate-500">เลือกได้หนึ่งหรือทั้งสองภาษา ระบบจะยังตอบตามภาษาที่ผู้ใช้ถามเมื่อเหมาะสม</p>
    </div>
  );
}

export function PlatformAiSettingsForm({
  settings,
  modelOptions,
  actionPath = "/api/admin/platform-ai-settings",
  submitLabel = "Save Platform AI Settings",
}: {
  settings: PlatformAiSettings;
  modelOptions: string[];
  actionPath?: string;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const form = new FormData(event.currentTarget);
    const selectedLanguages = form.getAll("default_language").map(String);
    const payload = {
      name: String(form.get("name")),
      tone: String(form.get("tone")),
      default_language: selectedLanguages.length ? selectedLanguages.join(",") : "th",
      max_sentences: Number(form.get("max_sentences")),
      general_model: String(form.get("general_model")),
      rag_model: String(form.get("rag_model")),
      safety_model: String(form.get("safety_model")),
      embedding_model: String(form.get("embedding_model")),
      rag_enabled: form.has("rag_enabled"),
      mental_health_enabled: form.has("mental_health_enabled"),
      safety_enabled: form.has("safety_enabled"),
      handoff_enabled: form.has("handoff_enabled"),
      classification_enabled: form.has("classification_enabled"),
      system_instruction: String(form.get("system_instruction") ?? ""),
    };

    const response = await fetch(actionPath, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      setMessage(result?.error ?? "Unable to save platform AI settings.");
      return;
    }

    setMessage("Platform AI settings saved.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="name">Bot Name</Label>
        <Input id="name" name="name" defaultValue={settings.name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="tone">Tone</Label>
        <Input id="tone" name="tone" defaultValue={settings.tone} required />
      </div>
      <LanguageCheckboxes defaultLanguage={settings.default_language} />
      <div className="space-y-2">
        <Label htmlFor="max_sentences">Max Sentences</Label>
        <Input id="max_sentences" name="max_sentences" type="number" min={1} max={5} defaultValue={settings.max_sentences} required />
      </div>
      {[
        ["general_model", "General Support Model", settings.general_model],
        ["rag_model", "RAG Answer Model", settings.rag_model],
        ["safety_model", "Safety / Classification Model", settings.safety_model],
        ["embedding_model", "Embedding Model", settings.embedding_model],
      ].map(([name, label, value]) => (
        <div key={name} className="space-y-2">
          <Label htmlFor={name}>{label}</Label>
          <SelectNative id={name} name={name} defaultValue={value}>
            {modelOptions.map((model) => (
              <option key={`${name}-${model}`} value={model}>
                {model}
              </option>
            ))}
          </SelectNative>
        </div>
      ))}
      <div className="grid gap-3 md:col-span-2 md:grid-cols-2">
        <Toggle name="rag_enabled" label="RAG answers" description="Use tenant knowledge base documents for policy and welfare questions." defaultChecked={settings.rag_enabled} />
        <Toggle name="mental_health_enabled" label="Wellbeing support" description="Allow short supportive workplace wellbeing replies." defaultChecked={settings.mental_health_enabled} />
        <Toggle name="safety_enabled" label="Safety classifier" description="Classify sensitive and crisis messages before answering." defaultChecked={settings.safety_enabled} />
        <Toggle name="handoff_enabled" label="Human handoff" description="Return handoff payloads when tenant escalation settings are configured." defaultChecked={settings.handoff_enabled} />
        <Toggle name="classification_enabled" label="LLM classification fallback" description="Use the safety model when rules cannot confidently classify the message." defaultChecked={settings.classification_enabled} />
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="system_instruction">System Instruction</Label>
        <Textarea
          id="system_instruction"
          name="system_instruction"
          defaultValue={settings.system_instruction ?? ""}
          placeholder="Optional platform-admin instruction appended to this tenant's system prompts."
          rows={5}
        />
        <p className="text-xs text-slate-500">Only platform admins can edit this. Tenant admins cannot inject custom AI instructions.</p>
      </div>
      {message ? <p className="text-sm text-slate-500 md:col-span-2">{message}</p> : null}
      <Button type="submit" disabled={loading} className="md:col-span-2">
        {loading ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
