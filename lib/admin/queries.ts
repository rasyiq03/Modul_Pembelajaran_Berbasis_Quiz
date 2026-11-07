import { createSupabaseServer } from '@/lib/supabase/server';
import type { AccessLevel, SubscriptionStatus } from '@/lib/database.types';

export async function adminStats() {
  const supabase = createSupabaseServer();
  const [courses, materials, questions, quizzes, subscribers, pending, attempts, sessions, participants, arena] = await Promise.all([
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('materials').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('quizzes').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
    pendingSubscriptionCount(),
    supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }).eq('status', 'graded').eq('is_preview', false),
    supabase.from('quiz_sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('quiz_participants').select('*', { count: 'exact', head: true }),
    supabase.from('arena_runs').select('*', { count: 'exact', head: true }).eq('status', 'finished').eq('is_preview', false),
  ]);
  return {
    courses: courses.count ?? 0,
    publishedMaterials: materials.count ?? 0,
    publishedQuestions: questions.count ?? 0,
    publishedQuizzes: quizzes.count ?? 0,
    activeSubscribers: subscribers.count ?? 0,
    pendingSubscriptions: pending,
    gradedAttempts: attempts.count ?? 0,
    activeSessions: sessions.count ?? 0,
    participants: participants.count ?? 0,
    arenaRuns: arena.count ?? 0,
  };
}

/** Pengajuan langganan yang menunggu keputusan admin (lencana di menu admin) */
export async function pendingSubscriptionCount() {
  const { count } = await createSupabaseServer().from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  return count ?? 0;
}

export async function adminListSubscriptions() {
  const { data } = await createSupabaseServer()
    .from('subscriptions')
    .select('id, user_id, status, message, admin_note, expires_at, reviewed_at, created_at, profiles(email, display_name)')
    .order('created_at', { ascending: false })
    .limit(1000);
  return (data as unknown as Array<{
    id: string; user_id: string; status: SubscriptionStatus; message: string | null; admin_note: string | null;
    expires_at: string | null; reviewed_at: string | null; created_at: string;
    profiles: { email: string | null; display_name: string | null } | null;
  }>) ?? [];
}

export async function avgScore() {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('quiz_attempts')
    .select('percent')
    .eq('status', 'graded')
    .eq('is_preview', false);
  if (!data || data.length === 0) return 0;
  const total = data.reduce((s: number, a) => s + (a as unknown as { percent: number }).percent, 0);
  return Math.round((total / data.length) * 10) / 10;
}

export async function recentAttempts(limit = 10) {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('quiz_attempts')
    .select('id, quiz_id, user_id, nickname, is_guest, score, max_score, percent, status, finished_at, quizzes(title)')
    .eq('is_preview', false)
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(limit);
  return (data as unknown as Array<{
    id: string; quiz_id: string; user_id: string; nickname: string | null; is_guest: boolean;
    score: number; max_score: number; percent: number; status: string;
    finished_at: string | null;
    quizzes: { title: string } | null;
  }>) ?? [];
}

export async function adminListCourses() {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('courses')
    .select('id, title, slug, description, status, display_order, created_at, updated_at')
    .order('display_order', { ascending: true });
  return (data as unknown as Array<{
    id: string; title: string; slug: string; description: string | null;
    status: string; display_order: number; created_at: string; updated_at: string;
  }>) ?? [];
}

export async function adminListMaterials() {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('materials')
    .select('id, title, slug, status, access_level, display_order, course_id, preview_path, content_path, source_file, description, learning_objectives, updated_at, courses(id, title, slug), material_tags(tag)')
    .order('updated_at', { ascending: false });
  return (data as unknown as Array<{
    id: string; title: string; slug: string; status: string; access_level: AccessLevel; display_order: number;
    course_id: string; preview_path: string | null; content_path: string | null; source_file: string | null;
    description: string | null; learning_objectives: string | null; material_tags: { tag: string }[];
    updated_at: string;
    courses: { id: string; title: string; slug: string } | null;
  }>) ?? [];
}

export async function adminListQuestions() {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('questions')
    .select('id, type, prompt, difficulty, status, updated_at, question_materials(material_id), question_options(id)')
    .order('updated_at', { ascending: false });
  return (data as unknown as Array<{
    id: string; type: string; prompt: string; difficulty: string | null;
    status: string; updated_at: string;
    question_materials: { material_id: string }[];
    question_options: { id: string }[];
  }>) ?? [];
}

export async function adminListQuizzes() {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('quizzes')
    .select('id, title, mode, status, updated_at, quiz_questions(question_id)')
    .order('updated_at', { ascending: false });
  return (data as unknown as Array<{
    id: string; title: string; mode: string; status: string; updated_at: string;
    quiz_questions: { question_id: string }[];
  }>) ?? [];
}

export async function adminListSessions() {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('quiz_sessions')
    .select('id, code, status, quiz_id, created_at, started_at, ended_at, quizzes(title), quiz_participants(id)')
    .order('created_at', { ascending: false });
  return (data as unknown as Array<{
    id: string; code: string; status: string; quiz_id: string;
    created_at: string; started_at: string | null; ended_at: string | null;
    quizzes: { title: string } | null;
    quiz_participants: { id: string }[];
  }>) ?? [];
}
