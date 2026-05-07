export type TenantPlan = "trial" | "pro";
export type TenantStatus = "active" | "suspended" | "expired";
export type UserRole = "platform_admin" | "tenant_admin";
export type MessageRole = "user" | "assistant" | "system";
export type MessageType =
  | "general"
  | "rag"
  | "mental_health"
  | "safety"
  | "crisis"
  | "out_of_scope"
  | "quota_exceeded";
export type SafetyLevel = "normal" | "medium" | "high" | "crisis";
export type RequestType = "general" | "rag" | "embedding" | "safety" | "classification" | "playground";
export type DocumentCategory = "benefits" | "welfare" | "leave_policy" | "insurance" | "hr_faq" | "other";
export type DocumentStatus = "uploaded" | "processing" | "ready" | "failed";
export type ClassificationCategory =
  | "welfare_rag"
  | "general_support"
  | "mental_health_support"
  | "mental_health_sensitive"
  | "crisis"
  | "out_of_scope";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  monthly_message_limit: number;
  storage_limit_mb: number;
  max_files: number;
  max_bots: number;
  created_at: string;
  updated_at?: string;
}

export interface BotSettings {
  id: string;
  tenant_id: string;
  name: string;
  tone: string | null;
  default_language: string;
  max_sentences: number;
  rag_enabled: boolean;
  mental_health_enabled: boolean;
  safety_enabled: boolean;
  handoff_enabled: boolean;
  is_active: boolean;
}

export interface QuotaSnapshot {
  plan: TenantPlan;
  used: number;
  limit: number;
  remaining: number;
}

export interface SourceDocument {
  document_name: string;
  category: DocumentCategory | null;
  section?: string | null;
  score?: number;
}

export interface HandoffPayload {
  enabled: boolean;
  url: string | null;
  button_text: string | null;
  message: string | null;
}

export interface ChatApiSuccessResponse {
  success: true;
  reply: string;
  message_type: MessageType;
  safety_level: SafetyLevel;
  conversation_id: string;
  sources: SourceDocument[];
  handoff_required: boolean;
  handoff: HandoffPayload;
  quota: QuotaSnapshot;
  debug?: {
    model_used?: string;
    request_type?: RequestType;
  };
}

export interface ChatApiErrorResponse {
  success: false;
  error: {
    code:
      | "INVALID_API_KEY"
      | "TENANT_SUSPENDED"
      | "TRIAL_EXPIRED"
      | "QUOTA_EXCEEDED"
      | "VALIDATION_ERROR"
      | "INTERNAL_ERROR";
    message: string;
  };
}

export type ChatApiResponse = ChatApiSuccessResponse | ChatApiErrorResponse;
