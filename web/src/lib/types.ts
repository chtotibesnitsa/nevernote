export type ObligationType =
  | "homework" | "assignment" | "reading" | "quiz" | "test" | "exam"
  | "project_milestone" | "presentation" | "form" | "material" | "appointment";

export type ObligationStatus =
  | "needs_review" | "accepted" | "rejected" | "calendar_created" | "calendar_updated" | "needs_clarification";

export interface Course {
  id: string;
  name: string;
  short_name: string;
  teacher: string;
  color: string;
  meeting_keywords: string;
  typical_schedule: string;
}

export interface Meeting {
  id: string;
  external_wispr_id: string | null;
  course_id: string | null;
  source_type: "wispr_mcp" | "wispr_markdown" | "demo";
  title: string;
  started_at: string;
  ended_at: string | null;
  attendees_json: string;
  summary: string;
  notes?: string;
  transcript?: string;
  transcript_length?: number;
  processing_status: "pending" | "processing" | "done" | "error";
  processing_error: string | null;
  imported_at: string;
  updated_at: string;
  obligation_count?: number;
}

export interface Segment {
  id: string;
  meeting_id: string;
  speaker: string;
  started_at_offset: number | null;
  text: string;
  segment_index: number;
}

export interface Obligation {
  id: string;
  meeting_id: string;
  course_id: string | null;
  type: ObligationType;
  title: string;
  description: string;
  due_at: string | null;
  all_day: number;
  timezone: string;
  confidence: number;
  status: ObligationStatus;
  evidence_excerpt: string;
  evidence_segment_ids: string;
  raw_date_phrase: string;
  date_reasoning: string;
  provider_event_id: string | null;
  calendar_dirty: number;
  created_at: string;
  updated_at: string;
  meeting_title?: string;
  meeting_started_at?: string | null;
}

export type SignalCategory =
  | "assessment" | "assignment" | "reading" | "project" | "presentation"
  | "logistics" | "materials" | "deadline" | "schedule_change" | "future_mention";

/** A deterministic keyword/date hit from the transcript, awaiting human review. */
export interface Signal {
  id: string;
  meeting_id: string;
  segment_id: string;
  segment_index: number;
  category: SignalCategory;
  trigger_phrase: string;
  excerpt: string;
  date_phrase: string;
  resolved_date: string | null;
  score: number;
  status: "flagged" | "covered" | "dismissed" | "promoted";
  linked_obligation_id: string | null;
  created_at: string;
  meeting_title?: string;
  meeting_started_at?: string | null;
}

export interface EventPreview {
  calendar_id: string | null;
  google_status: "ready" | "select_calendar" | "not_connected" | "needs_server_config";
  payload: {
    summary: string;
    description: string;
    start: { date?: string; dateTime?: string; timeZone?: string };
    end: { date?: string; dateTime?: string; timeZone?: string };
  };
}

export interface Me {
  user_id: string;
  profile: { timezone: string; school_name: string; default_calendar_id: string; onboarding_done: boolean };
  counts: { meetings: number; pending_review: number; flagged_mentions: number };
  ai?: { available: boolean; keyword_count: number };
  courses: Course[];
  sync: { last_sync_at: string | null; last_success_at: string | null; last_error: string | null; imported_count: number; running: boolean };
  connections: {
    google: { status: "connected" | "not_connected" | "needs_server_config"; selected_calendar_id: string | null; connected_at: string | null };
    wispr: { status: "connected" | "not_connected"; host: string | null; tools: string[]; connected_at: string | null; env_url_present: boolean; long_lived: boolean | null };
  };
}

export interface ChatThread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  cited_meeting_ids: string;
  cited_segment_ids: string;
  created_at: string;
}

export interface Citation {
  segment_id: string;
  meeting_id: string;
  meeting_title: string;
  meeting_started_at: string;
  speaker: string;
  text: string;
}

/** A recording whose lines were fed to the coach as context for one answer. */
export interface ContextMeeting {
  meeting_id: string;
  title: string;
  started_at: string;
  lines: number;
}

export interface CoachReply {
  message: ChatMessageRow;
  citations: Citation[];
  mode: "model" | "keyword";
  context_meetings: ContextMeeting[];
  ai_available: boolean;
}

export interface Digest {
  period: "day" | "week";
  timezone: string;
  upcoming: (Obligation & { meeting_title: string })[];
  overdue: (Obligation & { meeting_title: string })[];
  unreviewed: (Obligation & { meeting_title: string })[];
  unclear: (Obligation & { meeting_title: string })[];
  not_on_calendar: (Obligation & { meeting_title: string })[];
}
