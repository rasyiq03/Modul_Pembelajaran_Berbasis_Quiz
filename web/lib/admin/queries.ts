import { createSupabaseServer } from '@/lib/supabase/server';

export async function adminStats() {
  const supabase = createSupabaseServer();
  const [courses, materials, questions, quizzes, enrollments, attempts, sessions, participants] = await Promise.all([
    supabase.from('courses').select('*', { count: 'exact', head: true }),
    supabase.from('materials').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('questions').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('quizzes').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    supabase.from('enrollments').select('*', { count: 'exact', head: true }).eq('revoked', false),
    supabase.from('quiz_attempts').select('*', { count: 'exact', head: true }).eq('status', 'graded').eq('is_preview', false),
    supabase.from('quiz_sessions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('quiz_participants').select('*', { count: 'exact', head: true }),
  ]);
  return {
    courses: courses.count ?? 0,
    publishedMaterials: materials.count ?? 0,
    publishedQuestions: questions.count ?? 0,
    publishedQuizzes: quizzes.count ?? 0,
    activeEnrollments: enrollments.count ?? 0,
    gradedAttempts: attempts.count ?? 0,
    activeSessions: sessions.count ?? 0,
    participants: participants.count ?? 0,
  };
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
    .select('id, title, slug, status, display_order, course_id, preview_path, content_path, source_file, description, learning_objectives, updated_at, courses(id, title, slug), material_tags(tag)')
    .order('updated_at', { ascending: false });
  return (data as unknown as Array<{
    id: string; title: string; slug: string; status: string; display_order: number;
    course_id: string; preview_path: string | null; content_path: string | null; source_file: string | null;
    description: string | null; learning_objectives: string | null; material_tags: { tag: string }[];
    updated_at: string;
    courses: { id: string; title: string; slug: string } | null;
  }>) ?? [];
}

export async function adminListKeys() {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('enrollment_keys')
    .select('id, key_prefix, material_id, expires_at, max_uses, uses_count, revoked, note, created_at, materials(title)')
    .order('created_at', { ascending: false });
  return (data as unknown as Array<{
    id: string; key_prefix: string; material_id: string; expires_at: string | null;
    max_uses: number | null; uses_count: number; revoked: boolean; note: string | null;
    created_at: string;
    materials: { title: string } | null;
  }>) ?? [];
}

export async function adminListEnrollments() {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from('enrollments')
    .select('id, user_id, material_id, source, created_at, revoked, materials(title), profiles(email)')
    .order('created_at', { ascending: false });
  return (data as unknown as Array<{
    id: string; user_id: string; material_id: string; source: string | null;
    created_at: string; revoked: boolean;
    materials: { title: string } | null;
    profiles: { email: string } | null;
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
