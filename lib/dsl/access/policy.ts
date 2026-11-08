import type { AccessLevel } from '@/lib/database.types';
import type { ViewerTier } from '@/lib/access';
import { ACCESS_LEVEL_LABEL } from '@/lib/labels';

/**
 * Urutan keketatan akses (semakin tinggi angka = semakin ketat).
 * Digunakan untuk menentukan tingkat akses warisan saat kuis mencampur beberapa materi.
 */
export const ACCESS_RANK: Record<AccessLevel, number> = {
  public: 1,
  member: 2,
  subscriber: 3,
};

export interface MaterialMeta {
  id: string;
  title: string;
  course: string;
  access_level: AccessLevel;
}

export interface MaterialCoverageItem extends MaterialMeta {
  questionCount: number;
}

export interface QuizMaterialAnalysis {
  /** Daftar materi yang tercakup oleh soal-soal di dalam kuis */
  materials: MaterialCoverageItem[];
  /** Apakah kuis ini mencampur lebih dari satu materi */
  isMultiMaterial: boolean;
  /** Jumlah soal yang tidak tertaut ke materi mana pun */
  unassignedCount: number;
  /** Materi dengan tingkat akses paling ketat di dalam campuran */
  strictestMaterial: MaterialCoverageItem | null;
  /** Tingkat akses warisan dari materi (paling ketat) */
  inheritedLevel: AccessLevel;
  /** Tingkat akses efektif yang berlaku pada kuis */
  effectiveLevel: AccessLevel;
  /** Apakah akses kuis ditimpa manual oleh admin */
  isOverridden: boolean;
  /** Kalimat justifikasi singkat dan jelas mengenai asal-usul tingkat akses kuis */
  justification: string;
}

export interface ViewerAccessJustification {
  canTakeQuiz: boolean;
  canPlayArena: boolean;
  canSeeExplanations: boolean;
  quizStatusLabel: string;
  quizReason: string;
  explanationReason: string;
  arenaReason: string;
}

/**
 * Menghitung tingkat akses warisan dari daftar tingkat akses materi.
 * Prinsip: Mengambil tingkat paling ketat (max rank); jika kosong maka 'public'.
 */
export function resolveInheritedLevel(levels: AccessLevel[]): AccessLevel {
  return levels.reduce<AccessLevel>(
    (strictest, current) => (ACCESS_RANK[current] > ACCESS_RANK[strictest] ? current : strictest),
    'public',
  );
}

/**
 * Menganalisis komposisi materi pada kuis (mendukung pencampuran banyak materi)
 * sekaligus menghasilkan justifikasi tingkat akses yang jelas dan sederhana.
 */
export function analyzeQuizMaterials(
  quizQuestionIds: string[],
  questionMaterialMap: Map<string, string[]>,
  materialsList: MaterialMeta[],
  explicitAccessLevel: AccessLevel | null | undefined,
): QuizMaterialAnalysis {
  const matById = new Map(materialsList.map((m) => [m.id, m]));
  const counts = new Map<string, number>();
  let unassignedCount = 0;

  for (const qId of quizQuestionIds) {
    const mIds = questionMaterialMap.get(qId) ?? [];
    const validIds = mIds.filter((id) => matById.has(id));
    if (validIds.length === 0) {
      unassignedCount++;
    } else {
      for (const mId of validIds) {
        counts.set(mId, (counts.get(mId) ?? 0) + 1);
      }
    }
  }

  const materials: MaterialCoverageItem[] = Array.from(counts.entries())
    .map(([id, questionCount]) => ({
      ...matById.get(id)!,
      questionCount,
    }))
    .sort((a, b) => b.questionCount - a.questionCount || a.title.localeCompare(b.title));

  let strictestMaterial: MaterialCoverageItem | null = null;
  for (const item of materials) {
    if (!strictestMaterial || ACCESS_RANK[item.access_level] > ACCESS_RANK[strictestMaterial.access_level]) {
      strictestMaterial = item;
    }
  }

  const inheritedLevel: AccessLevel = strictestMaterial ? strictestMaterial.access_level : 'public';
  const isOverridden = explicitAccessLevel != null;
  const effectiveLevel: AccessLevel = explicitAccessLevel ?? inheritedLevel;
  const isMultiMaterial = materials.length > 1;

  let justification: string;
  if (isOverridden) {
    const baseLabel = ACCESS_LEVEL_LABEL[inheritedLevel];
    const overrideLabel = ACCESS_LEVEL_LABEL[effectiveLevel];
    justification =
      materials.length > 0
        ? `Ditetapkan manual sebagai "${overrideLabel}" (menimpa akses bawaan materi: "${baseLabel}").`
        : `Ditetapkan manual sebagai "${overrideLabel}".`;
  } else if (materials.length === 0) {
    justification = 'Belum ada materi terkait; akses kuis otomatis "Terbuka".';
  } else if (isMultiMaterial) {
    justification = `Mencampur ${materials.length} materi. Akses otomatis "${ACCESS_LEVEL_LABEL[inheritedLevel]}" mengikuti materi paling ketat (${strictestMaterial!.title}).`;
  } else {
    justification = `Mengikuti tingkat akses materi "${materials[0].title}" (${ACCESS_LEVEL_LABEL[inheritedLevel]}).`;
  }

  return {
    materials,
    isMultiMaterial,
    unassignedCount,
    strictestMaterial,
    inheritedLevel,
    effectiveLevel,
    isOverridden,
    justification,
  };
}

