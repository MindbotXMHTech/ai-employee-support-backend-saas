import OpenAI from "openai";
import { env } from "@/lib/env";
import { getTenantAiSettings } from "@/lib/services/platformAiSettingsService";
import type { ClassificationCategory } from "@/lib/types";

const ragKeywords = [
  "สวัสดิการ",
  "ลาป่วย",
  "ลาคลอด",
  "ลาพักร้อน",
  "ประกัน",
  "เบิก",
  "ค่ารักษา",
  "hr",
  "policy",
  "benefit",
  "leave",
  "insurance",
  "welfare",
];

const supportKeywords = ["เครียด", "เหนื่อย", "หมดไฟ", "กดดัน", "ท้อ", "burnout", "stress", "anxious"];
const sensitiveKeywords = ["ไม่อยากอยู่", "สิ้นหวัง", "panic", "depress", "hopeless"];
const outOfScopeKeywords = ["หุ้น", "ลงทุน", "วินิจฉัย", "ยาอะไร", "เงินเดือนคนอื่น", "confidential", "diagnose"];

export function classifyMessageRuleBased(message: string): ClassificationCategory {
  const normalized = message.toLowerCase();
  if (sensitiveKeywords.some((keyword) => normalized.includes(keyword))) return "mental_health_sensitive";
  if (outOfScopeKeywords.some((keyword) => normalized.includes(keyword))) return "out_of_scope";
  if (ragKeywords.some((keyword) => normalized.includes(keyword))) return "welfare_rag";
  if (supportKeywords.some((keyword) => normalized.includes(keyword))) return "mental_health_support";
  return "general_support";
}

export async function classifyMessage(message: string, tenantId: string): Promise<ClassificationCategory> {
  const ruleResult = classifyMessageRuleBased(message);
  if (ruleResult !== "general_support" || !env.OPENAI_API_KEY) return ruleResult;

  const settings = await getTenantAiSettings(tenantId);
  if (!settings.classification_enabled) return ruleResult;

  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const response = await openai.responses.create({
    model: settings.safety_model,
    input: [
      {
        role: "system",
        content:
          "Classify the employee bot message into exactly one category: welfare_rag, general_support, mental_health_support, mental_health_sensitive, crisis, out_of_scope. Return only the category.",
      },
      { role: "user", content: message },
    ],
  });

  const output = response.output_text.trim() as ClassificationCategory;
  const allowed: ClassificationCategory[] = [
    "welfare_rag",
    "general_support",
    "mental_health_support",
    "mental_health_sensitive",
    "crisis",
    "out_of_scope",
  ];
  return allowed.includes(output) ? output : ruleResult;
}
