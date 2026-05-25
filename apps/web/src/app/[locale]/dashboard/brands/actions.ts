'use server';

import { revalidatePath } from 'next/cache';

import { and, brands, desc, eq, type Brand } from '@geosight/db';
import {
  createBrandSchema,
  updateBrandSchema,
  uuidSchema,
} from '@geosight/shared';

import {
  NoActiveOrgError,
  UnauthorizedError,
  UserNotProvisionedError,
  getCurrentClerkContext,
  withClerkRequest,
} from '@/lib/auth';

export type BrandListItem = Pick<
  Brand,
  | 'id'
  | 'nameAr'
  | 'nameEn'
  | 'aliasesAr'
  | 'aliasesEn'
  | 'website'
  | 'competitors'
  | 'industry'
  | 'createdAt'
>;

export type ActionState =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

function revalidateBrandPaths(): void {
  // App Router pattern: revalidate every locale variant in one call by
  // targeting the dynamic segment path with type 'page'.
  revalidatePath('/[locale]/dashboard/brands', 'page');
}

function authErrorToState(err: unknown): ActionState | null {
  if (err instanceof UnauthorizedError) return { ok: false, error: 'unauthorized' };
  if (err instanceof NoActiveOrgError) return { ok: false, error: 'no_active_org' };
  if (err instanceof UserNotProvisionedError)
    return { ok: false, error: 'user_not_provisioned' };
  return null;
}

/** Server Component-friendly read. Returns [] on auth errors so the page can
 * render an empty state instead of crashing. */
export async function listBrands(): Promise<BrandListItem[]> {
  try {
    return await withClerkRequest(async (tx) => {
      // RLS scopes this select to the caller's org automatically.
      return tx
        .select({
          id: brands.id,
          nameAr: brands.nameAr,
          nameEn: brands.nameEn,
          aliasesAr: brands.aliasesAr,
          aliasesEn: brands.aliasesEn,
          website: brands.website,
          competitors: brands.competitors,
          industry: brands.industry,
          createdAt: brands.createdAt,
        })
        .from(brands)
        .orderBy(desc(brands.createdAt));
    });
  } catch (err) {
    if (authErrorToState(err)) return [];
    throw err;
  }
}

function readArrayField(form: FormData, name: string): string[] {
  const raw = form.get(name);
  if (typeof raw !== 'string' || raw.trim() === '') return [];
  return raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export async function createBrandAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createBrandSchema.safeParse({
    nameAr: formData.get('nameAr') ?? '',
    nameEn: formData.get('nameEn') ?? '',
    aliasesAr: readArrayField(formData, 'aliasesAr'),
    aliasesEn: readArrayField(formData, 'aliasesEn'),
    website: (formData.get('website') as string | null) ?? '',
    competitors: readArrayField(formData, 'competitors'),
    industry: ((formData.get('industry') as string | null) ?? '').trim() || undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const ctx = await getCurrentClerkContext();
    await withClerkRequest(async (tx) => {
      // org_id is set explicitly; the RLS WITH CHECK clause enforces that it
      // equals the caller's current org — a forged org_id would be rejected.
      await tx.insert(brands).values({
        orgId: ctx.claims.org_id!,
        nameAr: parsed.data.nameAr,
        nameEn: parsed.data.nameEn,
        aliasesAr: parsed.data.aliasesAr,
        aliasesEn: parsed.data.aliasesEn,
        website: parsed.data.website ?? null,
        competitors: parsed.data.competitors,
        industry: parsed.data.industry ?? null,
      });
    });
    revalidateBrandPaths();
    return { ok: true, message: 'brand_created' };
  } catch (err) {
    const authState = authErrorToState(err);
    if (authState) return authState;
    console.error('[brands.create] failed:', err);
    return { ok: false, error: 'internal_error' };
  }
}

export async function updateBrandAction(
  brandId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const idCheck = uuidSchema.safeParse(brandId);
  if (!idCheck.success) return { ok: false, error: 'invalid_id' };

  const parsed = updateBrandSchema.safeParse({
    nameAr: formData.get('nameAr') ?? undefined,
    nameEn: formData.get('nameEn') ?? undefined,
    aliasesAr: formData.has('aliasesAr') ? readArrayField(formData, 'aliasesAr') : undefined,
    aliasesEn: formData.has('aliasesEn') ? readArrayField(formData, 'aliasesEn') : undefined,
    website: formData.get('website') ?? undefined,
    competitors: formData.has('competitors')
      ? readArrayField(formData, 'competitors')
      : undefined,
    industry: formData.get('industry') ?? undefined,
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: 'validation_failed',
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const result = await withClerkRequest(async (tx) => {
      // RLS predicate already restricts to caller's org. The eq(id) just
      // narrows to one row.
      const updated = await tx
        .update(brands)
        .set({
          ...parsed.data,
          updatedAt: new Date(),
        })
        .where(eq(brands.id, idCheck.data))
        .returning({ id: brands.id });
      return updated.length;
    });

    if (result === 0) {
      // No row updated → either doesn't exist or belongs to another org.
      return { ok: false, error: 'not_found' };
    }
    revalidateBrandPaths();
    return { ok: true, message: 'brand_updated' };
  } catch (err) {
    const authState = authErrorToState(err);
    if (authState) return authState;
    console.error('[brands.update] failed:', err);
    return { ok: false, error: 'internal_error' };
  }
}

export async function deleteBrandAction(brandId: string): Promise<ActionState> {
  const idCheck = uuidSchema.safeParse(brandId);
  if (!idCheck.success) return { ok: false, error: 'invalid_id' };

  try {
    const result = await withClerkRequest(async (tx) => {
      const deleted = await tx
        .delete(brands)
        .where(and(eq(brands.id, idCheck.data)))
        .returning({ id: brands.id });
      return deleted.length;
    });
    if (result === 0) return { ok: false, error: 'not_found' };
    revalidateBrandPaths();
    return { ok: true, message: 'brand_deleted' };
  } catch (err) {
    const authState = authErrorToState(err);
    if (authState) return authState;
    console.error('[brands.delete] failed:', err);
    return { ok: false, error: 'internal_error' };
  }
}
