'use server';

import { revalidatePath } from 'next/cache';

import {
  and,
  asc,
  brands,
  desc,
  eq,
  keywords,
  type Keyword,
} from '@geosight/db';
import {
  createKeywordSchema,
  updateKeywordSchema,
  uuidSchema,
} from '@geosight/shared';

import {
  NoActiveOrgError,
  UnauthorizedError,
  UserNotProvisionedError,
  withClerkRequest,
} from '@/lib/auth';

export type BrandOption = { id: string; nameAr: string; nameEn: string };

export type KeywordListItem = Pick<
  Keyword,
  | 'id'
  | 'brandId'
  | 'queryText'
  | 'language'
  | 'dialect'
  | 'schedule'
  | 'isActive'
  | 'lastScannedAt'
  | 'createdAt'
> & { brandNameAr: string; brandNameEn: string };

export type ActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function revalidateKeywordPaths(): void {
  revalidatePath('/[locale]/dashboard/keywords', 'page');
}

function authErrorToState(err: unknown): ActionState | null {
  if (err instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
  if (err instanceof NoActiveOrgError) return { ok: false, error: 'no_active_org' };
  if (err instanceof UserNotProvisionedError)
    return { ok: false, error: 'user_not_provisioned' };
  return null;
}

/** List brands for the current org — used to populate the create form selector
 * and the list-page brand filter. RLS scopes the SELECT automatically. */
export async function listBrandOptions(): Promise<BrandOption[]> {
  try {
    return await withClerkRequest((tx) =>
      tx
        .select({ id: brands.id, nameAr: brands.nameAr, nameEn: brands.nameEn })
        .from(brands)
        .orderBy(asc(brands.nameAr)),
    );
  } catch (err) {
    if (authErrorToState(err)) return [];
    throw err;
  }
}

/** List keywords joined with their brand display names. If `brandId` is
 * supplied, filters to that brand — the RLS chain (keywords → brands →
 * org_id) still guards against cross-tenant access even with a forged id. */
export async function listKeywords(brandId?: string): Promise<KeywordListItem[]> {
  const filter = brandId ? uuidSchema.safeParse(brandId) : null;
  try {
    return await withClerkRequest((tx) => {
      const base = tx
        .select({
          id: keywords.id,
          brandId: keywords.brandId,
          queryText: keywords.queryText,
          language: keywords.language,
          dialect: keywords.dialect,
          schedule: keywords.schedule,
          isActive: keywords.isActive,
          lastScannedAt: keywords.lastScannedAt,
          createdAt: keywords.createdAt,
          brandNameAr: brands.nameAr,
          brandNameEn: brands.nameEn,
        })
        .from(keywords)
        .innerJoin(brands, eq(brands.id, keywords.brandId));

      const query = filter?.success
        ? base.where(eq(keywords.brandId, filter.data))
        : base;

      return query.orderBy(desc(keywords.createdAt));
    });
  } catch (err) {
    if (authErrorToState(err)) return [];
    throw err;
  }
}

export async function createKeywordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createKeywordSchema.safeParse({
    brandId: formData.get('brandId') ?? '',
    queryText: formData.get('queryText') ?? '',
    language: formData.get('language') ?? 'ar',
    dialect: formData.get('dialect') ?? 'auto',
    schedule: formData.get('schedule') ?? 'daily',
    isActive: formData.get('isActive') !== 'off',
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    await withClerkRequest(async (tx) => {
      // RLS WITH CHECK on keywords joins through brands.org_id — a forged
      // brand_id pointing at another org's brand is rejected.
      await tx.insert(keywords).values({
        brandId: parsed.data.brandId,
        queryText: parsed.data.queryText,
        language: parsed.data.language,
        dialect: parsed.data.dialect,
        schedule: parsed.data.schedule,
        isActive: parsed.data.isActive,
      });
    });
    revalidateKeywordPaths();
    return { ok: true, message: 'keyword_created' };
  } catch (err) {
    const authState = authErrorToState(err);
    if (authState) return authState;
    // Most likely cause of a thrown error here is RLS rejecting a cross-org
    // brand_id, since the schema validation already ran.
    const msg = err instanceof Error ? err.message : String(err);
    if (/row-level security|policy/i.test(msg)) {
      return { ok: false, error: 'brand_not_found' };
    }
    console.error('[keywords.create] failed:', err);
    return { ok: false, error: 'internal_error' };
  }
}

export async function updateKeywordAction(
  keywordId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const idCheck = uuidSchema.safeParse(keywordId);
  if (!idCheck.success) return { ok: false, error: 'invalid_id' };

  const raw: Record<string, unknown> = {};
  if (formData.has('queryText')) raw.queryText = formData.get('queryText');
  if (formData.has('language')) raw.language = formData.get('language');
  if (formData.has('dialect')) raw.dialect = formData.get('dialect');
  if (formData.has('schedule')) raw.schedule = formData.get('schedule');
  if (formData.has('isActive')) raw.isActive = formData.get('isActive') !== 'off';

  const parsed = updateKeywordSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const result = await withClerkRequest(async (tx) => {
      const updated = await tx
        .update(keywords)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(keywords.id, idCheck.data))
        .returning({ id: keywords.id });
      return updated.length;
    });
    if (result === 0) return { ok: false, error: 'not_found' };
    revalidateKeywordPaths();
    return { ok: true, message: 'keyword_updated' };
  } catch (err) {
    const authState = authErrorToState(err);
    if (authState) return authState;
    console.error('[keywords.update] failed:', err);
    return { ok: false, error: 'internal_error' };
  }
}

/** Lightweight active/inactive toggle — used by the row switch. */
export async function setKeywordActiveAction(
  keywordId: string,
  isActive: boolean,
): Promise<ActionState> {
  const idCheck = uuidSchema.safeParse(keywordId);
  if (!idCheck.success) return { ok: false, error: 'invalid_id' };

  try {
    const result = await withClerkRequest(async (tx) => {
      const updated = await tx
        .update(keywords)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(keywords.id, idCheck.data))
        .returning({ id: keywords.id });
      return updated.length;
    });
    if (result === 0) return { ok: false, error: 'not_found' };
    revalidateKeywordPaths();
    return { ok: true };
  } catch (err) {
    const authState = authErrorToState(err);
    if (authState) return authState;
    console.error('[keywords.toggle] failed:', err);
    return { ok: false, error: 'internal_error' };
  }
}

export async function deleteKeywordAction(keywordId: string): Promise<ActionState> {
  const idCheck = uuidSchema.safeParse(keywordId);
  if (!idCheck.success) return { ok: false, error: 'invalid_id' };

  try {
    const result = await withClerkRequest(async (tx) => {
      const deleted = await tx
        .delete(keywords)
        .where(and(eq(keywords.id, idCheck.data)))
        .returning({ id: keywords.id });
      return deleted.length;
    });
    if (result === 0) return { ok: false, error: 'not_found' };
    revalidateKeywordPaths();
    return { ok: true, message: 'keyword_deleted' };
  } catch (err) {
    const authState = authErrorToState(err);
    if (authState) return authState;
    console.error('[keywords.delete] failed:', err);
    return { ok: false, error: 'internal_error' };
  }
}
