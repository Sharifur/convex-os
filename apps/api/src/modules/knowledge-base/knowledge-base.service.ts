import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { eq, and, desc, inArray, sql, or } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { knowledgeEntries, writingSamples, promptTemplates, pendingApprovals, agentRuns, agents } from '../../db/schema';
import { KnowledgeBaseCacheService } from './knowledge-base-cache.service';
import { LlmRouterService } from '../llm/llm-router.service';
import { createId } from '@paralleldrive/cuid2';

export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type WritingSample = typeof writingSamples.$inferSelect;

export interface KbPromptBlockParams {
  voiceProfile: KnowledgeEntry | null;
  facts: KnowledgeEntry[];
  /** Products / services / offers — rendered as a catalog the agent can pitch from. */
  catalog?: KnowledgeEntry[];
  /** Always-on product documentation entries (how-it-works, pricing pages, feature docs). */
  documentation?: KnowledgeEntry[];
  references: KnowledgeEntry[];
  positiveSamples: WritingSample[];
  negativeSamples: WritingSample[];
  rejections: string[];
  threadHistory?: { role: 'customer' | 'agent'; text: string }[];
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private readonly db: DbService,
    private readonly cache: KnowledgeBaseCacheService,
    @Inject(forwardRef(() => LlmRouterService))
    private readonly llm: LlmRouterService,
  ) {}

  // ─── Agent key filtering ───────────────────────────────────────────────────

  private agentKeyWhere(agentKey?: string) {
    if (!agentKey) return sql`1=1`;
    return sql`(agent_keys IS NULL
      OR agent_keys = ${agentKey}
      OR agent_keys LIKE ${agentKey + ',%'}
      OR agent_keys LIKE ${'%,' + agentKey}
      OR agent_keys LIKE ${'%,' + agentKey + ',%'})`;
  }

  // Livechat KB can be site-scoped via two CSV columns:
  //   site_keys           — include list. Must be explicitly set; empty/null means the
  //                         entry will NOT appear in any site-specific query (prevents
  //                         cross-site KB contamination when multiple sites are registered).
  //   excluded_site_keys  — exclude list. Empty/null means "no exclusions".
  // Pass siteKey to include only entries explicitly tagged with that site.
  // Pass null to limit to entries with no site scoping at all (admin filter view).
  // Omit (undefined) to fetch every entry regardless of site.
  private siteKeyWhere(siteKey?: string | null) {
    if (siteKey === undefined) return sql`1=1`;
    if (siteKey === null) {
      return sql`(site_keys IS NULL OR site_keys = '') AND (excluded_site_keys IS NULL OR excluded_site_keys = '')`;
    }
    // Strict: only entries that explicitly list this siteKey.
    // Entries with empty/null site_keys are excluded — they must be tagged to appear.
    const inc = sql`(
      site_keys = ${siteKey}
      OR site_keys LIKE ${siteKey + ',%'}
      OR site_keys LIKE ${'%,' + siteKey}
      OR site_keys LIKE ${'%,' + siteKey + ',%'}
    )`;
    const exc = sql`(
      excluded_site_keys IS NULL
      OR excluded_site_keys = ''
      OR (
        excluded_site_keys != ${siteKey}
        AND excluded_site_keys NOT LIKE ${siteKey + ',%'}
        AND excluded_site_keys NOT LIKE ${'%,' + siteKey}
        AND excluded_site_keys NOT LIKE ${'%,' + siteKey + ',%'}
      )
    )`;
    return sql`${inc} AND ${exc}`;
  }

  // ─── Knowledge Entries ─────────────────────────────────────────────────────

  async listEntries(
    agentKey?: string,
    entryType?: string,
    siteKey?: string | null,
    pagination?: { limit?: number; offset?: number },
  ): Promise<{ rows: KnowledgeEntry[]; total: number }> {
    const where = entryType
      ? sql`${this.agentKeyWhere(agentKey)} AND ${this.siteKeyWhere(siteKey)} AND entry_type = ${entryType}`
      : sql`${this.agentKeyWhere(agentKey)} AND ${this.siteKeyWhere(siteKey)}`;

    let q = this.db.db
      .select()
      .from(knowledgeEntries)
      .where(where)
      .orderBy(desc(knowledgeEntries.priority), desc(knowledgeEntries.createdAt))
      .$dynamic();
    if (pagination?.limit != null) q = q.limit(pagination.limit);
    if (pagination?.offset != null) q = q.offset(pagination.offset);

    const [rows, totalRows] = await Promise.all([
      q,
      this.db.db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(knowledgeEntries)
        .where(where),
    ]);
    return { rows, total: totalRows[0]?.count ?? rows.length };
  }

  async searchEntries(query: string, agentKey?: string, limit = 5, siteKey?: string | null): Promise<KnowledgeEntry[]> {
    const q = query?.trim();
    if (!q) {
      return this.db.db
        .select()
        .from(knowledgeEntries)
        .where(
          sql`${this.agentKeyWhere(agentKey)} AND ${this.siteKeyWhere(siteKey)} AND entry_type = 'reference'`,
        )
        .orderBy(desc(knowledgeEntries.priority))
        .limit(limit);
    }

    // Hybrid retrieval: run FTS and vector lookup in parallel, then merge with
    // reciprocal-rank fusion (RRF) so paraphrases ("get my money back") match
    // their canonical entry ("refund policy"). FTS-only when embeddings or the
    // OpenAI key are unavailable.
    const widerLimit = Math.max(limit * 4, 20);
    const ftsPromise = this.db.db
      .select()
      .from(knowledgeEntries)
      .where(
        sql`${this.agentKeyWhere(agentKey)}
          AND ${this.siteKeyWhere(siteKey)}
          AND entry_type IN ('reference', 'documentation', 'service', 'product', 'offer', 'product_qa')
          AND to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${q})`,
      )
      .orderBy(desc(knowledgeEntries.priority))
      .limit(widerLimit);

    const vectorPromise = this.vectorSearch(q, agentKey, siteKey, widerLimit).catch((err) => {
      this.logger.debug(`vector search skipped: ${(err as Error).message}`);
      return [] as KnowledgeEntry[];
    });

    const [fts, vec] = await Promise.all([ftsPromise, vectorPromise]);
    const results = !vec.length ? fts.slice(0, limit) : reciprocalRankFusion(fts, vec, limit);
    if (results.length > 0) {
      const ids = results.map((r) => r.id);
      void this.db.db
        .update(knowledgeEntries)
        .set({ lastRetrievedAt: new Date() })
        .where(inArray(knowledgeEntries.id, ids))
        .catch(() => undefined);
    }
    return results;
  }

  /**
   * Embed the query and run a cosine-similarity lookup against any rows that
   * have an embedding. Returns rows ordered by similarity (closest first).
   * Returns [] if pgvector isn't installed or no rows have embeddings yet —
   * the caller can fall back to FTS-only with no behaviour change.
   */
  private async vectorSearch(
    query: string,
    agentKey?: string,
    siteKey?: string | null,
    limit = 20,
  ): Promise<KnowledgeEntry[]> {
    const embedding = await this.llm.embed(query);
    if (!embedding) return [];
    const literal = `[${embedding.join(',')}]`;
    // Cosine distance threshold: 0.40 = similarity ≥ 0.60. Filters out
    // semantically unrelated entries that would otherwise pollute the prompt.
    const rows = await this.db.db
      .select()
      .from(knowledgeEntries)
      .where(
        sql`${this.agentKeyWhere(agentKey)}
          AND ${this.siteKeyWhere(siteKey)}
          AND entry_type IN ('reference', 'documentation', 'service', 'product', 'offer', 'product_qa')
          AND embedding IS NOT NULL
          AND embedding <=> ${literal}::vector <= 0.40`,
      )
      .orderBy(sql`embedding <=> ${literal}::vector`)
      .limit(limit);
    return rows;
  }

  /**
   * Counts of entries with vs without an embedding, so the admin UI can show
   * a "12 of 47 embedded" badge and surface backfill needs.
   */
  async embeddingStatus(): Promise<{ total: number; embedded: number; pending: number; missingExtension: boolean }> {
    try {
      const rows = await this.db.db.execute<{ total: number; embedded: number }>(sql`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE embedding IS NOT NULL)::int AS embedded
        FROM knowledge_entries
        WHERE entry_type <> 'blocklist'
      `);
      const r = rows[0] ?? { total: 0, embedded: 0 };
      return { total: r.total, embedded: r.embedded, pending: r.total - r.embedded, missingExtension: false };
    } catch (err) {
      // pgvector not installed — surface that to the UI instead of crashing.
      const msg = (err as Error).message ?? '';
      if (/extension|vector|column/i.test(msg)) {
        return { total: 0, embedded: 0, pending: 0, missingExtension: true };
      }
      throw err;
    }
  }

  /** Returns the entry IDs that lack embeddings; used by the admin re-embed flow. */
  async listEntriesNeedingEmbedding(limit = 100): Promise<{ id: string; title: string; content: string }[]> {
    try {
      const rows = await this.db.db.execute<{ id: string; title: string; content: string }>(sql`
        SELECT id, title, content
        FROM knowledge_entries
        WHERE embedding IS NULL AND entry_type <> 'blocklist'
        ORDER BY created_at DESC
        LIMIT ${limit}
      `);
      return rows;
    } catch {
      return [];
    }
  }

  /** Re-embed every entry that currently lacks an embedding, in series. */
  async reembedPending(): Promise<{ embedded: number; failed: number }> {
    const pending = await this.listEntriesNeedingEmbedding(500);
    let embedded = 0;
    let failed = 0;
    for (const r of pending) {
      try {
        const v = await this.llm.embed(`${r.title}\n${r.content}`);
        if (!v) { failed++; continue; }
        const literal = `[${v.join(',')}]`;
        await this.db.db.execute(sql`UPDATE knowledge_entries SET embedding = ${literal}::vector WHERE id = ${r.id}`);
        embedded++;
      } catch (err) {
        this.logger.warn(`reembed ${r.id} failed: ${(err as Error).message}`);
        failed++;
      }
    }
    return { embedded, failed };
  }

  /**
   * Embed and persist the embedding for a single entry. Best-effort — silently
   * swallows errors so a transient OpenAI outage doesn't block KB writes.
   */
  async embedEntry(entryId: string, text: string): Promise<void> {
    try {
      const embedding = await this.llm.embed(text);
      if (!embedding) return;
      const literal = `[${embedding.join(',')}]`;
      await this.db.db.execute(
        sql`UPDATE knowledge_entries SET embedding = ${literal}::vector WHERE id = ${entryId}`,
      );
    } catch (err) {
      this.logger.warn(`embedEntry(${entryId}) failed: ${(err as Error).message}`);
    }
  }

  async getAlwaysOnContext(agentKey?: string, siteKey?: string | null): Promise<KnowledgeEntry[]> {
    const cacheKey = this.cache.alwaysOnKey(`${agentKey ?? 'global'}${siteKey ? `:site:${siteKey}` : ''}`);
    const loader = () =>
      this.db.db
        .select()
        .from(knowledgeEntries)
        .where(
          sql`${this.agentKeyWhere(agentKey)} AND ${this.siteKeyWhere(siteKey)} AND entry_type IN ('fact', 'voice_profile', 'product', 'service', 'offer', 'documentation')`,
        )
        .orderBy(desc(knowledgeEntries.priority));

    return this.cache.getOrSet(cacheKey, loader);
  }

  async getBlocklistRules(agentKey?: string, siteKey?: string | null): Promise<string[]> {
    const cacheKey = this.cache.blocklistKey(`${agentKey ?? 'global'}${siteKey ? `:site:${siteKey}` : ''}`);
    const loader = async () => {
      const rows = await this.db.db
        .select({ content: knowledgeEntries.content })
        .from(knowledgeEntries)
        .where(
          sql`${this.agentKeyWhere(agentKey)} AND ${this.siteKeyWhere(siteKey)} AND entry_type = 'blocklist'`,
        );
      return rows.map(r => r.content);
    };
    return this.cache.getOrSet(cacheKey, loader);
  }

  async createEntry(dto: {
    title: string;
    content: string;
    category?: string;
    entryType?: string;
    priority?: number;
    agentKeys?: string;
    siteKeys?: string | null;
    excludedSiteKeys?: string | null;
    sourceType?: string;
    sourceUrl?: string;
    parentDocId?: string;
  }) {
    const [row] = await this.db.db
      .insert(knowledgeEntries)
      .values({
        id: createId(),
        title: dto.title,
        content: dto.content,
        category: dto.category ?? 'general',
        entryType: dto.entryType ?? 'reference',
        priority: dto.priority ?? 50,
        agentKeys: dto.agentKeys ?? null,
        siteKeys: dto.siteKeys ?? null,
        excludedSiteKeys: dto.excludedSiteKeys ?? null,
        sourceType: dto.sourceType ?? 'manual',
        sourceUrl: dto.sourceUrl ?? null,
        parentDocId: dto.parentDocId ?? null,
      })
      .returning();
    await this.invalidateCacheForEntry(row);
    // Background embed — don't block the create response on the OpenAI call.
    // Every entry type except blocklist gets an embedding (blocklist rules are
    // short patterns, not worth the API call). Vector search filters by
    // entry_type at query time so this is forward-compatible if we widen
    // retrieval to facts / products / etc. later.
    if (shouldEmbed(row.entryType)) {
      void this.embedEntry(row.id, `${row.title}\n${row.content}`);
    }
    return row;
  }

  async getEntry(id: string) {
    const [row] = await this.db.db
      .select()
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.id, id))
      .limit(1);
    return row ?? null;
  }

  async updateEntry(id: string, dto: Partial<{
    title: string;
    content: string;
    category: string;
    entryType: string;
    priority: number;
    agentKeys: string | null;
    siteKeys: string | null;
    excludedSiteKeys: string | null;
  }>) {
    const [row] = await this.db.db
      .update(knowledgeEntries)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(knowledgeEntries.id, id))
      .returning();
    if (row) await this.invalidateCacheForEntry(row);
    // Re-embed only when the searchable text actually changed.
    if (row && (dto.title !== undefined || dto.content !== undefined) && shouldEmbed(row.entryType)) {
      void this.embedEntry(row.id, `${row.title}\n${row.content}`);
    }
    return row;
  }

  async deleteEntry(id: string) {
    // Cascade-delete all chunks that reference this parent first
    await this.db.db
      .delete(knowledgeEntries)
      .where(eq(knowledgeEntries.parentDocId, id));
    const [row] = await this.db.db
      .delete(knowledgeEntries)
      .where(eq(knowledgeEntries.id, id))
      .returning();
    if (row) await this.invalidateCacheForEntry(row);
    return row;
  }

  async deleteEntries(ids: string[]) {
    if (!ids.length) return { deleted: 0 };
    // Cascade-delete chunks of any parent docs in the set
    await this.db.db
      .delete(knowledgeEntries)
      .where(inArray(knowledgeEntries.parentDocId, ids));
    const rows = await this.db.db
      .delete(knowledgeEntries)
      .where(inArray(knowledgeEntries.id, ids))
      .returning();
    await Promise.all(rows.map((r) => this.invalidateCacheForEntry(r)));
    return { deleted: rows.length };
  }

  async countChunks(parentDocId: string) {
    const rows = await this.db.db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.parentDocId, parentDocId));
    return rows.length;
  }

  // ─── Writing Samples ───────────────────────────────────────────────────────

  async getWritingSamples(agentKey?: string, siteKey?: string | null): Promise<WritingSample[]> {
    const cacheKey = this.cache.samplesKey(`${agentKey ?? 'global'}${siteKey ? `:site:${siteKey}` : ''}`);
    const loader = () =>
      this.db.db
        .select()
        .from(writingSamples)
        .where(sql`${this.agentKeyWhere(agentKey)} AND ${this.siteKeyWhere(siteKey)}`)
        .orderBy(writingSamples.polarity, desc(writingSamples.createdAt));

    return this.cache.getOrSet(cacheKey, loader);
  }

  async listSamples(agentKey?: string, siteKey?: string | null) {
    return this.db.db
      .select()
      .from(writingSamples)
      .where(sql`${this.agentKeyWhere(agentKey)} AND ${this.siteKeyWhere(siteKey)}`)
      .orderBy(writingSamples.polarity, desc(writingSamples.createdAt));
  }

  async createSample(dto: { context: string; sampleText: string; polarity?: string; agentKeys?: string; siteKeys?: string | null; excludedSiteKeys?: string | null }) {
    const [row] = await this.db.db
      .insert(writingSamples)
      .values({
        id: createId(),
        context: dto.context,
        sampleText: dto.sampleText,
        polarity: dto.polarity ?? 'positive',
        agentKeys: dto.agentKeys ?? null,
        siteKeys: dto.siteKeys ?? null,
        excludedSiteKeys: dto.excludedSiteKeys ?? null,
      })
      .returning();
    await this.invalidateSamplesCache(row.agentKeys);
    return row;
  }

  async updateSample(id: string, dto: Partial<{ context: string; sampleText: string; polarity: string; agentKeys: string | null; siteKeys: string | null; excludedSiteKeys: string | null }>) {
    const [row] = await this.db.db
      .update(writingSamples)
      .set(dto)
      .where(eq(writingSamples.id, id))
      .returning();
    if (row) await this.invalidateSamplesCache(row.agentKeys);
    return row;
  }

  async deleteSample(id: string) {
    const [row] = await this.db.db
      .delete(writingSamples)
      .where(eq(writingSamples.id, id))
      .returning();
    if (row) await this.invalidateSamplesCache(row.agentKeys);
    return row;
  }

  async deleteSamples(ids: string[]) {
    if (!ids.length) return { deleted: 0 };
    const rows = await this.db.db
      .delete(writingSamples)
      .where(inArray(writingSamples.id, ids))
      .returning();
    await Promise.all(rows.map((r) => this.invalidateSamplesCache(r.agentKeys)));
    return { deleted: rows.length };
  }

  // ─── Prompt Templates ─────────────────────────────────────────────────────

  async getPromptTemplate(agentKey: string) {
    const cacheKey = this.cache.templateKey(`${agentKey}.reply`);
    return this.cache.getOrSet(cacheKey, async () => {
      const [row] = await this.db.db
        .select()
        .from(promptTemplates)
        .where(eq(promptTemplates.key, `${agentKey}.reply`));
      return row ?? null;
    });
  }

  async listTemplates() {
    return this.db.db
      .select()
      .from(promptTemplates)
      .orderBy(promptTemplates.key);
  }

  async createTemplate(dto: { key: string; system: string; userTemplate: string }) {
    const [row] = await this.db.db
      .insert(promptTemplates)
      .values({ id: createId(), ...dto })
      .returning();
    await this.cache.invalidateTemplate(dto.key);
    return row;
  }

  async updateTemplate(id: string, dto: Partial<{ system: string; userTemplate: string }>) {
    const [row] = await this.db.db
      .update(promptTemplates)
      .set({ ...dto, version: sql`version + 1` })
      .where(eq(promptTemplates.id, id))
      .returning();
    if (row) await this.cache.invalidateTemplate(row.key);
    return row;
  }

  async deleteTemplate(id: string) {
    const [row] = await this.db.db
      .delete(promptTemplates)
      .where(eq(promptTemplates.id, id))
      .returning();
    if (row) await this.cache.invalidateTemplate(row.key);
    return row;
  }

  // ─── Rejection history ─────────────────────────────────────────────────────

  async getRecentRejections(agentKey: string, limit = 3): Promise<string[]> {
    const rows = await this.db.db
      .select({ reason: pendingApprovals.rejectionReason })
      .from(pendingApprovals)
      .innerJoin(agentRuns, eq(pendingApprovals.runId, agentRuns.id))
      .innerJoin(agents, eq(agentRuns.agentId, agents.id))
      .where(
        and(
          eq(agents.key, agentKey),
          sql`${pendingApprovals.rejectionReason} IS NOT NULL`,
        ),
      )
      .orderBy(desc(pendingApprovals.createdAt))
      .limit(limit);
    return rows.map(r => r.reason!);
  }

  // ─── KB prompt block builder ───────────────────────────────────────────────

  buildKbPromptBlock(params: KbPromptBlockParams): string {
    const { voiceProfile, facts, catalog, documentation, references, positiveSamples, negativeSamples, rejections, threadHistory } = params;
    const parts: string[] = [];
    const catalogIds = new Set((catalog ?? []).map((e) => e.id));
    const dedupedReferences = references.filter((r) => !catalogIds.has(r.id));

    if (voiceProfile) {
      parts.push(`\n\n## Your Voice & Style\n${trunc(voiceProfile.content, 600)}`);
    }

    if (facts.length) {
      const factText = facts
        .map(f => `- **${f.title}**: ${trunc(f.content, 200)}`)
        .join('\n')
        .slice(0, 800);
      parts.push(`\n\n## Key Facts (always apply)\n${factText}`);
    }

    if (catalog && catalog.length) {
      const grouped: Record<'product' | 'service' | 'offer', KnowledgeEntry[]> = { product: [], service: [], offer: [] };
      for (const e of catalog) {
        if (e.entryType === 'product' || e.entryType === 'service' || e.entryType === 'offer') {
          grouped[e.entryType].push(e);
        }
      }
      const sections: string[] = [];
      if (grouped.product.length) {
        sections.push(`### Products\n${grouped.product.map(p => `- **${p.title}**: ${trunc(p.content, 500)}`).join('\n')}`);
      }
      if (grouped.service.length) {
        sections.push(`### Services\n${grouped.service.map(s => `- **${s.title}**: ${trunc(s.content, 500)}`).join('\n')}`);
      }
      if (grouped.offer.length) {
        sections.push(`### Active Offers\n${grouped.offer.map(o => `- **${o.title}**: ${trunc(o.content, 500)}`).join('\n')}`);
      }
      if (sections.length) {
        parts.push(`\n\n## What You Can Pitch\n${sections.join('\n\n')}\nMention these only when the visitor's question is relevant — never force a pitch.`);
      }
    }

    if (documentation && documentation.length) {
      const docText = documentation.slice(0, 12)
        .map(d => `### ${d.title}\n${trunc(d.content, 1200)}`)
        .join('\n\n');
      parts.push(`\n\n## Product Documentation (authoritative — use this to answer how-it-works and pricing questions)\n${docText}`);
    }

    if (dedupedReferences.length) {
      const refText = dedupedReferences.slice(0, 8)
        .map(r => `### ${r.title}\n${trunc(r.content, 800)}`)
        .join('\n\n');
      parts.push(`\n\n## Relevant Knowledge\n${refText}`);
    }

    if (positiveSamples.length) {
      const pos = positiveSamples.slice(0, 3)
        .map(s => `[${s.context}]: "${trunc(s.sampleText, 400)}"`)
        .join('\n\n');
      parts.push(`\n\n## Write Like This (examples)\n${pos}`);
    }

    if (negativeSamples.length) {
      const neg = negativeSamples.slice(0, 2)
        .map(s => `[${s.context}]: "${trunc(s.sampleText, 200)}"`)
        .join('\n\n');
      parts.push(`\n\n## Never Write Like This\n${neg}`);
    }

    if (rejections.length) {
      const rejText = rejections.slice(0, 3)
        .map(r => `- ${trunc(r, 150)}`)
        .join('\n');
      parts.push(`\n\n## Avoid These Past Mistakes\n${rejText}`);
    }

    if (threadHistory?.length) {
      const thread = threadHistory.slice(-5)
        .map(m => `${m.role === 'customer' ? 'Customer' : 'Agent'}: "${trunc(m.text, 300)}"`)
        .join('\n');
      parts.push(`\n\n## Conversation Thread\n${thread}`);
    }

    if (parts.length) {
      parts.push('\n\n---\n**Response rule**: Be concise and direct. No preamble, no filler phrases, no unnecessary explanation. Get straight to the point.');
    }

    return parts.join('');
  }

  // ─── Cache helpers ─────────────────────────────────────────────────────────

  private async invalidateCacheForEntry(entry: KnowledgeEntry) {
    if (!entry.agentKeys) {
      await this.cache.invalidateGlobal();
    } else {
      const keys = entry.agentKeys.split(',').map(k => k.trim());
      await Promise.all(keys.map(k => this.cache.invalidateAgent(k)));
    }
  }

  private async invalidateSamplesCache(agentKeys: string | null) {
    if (!agentKeys) {
      await this.cache.invalidateGlobal();
    } else {
      const keys = agentKeys.split(',').map(k => k.trim());
      await Promise.all(keys.map(k => this.cache.invalidateAgent(k)));
    }
  }
}

function trunc(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

/** Blocklist rules are short patterns — embeddings would be noise. Everything else gets vectorised. */
function shouldEmbed(entryType: string): boolean {
  return entryType !== 'blocklist';
}

/**
 * Reciprocal-rank fusion: combine two ranked lists into one, preferring rows
 * that show up high in BOTH (FTS keyword and vector semantic). The constant
 * `k=60` is the canonical RRF default — dampens the influence of low ranks.
 */
function reciprocalRankFusion<T extends { id: string; priority: number }>(
  fts: T[],
  vec: T[],
  limit: number,
  k = 60,
): T[] {
  const scores = new Map<string, { row: T; score: number }>();
  fts.forEach((row, idx) => {
    scores.set(row.id, { row, score: 1 / (k + idx) });
  });
  vec.forEach((row, idx) => {
    const existing = scores.get(row.id);
    const add = 1 / (k + idx);
    if (existing) existing.score += add;
    else scores.set(row.id, { row, score: add });
  });
  return Array.from(scores.values())
    // Tie-break by manual priority so curated entries win when scores are close.
    .sort((a, b) => b.score - a.score || b.row.priority - a.row.priority)
    .slice(0, limit)
    .map((x) => x.row);
}
