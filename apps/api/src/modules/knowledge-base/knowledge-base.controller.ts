import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBaseIngestionService } from './knowledge-base-ingestion.service';
import { SelfImprovementService } from './self-improvement.service';

@UseGuards(JwtAuthGuard)
@Controller('knowledge-base')
export class KnowledgeBaseController {
  constructor(
    private readonly kb: KnowledgeBaseService,
    private readonly ingestion: KnowledgeBaseIngestionService,
    private readonly selfImprove: SelfImprovementService,
  ) {}

  // ─── Entries ───────────────────────────────────────────────────────────────

  @Get('entries')
  async listEntries(
    @Query('agentKey') agentKey?: string,
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('siteKey') siteKey?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // siteKey only narrows results when present; admin list defaults to "all".
    const site = siteKey?.trim() ? siteKey.trim() : undefined;
    // Search results don't paginate — they're already top-N ranked. Cap so
    // bursts of FTS hits stay reasonable.
    if (q?.trim()) {
      const rows = await this.kb.searchEntries(q, agentKey, 50, site);
      return { rows, total: rows.length };
    }
    const lim = limit ? Math.max(1, Math.min(200, Number(limit))) : undefined;
    const off = offset ? Math.max(0, Number(offset)) : undefined;
    return this.kb.listEntries(agentKey, type, site, { limit: lim, offset: off });
  }

  @Post('entries')
  createEntry(@Body() body: {
    title: string;
    content: string;
    category?: string;
    entryType?: string;
    priority?: number;
    agentKeys?: string;
    siteKeys?: string | null;
    excludedSiteKeys?: string | null;
  }) {
    if (!body.title?.trim()) throw new BadRequestException('title is required');
    if (!body.content?.trim()) throw new BadRequestException('content is required');
    return this.kb.createEntry(body);
  }

  @Get('entries/:id')
  async getEntry(@Param('id') id: string) {
    const row = await this.kb.getEntry(id);
    if (!row) throw new NotFoundException('Entry not found');
    return row;
  }

  @Patch('entries/:id')
  async updateEntry(@Param('id') id: string, @Body() body: {
    title?: string;
    content?: string;
    category?: string;
    entryType?: string;
    priority?: number;
    agentKeys?: string | null;
    siteKeys?: string | null;
    excludedSiteKeys?: string | null;
  }) {
    const row = await this.kb.updateEntry(id, body);
    if (!row) throw new NotFoundException('Entry not found');
    return row;
  }

  @Delete('entries/:id')
  async deleteEntry(@Param('id') id: string) {
    const row = await this.kb.deleteEntry(id);
    if (!row) throw new NotFoundException('Entry not found');
    return { ok: true };
  }

  @Post('entries/bulk-delete')
  async bulkDeleteEntries(@Body() body: { ids: string[] }) {
    if (!Array.isArray(body?.ids) || !body.ids.length) {
      throw new BadRequestException('ids array is required');
    }
    return this.kb.deleteEntries(body.ids);
  }

  @Get('embeddings/status')
  embeddingStatus() {
    return this.kb.embeddingStatus();
  }

  @Post('embeddings/backfill')
  reembedPending() {
    return this.kb.reembedPending();
  }

  @Get('entries/:id/chunks')
  getChunkCount(@Param('id') id: string) {
    return this.kb.countChunks(id).then(count => ({ count }));
  }

  // ─── Ingestion ─────────────────────────────────────────────────────────────

  @Post('ingest/link')
  ingestLink(@Body() body: { url: string; agentKeys?: string; category?: string; siteKeys?: string | null; excludedSiteKeys?: string | null }) {
    if (!body.url) throw new BadRequestException('url is required');
    return this.ingestion.ingestLink(body.url, {
      agentKeys: body.agentKeys,
      category: body.category,
      siteKeys: body.siteKeys ?? null,
      excludedSiteKeys: body.excludedSiteKeys ?? null,
    });
  }

  @Post('ingest/sitemap')
  async startSitemapJob(@Body() body: {
    url?: string;
    xml?: string;
    agentKeys?: string;
    category?: string;
    siteKeys?: string | null;
    excludedSiteKeys?: string | null;
  }) {
    if (!body.url && !body.xml) throw new BadRequestException('url or xml (base64) is required');
    return this.ingestion.startSitemapJob(
      { url: body.url, xml: body.xml },
      { agentKeys: body.agentKeys, category: body.category, siteKeys: body.siteKeys ?? null, excludedSiteKeys: body.excludedSiteKeys ?? null },
    );
  }

