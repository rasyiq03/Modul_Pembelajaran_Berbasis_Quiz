// Tipe skema yang ditulis tangan, mengikuti supabase/migrations/2026102800*.sql.
// Relasi diketik longgar (any) agar select bertingkat tetap bisa dipakai tanpa file hasil generate.
// Bila Supabase CLI tersedia: `npx supabase gen types typescript --linked > lib/database.types.ts`.

export type QuestionType = 'single_choice' | 'multiple_select' | 'true_false' | 'short_answer' | 'essay' | 'matching' | 'ordering';
export type QuizMode = 'self_paced' | 'interactive_practice' | 'live_competition' | 'timed_assessment' | 'self_paced_assessment';
export type Status = 'draft' | 'published' | 'archived';
type Table<Row, Insert, Update = Partial<Insert>> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

export interface Database {
  public: {
    Tables: {
      profiles: Table<
        { id: string; email: string | null; display_name: string | null; role: 'student' | 'admin'; avatar_url: string | null; created_at: string; updated_at: string },
        { id: string },
        { display_name?: string | null; avatar_url?: string | null }
      >;
      audit_logs: Table<
        { id: string; actor_id: string | null; action: string; target: string | null; detail: any; created_at: string },
        never, never
      >;
      courses: Table<
        { id: string; title: string; slug: string; description: string | null; cover_url: string | null; status: Status; display_order: number; created_at: string; updated_at: string },
        { title: string; slug: string; description?: string | null; cover_url?: string | null; status?: Status; display_order?: number }
      >;
      materials: Table<
        {
          id: string; course_id: string; title: string; slug: string; description: string | null;
          learning_objectives: string | null; status: Status; display_order: number; thumbnail_url: string | null;
          preview_path: string | null; content_path: string | null; content_assets: any; source_file: string | null;
          created_at: string; updated_at: string;
        },
        {
          id?: string; course_id: string; title: string; slug: string; description?: string | null; learning_objectives?: string | null;
          status?: Status; display_order?: number; thumbnail_url?: string | null; preview_path?: string | null;
          content_path?: string | null; content_assets?: any; source_file?: string | null;
        }
      >;
      material_tags: Table<{ id: string; material_id: string; tag: string }, { material_id: string; tag: string }>;
      enrollment_keys: Table<
        {
          id: string; material_id: string; key_hash: string; key_prefix: string; expires_at: string | null;
          max_uses: number | null; uses_count: number; revoked: boolean; note: string | null; created_by: string | null; created_at: string;
        },
        never,
        { revoked?: boolean; note?: string | null; expires_at?: string | null; max_uses?: number | null }
      >;
      enrollments: Table<
        {
          id: string; user_id: string; material_id: string; source: string; key_id: string | null;
          revoked: boolean; revoked_at: string | null; revoked_by: string | null; created_at: string;
        },
        never, never
      >;
      enrollment_redemptions: Table<{ id: string; key_id: string; user_id: string; material_id: string; created_at: string }, never, never>;
      questions: Table<
        {
          id: string; type: QuestionType; prompt: string; media_url: string | null; topic: string | null;
          difficulty: 'easy' | 'medium' | 'hard' | null; status: Status; source_ref: string | null;
          created_by: string | null; created_at: string; updated_at: string;
        },
        {
          id?: string; type: QuestionType; prompt: string; media_url?: string | null; topic?: string | null;
          difficulty?: 'easy' | 'medium' | 'hard' | null; status?: Status; source_ref?: string | null; created_by?: string | null;
        }
      >;
      question_options: Table<
        { id: string; question_id: string; key: string; label: string; side: 'left' | 'right' | null; display_order: number },
        { question_id: string; key: string; label: string; side?: 'left' | 'right' | null; display_order?: number }
      >;
      question_keys: Table<
        { question_id: string; answer: any; explanation: string | null },
        { question_id: string; answer: any; explanation?: string | null }
      >;
      question_materials: Table<{ question_id: string; material_id: string }, { question_id: string; material_id: string }>;
      question_tags: Table<{ question_id: string; tag: string }, { question_id: string; tag: string }>;
      quizzes: Table<
        { id: string; title: string; description: string | null; mode: QuizMode; settings: any; status: Status; created_by: string | null; created_at: string; updated_at: string },
        { id?: string; title: string; description?: string | null; mode?: QuizMode; settings?: any; status?: Status; created_by?: string | null }
      >;
      quiz_questions: Table<
        { quiz_id: string; question_id: string; display_order: number; points: number },
        { quiz_id: string; question_id: string; display_order?: number; points?: number }
      >;
      quiz_attempts: Table<
        {
          id: string; quiz_id: string; user_id: string; is_guest: boolean; is_preview: boolean; nickname: string | null;
          status: 'in_progress' | 'submitted' | 'graded'; started_at: string; deadline_at: string | null; finished_at: string | null;
          late: boolean; score: number; max_score: number; percent: number; passed: boolean;
          question_order: string[]; option_order: any; settings_snapshot: any;
        },
        never, never
      >;
      attempt_answers: Table<
        {
          id: string; attempt_id: string; question_id: string; question_snapshot: any; response: any;
          is_correct: boolean | null; points_awarded: number; max_points: number; graded_at: string | null; graded_by: string | null;
        },
        never, never
      >;
      quiz_sessions: Table<
        {
          id: string; quiz_id: string; code: string; status: 'waiting' | 'active' | 'completed' | 'cancelled';
          phase: 'lobby' | 'question' | 'reveal' | 'ended'; host_id: string | null; allow_guests: boolean;
          max_participants: number | null; show_leaderboard: boolean; question_order: string[]; question_time_sec: number;
          current_question_index: number; question_started_at: string | null; started_at: string | null; ended_at: string | null; created_at: string;
        },
        never, never
      >;
      quiz_participants: Table<
        {
          id: string; session_id: string; user_id: string; nickname: string; is_guest: boolean; score: number;
          correct_count: number; answered_count: number; streak: number; joined_at: string; last_seen_at: string;
        },
        never, never
      >;
      live_answers: Table<
        {
          id: string; session_id: string; participant_id: string; question_index: number; question_id: string;
          response: any; is_correct: boolean | null; points_awarded: number; time_ms: number; created_at: string;
        },
        never, never
      >;
    };
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_registered: { Args: Record<string, never>; Returns: boolean };
      has_material_access: { Args: { p_material: string }; Returns: boolean };
      set_user_role: { Args: { p_user: string; p_role: 'student' | 'admin' }; Returns: undefined };
      create_enrollment_key: { Args: { p_material: string; p_expires_at?: string | null; p_max_uses?: number | null; p_note?: string | null }; Returns: { id: string; key: string } };
      redeem_enrollment_key: { Args: { p_key: string }; Returns: { ok: boolean; error?: string; already?: boolean; material_id?: string; material_title?: string } };
      set_enrollment_revoked: { Args: { p_enrollment: string; p_revoked: boolean }; Returns: undefined };
      start_quiz_attempt: { Args: { p_quiz: string; p_nickname?: string | null }; Returns: any };
      check_practice_answer: { Args: { p_attempt: string; p_question: string; p_response: any }; Returns: any };
      submit_quiz_attempt: { Args: { p_attempt: string; p_responses: any }; Returns: any };
      get_attempt_result: { Args: { p_attempt: string }; Returns: any };
      grade_attempt_answer: { Args: { p_answer: string; p_points: number }; Returns: undefined };
      create_quiz_session: { Args: { p_quiz: string; p_settings?: any }; Returns: { session_id: string; code: string } };
      join_quiz_session: { Args: { p_code: string; p_nickname: string }; Returns: { session_id: string; participant_id: string; nickname: string; rejoined: boolean } };
      host_session_action: { Args: { p_session: string; p_action: 'start' | 'reveal' | 'next' | 'end' | 'cancel' }; Returns: any };
      get_session_state: { Args: { p_session: string }; Returns: any };
      submit_live_answer: { Args: { p_session: string; p_response: any }; Returns: { received: boolean; time_ms: number } };
      get_session_results: { Args: { p_session: string }; Returns: any };
    };
    Views: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
