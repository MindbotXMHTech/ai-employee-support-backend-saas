# match_document_chunks

## Purpose

`public.match_document_chunks` returns the nearest ready chunks in one tenant for one query embedding.

## Parameters

| Name | Type | Condition | Meaning |
| --- | --- | --- | --- |
| `target_tenant_id` | `uuid` | Compared with `document_chunks.tenant_id` and `documents.tenant_id`. | Tenant whose chunks may be returned. |
| `query_embedding` | `vector(1536)` | Used by the `<=>` distance operator. | Query vector. The `vector` extension is created in the same migration. |
| `match_count` | `integer` | Default `5`. Passed to `limit`. | Maximum number of rows. |
| `similarity_threshold` | `double precision` | Default `0.72`. | Minimum similarity. Similarity is `1 - (embedding <=> query_embedding)`. |

## Return value

The function returns a table.

| Column | Type | Meaning |
| --- | --- | --- |
| `id` | `uuid` | `document_chunks.id` |
| `document_id` | `uuid` | `document_chunks.document_id` |
| `content` | `text` | `document_chunks.content` |
| `metadata` | `jsonb` | `document_chunks.metadata` |
| `similarity` | `double precision` | `1 - (document_chunks.embedding <=> query_embedding)` |
| `document_name` | `text` | `documents.file_name` |
| `document_category` | `text` | `documents.document_category` |

Rows are ordered by `document_chunks.embedding <=> query_embedding` ascending, then limited to `match_count`.

When no chunk passes the filters, the function returns an empty set.

## Data read and written

The function reads `public.document_chunks` and `public.documents`. The join is `documents.id = document_chunks.document_id`.

A row is kept only when all of the following are true.

- `document_chunks.tenant_id` equals `target_tenant_id`
- `documents.tenant_id` equals `target_tenant_id`
- `documents.status` equals `ready`
- `document_chunks.embedding` is not null
- similarity is greater than or equal to `similarity_threshold`

The function writes nothing.

`src/lib/services/ragService.ts` calls it from `retrieveChunks` through the service-role client. The call passes `target_tenant_id`, `query_embedding`, `match_count` defaulting to `5`, and `similarity_threshold` `0.72`. If the client returns an error, `retrieveChunks` throws that error.

## Behavior

### Normal case

The function returns up to `match_count` ready chunks in the tenant, nearest first, whose similarity is at least the threshold.

### Edge cases

`documents.status` may be `uploaded`, `processing`, `ready`, or `failed`. Only `ready` is returned.

`documents.document_category` may be `benefits`, `welfare`, `leave_policy`, `insurance`, `hr_faq`, `other`, or null. The function does not filter the category. It returns the stored value.

The function does not replace a null `match_count` or a null `similarity_threshold`. ยังไม่พบข้อมูลยืนยัน of a test for those nulls in this repository.

The function does not reject a null `target_tenant_id` in its body. A null comparison does not match a tenant id, so the result set is empty.

### Errors

The function body contains no `raise`. The migration does not name an error for a bad embedding length or a negative `match_count`. ยังไม่พบข้อมูลยืนยัน of those error texts in this repository.

## Repeated calls

The function is `stable` and writes nothing. A second call with the same arguments reads the chunks again. It does not record that it ran. If chunks or embeddings change between calls, the rows can change.

## Transaction and concurrency

The function body has no `begin`, `commit`, or row lock.

## Privileges and security

The migration declares `language sql` and `stable`. It does not declare `security definer` or `search_path`.

The body schema-qualifies `public.document_chunks` and `public.documents`.

The migration does not name the function owner. ยังไม่พบข้อมูลยืนยัน of the owner role.

`supabase/migrations` contains no `grant` and no `revoke` for this function. ยังไม่พบข้อมูลยืนยัน of the effective `EXECUTE` list.

`public.document_chunks` and `public.documents` have row level security. The policies in `0001_initial_schema.sql` allow `public.is_platform_admin()` or `public.is_tenant_admin(tenant_id)`. This function does not add its own tenant check beyond the `where` clause above. ยังไม่พบข้อมูลยืนยัน in this repository that the service-role client bypasses those policies.

## Source

`supabase/migrations/0001_initial_schema.sql` defines the function. No later migration in this repository replaces it.

## Change history

| Date | Commit | Details |
|---|---|---|
| 2026-05-07 | [`24df07f8e77d7cb0ab4a7b2184bd8602725c833b`](https://github.com/MindbotXMHTech/ai-employee-support-backend-saas/commit/24df07f8e77d7cb0ab4a7b2184bd8602725c833b) | Add the RPC that returns the nearest document chunks in a tenant. |
