/**
 * PostgREST Query DSL
 * Abstraksi modular untuk membangun filter query PostgREST secara aman dan deklaratif,
 * mencegah kegagalan sintaks (400 Bad Request) dan PostgREST filter injection.
 */

const FORBIDDEN_FILTER_CHARS = /[,.():"\\%*_]/g;

export interface PaginationOptions {
  page?: number;
  pageSize?: number;
}

export interface PaginationRange {
  from: number;
  to: number;
  limit: number;
}

export class QueryFilterDSL {
  /**
   * Membersihkan teks masukan pengguna dari karakter sintaks khusus PostgREST.
   */
  static sanitize(raw: string | null | undefined, maxLength = 100): string {
    return (raw ?? '')
      .replace(FORBIDDEN_FILTER_CHARS, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, maxLength);
  }

  /**
   * Menghasilkan ekspresi filter PostgREST .or() dengan pencarian ilike aman.
   * Contoh: QueryFilterDSL.orIlike(['title', 'description'], 'statistika')
   * Hasil: "title.ilike.%statistika%,description.ilike.%statistika%"
   */
  static orIlike(fields: readonly string[], searchTerm: string | null | undefined): string | null {
    const clean = this.sanitize(searchTerm);
    if (!clean || fields.length === 0) return null;
    return fields.map((f) => `${f}.ilike.%${clean}%`).join(',');
  }

  /**
   * Menghitung rentang paginasi (from, to, limit) dari page dan pageSize.
   */
  static paginate(options: PaginationOptions = {}, defaultSize = 12): PaginationRange {
    const pageSize = Math.max(1, Math.min(100, options.pageSize ?? defaultSize));
    const page = Math.max(1, options.page ?? 1);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    return { from, to, limit: pageSize };
  }
}