  @Get('ingest/sitemap/jobs/:jobId')
  getSitemapJob(@Param('jobId') jobId: string) {
    const job = this.ingestion.getSitemapJob(jobId);
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  @Post('ingest/document')
  async ingestDocument(@Body() body: {
    filename: string;
    mimeType: string;
    data: string; // base64
    agentKeys?: string;
    category?: string;
    siteKeys?: string | null;
    excludedSiteKeys?: string | null;
  }) {
    if (!body.data) throw new BadRequestException('data (base64) is required');
    if (!body.filename) throw new BadRequestException('filename is required');
    const buf = Buffer.from(body.data, 'base64');
    return this.ingestion.ingestFile(buf, body.filename, body.mimeType ?? '', {
      agentKeys: body.agentKeys,
      category: body.category,
      siteKeys: body.siteKeys ?? null,
      excludedSiteKeys: body.excludedSiteKeys ?? null,
    });
  }

  // ─── Writing Samples ───────────────────────────────────────────────────────

  @Get('samples')
  listSamples(@Query('agentKey') agentKey?: string, @Query('siteKey') siteKey?: string) {
    const site = siteKey?.trim() ? siteKey.trim() : undefined;
    return this.kb.listSamples(agentKey, site);
  }

  @Post('samples')
  createSample(@Body() body: {
    context: string;
    sampleText: string;
    polarity?: string;
    agentKeys?: string;
    siteKeys?: string | null;
    excludedSiteKeys?: string | null;
  }) {
    if (!body.context?.trim()) throw new BadRequestException('context is required');
    if (!body.sampleText?.trim()) throw new BadRequestException('sampleText is required');
    return this.kb.createSample(body);
  }

  @Patch('samples/:id')
  async updateSample(@Param('id') id: string, @Body() body: {
    context?: string;
    sampleText?: string;
    polarity?: string;
    agentKeys?: string | null;
    siteKeys?: string | null;
    excludedSiteKeys?: string | null;
  }) {
    const row = await this.kb.updateSample(id, body);
    if (!row) throw new NotFoundException('Sample not found');
    return row;
  }

  @Delete('samples/:id')
  async deleteSample(@Param('id') id: string) {
    const row = await this.kb.deleteSample(id);
    if (!row) throw new NotFoundException('Sample not found');
    return { ok: true };
  }

  @Post('samples/bulk-delete')
  async bulkDeleteSamples(@Body() body: { ids: string[] }) {
    if (!Array.isArray(body?.ids) || !body.ids.length) {
      throw new BadRequestException('ids array is required');
    }
    return this.kb.deleteSamples(body.ids);
  }

  // ─── Prompt Templates ─────────────────────────────────────────────────────

  @Get('templates')
  listTemplates() {
    return this.kb.listTemplates();
  }

  @Post('templates')
  createTemplate(@Body() body: { key: string; system: string; userTemplate: string }) {
    if (!body.key?.trim()) throw new BadRequestException('key is required');
    if (!body.system?.trim()) throw new BadRequestException('system is required');
    return this.kb.createTemplate(body);
  }

  @Patch('templates/:id')
  async updateTemplate(@Param('id') id: string, @Body() body: { system?: string; userTemplate?: string }) {
    const row = await this.kb.updateTemplate(id, body);
    if (!row) throw new NotFoundException('Template not found');
    return row;
  }

  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string) {
    const row = await this.kb.deleteTemplate(id);
    if (!row) throw new NotFoundException('Template not found');
    return { ok: true };
  }

  // ─── Self-improvement proposals ───────────────────────────────────────────

  @Get('proposals')
  listProposals(@Query('status') status?: string) {
    return this.selfImprove.listProposals(status);
  }

  @Post('proposals/:id/approve')
  async approveProposal(@Param('id') id: string) {
    await this.selfImprove.approveProposal(id);
    return { ok: true };
  }

  @Post('proposals/:id/reject')
  async rejectProposal(@Param('id') id: string) {
    await this.selfImprove.rejectProposal(id);
    return { ok: true };
  }
}
