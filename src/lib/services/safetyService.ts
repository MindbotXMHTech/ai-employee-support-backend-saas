import OpenAI from "openai";
import { env } from "@/lib/env";
import { getTenantAiSettings } from "@/lib/services/platformAiSettingsService";
import type { HandoffPayload, SafetyLevel } from "@/lib/types";

const crisisKeywords = [
  "ฆ่าตัวตาย",
  "ทำร้ายตัวเอง",
  "ไม่อยากมีชีวิต",
  "อยากตาย",
  "suicide",
  "kill myself",
  "self harm",
  "end my life",
];

const highKeywords = ["สิ้นหวัง", "ไม่ไหวแล้ว", "hopeless", "panic", "ทำร้าย"];
const mediumKeywords = ["เครียดมาก", "หมดไฟ", "burnout", "depressed", "anxious"];

export function classifySafetyLevelRuleBased(message: string): SafetyLevel {
  const normalized = message.toLowerCase();
  if (crisisKeywords.some((keyword) => normalized.includes(keyword))) return "crisis";
  if (highKeywords.some((keyword) => normalized.includes(keyword))) return "high";
  if (mediumKeywords.some((keyword) => normalized.includes(keyword))) return "medium";
  return "normal";
}

export async function classifySafetyLevel(message: string, tenantId: string): Promise<SafetyLevel> {
  const level = classifySafetyLevelRuleBased(message);
  if (level !== "normal" || !env.OPENAI_API_KEY) return level;

  const settings = await getTenantAiSettings(tenantId);
  if (!settings.safety_enabled) return level;

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: settings.safety_model,
    input: [
      {
        role: "system",
        content: "Classify safety risk as exactly one of: normal, medium, high, crisis. Return only the label.",
      },
      { role: "user", content: message },
    ],
  });
  const output = response.output_text.trim() as SafetyLevel;
  return ["normal", "medium", "high", "crisis"].includes(output) ? output : level;
}

export function crisisResponse() {
  return "ฟังดูเหมือนตอนนี้คุณกำลังอยู่ในภาวะที่หนักมาก และความปลอดภัยของคุณสำคัญที่สุดนะครับ/ค่ะ หากคุณมีความคิดจะทำร้ายตัวเองหรือรู้สึกว่าอาจไม่ปลอดภัย กรุณาติดต่อคนใกล้ตัวทันที หรือขอความช่วยเหลือฉุกเฉินในพื้นที่ของคุณตอนนี้ ผม/ฉันอยู่ตรงนี้เพื่อช่วยคุยต่อ แต่เรื่องนี้ควรมีคนจริงเข้ามาช่วยทันที";
}

export function buildHandoff(settings?: {
  enabled?: boolean | null;
  handoff_url?: string | null;
  handoff_button_text?: string | null;
  emergency_message?: string | null;
}): HandoffPayload {
  return {
    enabled: Boolean(settings?.enabled),
    url: settings?.handoff_url ?? null,
    button_text: settings?.handoff_button_text ?? null,
    message: settings?.emergency_message ?? null,
  };
}