/**
 * Memberikan justifikasi akses yang jelas dan simpel dari sudut pandang pengguna (viewer).
 */
export function justifyViewerAccess(params: {
  effectiveLevel: AccessLevel;
  tier: ViewerTier;
  canTakeFromServer?: boolean;
  canSeeExplanationsFromServer?: boolean;
  allowGuests?: boolean;
  materialTitles?: string[];
}): ViewerAccessJustification {
  const {
    effectiveLevel,
    tier,
    canTakeFromServer,
    canSeeExplanationsFromServer,
    allowGuests = false,
    materialTitles = [],
  } = params;

  const canTakeByTier =
    tier === 'admin' ||
    effectiveLevel === 'public' ||
    (effectiveLevel === 'member' && tier !== 'guest') ||
    (effectiveLevel === 'subscriber' && tier === 'subscriber');

  const canTakeQuiz = canTakeFromServer ?? canTakeByTier;
  const canPlayArena = tier !== 'guest';
  const canSeeExplanations = canSeeExplanationsFromServer ?? (tier === 'subscriber' || tier === 'admin');

  const matInfo =
    materialTitles.length > 1
      ? `campuran ${materialTitles.length} materi`
      : materialTitles.length === 1
        ? `materi "${materialTitles[0]}"`
        : 'kuis ini';

  let quizStatusLabel: string;
  let quizReason: string;

  if (canTakeQuiz) {
    if (effectiveLevel === 'public') {
      quizStatusLabel = 'Terbuka untuk Semua';
      quizReason = allowGuests
        ? `Kuis ${matInfo} berlevel Terbuka dan mengizinkan tamu tanpa login.`
        : `Kuis ${matInfo} berlevel Terbuka untuk semua pengguna.`;
    } else if (effectiveLevel === 'member') {
      quizStatusLabel = 'Terbuka (Akun Terdaftar)';
      quizReason = `Kamu sudah masuk dengan akun terdaftar sehingga dapat mengerjakan kuis ${matInfo}.`;
    } else {
      quizStatusLabel = tier === 'admin' ? 'Terbuka (Akses Admin)' : 'Terbuka (Pelanggan Aktif)';
      quizReason =
        tier === 'admin'
          ? 'Admin memiliki akses penuh ke seluruh kuis dan pratinjau draf.'
          : `Langganan aktifmu membuka penuh kuis ${matInfo}.`;
    }
  } else {
    if (effectiveLevel === 'member') {
      quizStatusLabel = 'Perlu Masuk Akun';
      quizReason = `Kuis ${matInfo} mewajibkan pengguna masuk dengan akun terdaftar.`;
    } else {
      quizStatusLabel = 'Khusus Pelanggan';
      quizReason = `Kuis ${matInfo} mengikuti tingkat akses Langganan. Aktifkan langganan untuk mengerjakan kuis mandiri.`;
    }
  }

  const explanationReason = canSeeExplanations
    ? 'Pembahasan lengkap terbuka karena kamu berstatus Pelanggan Aktif / Admin.'
    : 'Kunci jawaban tetap tampil sesuai aturan kuis, sedangkan pembahasan mendalam dikhususkan bagi Pelanggan Aktif.';

  const arenaReason = canPlayArena
    ? 'Mode Arena (lawan bot gaya Kahoot) terbuka gratis untuk semua akun terdaftar.'
    : 'Masuk dengan akun terdaftar untuk bermain di Arena melawan bot.';

  return {
    canTakeQuiz,
    canPlayArena,
    canSeeExplanations,
    quizStatusLabel,
    quizReason,
    explanationReason,
    arenaReason,
  };
}

/**
 * Mencampur soal secara proporsional/merata dari beberapa materi sekaligus.
 * Memudahkan pengajar membuat kuis gabungan (mis. UTS/UAS/Evaluasi Lintas Bab) dengan 1 klik.
 */
export function mixQuestionsAcrossMaterials<T extends { id: string; material_ids: string[] }>(
  availableQuestions: T[],
  targetMaterialIds: string[],
  perMaterialCount: number,
): { pickedIds: string[]; pickedByMaterial: Map<string, number> } {
  const limit = Math.max(1, Math.min(perMaterialCount, 100));
  const pickedSet = new Set<string>();
  const pickedByMaterial = new Map<string, number>();

  // Jika admin belum mencentang filter materi spesifik, gunakan semua materi yang ada di daftar soal tersedia
  const activeMaterialIds =
    targetMaterialIds.length > 0
      ? targetMaterialIds
      : Array.from(new Set(availableQuestions.flatMap((q) => q.material_ids)));

  for (const matId of activeMaterialIds) {
    const candidates = availableQuestions.filter(
      (q) => !pickedSet.has(q.id) && q.material_ids.includes(matId),
    );
    // Acak urutan kandidat secara Fisher-Yates agar pencampuran bervariasi
    const shuffled = [...candidates];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const chosen = shuffled.slice(0, limit);
    for (const q of chosen) {
      pickedSet.add(q.id);
    }
    if (chosen.length > 0) {
      pickedByMaterial.set(matId, chosen.length);
    }
  }

  return {
    pickedIds: Array.from(pickedSet),
    pickedByMaterial,
  };
}

export const AccessPolicyDSL = {
  rank: ACCESS_RANK,
  resolveInheritedLevel,
  analyzeQuizMaterials,
  justifyViewerAccess,
  mixQuestionsAcrossMaterials,
};
