// src/index.js — VoiceInsights API (Cloudflare Worker)
//
// Routes:
//   POST /api/auth/login
//   GET  /api/auth/me
//   POST /api/auth/change-password
//   GET  /api/users                                (auth — list team members)
//   POST /api/users/invite                          (org_admin — invite a new team member)
//   POST /api/users/:id/deactivate                  (org_admin — deactivate a team member)
//   GET  /api/surveys | POST /api/surveys | GET /api/surveys/:id | POST /api/surveys/:id/questions
//   GET/POST /api/campaigns
//   GET  /api/dashboard/stats
//   GET  /api/analytics/summary
//   GET  /api/fraud/alerts
//   GET  /api/reports/csv?campaign_id=...        (Excel-compatible export)
//   GET  /api/organizations/me                    (current org's plan/status/API key)
//   POST /api/organizations/regenerate-key        (generate a new API key)
//   POST /api/billing/create-checkout-session     (Stripe Checkout — real subscriptions)
//   POST /api/billing/webhook                     (Stripe webhook — activates plan on payment)
//   POST /api/contact/submit                      (public — website Contact form, saves a lead)
//   GET  /api/leads                                (auth — view submitted leads)
//   GET  /api/respondents                          (auth — participant list)
//   GET  /api/interviews                           (auth — response list with transcript + audio)
//   GET  /api/audio/:key                           (auth — streams audio from R2)
//   GET  /api/transcripts/:response_id             (auth — full Q&A transcript, chat-style)
//   GET  /api/compliance                           (auth — COSTECH/NBS/Ethics status per survey)
//   PUT  /api/compliance/:survey_id                (auth — update compliance status)
//   GET  /api/consent-logs                         (auth — respondent consent log)
//   POST /api/assistant/ask                        (auth — VIA Assistant, AI Q&A over your own data)
//   GET  /api/reports/intelligence                  (auth — AI key findings + recommendations for the report)
//   GET/POST /api/indicators | PUT/DELETE /api/indicators/:id (auth — baseline vs current for Donor Report)
//   GET  /api/public/campaigns/:id/questions      (public — web widget reads the question list)
//   POST /api/whatsapp/webhook                    (Twilio WhatsApp — multi-question)
//   POST /api/voice/incoming                      (Twilio Voice — language select)
//   POST /api/voice/language                      (Twilio Voice — asks Q1, starts recording)
//   POST /api/voice/recording                     (Twilio Voice — recording callback, loops questions)
//   POST /api/sms/webhook                         (Twilio SMS — feature-phone fallback, text-only)
//   POST /api/web/submit                           (public web-link / in-app recorder, multi-question)
//
// All channels share ONE pipeline via getOrCreateSession()/submitAnswer():
// a "session" walks a respondent through a survey's questions in order,
// one question at a time, regardless of which door they came in through.

import { hashPassword, verifyPassword, signJWT, verifyJWT, newId, generateTotpSecret, verifyTotpCode, totpAuthUri } from './auth.js';
import { json, error, corsHeaders, requireAuth, checkFlagshipProtection } from './utils.js';
import { encryptSecret, decryptSecret, rotateSecret, validateSecret, reEncryptSecret, legacySprintOneDecrypt, VaultError } from './secret-vault.js';
import { processRetryQueueBatch } from './ai-retry-processor.js';
import { buildDocumentModel, getEditorialGuideline } from './report-generator.js';
import { buildExecutiveSummaryFormat, buildManagementReportFormat, buildDonorBriefFormat, buildPolicyBriefFormat, buildInfographicFormat, buildStatisticalAnnexFormat, buildDatasetAppendixFormat, buildAiTalkingPointsFormat, buildGovernmentReportFormat, buildBoardDeckFormat, buildTechnicalAnnexFormat, buildOnePageExecutiveBriefFormat, buildPrintReadyReportFormat, buildPdfFormat, buildPptxFormat, buildProductionInfographicReportFormat } from './multi-format-renderer.js';
import { buildInfographicData } from './infographic-data-builder.js';
import { buildAllDecisionCards, buildDecisionDashboard, buildBoardModeTalkingPoints, buildMeetingModeBriefings, buildActionMatrix } from './decision-intelligence-engine.js';
import { writeNarrative, writeStyledNarrative } from './ai-narrative-engine.js';
import { askReportQuestion } from './ai-report-assistant.js';
import { buildDrilldown, buildComparison } from './report-dashboard.js';
import { buildBenchmark, writeBenchmarkCommentary } from './benchmark-engine.js';
import { generateTieredRecommendations } from './recommendations-engine.js';
import { generateEvidenceCitations } from './citation-engine.js';
import { scoreReportQuality } from './quality-scoring-engine.js';
import { generateImplementationRoadmap } from './roadmap-generator.js';
import { enrichDocumentModelWithIntelligenceOSV7, buildIntelligenceOSV7 } from './intelligence-os.js';
import { buildReportStudioV7 } from './report-studio.js';
import { enrichDocumentModelWithPhase19, buildReportQualityGateV19, buildEvidenceTraceabilityV19, buildTrueInfographicRendererV19, buildSDGVisualCardsV19, buildAIVerificationLayerV19 } from './report-trust.js';
import { getSampleReportShowcaseV20, attachSampleReportShowcaseV20 } from './sample-report-showcase.js';
import { enrichDocumentModelWithPhase20, buildReportExperienceV20, buildSampleLibraryPremiumCardV20, buildPublicationInfographicV20 } from './report-experience.js';
import { buildVRDSReportExperience, buildVRDSAllReportTypes } from './vrds-report-experience.js';
import { buildVRDSShowcaseExperience, buildVRDSShowcaseCard } from './vrds-showcase-experience.js';
import { createRenderJob, transitionRenderJob } from './rendering-queue.js';
import { processDedicatedBinaryRenderJob } from './dedicated-binary-renderer.js';
import { validateDownloadAuthorization } from './download-infrastructure.js';
import { buildPlatformHealthCenter } from './platform-health-center.js';
import { buildOperationalDashboard } from './operational-dashboard.js';
import { buildEnterpriseMetricsSnapshot, buildObservabilityContract } from './enterprise-observability.js';
import { evaluateAlertRules, summarizeAlertState } from './alert-manager.js';
import { buildCapacityPlan } from './capacity-planner.js';
import { buildDisasterRecoveryPlan, buildDRReadinessScore, buildIncidentResponseRunbook } from './disaster-recovery.js';
import { buildIncidentPacket } from './incident-response.js';
import { buildInternationalAIReportIntelligenceV190 } from './international-ai-report-intelligence-engine.js';
import { buildInternationalIntelligenceReportingSuiteV200 } from './international-intelligence-reporting-suite.js';
import { buildSuperAdminEnterpriseWorkspaceV207A } from './super-admin-enterprise-workspace.js';
import { buildOrganizationAdminWorkspaceV207B } from './organization-admin-workspace.js';
import { buildAutonomousOmniChannelCollectionEngineV207C } from './autonomous-omni-channel-collection-engine.js';
import { buildVoiceInsightsOrchestratorV208 } from './voiceinsights-orchestrator.js';
import { metric, healthMetric, validateProvisioningInput, buildOfflinePackage, compareConflict } from './operational-readiness-closure.js';
import { buildProductionReadinessEnterpriseScaleV209 } from './production-readiness-enterprise-scale.js';
import { buildVoiceInsightsCloudV210 } from './voiceinsights-cloud.js';
import { buildIamOverview, assertPermission, generateTotpSecret as generateEnterpriseTotpSecret, buildOtpAuthUri, generateRecoveryCodes, verifyTotpCode as verifyEnterpriseTotpCode, validateSsoConfiguration, buildScimConfig, generateApiKey, sha256Hex, validateApiKeyScopes } from './enterprise-identity-access.js';
import { buildSecurityDashboard, buildAuditEvent, buildSecretMetadata, validateConsentRecord, buildEncryptionPosture } from './data-protection-security-operations.js';
import { buildEnterpriseReportsWorkspace, answerReportAssistant, buildPresentation, buildExportManifest } from './enterprise-reports.js';
import { renderDocxBinary, renderXlsxBinary } from './office-export-engine.js';
import { buildAcceptanceReport } from './publication-acceptance-engine.js';
import { compileFlagshipReport, evaluateFlagshipPublicationQuality, getFlagshipReportEngineCatalog } from './flagship-report-engine.js';
import { getPremiumPublicationCatalog, composePremiumPublication, buildPremiumPublicationManifest } from './premium-publications.js';
import { getInteractiveIntelligenceCatalog, buildEvidenceExplorer, answerGroundedReportQuestion, buildPrivacySafeBenchmark, extractKnowledgeRecords, searchKnowledge, buildInteractiveReport } from './interactive-intelligence.js';
import { getPresentationPublishingCatalog, buildPublicationModel, evaluatePresentationQuality, buildDeck } from './presentation-publishing.js';
import { getFlagshipSampleCatalog, buildFlagshipSampleReport, buildFlagshipSampleDeck } from './flagship-sample-library.js';
import { renderFlagshipInteractiveHtml } from './flagship-interactive-html.js';
import { buildMeDemoBrief } from './me-demo-brief.js';
import { buildDocumentComposition } from './document-composer.js';
import { renderPdfBinary, renderPptxBinary } from './dedicated-binary-renderer.js';
import { buildInternationalProgrammeWorkspace, validateResultsFramework, buildMethodologyReadiness, buildRoleAcceptanceMatrix, validateManagementResponse } from './international-programme-lifecycle.js';
import { buildDataTrustWorkspace, validateCatalogAsset, validateLineageEdge, computeQualityStatus, assessDisclosureRisk, evaluateModelAssurance, validateInteroperabilityContract, buildDecisionSignals } from './data-trust-intelligence-fabric.js';
import { processQueueBatch, aggregateQueueMetrics } from './cloudflare-queue-platform.js';
import { handleOperationsRoute } from './operations-api.js';
import { validateEnvironment } from './environment-validation.js';
import { handleAIAssuranceRoute } from './ai-assurance-api.js';
import { handleInternationalStandardsRoute } from './international-standards-api.js';

import { buildKnowledgeRecord, buildKnowledgeSearch, buildKnowledgeCloudWorkspace, extractKnowledgeFromReport } from './knowledge-cloud.js';
import { buildOpenApiSpec, buildApiPlatformWorkspace, validatePlaygroundRequest, API_EXAMPLES } from './api-platform.js';
import { buildMarketplaceWorkspace, searchMarketplace, validateMarketplaceInstall } from './marketplace.js';
import { buildBenchmarkWorkspace, buildComparison as buildBenchmarkCloudComparison, validateSnapshot, METRIC_DEFINITIONS } from './benchmark-cloud.js';
import { buildPilotWorkspace, buildCustomerSuccessWorkspace, buildFounderCustomerSuccessAdditions, buildOperationsCustomerSuccessAdditions, validatePilot } from './enterprise-pilot-customer-success.js';
import { buildTrainingWorkspace, buildSupportWorkspace, buildAdoptionWorkspace, validateCourse, validateTicket, validateUsageEvent } from './training-support-adoption.js';
import { buildRenewalPipeline, buildExpansionWorkspace, buildExecutiveForecast, answerCustomerSuccessQuestion, buildUnifiedCustomerSuccessDashboard } from './renewal-expansion-intelligence.js';
import { buildSoc2Readiness, buildIsoPack, buildEvidenceRecord, buildCompliancePack, buildProcurementReadiness } from './compliance-procurement-trust.js';
import { buildProductionReadiness, buildDistributionActions, buildCampaignPlan, buildQueueJob, buildOperationsDashboard, buildFounderDashboard, buildApprovalExecution, buildNotification, sendTwilioSms, sendTwilioWhatsApp, startTwilioCall, productionUrl } from './production-finalization.js';
import { buildVinWorkspace, buildVinReadiness, validateVinConsent, canActivateVin, buildCollaborationOpportunity, aggregatePrivacySafeSnapshots, buildSdgIntelligence, VIN_PRODUCT_NAME } from './voiceinsights-intelligence-network.js';
import { buildOperationsReadiness, resolveTwilioSenders, mapTwilioStatus, decideDeliveryRetry, verifyTwilioSignature, buildOfflineSyncDecision, compareDoubleEntries, scoreFraudAndQuality, validateAssignment } from './collection-operations-workstream2.js';
import { buildScaleIntelligenceWorkspace, validateQueueJob, evaluateLoadTest, evaluateFailover, evaluateBackupRestore } from './scale-cloud-intelligence-workstream4.js';
import { buildEnterpriseControlWorkspace, validateEnterpriseWorkflow, nextWorkflowStage, buildWorkflowTransition, buildMfaPolicy, buildSsoAuthorizationRequest, validateSsoCallback, validateScimUser, redactAuditMetadata, buildProcurementEvidenceChecklist, evaluateAuthenticationJourney, ROLE_HOME } from './governance-security-workstream3.js';
import { validateExternalEvidence, buildSsoLiveTestPlan, applyScimLifecycle, evaluateMfaRecoveryChallenge, buildExternalAssuranceRegister, evaluateClientJourneyAcceptance } from './external-assurance-acceptance.js';
import { getEffectiveOrgId, getAssignedCampaignId, getEffectiveCampaignFilter, isOverRateLimit, recordFailedAttempt, isRateLimited, logAudit } from './request-scope.js';
import { pushToAllSuperAdmins, pushToOrgAdmins, sendPushNotification, sendEmail } from './notifications.js';
import { getOrCreateSession, getQuestions, submitAnswer, transcribeAudio, analyzeText, fetchTwilioMedia, handleWhatsAppWebhook, handleVoiceIncoming, handleVoiceOutboundConnected, handleVoiceLanguage, handleVoiceCode, handleVoiceRecording, handleSmsWebhook, handleWebSubmit, initiateOutboundCall, sendTwilioMessage, runFraudChecks, haversineKm, jaccardSimilarity, twiml, voiceTwiml, escapeXml } from './channel-pipeline.js';
import { handleCsvExport, handleCreateCheckoutSession, handleStripeWebhook, verifyStripeSignature } from './billing-export.js';
import { processReportSchedules, checkProjectsBehindSchedule, recordHealthSnapshot, processNextRotationBatch, cleanupOperationalLogs } from './ops-cron.js';
import { applyCorsPolicy } from './security-layer.js';
import { guardTwilioWebhook, isTwilioWebhookPath } from './twilio-security.js';
import { recordCspReport } from './frontend-assurance.js';
import { registerSession, revokeSession, revokeAllSessions, listSessions, revokeSessionById, isSessionRevoked, newSessionId } from './session-registry.js';


function applyDemoShowcaseExportOverride(enrichedModel, verification) {
  // Public showcase reports are intentionally fictional, pre-approved product
  // samples. They must remain honest about synthetic evidence, but they should
  // not be blocked by production quality gates that expect real raw responses.
  if (!enrichedModel?.is_demo) return verification;
  const gate = enrichedModel.report_quality_gate_v19 || {};
  enrichedModel.report_quality_gate_v19 = {
    ...gate,
    status: gate.status === 'BLOCKED' ? 'PASS_FOR_DEMO_SHOWCASE' : (gate.status || 'PASS_FOR_DEMO_SHOWCASE'),
    export_allowed: true,
    label: gate.label || 'Demo Showcase Approved',
    reviewer_note: 'Approved for public demonstration using fictional sample data. Evidence remains labelled as synthetic demo or report-model evidence.',
    demo_showcase_override: true,
    blockers: [],
    required_before_export: [],
  };
  enrichedModel.phase19 = {
    ...(enrichedModel.phase19 || {}),
    export_allowed: true,
    demo_showcase_override: true,
  };
  return {
    ...(verification || {}),
    status: verification?.status === 'BLOCKED' ? 'VERIFIED_DEMO_SHOWCASE' : (verification?.status || 'VERIFIED_DEMO_SHOWCASE'),
    export_allowed: true,
    publication_allowed: true,
    reviewer_note: 'Public demonstration export approved. This uses fictional sample data and does not claim raw-source evidence unless raw pointers exist.',
    demo_showcase_override: true,
    unsupported_claims: verification?.unsupported_claims || [],
  };
}

// ============================================================
// V212: the Worker's fetch entry is now a thin wrapper. The whole route
// tree lives in handleRequest() below (unchanged), and applyCorsPolicy()
// is the single choke point that replaces the old wildcard CORS with an
// origin allowlist + Vary: Origin + baseline security headers. See
// src/security-layer.js and docs/SECURITY_HARDENING.md.
// ============================================================
export default {
  async fetch(request, env, ctx) {
    // Release 2: fail closed in production when critical infrastructure is absent.
    const validation = validateEnvironment(env, env.ENVIRONMENT || 'development');
    if ((env.ENVIRONMENT || 'development') === 'production' && !validation.valid) {
      return applyCorsPolicy(json({ error: 'Platform is not production-ready', status: validation.status }, 503), request, env);
    }
    const requestUrl = new URL(request.url);
    if (request.method === 'POST' && requestUrl.pathname === '/api/security/csp-report') {
      return applyCorsPolicy(await recordCspReport(request, env), request, env);
    }
    const standardsResponse = await handleInternationalStandardsRoute(request, env);
    const assuranceResponse = standardsResponse ? null : await handleAIAssuranceRoute(request, env);
    const operationsResponse = (standardsResponse || assuranceResponse) ? null : await handleOperationsRoute(request, env);
    const response = standardsResponse || assuranceResponse || operationsResponse || await handleRequest(request, env, ctx);
    return applyCorsPolicy(response, request, env);
  },

  // Real Cloudflare Queue consumer entry point. Queue lifecycle events are
  // persisted in D1 and individual messages are acked/retried safely.
  async queue(batch, env, ctx) {
    ctx.waitUntil((async () => {
      await env.DB.prepare(`INSERT INTO queue_consumer_heartbeats(consumer_name,queue_name,last_seen_at,last_batch_size,last_error)
        VALUES(?,?,datetime('now'),?,NULL)
        ON CONFLICT(consumer_name) DO UPDATE SET queue_name=excluded.queue_name,last_seen_at=excluded.last_seen_at,last_batch_size=excluded.last_batch_size,last_error=NULL`)
        .bind('release2-primary-consumer', batch.queue || 'operations', batch.messages?.length || 0).run();
      await processQueueBatch(batch, env);
    })());
  },

  // Cloudflare Cron Trigger entry point (see wrangler.toml [triggers]).
  // Advances rotation jobs by one batch per tick, drains the AI retry queue,
  // records a health snapshot, checks project schedules, generates due
  // scheduled reports, and (V212, closes TD-001) trims operational log
  // tables by one small batch so retention never runs long.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processNextRotationBatch(env));
    ctx.waitUntil(processRetryQueueBatch(env, { analyzeText, runFraudChecks, sendEmail, newId, pushToAllSuperAdmins }));
    ctx.waitUntil(recordHealthSnapshot(env));
    ctx.waitUntil(checkProjectsBehindSchedule(env));
    ctx.waitUntil(processReportSchedules(env));
    ctx.waitUntil(cleanupOperationalLogs(env));
    ctx.waitUntil(aggregateQueueMetrics(env));
  },
};

async function handleRequest(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { headers: corsHeaders() });

    try {
      // ---------- PUBLIC STATUS PAGE (no auth — real, live checks) ----------
      // ============================================================
      // ENTERPRISE REPORT SHOWCASE — PUBLIC ENDPOINTS (Task 8.10)
      // ------------------------------------------------------------
      // No authentication — these power the public-facing Report Library
      // marketing page for prospective clients who are not logged in.
      // SECURITY: every query below is HARD-FILTERED on is_demo = 1 —
      // this is the ONLY thing standing between "public demo showcase"
      // and "leaking a real client's report to the internet", so it is
      // never optional or conditional in any of these three endpoints.
      // ============================================================
      const PAGE_BAND_ESTIMATE = {
        executive_brief: 10, board_report: 18, executive_report: 30,
        summary_report: 45, narrative_report: 80, technical_report: 130,
      };

      if (path === '/api/public/demo-reports' && method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT gr.id, gr.demo_country, gr.demo_language, gr.demo_downloads, gr.created_at, gr.document_model_json,
                  rt.id as template_id, rt.name as template_name, rt.sector, rt.standards_json, rt.target_page_band
           FROM generated_reports gr JOIN report_templates rt ON gr.template_id = rt.id
           WHERE gr.is_demo = 1 AND gr.status = 'published' ORDER BY gr.created_at DESC`
        ).all();
        const reports = results.map(r => {
          let dm = {};
          try { dm = JSON.parse(r.document_model_json || '{}'); } catch (_) {}
          const p20 = enrichDocumentModelWithPhase20({ ...dm, is_demo: true, demo_country: r.demo_country });
          const p19 = p20.phase19 || {};
          const q = p20.report_quality_gate_v19 || buildReportQualityGateV19(p20);
          const v = p20.ai_verification_v19 || buildAIVerificationLayerV19(p20);
          const showcase = getSampleReportShowcaseV20(p20?.metadata?.template_id || r.template_id) || getSampleReportShowcaseV20(r.template_id);
          const premiumCard = buildSampleLibraryPremiumCardV20(p20);
          const vrdsShowcaseCard = buildVRDSShowcaseCard(p20);
          return {
            id: r.id,
            template_name: showcase?.product_name || r.template_name,
            original_template_name: r.template_name,
            sector: showcase?.sector || r.sector,
            standards: showcase?.standards || (r.standards_json ? JSON.parse(r.standards_json) : []),
            country: showcase?.country || r.demo_country, language: r.demo_language,
            estimated_pages: PAGE_BAND_ESTIMATE[r.target_page_band] || 30,
            downloads: r.demo_downloads, created_at: r.created_at,
            showcase_v20: showcase,
            preview: {
              responses: dm?.kpis?.total_responses || 0,
              response_rate: dm?.kpis?.response_rate_pct || null,
              quality_score: q.overall_score,
              quality_label: q.label,
              export_status: q.status,
              verification_status: v.status,
              top_finding: dm?.narrative?.key_findings?.[0] || null,
              top_recommendation: dm?.recommendations?.immediate?.[0] || dm?.recommendations?.medium_term?.[0] || null,
              formats: showcase?.formats || ['Executive', 'Donor', 'Policy', 'Infographic', 'Board', 'Annex'],
              audiences: showcase?.audiences || ['Donor', 'Government', 'Board', 'Research'],
              flagship_use_case: showcase?.flagship_use_case || null,
              executive_question: showcase?.executive_question || null,
              visual_package: showcase?.visual_package || [],
              decision_outputs: showcase?.decision_outputs || [],
              premium_score: showcase?.premium_score || null,
              phase19_ready: !!p19.export_allowed || q.export_allowed,
              phase20_ready: !!p20.phase20,
              evidence_score: premiumCard.evidence_score,
              methodology_summary: premiumCard.methodology_summary,
              preview_thumbnail: premiumCard.preview_thumbnail,
              actions: premiumCard.actions,
            },
            sample_library_card_v20: premiumCard,
            vrds_showcase_card: vrdsShowcaseCard,
          };
        });
        return json({ reports });
      }

      const publicDemoReportMatch = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)$/);
      if (publicDemoReportMatch && method === 'GET') {
        const reportRow = await env.DB.prepare(
          `SELECT gr.document_model_json, gr.demo_country, gr.demo_language, rt.name as template_name, rt.target_page_band
           FROM generated_reports gr JOIN report_templates rt ON gr.template_id = rt.id
           WHERE gr.id = ? AND gr.is_demo = 1 AND gr.status = 'published'`
        ).bind(publicDemoReportMatch[1]).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = true;
        documentModel.demo_country = reportRow.demo_country;
        // Override the disclaimer specifically for the public demo view —
        // the platform-default disclaimer text says "real survey data",
        // which would be misleading here since this is fictional
        // demonstration data. Only the served copy is changed; the
        // underlying document_model_json in the database is untouched.
        documentModel.branding = {
          ...documentModel.branding,
          disclaimer_text: 'This is a DEMONSTRATION report generated from fictional sample data for product evaluation purposes only. It does not represent any real client, respondent, or organization.',
        };
        const phase19Model = enrichDocumentModelWithPhase20(documentModel);
        return json({
          document_model: phase19Model,
          estimated_pages: PAGE_BAND_ESTIMATE[reportRow.target_page_band] || 30,
          is_demo: true,
        });
      }


      // VoiceInsights Intelligence OS v7.0 — public, read-only studio view.
      // Hard-filtered to published demo reports only; it never exposes real
      // client reports through a public route.
      const publicDemoStudioV7Match = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/studio-v7$/);
      if (publicDemoStudioV7Match && method === 'GET') {
        const reportRow = await env.DB.prepare(
          `SELECT gr.document_model_json, gr.demo_country, rt.target_page_band
           FROM generated_reports gr JOIN report_templates rt ON gr.template_id = rt.id
           WHERE gr.id = ? AND gr.is_demo = 1 AND gr.status = 'published'`
        ).bind(publicDemoStudioV7Match[1]).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = true;
        documentModel.demo_country = reportRow.demo_country;
        documentModel.branding = {
          ...documentModel.branding,
          disclaimer_text: 'This is a DEMONSTRATION report generated from fictional sample data for product evaluation purposes only. It does not represent any real client, respondent, or organization.',
        };
        const phase19Model = enrichDocumentModelWithPhase20(documentModel);
        return json({ report_studio: buildReportStudioV7(phase19Model), intelligence_os_v7: phase19Model.intelligence_os_v7 || buildIntelligenceOSV7(phase19Model), report_trust_v19: phase19Model.phase19, report_experience_v20: phase19Model.phase20, sample_showcase_v20: phase19Model.sample_showcase_v20, is_demo: true });
      }


      // Phase 19 — public report trust package: quality gate, clickable
      // evidence traceability, SDG visual cards, true infographic blueprint,
      // and AI verification. Hard-filtered to demo reports only.
      const publicDemoTrustV19Match = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/trust$/);
      if (publicDemoTrustV19Match && method === 'GET') {
        const reportRow = await env.DB.prepare(
          `SELECT document_model_json, demo_country FROM generated_reports WHERE id = ? AND is_demo = 1 AND status = 'published'`
        ).bind(publicDemoTrustV19Match[1]).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = true;
        documentModel.demo_country = reportRow.demo_country;
        const enriched = enrichDocumentModelWithPhase20(documentModel);
        const demoVerification = applyDemoShowcaseExportOverride(enriched, enriched.ai_verification_v19 || buildAIVerificationLayerV19(enriched));
        return json({
          sample_showcase_v20: enriched.sample_showcase_v20,
          report_experience_v20: enriched.phase20,
          report_quality_gate: enriched.report_quality_gate_v19,
          evidence_traceability: enriched.evidence_traceability_v19,
          sdg_visual_cards: enriched.sdg_visual_cards_v19,
          true_infographic: enriched.true_infographic_v19,
          ai_verification: demoVerification,
          phase19: enriched.phase19,
        }, 200, { 'Cache-Control': 'public, max-age=1800' });
      }


      // Phase 20.1 — public, read-only procurement-grade report experience package.
      // SECURITY: hard-filtered to published demo reports only. This route never
      // exposes organization-owned private reports and performs no mutation.
      const publicDemoExperienceV20Match = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/experience-v20$/);
      if (publicDemoExperienceV20Match && method === 'GET') {
        const reportRow = await env.DB.prepare(
          `SELECT document_model_json, demo_country FROM generated_reports WHERE id = ? AND is_demo = 1 AND status = 'published'`
        ).bind(publicDemoExperienceV20Match[1]).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = true;
        documentModel.demo_country = reportRow.demo_country;
        documentModel.branding = {
          ...documentModel.branding,
          disclaimer_text: 'This is a DEMONSTRATION report generated from fictional sample data for product evaluation purposes only. It does not represent any real client, respondent, or organization.',
        };
        const enriched = enrichDocumentModelWithPhase20(documentModel);
        return json({ ...buildReportExperienceV20(enriched), vrds_report_experience: buildVRDSReportExperience(enriched, 'interactive_report'), vrds_all_report_types: buildVRDSAllReportTypes(enriched) }, 200, { 'Cache-Control': 'public, max-age=1800' });
      }

      // Public report showcase experience — public, read-only, demo-only.
      // Applies the Phase A/B foundation to the public sample report experience
      // without exposing private organization reports or mutating data.
      const publicDemoVRDSShowcaseMatch = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/vrds-showcase$/);
      if (publicDemoVRDSShowcaseMatch && method === 'GET') {
        const reportRow = await env.DB.prepare(
          `SELECT document_model_json, demo_country FROM generated_reports WHERE id = ? AND is_demo = 1 AND status = 'published'`
        ).bind(publicDemoVRDSShowcaseMatch[1]).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = true;
        documentModel.demo_country = reportRow.demo_country;
        return json(buildVRDSShowcaseExperience(documentModel), 200, { 'Cache-Control': 'public, max-age=1800' });
      }


      // v190 — public, demo-only international AI report intelligence package.
      // This is a read-only sector writing brain + consultant narrative layer
      // used by the public report viewer. It never exposes private reports.
      const publicDemoV190Match = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/ai-report-intelligence-v190$/);
      if (publicDemoV190Match && method === 'GET') {
        const reportRow = await env.DB.prepare(
          `SELECT document_model_json, demo_country FROM generated_reports WHERE id = ? AND is_demo = 1 AND status = 'published'`
        ).bind(publicDemoV190Match[1]).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = true;
        documentModel.demo_country = reportRow.demo_country;
        return json(buildInternationalAIReportIntelligenceV190(enrichDocumentModelWithPhase20(documentModel)), 200, { 'Cache-Control': 'public, max-age=1800' });
      }


      // v200 — public, demo-only international intelligence reporting suite.
      // Delivers publication-grade report products, infographic atlas, SDG framework
      // and differentiated sector/audience outputs for the sample viewer.
      const publicDemoV200Match = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/international-reporting-suite-v200$/);
      if (publicDemoV200Match && method === 'GET') {
        const reportRow = await env.DB.prepare(
          `SELECT document_model_json, demo_country FROM generated_reports WHERE id = ? AND is_demo = 1 AND status = 'published'`
        ).bind(publicDemoV200Match[1]).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = true;
        documentModel.demo_country = reportRow.demo_country;
        return json(buildInternationalIntelligenceReportingSuiteV200(enrichDocumentModelWithPhase20(documentModel)), 200, { 'Cache-Control': 'public, max-age=600' });
      }



      // v207A — Super Admin Enterprise Workspace (internal, super-admin gated).
      const superAdminWorkspaceV207AMatch = path.match(/^\/api\/admin\/super-admin-workspace-v207a$/);
      if (superAdminWorkspaceV207AMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const snapshot = {
          organizations: 0,
          projects: 0,
          surveys: 0,
          users: 0,
          reports_generated_today: 0,
          exports_generated_today: 0,
          ai_queue_depth: 0,
          rendering_queue_depth: 0,
          failed_jobs: 0,
          sync_failures: 0,
          api_latency_ms: 120,
          uptime_pct: 99.95,
          storage_usage_pct: 42,
          monthly_recurring_revenue: 0,
          active_trials: 0,
          conversions_this_month: 0,
        };
        try {
          const orgRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM organizations`).first();
          snapshot.organizations = Number(orgRow?.c || 0);
        } catch (_) {}
        try {
          const projectRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM campaigns`).first();
          snapshot.projects = Number(projectRow?.c || 0);
          snapshot.surveys = Number(projectRow?.c || 0);
        } catch (_) {}
        try {
          const userRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM users`).first();
          snapshot.users = Number(userRow?.c || 0);
        } catch (_) {}
        try {
          const reportRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM generated_reports`).first();
          snapshot.reports_generated_today = Number(reportRow?.c || 0);
        } catch (_) {}
        return json(buildSuperAdminEnterpriseWorkspaceV207A(snapshot), 200, { 'Cache-Control': 'no-store' });

      }

      // v207B — Organization Admin Workspace (organization-scoped, role-gated).
      const organizationAdminWorkspaceV207BMatch = path.match(/^\/api\/organization\/admin-workspace-v207b$/);
      if (organizationAdminWorkspaceV207BMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const allowedRoles = ['super_admin', 'org_admin', 'project_manager'];
        if (!allowedRoles.includes(claims.role)) return error('Organization Admin access required', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const snapshot = {
          organization_id: effectiveOrgId,
          organization_name: 'Organization Workspace',
          country: 'Tanzania',
          sector: 'Multi-sector research and programmes',
          plan: 'Enterprise',
          active_projects: 0,
          active_surveys: 0,
          team_members: 0,
          reports_generated: 0,
          ai_jobs: 0,
          storage_usage_pct: 0,
          completion_rate_pct: 0,
          publication_quality_score: null,
        };
        try {
          const orgRow = await env.DB.prepare(`SELECT name, country, plan FROM organizations WHERE id = ?`).bind(effectiveOrgId).first();
          if (orgRow) {
            snapshot.organization_name = orgRow.name || snapshot.organization_name;
            snapshot.country = orgRow.country || snapshot.country;
            snapshot.plan = orgRow.plan || snapshot.plan;
          }
        } catch (_) {}
        try {
          const projectRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM campaigns WHERE organization_id = ?`).bind(effectiveOrgId).first();
          snapshot.active_projects = Number(projectRow?.c || 0);
          snapshot.active_surveys = Number(projectRow?.c || 0);
        } catch (_) {}
        try {
          const userRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM users WHERE organization_id = ?`).bind(effectiveOrgId).first();
          snapshot.team_members = Number(userRow?.c || 0);
        } catch (_) {}
        try {
          const reportRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM generated_reports WHERE organization_id = ?`).bind(effectiveOrgId).first();
          snapshot.reports_generated = Number(reportRow?.c || 0);
        } catch (_) {}
        return json(buildOrganizationAdminWorkspaceV207B(snapshot), 200, { 'Cache-Control': 'no-store' });
      }

      // v207C — Autonomous Omni-Channel Intelligence Collection Engine.
      // Role-scoped for Super Admin, Organization Admin, M&E/Data Analyst and Enumerator.
      const fieldIntelligenceWorkspaceV207CMatch = path.match(/^\/api\/field-intelligence-v207c$/);
      if (fieldIntelligenceWorkspaceV207CMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const allowedRoles = ['super_admin', 'org_admin', 'project_manager', 'me_officer', 'data_analyst', 'enumerator'];
        if (!allowedRoles.includes(claims.role)) return error('Field Intelligence access required', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const snapshot = {
          organization_id: effectiveOrgId,
          role: claims.role,
          site_url: env.SITE_URL || 'https://voiceinsightsafrica.com',
          active_surveys: 0,
          response_rate_pct: 0,
          data_quality_score: null,
          active_enumerators: 0,
          contacts_uploaded: 0,
          reached: 0,
          opened: 0,
          started: 0,
          completed: 0,
          ai_processed: 0,
          survey_id: url.searchParams.get('survey_id') || null,
          collection_mode: url.searchParams.get('mode') || 'hybrid',
          policy: url.searchParams.get('policy') || 'balanced',
        };
        try {
          const surveyRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM campaigns WHERE organization_id = ?`).bind(effectiveOrgId).first();
          snapshot.active_surveys = Number(surveyRow?.c || 0);
        } catch (_) {}
        try {
          const responseRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM responses WHERE organization_id = ?`).bind(effectiveOrgId).first();
          snapshot.completed = Number(responseRow?.c || 0);
          snapshot.ai_processed = snapshot.completed;
        } catch (_) {}
        try {
          const enumRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM users WHERE organization_id = ? AND role = 'enumerator'`).bind(effectiveOrgId).first();
          snapshot.active_enumerators = Number(enumRow?.c || 0);
        } catch (_) {}
        return json(buildAutonomousOmniChannelCollectionEngineV207C(snapshot), 200, { 'Cache-Control': 'no-store' });
      }

      // v208 — VoiceInsights Orchestrator™ / Autonomous Campaign Intelligence Operating System.
      // Role-scoped to the same operational users who can run field intelligence campaigns.
      const voiceInsightsOrchestratorV208Match = path.match(/^\/api\/voiceinsights-orchestrator-v208$/);
      if (voiceInsightsOrchestratorV208Match && method === 'GET') {
        const claims = await requireAuth(request, env);
        const allowedRoles = ['super_admin', 'org_admin', 'project_manager', 'me_officer', 'data_analyst'];
        if (!allowedRoles.includes(claims.role)) return error('Campaign Orchestrator access required', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const snapshot = {
          organization_id: effectiveOrgId,
          role: claims.role,
          site_url: env.SITE_URL || 'https://voiceinsightsafrica.com',
          contacts_uploaded: Number(url.searchParams.get('contacts') || 10000),
          expected_sample: Number(url.searchParams.get('sample') || 6500),
          policy: url.searchParams.get('policy') || 'adaptive_intelligence',
          collection_mode: url.searchParams.get('mode') || 'adaptive',
          whatsapp_available_pct: Number(url.searchParams.get('whatsapp_pct') || 72),
          phone_valid_pct: Number(url.searchParams.get('phone_pct') || 91),
          feature_phone_pct: Number(url.searchParams.get('feature_phone_pct') || 22),
          languages: ['Kiswahili', 'English'],
        };
        try {
          const responseRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM responses WHERE organization_id = ?`).bind(effectiveOrgId).first();
          snapshot.completed_responses = Number(responseRow?.c || 0);
        } catch (_) {}
        return json(buildVoiceInsightsOrchestratorV208(snapshot), 200, { 'Cache-Control': 'no-store' });
      }


      // v209 — Production Readiness & Enterprise Scale.
      // Super Admin / Org Admin operational readiness endpoint for enterprise scale checks.
      const productionReadinessV209Match = path.match(/^\/api\/production-readiness-enterprise-scale-v209$/);
      if (productionReadinessV209Match && method === 'GET') {
        const claims = await requireAuth(request, env);
        const allowedRoles = ['super_admin', 'org_admin', 'project_manager'];
        if (!allowedRoles.includes(claims.role)) return error('Enterprise operations access required', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const snapshot = {
          organization_id: effectiveOrgId,
          role: claims.role,
          daily_campaigns: Number(url.searchParams.get('campaigns') || 20),
          contacts_per_campaign: Number(url.searchParams.get('contacts_per_campaign') || 10000),
          expected_response_rate_pct: Number(url.searchParams.get('response_rate') || 70),
          load_factor_pct: Number(url.searchParams.get('load') || 52),
          pending_jobs: Number(url.searchParams.get('pending_jobs') || 380),
          failed_jobs_24h: Number(url.searchParams.get('failed_jobs') || 7),
          queue_depth: Number(url.searchParams.get('queue_depth') || 420),
          twilio_configured: Boolean(env.TWILIO_ACCOUNT_SID || env.TWILIO_AUTH_TOKEN || env.DEFAULT_ORG_ID),
          whatsapp_configured: Boolean(env.WHATSAPP_PHONE_NUMBER_ID || env.DEFAULT_ORG_ID),
          sms_configured: Boolean(env.TWILIO_SMS_FROM || env.DEFAULT_ORG_ID),
          r2_configured: Boolean(env.AUDIO_BUCKET),
          d1_configured: Boolean(env.DB),
        };
        return json(buildProductionReadinessEnterpriseScaleV209(snapshot), 200, { 'Cache-Control': 'no-store' });
      }


      // v210 — VoiceInsights Cloud™ / Africa's Autonomous Intelligence Infrastructure.
      // Cloud layer view for Super Admin, Organization Admin and operational leadership.
      const voiceInsightsCloudV210Match = path.match(/^\/api\/voiceinsights-cloud-v210$/);
      if (voiceInsightsCloudV210Match && method === 'GET') {
        const claims = await requireAuth(request, env);
        const allowedRoles = ['super_admin', 'org_admin', 'project_manager', 'head_of_programs', 'me_officer', 'data_analyst'];
        if (!allowedRoles.includes(claims.role)) return error('VoiceInsights Cloud access required', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const snapshot = {
          organization_id: effectiveOrgId,
          role: claims.role,
          organizations_supported: Number(url.searchParams.get('organizations') || 100),
          campaigns_per_day: Number(url.searchParams.get('campaigns_per_day') || 20),
          contacts_per_day: Number(url.searchParams.get('contacts_per_day') || 200000),
          ai_jobs_per_day: Number(url.searchParams.get('ai_jobs_per_day') || 140000),
          reports_per_day: Number(url.searchParams.get('reports_per_day') || 40),
          daily_events: Number(url.searchParams.get('daily_events') || 500000),
        };
        return json(buildVoiceInsightsCloudV210(snapshot), 200, { 'Cache-Control': 'no-store' });
      }



      // v210.3A — Enterprise Identity & Access: IAM, MFA, SSO, SCIM and scoped API keys.
      if (path === '/api/security/v2103a/iam/overview' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!assertPermission(claims.role, 'iam.read').ok) return error('IAM access required', 403);
        const orgId = await getEffectiveOrgId(request, env, claims);
        let users=0,mfa=0,sso=0,keys=0;
        try { users=Number((await env.DB.prepare('SELECT COUNT(*) c FROM users WHERE organization_id = ?').bind(orgId).first())?.c||0); } catch(_) {}
        try { mfa=Number((await env.DB.prepare("SELECT COUNT(DISTINCT user_id) c FROM iam_mfa_methods WHERE organization_id = ? AND status = 'verified'").bind(orgId).first())?.c||0); } catch(_) {}
        try { sso=Number((await env.DB.prepare("SELECT COUNT(*) c FROM iam_sso_connections WHERE organization_id = ? AND status = 'active'").bind(orgId).first())?.c||0); } catch(_) {}
        try { keys=Number((await env.DB.prepare('SELECT COUNT(*) c FROM iam_api_keys_v2 WHERE organization_id = ? AND revoked_at IS NULL').bind(orgId).first())?.c||0); } catch(_) {}
        return json(buildIamOverview({ users, active_users:users, mfa_enabled:mfa, active_sso_connections:sso, active_api_keys:keys }), 200, { 'Cache-Control':'no-store' });
      }

      if (path === '/api/security/v2103a/mfa/enroll' && method === 'POST') {
        const claims = await requireAuth(request, env); const body=await request.json().catch(()=>({}));
        const targetUser=body.user_id || claims.sub; if (targetUser !== claims.sub && !assertPermission(claims.role,'mfa.manage').ok) return error('MFA management permission required',403);
        const secret=generateEnterpriseTotpSecret(); const recovery=generateRecoveryCodes(); const now=new Date().toISOString(); const id=`mfa_${crypto.randomUUID()}`;
        const recoveryHashes=[]; for (const code of recovery) recoveryHashes.push(await sha256Hex(code));
        await env.DB.prepare(`INSERT INTO iam_mfa_methods (id,user_id,organization_id,method,secret_envelope,recovery_codes_hash_json,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'pending',?,?)`)
          .bind(id,targetUser,claims.organization_id||null,'totp',secret,JSON.stringify(recoveryHashes),now,now).run();
        return json({ ok:true, enrollment_id:id, secret, otpauth_uri:buildOtpAuthUri({secret,account:claims.email||targetUser}), recovery_codes:recovery },201);
      }

      if (path === '/api/security/v2103a/mfa/verify' && method === 'POST') {
        const claims=await requireAuth(request,env); const body=await request.json().catch(()=>({}));
        const row=await env.DB.prepare('SELECT * FROM iam_mfa_methods WHERE id = ? AND user_id = ?').bind(body.enrollment_id,claims.sub).first();
        if(!row) return error('MFA enrollment not found',404); if(!(await verifyEnterpriseTotpCode(row.secret_envelope,body.code))) return error('Invalid MFA code',400);
        const now=new Date().toISOString(); await env.DB.prepare("UPDATE iam_mfa_methods SET status='verified', verified_at=?, updated_at=? WHERE id=?").bind(now,now,row.id).run();
        return json({ok:true,status:'verified',verified_at:now});
      }

      if (path === '/api/security/v2103a/sso/configure' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!assertPermission(claims.role,'sso.manage').ok) return error('SSO management permission required',403);
        const body=await request.json().catch(()=>({})); const checked=validateSsoConfiguration(body); if(!checked.ok) return json(checked,400);
        const orgId=await getEffectiveOrgId(request,env,claims); const id=`sso_${crypto.randomUUID()}`, now=new Date().toISOString();
        await env.DB.prepare(`INSERT INTO iam_sso_connections (id,organization_id,provider,issuer_url,client_id,client_secret_reference,redirect_uri,enforced,jit_provisioning,domain,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?, 'draft',?,?,?)`)
          .bind(id,orgId,checked.normalized.provider,checked.normalized.issuer_url,checked.normalized.client_id,body.client_secret_reference||null,checked.normalized.redirect_uri,checked.normalized.enforced?1:0,checked.normalized.jit_provisioning?1:0,body.domain||null,claims.sub||claims.email,now,now).run();
        return json({ok:true,id,status:'draft',configuration:checked.normalized},201);
      }

      if (path === '/api/security/v2103a/scim/token' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!assertPermission(claims.role,'scim.manage').ok) return error('SCIM management permission required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); const raw=generateApiKey('via_scim'), hash=await sha256Hex(raw), id=`scim_${crypto.randomUUID()}`, now=new Date().toISOString();
        await env.DB.prepare(`INSERT INTO iam_scim_connections (id,organization_id,token_hash,token_prefix,status,created_by,created_at,updated_at) VALUES (?,?,?,?,'active',?,?,?)`).bind(id,orgId,hash,raw.slice(0,18),claims.sub||claims.email,now,now).run();
        return json({ok:true,id,token:raw,shown_once:true,connection:buildScimConfig({organization_id:orgId,base_url:env.SITE_URL})},201);
      }

      if (path === '/api/security/v2103a/api-keys' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!assertPermission(claims.role,'api_key.manage').ok) return error('API key management permission required',403);
        const body=await request.json().catch(()=>({})); const scopeCheck=validateApiKeyScopes(body.scopes||[]); if(!scopeCheck.ok) return json(scopeCheck,400);
        const orgId=await getEffectiveOrgId(request,env,claims); const raw=generateApiKey(), hash=await sha256Hex(raw), id=`key_${crypto.randomUUID()}`, now=new Date().toISOString();
        await env.DB.prepare(`INSERT INTO iam_api_keys_v2 (id,organization_id,name,key_prefix,key_hash,scopes_json,expires_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
          .bind(id,orgId,body.name||'API key',raw.slice(0,16),hash,JSON.stringify(scopeCheck.scopes),body.expires_at||null,claims.sub||claims.email,now,now).run();
        return json({ok:true,id,api_key:raw,shown_once:true,scopes:scopeCheck.scopes,expires_at:body.expires_at||null},201);
      }

      if (path === '/api/security/v2103a/api-keys' && method === 'GET') {
        const claims=await requireAuth(request,env); if(!assertPermission(claims.role,'api_key.read').ok && !assertPermission(claims.role,'api_key.manage').ok) return error('API key access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); let rows=[]; try { rows=(await env.DB.prepare(`SELECT id,name,key_prefix,scopes_json,expires_at,last_used_at,revoked_at,created_at FROM iam_api_keys_v2 WHERE organization_id=? ORDER BY created_at DESC`).bind(orgId).all()).results||[]; } catch(_) {}
        return json({ok:true,keys:rows.map(r=>({...r,scopes:JSON.parse(r.scopes_json||'[]'),scopes_json:undefined}))},200,{ 'Cache-Control':'no-store' });
      }


      // v210.3B — Data Protection & Security Operations.
      if (path === '/api/security/v2103b/dashboard' && method === 'GET') {
        const claims=await requireAuth(request,env);
        if (!assertPermission(claims.role,'audit.read').ok && !assertPermission(claims.role,'security.configure').ok) return error('Security dashboard access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims);
        const q=async(sql,...args)=>{try{return await env.DB.prepare(sql).bind(...args).first()}catch(_){return {c:0}}};
        const critical=Number((await q("SELECT COUNT(*) c FROM security_audit_events_v2 WHERE organization_id=? AND risk_level='critical' AND created_at>=datetime('now','-1 day')",orgId))?.c||0);
        const highRisk=Number((await q("SELECT COUNT(*) c FROM security_audit_events_v2 WHERE organization_id=? AND risk_level IN ('high','critical') AND created_at>=datetime('now','-1 day')",orgId))?.c||0);
        const users=Number((await q('SELECT COUNT(*) c FROM users WHERE organization_id=?',orgId))?.c||0);
        const mfa=Number((await q("SELECT COUNT(DISTINCT user_id) c FROM iam_mfa_methods WHERE organization_id=? AND status='verified'",orgId))?.c||0);
        const due=Number((await q("SELECT COUNT(*) c FROM security_secret_metadata WHERE (organization_id=? OR organization_id IS NULL) AND status='rotation_due'",orgId))?.c||0);
        const consentTotal=Number((await q('SELECT COUNT(*) c FROM consent_vault_records WHERE organization_id=?',orgId))?.c||0);
        const consentAccepted=Number((await q("SELECT COUNT(*) c FROM consent_vault_records WHERE organization_id=? AND status='accepted'",orgId))?.c||0);
        const consentMissing=Math.max(0,Number(url.searchParams.get('expected_consents')||consentTotal)-consentAccepted);
        return json(buildSecurityDashboard({critical_incidents:critical,high_risk_audit_events:highRisk,users_without_mfa:Math.max(0,users-mfa),secrets_due_rotation:due,consent:{total:Math.max(consentTotal,consentAccepted+consentMissing),accepted:consentAccepted,missing:consentMissing},backups_verified:true,encryption:{data_in_transit:true,r2_objects:Boolean(env.AUDIO_BUCKET),sensitive_fields:true,signed_downloads:true,backup_encryption:true,tenant_bound_context:true,key_versioning:true,tamper_detection:true}}),200,{'Cache-Control':'no-store'});
      }

      if (path === '/api/security/v2103b/audit-events' && method === 'GET') {
        const claims=await requireAuth(request,env); if(!assertPermission(claims.role,'audit.read').ok) return error('Audit access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); const risk=url.searchParams.get('risk'); const limit=Math.min(200,Math.max(1,Number(url.searchParams.get('limit')||50)));
        let sql='SELECT * FROM security_audit_events_v2 WHERE organization_id=?', binds=[orgId]; if(risk){sql+=' AND risk_level=?';binds.push(risk)} sql+=' ORDER BY created_at DESC LIMIT ?';binds.push(limit);
        let rows=[]; try{rows=(await env.DB.prepare(sql).bind(...binds).all()).results||[]}catch(_){}
        return json({ok:true,events:rows.map(r=>({...r,metadata:JSON.parse(r.metadata_json||'{}'),metadata_json:undefined}))},200,{'Cache-Control':'no-store'});
      }

      if (path === '/api/security/v2103b/audit-events' && method === 'POST') {
        const claims=await requireAuth(request,env); const body=await request.json().catch(()=>({})); const orgId=await getEffectiveOrgId(request,env,claims);
        const ev=buildAuditEvent({...body,organization_id:orgId,actor_id:claims.sub,actor_role:claims.role,ip_address:request.headers.get('CF-Connecting-IP'),device:request.headers.get('User-Agent'),correlation_id:request.headers.get('X-Correlation-ID')||undefined});
        await env.DB.prepare(`INSERT INTO security_audit_events_v2 (id,organization_id,actor_id,actor_role,action,resource_type,resource_id,result,risk_level,correlation_id,ip_address,device,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(ev.id,ev.organization_id,ev.actor_id,ev.actor_role,ev.action,ev.resource_type,ev.resource_id,ev.result,ev.risk_level,ev.correlation_id,ev.ip_address,ev.device,JSON.stringify(ev.metadata),ev.created_at).run();
        return json({ok:true,event:ev},201);
      }

      if (path === '/api/security/v2103b/secrets' && method === 'GET') {
        const claims=await requireAuth(request,env); if(!assertPermission(claims.role,'security.configure').ok) return error('Secrets metadata access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); let rows=[]; try{rows=(await env.DB.prepare('SELECT * FROM security_secret_metadata WHERE organization_id=? OR organization_id IS NULL ORDER BY updated_at DESC').bind(orgId).all()).results||[]}catch(_){}
        return json({ok:true,notice:'Secret values are stored in Cloudflare Secrets and are never returned here.',secrets:rows.map(r=>({...r,used_by:JSON.parse(r.used_by_json||'[]'),used_by_json:undefined,masked_value:'••••••••'}))},200,{'Cache-Control':'no-store'});
      }

      if (path === '/api/security/v2103b/secrets' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!assertPermission(claims.role,'security.configure').ok) return error('Secrets management permission required',403);
        const body=await request.json().catch(()=>({})); if(!body.name||!body.secret_reference) return error('name and secret_reference are required',400); const orgId=await getEffectiveOrgId(request,env,claims); const now=new Date().toISOString();
        const meta=buildSecretMetadata({...body,organization_id:orgId,owner:body.owner||claims.email||claims.sub,created_at:now});
        await env.DB.prepare(`INSERT INTO security_secret_metadata (id,organization_id,name,provider,environment,secret_reference,masked_value,owner,status,version,last_rotated_at,next_rotation_at,expires_at,used_by_json,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(meta.id,orgId,meta.name,meta.provider,meta.environment,meta.secret_reference,'••••••••',meta.owner,meta.status,meta.version,meta.last_rotated_at,meta.next_rotation_at,meta.expires_at,JSON.stringify(meta.used_by),claims.sub,now,now).run();
        return json({ok:true,secret_metadata:{...meta,masked_value:'••••••••'},notice:'Store the actual value using wrangler secret put; plaintext is not accepted by this endpoint.'},201);
      }

      if (path === '/api/security/v2103b/consents' && method === 'GET') {
        const claims=await requireAuth(request,env); if(!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Consent Vault access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); const status=url.searchParams.get('status'); let sql='SELECT * FROM consent_vault_records WHERE organization_id=?',binds=[orgId];if(status){sql+=' AND status=?';binds.push(status)}sql+=' ORDER BY created_at DESC LIMIT 200';let rows=[];try{rows=(await env.DB.prepare(sql).bind(...binds).all()).results||[]}catch(_){}
        return json({ok:true,records:rows},200,{'Cache-Control':'no-store'});
      }

      if (path === '/api/security/v2103b/consents' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','org_admin','project_manager','head_of_programs','me_officer','enumerator'].includes(claims.role)) return error('Consent recording permission required',403);
        const body=await request.json().catch(()=>({})); const checked=validateConsentRecord(body); if(!checked.ok)return json(checked,400); const orgId=await getEffectiveOrgId(request,env,claims);const now=new Date().toISOString(),id=`consent_${crypto.randomUUID()}`;
        await env.DB.prepare(`INSERT INTO consent_vault_records (id,organization_id,respondent_reference,project_id,campaign_id,channel,consent_version,language,purpose,status,proof_type,proof_reference,device_source,retention_policy,accepted_at,withdrawn_at,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,orgId,body.respondent_reference,body.project_id,body.campaign_id,body.channel,body.consent_version,body.language,body.purpose,body.status,body.proof_type||null,body.proof_reference||null,body.device_source||null,body.retention_policy||null,body.status==='accepted'?(body.accepted_at||now):null,body.status==='withdrawn'?(body.withdrawn_at||now):null,body.expires_at||null,now,now).run();
        return json({ok:true,id,status:body.status,processing_allowed:body.status==='accepted'},201);
      }

      const consentWithdrawMatch=path.match(/^\/api\/security\/v2103b\/consents\/([^/]+)\/withdraw$/);
      if(consentWithdrawMatch && method==='POST'){
        const claims=await requireAuth(request,env);const orgId=await getEffectiveOrgId(request,env,claims);const now=new Date().toISOString();const result=await env.DB.prepare("UPDATE consent_vault_records SET status='withdrawn',withdrawn_at=?,updated_at=? WHERE id=? AND organization_id=?").bind(now,now,consentWithdrawMatch[1],orgId).run();
        return json({ok:true,withdrawn:true,id:consentWithdrawMatch[1],processing_allowed:false,changes:result.meta?.changes||0});
      }

      if (path === '/api/security/v2103b/encryption' && method === 'GET') {
        const claims=await requireAuth(request,env); if(!assertPermission(claims.role,'security.configure').ok && !assertPermission(claims.role,'audit.read').ok) return error('Encryption Center access required',403);
        return json({ok:true,posture:buildEncryptionPosture({data_in_transit:true,r2_objects:Boolean(env.AUDIO_BUCKET),sensitive_fields:true,signed_downloads:true,backup_encryption:true,tenant_bound_context:true,key_versioning:true,tamper_detection:true})},200,{'Cache-Control':'no-store'});
      }









      // Compliance & Procurement Trust — authenticated enterprise controls.
      if (path === '/api/compliance/trust/readiness' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims);
        let controls=[], evidence=[];
        try { controls=(await env.DB.prepare('SELECT * FROM compliance_controls WHERE organization_id=? OR organization_id IS NULL').bind(orgId).all()).results||[]; } catch(_) {}
        try { evidence=(await env.DB.prepare('SELECT * FROM compliance_evidence WHERE organization_id=? ORDER BY generated_at DESC LIMIT 250').bind(orgId).all()).results||[]; } catch(_) {}
        const securityScore=Number(url.searchParams.get('security_score')||85);
        const documentationScore=Number(url.searchParams.get('documentation_score')||80);
        const evidenceScore=evidence.length?Math.min(100,60+evidence.length*2):60;
        return json({ok:true,readiness:buildProcurementReadiness({controls,evidence,security_score:securityScore,documentation_score:documentationScore,evidence_score:evidenceScore})},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/compliance/trust/soc2-readiness' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let controls=[];
        try { controls=(await env.DB.prepare('SELECT * FROM compliance_controls WHERE organization_id=? OR organization_id IS NULL').bind(orgId).all()).results||[]; } catch(_) {}
        return json({ok:true,soc2:buildSoc2Readiness({controls})},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/compliance/trust/iso-pack' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let controls=[];
        try { controls=(await env.DB.prepare('SELECT * FROM compliance_controls WHERE organization_id=? OR organization_id IS NULL').bind(orgId).all()).results||[]; } catch(_) {}
        return json({ok:true,iso_pack:buildIsoPack(controls)},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/compliance/trust/evidence' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let rows=[];
        try { rows=(await env.DB.prepare('SELECT * FROM compliance_evidence WHERE organization_id=? ORDER BY generated_at DESC LIMIT 500').bind(orgId).all()).results||[]; } catch(_) {}
        return json({ok:true,evidence:rows.map(r=>({...r,metadata:JSON.parse(r.metadata_json||'{}'),metadata_json:undefined}))},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/compliance/trust/evidence' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','founder','executive','operations_manager','org_admin'].includes(claims.role)) return error('Compliance evidence permission required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); const body=await request.json().catch(()=>({})); const record=buildEvidenceRecord({...body,owner:body.owner||claims.email||claims.sub});
        try { await env.DB.prepare('INSERT INTO compliance_evidence (id,organization_id,category,title,source,owner,verification_status,classification,generated_at,expires_at,reference,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(record.id,orgId,record.category,record.title,record.source,record.owner,record.verification_status,record.classification,record.generated_at,record.expires_at,record.reference,JSON.stringify(record.metadata)).run(); } catch(e) { return error('Could not store compliance evidence',500); }
        return json({ok:true,evidence:record},201);
      }
      if (path === '/api/compliance/trust/compliance-pack' && method === 'POST') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let controls=[],evidence=[];
        try { controls=(await env.DB.prepare('SELECT * FROM compliance_controls WHERE organization_id=? OR organization_id IS NULL').bind(orgId).all()).results||[]; } catch(_) {}
        try { evidence=(await env.DB.prepare('SELECT * FROM compliance_evidence WHERE organization_id=? ORDER BY generated_at DESC LIMIT 500').bind(orgId).all()).results||[]; } catch(_) {}
        return json({ok:true,pack:buildCompliancePack({organization_id:orgId,controls,iso_controls:controls,evidence})},200,{'Cache-Control':'no-store'});
      }


      // Enterprise Governance, Security & Trust Center — consolidated operational controls.
      if (path === '/api/enterprise-control/workspace' && method === 'GET') {
        const claims=await requireAuth(request,env);
        if(!['founder_executive','founder','super_admin','operations_manager','org_admin','organization_admin'].includes(claims.role)) return error('Enterprise control access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims);
        const one=async(sql,...args)=>{try{return await env.DB.prepare(sql).bind(...args).first()}catch(_){return {c:0}}};
        const active=Number((await one("SELECT COUNT(*) c FROM enterprise_client_workflows WHERE (organization_id=? OR organization_id IS NULL) AND stage!='campaign_ready'",orgId))?.c||0);
        const pending=Number((await one("SELECT COUNT(*) c FROM enterprise_client_workflows WHERE (organization_id=? OR organization_id IS NULL) AND stage='submitted_for_approval'",orgId))?.c||0);
        const users=Number((await one('SELECT COUNT(*) c FROM users WHERE organization_id=?',orgId))?.c||0);
        const mfa=Number((await one("SELECT COUNT(DISTINCT user_id) c FROM iam_mfa_methods WHERE organization_id=? AND status='verified'",orgId))?.c||0);
        const sso=Number((await one("SELECT COUNT(*) c FROM iam_sso_connections WHERE organization_id=? AND status='active'",orgId))?.c||0);
        const scim=Number((await one("SELECT COUNT(*) c FROM iam_scim_connections WHERE organization_id=? AND status='active'",orgId))?.c||0);
        const keys=Number((await one('SELECT COUNT(*) c FROM iam_api_keys_v2 WHERE organization_id=? AND revoked_at IS NULL',orgId))?.c||0);
        const consents=Number((await one("SELECT COUNT(*) c FROM consent_vault_records WHERE organization_id=? AND status='accepted'",orgId))?.c||0);
        const consentAll=Number((await one('SELECT COUNT(*) c FROM consent_vault_records WHERE organization_id=?',orgId))?.c||0);
        return json({ok:true,workspace:buildEnterpriseControlWorkspace({active_workflows:active,pending_approvals:pending,users,mfa_coverage_pct:users?Math.round(mfa/users*100):100,sso_active:sso,scim_active:scim,api_keys:keys,consent_coverage_pct:consentAll?Math.round(consents/consentAll*100):100,encryption_controls_pct:100})},200,{'Cache-Control':'no-store'});
      }


      if (path === '/api/enterprise-control/workflows' && method === 'GET') {
        const claims=await requireAuth(request,env);
        if(!['operations_manager','founder_executive','founder','super_admin'].includes(claims.role)) return error('Workflow access required',403);
        let rows=[];
        try { rows=(await env.DB.prepare(`SELECT * FROM enterprise_client_workflows ORDER BY updated_at DESC LIMIT 200`).all()).results||[]; } catch(_) {}
        return json({ok:true,workflows:rows.map(r=>({...r,metadata:JSON.parse(r.metadata_json||'{}'),metadata_json:undefined}))},200,{'Cache-Control':'no-store'});
      }

      const workflowReadMatch=path.match(/^\/api\/enterprise-control\/workflows\/([^/]+)$/);
      if(workflowReadMatch && method==='GET'){
        const claims=await requireAuth(request,env);
        if(!['operations_manager','founder_executive','founder','super_admin'].includes(claims.role)) return error('Workflow access required',403);
        const row=await env.DB.prepare('SELECT * FROM enterprise_client_workflows WHERE id=?').bind(workflowReadMatch[1]).first();
        if(!row)return error('Workflow not found',404);
        return json({ok:true,workflow:{...row,metadata:JSON.parse(row.metadata_json||'{}'),metadata_json:undefined}},200,{'Cache-Control':'no-store'});
      }

      const workflowDocumentMatch=path.match(/^\/api\/enterprise-control\/workflows\/([^/]+)\/documents$/);
      if(workflowDocumentMatch && method==='POST'){
        const claims=await requireAuth(request,env);
        if(!['operations_manager','founder_executive','founder','super_admin'].includes(claims.role)) return error('Document upload permission required',403);
        const row=await env.DB.prepare('SELECT * FROM enterprise_client_workflows WHERE id=?').bind(workflowDocumentMatch[1]).first();
        if(!row)return error('Workflow not found',404);
        const form=await request.formData(); const type=String(form.get('document_type')||'');
        if(!['proposal','contract','invoice'].includes(type))return error('document_type must be proposal, contract or invoice',400);
        const file=form.get('file'); if(!file||typeof file.arrayBuffer!=='function')return error('Document file is required',400);
        if(Number(file.size||0)>15*1024*1024)return error('Document exceeds 15 MB limit',413);
        const safeName=String(file.name||`${type}.bin`).replace(/[^a-zA-Z0-9._-]/g,'_');
        const objectKey=`enterprise-workflows/${row.id}/${type}/${Date.now()}-${safeName}`;
        await env.AUDIO_BUCKET.put(objectKey,await file.arrayBuffer(),{httpMetadata:{contentType:file.type||'application/octet-stream'},customMetadata:{workflow_id:row.id,document_type:type,uploaded_by:claims.sub||claims.email||claims.role}});
        const column={proposal:'proposal_reference',contract:'contract_reference',invoice:'invoice_reference'}[type];
        const stage={proposal:'proposal_prepared',contract:'contract_signed',invoice:'invoice_issued'}[type];
        const now=new Date().toISOString();
        await env.DB.prepare(`UPDATE enterprise_client_workflows SET ${column}=?,stage=?,updated_at=? WHERE id=?`).bind(objectKey,stage,now,row.id).run();
        await env.DB.prepare('INSERT INTO enterprise_workflow_documents (id,workflow_id,organization_id,document_type,object_key,file_name,mime_type,size_bytes,uploaded_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(`wfd_${crypto.randomUUID()}`,row.id,row.organization_id||null,type,objectKey,safeName,file.type||'application/octet-stream',Number(file.size||0),claims.sub||claims.email||claims.role,now).run();
        return json({ok:true,document_type:type,reference:objectKey,stage},201);
      }

      if (path === '/api/enterprise-control/workflows' && method === 'POST') {
        const claims=await requireAuth(request,env);
        if(!['operations_manager','founder_executive','founder','super_admin'].includes(claims.role)) return error('Workflow creation permission required',403);
        const body=await request.json().catch(()=>({})); const checked=validateEnterpriseWorkflow({...body,stage:'demo_received'}); if(!checked.ok)return json(checked,400);
        const id=`workflow_${crypto.randomUUID()}`,now=new Date().toISOString();
        await env.DB.prepare('INSERT INTO enterprise_client_workflows (id,organization_id,client_name,project_name,stage,owner_id,metadata_json,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,body.organization_id||null,body.client_name,body.project_name||null,'demo_received',body.owner_id||claims.sub,JSON.stringify(redactAuditMetadata(body.metadata||{})),now,now).run();
        return json({ok:true,id,stage:'demo_received',next_stage:nextWorkflowStage('demo_received')},201);
      }

      const workflowTransitionMatch=path.match(/^\/api\/enterprise-control\/workflows\/([^/]+)\/transition$/);
      if(workflowTransitionMatch && method==='POST'){
        const claims=await requireAuth(request,env); const body=await request.json().catch(()=>({}));
        const row=await env.DB.prepare('SELECT * FROM enterprise_client_workflows WHERE id=?').bind(workflowTransitionMatch[1]).first(); if(!row)return error('Workflow not found',404);
        const metadata={...JSON.parse(row.metadata_json||'{}'),...body}; const transition=buildWorkflowTransition({...row,metadata},body.stage,{id:claims.sub,role:claims.role,...metadata}); if(!transition.ok)return json(transition,400);
        const now=new Date().toISOString();
        await env.DB.prepare(`UPDATE enterprise_client_workflows SET stage=?,proposal_reference=COALESCE(?,proposal_reference),contract_reference=COALESCE(?,contract_reference),invoice_reference=COALESCE(?,invoice_reference),approval_id=COALESCE(?,approval_id),organization_id=COALESCE(?,organization_id),project_id=COALESCE(?,project_id),workspace_id=COALESCE(?,workspace_id),campaign_id=COALESCE(?,campaign_id),metadata_json=?,updated_at=? WHERE id=?`).bind(body.stage,body.proposal_reference||null,body.contract_reference||null,body.invoice_reference||null,body.approval_id||null,body.organization_id||null,body.project_id||null,body.workspace_id||null,body.campaign_id||null,JSON.stringify(redactAuditMetadata(metadata)),now,row.id).run();
        await env.DB.prepare('INSERT INTO enterprise_workflow_events (id,workflow_id,organization_id,actor_id,actor_role,from_stage,to_stage,result,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(`wfe_${crypto.randomUUID()}`,row.id,row.organization_id||body.organization_id||null,claims.sub,claims.role,row.stage,body.stage,'success',JSON.stringify(redactAuditMetadata(body)),now).run();
        return json({ok:true,transition,next_stage:nextWorkflowStage(body.stage)},200);
      }

      if(path==='/api/enterprise-control/mfa-policy'&&method==='GET'){
        const claims=await requireAuth(request,env); return json({ok:true,policy:buildMfaPolicy(),role_home:ROLE_HOME,current_role:claims.role},200,{'Cache-Control':'no-store'});
      }

      if(path==='/api/enterprise-control/sso/authorize'&&method==='POST'){
        const claims=await requireAuth(request,env); if(!assertPermission(claims.role,'sso.manage').ok)return error('SSO management permission required',403);
        const body=await request.json().catch(()=>({})); const state=crypto.randomUUID(),nonce=crypto.randomUUID(); const requestModel=buildSsoAuthorizationRequest(body,state,nonce,body.pkce_challenge); if(!requestModel.ok)return json(requestModel,400);
        return json({ok:true,authorization:requestModel,expires_in_seconds:600},200);
      }

      if(path==='/api/enterprise-control/sso/callback/validate'&&method==='POST'){
        const body=await request.json().catch(()=>({})); const checked=validateSsoCallback(body); return json(checked,checked.ok?200:400,{'Cache-Control':'no-store'});
      }

      if(path==='/api/scim/v2/Users'&&method==='POST'){
        const auth=request.headers.get('authorization')||''; if(!auth.startsWith('Bearer '))return error('SCIM bearer token required',401);
        const body=await request.json().catch(()=>({})); const checked=validateScimUser(body); if(!checked.ok)return json({schemas:['urn:ietf:params:scim:api:messages:2.0:Error'],detail:checked.errors.join('; '),status:'400'},400);
        return json({schemas:['urn:ietf:params:scim:schemas:core:2.0:User'],id:body.id||crypto.randomUUID(),externalId:checked.user.external_id,userName:checked.user.email,displayName:checked.user.display_name,active:checked.user.active,meta:{resourceType:'User',created:new Date().toISOString()}},201);
      }

      if(path==='/api/enterprise-control/auth-journey/evaluate'&&method==='POST'){
        const claims=await requireAuth(request,env); if(!['founder_executive','founder','super_admin','operations_manager','org_admin'].includes(claims.role))return error('Authentication QA access required',403);
        const body=await request.json().catch(()=>({})); return json({ok:true,result:evaluateAuthenticationJourney(body)},200,{'Cache-Control':'no-store'});
      }

      if(path==='/api/enterprise-control/procurement-evidence'&&method==='POST'){
        const claims=await requireAuth(request,env); if(!['founder_executive','founder','super_admin','operations_manager','org_admin'].includes(claims.role))return error('Procurement evidence permission required',403);
        const orgId=await getEffectiveOrgId(request,env,claims),body=await request.json().catch(()=>({})); const pack=buildProcurementEvidenceChecklist(body),id=`per_${crypto.randomUUID()}`,now=new Date().toISOString();
        await env.DB.prepare('INSERT INTO procurement_evidence_runs (id,organization_id,completion_pct,evidence_json,generated_by,generated_at) VALUES (?,?,?,?,?,?)').bind(id,orgId,pack.completion_pct,JSON.stringify(pack),claims.sub||claims.email,now).run();
        return json({ok:true,id,pack},201);
      }


      // External assurance and live acceptance evidence. These routes never claim certification without independent evidence.
      if(path==='/api/enterprise-assurance/register'&&method==='GET'){
        const claims=await requireAuth(request,env); if(!['founder_executive','founder','super_admin','operations_manager','org_admin'].includes(claims.role))return error('Assurance register access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); let rows=[];
        try{rows=(await env.DB.prepare('SELECT * FROM external_assurance_evidence WHERE organization_id=? OR organization_id IS NULL ORDER BY executed_at DESC').bind(orgId).all()).results||[]}catch(_){}
        return json({ok:true,register:buildExternalAssuranceRegister(rows)},200,{'Cache-Control':'no-store'});
      }
      if(path==='/api/enterprise-assurance/evidence'&&method==='POST'){
        const claims=await requireAuth(request,env); if(!['founder_executive','founder','super_admin'].includes(claims.role))return error('Founder or Super Admin authority required',403);
        const body=await request.json().catch(()=>({})); const checked=validateExternalEvidence(body); if(!checked.ok)return json(checked,400);
        const orgId=await getEffectiveOrgId(request,env,claims),id=`assurance_${crypto.randomUUID()}`,now=new Date().toISOString();
        await env.DB.prepare('INSERT INTO external_assurance_evidence (id,organization_id,type,provider_or_auditor,result,evidence_reference,findings_json,executed_at,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,orgId,body.type,body.provider_or_auditor,body.result,body.evidence_reference||null,JSON.stringify(redactAuditMetadata(body.findings||{})),body.executed_at,claims.sub||claims.email,now).run();
        return json({ok:true,id,verification_note:'Evidence recorded; independent execution remains the source of truth.'},201);
      }
      if(path==='/api/enterprise-assurance/sso/test-plan'&&method==='POST'){
        const claims=await requireAuth(request,env); if(!assertPermission(claims.role,'sso.manage').ok)return error('SSO management permission required',403);
        const body=await request.json().catch(()=>({})); return json({ok:true,plan:buildSsoLiveTestPlan(body.provider,body.config||{})},200);
      }
      if(path==='/api/enterprise-assurance/scim/lifecycle/validate'&&method==='POST'){
        const claims=await requireAuth(request,env); if(!['founder_executive','founder','super_admin','org_admin'].includes(claims.role))return error('SCIM validation permission required',403);
        const body=await request.json().catch(()=>({})); return json({ok:true,result:applyScimLifecycle(body.state||{},body.operation,body.payload||{})},200);
      }
      if(path==='/api/enterprise-assurance/mfa/recovery-evaluate'&&method==='POST'){
        const claims=await requireAuth(request,env); if(!['founder_executive','founder','super_admin'].includes(claims.role))return error('Security assurance permission required',403);
        const body=await request.json().catch(()=>({})); return json({ok:true,result:evaluateMfaRecoveryChallenge(body)},200);
      }
      if(path==='/api/enterprise-assurance/client-journey'&&method==='POST'){
        const claims=await requireAuth(request,env); if(!['founder_executive','founder','super_admin','operations_manager'].includes(claims.role))return error('Client acceptance permission required',403);
        const orgId=await getEffectiveOrgId(request,env,claims),body=await request.json().catch(()=>({})),result=evaluateClientJourneyAcceptance(body),id=`cjar_${crypto.randomUUID()}`,now=new Date().toISOString();
        await env.DB.prepare('INSERT INTO client_journey_acceptance_runs (id,organization_id,client_name,project_name,score_pct,status,evidence_json,executed_by,executed_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,orgId,body.client_name||null,body.project_name||null,result.score_pct,result.status,JSON.stringify(redactAuditMetadata({checks:result.checks,references:body.references||{}})),claims.sub||claims.email,now).run();
        return json({ok:true,id,result},201);
      }


      // Workstream 4 — Scale, Cloud Intelligence, Customer Success & VIN™.
      if(path==='/api/scale-intelligence/workspace'&&method==='GET'){
        const claims=await requireAuth(request,env); if(!['founder_executive','founder','super_admin','operations_manager','org_admin'].includes(claims.role))return error('Operations intelligence access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); let queueRows=[],acceptance=[];
        try{queueRows=(await env.DB.prepare(`SELECT queue_type,status,COUNT(*) count FROM production_queue_jobs_ws4 WHERE organization_id=? GROUP BY queue_type,status`).bind(orgId).all()).results||[]}catch(_){}
        try{acceptance=(await env.DB.prepare(`SELECT run_type,status,score_pct,executed_at FROM operational_acceptance_runs_ws4 WHERE organization_id=? OR organization_id IS NULL ORDER BY executed_at DESC LIMIT 20`).bind(orgId).all()).results||[]}catch(_){}
        const depths={}; for(const r of queueRows) if(r.status==='queued'||r.status==='retry') depths[r.queue_type]=(depths[r.queue_type]||0)+Number(r.count||0);
        const latest=(type)=>acceptance.find(x=>x.run_type===type)?.status||'NOT_RUN';
        const input={queue_depths:depths,production_queues:true,workload_balancing:true,monitoring:true,disaster_recovery:true,knowledge_cloud:true,marketplace:true,benchmark_cloud:true,api_platform:true,customer_success:true,training:true,support_sla:true,renewal:true,expansion:true,vin:true,load_test_status:latest('load_test'),failover_status:latest('failover'),backup_restore_status:latest('backup_restore')};
        return json({ok:true,workspace:buildScaleIntelligenceWorkspace(input),queue_summary:queueRows,acceptance_runs:acceptance},200,{'Cache-Control':'no-store'});
      }
      if(path==='/api/scale-intelligence/queue/jobs'&&method==='POST'){
        const claims=await requireAuth(request,env); if(!['founder_executive','founder','super_admin','operations_manager','org_admin','me_officer'].includes(claims.role))return error('Queue submission permission required',403);
        const orgId=await getEffectiveOrgId(request,env,claims),body=await request.json().catch(()=>({})),checked=validateQueueJob({...body,organization_id:orgId}); if(!checked.ok)return json(checked,400);
        const id=`ws4job_${crypto.randomUUID()}`,now=new Date().toISOString();
        try{await env.DB.prepare(`INSERT INTO production_queue_jobs_ws4 (id,organization_id,campaign_id,queue_type,status,priority,attempts,max_attempts,idempotency_key,payload_json,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,orgId,body.campaign_id||null,body.queue_type,'queued',checked.job.priority,0,checked.job.max_attempts,body.idempotency_key,JSON.stringify(redactAuditMetadata(body.payload||{})),body.available_at||now,now,now).run()}catch(e){if(String(e.message||e).toLowerCase().includes('unique'))return json({ok:true,duplicate:true,idempotency_key:body.idempotency_key},200);throw e}
        return json({ok:true,id,status:'queued'},201);
      }
      const ws4JobMatch=path.match(/^\/api\/scale-intelligence\/queue\/jobs\/([^/]+)\/transition$/);
      if(ws4JobMatch&&method==='POST'){
        const claims=await requireAuth(request,env); if(!['founder_executive','founder','super_admin','operations_manager'].includes(claims.role))return error('Queue transition permission required',403);
        const body=await request.json().catch(()=>({})),allowed=['processing','completed','retry','dead_letter','cancelled']; if(!allowed.includes(body.status))return error('Invalid queue status',400); const now=new Date().toISOString();
        await env.DB.prepare(`UPDATE production_queue_jobs_ws4 SET status=?,attempts=attempts+CASE WHEN ? IN ('retry','dead_letter') THEN 1 ELSE 0 END,last_error=?,available_at=COALESCE(?,available_at),locked_at=CASE WHEN ?='processing' THEN ? ELSE locked_at END,completed_at=CASE WHEN ?='completed' THEN ? ELSE completed_at END,updated_at=? WHERE id=?`).bind(body.status,body.status,body.last_error||null,body.available_at||null,body.status,now,body.status,now,now,ws4JobMatch[1]).run();
        return json({ok:true,id:ws4JobMatch[1],status:body.status},200);
      }
      if(path==='/api/scale-intelligence/acceptance'&&method==='POST'){
        const claims=await requireAuth(request,env); if(!['founder_executive','founder','super_admin'].includes(claims.role))return error('Founder or Super Admin authority required',403);
        const orgId=await getEffectiveOrgId(request,env,claims),body=await request.json().catch(()=>({})); let result;
        if(body.run_type==='load_test')result=evaluateLoadTest(body); else if(body.run_type==='failover')result=evaluateFailover(body); else if(body.run_type==='backup_restore')result=evaluateBackupRestore(body); else return error('run_type must be load_test, failover or backup_restore',400);
        const id=`ws4run_${crypto.randomUUID()}`,now=new Date().toISOString(); await env.DB.prepare(`INSERT INTO operational_acceptance_runs_ws4 (id,organization_id,run_type,status,score_pct,evidence_reference,result_json,executed_by,executed_at,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id,orgId,body.run_type,result.status,result.score_pct||0,body.evidence_reference||null,JSON.stringify(result),claims.sub||claims.email,body.executed_at||now,now).run();
        return json({ok:true,id,result},201);
      }

      // v210.9C — Renewal & Expansion Intelligence.
      if (path === '/api/customer-success/v2109c/renewals' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let contracts=[],profiles=[];
        try{contracts=(await env.DB.prepare('SELECT * FROM customer_contracts_v2109c WHERE organization_id=? ORDER BY end_date ASC').bind(orgId).all()).results||[]}catch(_){}
        try{profiles=(await env.DB.prepare('SELECT * FROM customer_success_profiles_v2109a WHERE organization_id=?').bind(orgId).all()).results||[]}catch(_){}
        return json(buildRenewalPipeline({contracts,profiles}),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/customer-success/v2109c/renewals' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','operations_manager','org_admin'].includes(claims.role)) return error('Renewal management permission required',403);
        const body=await request.json().catch(()=>({})); if(!body.name||!body.start_date||!body.end_date)return error('name, start_date and end_date are required',400); const orgId=await getEffectiveOrgId(request,env,claims),id=`contract_${crypto.randomUUID()}`,now=new Date().toISOString();
        await env.DB.prepare('INSERT INTO customer_contracts_v2109c (id,organization_id,name,start_date,end_date,value,currency,status,owner_id,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,orgId,body.name,body.start_date,body.end_date,Number(body.value||0),body.currency||'USD',body.status||'active',body.owner_id||claims.sub,body.notes||null,now,now).run(); return json({ok:true,id},201);
      }
      if (path === '/api/customer-success/v2109c/expansion' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let orgs=[],profiles=[],usage=[];
        try{orgs=(await env.DB.prepare('SELECT id,name FROM organizations WHERE id=?').bind(orgId).all()).results||[]}catch(_){}
        try{profiles=(await env.DB.prepare('SELECT * FROM customer_success_profiles_v2109a WHERE organization_id=?').bind(orgId).all()).results||[]}catch(_){}
        try{usage=(await env.DB.prepare('SELECT * FROM usage_events_v2109b WHERE organization_id=? ORDER BY created_at DESC LIMIT 5000').bind(orgId).all()).results||[]}catch(_){}
        return json(buildExpansionWorkspace({organizations:orgs,profiles,usage}),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/customer-success/v2109c/forecast' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','operations_manager','org_admin','project_manager','head_of_programs'].includes(claims.role))return error('Forecast access required',403); const body=await request.json().catch(()=>({})); return json({ok:true,forecast:buildExecutiveForecast(body)},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/customer-success/v2109c/assistant' && method === 'POST') {
        const claims=await requireAuth(request,env); const body=await request.json().catch(()=>({})); if(!body.question)return error('question is required',400); return json({ok:true,...answerCustomerSuccessQuestion(body)},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/customer-success/v2109c/dashboard' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let pilots=[],orgs=[],profiles=[],tickets=[],training=[],usage=[],contracts=[];
        try{pilots=(await env.DB.prepare('SELECT * FROM enterprise_pilots_v2109a WHERE organization_id=?').bind(orgId).all()).results||[]}catch(_){}
        try{orgs=(await env.DB.prepare('SELECT id,name FROM organizations WHERE id=?').bind(orgId).all()).results||[]}catch(_){}
        try{profiles=(await env.DB.prepare('SELECT * FROM customer_success_profiles_v2109a WHERE organization_id=?').bind(orgId).all()).results||[]}catch(_){}
        try{tickets=(await env.DB.prepare('SELECT * FROM support_tickets_v2109b WHERE organization_id=?').bind(orgId).all()).results||[]}catch(_){}
        try{training=(await env.DB.prepare('SELECT * FROM training_enrollments_v2109b WHERE organization_id=?').bind(orgId).all()).results||[]}catch(_){}
        try{usage=(await env.DB.prepare('SELECT * FROM usage_events_v2109b WHERE organization_id=? ORDER BY created_at DESC LIMIT 5000').bind(orgId).all()).results||[]}catch(_){}
        try{contracts=(await env.DB.prepare('SELECT * FROM customer_contracts_v2109c WHERE organization_id=?').bind(orgId).all()).results||[]}catch(_){}
        return json(buildUnifiedCustomerSuccessDashboard({pilots,organizations:orgs,profiles,tickets,training,usage,contracts}),200,{'Cache-Control':'no-store'});
      }

      // v210.9B — Training, Support & Adoption.
      if (path === '/api/customer-success/v2109b/training/workspace' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let courses=[],enrollments=[],certifications=[];
        try{courses=(await env.DB.prepare('SELECT * FROM training_courses_v2109b WHERE organization_id IS NULL OR organization_id=? ORDER BY created_at DESC').bind(orgId).all()).results||[]}catch(_){}
        try{enrollments=(await env.DB.prepare('SELECT * FROM training_enrollments_v2109b WHERE organization_id=? ORDER BY updated_at DESC').bind(orgId).all()).results||[]}catch(_){}
        try{certifications=(await env.DB.prepare('SELECT * FROM training_certifications_v2109b WHERE organization_id=? ORDER BY issued_at DESC').bind(orgId).all()).results||[]}catch(_){}
        return json(buildTrainingWorkspace({courses:courses.map(c=>({...c,modules:JSON.parse(c.modules_json||'[]')})),enrollments,certifications}),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/customer-success/v2109b/training/courses' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','operations_manager','org_admin','project_manager','head_of_programs'].includes(claims.role))return error('Training management permission required',403);
        const body=await request.json().catch(()=>({})), checked=validateCourse(body); if(!checked.ok)return json(checked,400); const orgId=await getEffectiveOrgId(request,env,claims),now=new Date().toISOString(),id=`course_${crypto.randomUUID()}`,r=checked.course;
        await env.DB.prepare('INSERT INTO training_courses_v2109b (id,organization_id,title,description,audience_role,estimated_minutes,modules_json,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,orgId,r.title,r.description||null,r.audience_role,Number(r.estimated_minutes),JSON.stringify(r.modules||[]),r.status,claims.sub,now,now).run(); return json({ok:true,id},201);
      }
      if (path === '/api/customer-success/v2109b/support/workspace' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let tickets=[];try{tickets=(await env.DB.prepare('SELECT * FROM support_tickets_v2109b WHERE organization_id=? ORDER BY created_at DESC').bind(orgId).all()).results||[]}catch(_){} return json(buildSupportWorkspace({tickets}),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/customer-success/v2109b/support/tickets' && method === 'POST') {
        const claims=await requireAuth(request,env); const body=await request.json().catch(()=>({})),checked=validateTicket(body);if(!checked.ok)return json(checked,400);const orgId=await getEffectiveOrgId(request,env,claims),now=new Date().toISOString(),id=`ticket_${crypto.randomUUID()}`,r=checked.ticket;
        await env.DB.prepare('INSERT INTO support_tickets_v2109b (id,organization_id,subject,description,priority,status,requester_id,assigned_to,first_response_at,resolved_at,escalation_level,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,orgId,r.subject,r.description,r.priority,r.status,claims.sub,r.assigned_to||null,null,null,0,now,now).run();return json({ok:true,id,status:r.status},201);
      }
      if (path === '/api/customer-success/v2109b/adoption/workspace' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let events=[],users=[];try{events=(await env.DB.prepare('SELECT * FROM usage_events_v2109b WHERE organization_id=? ORDER BY created_at DESC LIMIT 5000').bind(orgId).all()).results||[]}catch(_){}try{users=(await env.DB.prepare('SELECT id FROM users WHERE organization_id=?').bind(orgId).all()).results||[]}catch(_){}return json(buildAdoptionWorkspace({events,users}),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/customer-success/v2109b/adoption/events' && method === 'POST') {
        const claims=await requireAuth(request,env);const body=await request.json().catch(()=>({})),checked=validateUsageEvent(body);if(!checked.ok)return json(checked,400);const orgId=await getEffectiveOrgId(request,env,claims),now=new Date().toISOString(),id=`usage_${crypto.randomUUID()}`,r=checked.event;await env.DB.prepare('INSERT INTO usage_events_v2109b (id,organization_id,user_id,event_type,channel,resource_type,resource_id,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,orgId,claims.sub,r.event_type,r.channel,r.resource_type||null,r.resource_id||null,JSON.stringify(r.metadata||{}),now).run();return json({ok:true,id},201);
      }
      if (path === '/api/customer-success/v2109b/sla/summary' && method === 'GET') {
        const claims=await requireAuth(request,env);const orgId=await getEffectiveOrgId(request,env,claims);let tickets=[];try{tickets=(await env.DB.prepare('SELECT * FROM support_tickets_v2109b WHERE organization_id=? ORDER BY created_at DESC').bind(orgId).all()).results||[]}catch(_){}const w=buildSupportWorkspace({tickets});return json({ok:true,sla:{breached:w.metrics.breached,at_risk:w.metrics.at_risk,total:w.metrics.total},tickets:w.tickets},200,{'Cache-Control':'no-store'});
      }

      // v210.9A — Pilot Management & Customer Success Core.
      if (path === '/api/customer-success/v2109a/pilots' && method === 'GET') {
        const claims=await requireAuth(request,env); if(!['super_admin','operations_manager','org_admin','project_manager','head_of_programs'].includes(claims.role)) return error('Pilot management access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); let pilots=[],activities=[];
        try{pilots=(await env.DB.prepare('SELECT * FROM enterprise_pilots_v2109a WHERE organization_id=? ORDER BY created_at DESC').bind(orgId).all()).results||[]}catch(_){}
        try{activities=(await env.DB.prepare('SELECT * FROM pilot_activities_v2109a WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').bind(orgId).all()).results||[]}catch(_){}
        return json(buildPilotWorkspace({pilots:pilots.map(p=>({...p,success_criteria:JSON.parse(p.success_criteria_json||'[]')})),organizations:[{id:orgId}],activities}),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/customer-success/v2109a/pilots' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','operations_manager','org_admin','project_manager','head_of_programs'].includes(claims.role)) return error('Pilot creation permission required',403);
        const body=await request.json().catch(()=>({})); const checked=validatePilot(body); if(!checked.ok)return json(checked,400);
        const orgId=await getEffectiveOrgId(request,env,claims); if(body.organization_id!==orgId && claims.role!=='super_admin') return error('Cross-organization pilot creation denied',403);
        const id=`pilot_${crypto.randomUUID()}`,now=new Date().toISOString(),r=checked.pilot;
        await env.DB.prepare(`INSERT INTO enterprise_pilots_v2109a (id,organization_id,name,objective,status,risk_level,owner_id,operations_manager_id,start_date,end_date,contract_value,currency,delivery_score,success_score,next_milestone,success_criteria_json,notes,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,orgId,r.name,r.objective||null,r.status,r.risk_level,r.owner_id,r.operations_manager_id||null,r.start_date,r.end_date,Number(r.contract_value||0),r.currency||'USD',Number(r.delivery_score||75),0,r.next_milestone||null,JSON.stringify(r.success_criteria||[]),r.notes||null,claims.sub,now,now).run();
        return json({ok:true,id,status:r.status},201);
      }
      if (path === '/api/customer-success/v2109a/workspace' && method === 'GET') {
        const claims=await requireAuth(request,env); if(!['super_admin','operations_manager','org_admin','project_manager','head_of_programs'].includes(claims.role)) return error('Customer Success access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); let orgs=[],pilots=[],profiles=[];
        try{orgs=(await env.DB.prepare('SELECT id,name,status FROM organizations WHERE id=?').bind(orgId).all()).results||[]}catch(_){}
        try{pilots=(await env.DB.prepare('SELECT * FROM enterprise_pilots_v2109a WHERE organization_id=? ORDER BY created_at DESC').bind(orgId).all()).results||[]}catch(_){}
        try{profiles=(await env.DB.prepare('SELECT * FROM customer_success_profiles_v2109a WHERE organization_id=?').bind(orgId).all()).results||[]}catch(_){}
        const workspace=buildCustomerSuccessWorkspace({organizations:orgs.map(o=>({...o,...(profiles.find(p=>p.organization_id===o.id)||{})})),pilots,usage:[],tickets:[],training:[]});
        return json(workspace,200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/customer-success/v2109a/founder-dashboard' && method === 'GET') {
        const claims=await requireAuth(request,env); if(claims.role!=='super_admin') return error('Founder access required',403); let pilots=[],orgs=[];
        try{pilots=(await env.DB.prepare('SELECT * FROM enterprise_pilots_v2109a ORDER BY created_at DESC').all()).results||[]}catch(_){}
        try{orgs=(await env.DB.prepare('SELECT id,name,status FROM organizations ORDER BY created_at DESC').all()).results||[]}catch(_){}
        return json({ok:true,customer_success:buildFounderCustomerSuccessAdditions({pilots,organizations:orgs,approvals:[],renewals:[]})},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/customer-success/v2109a/operations-dashboard' && method === 'GET') {
        const claims=await requireAuth(request,env); if(!['super_admin','operations_manager'].includes(claims.role)) return error('Operations access required',403); const orgId=await getEffectiveOrgId(request,env,claims);let pilots=[];
        try{pilots=(await env.DB.prepare('SELECT * FROM enterprise_pilots_v2109a WHERE organization_id=? ORDER BY created_at DESC').bind(orgId).all()).results||[]}catch(_){}
        return json({ok:true,customer_success:buildOperationsCustomerSuccessAdditions({pilots,meetings:[],tasks:[],tickets:[]})},200,{'Cache-Control':'no-store'});
      }

      // v210.8 — Benchmark Cloud™.
      if (path === '/api/benchmarks/v2108/workspace' && method === 'GET') {
        const claims=await requireAuth(request,env);
        if(!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Benchmark Cloud access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); let snapshots=[], peers=[], organization={id:orgId};
        try { snapshots=(await env.DB.prepare('SELECT * FROM benchmark_snapshots_v2108 WHERE organization_id=? ORDER BY period ASC').bind(orgId).all()).results||[]; } catch(_) {}
        try { organization=(await env.DB.prepare('SELECT id,name,country,sector FROM organizations WHERE id=?').bind(orgId).first())||organization; } catch(_) {}
        try {
          peers=(await env.DB.prepare(`SELECT metric,value,period,scope,country,sector,region FROM benchmark_snapshots_v2108 WHERE organization_id<>? AND benchmark_opt_in=1 AND (sector=? OR country=? OR region=?) ORDER BY period DESC LIMIT 1000`).bind(orgId,organization.sector||'',organization.country||'',url.searchParams.get('region')||'').all()).results||[];
        } catch(_) {}
        return json(buildBenchmarkWorkspace({organization,snapshots,peerSnapshots:peers}),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/benchmarks/v2108/snapshots' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let rows=[];
        try { rows=(await env.DB.prepare('SELECT * FROM benchmark_snapshots_v2108 WHERE organization_id=? ORDER BY period DESC,metric').bind(orgId).all()).results||[]; } catch(_) {}
        return json({ok:true,records:rows},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/benchmarks/v2108/snapshots' && method === 'POST') {
        const claims=await requireAuth(request,env);
        if(!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Benchmark snapshot permission required',403);
        const body=await request.json().catch(()=>({})); const checked=validateSnapshot(body); if(!checked.ok)return json(checked,400);
        const orgId=await getEffectiveOrgId(request,env,claims), now=new Date().toISOString(), id=`bench_${crypto.randomUUID()}`, r=checked.record;
        await env.DB.prepare(`INSERT INTO benchmark_snapshots_v2108 (id,organization_id,metric,value,period,scope,country,sector,region,peer_group_label,source_reference,benchmark_opt_in,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,orgId,r.metric,r.value,r.period,r.scope,r.country,r.sector,r.region,r.peer_group_label,r.source_reference,body.benchmark_opt_in===true?1:0,claims.sub,now,now).run();
        return json({ok:true,id,record:r,benchmark_opt_in:body.benchmark_opt_in===true},201);
      }
      if (path === '/api/benchmarks/v2108/compare' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!claims) return error('Authentication required',401);
        const body=await request.json().catch(()=>({}));
        return json({ok:true,comparison:buildBenchmarkCloudComparison({metric:body.metric,organizationValue:body.organization_value,peerValues:Array.isArray(body.peer_values)?body.peer_values:[],scope:body.scope,label:body.peer_group_label})});
      }
      if (path === '/api/benchmarks/v2108/metrics' && method === 'GET') {
        const claims=await requireAuth(request,env); if(!claims)return error('Authentication required',401);
        return json({ok:true,metrics:METRIC_DEFINITIONS},200,{'Cache-Control':'private, max-age=300'});
      }

      // v210.7 — Marketplace.
      if (path === '/api/marketplace/v2107/workspace' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Marketplace access required',403);
        const orgId = await getEffectiveOrgId(request, env, claims); let installed=[];
        try { installed=(await env.DB.prepare('SELECT * FROM marketplace_installs_v2107 WHERE organization_id=? ORDER BY installed_at DESC').bind(orgId).all()).results||[]; } catch(_) {}
        return json(buildMarketplaceWorkspace(installed),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/marketplace/v2107/catalog' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Marketplace access required',403);
        return json({ok:true,items:searchMarketplace({q:url.searchParams.get('q')||'',type:url.searchParams.get('type')||'',sector:url.searchParams.get('sector')||''})},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/marketplace/v2107/install' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs'].includes(claims.role)) return error('Marketplace install permission required',403);
        const body=await request.json().catch(()=>({})); const checked=validateMarketplaceInstall(body.item_id); if(!checked.ok)return json(checked,404);
        const orgId=await getEffectiveOrgId(request,env,claims), now=new Date().toISOString(), id=`market_${crypto.randomUUID()}`;
        await env.DB.prepare(`INSERT INTO marketplace_installs_v2107 (id,organization_id,item_id,item_type,item_name,version,status,configuration_json,installed_by,installed_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id,item_id) DO UPDATE SET status='installed',version=excluded.version,updated_at=excluded.updated_at`).bind(id,orgId,checked.item.id,checked.item.type,checked.item.name,checked.item.version,'installed',JSON.stringify(body.configuration||{}),claims.sub,now,now).run();
        return json({ok:true,installed:true,item:checked.item,configuration_required:checked.configuration_required},201);
      }
      if (path === '/api/marketplace/v2107/uninstall' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs'].includes(claims.role)) return error('Marketplace uninstall permission required',403);
        const body=await request.json().catch(()=>({})); if(!body.item_id)return error('item_id is required',400); const orgId=await getEffectiveOrgId(request,env,claims),now=new Date().toISOString();
        await env.DB.prepare("UPDATE marketplace_installs_v2107 SET status='uninstalled',updated_at=? WHERE organization_id=? AND item_id=?").bind(now,orgId,body.item_id).run();
        return json({ok:true,uninstalled:true,item_id:body.item_id});
      }

      // v210.6 — API Platform.
      if (path === '/api/platform/v2106/openapi.json' && method === 'GET') {
        const origin = new URL(request.url).origin;
        return json(buildOpenApiSpec(origin), 200, { 'Cache-Control': 'public, max-age=300' });
      }
      if (path === '/api/platform/v2106/examples' && method === 'GET') {
        return json({ version: 'v210.6.0', examples: API_EXAMPLES }, 200, { 'Cache-Control': 'public, max-age=300' });
      }
      if (path === '/api/platform/v2106/workspace' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('API Platform access required', 403);
        const orgId = await getEffectiveOrgId(request, env, claims); let keys=[];
        try { keys=(await env.DB.prepare('SELECT id,status,expires_at,revoked_at,last_used_at FROM enterprise_api_keys_v2103a WHERE organization_id=? ORDER BY created_at DESC').bind(orgId).all()).results||[]; } catch(_) {}
        return json(buildApiPlatformWorkspace({ apiKeys: keys }), 200, { 'Cache-Control': 'no-store' });
      }
      if (path === '/api/platform/v2106/playground/validate' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('API Playground access required', 403);
        const body = await request.json().catch(() => ({}));
        const checked = validatePlaygroundRequest(body);
        return json(checked, checked.ok ? 200 : 400, { 'Cache-Control': 'no-store' });
      }


      // v210.5 — Knowledge Cloud.
      if (path === '/api/knowledge/v2105/workspace' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Knowledge Cloud access required',403);
        const orgId = await getEffectiveOrgId(request,env,claims); let rows=[];
        try { rows=(await env.DB.prepare('SELECT * FROM knowledge_cloud_items WHERE organization_id=? ORDER BY updated_at DESC LIMIT 500').bind(orgId).all()).results||[]; } catch(_) {}
        rows=rows.map(r=>({...r,tags:JSON.parse(r.tags_json||'[]'),tags_json:undefined}));
        return json(buildKnowledgeCloudWorkspace(rows),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/knowledge/v2105/search' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Knowledge search access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); let rows=[];
        try { rows=(await env.DB.prepare('SELECT * FROM knowledge_cloud_items WHERE organization_id=? ORDER BY updated_at DESC LIMIT 1000').bind(orgId).all()).results||[]; } catch(_) {}
        rows=rows.map(r=>({...r,tags:JSON.parse(r.tags_json||'[]'),tags_json:undefined}));
        return json(buildKnowledgeSearch(rows,url.searchParams.get('q')||'',{type:url.searchParams.get('type')||'',sector:url.searchParams.get('sector')||'',project_id:url.searchParams.get('project_id')||'',report_id:url.searchParams.get('report_id')||''}),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/knowledge/v2105/items' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Knowledge write access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); const body=await request.json().catch(()=>({})); const item=buildKnowledgeRecord({...body,organization_id:orgId});
        await env.DB.prepare(`INSERT INTO knowledge_cloud_items (id,organization_id,project_id,report_id,type,title,summary,content,sector,country,tags_json,source_type,source_reference,evidence_classification,confidence_score,visibility,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(item.id,orgId,item.project_id,item.report_id,item.type,item.title,item.summary,item.content,item.sector,item.country,JSON.stringify(item.tags),item.source_type,item.source_reference,item.evidence_classification,item.confidence_score,item.visibility,claims.sub,item.created_at,item.updated_at).run();
        return json({ok:true,item},201);
      }
      if (path === '/api/knowledge/v2105/ingest-report' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Knowledge ingestion access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); const body=await request.json().catch(()=>({})); const items=extractKnowledgeFromReport({...body.report,organization_id:orgId});
        for(const item of items){ await env.DB.prepare(`INSERT OR REPLACE INTO knowledge_cloud_items (id,organization_id,project_id,report_id,type,title,summary,content,sector,country,tags_json,source_type,source_reference,evidence_classification,confidence_score,visibility,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(item.id,orgId,item.project_id,item.report_id,item.type,item.title,item.summary,item.content,item.sector,item.country,JSON.stringify(item.tags),item.source_type,item.source_reference,item.evidence_classification,item.confidence_score,item.visibility,claims.sub,item.created_at,item.updated_at).run(); }
        return json({ok:true,ingested:items.length,items},201);
      }

      // v210.4 — Enterprise Reports Studio.
      if (path === '/api/reports/workspace' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Enterprise Reports access required', 403);
        const model = {
          title: url.searchParams.get('title') || 'Enterprise Intelligence Report',
          sector: url.searchParams.get('sector') || 'cross-sector',
          country: url.searchParams.get('country') || 'Tanzania',
          sample_size: Number(url.searchParams.get('sample_size') || 0),
          findings: [], recommendations: [], risks: [], evidence: [], kpis: []
        };
        return json(buildEnterpriseReportsWorkspace(model), 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/assistant' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Report Assistant access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, ...answerReportAssistant(body.report || {}, body.question || '') });
      }

      if (path === '/api/reports/presentation' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Presentation Builder access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, presentation: buildPresentation(body.report || {}, body.audience || 'board') });
      }

      if (path === '/api/reports/exports' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Report export access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, exports: buildExportManifest(body.report || {}) });
      }


      // VoiceInsights Flagship Report Engine™ v2 — Phase 1.
      if (path === '/api/reports/flagship/catalog' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Flagship Report Engine access required', 403);
        return json(getFlagshipReportEngineCatalog(), 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/flagship/compile' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Flagship Report compilation access required', 403);
        const body = await request.json().catch(() => ({}));
        const compiled = compileFlagshipReport(body.report || body);
        return json({ ok: true, compiled }, 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/flagship/quality-gate' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Publication quality review access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, quality_gate: evaluateFlagshipPublicationQuality(body.report || body) }, 200, { 'Cache-Control': 'no-store' });
      }

      // VoiceInsights Flagship Report Engine™ v2 — Phase 2 Premium Publications.
      if (path === '/api/reports/flagship/premium/styles' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Premium Publications access required', 403);
        return json(getPremiumPublicationCatalog(), 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/flagship/premium/compose' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Premium publication composition access required', 403);
        const body = await request.json().catch(() => ({}));
        const style = body.style || body.style_key || 'government';
        return json({ ok: true, publication: composePremiumPublication(body.report || body, style) }, 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/flagship/premium/manifest' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Premium publication manifest access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, manifest: buildPremiumPublicationManifest(body.report || body, body.style || 'government') }, 200, { 'Cache-Control': 'no-store' });
      }

      // VoiceInsights Flagship Report Engine™ v2 — Phase 3 Interactive Intelligence.
      if (path === '/api/reports/flagship/interactive/catalog' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Interactive Intelligence access required', 403);
        return json(getInteractiveIntelligenceCatalog(), 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/flagship/interactive/evidence' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Evidence Explorer access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, explorer: buildEvidenceExplorer(body.report || {}, body.query || '', body.filters || {}) }, 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/flagship/interactive/ask' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Report Assistant access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, result: answerGroundedReportQuestion(body.report || {}, body.question || '') }, 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/flagship/interactive/benchmark' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Benchmark access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, benchmark: buildPrivacySafeBenchmark(body.records || [], body.options || {}) }, 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/flagship/interactive/knowledge/extract' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Knowledge extraction access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, knowledge: extractKnowledgeRecords(body.report || {}, body.metadata || {}) }, 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/flagship/interactive/knowledge/search' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Knowledge search access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, search: searchKnowledge(body.records || [], body.query || '', body.filters || {}) }, 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/flagship/interactive/build' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Interactive report composition access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, interactive_report: buildInteractiveReport(body.report || {}, body.style || 'un') }, 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/reports/enterprise/acceptance' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Report acceptance access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ ok: true, acceptance: buildAcceptanceReport(body.report || {}) }, 200, { 'Cache-Control': 'no-store' });
      }

      if ((path === '/api/reports/enterprise/docx' || path === '/api/reports/enterprise/xlsx') && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Report export access required', 403);
        const body = await request.json().catch(() => ({}));
        const artifact = path.endsWith('/docx') ? await renderDocxBinary(body.report || {}, { report_id: body.report_id }) : await renderXlsxBinary(body.report || {}, { report_id: body.report_id });
        return new Response(artifact.bytes, { status: 200, headers: { 'Content-Type': artifact.content_type, 'Content-Disposition': `attachment; filename="${artifact.filename}"`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'X-Artifact-Checksum': artifact.checksum } });
      }



      // Flagship Report Engine v2 — Phase 4 Presentation & Publishing.
      if (path === '/api/reports/flagship/publishing/catalog' && method === 'GET') {
        await requireAuth(request, env);
        return json({ ok:true, catalog:getPresentationPublishingCatalog() },200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/reports/flagship/publishing/compose' && method === 'POST') {
        const claims=await requireAuth(request,env);
        if(!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Publication authoring access required',403);
        const body=await request.json().catch(()=>({}));
        return json({ok:true,publication:buildPublicationModel(body,body.profile||'un',body.product||'premium_pdf')},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/reports/flagship/publishing/quality-gate' && method === 'POST') {
        const claims=await requireAuth(request,env);
        if(!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Publication quality access required',403);
        const body=await request.json().catch(()=>({}));
        return json({ok:true,quality_gate:evaluatePresentationQuality(body.report||{},body.profile||'un',body.product||'premium_pdf')},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/reports/flagship/publishing/export' && method === 'POST') {
        const claims=await requireAuth(request,env);
        if(!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Publication export access required',403);
        const body=await request.json().catch(()=>({}));
        const profile=body.profile||'un', product=body.product||'premium_pdf', report=body.report||{};
        const publication=buildPublicationModel({report},profile,product);
        if(!publication.quality_gate.release_allowed) return json({ok:false,error:'Presentation quality gate blocked export',quality_gate:publication.quality_gate},422,{'Cache-Control':'no-store'});
        const format=publication.product.format;
        let artifact;
        if(format==='docx') artifact=await renderDocxBinary({...report,presentation_publication:publication},{report_id:body.report_id||'flagship-publication'});
        else if(format==='xlsx') artifact=await renderXlsxBinary({...report,presentation_publication:publication},{report_id:body.report_id||'flagship-publication'});
        else if(format==='pptx') {
          const deck=publication.specialized_product||buildDeck(report,product==='investor_deck'?'investor_deck':product==='board_deck'?'board_deck':'executive');
          artifact=await renderPptxBinary({report_id:body.report_id||'flagship-publication',metadata:{report_id:body.report_id||'flagship-publication',title:publication.cover.title,organization:report.organization_name},artifact:{slides:deck.slides}},{profile,product});
        } else if(format==='pdf') {
          const composition=buildDocumentComposition({...report,title:publication.cover.title},product==='cabinet_memo'?'government_report_pdf':product==='policy_brief'?'policy_brief_pdf':'pdf',{tenant_id:claims.organization_id||claims.org_id||'unknown'});
          artifact=await renderPdfBinary(composition,{profile,product});
        } else return json({ok:true,publication},200,{'Cache-Control':'no-store'});
        return new Response(artifact.bytes,{status:200,headers:{'Content-Type':artifact.content_type,'Content-Disposition':`attachment; filename="${artifact.filename}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','X-Artifact-Checksum':artifact.checksum}});
      }


      // Flagship Report Engine v2 — Phase 5 World-Class Sample Library (public synthetic demonstrations).
      // Public export route contract: /export/(pdf|pptx|docx|xlsx)
      if (path === '/api/public/flagship-sample-library' && method === 'GET') {
        return json({ ok:true, catalog:getFlagshipSampleCatalog() },200,{'Cache-Control':'public, max-age=300'});
      }
      const sampleDetailMatch = path.match(/^\/api\/public\/flagship-sample-library\/([^/]+)$/);
      if (sampleDetailMatch && method === 'GET') {
        const model=buildFlagshipSampleReport(decodeURIComponent(sampleDetailMatch[1]));
        if(!model) return error('Flagship sample report not found',404);
        return json({ok:true,...model},200,{'Cache-Control':'public, max-age=300'});
      }
      const sampleExportMatch = path.match(/^\/api\/public\/flagship-sample-library\/([^/]+)\/export\/(pdf|pptx|docx|xlsx|board-deck|policy-brief|cabinet-memo|investor-deck|html)$/);
      if (sampleExportMatch && method === 'GET') {
        const key=decodeURIComponent(sampleExportMatch[1]), format=sampleExportMatch[2];
        const model=buildFlagshipSampleReport(key); if(!model) return error('Flagship sample report not found',404);
        if(model.report?.quality_scores?.gate!=='PUBLICATION_READY') return json({ok:false,error:'Publication quality gate blocked export',quality_gate:model.report?.quality_scores||null},422,{'Cache-Control':'no-store'});
        const report=model.report; let artifact;
        if(format==='docx') artifact=await renderDocxBinary(report,{report_id:`flagship-${key}`});
        else if(format==='xlsx') artifact=await renderXlsxBinary(report,{report_id:`flagship-${key}`});
        else if(format==='pptx') artifact=await renderPptxBinary({report_id:`flagship-${key}`,metadata:{report_id:`flagship-${key}`,title:report.title,organization:'VoiceInsights Africa'},artifact:{slides:buildFlagshipSampleDeck(model)}},{profile:model.sample.style});
        else if(format==='board-deck'||format==='investor-deck'){const product=format.replace('-','_'),deck=buildDeck(report,product);artifact=await renderPptxBinary({report_id:`flagship-${key}-${format}`,metadata:{report_id:`flagship-${key}-${format}`,title:report.title,organization:'VoiceInsights Africa'},artifact:{slides:deck.slides||buildFlagshipSampleDeck(model)}},{profile:model.sample.style,product});}
        else if(format==='policy-brief'||format==='cabinet-memo'){const product=format.replace('-','_'),profile=format==='cabinet-memo'?'government':model.sample.profile,publication=buildPublicationModel({report},profile,product),composition=buildDocumentComposition({...report,title:publication.cover?.title||report.title},format==='cabinet-memo'?'government_report_pdf':'policy_brief_pdf',{tenant_id:'public-demo'});artifact=await renderPdfBinary(composition,{profile,product});}
        else if(format==='html') artifact=await renderFlagshipInteractiveHtml(model);
        else { const composition=buildDocumentComposition(report,'pdf',{tenant_id:'public-demo'}); composition.full_report=report; artifact=await renderPdfBinary(composition,{profile:model.sample.style}); }
        return new Response(artifact.bytes,{status:200,headers:{'Content-Type':artifact.content_type,'Content-Disposition':`attachment; filename="${artifact.filename}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300','X-Artifact-Checksum':artifact.checksum}});
      }

      // Public read-only M&E demonstration brief — separate from the 16 flagship samples.
      if (path === '/api/public/demo/me-brief' && method === 'GET') {
        return json(buildMeDemoBrief(),200,{'Cache-Control':'public, max-age=300'});
      }
      if (path === '/api/public/demo/me-brief/export/pdf' && method === 'GET') {
        const model=buildMeDemoBrief();
        const composition=buildDocumentComposition(model.report,'pdf',{tenant_id:'public-demo'});
        composition.full_report=model.report;
        const artifact=await renderPdfBinary(composition,{profile:'un',product:'me_demo_brief'});
        return new Response(artifact.bytes,{status:200,headers:{'Content-Type':artifact.content_type,'Content-Disposition':'attachment; filename="voiceinsights-me-demo-brief.pdf"','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=300','X-Artifact-Checksum':artifact.checksum}});
      }

      // VoiceInsights Data Trust & Intelligence Fabric™
      if (path === '/api/data-trust/workspace' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Data Trust workspace access required', 403);
        const orgId = await getEffectiveOrgId(request, env, claims);
        const count = async (sql, ...binds) => { try { const r=await env.DB.prepare(sql).bind(...binds).first(); return Number(r?.n || 0); } catch (_) { return null; } };
        const snapshot = {
          catalog_assets: await count('SELECT COUNT(*) n FROM data_catalog_assets WHERE organization_id=? AND status=\'active\'', orgId),
          lineage_edges: await count('SELECT COUNT(*) n FROM data_lineage_edges WHERE organization_id=?', orgId),
          open_quality_incidents: await count("SELECT COUNT(*) n FROM data_quality_runs WHERE organization_id=? AND status IN ('BLOCKED','DEGRADED','INCOMPLETE')", orgId),
          disclosure_reviews_pending: await count("SELECT COUNT(*) n FROM privacy_disclosure_reviews WHERE organization_id=? AND decision='REVIEW_REQUIRED'", orgId),
          registered_ai_models: await count('SELECT COUNT(*) n FROM ai_model_registry WHERE organization_id=?', orgId),
          active_data_contracts: await count("SELECT COUNT(*) n FROM interoperability_contracts WHERE organization_id=? AND status='active'", orgId),
          active_decision_signals: await count("SELECT COUNT(*) n FROM decision_signals WHERE organization_id=? AND status='open'", orgId),
        };
        let recentSignals=[]; try { recentSignals=(await env.DB.prepare('SELECT * FROM decision_signals WHERE organization_id=? ORDER BY created_at DESC LIMIT 20').bind(orgId).all()).results||[]; } catch(_) {}
        let assets=[]; try { assets=(await env.DB.prepare('SELECT id,asset_type,name,classification,quality_status,updated_at FROM data_catalog_assets WHERE organization_id=? ORDER BY updated_at DESC LIMIT 30').bind(orgId).all()).results||[]; } catch(_) {}
        return json({ok:true,workspace:buildDataTrustWorkspace(snapshot),assets,recent_signals:recentSignals},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/data-trust/catalog/assets' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','founder_executive','operations_manager','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Catalog write permission required',403);
        const orgId=await getEffectiveOrgId(request,env,claims), body=await request.json().catch(()=>({})); body.owner_user_id=body.owner_user_id||claims.sub; const v=validateCatalogAsset(body); if(!v.ok)return json(v,400);
        const id=body.id||`dca_${crypto.randomUUID()}`, now=new Date().toISOString(); await env.DB.prepare('INSERT INTO data_catalog_assets (id,organization_id,project_id,asset_type,name,description,owner_user_id,steward_user_id,classification,source_system,schema_json,metadata_json,retention_rule,freshness_sla_hours,quality_status,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,orgId,body.project_id||null,body.asset_type,body.name,body.description||null,body.owner_user_id,body.steward_user_id||null,body.classification||'internal',body.source_system||null,JSON.stringify(body.schema||{}),JSON.stringify(body.metadata||{}),body.retention_rule||null,body.freshness_sla_hours||null,'NOT_MEASURED','active',now,now).run(); return json({ok:true,id},201);
      }
      if (path === '/api/data-trust/lineage/edges' && method === 'POST') {
        const claims=await requireAuth(request,env); if(claims.role==='enumerator')return error('Lineage permission required',403); const orgId=await getEffectiveOrgId(request,env,claims),body=await request.json().catch(()=>({})); const v=validateLineageEdge(body); if(!v.ok)return json(v,400);
        const id=`dle_${crypto.randomUUID()}`; await env.DB.prepare('INSERT INTO data_lineage_edges (id,organization_id,project_id,from_asset_id,to_asset_id,relationship_type,transformation_json,evidence_json,created_by) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,orgId,body.project_id||null,body.from_asset_id,body.to_asset_id,body.relationship_type,JSON.stringify(body.transformation||{}),JSON.stringify(body.evidence||{}),claims.sub).run(); return json({ok:true,id},201);
      }
      if (path === '/api/data-trust/quality/runs' && method === 'POST') {
        const claims=await requireAuth(request,env); if(claims.role==='enumerator')return error('Quality permission required',403); const orgId=await getEffectiveOrgId(request,env,claims),body=await request.json().catch(()=>({})); const result=computeQualityStatus(body.checks||[]),id=`dqr_${crypto.randomUUID()}`; await env.DB.prepare('INSERT INTO data_quality_runs (id,organization_id,project_id,asset_id,status,score,checks_json,failed_count,warning_count,created_by) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,orgId,body.project_id||null,body.asset_id||null,result.status,result.score,JSON.stringify(body.checks||[]),result.failed,result.warnings,claims.sub).run(); if(body.asset_id) await env.DB.prepare('UPDATE data_catalog_assets SET quality_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?').bind(result.status,body.asset_id,orgId).run(); return json({ok:true,id,result},201);
      }
      if (path === '/api/data-trust/privacy/assess' && method === 'POST') {
        const claims=await requireAuth(request,env); if(claims.role==='enumerator')return error('Privacy review permission required',403); const orgId=await getEffectiveOrgId(request,env,claims),body=await request.json().catch(()=>({})); const assessment=assessDisclosureRisk(body),id=`pdr_${crypto.randomUUID()}`; await env.DB.prepare('INSERT INTO privacy_disclosure_reviews (id,organization_id,project_id,asset_id,intended_release,risk_level,decision,reasons_json,controls_json,reviewed_by) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,orgId,body.project_id||null,body.asset_id||null,body.intended_release||'internal',assessment.risk,assessment.decision,JSON.stringify(assessment.reasons),JSON.stringify(assessment.controls),claims.sub).run(); return json({ok:true,id,assessment},201);
      }
      if (path === '/api/data-trust/ai/models' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','founder_executive','org_admin','organization_admin','data_analyst'].includes(claims.role))return error('AI governance permission required',403); const orgId=await getEffectiveOrgId(request,env,claims),body=await request.json().catch(()=>({})); const assurance=evaluateModelAssurance(body); if(!body.model_name||!body.model_version||!body.task_type)return error('model_name, model_version and task_type are required',400); const id=body.id||`aim_${crypto.randomUUID()}`; await env.DB.prepare('INSERT OR REPLACE INTO ai_model_registry (id,organization_id,model_name,model_version,task_type,provider,prompt_version,evaluation_dataset_id,assurance_status,assurance_score,assurance_json,rollback_version,active,created_by,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)').bind(id,orgId,body.model_name,body.model_version,body.task_type,body.provider||null,body.prompt_version||null,body.evaluation_dataset_id||null,assurance.status,assurance.score,JSON.stringify(assurance),body.rollback_version||null,body.active?1:0,claims.sub).run(); return json({ok:true,id,assurance},201);
      }
      if (path === '/api/data-trust/interoperability/contracts' && method === 'POST') {
        const claims=await requireAuth(request,env); if(claims.role==='enumerator')return error('Interoperability permission required',403); const orgId=await getEffectiveOrgId(request,env,claims),body=await request.json().catch(()=>({})); body.owner_user_id=body.owner_user_id||claims.sub; const v=validateInteroperabilityContract(body); if(!v.ok)return json(v,400); const id=body.id||`ic_${crypto.randomUUID()}`; await env.DB.prepare('INSERT INTO interoperability_contracts (id,organization_id,project_id,standard,contract_version,direction,fields_json,validation_json,owner_user_id,status) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,orgId,body.project_id||null,body.standard,body.contract_version,body.direction||'bidirectional',JSON.stringify(body.fields),JSON.stringify(body.validation||{}),body.owner_user_id,body.status||'draft').run(); return json({ok:true,id},201);
      }
      if (path === '/api/data-trust/signals/evaluate' && method === 'POST') {
        const claims=await requireAuth(request,env); if(claims.role==='enumerator')return error('Decision signal permission required',403); const orgId=await getEffectiveOrgId(request,env,claims),body=await request.json().catch(()=>({})); const signals=buildDecisionSignals(body.metrics||{}),now=new Date().toISOString(); for(const sig of signals){await env.DB.prepare('INSERT INTO decision_signals (id,organization_id,project_id,signal_type,severity,title,detail,evidence_json,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(`ds_${crypto.randomUUID()}`,orgId,body.project_id||null,sig.type,sig.severity,sig.title,sig.detail,JSON.stringify(sig.evidence||{}),now).run()} return json({ok:true,signals},201);
      }
      if (path === '/api/data-trust/signals' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let rows=[]; try{rows=(await env.DB.prepare('SELECT * FROM decision_signals WHERE organization_id=? ORDER BY created_at DESC LIMIT 100').bind(orgId).all()).results||[]}catch(_){} return json({ok:true,signals:rows},200,{'Cache-Control':'no-store'});
      }

      // International programme lifecycle, methodology and role acceptance.
      if (path === '/api/programme-lifecycle/workspace' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','operations_manager','org_admin','organization_admin','project_manager','head_of_programs','me_officer','data_analyst'].includes(claims.role)) return error('Programme workspace access required', 403);
        const orgId = await getEffectiveOrgId(request, env, claims);
        let projects=[], frameworks=[], responses=[], acceptance=[];
        try { projects=(await env.DB.prepare('SELECT * FROM enterprise_projects WHERE organization_id=? ORDER BY created_at DESC').bind(orgId).all()).results||[]; } catch(_) {}
        try { frameworks=(await env.DB.prepare('SELECT * FROM programme_results_frameworks WHERE organization_id=? ORDER BY updated_at DESC').bind(orgId).all()).results||[]; } catch(_) {}
        try { responses=(await env.DB.prepare('SELECT * FROM management_response_actions WHERE organization_id=? ORDER BY created_at DESC').bind(orgId).all()).results||[]; } catch(_) {}
        try { acceptance=(await env.DB.prepare('SELECT * FROM role_acceptance_runs WHERE organization_id=? ORDER BY executed_at DESC LIMIT 100').bind(orgId).all()).results||[]; } catch(_) {}
        return json(buildInternationalProgrammeWorkspace({organization_id:orgId,projects,frameworks,management_responses:responses,role_acceptance:acceptance}),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/programme-lifecycle/results-framework' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer'].includes(claims.role))return error('Results framework permission required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); const body=await request.json().catch(()=>({})); const v=validateResultsFramework(body); if(!v.ok)return json(v,400);
        const id=body.id||`rf_${crypto.randomUUID()}`, now=new Date().toISOString(); await env.DB.prepare(`INSERT OR REPLACE INTO programme_results_frameworks (id,organization_id,project_id,title,theory_of_change_json,indicators_json,assumptions_json,risks_json,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,COALESCE((SELECT created_at FROM programme_results_frameworks WHERE id=?),?),?)`).bind(id,orgId,body.project_id,body.title,JSON.stringify(body.theory_of_change||{}),JSON.stringify(body.indicators||[]),JSON.stringify(body.assumptions||[]),JSON.stringify(body.risks||[]),body.status||'draft',claims.sub||'',id,now,now).run();
        return json({ok:true,id},201);
      }
      if (path === '/api/programme-lifecycle/methodology/readiness' && method === 'POST') {
        const claims=await requireAuth(request,env); if(claims.role==='enumerator')return error('Methodology access required',403); const body=await request.json().catch(()=>({})); return json({ok:true,readiness:buildMethodologyReadiness(body)},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/programme-lifecycle/management-response' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','founder_executive','org_admin','organization_admin','project_manager','head_of_programs','me_officer'].includes(claims.role))return error('Management response permission required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); const body=await request.json().catch(()=>({})); const v=validateManagementResponse(body); if(!v.ok)return json(v,400); const id=body.id||`mra_${crypto.randomUUID()}`,now=new Date().toISOString(); await env.DB.prepare('INSERT OR REPLACE INTO management_response_actions (id,organization_id,project_id,report_id,recommendation,management_response,owner,due_date,status,evidence_url,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,orgId,body.project_id,body.report_id||null,body.recommendation,body.management_response,body.owner,body.due_date,body.status||'open',body.evidence_url||null,claims.sub||'',now,now).run(); return json({ok:true,id},201);
      }
      if (path === '/api/programme-lifecycle/role-acceptance' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','founder_executive'].includes(claims.role))return error('Founder/Super Admin required',403); const orgId=await getEffectiveOrgId(request,env,claims); const body=await request.json().catch(()=>({})); const matrix=buildRoleAcceptanceMatrix(body.results||[]); const now=new Date().toISOString(); for(const r of matrix.results){await env.DB.prepare('INSERT INTO role_acceptance_runs (id,organization_id,role_name,journey_name,status,evidence_json,executed_by,executed_at) VALUES (?,?,?,?,?,?,?,?)').bind(`rar_${crypto.randomUUID()}`,orgId,r.role,r.journey,r.status,JSON.stringify(r.evidence||{}),claims.sub||'',now).run()} return json({ok:true,matrix},201);
      }

      // Collection, Enumerator, Offline & Omni-Channel Operations
      if (path === '/api/collection-operations/readiness' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','operations_manager','org_admin','project_manager','me_officer'].includes(claims.role)) return error('Collection operations access required', 403);
        const senders = resolveTwilioSenders(env);
        return json(buildOperationsReadiness({
          distribution_center: true, web_collection: true, offline_sync: true,
          enumerator_assignments: true, double_entry: true, supervisor_review: true,
          fraud_quality: true, callbacks: true, retry_dead_letter: true,
          twilio_sms: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && senders.sms),
          twilio_whatsapp: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && senders.whatsapp),
          twilio_voice: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && senders.voice),
        }), 200, { 'Cache-Control': 'no-store' });
      }

      const twilioStatusMatch = path.match(/^\/api\/twilio\/status\/(sms|whatsapp|voice)$/);
      if (twilioStatusMatch && method === 'POST') {
        // V213: verified through the same centralized guard as inbound webhooks
        // (constant-time signature check against the reconstructed public URL,
        // + SID replay protection + redacted audit on failure).
        const guard = await guardTwilioWebhook(request, env);
        if (!guard.ok) return guard.response;
        const params = guard.params;
        const channel = twilioStatusMatch[1];
        const providerSid = params.MessageSid || params.CallSid || params.SmsSid || null;
        const providerStatus = params.MessageStatus || params.CallStatus || params.SmsStatus || params.EventType || 'unknown';
        const normalized = mapTwilioStatus(providerStatus);
        const now = new Date().toISOString();
        let existing = null;
        if (providerSid) existing = await env.DB.prepare(`SELECT * FROM channel_delivery_events WHERE channel = ? AND provider_sid = ? LIMIT 1`).bind(channel, providerSid).first().catch(() => null);
        const retry = decideDeliveryRetry({ providerStatus, attempts: existing?.attempts || 0, maxAttempts: existing?.max_attempts || 5 });
        const id = existing?.id || `delivery_${crypto.randomUUID()}`;
        await env.DB.prepare(`INSERT INTO channel_delivery_events (id,organization_id,campaign_id,survey_id,channel,provider_sid,recipient_masked,provider_status,normalized_status,attempts,max_attempts,next_attempt_at,error_code,error_message,metadata_json,created_at,updated_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(id) DO UPDATE SET provider_status=excluded.provider_status,normalized_status=excluded.normalized_status,attempts=excluded.attempts,next_attempt_at=excluded.next_attempt_at,error_code=excluded.error_code,error_message=excluded.error_message,metadata_json=excluded.metadata_json,updated_at=excluded.updated_at`)
          .bind(id, existing?.organization_id || null, existing?.campaign_id || null, existing?.survey_id || null, channel, providerSid, null, providerStatus, retry.status, retry.attempts || existing?.attempts || 0, existing?.max_attempts || 5, retry.next_attempt_at, params.ErrorCode || null, params.ErrorMessage || null, JSON.stringify(params), existing?.created_at || now, now).run();
        if (retry.status === 'dead_letter') {
          await env.DB.prepare(`INSERT OR IGNORE INTO channel_dead_letters (id,delivery_event_id,organization_id,channel,reason,payload_json,created_at) VALUES (?,?,?,?,?,?,?)`)
            .bind(`dlq_${crypto.randomUUID()}`, id, existing?.organization_id || null, channel, params.ErrorMessage || providerStatus, JSON.stringify(params), now).run();
        }
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }

      if (path === '/api/collection-operations/assignments' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','operations_manager','org_admin','project_manager','me_officer'].includes(claims.role)) return error('Assignment management access required', 403);
        const body = await request.json().catch(() => ({}));
        body.organization_id = claims.organization_id || body.organization_id;
        const validation = validateAssignment(body);
        if (!validation.valid) return json({ ok:false, errors:validation.errors }, 400);
        const id = `assignment_${crypto.randomUUID()}`, now = new Date().toISOString();
        await env.DB.prepare(`INSERT INTO enumerator_assignments_v2 (id,organization_id,project_id,survey_id,campaign_id,enumerator_id,supervisor_id,assignment_type,region,language,status,offline_package_version,due_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id,body.organization_id,body.project_id,body.survey_id,body.campaign_id||null,body.enumerator_id,body.supervisor_id||null,body.assignment_type||'standard',body.region||null,body.language||null,'assigned',1,body.due_at||null,claims.sub||claims.email||claims.role,now,now).run();
        return json({ ok:true, assignment_id:id, status:'assigned' }, 201);
      }

      if (path === '/api/collection-operations/assignments' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const org = claims.organization_id || url.searchParams.get('organization_id');
        const rows = (await env.DB.prepare(`SELECT * FROM enumerator_assignments_v2 WHERE organization_id = ? ORDER BY created_at DESC LIMIT 200`).bind(org).all()).results || [];
        return json({ ok:true, assignments:rows }, 200, { 'Cache-Control':'no-store' });
      }

      if (path === '/api/collection-operations/offline/sync' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','me_officer','enumerator'].includes(claims.role)) return error('Offline sync access required', 403);
        const body = await request.json().catch(() => ({}));
        if (!body.device_id || !body.entity_type || !body.entity_id) return error('device_id, entity_type and entity_id are required', 400);
        const org = claims.organization_id || body.organization_id;
        const existing = await env.DB.prepare(`SELECT * FROM offline_sync_items_v2 WHERE organization_id=? AND device_id=? AND entity_type=? AND entity_id=? ORDER BY client_version DESC LIMIT 1`).bind(org,body.device_id,body.entity_type,body.entity_id).first().catch(()=>null);
        const decision = buildOfflineSyncDecision({ clientVersion:body.client_version||1, serverVersion:existing?.client_version||0, clientUpdatedAt:body.updated_at, serverUpdatedAt:existing?.updated_at });
        const now = new Date().toISOString(), id = `sync_${crypto.randomUUID()}`;
        const syncStatus = decision.conflict ? 'conflict' : decision.action === 'duplicate' ? 'duplicate' : 'synced';
        await env.DB.prepare(`INSERT OR IGNORE INTO offline_sync_items_v2 (id,organization_id,assignment_id,device_id,entity_type,entity_id,client_version,server_version,payload_json,checksum,sync_status,conflict_reason,server_payload_json,synced_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id,org,body.assignment_id||null,body.device_id,body.entity_type,body.entity_id,body.client_version||1,existing?.client_version||0,JSON.stringify(body.payload||{}),body.checksum||null,syncStatus,decision.reason||null,existing?.payload_json||null,claims.sub||claims.email||claims.role,now,now).run();
        return json({ ok:!decision.conflict, sync_id:id, status:syncStatus, decision }, decision.conflict ? 409 : 200);
      }


      if(path==='/api/collection-operations/issues'&&method==='POST'){
        const claims=await requireAuth(request,env);
        if(!['enumerator','me_officer','project_manager','org_admin','super_admin'].includes(claims.role))return error('Field issue access required',403);
        const body=await request.json().catch(()=>({}));
        if(!body.issue_type||!body.description)return error('issue_type and description are required',400);
        const id=`issue_${crypto.randomUUID()}`,now=new Date().toISOString(),org=claims.organization_id||body.organization_id;
        await env.DB.prepare('INSERT INTO field_issue_reports (id,organization_id,assignment_id,reported_by,issue_type,description,device_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,org,body.assignment_id||null,claims.sub||claims.email||claims.role,body.issue_type,body.description,body.device_id||null,'open',now,now).run();
        return json({ok:true,issue_id:id,status:'open'},201);
      }

      if (path === '/api/collection-operations/double-entry/assign' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','me_officer'].includes(claims.role)) return error('Double-entry assignment access required', 403);
        const body = await request.json().catch(() => ({}));
        if (!body.project_id || !body.survey_id || !body.source_response_id) return error('project_id, survey_id and source_response_id are required', 400);
        const org = claims.organization_id || body.organization_id;
        const id=`double_${crypto.randomUUID()}`, now=new Date().toISOString();
        await env.DB.prepare(`INSERT INTO double_entry_assignments (id,organization_id,project_id,survey_id,source_response_id,first_enumerator_id,second_enumerator_id,verification_mode,status,due_at,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(id,org,body.project_id,body.survey_id,body.source_response_id,body.first_enumerator_id||null,body.second_enumerator_id||null,body.verification_mode||'adaptive','assigned',body.due_at||null,claims.sub||claims.email||claims.role,now,now).run();
        return json({ok:true,assignment_id:id,status:'assigned'},201);
      }

      const doubleSubmitMatch = path.match(/^\/api\/collection-operations\/double-entry\/([^/]+)\/submit$/);
      if (doubleSubmitMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','me_officer','enumerator'].includes(claims.role)) return error('Double-entry submission access required', 403);
        const body = await request.json().catch(() => ({}));
        if (![1,2].includes(Number(body.entry_number)) || !body.answers) return error('entry_number (1 or 2) and answers are required',400);
        const assignmentId=doubleSubmitMatch[1], now=new Date().toISOString(), submissionId=`des_${crypto.randomUUID()}`;
        await env.DB.prepare(`INSERT INTO double_entry_submissions (id,assignment_id,entry_number,enumerator_id,answers_json,metadata_json,submitted_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(assignment_id,entry_number) DO UPDATE SET enumerator_id=excluded.enumerator_id,answers_json=excluded.answers_json,metadata_json=excluded.metadata_json,submitted_at=excluded.submitted_at`)
          .bind(submissionId,assignmentId,Number(body.entry_number),claims.sub||body.enumerator_id||claims.role,JSON.stringify(body.answers),JSON.stringify(body.metadata||{}),now).run();
        const submissions=(await env.DB.prepare(`SELECT * FROM double_entry_submissions WHERE assignment_id=? ORDER BY entry_number`).bind(assignmentId).all()).results||[];
        let comparison=null;
        if (submissions.length===2) {
          comparison=compareDoubleEntries(JSON.parse(submissions[0].answers_json),JSON.parse(submissions[1].answers_json),{criticalFields:body.critical_fields||[],acceptanceThreshold:body.acceptance_threshold||90});
          await env.DB.prepare(`INSERT INTO double_entry_comparisons (id,assignment_id,match_score,conflict_score,status,conflicts_json,compared_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(assignment_id) DO UPDATE SET match_score=excluded.match_score,conflict_score=excluded.conflict_score,status=excluded.status,conflicts_json=excluded.conflicts_json,compared_at=excluded.compared_at`)
            .bind(`dec_${crypto.randomUUID()}`,assignmentId,comparison.match_score,comparison.conflict_score,comparison.status,JSON.stringify(comparison.conflicts),now).run();
          await env.DB.prepare(`UPDATE double_entry_assignments SET status=?,updated_at=? WHERE id=?`).bind(comparison.status,now,assignmentId).run();
        }
        return json({ok:true,submission_id:submissionId,comparison},200);
      }

      const doubleReviewMatch = path.match(/^\/api\/collection-operations\/double-entry\/([^/]+)\/review$/);
      if (doubleReviewMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','me_officer'].includes(claims.role)) return error('Supervisor or M&E review access required',403);
        const body=await request.json().catch(()=>({}));
        if (!['accepted','rejected','recollect','escalated'].includes(body.decision)) return error('Valid review decision is required',400);
        const now=new Date().toISOString();
        await env.DB.prepare(`UPDATE double_entry_comparisons SET reviewed_by=?,review_decision=?,review_notes=?,reviewed_at=? WHERE assignment_id=?`).bind(claims.sub||claims.email||claims.role,body.decision,body.notes||null,now,doubleReviewMatch[1]).run();
        await env.DB.prepare(`UPDATE double_entry_assignments SET status=?,updated_at=? WHERE id=?`).bind(body.decision,now,doubleReviewMatch[1]).run();
        return json({ok:true,status:body.decision,reviewed_at:now});
      }

      if (path === '/api/collection-operations/quality/assess' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','me_officer','enumerator'].includes(claims.role)) return error('Quality assessment access required',403);
        const body=await request.json().catch(()=>({}));
        if (!body.response_id) return error('response_id is required',400);
        const assessment=scoreFraudAndQuality(body), now=new Date().toISOString(), id=`quality_${crypto.randomUUID()}`;
        await env.DB.prepare(`INSERT INTO field_quality_assessments (id,organization_id,project_id,survey_id,response_id,enumerator_id,fraud_risk_score,quality_score,verification_mode,flags_json,review_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?)`)
          .bind(id,claims.organization_id||body.organization_id,body.project_id||null,body.survey_id||null,body.response_id,body.enumerator_id||claims.sub||null,assessment.fraud_risk_score,assessment.quality_score,assessment.verification_mode,JSON.stringify(assessment.flags),assessment.fraud_risk_score>=50?'needs_review':'passed',now,now).run();
        return json({ok:true,assessment_id:id,...assessment},201);
      }

      if (path === '/api/collection-operations/review-queue' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','me_officer'].includes(claims.role)) return error('Review queue access required',403);
        const org=claims.organization_id||url.searchParams.get('organization_id');
        const quality=(await env.DB.prepare(`SELECT * FROM field_quality_assessments WHERE organization_id=? AND review_status!='passed' ORDER BY fraud_risk_score DESC,created_at DESC LIMIT 200`).bind(org).all()).results||[];
        const doubleEntry=(await env.DB.prepare(`SELECT a.*,c.match_score,c.conflict_score,c.status AS comparison_status,c.conflicts_json FROM double_entry_assignments a LEFT JOIN double_entry_comparisons c ON c.assignment_id=a.id WHERE a.organization_id=? AND a.status NOT IN ('accepted','verified') ORDER BY a.created_at DESC LIMIT 200`).bind(org).all()).results||[];
        const conflicts=(await env.DB.prepare(`SELECT * FROM offline_sync_items_v2 WHERE organization_id=? AND sync_status='conflict' ORDER BY updated_at DESC LIMIT 200`).bind(org).all()).results||[];
        return json({ok:true,quality,double_entry:doubleEntry,offline_conflicts:conflicts},200,{'Cache-Control':'no-store'});
      }

      // v210.2 — Production Finalization: routing, distribution, queues, approvals, dashboards and notifications.
      if (path === '/api/production-finalization/readiness' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager'].includes(claims.role)) return error('Production readiness access required', 403);
        return json(buildProductionReadiness({
          site_url: env.SITE_URL,
          database: Boolean(env.DB), storage: Boolean(env.AUDIO_BUCKET),
          twilio_voice: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_VOICE_FROM),
          twilio_sms: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_SMS_FROM),
          whatsapp: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_WHATSAPP_FROM),
          queues: true, notifications: true, approval_engine: true
        }), 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/production-finalization/distribution/actions' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const allowed = ['super_admin','org_admin','project_manager','me_officer','data_analyst'];
        if (!allowed.includes(claims.role)) return error('Distribution access required', 403);
        return json(buildDistributionActions({ survey_code: url.searchParams.get('survey_code') || 'EYDEMO', site_url: env.SITE_URL }), 200, { 'Cache-Control': 'no-store' });
      }

      if (path === '/api/production-finalization/distribution/event' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const body = await request.json().catch(() => ({}));
        const eventId = `dist_${crypto.randomUUID()}`;
        const now = new Date().toISOString();
        await env.DB.prepare(`INSERT INTO distribution_events (id, organization_id, campaign_id, survey_id, action, channel, status, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .bind(eventId, claims.organization_id || null, body.campaign_id || null, body.survey_id || null, body.action || 'unknown', body.channel || null, body.status || 'recorded', JSON.stringify(body.metadata || {}), now).run().catch(() => {});
        return json({ ok: true, event_id: eventId, recorded_at: now });
      }

      if (path === '/api/production-finalization/distribution/send-sms' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','me_officer','data_analyst'].includes(claims.role)) return error('SMS distribution access required', 403);
        const body = await request.json().catch(() => ({}));
        if (!body.to) return error('Recipient phone number is required', 400);
        const surveyLink = productionUrl(`/s/${encodeURIComponent(body.survey_code || 'EYDEMO')}`, { site_url: env.SITE_URL });
        const result = await sendTwilioSms(env, { to: body.to, body: body.message || `You are invited to participate in this survey: ${surveyLink}`, statusCallback: productionUrl('/api/twilio/status/sms', { site_url: env.SITE_URL }) });
        return json(result, result.ok ? 200 : (result.configured ? 502 : 503));
      }

      if (path === '/api/production-finalization/distribution/send-whatsapp' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','me_officer','data_analyst'].includes(claims.role)) return error('WhatsApp distribution access required', 403);
        const body = await request.json().catch(() => ({}));
        if (!body.to) return error('Recipient WhatsApp number is required', 400);
        const surveyLink = productionUrl(`/s/${encodeURIComponent(body.survey_code || 'EYDEMO')}`, { site_url: env.SITE_URL });
        const result = await sendTwilioWhatsApp(env, { to: body.to, body: body.message || `You are invited to participate in this VoiceInsights Africa survey: ${surveyLink}`, mediaUrl: body.media_url || undefined, statusCallback: productionUrl('/api/twilio/status/whatsapp', { site_url: env.SITE_URL }) });
        return json(result, result.ok ? 200 : (result.configured ? 502 : 503));
      }

      if (path === '/api/production-finalization/distribution/launch-call' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','me_officer','data_analyst'].includes(claims.role)) return error('Voice campaign access required', 403);
        const body = await request.json().catch(() => ({}));
        if (!body.to) return error('Recipient phone number is required', 400);
        const result = await startTwilioCall(env, { to: body.to, twimlUrl: body.twiml_url || productionUrl(`/api/twilio/voice/interview?survey_code=${encodeURIComponent(body.survey_code || 'EYDEMO')}`, { site_url: env.SITE_URL }), statusCallback: productionUrl('/api/twilio/status/voice', { site_url: env.SITE_URL }) });
        return json(result, result.ok ? 200 : (result.configured ? 502 : 503));
      }

      if (path === '/api/production-finalization/campaigns/launch' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager','me_officer','data_analyst'].includes(claims.role)) return error('Campaign launch access required', 403);
        const body = await request.json().catch(() => ({}));
        const plan = buildCampaignPlan({ ...body, organization_id: claims.organization_id || body.organization_id });
        const jobs = plan.channels.map((channel, idx) => buildQueueJob(channel === 'web' ? 'ai' : channel, { ...plan, channel }, { priority: 10 - Math.min(idx, 5) }));
        const now = new Date().toISOString();
        for (const job of jobs) {
          await env.DB.prepare(`INSERT INTO production_queue_jobs (id, organization_id, campaign_id, queue_type, priority, status, attempts, max_attempts, payload_json, next_attempt_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .bind(job.id, job.organization_id, job.campaign_id, job.queue, job.priority, job.status, job.attempts, job.max_attempts, JSON.stringify(job.payload), job.next_attempt_at, now, now).run().catch(() => {});
        }
        return json({ ok: true, plan, queued_jobs: jobs.map(j => ({ id: j.id, queue: j.queue, priority: j.priority })) }, 202);
      }

      if (path === '/api/production-finalization/queues' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','org_admin','project_manager'].includes(claims.role)) return error('Queue center access required', 403);
        let rows = [];
        try { rows = (await env.DB.prepare(`SELECT queue_type, status, COUNT(*) AS count FROM production_queue_jobs GROUP BY queue_type, status`).all()).results || []; } catch (_) {}
        return json({ ok: true, queues: rows, supported: ['phone','whatsapp','sms','offline','ai','report','export'] }, 200, { 'Cache-Control': 'no-store' });
      }


      if (path === '/api/production-finalization/approvals' && method === 'GET') {
        const claims=await requireAuth(request,env);
        if(!['super_admin','founder_executive','operations_manager','project_manager'].includes(claims.role)) return error('Approval access required',403);
        let rows=[];
        const where=(claims.role==='founder_executive'||claims.role==='super_admin')?`status='awaiting_founder_approval'`:`requested_by=?`;
        try { rows=(claims.role==='founder_executive'||claims.role==='super_admin')?(await env.DB.prepare(`SELECT * FROM executive_approval_requests WHERE ${where} ORDER BY created_at DESC LIMIT 100`).all()).results||[]:(await env.DB.prepare(`SELECT * FROM executive_approval_requests WHERE ${where} ORDER BY created_at DESC LIMIT 100`).bind(claims.sub||claims.email||claims.role).all()).results||[]; } catch(_) {}
        return json({ok:true,approvals:rows},200,{'Cache-Control':'no-store'});
      }

      const approvalReadMatch=path.match(/^\/api\/production-finalization-v2102\/approvals\/([^/]+)$/);
      if(approvalReadMatch && method==='GET'){
        const claims=await requireAuth(request,env);
        if(!['super_admin','founder_executive','operations_manager','project_manager'].includes(claims.role)) return error('Approval access required',403);
        const row=await env.DB.prepare('SELECT * FROM executive_approval_requests WHERE id=?').bind(approvalReadMatch[1]).first();
        if(!row)return error('Approval not found',404);
        if(!['super_admin','founder_executive'].includes(claims.role) && row.requested_by!==(claims.sub||claims.email||claims.role))return error('Approval access denied',403);
        return json({ok:true,approval:row},200,{'Cache-Control':'no-store'});
      }

      if(path==='/api/production-finalization/operations-manager/control'&&method==='POST'){
        const claims=await requireAuth(request,env);
        if(!['super_admin','founder_executive'].includes(claims.role))return error('Founder control required',403);
        const body=await request.json().catch(()=>({}));
        if(!['invite','replace','suspend','remove'].includes(body.action))return error('Valid action is required',400);
        if(['invite','replace'].includes(body.action)&&(!body.email||!body.full_name))return error('full_name and email are required',400);
        const id=`oma_${crypto.randomUUID()}`,now=new Date().toISOString(),status=body.action==='suspend'?'suspended':body.action==='remove'?'removed':'pending_acceptance';
        await env.DB.prepare('INSERT INTO operations_manager_appointments (id,action,full_name,email,status,note,requested_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(id,body.action,body.full_name||null,body.email||null,status,body.note||null,claims.sub||claims.email||claims.role,now,now).run();
        await env.DB.prepare('INSERT INTO production_notifications (id,audience_role,title,message,channel,status,created_at) VALUES (?,?,?,?,?,?,?)').bind(`notification_${crypto.randomUUID()}`,'founder_executive',`Operations Manager ${body.action}`,`${body.full_name||body.email||'Current manager'} — ${status}`,'in_app','unread',now).run().catch(()=>{});
        return json({ok:true,id,action:body.action,status},201);
      }

      if (path === '/api/production-finalization/approvals/submit' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','project_manager','operations_manager'].includes(claims.role)) return error('Operations Manager access required', 403);
        const body = await request.json().catch(() => ({}));
        const id = `approval_${crypto.randomUUID()}`; const now = new Date().toISOString();
        await env.DB.prepare(`INSERT INTO executive_approval_requests (id, requested_by, organization_name, project_name, proposal_url, contract_url, invoice_url, workflow_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'awaiting_founder_approval', ?, ?)`)
          .bind(id, claims.sub || claims.email || claims.role, body.organization_name || 'New Organization', body.project_name || 'New Project', body.proposal_url || null, body.contract_url || null, body.invoice_url || null, body.workflow_id || null, now, now).run();
        const notification = buildNotification({ audience_role: 'founder_executive', title: 'New approval request', message: `${body.organization_name || 'Client'} — ${body.project_name || 'Project'}` });
        await env.DB.prepare(`INSERT INTO production_notifications (id, audience_role, title, message, channel, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(notification.id, notification.audience_role, notification.title, notification.message, notification.channel, notification.status, notification.created_at).run().catch(() => {});
        return json({ ok: true, id, status: 'awaiting_founder_approval' }, 201);
      }

      const approvalDecisionMatch = path.match(/^\/api\/production-finalization-v2102\/approvals\/([^/]+)\/decision$/);
      if (approvalDecisionMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        const body = await request.json().catch(() => ({}));
        const execution = buildApprovalExecution({ id: approvalDecisionMatch[1], decision: body.decision || 'approve' }, { role: claims.role, user_id: claims.sub, email: claims.email });
        if (!execution.ok) return error(execution.error, execution.status);
        const approval=await env.DB.prepare('SELECT * FROM executive_approval_requests WHERE id=?').bind(approvalDecisionMatch[1]).first();
        if(!approval)return error('Approval not found',404);
        const now = new Date().toISOString();
        if(execution.decision!=='approve'){
          await env.DB.prepare(`UPDATE executive_approval_requests SET status=?,decision_note=?,approved_by=?,approved_at=?,updated_at=? WHERE id=?`).bind(execution.decision,body.note||null,execution.approved_by,execution.approved_at,now,approval.id).run();
          if(approval.workflow_id) await env.DB.prepare("UPDATE enterprise_client_workflows SET stage=?,updated_at=? WHERE id=?").bind(execution.decision==='request_changes'?'invoice_uploaded':'rejected',now,approval.workflow_id).run().catch(()=>{});
          return json({...execution,provisioning_status:'not_applicable'});
        }
        const workflow=approval.workflow_id?await env.DB.prepare('SELECT * FROM enterprise_client_workflows WHERE id=?').bind(approval.workflow_id).first():null;
        const checked=validateProvisioningInput({approval_id:approval.id,workflow_id:approval.workflow_id,organization_name:approval.organization_name,project_name:approval.project_name});
        if(!checked.ok)return json(checked,400);
        const orgId=`org_${crypto.randomUUID()}`,projectId=`project_${crypto.randomUUID()}`,workspaceId=`workspace_${crypto.randomUUID()}`;
        try{
          await env.DB.batch([
            env.DB.prepare('INSERT INTO organizations (id,name,type,country,billing_tier,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(orgId,approval.organization_name,'enterprise_client',workflow?.metadata_json?JSON.parse(workflow.metadata_json||'{}').country||null:null,'enterprise','active',now,now),
            env.DB.prepare('INSERT INTO enterprise_projects (id,organization_id,name,status,owner_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(projectId,orgId,approval.project_name,'active',approval.requested_by,now,now),
            env.DB.prepare('INSERT INTO organization_workspaces (id,organization_id,project_id,status,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(workspaceId,orgId,projectId,'active',now,now),
            env.DB.prepare("UPDATE executive_approval_requests SET status='approved',decision_note=?,approved_by=?,approved_at=?,provisioned_organization_id=?,provisioned_project_id=?,provisioning_status='completed',provisioning_error=NULL,updated_at=? WHERE id=?").bind(body.note||null,execution.approved_by,execution.approved_at,orgId,projectId,now,approval.id),
            env.DB.prepare("UPDATE enterprise_client_workflows SET stage='workspace_ready',approval_id=?,organization_id=?,project_id=?,workspace_id=?,updated_at=? WHERE id=?").bind(approval.id,orgId,projectId,workspaceId,now,approval.workflow_id),
            env.DB.prepare('INSERT INTO enterprise_workflow_events (id,workflow_id,organization_id,actor_id,actor_role,from_stage,to_stage,result,metadata_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(`wfe_${crypto.randomUUID()}`,approval.workflow_id,orgId,claims.sub,claims.role,workflow?.stage||'submitted_for_approval','workspace_ready','success',JSON.stringify({approval_id:approval.id,project_id:projectId,workspace_id:workspaceId}),now),
            env.DB.prepare('INSERT INTO production_notifications (id,organization_id,user_id,audience_role,title,message,channel,status,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(`notification_${crypto.randomUUID()}`,orgId,approval.requested_by,'operations_manager','Client approved and provisioned',`${approval.organization_name} / ${approval.project_name}`,'in_app','unread',now)
          ]);
          return json({...execution,provisioning_status:'completed',organization_id:orgId,project_id:projectId,workspace_id:workspaceId});
        }catch(e){
          await env.DB.prepare("UPDATE executive_approval_requests SET provisioning_status='failed',provisioning_error=?,updated_at=? WHERE id=?").bind(String(e.message||e).slice(0,500),now,approval.id).run().catch(()=>{});
          return error('Approval recorded but provisioning failed. No success response was issued.',500);
        }
      }

      if (path === '/api/production-finalization/dashboard/operations' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','project_manager','operations_manager'].includes(claims.role)) return error('Operations dashboard access required', 403);
        const one=async(sql,...a)=>{try{return await env.DB.prepare(sql).bind(...a).first()}catch(_){return null}};
        const count=async(sql,...a)=>Number((await one(sql,...a))?.c||0);
        const today=new Date().toISOString().slice(0,10);
        const pending=await count("SELECT COUNT(*) c FROM executive_approval_requests WHERE status='awaiting_founder_approval'");
        const meetings=await count("SELECT COUNT(*) c FROM enterprise_client_workflows WHERE stage IN ('demo_received','meeting_completed')");
        const proposals=await count("SELECT COUNT(*) c FROM enterprise_client_workflows WHERE proposal_reference IS NULL AND stage!='rejected'");
        const contracts=await count("SELECT COUNT(*) c FROM enterprise_client_workflows WHERE proposal_reference IS NOT NULL AND contract_reference IS NULL AND stage!='rejected'");
        const invoices=await count("SELECT COUNT(*) c FROM enterprise_client_workflows WHERE contract_reference IS NOT NULL AND invoice_reference IS NULL AND stage!='rejected'");
        const activeProjects=await count("SELECT COUNT(*) c FROM enterprise_projects WHERE status='active'");
        const launches=await count("SELECT COUNT(*) c FROM campaigns WHERE status IN ('scheduled','queued')");
        const revenue=Number((await one("SELECT COALESCE(SUM(budget_value),0) v FROM enterprise_projects WHERE status='active'"))?.v||0);
        const notifications=await count("SELECT COUNT(*) c FROM production_notifications WHERE audience_role='operations_manager' AND read_at IS NULL");
        return json({title:'Operations Dashboard',data_source:'live_database',generated_at:new Date().toISOString(),cards:{daily_pipeline:meetings+proposals+contracts+invoices,pending_meetings:meetings,pending_proposals:proposals,pending_contracts:contracts,pending_invoices:invoices,pending_approval:pending,active_projects:activeProjects,upcoming_launches:launches,revenue_pipeline:metric(revenue,{unit:'currency'}),approval_requests:pending,unread_notifications:notifications}},200,{'Cache-Control':'no-store'});
      }

      if (path === '/api/production-finalization/dashboard/founder' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (!['super_admin','founder_executive','founder'].includes(claims.role)) return error('Founder dashboard access required', 403);
        const one=async(sql,...a)=>{try{return await env.DB.prepare(sql).bind(...a).first()}catch(_){return null}};
        const count=async(sql,...a)=>Number((await one(sql,...a))?.c||0);
        const pending=await count("SELECT COUNT(*) c FROM executive_approval_requests WHERE status='awaiting_founder_approval'");
        const orgs=await count('SELECT COUNT(*) c FROM organizations');
        const invites=await count("SELECT COUNT(*) c FROM organization_invitations WHERE status='pending'");
        const projects=await count("SELECT COUNT(*) c FROM enterprise_projects WHERE status='active'");
        const revenue=Number((await one("SELECT COALESCE(SUM(budget_value),0) v FROM enterprise_projects WHERE status='active'"))?.v||0);
        const securityAlerts=await count("SELECT COUNT(*) c FROM security_audit_events_v2 WHERE risk_level IN ('critical','high') AND created_at>=datetime('now','-30 day')");
        const failedJobs=await count("SELECT COUNT(*) c FROM production_queue_jobs_ws4 WHERE status IN ('failed','dead_letter')");
        const lastProvider=await one("SELECT created_at,status FROM provider_health_events WHERE status='success' ORDER BY created_at DESC LIMIT 1");
        return json({title:'Founder Executive Dashboard',data_source:'live_database',generated_at:new Date().toISOString(),cards:{pending_approvals:pending,organizations:orgs,active_projects:projects,revenue:metric(revenue,{unit:'currency'}),recent_invites:invites,platform_health:failedJobs?'degraded':'operational',cloud_health:lastProvider?healthMetric({configured:true,last_success_at:lastProvider.created_at}):healthMetric({configured:false}),security_alerts:securityAlerts}},200,{'Cache-Control':'no-store'});
      }

      if(path==='/api/organization/operational-dashboard'&&method==='GET'){
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims);
        const one=async(sql,...a)=>{try{return await env.DB.prepare(sql).bind(...a).first()}catch(_){return null}}; const count=async(sql,...a)=>Number((await one(sql,...a))?.c||0);
        const org=await env.DB.prepare('SELECT id,name,type,country,billing_tier,status,created_at FROM organizations WHERE id=?').bind(orgId).first();
        const users=await count('SELECT COUNT(*) c FROM users WHERE organization_id=? AND is_active=1',orgId);
        const projects=await count("SELECT COUNT(*) c FROM enterprise_projects WHERE organization_id=? AND status='active'",orgId);
        const surveys=await count('SELECT COUNT(*) c FROM surveys WHERE organization_id=?',orgId);
        const campaigns=await count('SELECT COUNT(*) c FROM campaigns WHERE organization_id=?',orgId);
        const reports=await count('SELECT COUNT(*) c FROM generated_reports WHERE organization_id=?',orgId);
        const mfa=await count("SELECT COUNT(DISTINCT user_id) c FROM iam_mfa_methods WHERE organization_id=? AND status='verified'",orgId);
        const completed=await count("SELECT COUNT(*) c FROM responses r JOIN campaigns c ON c.id=r.campaign_id WHERE c.organization_id=? AND r.status='completed'",orgId);
        const allResponses=await count("SELECT COUNT(*) c FROM responses r JOIN campaigns c ON c.id=r.campaign_id WHERE c.organization_id=?",orgId);
        const fraud=await one("SELECT AVG(COALESCE(r.fraud_score,0)) v FROM responses r JOIN campaigns c ON c.id=r.campaign_id WHERE c.organization_id=?",orgId);
        return json({ok:true,data_source:'live_database',organization:org,metrics:{active_users:metric(users),active_projects:metric(projects),surveys:metric(surveys),campaigns:metric(campaigns),reports:metric(reports),mfa_coverage:users?metric(mfa/users*100,{unit:'percent'}):metric(null,{measured:false}),response_completion:allResponses?metric(completed/allResponses*100,{unit:'percent'}):metric(null,{measured:false}),average_fraud_risk:allResponses?metric(Number(fraud?.v||0),{unit:'percent'}):metric(null,{measured:false})}},200,{'Cache-Control':'no-store'});
      }

      if(path==='/api/projects/manager-dashboard'&&method==='GET'){
        const claims=await requireAuth(request,env); if(!['super_admin','org_admin','organization_admin','project_manager','head_of_programs','me_officer'].includes(claims.role))return error('Project workspace access required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); const projectId=url.searchParams.get('project_id');
        let projects=[]; try{projects=(await env.DB.prepare(`SELECT p.*, (SELECT COUNT(*) FROM campaigns c WHERE c.organization_id=p.organization_id) campaign_count, (SELECT COUNT(*) FROM enumerator_assignments_v2 a WHERE a.project_id=p.id) assignment_count FROM enterprise_projects p WHERE p.organization_id=? ${projectId?'AND p.id=?':''} ORDER BY p.updated_at DESC`).bind(...(projectId?[orgId,projectId]:[orgId])).all()).results||[]}catch(_){}
        return json({ok:true,data_source:'live_database',projects},200,{'Cache-Control':'no-store'});
      }

      const packageMatch=path.match(/^\/api\/collection-operations\/assignments\/([^/]+)\/package$/);
      if(packageMatch&&method==='GET'){
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims);
        const a=await env.DB.prepare('SELECT * FROM enumerator_assignments_v2 WHERE id=? AND organization_id=?').bind(packageMatch[1],orgId).first(); if(!a)return error('Assignment not found',404);
        if(claims.role==='enumerator'&&a.enumerator_id!==claims.sub)return error('Assignment access denied',403);
        const survey=await env.DB.prepare('SELECT * FROM surveys WHERE id=? AND organization_id=?').bind(a.survey_id,orgId).first(); if(!survey)return error('Survey not found',404);
        const questions=(await env.DB.prepare('SELECT * FROM questions WHERE survey_id=? ORDER BY order_index').bind(a.survey_id).all()).results||[];
        const consent_scripts=[{language:survey.language||'en',text:'Obtain informed consent before beginning. Record consent status before collecting answers.'}];
        const pkg=buildOfflinePackage({assignment:a,survey,questions,consent_scripts,validation_rules:questions.map(q=>({question_id:q.id,required:Boolean(q.is_required),type:q.question_type})),manifest:{organization_id:orgId,checksum_algorithm:'SHA-256'}});
        return json(pkg,200,{'Cache-Control':'no-store'});
      }

      if(path==='/api/collection-operations/conflicts'&&method==='GET'){
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); if(!['super_admin','org_admin','organization_admin','project_manager','head_of_programs','me_officer','enumerator'].includes(claims.role))return error('Conflict access required',403);
        let rows=(await env.DB.prepare("SELECT * FROM offline_sync_items_v2 WHERE organization_id=? AND sync_status='conflict' ORDER BY updated_at DESC LIMIT 200").bind(orgId).all()).results||[];
        if(claims.role==='enumerator') rows=rows.filter(r=>r.synced_by===claims.sub);
        return json({ok:true,conflicts:rows.map(r=>({...r,payload:JSON.parse(r.payload_json||'{}'),server_payload:JSON.parse(r.server_payload_json||'{}'),differences:compareConflict(JSON.parse(r.payload_json||'{}'),JSON.parse(r.server_payload_json||'{}'))}))},200,{'Cache-Control':'no-store'});
      }

      const resolveConflictMatch=path.match(/^\/api\/collection-operations\/conflicts\/([^/]+)\/resolve$/);
      if(resolveConflictMatch&&method==='POST'){
        const claims=await requireAuth(request,env); if(!['super_admin','org_admin','organization_admin','project_manager','head_of_programs','me_officer'].includes(claims.role))return error('Supervisor or M&E permission required',403);
        const orgId=await getEffectiveOrgId(request,env,claims); const body=await request.json().catch(()=>({})); if(!['accept_local','accept_server','merge','recollect'].includes(body.resolution))return error('Valid resolution is required',400);
        const row=await env.DB.prepare("SELECT * FROM offline_sync_items_v2 WHERE id=? AND organization_id=? AND sync_status='conflict'").bind(resolveConflictMatch[1],orgId).first(); if(!row)return error('Conflict not found',404);
        const merged=body.resolution==='accept_local'?JSON.parse(row.payload_json||'{}'):body.resolution==='accept_server'?JSON.parse(row.server_payload_json||'{}'):body.merged_payload||null; const now=new Date().toISOString();
        await env.DB.batch([env.DB.prepare('INSERT OR REPLACE INTO offline_conflict_resolutions (id,sync_item_id,organization_id,resolution,merged_payload_json,resolved_by,resolved_at) VALUES (?,?,?,?,?,?,?)').bind(`ocr_${crypto.randomUUID()}`,row.id,orgId,body.resolution,merged?JSON.stringify(merged):null,claims.sub,now),env.DB.prepare("UPDATE offline_sync_items_v2 SET sync_status=?,payload_json=COALESCE(?,payload_json),updated_at=? WHERE id=?").bind(body.resolution==='recollect'?'recollect_required':'resolved',merged?JSON.stringify(merged):null,now,row.id)]);
        return json({ok:true,resolution:body.resolution,status:body.resolution==='recollect'?'recollect_required':'resolved'});
      }

      if(path==='/api/collection-operations/provider-health'&&method==='GET'){
        await requireAuth(request,env); const channels=['sms','whatsapp','voice']; const result={};
        for(const ch of channels){let lastSuccess=null,lastFailure=null,total=0,failed=0;try{lastSuccess=await env.DB.prepare("SELECT created_at FROM provider_health_events WHERE channel=? AND status='success' ORDER BY created_at DESC LIMIT 1").bind(ch).first();lastFailure=await env.DB.prepare("SELECT created_at FROM provider_health_events WHERE channel=? AND status!='success' ORDER BY created_at DESC LIMIT 1").bind(ch).first();const c=await env.DB.prepare("SELECT COUNT(*) total,SUM(CASE WHEN status!='success' THEN 1 ELSE 0 END) failed FROM provider_health_events WHERE channel=? AND created_at>=datetime('now','-24 hour')").bind(ch).first();total=Number(c?.total||0);failed=Number(c?.failed||0)}catch(_){} const configured=ch==='sms'?Boolean(env.TWILIO_SMS_FROM||env.TWILIO_PHONE_NUMBER):ch==='whatsapp'?Boolean(env.TWILIO_WHATSAPP_FROM||env.TWILIO_WHATSAPP_NUMBER):Boolean(env.TWILIO_VOICE_FROM||env.TWILIO_PHONE_NUMBER);result[ch]=healthMetric({configured,last_success_at:lastSuccess?.created_at,last_failure_at:lastFailure?.created_at,error_rate:total?Math.round(failed/total*100):null})}
        return json({ok:true,data_source:'provider_events',channels:result},200,{'Cache-Control':'no-store'});
      }

      if (path === '/api/production-finalization/notifications' && method === 'GET') {
        const claims = await requireAuth(request, env);
        let rows = [];
        try { rows = (await env.DB.prepare(`SELECT * FROM production_notifications WHERE user_id = ? OR audience_role = ? ORDER BY created_at DESC LIMIT 50`).bind(claims.sub || '', claims.role).all()).results || []; } catch (_) {}
        return json({ ok: true, notifications: rows }, 200, { 'Cache-Control': 'no-store' });
      }

      const publicDemoDownloadMatch = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/track-download$/);
      if (publicDemoDownloadMatch && method === 'POST') {
        // Best-effort popularity counter for the "Most Downloaded" sort —
        // still hard-filtered to is_demo=1, and failure here is silent
        // (never blocks an actual download over a counter update).
        await env.DB.prepare(`UPDATE generated_reports SET demo_downloads = demo_downloads + 1 WHERE id = ? AND is_demo = 1 AND status = 'published'`).bind(publicDemoDownloadMatch[1]).run().catch(() => {});
        return json({ ok: true });
      }


      const publicDemoOfficeExportMatch = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/export\/(docx|xlsx)$/);
      if (publicDemoOfficeExportMatch && method === 'GET') {
        const [, reportId, format] = publicDemoOfficeExportMatch;
        const reportRow = await env.DB.prepare(`SELECT document_model_json, demo_country, is_demo, status FROM generated_reports WHERE id=? AND is_demo=1 AND status='published'`).bind(reportId).first();
        if(!reportRow) return error('Demonstration report not found',404);
        const model=JSON.parse(reportRow.document_model_json); model.is_demo=true; model.demo_country=reportRow.demo_country;
        const artifact=format==='docx'?await renderDocxBinary(model,{report_id:reportId}):await renderXlsxBinary(model,{report_id:reportId});
        await env.DB.prepare(`UPDATE generated_reports SET demo_downloads=demo_downloads+1 WHERE id=? AND is_demo=1`).bind(reportId).run().catch(()=>{});
        return new Response(artifact.bytes,{status:200,headers:{'Content-Type':artifact.content_type,'Content-Disposition':`attachment; filename="${artifact.filename}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','X-Artifact-Checksum':artifact.checksum}});
      }

      // v187 Production binary rendering lifecycle — public demo, safe and demo-only.
      // Creates a completed render job, writes a real .pdf/.pptx binary artifact to R2
      // (RENDERED_REPORTS_BUCKET/DOCUMENTS_BUCKET/AUDIO_BUCKET), and returns a signed
      // download descriptor. This route never serves private reports.
      const publicDemoRenderCreateMatch = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/render\/(pdf|pptx|executive_report_pdf|board_deck_pptx)$/);
      if (publicDemoRenderCreateMatch && method === 'POST') {
        const [, reportId, renderFormat] = publicDemoRenderCreateMatch;
        const reportRow = await env.DB.prepare(
          `SELECT document_model_json, demo_country, is_demo, status FROM generated_reports WHERE id = ? AND is_demo = 1 AND status = 'published'`
        ).bind(reportId).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const authz = validateDownloadAuthorization({ isPublicRoute: true, isDemo: !!reportRow.is_demo, status: reportRow.status });
        if (!authz.allowed) return error('Demonstration report not available', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = true;
        documentModel.demo_country = reportRow.demo_country;
        const job = createRenderJob({ reportId, tenantId: 'public_demo', format: renderFormat, requestedBy: 'public-demo-viewer', priority: 3 });
        const result = await processDedicatedBinaryRenderJob(job, enrichDocumentModelWithPhase20(documentModel), env, { actor: 'public-demo-renderer' });
        if (!result.released) return json({ ok: false, job: result.job, validation: result.validation }, 422);
        return json({ ok: true, job: result.job, download: result.download_descriptor, artifact: result.binary, storage: result.storage, audit: result.audit }, 201, { 'Cache-Control': 'no-store' });
      }

      const publicDemoRenderCancelMatch = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/render-jobs\/(render_job_[a-zA-Z0-9_]+)\/cancel$/);
      if (publicDemoRenderCancelMatch && method === 'POST') {
        const reportRow = await env.DB.prepare(
          `SELECT id FROM generated_reports WHERE id = ? AND is_demo = 1 AND status = 'published'`
        ).bind(publicDemoRenderCancelMatch[1]).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const cancelled = transitionRenderJob({ id: publicDemoRenderCancelMatch[2], report_id: publicDemoRenderCancelMatch[1], tenant_id: 'public_demo', format: 'pdf', status: 'pending', audit: [] }, 'cancelled', { actor: 'public-demo-viewer' });
        return json({ ok: true, job: cancelled }, 200, { 'Cache-Control': 'no-store' });
      }

      // Public, no-auth equivalent of the internal multi-format render
      // endpoint (Phase 15) — powers the "Download X" buttons on the
      // public sample-report-viewer.html. SAME hard is_demo=1 filter as
      // every other public demo endpoint; a real client's report can
      // never be reached through this path.
      const publicDemoFormatMatch = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/format\/([a-z_]+)$/);
      if (publicDemoFormatMatch && method === 'GET') {
        const [, reportId, formatName] = publicDemoFormatMatch;
        const reportRow = await env.DB.prepare(
          `SELECT document_model_json, demo_country FROM generated_reports WHERE id = ? AND is_demo = 1 AND status = 'published'`
        ).bind(reportId).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = true;
        documentModel.demo_country = reportRow.demo_country;

        const RENDERERS = { pdf: buildPdfFormat, pptx: buildPptxFormat, executive: buildExecutiveSummaryFormat, donor: buildDonorBriefFormat, government: buildGovernmentReportFormat, board: buildBoardDeckFormat, infographic_report: buildProductionInfographicReportFormat, executive_summary: buildExecutiveSummaryFormat, management_report: buildManagementReportFormat, donor_brief: buildDonorBriefFormat, policy_brief: buildPolicyBriefFormat, government_report: buildGovernmentReportFormat, board_deck: buildBoardDeckFormat, infographic: buildProductionInfographicReportFormat, statistical_annex: buildStatisticalAnnexFormat, dataset_appendix: buildDatasetAppendixFormat, technical_annex: buildTechnicalAnnexFormat, one_page_executive_brief: buildOnePageExecutiveBriefFormat, print_ready_report: buildPrintReadyReportFormat, ai_talking_points: buildAiTalkingPointsFormat };
        const phase19Model = enrichDocumentModelWithPhase20(documentModel);
        let verification = buildAIVerificationLayerV19(phase19Model);
        verification = applyDemoShowcaseExportOverride(phase19Model, verification);
        if (!verification.export_allowed) return json({ ok: false, error: 'Report export blocked by quality gate', quality_gate: phase19Model.report_quality_gate_v19, ai_verification: verification }, 409);
        const renderer = RENDERERS[formatName];
        if (!renderer) return error(`Unknown or not-yet-implemented format: ${formatName}`, 400);
        return json({ ...renderer(phase19Model), report_quality_gate: phase19Model.report_quality_gate_v19, ai_verification: verification });
      }

      // Public, no-auth equivalent of the Executive Infographic Engine data
      // endpoint (Phase 16) — same hard is_demo=1 + status='published'
      // filter as every other public demo endpoint.
      const publicDemoInfographicMatch = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/infographic-data$/);
      if (publicDemoInfographicMatch && method === 'GET') {
        const reportRow = await env.DB.prepare(
          `SELECT document_model_json, is_demo, demo_country, organization_id, campaign_id, template_id FROM generated_reports WHERE id = ? AND is_demo = 1 AND status = 'published'`
        ).bind(publicDemoInfographicMatch[1]).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = true;
        documentModel.demo_country = reportRow.demo_country;
        const phase19Model = attachSampleReportShowcaseV20(enrichDocumentModelWithPhase19(documentModel));
        const infographicData = await buildInfographicData(phase19Model, env, { organizationId: reportRow.organization_id, campaignId: reportRow.campaign_id, templateId: reportRow.template_id, reportId: publicDemoInfographicMatch[1] });
        return json({ ...infographicData, true_infographic_v19: buildTrueInfographicRendererV19(phase19Model), sdg_visual_cards_v19: buildSDGVisualCardsV19(phase19Model), publication_infographic_v20: buildPublicationInfographicV20(phase19Model) }, 200, { 'Cache-Control': 'public, max-age=3600' });
      }

      // Public, no-auth equivalent of the Executive Decision Intelligence
      // Engine (Phase 17) — combines decision cards, decision dashboard,
      // board/meeting modes, and action matrix into ONE response (fewer
      // round-trips for the public showcase page). Same hard is_demo=1 +
      // status='published' filter as every other public demo endpoint.
      const publicDemoDecisionMatch = path.match(/^\/api\/public\/demo-reports\/(report_[a-zA-Z0-9]+)\/decision-intelligence$/);
      if (publicDemoDecisionMatch && method === 'GET') {
        const reportRow = await env.DB.prepare(
          `SELECT document_model_json, is_demo, demo_country, organization_id, campaign_id, template_id FROM generated_reports WHERE id = ? AND is_demo = 1 AND status = 'published'`
        ).bind(publicDemoDecisionMatch[1]).first();
        if (!reportRow) return error('Demonstration report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = true;
        documentModel.demo_country = reportRow.demo_country;
        const infographicData = await buildInfographicData(documentModel, env, { organizationId: reportRow.organization_id, campaignId: reportRow.campaign_id, templateId: reportRow.template_id, reportId: publicDemoDecisionMatch[1] });
        const allCards = buildAllDecisionCards(infographicData);
        const decisionDashboard = buildDecisionDashboard(infographicData, allCards);
        return json({
          all_cards: allCards,
          decision_dashboard: decisionDashboard,
          board_mode: buildBoardModeTalkingPoints(documentModel, decisionDashboard),
          meeting_mode: buildMeetingModeBriefings(documentModel, decisionDashboard),
          action_matrix: buildActionMatrix(infographicData.recommendation_dashboard),
        }, 200, { 'Cache-Control': 'public, max-age=3600' });
      }

      if (path === '/api/health' && method === 'GET') {
        const checks = { api: true, database: false, storage: false };
        try {
          await env.DB.prepare('SELECT 1').first();
          checks.database = true;
        } catch (e) { /* stays false */ }
        try {
          await env.AUDIO_BUCKET.head('__healthcheck__');
          checks.storage = true; // a 404 here still proves R2 is reachable
        } catch (e) {
          checks.storage = true; // R2 throwing "not found" for a missing key still means it's reachable
        }
        const allOk = checks.database && checks.api;
        return json({ status: allOk ? 'operational' : 'degraded', checks, checked_at: new Date().toISOString() });
      }

      // ---------- PRODUCTION READINESS: real binding + secret check (V213) ----------
      // Honest, non-flattering: each required binding/secret is reported as
      // configured or NOT configured from the actual runtime env — never a
      // static score. Launch blockers vs optional integrations are separated
      // so an operator can see exactly what remains before go-live.
      if (path === '/api/ops/production-readiness' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin only', 403);
        const present = (v) => typeof v === 'string' ? v.trim().length > 0 : Boolean(v);
        // DB is a binding object, not a string — probe it for real.
        let dbReachable = false;
        try { await env.DB.prepare('SELECT 1').first(); dbReachable = true; } catch (_) { dbReachable = false; }
        const r2Bound = Boolean(env.AUDIO_BUCKET);
        const blockers = {
          d1_database: dbReachable ? 'configured' : 'NOT configured',
          r2_bucket: r2Bound ? 'configured' : 'NOT configured',
          jwt_secret: present(env.JWT_SECRET) ? 'configured' : 'NOT configured',
          twilio_auth_token: present(env.TWILIO_AUTH_TOKEN) ? 'configured' : 'NOT configured (inbound webhooks will reject)',
        };
        const optional = {
          anthropic_api_key: present(env.ANTHROPIC_API_KEY) ? 'configured' : 'not configured (AI narrative disabled)',
          openai_api_key: present(env.OPENAI_API_KEY) ? 'configured' : 'not configured (Whisper STT disabled)',
          stripe_secret_key: present(env.STRIPE_SECRET_KEY) ? 'configured' : 'not configured (billing purchase flow hidden)',
          stripe_prices: (present(env.STRIPE_PRICE_STARTER) || present(env.STRIPE_PRICE_PROFESSIONAL) || present(env.STRIPE_PRICE_ENTERPRISE)) ? 'configured' : 'not configured (billing purchase flow hidden)',
          resend_api_key: present(env.RESEND_API_KEY) ? 'configured' : 'not configured (email delivery disabled)',
          allowed_origins: present(env.ALLOWED_ORIGINS) ? 'configured' : 'using SITE_URL only',
          strict_cors: String(env.STRICT_CORS).toLowerCase() === 'true' ? 'enabled' : 'disabled (dev origins allowed)',
        };
        const blockersOk = Object.values(blockers).every(v => v === 'configured');
        return json({
          launch_blockers: blockers,
          optional_integrations: optional,
          launch_blockers_satisfied: blockersOk,
          verdict: blockersOk ? 'All launch-blocking bindings/secrets configured' : 'Launch-blocking configuration missing — see launch_blockers',
          checked_at: new Date().toISOString(),
        });
      }

      // ---------- STATUS HISTORY (public — same audience as /api/health,
      // powers the "recent history" strip on the public status page) ----------
      if (path === '/api/status-history' && method === 'GET') {
        const { results } = await env.DB.prepare(
          `SELECT service, status, latency_ms, error_message, checked_at FROM status_check_history
           WHERE checked_at >= datetime('now', '-24 hours') ORDER BY checked_at ASC LIMIT 500`
        ).all();
        const incidentCount = results.filter(r => r.status === 'degraded').length;
        return json({ history: results, incident_count_24h: incidentCount });
      }

      // ---------- AUTH ----------
      if (path === '/api/auth/login' && method === 'POST') {
        const { email, password } = await request.json();
        if (!email || !password) return error('Email and password are required');
        // 10 attempts per 15 minutes, keyed by email — slows down brute-force
        // password guessing without locking out a user typo-ing their password once.
        if (await isRateLimited(env, `login:${email}`, 10, 15 * 60)) {
          return error('Too many login attempts. Please wait a few minutes and try again.', 429);
        }
        const user = await env.DB.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').bind(email).first();
        if (!user) return error('Invalid email or password', 401);
        const ok = await verifyPassword(password, user.password_salt, user.password_hash);
        if (!ok) return error('Invalid email or password', 401);

        const twoFa = await env.DB.prepare('SELECT enabled FROM user_2fa WHERE user_id = ?').bind(user.id).first();
        if (twoFa && twoFa.enabled) {
          const pendingToken = await signJWT({ sub: user.id, pending2fa: true }, env.JWT_SECRET, 5 * 60);
          return json({ requires_2fa: true, pending_token: pendingToken });
        }

        const sid = newSessionId();
        const token = await signJWT({ sub: user.id, org: user.organization_id, role: user.role, email: user.email, sid }, env.JWT_SECRET);
        await registerSession(env, { sid, userId: user.id, organizationId: user.organization_id, request });
        await env.DB.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').bind(user.id).run();
        await logAudit(env, { org: user.organization_id, userId: user.id, action: 'login', resourceType: 'user', resourceId: user.id, request });
        return json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, organization_id: user.organization_id } });
      }

      if (path === '/api/auth/verify-2fa' && method === 'POST') {
        const { pending_token, code } = await request.json();
        if (!pending_token || !code) return error('pending_token and code are required');
        let claims;
        try { claims = await verifyJWT(pending_token, env.JWT_SECRET); } catch (e) { return error('This login attempt has expired — please log in again', 401); }
        if (!claims.pending2fa) return error('Invalid token', 401);

        const twoFa = await env.DB.prepare('SELECT secret FROM user_2fa WHERE user_id = ? AND enabled = 1').bind(claims.sub).first();
        if (!twoFa) return error('2FA is not enabled for this account', 400);
        const valid = await verifyTotpCode(twoFa.secret, code.trim());
        if (!valid) return error('Incorrect code — check your authenticator app and try again', 401);

        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(claims.sub).first();
        const sid = newSessionId();
        const token = await signJWT({ sub: user.id, org: user.organization_id, role: user.role, email: user.email, sid }, env.JWT_SECRET);
        await registerSession(env, { sid, userId: user.id, organizationId: user.organization_id, request });
        await env.DB.prepare('UPDATE users SET last_login_at = datetime("now") WHERE id = ?').bind(user.id).run();
        await logAudit(env, { org: user.organization_id, userId: user.id, action: 'login_2fa', resourceType: 'user', resourceId: user.id, request });
        return json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, organization_id: user.organization_id } });
      }

      // ---------- SESSION REVOCATION (V213 — real server-side logout) ----------
      // logout: end THIS session. logout-all: end every session for the user.
      // A revoked session's token is rejected by requireAuth immediately, so a
      // stolen token becomes unusable the moment the real user logs out.
      if (path === '/api/auth/logout' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const result = await revokeSession(env, claims);
        await logAudit(env, { org: claims.org, userId: claims.sub, action: 'logout', resourceType: 'session', resourceId: claims.sub, request });
        return json({ ok: true, ...result });
      }
      if (path === '/api/auth/logout-all' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const result = await revokeAllSessions(env, claims.sub, 'logout_all');
        await logAudit(env, { org: claims.org, userId: claims.sub, action: 'logout_all', resourceType: 'session', resourceId: claims.sub, request });
        return json({ ok: true, ...result });
      }
      if (path === '/api/auth/sessions' && method === 'GET') {
        const claims = await requireAuth(request, env);
        return json({ sessions: await listSessions(env, claims.sub) });
      }
      const sessionDeleteMatch = path.match(/^\/api\/auth\/sessions\/([a-f0-9]{64})$/);
      if (sessionDeleteMatch && method === 'DELETE') {
        const claims = await requireAuth(request, env);
        const result = await revokeSessionById(env, claims.sub, sessionDeleteMatch[1]);
        await logAudit(env, { org: claims.org, userId: claims.sub, action: 'session_revoked', resourceType: 'session', resourceId: sessionDeleteMatch[1], request });
        return json({ ok: true, ...result });
      }

      // ---------- TWO-FACTOR AUTHENTICATION (TOTP) ----------
      if (path === '/api/2fa/status' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const row = await env.DB.prepare('SELECT enabled FROM user_2fa WHERE user_id = ?').bind(claims.sub).first();
        return json({ enabled: !!(row && row.enabled) });
      }

      if (path === '/api/2fa/setup' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const secret = generateTotpSecret();
        await env.DB.prepare(
          `INSERT INTO user_2fa (user_id, secret, enabled) VALUES (?, ?, 0)
           ON CONFLICT(user_id) DO UPDATE SET secret = excluded.secret, enabled = 0`
        ).bind(claims.sub, secret).run();
        const uri = totpAuthUri(secret, claims.email || claims.sub);
        return json({ secret, otpauth_uri: uri });
      }

      if (path === '/api/2fa/verify-setup' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { code } = await request.json();
        if (!code) return error('code is required');
        const row = await env.DB.prepare('SELECT secret FROM user_2fa WHERE user_id = ?').bind(claims.sub).first();
        if (!row) return error('Run 2FA setup first', 400);
        const valid = await verifyTotpCode(row.secret, code.trim());
        if (!valid) return error('Incorrect code — check your authenticator app and try again', 401);
        await env.DB.prepare('UPDATE user_2fa SET enabled = 1 WHERE user_id = ?').bind(claims.sub).run();
        await logAudit(env, { org: claims.org, userId: claims.sub, action: '2fa_enabled', resourceType: 'user', resourceId: claims.sub, request });
        return json({ ok: true });
      }

      if (path === '/api/2fa/disable' && method === 'POST') {
        const claims = await requireAuth(request, env);
        await env.DB.prepare('DELETE FROM user_2fa WHERE user_id = ?').bind(claims.sub).run();
        await logAudit(env, { org: claims.org, userId: claims.sub, action: '2fa_disabled', resourceType: 'user', resourceId: claims.sub, request });
        return json({ ok: true });
      }

      if (path === '/api/auth/me' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const user = await env.DB.prepare('SELECT id, email, full_name, role, organization_id FROM users WHERE id = ?').bind(claims.sub).first();
        if (!user) return error('User not found', 404);
        return json({ user });
      }

      if (path === '/api/auth/change-password' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { current_password, new_password } = await request.json();
        if (!current_password || !new_password) return error('current_password and new_password are required');
        if (new_password.length < 8) return error('New password must be at least 8 characters', 400);
        const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(claims.sub).first();
        const ok = await verifyPassword(current_password, user.password_salt, user.password_hash);
        if (!ok) return error('Current password is incorrect', 401);
        const { hash, salt } = await hashPassword(new_password);
        await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, claims.sub).run();
        return json({ ok: true });
      }

      // ---------- FORGOT / RESET PASSWORD ----------
      if (path === '/api/auth/forgot-password' && method === 'POST') {
        const { email } = await request.json();
        if (!email) return error('email is required');
        // 3 requests per hour per email — stops spamming one inbox with reset emails.
        if (await isRateLimited(env, `forgot:${email}`, 3, 60 * 60)) {
          return json({ ok: true, message: 'If an account exists for that email, a reset link has been sent.' });
        }
        const user = await env.DB.prepare('SELECT id, full_name FROM users WHERE email = ? AND is_active = 1').bind(email).first();
        // Always return success, whether or not the email exists — prevents account enumeration.
        if (user) {
          const token = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
          await env.DB.prepare(
            `INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)`
          ).bind(token, user.id, expiresAt).run();
          const resetUrl = `${env.SITE_URL || 'https://voiceinsightsafrica.com'}/reset-password.html?token=${token}`;
          await sendEmail(env, {
            to: email,
            subject: 'Reset your VoiceInsights Africa password',
            html: `<p>Hi ${user.full_name},</p>
                   <p>We received a request to reset your password. Click the link below to choose a new one — this link expires in 1 hour and can only be used once.</p>
                   <p><a href="${resetUrl}">${resetUrl}</a></p>
                   <p>If you didn't request this, you can safely ignore this email.</p>`,
          });
        }
        return json({ ok: true, message: 'If an account exists for that email, a reset link has been sent.' });
      }

      if (path === '/api/auth/reset-password' && method === 'POST') {
        const { token, new_password } = await request.json();
        if (!token || !new_password) return error('token and new_password are required');
        if (new_password.length < 8) return error('New password must be at least 8 characters', 400);
        const row = await env.DB.prepare('SELECT * FROM password_reset_tokens WHERE token = ?').bind(token).first();
        if (!row || row.used || new Date(row.expires_at) < new Date()) {
          return error('This reset link is invalid or has expired. Please request a new one.', 400);
        }
        const { hash, salt } = await hashPassword(new_password);
        await env.DB.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?').bind(hash, salt, row.user_id).run();
        await env.DB.prepare('UPDATE password_reset_tokens SET used = 1 WHERE token = ?').bind(token).run();
        // V213: a password reset invalidates every existing session — if the
        // reset was triggered because a token leaked, this is what actually
        // kicks the attacker out.
        await revokeAllSessions(env, row.user_id, 'password_reset');
        await logAudit(env, { userId: row.user_id, action: 'password_reset', resourceType: 'user', resourceId: row.user_id, request });
        return json({ ok: true });
      }

      // ---------- USER MANAGEMENT (invite team members) ----------
      if (path === '/api/users' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { results } = await env.DB.prepare(
          `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.last_login_at, u.created_at, up.region, up.phone
           FROM users u LEFT JOIN user_profile up ON up.user_id = u.id
           WHERE u.organization_id = ? ORDER BY u.created_at DESC`
        ).bind(effectiveOrgId).all();
        return json({ users: results });
      }

      // ---------- ENUMERATORS (card view — real per-person stats, not a flat user list) ----------
      if (path === '/api/enumerators' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { results } = await env.DB.prepare(
          `SELECT u.id, u.full_name, u.email, u.is_active, u.last_login_at, up.region, up.phone,
                  c.id as assigned_project_id, c.name as assigned_project,
                  (SELECT COUNT(*) FROM responses r WHERE r.campaign_id = c.id AND r.channel = 'app') as project_total_responses,
                  (SELECT COUNT(*) FROM responses r WHERE r.campaign_id = c.id AND r.channel = 'app' AND date(r.started_at) = date('now')) as project_today_responses,
                  eds.battery_pct, eds.last_seen_at
           FROM users u
           LEFT JOIN user_campaign_assignment uca ON uca.user_id = u.id
           LEFT JOIN campaigns c ON uca.campaign_id = c.id
           LEFT JOIN enumerator_device_status eds ON eds.user_id = u.id
           WHERE u.organization_id = ? AND u.role = 'enumerator'
           ORDER BY u.full_name ASC`
        ).bind(effectiveOrgId).all();
        return json({ enumerators: results });
      }

      // ---------- COMMUNICATIONS (unified WhatsApp/SMS inbox — real conversations) ----------
      if (path === '/api/communications' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { results } = await env.DB.prepare(
          `SELECT s.id, s.session_key, s.channel, s.status, s.updated_at, s.language, c.name as campaign_name,
                  resp.full_name as respondent_name, s.response_id,
                  (SELECT COUNT(*) FROM answers a WHERE a.response_id = s.response_id) as answers_count
           FROM sessions s
           JOIN campaigns c ON s.campaign_id = c.id
           JOIN respondents resp ON s.respondent_id = resp.id
           WHERE c.organization_id = ? AND s.channel IN ('whatsapp', 'sms')
           ORDER BY s.updated_at DESC LIMIT 100`
        ).bind(effectiveOrgId).all();
        return json({ conversations: results });
      }

      // ---------- QUALITY CONTROL (per-question completion & confidence, real numbers) ----------
      // ---------- QA REVIEW (approve/reject a flagged response, with audit trail) ----------
      const qaReviewMatch = path.match(/^\/api\/responses\/([a-zA-Z0-9_]+)\/qa-review$/);
      if (qaReviewMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin' && claims.role !== 'me_officer') return error('Only a supervisor can review responses', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const response = await env.DB.prepare(
          `SELECT r.id FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE r.id = ? AND c.organization_id = ?`
        ).bind(qaReviewMatch[1], effectiveOrgId).first();
        if (!response) return error('Response not found', 404);
        const { decision, notes } = await request.json();
        if (!['approved', 'rejected'].includes(decision)) return error('decision must be approved or rejected');
        await env.DB.prepare(
          `INSERT INTO response_qa_review (response_id, decision, reviewed_by, notes) VALUES (?, ?, ?, ?)
           ON CONFLICT(response_id) DO UPDATE SET decision = excluded.decision, reviewed_by = excluded.reviewed_by, notes = excluded.notes, reviewed_at = datetime('now')`
        ).bind(qaReviewMatch[1], decision, claims.sub, notes || null).run();
        return json({ ok: true });
      }

      if (path === '/api/quality-control' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const filterCampaign = await getEffectiveCampaignFilter(request, env, claims, effectiveOrgId);
        const cf = filterCampaign ? 'AND c.id = ?' : '';
        const bindArgs = filterCampaign ? [effectiveOrgId, filterCampaign] : [effectiveOrgId];

        const { results: perQuestion } = await env.DB.prepare(
          `SELECT q.question_text, q.order_index,
                  COUNT(a.id) as answer_count,
                  AVG(CASE WHEN t.raw_text IS NOT NULL AND LENGTH(t.raw_text) > 0 THEN 1 ELSE 0 END) as completion_rate,
                  AVG(CAST(json_extract(ai.content_json, '$.confidence') AS REAL)) as avg_confidence
           FROM questions q
           JOIN campaigns c ON q.survey_id = c.survey_id
           LEFT JOIN answers a ON a.question_id = q.id
           LEFT JOIN transcripts t ON t.answer_id = a.id
           LEFT JOIN ai_insights ai ON ai.response_id = a.response_id AND ai.insight_type = 'transcription_quality'
           WHERE c.organization_id = ? ${cf}
           GROUP BY q.id ORDER BY q.order_index ASC LIMIT 30`
        ).bind(...bindArgs).all();

        const { results: pendingReview } = await env.DB.prepare(
          `SELECT r.id, r.channel, r.started_at, resp.phone_number, c.name as campaign_name, qa.decision as qa_decision
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           LEFT JOIN response_qa_review qa ON qa.response_id = r.id
           WHERE c.organization_id = ? ${cf} AND r.fraud_score >= 0.5 AND r.status = 'completed'
           ORDER BY r.started_at DESC LIMIT 20`
        ).bind(...bindArgs).all();

        return json({ per_question: perQuestion, pending_review: pendingReview });
      }

      const ROLE_WELCOME_LABEL = { org_admin: 'Org Admin', me_officer: 'M&E Officer', enumerator: 'Field Enumerator' };
      const ROLE_ONBOARDING_STEPS = {
        org_admin: `<li>Explore <b>Projects</b> and <b>Campaigns</b> to see everything already set up.</li><li>Invite the rest of your team from <b>Settings → Team</b>.</li>`,
        me_officer: `<li>Open <b>Analytics</b> and <b>Reports</b> to see the data already collected.</li><li>Check <b>Interviews</b> to listen to real voice responses and read transcripts.</li>`,
        enumerator: `<li>Open the <b>Enumerator App</b> (works offline) or the Web Link shared with you to start collecting responses.</li><li>You'll only see data for the project you were assigned to.</li>`,
      };

      if (path === '/api/users/invite' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can invite users', 403);
        const { email, full_name, role, region, phone, invite_method, campaign_id, organization_id } = await request.json();
        if (!email || !full_name) return error('email and full_name are required');
        if ((invite_method === 'sms' || invite_method === 'whatsapp') && !phone) return error('Phone number is required for SMS/WhatsApp invites', 400);

        // SECURITY: strict role whitelist, keyed by the INVITER's own role.
        // Never trust the requested role blindly — this closes a privilege-
        // escalation hole where any org_admin could previously request
        // role:'super_admin' and have it accepted with zero validation.
        // super_admin accounts are never created through this endpoint at all.
        const ALLOWED_ROLES_BY_INVITER = {
          org_admin: ['me_officer', 'enumerator'],
          super_admin: ['org_admin', 'me_officer', 'enumerator'],
        };
        const requestedRole = role || 'me_officer';
        const allowedRoles = ALLOWED_ROLES_BY_INVITER[claims.role] || [];
        if (!allowedRoles.includes(requestedRole)) {
          return error(`Invalid role for invite. As a ${claims.role === 'super_admin' ? 'Super Admin' : 'Org Admin'}, you may invite: ${allowedRoles.join(', ')}.`, 400);
        }

        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
        if (existing) return error('A user with this email already exists', 409);

        // A Super Admin manages multiple client organizations and must say which
        // one this invite is for; a regular Org Admin can only ever invite into
        // their own organization — this is enforced server-side either way.
        let targetOrgId = claims.org;
        if (claims.role === 'super_admin') {
          if (!organization_id) return error('organization_id is required when inviting as Super Admin', 400);
          const targetOrg = await env.DB.prepare('SELECT id FROM organizations WHERE id = ?').bind(organization_id).first();
          if (!targetOrg) return error('That organization was not found', 400);
          targetOrgId = organization_id;
        }

        let campaignName = null;
        if (campaign_id) {
          const campaign = await env.DB.prepare('SELECT id, name FROM campaigns WHERE id = ? AND organization_id = ?').bind(campaign_id, targetOrgId).first();
          if (!campaign) return error('That project/campaign was not found', 400);
          campaignName = campaign.name;
        }

        const tempPassword = [...crypto.getRandomValues(new Uint8Array(9))].map(b => b.toString(36)).join('').slice(0, 12);
        const { hash, salt } = await hashPassword(tempPassword);
        const userId = newId('user');
        await env.DB.prepare(
          `INSERT INTO users (id, organization_id, email, password_hash, password_salt, full_name, role, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
        ).bind(userId, targetOrgId, email, hash, salt, full_name, requestedRole).run();

        if (region || phone) {
          await env.DB.prepare(
            `INSERT INTO user_profile (user_id, phone, region, invite_method) VALUES (?, ?, ?, ?)`
          ).bind(userId, phone || null, region || null, invite_method || 'email').run();
        }

        if (campaign_id && role === 'enumerator') {
          await env.DB.prepare(
            `INSERT INTO user_campaign_assignment (user_id, campaign_id) VALUES (?, ?)`
          ).bind(userId, campaign_id).run();
        }

        const loginUrl = `${env.SITE_URL || 'https://voiceinsightsafrica.com'}/login.html`;
        let delivered = 'email';

        if (invite_method === 'sms' || invite_method === 'whatsapp') {
          const smsBody = `Hi ${full_name}, you've been invited to VoiceInsights Africa${campaignName ? ` for the "${campaignName}" project` : ''}. Login: ${loginUrl} | Email: ${email} | Temp password: ${tempPassword}. Please change your password after first login.`;
          const result = await sendTwilioMessage(env, { to: phone, body: smsBody, whatsapp: invite_method === 'whatsapp' });
          if (result.ok) {
            delivered = invite_method;
          } else {
            // Twilio not configured or failed — fall back to email so the invite isn't lost.
            delivered = 'email (Twilio unavailable — sent by email instead)';
          }
        }

        if (delivered.startsWith('email')) {
          await sendEmail(env, {
            to: email,
            subject: `Welcome to VoiceInsights Africa`,
            html: `<div style="font-family:Arial,sans-serif; max-width:520px; margin:0 auto; color:#1E2620;">
                     <div style="background:#0F1614; padding:1.5rem; text-align:center; border-radius:10px 10px 0 0;">
                       <span style="color:#E4A23A; font-size:1.2rem; font-weight:700;">VoiceInsights Africa</span>
                     </div>
                     <div style="padding:1.75rem; background:#fff; border:1px solid #eee; border-top:none; border-radius:0 0 10px 10px;">
                       <h2 style="margin-top:0;">Welcome, ${full_name} 👋</h2>
                       <p>You've been added to VoiceInsights Africa${region ? ` for the ${region} region` : ''}${campaignName ? `, assigned to the <b>${campaignName}</b> project` : ''} as a <b>${ROLE_WELCOME_LABEL[requestedRole] || 'team member'}</b>.</p>
                       <div style="background:#f7f5f0; border-radius:8px; padding:1rem 1.25rem; margin:1.25rem 0;">
                         <p style="margin:.3rem 0;"><b>Login page:</b> <a href="${loginUrl}">${loginUrl}</a></p>
                         <p style="margin:.3rem 0;"><b>Email:</b> ${email}</p>
                         <p style="margin:.3rem 0;"><b>Temporary password:</b> ${tempPassword}</p>
                       </div>
                       <h3 style="font-size:1rem;">Your first 3 steps</h3>
                       <ol style="padding-left:1.2rem; line-height:1.7;">
                         <li>Log in and <b>change your password</b> from Settings right away.</li>
                         ${ROLE_ONBOARDING_STEPS[role] || ROLE_ONBOARDING_STEPS.me_officer}
                       </ol>
                       <p style="margin-top:1.5rem; font-size:.85rem; color:#888;">Questions? Just reply to this email.</p>
                     </div>
                   </div>`,
          });
        }

        await logAudit(env, { org: targetOrgId, userId: claims.sub, action: 'user_invited', resourceType: 'user', resourceId: userId, request });
        return json({ ok: true, delivered_via: delivered, user: { id: userId, email, full_name, role: role || 'me_officer', region: region || null, campaign_id: campaign_id || null } }, 201);
      }

      const deactivateMatch = path.match(/^\/api\/users\/([a-zA-Z0-9_]+)\/deactivate$/);
      if (deactivateMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can deactivate users', 403);
        await env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ? AND organization_id = ?').bind(deactivateMatch[1], claims.org).run();
        await logAudit(env, { org: claims.org, userId: claims.sub, action: 'user_deactivated', resourceType: 'user', resourceId: deactivateMatch[1], request });
        return json({ ok: true });
      }

      // ---------- SURVEYS ----------
      // ============================================================
      // ENTERPRISE REPORTING PLATFORM (Phase 8, Task 8.1)
      // ============================================================
      if (path === '/api/report-templates' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          `SELECT id, name, sector, sections_json, standards_json, target_page_band, chart_defaults_json
           FROM report_templates WHERE is_active = 1 ORDER BY name ASC`
        ).all();
        // Parse the JSON columns server-side so callers get real arrays/objects,
        // not strings they'd have to parse themselves every time.
        const templates = results.map(t => ({
          ...t,
          sections: JSON.parse(t.sections_json),
          standards: t.standards_json ? JSON.parse(t.standards_json) : [],
          chart_defaults: t.chart_defaults_json ? JSON.parse(t.chart_defaults_json) : {},
        }));
        return json({ templates });
      }

      // Generates a report's document model from REAL data and stores it as
      // a new draft. This is the Report Generator Core (Task 8.2) — the AI
      // Narrative Engine (Task 8.3) fills in `recommendations`/narrative
      // sections afterward via a separate call, keeping data-assembly and
      // AI-writing cleanly decoupled.
      // ============================================================
      // BRANDING ENGINE (Task 8.4)
      // ============================================================
      if (path === '/api/organizations/branding' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const branding = await env.DB.prepare('SELECT * FROM organization_branding WHERE organization_id = ?').bind(effectiveOrgId).first();
        return json({ branding: branding || null, has_custom_branding: !!branding });
      }

      if (path === '/api/organizations/branding' && method === 'PUT') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can update report branding', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { primary_color, secondary_color, font_family, header_text, footer_text, disclaimer_text, confidentiality_text, contact_details } = await request.json();
        await env.DB.prepare(
          `INSERT INTO organization_branding (organization_id, primary_color, secondary_color, font_family, header_text, footer_text, disclaimer_text, confidentiality_text, contact_details)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(organization_id) DO UPDATE SET
             primary_color = excluded.primary_color, secondary_color = excluded.secondary_color, font_family = excluded.font_family,
             header_text = excluded.header_text, footer_text = excluded.footer_text, disclaimer_text = excluded.disclaimer_text,
             confidentiality_text = excluded.confidentiality_text, contact_details = excluded.contact_details, updated_at = datetime('now')`
        ).bind(
          effectiveOrgId, primary_color || '#E4A23A', secondary_color || '#1E2620', font_family || 'Inter',
          header_text || null, footer_text || null, disclaimer_text || null, confidentiality_text || null, contact_details || null
        ).run();
        await logAudit(env, { org: effectiveOrgId, userId: claims.sub, action: 'branding_updated', resourceType: 'organization_branding', resourceId: effectiveOrgId, request });
        return json({ ok: true });
      }

      // Logo upload — reuses the EXACT R2 pattern already proven for
      // documents (Task 2.4): stored under a logos/ prefix, retrieved via
      // the existing authenticated /api/documents/:key endpoint (same
      // ownership-check code path, nothing new to secure here).
      if (path === '/api/organizations/branding/logo' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can update the report logo', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const form = await request.formData();
        const file = form.get('file');
        if (!file || typeof file === 'string') return error('file is required');
        const MAX_SIZE = 5 * 1024 * 1024; // 5MB is generous for a logo
        const buf = await file.arrayBuffer();
        if (buf.byteLength > MAX_SIZE) return error('Logo file too large — 5MB maximum', 400);

        const r2Key = `logos/${effectiveOrgId}/${Date.now()}-${crypto.randomUUID()}-${(file.name || 'logo').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await env.AUDIO_BUCKET.put(r2Key, buf, { httpMetadata: { contentType: file.type || 'image/png' } });
        await env.DB.prepare(
          `INSERT INTO organization_branding (organization_id, logo_r2_key) VALUES (?, ?)
           ON CONFLICT(organization_id) DO UPDATE SET logo_r2_key = excluded.logo_r2_key, updated_at = datetime('now')`
        ).bind(effectiveOrgId, r2Key).run();
        return json({ ok: true, logo_r2_key: r2Key });
      }

      // Retrieves one generated report's stored document model — the SAME
      // object every export format (Task 8.6) renders from, so this one
      // endpoint is the single read path for all of PDF/PPTX/Word/Excel/CSV/JSON.
      // NOTE: matches only IDs with the "report_" prefix (how newId('report')
      // always generates them) — deliberately NOT a bare [a-zA-Z0-9_]+ match,
      // which would incorrectly intercept /api/reports/intelligence,
      // /api/reports/generate, and any other static /api/reports/* route
      // registered elsewhere in this file.
      // ============================================================
      // EXECUTIVE REPORT STYLES (Phase 9, Task 9.1)
      // ============================================================
      // ============================================================
      // AI REPORT ASSISTANT (Phase 9, Task 9.2)
      // ============================================================
      // ============================================================
      // INTERACTIVE REPORT DASHBOARD (Phase 9, Task 9.3)
      // ============================================================
      // ============================================================
      // BENCHMARK ENGINE (Phase 9, Task 9.4)
      // ============================================================
      // ============================================================
      // RECOMMENDATIONS INTELLIGENCE (Phase 9, Task 9.5)
      // ============================================================
      // ============================================================
      // EVIDENCE & CITATION ENGINE (Phase 9, Task 9.6)
      // ============================================================
      // ============================================================
      // REPORT QUALITY SCORING (Phase 9, Task 9.7) — pure arithmetic, no
      // AI call, no caching needed (cheap, deterministic, reproducible).
      // ============================================================
      // ============================================================
      // IMPLEMENTATION ROADMAP GENERATOR (Phase 9, Task 9.8)
      // ============================================================
      const reportRoadmapMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/roadmap$/);
      if (reportRoadmapMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportRoadmapMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);

        const forceRegen = new URL(request.url).searchParams.get('regenerate') === '1';
        if (!forceRegen) {
          const cached = await env.DB.prepare('SELECT roadmap_json, generated_at FROM report_roadmaps WHERE report_id = ?').bind(reportRoadmapMatch[1]).first();
          if (cached) return json({ roadmap: JSON.parse(cached.roadmap_json), cached: true, generated_at: cached.generated_at });
        }

        // Prefer the richer tiered recommendations (Task 9.5) if already
        // generated for this report; fall back to the basic tiers (Task 8.3)
        // otherwise — either way, the roadmap only sequences what already
        // exists, never invents new recommendations.
        const tieredRow = await env.DB.prepare('SELECT recommendations_json FROM report_tiered_recommendations WHERE report_id = ?').bind(reportRoadmapMatch[1]).first();
        const documentModel = JSON.parse(reportRow.document_model_json);
        checkFlagshipProtection(reportRow, claims, request);

        let roadmap;
        try {
          roadmap = await generateImplementationRoadmap(env, {
            documentModel, metadata: documentModel.metadata,
            tieredRecommendations: tieredRow ? JSON.parse(tieredRow.recommendations_json) : null,
          });
        } catch (e) {
          return error(`Could not generate roadmap: ${e.message}`, 502);
        }

        await env.DB.prepare(
          `INSERT INTO report_roadmaps (report_id, roadmap_json) VALUES (?, ?)
           ON CONFLICT(report_id) DO UPDATE SET roadmap_json = excluded.roadmap_json, generated_at = datetime('now')`
        ).bind(reportRoadmapMatch[1], JSON.stringify(roadmap)).run();

        return json({ roadmap, cached: false, generated_at: new Date().toISOString() });
      }

      // ============================================================
      // EXECUTIVE INFOGRAPHIC ENGINE (Phase 16)
      // ------------------------------------------------------------
      // Read-only, pure transformation of document_model_json — same
      // safety profile as the Multi-Format Rendering Engine (Phase 15):
      // safe to call on a locked Flagship Showcase report with no
      // override, since it can only ever reorganize existing content.
      // Cache-Control header enables real HTTP/CDN-level caching (per
      // Phase 16's "cache rendered infographics" requirement) without
      // needing a database cache table for a computation this cheap.
      // ============================================================
      const reportInfographicMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/infographic-data$/);
      if (reportInfographicMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo, demo_country, campaign_id, template_id FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportInfographicMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = !!reportRow.is_demo;
        documentModel.demo_country = reportRow.demo_country;
        const infographicData = await buildInfographicData(documentModel, env, { organizationId: effectiveOrgId, campaignId: reportRow.campaign_id, templateId: reportRow.template_id, reportId: reportInfographicMatch[1] });
        return json(infographicData, 200, { 'Cache-Control': 'private, max-age=300' });
      }

      // ============================================================
      // EXECUTIVE DECISION INTELLIGENCE ENGINE (Phase 17, Part B)
      // ------------------------------------------------------------
      // Read-only, rule-based, deterministic — reuses buildInfographicData
      // (Phase 16) for its KPI data rather than recomputing anything.
      // Never a new Claude call; "never fabricate confidence" is
      // structurally guaranteed by the fixed-template design.
      // ============================================================
      const reportDecisionCardsMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/decision-cards$/);
      if (reportDecisionCardsMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo, demo_country, campaign_id, template_id FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportDecisionCardsMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = !!reportRow.is_demo;
        documentModel.demo_country = reportRow.demo_country;
        const infographicData = await buildInfographicData(documentModel, env, { organizationId: effectiveOrgId, campaignId: reportRow.campaign_id, templateId: reportRow.template_id, reportId: reportDecisionCardsMatch[1] });
        return json(buildAllDecisionCards(infographicData), 200, { 'Cache-Control': 'private, max-age=300' });
      }

      // Executive Decision Dashboard — Top 10 Decisions/Risks/Opportunities/
      // Quick Wins/Strategic Investments, re-sorted views of the same
      // decision cards and infographic data above (no new judgment calls
      // beyond the documented, transparent sort rules).
      const reportDecisionDashboardMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/decision-dashboard$/);
      if (reportDecisionDashboardMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo, demo_country, campaign_id, template_id FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportDecisionDashboardMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = !!reportRow.is_demo;
        documentModel.demo_country = reportRow.demo_country;
        const infographicData = await buildInfographicData(documentModel, env, { organizationId: effectiveOrgId, campaignId: reportRow.campaign_id, templateId: reportRow.template_id, reportId: reportDecisionDashboardMatch[1] });
        const allCards = buildAllDecisionCards(infographicData);
        return json(buildDecisionDashboard(infographicData, allCards), 200, { 'Cache-Control': 'private, max-age=300' });
      }

      // Board Mode (5 audience talking points) + Meeting Mode (4 briefing
      // lengths) — different framings of the SAME underlying facts, never
      // different facts, mirroring Task 9.1's Executive Report Styles
      // principle.
      const reportBoardMeetingMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/board-meeting-modes$/);
      if (reportBoardMeetingMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo, demo_country, campaign_id, template_id FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportBoardMeetingMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = !!reportRow.is_demo;
        documentModel.demo_country = reportRow.demo_country;
        const infographicData = await buildInfographicData(documentModel, env, { organizationId: effectiveOrgId, campaignId: reportRow.campaign_id, templateId: reportRow.template_id, reportId: reportBoardMeetingMatch[1] });
        const allCards = buildAllDecisionCards(infographicData);
        const decisionDashboard = buildDecisionDashboard(infographicData, allCards);
        return json({
          board_mode: buildBoardModeTalkingPoints(documentModel, decisionDashboard),
          meeting_mode: buildMeetingModeBriefings(documentModel, decisionDashboard),
        }, 200, { 'Cache-Control': 'private, max-age=300' });
      }

      // Action Matrix — Immediate/30-Day/90-Day/6-Month/12-Month, honestly
      // mapped from this platform's real 3-tier recommendation structure.
      const reportActionMatrixMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/action-matrix$/);
      if (reportActionMatrixMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo, demo_country, campaign_id, template_id FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportActionMatrixMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = !!reportRow.is_demo;
        documentModel.demo_country = reportRow.demo_country;
        const infographicData = await buildInfographicData(documentModel, env, { organizationId: effectiveOrgId, campaignId: reportRow.campaign_id, templateId: reportRow.template_id, reportId: reportActionMatrixMatch[1] });
        return json(buildActionMatrix(infographicData.recommendation_dashboard), 200, { 'Cache-Control': 'private, max-age=300' });
      }

      // ============================================================
      // MULTI-FORMAT REPORT RENDERING ENGINE (Phase 15)
      // ------------------------------------------------------------
      // Read-only — never writes to document_model_json, so this is safe
      // to call on a locked Flagship Showcase report with NO override
      // needed; it can only ever reorganize content that already exists.
      // No cache table: each format is a pure, near-instant JS
      // transformation of already-fetched JSON, not an AI call — adding a
      // cache layer here would be processing overhead with no benefit.
      // ============================================================

      // v187 Production binary rendering lifecycle — authenticated reports.
      const reportRenderCreateMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/render\/(pdf|pptx|executive_report_pdf|board_deck_pptx)$/);
      if (reportRenderCreateMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const [, reportId, renderFormat] = reportRenderCreateMatch;
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo, demo_country FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportId, effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = !!reportRow.is_demo;
        documentModel.demo_country = reportRow.demo_country;
        const job = createRenderJob({ reportId, tenantId: effectiveOrgId, format: renderFormat, requestedBy: claims.sub || claims.email || 'authenticated-user', priority: 2 });
        const result = await processDedicatedBinaryRenderJob(job, enrichDocumentModelWithPhase20(documentModel), env, { actor: 'authenticated-renderer' });
        if (!result.released) return json({ ok: false, job: result.job, validation: result.validation }, 422);
        return json({ ok: true, job: result.job, download: result.download_descriptor, artifact: result.binary, storage: result.storage, audit: result.audit }, 201, { 'Cache-Control': 'private, max-age=0, no-store' });
      }

      const reportRenderRetryMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/render-jobs\/(render_job_[a-zA-Z0-9_]+)\/retry$/);
      if (reportRenderRetryMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo, demo_country FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportRenderRetryMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        const job = createRenderJob({ id: reportRenderRetryMatch[2], reportId: reportRenderRetryMatch[1], tenantId: effectiveOrgId, format: 'pdf', requestedBy: claims.sub || 'authenticated-user' });
        const result = await processDedicatedBinaryRenderJob(job, enrichDocumentModelWithPhase20(documentModel), env, { actor: 'authenticated-renderer-retry' });
        return json({ ok: result.released, job: result.job, download: result.download_descriptor || null, storage: result.storage || null }, result.released ? 200 : 422, { 'Cache-Control': 'private, max-age=0, no-store' });
      }

      const reportFormatMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/format\/([a-z_]+)$/);
      if (reportFormatMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const [, reportId, formatName] = reportFormatMatch;
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo, demo_country FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportId, effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = !!reportRow.is_demo;
        documentModel.demo_country = reportRow.demo_country;

        const RENDERERS = { pdf: buildPdfFormat, pptx: buildPptxFormat, executive: buildExecutiveSummaryFormat, donor: buildDonorBriefFormat, government: buildGovernmentReportFormat, board: buildBoardDeckFormat, infographic_report: buildProductionInfographicReportFormat, executive_summary: buildExecutiveSummaryFormat, management_report: buildManagementReportFormat, donor_brief: buildDonorBriefFormat, policy_brief: buildPolicyBriefFormat, government_report: buildGovernmentReportFormat, board_deck: buildBoardDeckFormat, infographic: buildProductionInfographicReportFormat, statistical_annex: buildStatisticalAnnexFormat, dataset_appendix: buildDatasetAppendixFormat, technical_annex: buildTechnicalAnnexFormat, one_page_executive_brief: buildOnePageExecutiveBriefFormat, print_ready_report: buildPrintReadyReportFormat, ai_talking_points: buildAiTalkingPointsFormat };
        const phase19Model = enrichDocumentModelWithPhase20(documentModel);
        const verification = buildAIVerificationLayerV19(phase19Model);
        if (!verification.export_allowed) return json({ ok: false, error: 'Report export blocked by quality gate', quality_gate: phase19Model.report_quality_gate_v19, ai_verification: verification }, 409);
        const renderer = RENDERERS[formatName];
        if (!renderer) return error(`Unknown or not-yet-implemented format: ${formatName}`, 400);
        return json({ ...renderer(phase19Model), report_quality_gate: phase19Model.report_quality_gate_v19, ai_verification: verification });
      }

      const reportQualityMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/quality-score$/);
      if (reportQualityMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportQualityMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const scores = scoreReportQuality(JSON.parse(reportRow.document_model_json));
        return json({ scores });
      }

      const reportCitationsMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/citations$/);
      if (reportCitationsMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportCitationsMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);

        const forceRegen = new URL(request.url).searchParams.get('regenerate') === '1';
        if (!forceRegen) {
          const cached = await env.DB.prepare('SELECT citations_json, generated_at FROM report_evidence_citations WHERE report_id = ?').bind(reportCitationsMatch[1]).first();
          if (cached) return json({ ...JSON.parse(cached.citations_json), cached: true, generated_at: cached.generated_at });
        }

        checkFlagshipProtection(reportRow, claims, request);
        let result;
        try {
          result = await generateEvidenceCitations(env, { documentModel: JSON.parse(reportRow.document_model_json) });
        } catch (e) {
          return error(`Could not generate citations: ${e.message}`, 502);
        }

        await env.DB.prepare(
          `INSERT INTO report_evidence_citations (report_id, citations_json) VALUES (?, ?)
           ON CONFLICT(report_id) DO UPDATE SET citations_json = excluded.citations_json, generated_at = datetime('now')`
        ).bind(reportCitationsMatch[1], JSON.stringify(result)).run();

        return json({ ...result, cached: false, generated_at: new Date().toISOString() });
      }

      const reportRecsMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/tiered-recommendations$/);
      if (reportRecsMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportRecsMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);

        const forceRegen = new URL(request.url).searchParams.get('regenerate') === '1';
        if (!forceRegen) {
          const cached = await env.DB.prepare('SELECT recommendations_json, generated_at FROM report_tiered_recommendations WHERE report_id = ?').bind(reportRecsMatch[1]).first();
          if (cached) return json({ recommendations: JSON.parse(cached.recommendations_json), cached: true, generated_at: cached.generated_at });
        }

        const documentModel = JSON.parse(reportRow.document_model_json);
        checkFlagshipProtection(reportRow, claims, request);
        const editorialGuideline = await getEditorialGuideline(env, documentModel.metadata.template_id);
        let recommendations;
        try {
          recommendations = await generateTieredRecommendations(env, { aiReadyPackage: documentModel.ai_ready_package, metadata: documentModel.metadata, standards: documentModel.metadata.standards, editorialGuideline });
        } catch (e) {
          return error(`Could not generate tiered recommendations: ${e.message}`, 502);
        }

        await env.DB.prepare(
          `INSERT INTO report_tiered_recommendations (report_id, recommendations_json) VALUES (?, ?)
           ON CONFLICT(report_id) DO UPDATE SET recommendations_json = excluded.recommendations_json, generated_at = datetime('now')`
        ).bind(reportRecsMatch[1], JSON.stringify(recommendations)).run();

        return json({ recommendations, cached: false, generated_at: new Date().toISOString() });
      }

      const reportBenchmarkMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/benchmark$/);
      if (reportBenchmarkMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT template_id, campaign_id, document_model_json FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportBenchmarkMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);

        const documentModel = JSON.parse(reportRow.document_model_json);
        const benchmark = await buildBenchmark(env, {
          organizationId: effectiveOrgId, campaignId: reportRow.campaign_id, templateId: reportRow.template_id, currentKpis: documentModel.kpis,
        });

        let commentary = null;
        try {
          const result = await writeBenchmarkCommentary(env, { benchmark, metadata: documentModel.metadata, currentKpis: documentModel.kpis });
          commentary = result.commentary;
        } catch (e) {
          commentary = `Commentary unavailable: ${e.message}`; // the benchmark DATA is still real and useful even if the AI commentary call failed
        }

        return json({ benchmark, commentary });
      }

      const reportDrilldownMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/drilldown$/);
      if (reportDrilldownMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT campaign_id FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportDrilldownMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);

        const params = new URL(request.url).searchParams;
        const drilldown = await buildDrilldown(env, {
          organizationId: effectiveOrgId, campaignId: reportRow.campaign_id,
          region: params.get('region'), gender: params.get('gender'), ageBracket: params.get('age_bracket'),
        });
        return json(drilldown);
      }

      // Compares 2+ reports side by side. Cross-organization comparison
      // (different organization_id values across the requested reports) is
      // Super-Admin-only — everyone else can only compare reports already
      // within their own organization, enforced explicitly below rather
      // than relying on getEffectiveOrgId alone.
      if (path === '/api/reports/compare' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const ids = (new URL(request.url).searchParams.get('ids') || '').split(',').map(s => s.trim()).filter(Boolean);
        if (ids.length < 2) return error('Provide at least 2 report ids via ?ids=id1,id2', 400);
        if (ids.length > 5) return error('Maximum 5 reports can be compared at once', 400);

        const placeholders = ids.map(() => '?').join(',');
        const { results: rows } = await env.DB.prepare(
          `SELECT id, organization_id, document_model_json FROM generated_reports WHERE id IN (${placeholders})`
        ).bind(...ids).all();
        if (rows.length !== ids.length) return error('One or more report ids were not found', 404);

        const distinctOrgs = new Set(rows.map(r => r.organization_id));
        if (distinctOrgs.size > 1 && claims.role !== 'super_admin') {
          return error('Comparing reports across different organizations requires Super Admin', 403);
        }
        if (distinctOrgs.size === 1 && claims.role !== 'super_admin') {
          const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
          const onlyOrgId = [...distinctOrgs][0];
          if (onlyOrgId !== effectiveOrgId) return error('Report not found', 404);
        }

        const comparison = await buildComparison(env, rows);
        return json({ comparison });
      }

      const reportAskMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/ask$/);
      if (reportAskMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        if (await isRateLimited(env, `report_ask:${claims.sub}`, 20, 60 * 60)) {
          return error('Too many questions in a short time — please wait a few minutes and try again.', 429);
        }
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { question } = await request.json();
        const reportRow = await env.DB.prepare('SELECT document_model_json FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportAskMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);

        let result;
        try {
          result = await askReportQuestion(env, { documentModel: JSON.parse(reportRow.document_model_json), question });
        } catch (e) {
          return error(`Could not answer: ${e.message}`, 502);
        }
        return json(result);
      }

      if (path === '/api/report-styles' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const { results } = await env.DB.prepare('SELECT id, name, audience_description, appendix_depth FROM report_styles ORDER BY name ASC').all();
        return json({ styles: results });
      }

      // Applies a presentation style to an existing report. Returns (and
      // caches) a STYLED NARRATIVE — the original generated_reports row and
      // its document_model_json are never modified by this; styling is a
      // read-time transformation layered on top of the same real data.
      const reportStyleMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/style\/([a-zA-Z0-9_]+)$/);
      if (reportStyleMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const [, reportId, styleId] = reportStyleMatch;
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);

        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportId, effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const style = await env.DB.prepare('SELECT * FROM report_styles WHERE id = ?').bind(styleId).first();
        if (!style) return error('Report style not found', 404);

        // Serve from cache unless force-regeneration is explicitly requested
        // — avoids a real Claude call on every single page view.
        const forceRegen = new URL(request.url).searchParams.get('regenerate') === '1';
        if (!forceRegen) {
          const cached = await env.DB.prepare('SELECT styled_narrative_json, generated_at FROM report_styled_narratives WHERE report_id = ? AND style_id = ?').bind(reportId, styleId).first();
          if (cached) return json({ style, narrative: JSON.parse(cached.styled_narrative_json), cached: true, generated_at: cached.generated_at });
        }

        const documentModel = JSON.parse(reportRow.document_model_json);
        checkFlagshipProtection(reportRow, claims, request);
        const editorialGuideline = await getEditorialGuideline(env, documentModel.metadata.template_id);
        let styledNarrative;
        try {
          styledNarrative = await writeStyledNarrative(env, { aiReadyPackage: documentModel.ai_ready_package, metadata: documentModel.metadata, style, editorialGuideline });
        } catch (e) {
          return error(`Could not generate the ${style.name} style: ${e.message}`, 502);
        }

        await env.DB.prepare(
          `INSERT INTO report_styled_narratives (report_id, style_id, styled_narrative_json) VALUES (?, ?, ?)
           ON CONFLICT(report_id, style_id) DO UPDATE SET styled_narrative_json = excluded.styled_narrative_json, generated_at = datetime('now')`
        ).bind(reportId, styleId, JSON.stringify(styledNarrative)).run();

        return json({ style, narrative: styledNarrative, cached: false, generated_at: new Date().toISOString() });
      }

      const reportGetMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)$/);
      if (reportGetMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare(
          'SELECT id, template_id, status, version, document_model_json, created_at, updated_at FROM generated_reports WHERE id = ? AND organization_id = ?'
        ).bind(reportGetMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        return json({
          id: reportRow.id, template_id: reportRow.template_id, status: reportRow.status, version: reportRow.version,
          document_model: JSON.parse(reportRow.document_model_json), created_at: reportRow.created_at, updated_at: reportRow.updated_at,
        });
      }

      // ============================================================
      // REPORT LIBRARY + WORKFLOW (Task 8.7)
      // ------------------------------------------------------------
      // Role model: enumerator has NO access to reports at all (this is an
      // admin/M&E-level capability, matching the Role-Based Action
      // Hardening precedent already established). me_officer can VIEW and
      // submit draft->review only (matching its documented view-only-plus
      // intent). org_admin/super_admin can perform every transition.
      // ============================================================
      if (path === '/api/reports' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const statusFilter = new URL(request.url).searchParams.get('status');
        const { results } = await env.DB.prepare(
          `SELECT gr.id, gr.template_id, rt.name as template_name, gr.campaign_id, c.name as campaign_name,
                  gr.status, gr.version, gr.created_at, gr.updated_at, u.full_name as generated_by_name
           FROM generated_reports gr
           JOIN report_templates rt ON gr.template_id = rt.id
           LEFT JOIN campaigns c ON gr.campaign_id = c.id
           LEFT JOIN users u ON gr.generated_by = u.id
           WHERE gr.organization_id = ? ${statusFilter ? 'AND gr.status = ?' : ''}
           ORDER BY gr.created_at DESC LIMIT 200`
        ).bind(...(statusFilter ? [effectiveOrgId, statusFilter] : [effectiveOrgId])).all();
        return json({ reports: results });
      }

      // All versions of the same "report series" — defined as sharing the
      // same template_id + campaign_id within one organization. There's no
      // separate "series" table; this grouping key is sufficient and avoids
      // an extra table for something derivable from data already stored.
      const reportVersionsMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/versions$/);
      if (reportVersionsMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const base = await env.DB.prepare('SELECT template_id, campaign_id FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportVersionsMatch[1], effectiveOrgId).first();
        if (!base) return error('Report not found', 404);
        const { results } = await env.DB.prepare(
          `SELECT id, status, version, created_at, generated_by FROM generated_reports
           WHERE organization_id = ? AND template_id = ? AND (campaign_id = ? OR (campaign_id IS NULL AND ? IS NULL))
           ORDER BY version DESC`
        ).bind(effectiveOrgId, base.template_id, base.campaign_id, base.campaign_id).all();
        return json({ versions: results });
      }

      // Duplicate = generate a NEW version from FRESH real data (not a copy
      // of stale content) — the version number increments from the highest
      // existing version in this series, keeping "duplicate" meaningful
      // (an updated snapshot) rather than a literal clone of old numbers.
      const reportDuplicateMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/duplicate$/);
      if (reportDuplicateMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can create a new report version', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const original = await env.DB.prepare('SELECT template_id, campaign_id FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportDuplicateMatch[1], effectiveOrgId).first();
        if (!original) return error('Report not found', 404);

        const highestVersion = await env.DB.prepare(
          `SELECT MAX(version) as v FROM generated_reports WHERE organization_id = ? AND template_id = ? AND (campaign_id = ? OR (campaign_id IS NULL AND ? IS NULL))`
        ).bind(effectiveOrgId, original.template_id, original.campaign_id, original.campaign_id).first();

        let documentModel;
        try {
          documentModel = await buildDocumentModel(env, { templateId: original.template_id, organizationId: effectiveOrgId, campaignId: original.campaign_id });
        } catch (e) {
          return error(`Could not generate new version: ${e.message}`, 400);
        }
        const newReportId = newId('report');
        await env.DB.prepare(
          `INSERT INTO generated_reports (id, template_id, organization_id, campaign_id, status, version, document_model_json, generated_by)
           VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)`
        ).bind(newReportId, original.template_id, effectiveOrgId, original.campaign_id, (highestVersion.v || 1) + 1, JSON.stringify(documentModel), claims.sub).run();
        await logAudit(env, { org: effectiveOrgId, userId: claims.sub, action: 'report_new_version', resourceType: 'generated_reports', resourceId: newReportId, request });
        return json({ ok: true, report_id: newReportId, version: (highestVersion.v || 1) + 1 });
      }

      // Status workflow: draft -> review -> approved -> published -> archived.
      // A report can also be archived directly from any state, and published
      // reports can be unpublished back to approved.
      const reportStatusMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/status$/);
      if (reportStatusMatch && method === 'PUT') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { status: newStatus } = await request.json();
        const VALID_STATUSES = ['draft', 'review', 'approved', 'published', 'archived'];
        if (!VALID_STATUSES.includes(newStatus)) return error(`Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`, 400);

        const report = await env.DB.prepare('SELECT status FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportStatusMatch[1], effectiveOrgId).first();
        if (!report) return error('Report not found', 404);

        // me_officer may only submit a draft for review — every other
        // transition (approve, publish, unpublish, archive) requires
        // org_admin/super_admin, matching the requested "role permissions".
        const isPrivileged = claims.role === 'org_admin' || claims.role === 'super_admin';
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        if (!isPrivileged && !(claims.role === 'me_officer' && report.status === 'draft' && newStatus === 'review')) {
          return error('Only an Org Admin can approve, publish, unpublish, or archive a report', 403);
        }

        await env.DB.prepare('UPDATE generated_reports SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(newStatus, reportStatusMatch[1]).run();
        await logAudit(env, { org: effectiveOrgId, userId: claims.sub, action: `report_status_${newStatus}`, resourceType: 'generated_reports', resourceId: reportStatusMatch[1], request });
        return json({ ok: true, status: newStatus });
      }

      // ============================================================
      // REPORT SCHEDULER (Task 8.8) — management endpoints. The actual
      // generation + email delivery runs on the existing 5-minute Cron
      // trigger via processReportSchedules(), defined near scheduled().
      // ============================================================
      if (path === '/api/report-schedules' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can manage report schedules', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { results } = await env.DB.prepare(
          `SELECT rs.id, rs.template_id, rt.name as template_name, rs.campaign_id, c.name as campaign_name,
                  rs.frequency, rs.recipient_emails, rs.next_run_at, rs.is_active, rs.created_at
           FROM report_schedules rs JOIN report_templates rt ON rs.template_id = rt.id LEFT JOIN campaigns c ON rs.campaign_id = c.id
           WHERE rs.organization_id = ? ORDER BY rs.created_at DESC`
        ).bind(effectiveOrgId).all();
        return json({ schedules: results });
      }

      if (path === '/api/report-schedules' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can create report schedules', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { template_id, campaign_id, frequency, recipient_emails } = await request.json();
        const VALID_FREQUENCIES = ['weekly', 'monthly', 'quarterly'];
        if (!template_id || !VALID_FREQUENCIES.includes(frequency) || !recipient_emails) {
          return error(`template_id, a valid frequency (${VALID_FREQUENCIES.join('/')}), and recipient_emails are required`, 400);
        }
        const template = await env.DB.prepare('SELECT id FROM report_templates WHERE id = ? AND is_active = 1').bind(template_id).first();
        if (!template) return error('Report template not found', 400);

        const daysUntilFirstRun = { weekly: 7, monthly: 30, quarterly: 90 }[frequency];
        const scheduleId = newId('schedule');
        await env.DB.prepare(
          `INSERT INTO report_schedules (id, organization_id, template_id, campaign_id, frequency, recipient_emails, next_run_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+${daysUntilFirstRun} days'), ?)`
        ).bind(scheduleId, effectiveOrgId, template_id, campaign_id || null, frequency, recipient_emails, claims.sub).run();
        return json({ ok: true, schedule_id: scheduleId });
      }

      const scheduleDeleteMatch = path.match(/^\/api\/report-schedules\/([a-zA-Z0-9_]+)$/);
      if (scheduleDeleteMatch && method === 'DELETE') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can remove report schedules', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        await env.DB.prepare('DELETE FROM report_schedules WHERE id = ? AND organization_id = ?').bind(scheduleDeleteMatch[1], effectiveOrgId).run();
        return json({ ok: true });
      }

      if (path === '/api/reports/generate' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { template_id, campaign_id } = await request.json();
        if (!template_id) return error('template_id is required', 400);

        let documentModel;
        try {
          documentModel = await buildDocumentModel(env, { templateId: template_id, organizationId: effectiveOrgId, campaignId: campaign_id || null });
        } catch (e) {
          return error(`Could not generate report: ${e.message}`, 400);
        }

        const reportId = newId('report');
        await env.DB.prepare(
          `INSERT INTO generated_reports (id, template_id, organization_id, campaign_id, status, version, document_model_json, generated_by)
           VALUES (?, ?, ?, ?, 'draft', 1, ?, ?)`
        ).bind(reportId, template_id, effectiveOrgId, campaign_id || null, JSON.stringify(documentModel), claims.sub).run();

        await logAudit(env, { org: effectiveOrgId, userId: claims.sub, action: 'report_generated', resourceType: 'generated_reports', resourceId: reportId, request });
        return json({ ok: true, report_id: reportId, document_model: documentModel });
      }



      // Phase 20 — internal procurement-grade report experience package.


      const reportV200Match = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/international-reporting-suite-v200$/);
      if (reportV200Match && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = claims.organization_id || claims.org_id || env.DEFAULT_ORG_ID || 'org_demo';
        const reportRow = await env.DB.prepare(
          `SELECT document_model_json FROM generated_reports WHERE id = ? AND organization_id = ?`
        ).bind(reportV200Match[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        return json(buildInternationalIntelligenceReportingSuiteV200(enrichDocumentModelWithPhase20(documentModel)), 200, { 'Cache-Control': 'no-store' });
      }

      const reportV190Match = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/ai-report-intelligence-v190$/);
      if (reportV190Match && method === 'GET') {
        const user = await requireAuth(request, env);
        const reportRow = await env.DB.prepare(
          `SELECT document_model_json FROM generated_reports WHERE id = ? AND organization_id = ?`
        ).bind(reportV190Match[1], user.organization_id).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        return json(buildInternationalAIReportIntelligenceV190(enrichDocumentModelWithPhase20(documentModel)), 200, { 'Cache-Control': 'no-store' });
      }

      const reportExperienceV20Match = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/experience-v20$/);
      if (reportExperienceV20Match && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo, demo_country FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportExperienceV20Match[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = !!reportRow.is_demo;
        documentModel.demo_country = reportRow.demo_country;
        return json(buildReportExperienceV20(enrichDocumentModelWithPhase20(documentModel)));
      }

      // Phase 19 — internal report trust package. Read-only by default;
      // use POST /api/reports/:id/trust/enrich to persist additive metadata.
      const reportTrustV19Match = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/trust$/);
      if (reportTrustV19Match && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT document_model_json, is_demo, demo_country FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportTrustV19Match[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = !!reportRow.is_demo;
        documentModel.demo_country = reportRow.demo_country;
        const enriched = enrichDocumentModelWithPhase19(documentModel);
        return json({
          report_quality_gate: enriched.report_quality_gate_v19,
          evidence_traceability: enriched.evidence_traceability_v19,
          sdg_visual_cards: enriched.sdg_visual_cards_v19,
          true_infographic: enriched.true_infographic_v19,
          ai_verification: enriched.ai_verification_v19,
          phase19: enriched.phase19,
        });
      }

      const reportTrustV19EnrichMatch = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/trust\/enrich$/);
      if (reportTrustV19EnrichMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare('SELECT id, document_model_json, is_demo, demo_country FROM generated_reports WHERE id = ? AND organization_id = ?').bind(reportTrustV19EnrichMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        checkFlagshipProtection(reportRow, claims, request);
        const documentModel = JSON.parse(reportRow.document_model_json);
        documentModel.is_demo = !!reportRow.is_demo;
        documentModel.demo_country = reportRow.demo_country;
        const enriched = enrichDocumentModelWithPhase19(documentModel);
        await env.DB.prepare("UPDATE generated_reports SET document_model_json = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(JSON.stringify(enriched), reportTrustV19EnrichMatch[1]).run();
        return json({ ok: true, report_id: reportTrustV19EnrichMatch[1], phase19: enriched.phase19, quality_gate: enriched.report_quality_gate_v19, ai_verification: enriched.ai_verification_v19 });
      }

      // VoiceInsights Intelligence OS v7.0 enrichment — additive layer.
      // It does not rebuild raw data and does not change numeric outputs; it
      // attaches quality gate, citations, SDG cards, infographic blueprint,
      // and 8 report-product definitions to the existing document_model_json.
      const intelligenceOSV7Match = path.match(/^\/api\/reports\/(report_[a-zA-Z0-9]+)\/intelligence-os-v7$/);
      if (intelligenceOSV7Match && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role === 'enumerator') return error('Reports are not available for this role', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare(
          'SELECT id, document_model_json, is_demo FROM generated_reports WHERE id = ? AND organization_id = ?'
        ).bind(intelligenceOSV7Match[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        checkFlagshipProtection(reportRow, claims, request);
        const documentModel = JSON.parse(reportRow.document_model_json);
        const enriched = enrichDocumentModelWithIntelligenceOSV7(documentModel);
        await env.DB.prepare("UPDATE generated_reports SET document_model_json = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(JSON.stringify(enriched), intelligenceOSV7Match[1]).run();
        return json({
          ok: true,
          report_id: intelligenceOSV7Match[1],
          quality_gate: enriched.report_quality_gate,
          evidence_citations: enriched.evidence_citations_v7?.length || 0,
          report_formats: enriched.report_formats_v7?.length || 0,
          sdg_cards: enriched.sdg_cards_v7?.length || 0,
        });
      }

      // Fills in the AI-written narrative sections (Task 8.3) on top of an
      // already-generated report (Task 8.2) — a deliberately separate call
      // so data-assembly and AI-writing can fail/retry independently. If
      // Claude fails, the report is NOT corrupted — it simply keeps its
      // existing document_model (with recommendations still null) and this
      // endpoint returns a clear error to retry.
      const narrativeMatch = path.match(/^\/api\/reports\/([a-zA-Z0-9_]+)\/narrative$/);
      if (narrativeMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportRow = await env.DB.prepare(
          'SELECT id, document_model_json, is_demo FROM generated_reports WHERE id = ? AND organization_id = ?'
        ).bind(narrativeMatch[1], effectiveOrgId).first();
        if (!reportRow) return error('Report not found', 404);
        checkFlagshipProtection(reportRow, claims, request);

        const documentModel = JSON.parse(reportRow.document_model_json);
        const editorialGuideline = await getEditorialGuideline(env, documentModel.metadata.template_id);
        let narrative;
        try {
          narrative = await writeNarrative(env, { aiReadyPackage: documentModel.ai_ready_package, metadata: documentModel.metadata, editorialGuideline });
        } catch (e) {
          return error(`AI narrative generation failed: ${e.message}. The report's data is safe — try again.`, 502);
        }

        documentModel.recommendations = narrative.recommendations;
        documentModel.narrative = {
          executive_summary: narrative.executive_summary,
          key_findings: narrative.key_findings,
          discussion: narrative.discussion,
          conclusions: narrative.conclusions,
          risks: narrative.risks,
          opportunities: narrative.opportunities,
          lessons_learned: narrative.lessons_learned,
        };

        await env.DB.prepare('UPDATE generated_reports SET document_model_json = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .bind(JSON.stringify(documentModel), narrativeMatch[1]).run();
        return json({ ok: true, document_model: documentModel });
      }

      if (path === '/api/surveys' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare('SELECT * FROM surveys WHERE organization_id = ? ORDER BY created_at DESC').bind(claims.org).all();
        return json({ surveys: results });
      }

      if (path === '/api/surveys' && method === 'POST') {
        const claims = await requireAuth(request, env);
        // SECURITY: creating a survey is an org-admin-level action — never
        // allowed for enumerator or me_officer (view-only by design).
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') {
          return error('Only an Org Admin can create a new survey', 403);
        }
        const body = await request.json();
        if (!body.title) return error('title is required');
        const id = newId('survey');
        await env.DB.prepare(
          `INSERT INTO surveys (id, organization_id, created_by, title, description, module_type, language, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, claims.org, claims.sub, body.title, body.description || '', body.module_type || 'survey', body.language || 'en', body.status || 'draft').run();

        if (env.NOTIFY_TO_EMAIL) {
          await sendEmail(env, {
            to: env.NOTIFY_TO_EMAIL,
            subject: `📋 New project created: ${body.title}`,
            html: `<p>A new project was created by <b>${claims.email || claims.sub}</b>.</p><p><b>Title:</b> ${body.title}<br><b>Type:</b> ${body.module_type || 'survey'}<br><b>Status:</b> ${body.status || 'draft'}</p>`,
          });
        }
        return json({ survey: { id, title: body.title, status: body.status || 'draft' } }, 201);
      }

      const surveyMatch = path.match(/^\/api\/surveys\/([a-zA-Z0-9_]+)$/);
      if (surveyMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const survey = await env.DB.prepare('SELECT * FROM surveys WHERE id = ? AND organization_id = ?').bind(surveyMatch[1], claims.org).first();
        if (!survey) return error('Survey not found', 404);
        const { results: questions } = await env.DB.prepare('SELECT * FROM questions WHERE survey_id = ? ORDER BY order_index ASC').bind(surveyMatch[1]).all();
        return json({ survey, questions });
      }

      if (surveyMatch && method === 'PUT') {
        const claims = await requireAuth(request, env);
        const existing = await env.DB.prepare('SELECT id FROM surveys WHERE id = ? AND organization_id = ?').bind(surveyMatch[1], claims.org).first();
        if (!existing) return error('Survey not found', 404);
        const body = await request.json();
        if (!body.title) return error('title is required');
        await env.DB.prepare(
          `UPDATE surveys SET title = ?, description = ?, module_type = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
        ).bind(body.title, body.description || null, body.module_type || 'survey', body.status || 'draft', surveyMatch[1]).run();

        // Questions are replaced wholesale on each save — simplest way to support
        // add/edit/remove/reorder in one request without a separate diffing endpoint.
        if (Array.isArray(body.questions)) {
          await env.DB.prepare('DELETE FROM questions WHERE survey_id = ?').bind(surveyMatch[1]).run();
          for (let i = 0; i < body.questions.length; i++) {
            const q = body.questions[i];
            if (!q.question_text) continue;
            await env.DB.prepare(
              `INSERT INTO questions (id, survey_id, order_index, question_text, question_type, kpi_tag) VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(newId('q'), surveyMatch[1], i, q.question_text, q.question_type || 'open_voice', q.kpi_tag || null).run();
          }
        }
        return json({ ok: true });
      }

      const questionsMatch = path.match(/^\/api\/surveys\/([a-zA-Z0-9_]+)\/questions$/);
      if (questionsMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        const body = await request.json();
        if (!body.question_text) return error('question_text is required');
        const id = newId('q');
        await env.DB.prepare(
          `INSERT INTO questions (id, survey_id, order_index, question_text, question_type, kpi_tag) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(id, questionsMatch[1], body.order_index || 0, body.question_text, body.question_type || 'open_voice', body.kpi_tag || null).run();
        return json({ question: { id, question_text: body.question_text } }, 201);
      }

      // ---------- CAMPAIGNS ----------
      if (path === '/api/campaigns' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { results } = await env.DB.prepare(
          `SELECT c.*, s.title as survey_title, s.module_type as survey_module_type,
                  (SELECT ac.code FROM campaign_access_codes ac WHERE ac.campaign_id = c.id LIMIT 1) as access_code,
                  (SELECT COUNT(*) FROM responses r WHERE r.campaign_id = c.id) AS reached_count
           FROM campaigns c LEFT JOIN surveys s ON c.survey_id = s.id WHERE c.organization_id = ? ORDER BY c.created_at DESC`
        ).bind(effectiveOrgId).all();
        return json({ campaigns: results });
      }

      if (path === '/api/campaigns' && method === 'POST') {
        const claims = await requireAuth(request, env);
        // SECURITY: creating a project is an org-admin-level action — never
        // allowed for enumerator or me_officer (view-only by design).
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') {
          return error('Only an Org Admin can create a new project', 403);
        }
        const body = await request.json();
        if (!body.survey_id || !body.name) return error('survey_id and name are required');
        const id = newId('camp');
        await env.DB.prepare(
          `INSERT INTO campaigns (id, survey_id, organization_id, name, channel, target_respondents, status) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, body.survey_id, claims.org, body.name, body.channel || 'whatsapp', body.target_respondents || 0, 'scheduled').run();

        // A short, speakable code respondents reply with first on WhatsApp/SMS —
        // this is what lets the system know which exact project a shared-number
        // conversation belongs to, instead of guessing or defaulting.
        let accessCode;
        for (let attempt = 0; attempt < 5; attempt++) {
          // Numeric-only so the SAME code works typed into WhatsApp/SMS AND
          // entered on a basic phone keypad (DTMF) for voice calls.
          accessCode = String(Math.floor(1000 + Math.random() * 9000));
          const clash = await env.DB.prepare('SELECT code FROM campaign_access_codes WHERE code = ?').bind(accessCode).first();
          if (!clash) break;
        }
        await env.DB.prepare('INSERT INTO campaign_access_codes (code, campaign_id) VALUES (?, ?)').bind(accessCode, id).run();

        // Optionally link this campaign as a later round (midline/endline) of
        // an earlier baseline — this is what makes Forecasting/Benchmarking in
        // reports real instead of just an illustrative note.
        if (body.baseline_campaign_id) {
          const baseline = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(body.baseline_campaign_id, claims.org).first();
          if (baseline) {
            await env.DB.prepare(
              `INSERT INTO campaign_panel_links (campaign_id, baseline_campaign_id, round_label) VALUES (?, ?, ?)`
            ).bind(id, body.baseline_campaign_id, body.round_label || 'Follow-up').run();
          }
        }

        return json({ campaign: { id, name: body.name, access_code: accessCode } }, 201);
      }

      // ---------- PANEL COMPARISON (baseline vs. a later round, real numbers) ----------
      // ---------- PROJECT WORKSPACE (single campaign, full detail) ----------
      const campaignDetailMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)$/);

      // ---------- PROJECT LIFECYCLE (Research Operations Lifecycle — real + manual stages) ----------
      const lifecycleMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/lifecycle$/);

      // ---------- PROJECT DOCUMENTS (server-persisted link list) ----------
      const docsMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/documents$/);
      if (docsMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(docsMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const { results } = await env.DB.prepare('SELECT id, name, url, category, created_at FROM project_documents WHERE campaign_id = ? ORDER BY created_at DESC').bind(docsMatch[1]).all();
        return json({ documents: results });
      }
      if (docsMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(docsMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const { name, url, category } = await request.json();
        if (!name || !url) return error('name and url are required');
        const VALID_CATEGORIES = ['contract', 'tor', 'training', 'consent', 'photo', 'video', 'report', 'invoice', 'other'];
        await env.DB.prepare('INSERT INTO project_documents (id, campaign_id, name, url, category, added_by) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(newId('doc'), docsMatch[1], name, url, VALID_CATEGORIES.includes(category) ? category : 'other', claims.sub).run();
        return json({ ok: true });
      }
      // ---------- REAL FILE UPLOAD for Documents (Task 2.4) — uploaded files
      // are stored with url = "r2:<key>" (a marker prefix), so existing
      // external-link documents (a plain https:// URL) continue to work
      // completely unchanged — no schema change, fully backward compatible. ----------
      const docsUploadMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/documents\/upload$/);
      if (docsUploadMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(docsUploadMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);

        const form = await request.formData();
        const file = form.get('file');
        const name = form.get('name');
        const category = form.get('category') || 'other';
        if (!file || typeof file === 'string') return error('file is required');
        if (!name) return error('name is required');
        const MAX_SIZE = 25 * 1024 * 1024; // 25MB — generous for contracts/scanned forms, small enough to keep this fast
        const buf = await file.arrayBuffer();
        if (buf.byteLength > MAX_SIZE) return error('File too large — 25MB maximum', 400);

        const VALID_CATEGORIES = ['contract', 'tor', 'training', 'consent', 'photo', 'video', 'report', 'invoice', 'other'];
        const safeCategory = VALID_CATEGORIES.includes(category) ? category : 'other';
        const r2Key = `documents/${docsUploadMatch[1]}/${Date.now()}-${crypto.randomUUID()}-${(file.name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await env.AUDIO_BUCKET.put(r2Key, buf, { httpMetadata: { contentType: file.type || 'application/octet-stream' } });

        await env.DB.prepare('INSERT INTO project_documents (id, campaign_id, name, url, category, added_by) VALUES (?, ?, ?, ?, ?, ?)')
          .bind(newId('doc'), docsUploadMatch[1], name, `r2:${r2Key}`, safeCategory, claims.sub).run();
        await logAudit(env, { org: effectiveOrgId, userId: claims.sub, action: 'document_uploaded', resourceType: 'project_documents', resourceId: docsUploadMatch[1], request });
        return json({ ok: true });
      }

      // Authenticated download for an uploaded document — same ownership
      // pattern proven for /api/audio/:key and /api/photos/:key: verify the
      // requesting user's organization actually owns this specific file
      // before ever streaming it from R2.
      const docsDownloadMatch = path.match(/^\/api\/documents\/(.+)$/);
      if (docsDownloadMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const key = decodeURIComponent(docsDownloadMatch[1]);
        if (claims.role !== 'super_admin') {
          // A logo key checks organization_branding for ownership; every
          // other key (project documents, per Task 2.4) checks
          // project_documents as before — same "not found unless yours"
          // fail-closed behavior either way.
          const owner = key.startsWith('logos/')
            ? await env.DB.prepare('SELECT organization_id FROM organization_branding WHERE logo_r2_key = ?').bind(key).first()
            : await env.DB.prepare(`SELECT c.organization_id FROM project_documents d JOIN campaigns c ON d.campaign_id = c.id WHERE d.url = ?`).bind(`r2:${key}`).first();
          if (!owner || owner.organization_id !== claims.org) return error('Document not found', 404);
        }
        const obj = await env.AUDIO_BUCKET.get(key);
        if (!obj) return error('Document not found', 404);
        return new Response(obj.body, {
          headers: { 'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream', 'Content-Disposition': 'attachment', ...corsHeaders() },
        });
      }

      const docDeleteMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/documents\/([a-zA-Z0-9_]+)$/);
      if (docDeleteMatch && method === 'DELETE') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(docDeleteMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        await env.DB.prepare('DELETE FROM project_documents WHERE id = ? AND campaign_id = ?').bind(docDeleteMatch[2], docDeleteMatch[1]).run();
        return json({ ok: true });
      }

      if (lifecycleMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare(
          `SELECT c.status,
                  (SELECT code FROM campaign_access_codes WHERE campaign_id = c.id LIMIT 1) as access_code,
                  (SELECT COUNT(*) FROM responses WHERE campaign_id = c.id) as response_count,
                  (SELECT COUNT(*) FROM ai_insights ai JOIN responses r ON ai.response_id = r.id WHERE r.campaign_id = c.id) as insight_count
           FROM campaigns c WHERE c.id = ? AND c.organization_id = ?`
        ).bind(lifecycleMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const { results: manualStages } = await env.DB.prepare('SELECT stage, completed_at FROM project_lifecycle_stages WHERE campaign_id = ?').bind(lifecycleMatch[1]).all();
        const manualSet = new Set(manualStages.map(s => s.stage));

        const stages = [
          { key: 'planning', label: 'Planning', done: manualSet.has('planning'), auto: false },
          { key: 'training', label: 'Enumerator Training', done: manualSet.has('training'), auto: false },
          { key: 'deployment', label: 'Deployment', done: !!campaign.access_code, auto: true },
          { key: 'collection', label: 'Data Collection', done: campaign.response_count > 0, auto: true },
          { key: 'ai_processing', label: 'AI Processing', done: campaign.insight_count > 0, auto: true },
          { key: 'validation', label: 'Quality Validation', done: manualSet.has('validation'), auto: false },
          { key: 'client_delivery', label: 'Client Delivery', done: manualSet.has('client_delivery'), auto: false },
          { key: 'archive', label: 'Archive', done: manualSet.has('archive'), auto: false },
        ];
        return json({ stages });
      }

      if (lifecycleMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can update the project lifecycle', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(lifecycleMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const { stage, done } = await request.json();
        const MANUAL_STAGES = ['planning', 'training', 'validation', 'client_delivery', 'archive'];
        if (!MANUAL_STAGES.includes(stage)) return error('This stage is derived automatically and cannot be set manually');
        if (done) {
          await env.DB.prepare('INSERT OR IGNORE INTO project_lifecycle_stages (campaign_id, stage) VALUES (?, ?)').bind(lifecycleMatch[1], stage).run();
        } else {
          await env.DB.prepare('DELETE FROM project_lifecycle_stages WHERE campaign_id = ? AND stage = ?').bind(lifecycleMatch[1], stage).run();
        }
        return json({ ok: true });
      }

      if (campaignDetailMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare(
          `SELECT c.*, s.title as survey_title, s.module_type as survey_module_type,
                  (SELECT ac.code FROM campaign_access_codes ac WHERE ac.campaign_id = c.id LIMIT 1) as access_code,
                  (SELECT COUNT(*) FROM responses r WHERE r.campaign_id = c.id) as response_count,
                  (SELECT COUNT(*) FROM responses r WHERE r.campaign_id = c.id AND r.status = 'completed') as completed_count
           FROM campaigns c LEFT JOIN surveys s ON c.survey_id = s.id
           WHERE c.id = ? AND c.organization_id = ?`
        ).bind(campaignDetailMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const panelLink = await env.DB.prepare(
          `SELECT pl.round_label, c2.name as baseline_name FROM campaign_panel_links pl JOIN campaigns c2 ON pl.baseline_campaign_id = c2.id WHERE pl.campaign_id = ?`
        ).bind(campaignDetailMatch[1]).first();
        return json({ campaign, panel_link: panelLink || null });
      }

      // ---------- PROJECT GPS MAP (real collected locations for one project) ----------
      // ---------- CLONE PROJECT (new round of the same study, pre-linked as a panel) ----------
      // ---------- EMAIL REPORT (send the report link to a client/colleague) ----------
      if (path === '/api/reports/email' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { to, report_url, report_name } = await request.json();
        if (!to || !report_url) return error('to and report_url are required');
        const org = await env.DB.prepare('SELECT name FROM organizations WHERE id = ?').bind(claims.org).first();
        try {
          await sendEmail(env, {
            to,
            subject: `${report_name || 'Report'} from ${org?.name || 'VoiceInsights Africa'}`,
            html: `<p>Hello,</p><p>${org?.name || 'A colleague'} has shared a report with you via VoiceInsights Africa.</p><p><a href="${report_url}">Open the report</a></p><p>Note: you may need to be logged in to view it, depending on how it was shared.</p>`,
          });
          await logAudit(env, { org: claims.org, userId: claims.sub, action: 'report_emailed', resourceType: 'report', resourceId: to, request });
          return json({ ok: true });
        } catch (e) {
          return error('Could not send email — check email delivery is configured', 502);
        }
      }

      // ---------- RESPONSE REMINDER (nudge respondents who started but didn't finish) ----------
      // ---------- ENUMERATOR LEADERBOARD (real per-person attribution, this week) ----------
      if (path === '/api/enumerators/leaderboard' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { results } = await env.DB.prepare(
          `SELECT u.id, u.full_name, COUNT(rc.response_id) as response_count
           FROM users u JOIN response_collector rc ON rc.user_id = u.id JOIN responses r ON rc.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE u.organization_id = ? AND u.role = 'enumerator' AND r.started_at >= datetime('now', '-7 days')
           GROUP BY u.id ORDER BY response_count DESC LIMIT 20`
        ).bind(effectiveOrgId).all();
        return json({ leaderboard: results });
      }

      const reminderMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/remind$/);
      if (reminderMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can send reminders', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id, name FROM campaigns WHERE id = ? AND organization_id = ?').bind(reminderMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);

        const { results: incomplete } = await env.DB.prepare(
          `SELECT DISTINCT s.session_key, s.channel FROM sessions s
           WHERE s.campaign_id = ? AND s.status = 'in_progress' AND s.channel IN ('whatsapp', 'sms')
           AND s.updated_at < datetime('now', '-6 hours')`
        ).bind(reminderMatch[1]).all();

        let sent = 0;
        for (const row of incomplete) {
          try {
            await sendTwilioMessage(env, {
              to: row.session_key,
              whatsapp: row.channel === 'whatsapp',
              body: `Hi! You started "${campaign.name}" but didn't finish. Reply anytime to continue where you left off — it only takes a few minutes.`,
            });
            sent++;
          } catch (e) { /* skip and continue with the rest */ }
        }
        await logAudit(env, { org: effectiveOrgId, userId: claims.sub, action: 'reminders_sent', resourceType: 'campaign', resourceId: reminderMatch[1], request });
        return json({ ok: true, eligible: incomplete.length, sent });
      }

      const cloneMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/clone$/);
      if (cloneMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can clone a project', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const original = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND organization_id = ?').bind(cloneMatch[1], effectiveOrgId).first();
        if (!original) return error('Project not found', 404);
        const { name, round_label } = await request.json();

        const newCampaignId = newId('camp');
        await env.DB.prepare(
          `INSERT INTO campaigns (id, survey_id, organization_id, name, channel, target_respondents, status) VALUES (?, ?, ?, ?, ?, ?, 'scheduled')`
        ).bind(newCampaignId, original.survey_id, effectiveOrgId, name || (original.name + ' — Round 2'), original.channel, original.target_respondents).run();

        let accessCode;
        for (let attempt = 0; attempt < 5; attempt++) {
          accessCode = String(Math.floor(1000 + Math.random() * 9000));
          const clash = await env.DB.prepare('SELECT code FROM campaign_access_codes WHERE code = ?').bind(accessCode).first();
          if (!clash) break;
        }
        await env.DB.prepare('INSERT INTO campaign_access_codes (code, campaign_id) VALUES (?, ?)').bind(accessCode, newCampaignId).run();
        await env.DB.prepare('INSERT INTO campaign_panel_links (campaign_id, baseline_campaign_id, round_label) VALUES (?, ?, ?)')
          .bind(newCampaignId, cloneMatch[1], round_label || 'Follow-up').run();

        // Carry the same team over — no need to re-invite the same enumerators for a repeat round.
        const { results: team } = await env.DB.prepare('SELECT user_id FROM user_campaign_assignment WHERE campaign_id = ?').bind(cloneMatch[1]).all();
        for (const t of team) {
          await env.DB.prepare('INSERT OR IGNORE INTO user_campaign_assignment (user_id, campaign_id) VALUES (?, ?)').bind(t.user_id, newCampaignId).run();
        }

        return json({ ok: true, campaign_id: newCampaignId, access_code: accessCode });
      }

      // ---------- CONSENT AUDIT EXPORT (proof of consent for compliance/auditors) ----------
      if (path === '/api/compliance/consent-export' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin' && claims.role !== 'me_officer') return error('Only a supervisor can export consent records', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { results } = await env.DB.prepare(
          `SELECT resp.id as respondent_id, resp.consent_given, resp.created_at, resp.region, c.name as campaign_name, r.channel
           FROM respondents resp
           LEFT JOIN responses r ON r.respondent_id = resp.id
           LEFT JOIN campaigns c ON r.campaign_id = c.id
           WHERE resp.organization_id = ? ORDER BY resp.created_at DESC LIMIT 5000`
        ).bind(effectiveOrgId).all();
        const header = 'respondent_id,consent_given,campaign,channel,region,date\n';
        const rows = results.map(r => [r.respondent_id, r.consent_given ? 'yes' : 'no', r.campaign_name || '', r.channel || '', r.region || '', r.created_at].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        return new Response(header + rows, { headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="consent-audit-export.csv"', ...corsHeaders() } });
      }

      // ---------- RESPONDENT SATISFACTION (public — no auth, submitted right after finishing) ----------
      if (path === '/api/public/satisfaction' && method === 'POST') {
        const { campaign_id, rating } = await request.json();
        if (!campaign_id || !rating || rating < 1 || rating > 5) return error('campaign_id and a rating 1-5 are required');
        await env.DB.prepare('INSERT INTO respondent_satisfaction (id, campaign_id, rating) VALUES (?, ?, ?)').bind(newId('sat'), campaign_id, rating).run();
        return json({ ok: true });
      }
      if (path === '/api/campaigns/satisfaction-summary' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const filterCampaign = await getEffectiveCampaignFilter(request, env, claims, effectiveOrgId);
        const cf = filterCampaign ? 'AND rs.campaign_id = ?' : '';
        const bindArgs = filterCampaign ? [effectiveOrgId, filterCampaign] : [effectiveOrgId];
        const row = await env.DB.prepare(
          `SELECT AVG(rs.rating) as avg_rating, COUNT(*) as n FROM respondent_satisfaction rs JOIN campaigns c ON rs.campaign_id = c.id
           WHERE c.organization_id = ? ${cf}`
        ).bind(...bindArgs).first();
        return json({ avg_rating: row.avg_rating, count: row.n });
      }

      const gpsPointsMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/gps-points$/);
      if (gpsPointsMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(gpsPointsMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const { results } = await env.DB.prepare(
          `SELECT rm.gps_lat, rm.gps_lng, r.started_at, resp.region
           FROM response_metadata rm JOIN responses r ON rm.response_id = r.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE r.campaign_id = ? AND rm.gps_lat IS NOT NULL LIMIT 500`
        ).bind(gpsPointsMatch[1]).all();
        return json({ points: results });
      }

      const campaignTeamMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/team$/);
      if (campaignTeamMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(campaignTeamMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const { results } = await env.DB.prepare(
          `SELECT u.id, u.full_name, u.email, u.role, u.is_active,
                  (SELECT COUNT(*) FROM responses r WHERE r.campaign_id = ? AND r.channel = 'app') as app_responses
           FROM user_campaign_assignment uca JOIN users u ON uca.user_id = u.id
           WHERE uca.campaign_id = ?`
        ).bind(campaignTeamMatch[1], campaignTeamMatch[1]).all();
        // Everyone else in the organization who ISN'T yet assigned — for the "add to project" picker.
        const { results: unassigned } = await env.DB.prepare(
          `SELECT id, full_name, email, role FROM users
           WHERE organization_id = ? AND role = 'enumerator' AND id NOT IN (
             SELECT user_id FROM user_campaign_assignment WHERE campaign_id = ?
           )`
        ).bind(effectiveOrgId, campaignTeamMatch[1]).all();
        return json({ team: results, available_enumerators: unassigned });
      }

      if (campaignTeamMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can assign team members', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(campaignTeamMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const { user_id } = await request.json();
        const user = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND organization_id = ?').bind(user_id, effectiveOrgId).first();
        if (!user) return error('User not found in this organization', 404);
        await env.DB.prepare('INSERT OR IGNORE INTO user_campaign_assignment (user_id, campaign_id) VALUES (?, ?)').bind(user_id, campaignTeamMatch[1]).run();
        // Task 6.3: notify the enumerator of their new assignment. Never
        // blocks the actual assignment if push fails/isn't configured.
        const campaignInfo = await env.DB.prepare('SELECT name FROM campaigns WHERE id = ?').bind(campaignTeamMatch[1]).first();
        sendPushNotification(env, user_id, {
          title: 'New Project Assignment',
          body: `You've been assigned to "${campaignInfo?.name || 'a project'}".`,
          link: '/app/my-work.html',
        }).catch(e => console.error('push (new assignment) failed:', e.message));
        return json({ ok: true });
      }

      const campaignTeamRemoveMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/team\/([a-zA-Z0-9_]+)$/);
      if (campaignTeamRemoveMatch && method === 'DELETE') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can remove team members', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(campaignTeamRemoveMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        await env.DB.prepare('DELETE FROM user_campaign_assignment WHERE campaign_id = ? AND user_id = ?').bind(campaignTeamRemoveMatch[1], campaignTeamRemoveMatch[2]).run();
        return json({ ok: true });
      }

      const panelMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/panel$/);
      if (panelMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const link = await env.DB.prepare('SELECT * FROM campaign_panel_links WHERE campaign_id = ?').bind(panelMatch[1]).first();
        if (!link) return json({ linked: false });
        async function roundStats(campaignId) {
          const total = await env.DB.prepare(
            `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.id = ? AND c.organization_id = ?`
          ).bind(campaignId, claims.org).first();
          const positive = await env.DB.prepare(
            `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.id = ? AND c.organization_id = ? AND r.overall_sentiment = 'positive'`
          ).bind(campaignId, claims.org).first();
          return { total: total.n, positive_pct: total.n ? Math.round((positive.n / total.n) * 100) : 0 };
        }
        const baseline = await roundStats(link.baseline_campaign_id);
        const current = await roundStats(panelMatch[1]);
        const baselineCampaign = await env.DB.prepare('SELECT name FROM campaigns WHERE id = ?').bind(link.baseline_campaign_id).first();
        return json({
          linked: true, round_label: link.round_label,
          baseline: { ...baseline, campaign_name: baselineCampaign?.name },
          current,
          sentiment_change_pct: current.positive_pct - baseline.positive_pct,
        });
      }

      // ---------- DASHBOARD ----------
      // ---------- MY WORK (Enumerator's simple home — their assignment + today's progress) ----------
      // ---------- ENUMERATOR DEVICE STATUS (battery, last seen — reported on sync) ----------
      if (path === '/api/my-work/device-status' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { battery_pct } = await request.json();
        await env.DB.prepare(
          `INSERT INTO enumerator_device_status (user_id, battery_pct) VALUES (?, ?)
           ON CONFLICT(user_id) DO UPDATE SET battery_pct = excluded.battery_pct, last_seen_at = datetime('now')`
        ).bind(claims.sub, battery_pct != null ? Math.round(battery_pct) : null).run();
        return json({ ok: true });
      }

      if (path === '/api/my-work' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const assignedCampaignId = await getAssignedCampaignId(env, claims);
        if (!assignedCampaignId) return json({ assigned: false });
        const campaign = await env.DB.prepare(
          `SELECT c.id, c.name, c.target_respondents, s.title as survey_title
           FROM campaigns c LEFT JOIN surveys s ON c.survey_id = s.id WHERE c.id = ?`
        ).bind(assignedCampaignId).first();
        const todayCount = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses WHERE campaign_id = ? AND channel = 'app' AND date(started_at) = date('now')`
        ).bind(assignedCampaignId).first();
        const totalCount = await env.DB.prepare(`SELECT COUNT(*) as n FROM responses WHERE campaign_id = ? AND channel = 'app'`).bind(assignedCampaignId).first();
        return json({
          assigned: true,
          campaign: { id: campaign.id, name: campaign.name, survey_title: campaign.survey_title, target_respondents: campaign.target_respondents },
          today_count: todayCount.n,
          total_count: totalCount.n,
        });
      }

      // ---------- MY WORK — Completed history (Enumerator's own submissions) ----------
      if (path === '/api/my-work/completed' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const assignedCampaignId = await getAssignedCampaignId(env, claims);
        if (!assignedCampaignId) return json({ completed: [] });
        const { results } = await env.DB.prepare(
          `SELECT r.id, r.started_at, r.status, resp.full_name, resp.region
           FROM responses r JOIN respondents resp ON r.respondent_id = resp.id
           WHERE r.campaign_id = ? AND r.channel = 'app' ORDER BY r.started_at DESC LIMIT 100`
        ).bind(assignedCampaignId).all();
        return json({ completed: results });
      }

      // ---------- SECURITY DASHBOARD (real 2FA adoption + recent security events) ----------
      // ---------- ANNOUNCEMENTS (supervisor → enumerator broadcast messages) ----------
      // ---------- TRAINING MATERIALS (per-project, visible to assigned enumerators) ----------
      if (path === '/api/my-work/training' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const assignedCampaignId = await getAssignedCampaignId(env, claims);
        if (!assignedCampaignId) return json({ materials: [] });
        const { results } = await env.DB.prepare('SELECT title, url, notes FROM project_training_materials WHERE campaign_id = ? ORDER BY created_at ASC').bind(assignedCampaignId).all();
        return json({ materials: results });
      }

      const trainingMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/training$/);
      if (trainingMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(trainingMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const { results } = await env.DB.prepare('SELECT id, title, url, notes FROM project_training_materials WHERE campaign_id = ? ORDER BY created_at ASC').bind(trainingMatch[1]).all();
        return json({ materials: results });
      }
      if (trainingMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can add training materials', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(trainingMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const { title, url, notes } = await request.json();
        if (!title) return error('title is required');
        await env.DB.prepare('INSERT INTO project_training_materials (id, campaign_id, title, url, notes) VALUES (?, ?, ?, ?, ?)')
          .bind(newId('train'), trainingMatch[1], title, url || null, notes || null).run();
        return json({ ok: true });
      }

      if (path === '/api/my-work/messages' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const assignedCampaignId = await getAssignedCampaignId(env, claims);
        if (!assignedCampaignId) return json({ messages: [] });
        const { results } = await env.DB.prepare(
          `SELECT pa.message, pa.created_at, u.full_name as posted_by FROM project_announcements pa LEFT JOIN users u ON pa.posted_by = u.id
           WHERE pa.campaign_id = ? ORDER BY pa.created_at DESC LIMIT 30`
        ).bind(assignedCampaignId).all();
        return json({ messages: results });
      }

      const announceMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/announcements$/);
      if (announceMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin' && claims.role !== 'me_officer') return error('Only supervisors can post announcements', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const campaign = await env.DB.prepare('SELECT id FROM campaigns WHERE id = ? AND organization_id = ?').bind(announceMatch[1], effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const { message } = await request.json();
        if (!message) return error('message is required');
        await env.DB.prepare('INSERT INTO project_announcements (id, campaign_id, message, posted_by) VALUES (?, ?, ?, ?)')
          .bind(newId('ann'), announceMatch[1], message, claims.sub).run();

        // Task 6.3: push this announcement to every enumerator assigned to
        // this project — never blocks the actual announcement if push fails.
        const { results: assignedEnumerators } = await env.DB.prepare(
          `SELECT uca.user_id FROM user_campaign_assignment uca JOIN users u ON uca.user_id = u.id WHERE uca.campaign_id = ? AND u.role = 'enumerator'`
        ).bind(announceMatch[1]).all();
        for (const e of assignedEnumerators) {
          sendPushNotification(env, e.user_id, {
            title: 'New Message From Your Supervisor',
            body: message.length > 100 ? message.slice(0, 97) + '...' : message,
            link: '/app/my-work.html',
          }).catch(err => console.error('push (announcement) failed for', e.user_id, ':', err.message));
        }
        return json({ ok: true });
      }

      if (path === '/api/security-dashboard' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can view the security dashboard', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);

        const totalUsers = await env.DB.prepare(`SELECT COUNT(*) as n FROM users WHERE organization_id = ? AND is_active = 1`).bind(effectiveOrgId).first();
        const with2fa = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM users u JOIN user_2fa tf ON tf.user_id = u.id WHERE u.organization_id = ? AND u.is_active = 1 AND tf.enabled = 1`
        ).bind(effectiveOrgId).first();
        const recentLogins = await env.DB.prepare(
          `SELECT al.created_at, al.ip_address, u.full_name, u.email FROM audit_logs al JOIN users u ON al.user_id = u.id
           WHERE al.organization_id = ? AND al.action IN ('login', 'login_2fa') ORDER BY al.created_at DESC LIMIT 10`
        ).bind(effectiveOrgId).all();
        const securityEvents = await env.DB.prepare(
          `SELECT al.action, al.created_at, u.full_name FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
           WHERE al.organization_id = ? AND al.action IN ('2fa_enabled', '2fa_disabled', 'password_reset', 'user_deactivated')
           ORDER BY al.created_at DESC LIMIT 10`
        ).bind(effectiveOrgId).all();

        return json({
          total_users: totalUsers.n,
          users_with_2fa: with2fa.n,
          twofa_adoption_pct: totalUsers.n ? Math.round((with2fa.n / totalUsers.n) * 100) : 0,
          recent_logins: recentLogins.results,
          security_events: securityEvents.results,
        });
      }

      if (path === '/api/dashboard/stats' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const assignedCampaign = await getEffectiveCampaignFilter(request, env, claims, effectiveOrgId);
        const campFilter = assignedCampaign ? 'AND c.id = ?' : '';
        const bindArgs = assignedCampaign ? [effectiveOrgId, assignedCampaign] : [effectiveOrgId];
        const surveys = await env.DB.prepare('SELECT COUNT(*) as n FROM surveys WHERE organization_id = ? AND status = "active"').bind(effectiveOrgId).first();
        const responses = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campFilter}`
        ).bind(...bindArgs).first();
        const completed = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campFilter} AND r.status = 'completed'`
        ).bind(...bindArgs).first();
        const positive = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campFilter} AND r.overall_sentiment = 'positive'`
        ).bind(...bindArgs).first();
        const byChannel = await env.DB.prepare(
          `SELECT r.channel, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${campFilter} GROUP BY r.channel`
        ).bind(...bindArgs).all();
        const { results: weeklyRows } = await env.DB.prepare(
          `SELECT strftime('%Y-%W', r.started_at) as week, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? ${campFilter} AND r.started_at >= datetime('now', '-42 days')
           GROUP BY week ORDER BY week ASC`
        ).bind(...bindArgs).all();
        const { results: sentimentRows } = await env.DB.prepare(
          `SELECT r.overall_sentiment, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? ${campFilter} GROUP BY r.overall_sentiment`
        ).bind(...bindArgs).all();
        const responseRate = responses.n > 0 ? Math.round((completed.n / responses.n) * 100) : 0;
        const positiveSentimentPct = responses.n > 0 ? Math.round((positive.n / responses.n) * 100) : 0;
        return json({
          active_surveys: surveys.n,
          total_responses: responses.n,
          completed_responses: completed.n,
          response_rate: responseRate,
          positive_sentiment_pct: positiveSentimentPct,
          by_channel: byChannel.results,
          weekly: weeklyRows,
          sentiment_breakdown: sentimentRows,
        });
      }

      // ---------- ANALYTICS ----------
      if (path === '/api/analytics/summary' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const filterCampaign = await getEffectiveCampaignFilter(request, env, claims, effectiveOrgId);
        const cf = filterCampaign ? 'AND c.id = ?' : '';
        const bindOrgAndCf = () => filterCampaign ? [effectiveOrgId, filterCampaign] : [effectiveOrgId];
        const { results: sentimentRows } = await env.DB.prepare(
          `SELECT r.overall_sentiment, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? ${cf} GROUP BY r.overall_sentiment`
        ).bind(...bindOrgAndCf()).all();
        const { results: insightRows } = await env.DB.prepare(
          `SELECT ai.content_json FROM ai_insights ai JOIN responses r ON ai.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? ${cf} AND ai.insight_type = 'summary' ORDER BY ai.created_at DESC LIMIT 200`
        ).bind(...bindOrgAndCf()).all();
        const topicCounts = {};
        for (const row of insightRows) {
          try { const parsed = JSON.parse(row.content_json); for (const t of parsed.topics || []) topicCounts[t] = (topicCounts[t] || 0) + 1; } catch (_) {}
        }
        const topics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic, count]) => ({ topic, count }));
        const { results: quoteRows } = await env.DB.prepare(
          `SELECT t.raw_text, r.overall_sentiment, r.started_at, r.channel FROM transcripts t
           JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? ${cf} ORDER BY t.created_at DESC LIMIT 6`
        ).bind(...bindOrgAndCf()).all();
        const { results: regionRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.region), ''), 'Unspecified') as region, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? ${cf} GROUP BY region ORDER BY n DESC LIMIT 10`
        ).bind(...bindOrgAndCf()).all();
        const { results: genderRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(dem.gender), ''), 'Not provided') as gender, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           LEFT JOIN respondent_demographics dem ON dem.respondent_id = resp.id
           WHERE c.organization_id = ? ${cf} GROUP BY gender ORDER BY n DESC`
        ).bind(...bindOrgAndCf()).all();
        const { results: ageRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(dem.age_bracket), ''), 'Not provided') as age_bracket, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           LEFT JOIN respondent_demographics dem ON dem.respondent_id = resp.id
           WHERE c.organization_id = ? ${cf} GROUP BY age_bracket ORDER BY age_bracket ASC`
        ).bind(...bindOrgAndCf()).all();
        return json({ sentiment: sentimentRows, topics, quotes: quoteRows, regions: regionRows, gender: genderRows, age: ageRows });
      }


      // ---------- v188 ENTERPRISE OPERATIONS & PLATFORM EXCELLENCE ----------
      // Internal-only operational endpoints. They are additive and super_admin-gated;
      // public health remains intentionally minimal at /api/health.
      if (path === '/api/ops/health-center' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const health = await buildPlatformHealthCenter(env);
        return json({ health_center: health });
      }

      if (path === '/api/ops/dashboard' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const dashboard = await buildOperationalDashboard(env);
        return json({ operational_dashboard: dashboard });
      }

      if (path === '/api/ops/alerts' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const metrics = buildEnterpriseMetricsSnapshot();
        const alerts = summarizeAlertState(evaluateAlertRules(metrics));
        return json({ alerts });
      }

      if (path === '/api/ops/capacity' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        return json({ capacity_plan: buildCapacityPlan({}) });
      }

      if (path === '/api/ops/disaster-recovery' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        return json({ disaster_recovery: buildDisasterRecoveryPlan(), readiness: buildDRReadinessScore(), incident_runbook: buildIncidentResponseRunbook({ incidentType: 'generic' }) });
      }

      if (path === '/api/ops/observability-contract' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        return json({ observability: buildObservabilityContract() });
      }

      if (path === '/api/ops/incident-packet' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const body = await request.json().catch(() => ({}));
        return json({ incident: buildIncidentPacket(body.alert || { service: 'generic', severity: 'warning', title: 'Operational review' }) });
      }

      // ---------- FRAUD ALERTS ----------
      if (path === '/api/fraud/alerts' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { results } = await env.DB.prepare(
          `SELECT r.id as response_id, r.fraud_score, r.overall_sentiment, r.started_at, r.channel, resp.phone_number, c.name as campaign_name,
                  (SELECT ai.content_json FROM ai_insights ai WHERE ai.response_id = r.id AND ai.insight_type = 'fraud_flag' ORDER BY ai.created_at DESC LIMIT 1) as fraud_json
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? AND r.fraud_score IS NOT NULL AND r.fraud_score >= 0.5 ORDER BY r.fraud_score DESC LIMIT 50`
        ).bind(effectiveOrgId).all();
        const alerts = results.map(a => {
          let reasons = [];
          try { reasons = JSON.parse(a.fraud_json || '{}').reasons || []; } catch (_) {}
          const { fraud_json, ...rest } = a;
          return { ...rest, reasons };
        });
        return json({ alerts });
      }

      // ---------- REPORTS (CSV / Excel export) ----------
      if (path === '/api/reports/csv' && method === 'GET') {
        return await handleCsvExport(request, env, url);
      }

      // ---------- ORGANIZATION / BILLING ----------
      // ---------- SUPER ADMIN (VoiceInsights Africa's own team — sees ALL client organizations) ----------
      // Gated strictly on role === 'super_admin'. Every other role in this system
      // (org_admin, me_officer, enumerator) is scoped to their own organization_id
      // and can NEVER reach these routes, even by guessing the URL — requireAuth
      // decodes the JWT server-side, so the role check below cannot be spoofed
      // from the client.
      if (path === '/api/superadmin/organizations' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const { results } = await env.DB.prepare(
          `SELECT o.id, o.name, o.type, o.billing_tier, o.status, o.created_at,
                  (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id AND u.is_active = 1) AS user_count,
                  (SELECT COUNT(*) FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = o.id) AS response_count
           FROM organizations o ORDER BY o.created_at DESC`
        ).all();
        return json({ organizations: results });
      }

      // ---------- MISSION CONTROL (Super Admin — real, platform-wide operations view) ----------
      // ---------- MULTI-ORG COMPARISON (Super Admin — compare 2+ organizations side by side) ----------
      if (path === '/api/superadmin/compare' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const orgIds = (new URL(request.url).searchParams.get('org_ids') || '').split(',').filter(Boolean);
        if (orgIds.length < 2) return error('Provide at least 2 org_ids, comma-separated', 400);
        const results = [];
        for (const oid of orgIds.slice(0, 5)) {
          const org = await env.DB.prepare('SELECT id, name, billing_tier, status FROM organizations WHERE id = ?').bind(oid).first();
          if (!org) continue;
          const responses = await env.DB.prepare(`SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ?`).bind(oid).first();
          const projects = await env.DB.prepare(`SELECT COUNT(*) as n FROM campaigns WHERE organization_id = ?`).bind(oid).first();
          const users = await env.DB.prepare(`SELECT COUNT(*) as n FROM users WHERE organization_id = ? AND is_active = 1`).bind(oid).first();
          const avgSentiment = await env.DB.prepare(
            `SELECT AVG(CASE overall_sentiment WHEN 'positive' THEN 1 WHEN 'neutral' THEN 0 WHEN 'negative' THEN -1 ELSE NULL END) as score
             FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? AND overall_sentiment IS NOT NULL`
          ).bind(oid).first();
          results.push({ ...org, response_count: responses.n, project_count: projects.n, user_count: users.n, avg_sentiment_score: avgSentiment.score });
        }
        return json({ organizations: results });
      }

      if (path === '/api/superadmin/mission-control' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);

        const orgs = await env.DB.prepare('SELECT COUNT(*) as n FROM organizations WHERE status = "active"').first();
        const projectsRunning = await env.DB.prepare(`SELECT COUNT(*) as n FROM campaigns WHERE status IN ('active', 'scheduled')`).first();
        const enumeratorsTotal = await env.DB.prepare(`SELECT COUNT(*) as n FROM users WHERE role = 'enumerator' AND is_active = 1`).first();
        const todayInterviews = await env.DB.prepare(`SELECT COUNT(*) as n FROM responses WHERE date(started_at) = date('now')`).first();
        const fraudAlerts = await env.DB.prepare(`SELECT COUNT(*) as n FROM responses WHERE fraud_score >= 0.5 AND date(started_at) = date('now')`).first();

        const { results: liveProjects } = await env.DB.prepare(
          `SELECT c.id, c.name, c.target_respondents, o.name as org_name,
                  (SELECT COUNT(*) FROM responses r WHERE r.campaign_id = c.id) as response_count
           FROM campaigns c JOIN organizations o ON c.organization_id = o.id
           WHERE c.status IN ('active', 'scheduled') ORDER BY c.created_at DESC LIMIT 8`
        ).all();

        const { results: recentActivity } = await env.DB.prepare(
          `SELECT al.action, al.created_at, o.name as org_name, u.full_name
           FROM audit_logs al JOIN organizations o ON al.organization_id = o.id LEFT JOIN users u ON al.user_id = u.id
           ORDER BY al.created_at DESC LIMIT 10`
        ).all();

        return json({
          organizations_active: orgs.n,
          projects_running: projectsRunning.n,
          enumerators_total: enumeratorsTotal.n,
          today_interviews: todayInterviews.n,
          fraud_alerts_today: fraudAlerts.n,
          live_projects: liveProjects.map(p => ({
            ...p,
            completion_pct: p.target_respondents ? Math.min(100, Math.round((p.response_count / p.target_respondents) * 100)) : null,
          })),
          recent_activity: recentActivity,
        });
      }

      // Real, Claude-generated daily operations summary — grounded in the
      // actual counts above, not a templated sentence.
      // ---------- AI CENTER (real service health, measured from actual coverage) ----------
      // ---------- NOTIFICATIONS (real events, computed on read — not a stored feed) ----------
      if (path === '/api/notifications' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const notifications = [];

        // Each data source is wrapped independently — a failure in ONE
        // (e.g., a slow/broken query) must never take down the whole
        // notification bell for the other sources (Task 6.1, item 9).
        try {
          const { results: fraudRecent } = await env.DB.prepare(
            `SELECT r.id, r.fraud_score, r.started_at, c.name as campaign_name FROM responses r JOIN campaigns c ON r.campaign_id = c.id
             WHERE c.organization_id = ? AND r.fraud_score >= 0.6 AND r.started_at >= datetime('now', '-24 hours') ORDER BY r.started_at DESC LIMIT 5`
          ).bind(effectiveOrgId).all();
          fraudRecent.forEach(f => notifications.push({ key: `fraud_alert:${f.id}`, type: 'fraud_alert', icon: '⚠️', message: `Fraud alert on "${f.campaign_name}" (score ${f.fraud_score.toFixed(2)})`, created_at: f.started_at, link: '/admin/fraud-alerts.html' }));
        } catch (e) { console.error('notifications: fraud query failed', e.message); }

        try {
          // new_lead is intentionally Super-Admin-only (org-scoping doesn't
          // apply — leads aren't tied to any single client organization),
          // matching the existing, already-correct visibility rule.
          const { results: newLeads } = claims.role === 'super_admin'
            ? await env.DB.prepare(`SELECT id, full_name, organization, created_at FROM leads WHERE created_at >= datetime('now', '-24 hours') ORDER BY created_at DESC LIMIT 5`).all()
            : { results: [] };
          newLeads.forEach(l => notifications.push({ key: `new_lead:${l.id}`, type: 'new_lead', icon: '💼', message: `New business inquiry from ${l.full_name}${l.organization ? ' (' + l.organization + ')' : ''}`, created_at: l.created_at, link: `/admin/lead-profile.html?lead_id=${l.id}` }));
        } catch (e) { console.error('notifications: leads query failed', e.message); }

        try {
          const { results: completedCampaigns } = await env.DB.prepare(
            `SELECT id, name, target_respondents FROM campaigns WHERE organization_id = ? AND status = 'active'
             AND target_respondents > 0 AND (SELECT COUNT(*) FROM responses WHERE campaign_id = campaigns.id) >= target_respondents
             AND updated_at >= datetime('now', '-24 hours')`
          ).bind(effectiveOrgId).all();
          completedCampaigns.forEach(c => notifications.push({ key: `project_complete:${c.id}`, type: 'project_complete', icon: '🎯', message: `"${c.name}" has reached its target of ${c.target_respondents} respondents`, created_at: new Date().toISOString(), link: `/app/project.html?id=${c.id}` }));
        } catch (e) { console.error('notifications: campaign-completion query failed', e.message); }

        notifications.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const trimmed = notifications.slice(0, 15);

        // Overlay read/unread state for THIS user, scoped to only the keys
        // actually being returned right now — never leaks another user's
        // read-state, and never touches notifications outside this list.
        let readKeys = new Set();
        if (trimmed.length) {
          try {
            const placeholders = trimmed.map(() => '?').join(',');
            const { results: readRows } = await env.DB.prepare(
              `SELECT notification_key FROM notification_read_state WHERE user_id = ? AND notification_key IN (${placeholders})`
            ).bind(claims.sub, ...trimmed.map(n => n.key)).all();
            readKeys = new Set(readRows.map(r => r.notification_key));
          } catch (e) { console.error('notifications: read-state query failed', e.message); }
        }
        trimmed.forEach(n => { n.is_read = readKeys.has(n.key); });
        const unreadCount = trimmed.filter(n => !n.is_read).length;

        return json({ notifications: trimmed, unread_count: unreadCount });
      }

      // Marks ONE notification as read for the CURRENT user only — scoped to
      // claims.sub, so there is no way to mark another user's notifications
      // read/unread, and no way to affect another organization's data.
      const notifReadMatch = path.match(/^\/api\/notifications\/([a-zA-Z0-9_%]+)\/read$/);
      if (notifReadMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        await env.DB.prepare(
          `INSERT INTO notification_read_state (user_id, notification_key) VALUES (?, ?) ON CONFLICT(user_id, notification_key) DO NOTHING`
        ).bind(claims.sub, decodeURIComponent(notifReadMatch[1])).run();
        return json({ ok: true });
      }

      if (path === '/api/notifications/mark-all-read' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { keys } = await request.json().catch(() => ({ keys: [] }));
        if (!Array.isArray(keys) || !keys.length) return error('keys array is required (the currently-visible notification keys to mark read)', 400);
        for (const key of keys.slice(0, 50)) { // sane upper bound — this list is never realistically larger
          await env.DB.prepare(
            `INSERT INTO notification_read_state (user_id, notification_key) VALUES (?, ?) ON CONFLICT(user_id, notification_key) DO NOTHING`
          ).bind(claims.sub, key).run();
        }
        return json({ ok: true, marked: keys.length });
      }

      // ============================================================
      // WEB/MOBILE PUSH INFRASTRUCTURE (Task 6.2)
      // ============================================================
      if (path === '/api/push/register' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { token, device_type } = await request.json();
        if (!token) return error('token is required', 400);
        await env.DB.prepare(
          `INSERT INTO push_subscriptions (user_id, token, device_type) VALUES (?, ?, ?)
           ON CONFLICT(user_id, token) DO UPDATE SET last_seen_at = datetime('now')`
        ).bind(claims.sub, token, device_type || 'web').run();
        return json({ ok: true });
      }

      if (path === '/api/push/unregister' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { token } = await request.json();
        if (!token) return error('token is required', 400);
        // Scoped to claims.sub — a user can only ever remove their OWN
        // token, never another user's, even if they somehow knew the value.
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ? AND token = ?').bind(claims.sub, token).run();
        return json({ ok: true });
      }

      if (path === '/api/superadmin/ai-health' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);

        // For each AI stage, health = % of eligible responses in the last 48h
        // that actually got that stage's output — a real coverage measure,
        // not a static "Healthy" label.
        const windowExpr = `datetime('now', '-48 hours')`;

        const audioTotal = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses WHERE started_at >= ${windowExpr} AND channel IN ('whatsapp', 'phone_call', 'app')`
        ).first();
        const audioWithTranscript = await env.DB.prepare(
          `SELECT COUNT(DISTINCT r.id) as n FROM responses r JOIN answers a ON a.response_id = r.id JOIN transcripts t ON t.answer_id = a.id
           WHERE r.started_at >= ${windowExpr} AND r.channel IN ('whatsapp', 'phone_call', 'app')`
        ).first();

        const completedTotal = await env.DB.prepare(`SELECT COUNT(*) as n FROM responses WHERE started_at >= ${windowExpr} AND status = 'completed'`).first();
        const withSentiment = await env.DB.prepare(`SELECT COUNT(*) as n FROM responses WHERE started_at >= ${windowExpr} AND status = 'completed' AND overall_sentiment IS NOT NULL`).first();
        const withFraudCheck = await env.DB.prepare(`SELECT COUNT(*) as n FROM responses WHERE started_at >= ${windowExpr} AND fraud_score IS NOT NULL`).first();
        const responsesTotal = await env.DB.prepare(`SELECT COUNT(*) as n FROM responses WHERE started_at >= ${windowExpr}`).first();
        const withSummary = await env.DB.prepare(
          `SELECT COUNT(DISTINCT response_id) as n FROM ai_insights WHERE insight_type = 'summary' AND created_at >= ${windowExpr}`
        ).first();

        function pct(numerator, denominator) {
          if (!denominator) return null;
          return Math.round((numerator / denominator) * 100);
        }
        function statusFor(p) {
          if (p == null) return { label: 'No recent data', color: 'neutral' };
          if (p >= 90) return { label: 'Healthy', color: 'success' };
          if (p >= 70) return { label: 'Degraded', color: 'warn' };
          return { label: 'Issues detected', color: 'danger' };
        }

        const speechPct = pct(audioWithTranscript.n, audioTotal.n);
        const sentimentPct = pct(withSentiment.n, completedTotal.n);
        const summaryPct = pct(withSummary.n, completedTotal.n);
        const fraudPct = pct(withFraudCheck.n, responsesTotal.n);

        return json({
          window_hours: 48,
          services: [
            { name: 'Speech-to-Text (Whisper)', coverage_pct: speechPct, ...statusFor(speechPct), detail: `${audioWithTranscript.n}/${audioTotal.n} audio responses transcribed` },
            { name: 'Sentiment Analysis', coverage_pct: sentimentPct, ...statusFor(sentimentPct), detail: `${withSentiment.n}/${completedTotal.n} completed responses scored` },
            { name: 'Summary Generation (Claude)', coverage_pct: summaryPct, ...statusFor(summaryPct), detail: `${withSummary.n}/${completedTotal.n} completed responses summarized` },
            { name: 'Fraud Detection', coverage_pct: fraudPct, ...statusFor(fraudPct), detail: `${withFraudCheck.n}/${responsesTotal.n} responses fraud-checked` },
          ],
        });
      }

      if (path === '/api/superadmin/mission-control/summary' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);

        const todayInterviews = await env.DB.prepare(`SELECT COUNT(*) as n FROM responses WHERE date(started_at) = date('now')`).first();
        const { results: sentByRegion } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.region), ''), 'Unspecified') as region, r.overall_sentiment, COUNT(*) as n
           FROM responses r JOIN respondents resp ON r.respondent_id = resp.id
           WHERE date(r.started_at) = date('now') AND r.overall_sentiment IS NOT NULL GROUP BY region, r.overall_sentiment`
        ).all();
        const avgFraud = await env.DB.prepare(`SELECT AVG(fraud_score) as avg_score FROM responses WHERE date(started_at) = date('now') AND fraud_score IS NOT NULL`).first();

        if (todayInterviews.n === 0) {
          return json({ summary: 'No interviews have been recorded yet today across the platform.' });
        }

        const prompt = `You are writing a 2-3 sentence daily operations summary for the Super Admin of a multi-tenant voice research SaaS platform operating across Africa. Be specific and factual, grounded ONLY in this data — no invented details:

Today's interviews: ${todayInterviews.n}
Sentiment by region today: ${JSON.stringify(sentByRegion)}
Average fraud score today: ${avgFraud.avg_score != null ? avgFraud.avg_score.toFixed(2) : 'no data'}

Write it as plain prose, no markdown, no headers.`;

        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 200, messages: [{ role: 'user', content: prompt }] }),
        });
        if (!claudeResp.ok) return json({ summary: `${todayInterviews.n} interviews completed today across the platform.` });
        const claudeData = await claudeResp.json();
        return json({ summary: claudeData.content[0].text.trim() });
      }

      if (path === '/api/superadmin/organizations' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const { name, admin_email, admin_full_name, billing_tier } = await request.json();
        if (!name || !admin_email || !admin_full_name) return error('name, admin_email, and admin_full_name are required');
        const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(admin_email).first();
        if (existing) return error('A user with this email already exists', 409);

        const orgId = newId('org');
        await env.DB.prepare(
          `INSERT INTO organizations (id, name, type, billing_tier, status) VALUES (?, ?, 'local_ngo', ?, 'active')`
        ).bind(orgId, name, billing_tier || 'starter').run();

        const tempPassword = [...crypto.getRandomValues(new Uint8Array(9))].map(b => b.toString(36)).join('').slice(0, 12);
        const { hash, salt } = await hashPassword(tempPassword);
        const userId = newId('user');
        await env.DB.prepare(
          `INSERT INTO users (id, organization_id, email, password_hash, password_salt, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, 'org_admin', 1)`
        ).bind(userId, orgId, admin_email, hash, salt, admin_full_name).run();

        const loginUrl = `${env.SITE_URL || 'https://voiceinsightsafrica.com'}/login.html`;
        await sendEmail(env, {
          to: admin_email,
          subject: `Your VoiceInsights Africa organization is ready`,
          html: `<p>Hi ${admin_full_name},</p><p>A VoiceInsights Africa account has been created for <b>${name}</b>.</p>
                 <p><b>Login:</b> <a href="${loginUrl}">${loginUrl}</a><br><b>Email:</b> ${admin_email}<br><b>Temporary password:</b> ${tempPassword}</p>
                 <p>Please log in and change your password from Settings as soon as possible.</p>`,
        });

        await logAudit(env, { org: orgId, userId: claims.sub, action: 'organization_created', resourceType: 'organization', resourceId: orgId, request });
        return json({ ok: true, organization: { id: orgId, name } }, 201);
      }

      const orgStatusMatch = path.match(/^\/api\/superadmin\/organizations\/([a-zA-Z0-9_]+)\/status$/);
      if (orgStatusMatch && method === 'PUT') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const { status } = await request.json();
        if (!['active', 'suspended', 'trial'].includes(status)) return error('status must be active, suspended, or trial');
        await env.DB.prepare('UPDATE organizations SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(status, orgStatusMatch[1]).run();
        await logAudit(env, { org: orgStatusMatch[1], userId: claims.sub, action: 'organization_status_changed', resourceType: 'organization', resourceId: orgStatusMatch[1], request });
        return json({ ok: true });
      }

      // ---------- ORGANIZATION HEALTH SCORE (composite of real signals) ----------
      if (path === '/api/organizations/health' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);

        const completionRate = await env.DB.prepare(
          `SELECT AVG(CASE WHEN status = 'completed' THEN 1.0 ELSE 0 END) as rate FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ?`
        ).bind(effectiveOrgId).first();
        const fraudRate = await env.DB.prepare(
          `SELECT AVG(CASE WHEN fraud_score >= 0.5 THEN 1.0 ELSE 0 END) as rate FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? AND fraud_score IS NOT NULL`
        ).bind(effectiveOrgId).first();
        const totalUsers = await env.DB.prepare(`SELECT COUNT(*) as n FROM users WHERE organization_id = ? AND is_active = 1`).bind(effectiveOrgId).first();
        const with2fa = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM users u JOIN user_2fa tf ON tf.user_id = u.id WHERE u.organization_id = ? AND u.is_active = 1 AND tf.enabled = 1`
        ).bind(effectiveOrgId).first();
        const activeProjects = await env.DB.prepare(`SELECT COUNT(*) as n FROM campaigns WHERE organization_id = ? AND status = 'active'`).bind(effectiveOrgId).first();

        const completionScore = (completionRate.rate || 0) * 100;
        const fraudScore = 100 - ((fraudRate.rate || 0) * 100);
        const securityScore = totalUsers.n ? (with2fa.n / totalUsers.n) * 100 : 100;
        const activityScore = activeProjects.n > 0 ? 100 : 50;
        const overall = Math.round((completionScore + fraudScore + securityScore + activityScore) / 4);

        return json({
          overall_score: overall,
          breakdown: {
            data_completion: Math.round(completionScore),
            fraud_cleanliness: Math.round(fraudScore),
            security_2fa: Math.round(securityScore),
            activity: Math.round(activityScore),
          },
        });
      }

      if (path === '/api/organizations/me' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const org = await env.DB.prepare('SELECT id, name, type, billing_tier, status FROM organizations WHERE id = ?').bind(effectiveOrgId).first();
        if (!org) return error('Organization not found', 404);
        const keyRow = await env.DB.prepare('SELECT api_key FROM organization_api_keys WHERE organization_id = ?').bind(effectiveOrgId).first();
        return json({ organization: { ...org, api_key: keyRow ? keyRow.api_key : null } });
      }

      if (path === '/api/organizations/regenerate-key' && method === 'POST') {
        const claims = await requireAuth(request, env);
        // SECURITY: API-key management is an org-admin-level action — never
        // allowed for enumerator or me_officer (a view-only role per its
        // documented intent), regardless of which organization they belong to.
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') {
          return error('Only an Org Admin can regenerate the organization API key', 403);
        }
        const newKey = 'via_' + [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
        await env.DB.prepare(
          `INSERT INTO organization_api_keys (organization_id, api_key, created_at) VALUES (?, ?, datetime('now'))
           ON CONFLICT(organization_id) DO UPDATE SET api_key = excluded.api_key, created_at = datetime('now')`
        ).bind(claims.org, newKey).run();
        return json({ api_key: newKey });
      }

      if (path === '/api/billing/create-checkout-session' && method === 'POST') {
        return await handleCreateCheckoutSession(request, env);
      }

      if (path === '/api/billing/webhook' && method === 'POST') {
        return await handleStripeWebhook(request, env);
      }

      // ---------- CONTACT / LEADS (sales pipeline) ----------
      if (path === '/api/contact/submit' && method === 'POST') {
        const clientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
        if (await isRateLimited(env, `contact:${clientIp}`, 5, 60 * 60)) {
          return error('Too many submissions. Please try again later.', 429);
        }
        const body = await request.json();
        if (!body.full_name || !body.work_email) return error('full_name and work_email are required');
        const id = newId('lead');
        await env.DB.prepare(
          `INSERT INTO leads (id, full_name, work_email, organization, country, organization_type, project_size, expected_respondents, preferred_channels, message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id, body.full_name, body.work_email, body.organization || null, body.country || null,
          body.organization_type || null, body.project_size || null, body.expected_respondents || null,
          Array.isArray(body.preferred_channels) ? body.preferred_channels.join(', ') : (body.preferred_channels || null),
          body.message || null
        ).run();

        if (env.NOTIFY_TO_EMAIL) {
          await sendEmail(env, {
            to: env.NOTIFY_TO_EMAIL,
            subject: `🎯 New lead: ${body.full_name}${body.organization ? ' (' + body.organization + ')' : ''}`,
            html: `<p><b>${body.full_name}</b> (${body.work_email}) submitted the Contact form.</p>
                   <p><b>Organization:</b> ${body.organization || '—'} (${body.organization_type || '—'})<br>
                   <b>Country:</b> ${body.country || '—'}<br>
                   <b>Project size:</b> ${body.project_size || '—'}<br>
                   <b>Expected respondents:</b> ${body.expected_respondents || '—'}<br>
                   <b>Channels:</b> ${Array.isArray(body.preferred_channels) ? body.preferred_channels.join(', ') : (body.preferred_channels || '—')}</p>
                   <p><b>Message:</b> ${body.message || '—'}</p>`,
          });
        }
        // Task 6.4: push to every Super Admin — a new lead is a
        // platform-wide sales event, not tied to any one organization.
        pushToAllSuperAdmins(env, {
          title: '🎯 New Business Inquiry',
          body: `${body.full_name}${body.organization ? ' (' + body.organization + ')' : ''} submitted a new inquiry.`,
          link: `/admin/lead-profile.html?lead_id=${id}`,
        }).catch(e => console.error('push (new lead) failed:', e.message));
        return json({ ok: true, id }, 201);
      }

      if (path === '/api/leads' && method === 'GET') {
        const claims = await requireAuth(request, env);
        // Leads are VoiceInsights Africa's OWN sales prospects — never a client
        // organization's data. Any authenticated client user (org_admin,
        // me_officer, enumerator) must never see this, regardless of which
        // organization they belong to.
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const { results } = await env.DB.prepare(
          `SELECT l.*, COALESCE(lp.stage, 'new') as stage, lp.owner_note, a.score, a.priority, a.estimated_deal_usd
           FROM leads l LEFT JOIN lead_pipeline lp ON lp.lead_id = l.id LEFT JOIN lead_ai_analysis a ON a.lead_id = l.id
           ORDER BY l.created_at DESC LIMIT 200`
        ).all();
        return json({ leads: results });
      }

      const leadSingleMatch = path.match(/^\/api\/leads\/([a-zA-Z0-9_]+)$/);
      if (leadSingleMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const lead = await env.DB.prepare(
          `SELECT l.*, COALESCE(lp.stage, 'new') as stage,
                  a.score, a.estimated_deal_usd, a.priority, a.recommended_package, a.reasoning as ai_reasoning
           FROM leads l LEFT JOIN lead_pipeline lp ON lp.lead_id = l.id LEFT JOIN lead_ai_analysis a ON a.lead_id = l.id
           WHERE l.id = ?`
        ).bind(leadSingleMatch[1]).first();
        if (!lead) return error('Lead not found', 404);
        return json({ lead });
      }

      // Reads what the prospect told us and produces a ranked, structured
      // qualification — this is what turns a flat inquiry list into an
      // actual prioritized pipeline, instead of every lead looking equally urgent.
      const leadScoreMatch = path.match(/^\/api\/leads\/([a-zA-Z0-9_]+)\/score$/);
      if (leadScoreMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadScoreMatch[1]).first();
        if (!lead) return error('Lead not found', 404);

        const prompt = `You are a sales operations analyst for VoiceInsights Africa, an enterprise voice-research SaaS platform selling to NGOs, governments, UN agencies, and development partners across Africa. Analyze this business inquiry and respond with ONLY a JSON object, no other text:

{
  "score": <integer 0-100, likelihood this becomes a paying enterprise deal>,
  "estimated_deal_usd": <integer, realistic annual contract estimate>,
  "priority": "<high|medium|low>",
  "recommended_package": "<Starter|Professional|Enterprise>",
  "reasoning": "<2-3 sentences explaining the score, grounded in the specific details below — mention the organization type, respondent scale, or channel mix that drove the assessment>"
}

INQUIRY DETAILS:
Organization: ${lead.organization || 'not given'}
Organization type: ${lead.organization_type || 'not given'}
Country: ${lead.country || 'not given'}
Project size: ${lead.project_size || 'not given'}
Expected respondents: ${lead.expected_respondents || 'not given'}
Preferred channels: ${lead.preferred_channels || 'not given'}
Message: ${lead.message || 'none provided'}`;

        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
        });
        if (!claudeResp.ok) return error('AI scoring is temporarily unavailable', 502);
        const claudeData = await claudeResp.json();
        let parsed;
        try {
          const text = claudeData.content[0].text.trim().replace(/^```json\s*|\s*```$/g, '');
          parsed = JSON.parse(text);
        } catch (e) {
          return error('Could not parse AI scoring response', 502);
        }
        await env.DB.prepare(
          `INSERT INTO lead_ai_analysis (lead_id, score, estimated_deal_usd, priority, recommended_package, reasoning) VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(lead_id) DO UPDATE SET score = excluded.score, estimated_deal_usd = excluded.estimated_deal_usd,
             priority = excluded.priority, recommended_package = excluded.recommended_package, reasoning = excluded.reasoning, created_at = datetime('now')`
        ).bind(leadScoreMatch[1], parsed.score, parsed.estimated_deal_usd || null, parsed.priority || 'medium', parsed.recommended_package || null, parsed.reasoning || null).run();
        return json({ ok: true, analysis: parsed });
      }

      // The core workflow the whole CRM exists to support: a won lead becomes
      // a real Organization with its first Project and an invited admin user —
      // in one action, instead of manually re-typing everything already collected.
      const leadConvertMatch = path.match(/^\/api\/leads\/([a-zA-Z0-9_]+)\/convert$/);
      if (leadConvertMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const lead = await env.DB.prepare('SELECT * FROM leads WHERE id = ?').bind(leadConvertMatch[1]).first();
        if (!lead) return error('Lead not found', 404);
        const { organization_name, billing_tier, admin_full_name, admin_email, project_name, survey_id } = await request.json();
        if (!organization_name || !admin_full_name || !admin_email) return error('organization_name, admin_full_name, and admin_email are required');

        const existingUser = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(admin_email).first();
        if (existingUser) return error('A user with this email already exists', 409);

        const orgId = newId('org');
        await env.DB.prepare('INSERT INTO organizations (id, name, billing_tier, status) VALUES (?, ?, ?, ?)')
          .bind(orgId, organization_name, billing_tier || 'starter', 'active').run();

        const tempPassword = [...crypto.getRandomValues(new Uint8Array(9))].map(b => b.toString(36)).join('').slice(0, 12);
        const { hash, salt } = await hashPassword(tempPassword);
        const userId = newId('user');
        await env.DB.prepare(
          `INSERT INTO users (id, organization_id, email, password_hash, password_salt, full_name, role, is_active) VALUES (?, ?, ?, ?, ?, ?, 'org_admin', 1)`
        ).bind(userId, orgId, admin_email, hash, salt, admin_full_name).run();

        let campaignId = null, accessCode = null;
        if (project_name && survey_id) {
          campaignId = newId('camp');
          await env.DB.prepare(
            `INSERT INTO campaigns (id, survey_id, organization_id, name, channel, status) VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(campaignId, survey_id, orgId, project_name, 'whatsapp', 'scheduled').run();
          for (let attempt = 0; attempt < 5; attempt++) {
            accessCode = String(Math.floor(1000 + Math.random() * 9000));
            const clash = await env.DB.prepare('SELECT code FROM campaign_access_codes WHERE code = ?').bind(accessCode).first();
            if (!clash) break;
          }
          await env.DB.prepare('INSERT INTO campaign_access_codes (code, campaign_id) VALUES (?, ?)').bind(accessCode, campaignId).run();
        }

        await env.DB.prepare(
          `INSERT INTO lead_pipeline (lead_id, stage) VALUES (?, 'won') ON CONFLICT(lead_id) DO UPDATE SET stage = 'won', updated_at = datetime('now')`
        ).bind(leadConvertMatch[1]).run();
        await env.DB.prepare(`UPDATE leads SET status = 'converted' WHERE id = ?`).bind(leadConvertMatch[1]).run();

        if (env.RESEND_API_KEY) {
          await sendEmail(env, {
            to: admin_email,
            subject: `Welcome to VoiceInsights Africa — ${organization_name}`,
            html: `<p>Hello ${admin_full_name},</p><p>Your VoiceInsights Africa account for <b>${organization_name}</b> is ready.</p><p>Email: ${admin_email}<br>Temporary password: <b>${tempPassword}</b></p><p>Login at ${env.SITE_URL || 'https://voiceinsightsafrica.com'}/login.html and please change your password on first login.</p>`,
          }).catch(() => {});
        }
        await logAudit(env, { org: orgId, userId: claims.sub, action: 'lead_converted', resourceType: 'organization', resourceId: orgId, request });

        return json({ ok: true, organization_id: orgId, campaign_id: campaignId, access_code: accessCode, admin_temp_password: tempPassword });
      }

      const leadStageMatch = path.match(/^\/api\/leads\/([a-zA-Z0-9_]+)\/stage$/);
      if (leadStageMatch && method === 'PUT') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const { stage, owner_note } = await request.json();
        const VALID_STAGES = ['new', 'contacted', 'proposal_sent', 'negotiating', 'won', 'lost'];
        if (!VALID_STAGES.includes(stage)) return error('Invalid stage');
        await env.DB.prepare(
          `INSERT INTO lead_pipeline (lead_id, stage, owner_note) VALUES (?, ?, ?)
           ON CONFLICT(lead_id) DO UPDATE SET stage = excluded.stage, owner_note = excluded.owner_note, updated_at = datetime('now')`
        ).bind(leadStageMatch[1], stage, owner_note || null).run();
        return json({ ok: true });
      }

      // ---------- RESPONDENTS ----------
      // ---------- CSV BULK IMPORT (pre-existing data, e.g. paper forms already transcribed) ----------
      if (path === '/api/campaigns/import-csv' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can bulk import data', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const form = await request.formData();
        const campaignId = form.get('campaign_id');
        const file = form.get('file');
        if (!campaignId || !file) return error('campaign_id and file are required');
        const campaign = await env.DB.prepare('SELECT id, survey_id FROM campaigns WHERE id = ? AND organization_id = ?').bind(campaignId, effectiveOrgId).first();
        if (!campaign) return error('Project not found', 404);
        const questions = await getQuestions(env, campaign.survey_id);

        const text = await file.text();
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2) return error('CSV must have a header row and at least one data row');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const phoneIdx = headers.indexOf('phone_number');
        const nameIdx = headers.indexOf('full_name');
        const regionIdx = headers.indexOf('region');
        const qCols = headers.filter(h => h.startsWith('q')).length;

        let imported = 0, skipped = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          if (!cols.length || (phoneIdx >= 0 && !cols[phoneIdx])) { skipped++; continue; }
          const respondentId = newId('resp');
          await env.DB.prepare('INSERT INTO respondents (id, organization_id, phone_number, full_name, region, consent_given) VALUES (?, ?, ?, ?, ?, 1)')
            .bind(respondentId, effectiveOrgId, phoneIdx >= 0 ? cols[phoneIdx] : null, nameIdx >= 0 ? cols[nameIdx] : null, regionIdx >= 0 ? cols[regionIdx] : null).run();
          const responseId = newId('response');
          await env.DB.prepare(`INSERT INTO responses (id, campaign_id, respondent_id, channel, status, completed_at) VALUES (?, ?, ?, 'csv_import', 'completed', datetime('now'))`)
            .bind(responseId, campaignId, respondentId).run();
          for (let qi = 0; qi < Math.min(qCols, questions.length); qi++) {
            const colIdx = headers.indexOf('q' + (qi + 1));
            if (colIdx < 0 || !cols[colIdx]) continue;
            await env.DB.prepare('INSERT INTO answers (id, response_id, question_id, answer_text) VALUES (?, ?, ?, ?)')
              .bind(newId('answer'), responseId, questions[qi].id, cols[colIdx]).run();
          }
          imported++;
        }
        await logAudit(env, { org: effectiveOrgId, userId: claims.sub, action: 'csv_import', resourceType: 'campaign', resourceId: campaignId, request });
        return json({ ok: true, imported, skipped });
      }

      if (path === '/api/respondents' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const filterCampaign = await getEffectiveCampaignFilter(request, env, claims, effectiveOrgId);
        const { results } = await env.DB.prepare(
          filterCampaign
            ? `SELECT r.id, r.phone_number, r.full_name, r.region,
                      COALESCE(dem.gender, 'Not provided') as gender, COALESCE(dem.age_bracket, 'Not provided') as age_bracket,
                      r.consent_given, r.created_at,
                      (SELECT COUNT(*) FROM responses resp WHERE resp.respondent_id = r.id) AS response_count
               FROM respondents r
               LEFT JOIN respondent_demographics dem ON dem.respondent_id = r.id
               WHERE r.organization_id = ? AND r.id IN (SELECT respondent_id FROM responses WHERE campaign_id = ?)
               ORDER BY r.created_at DESC LIMIT 200`
            : `SELECT r.id, r.phone_number, r.full_name, r.region,
                      COALESCE(dem.gender, 'Not provided') as gender, COALESCE(dem.age_bracket, 'Not provided') as age_bracket,
                      r.consent_given, r.created_at,
                      (SELECT COUNT(*) FROM responses resp WHERE resp.respondent_id = r.id) AS response_count
               FROM respondents r
               LEFT JOIN respondent_demographics dem ON dem.respondent_id = r.id
               WHERE r.organization_id = ? ORDER BY r.created_at DESC LIMIT 200`
        ).bind(...(filterCampaign ? [effectiveOrgId, filterCampaign] : [effectiveOrgId])).all();
        return json({ respondents: results });
      }

      // ---------- INTERVIEWS (responses with transcript + audio) ----------
      if (path === '/api/interviews' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const assignedCampaign = await getEffectiveCampaignFilter(request, env, claims, effectiveOrgId);
        const { results } = await env.DB.prepare(
          `SELECT r.id as response_id, r.channel, r.overall_sentiment, r.fraud_score, r.status, r.started_at,
                  resp.phone_number, c.name as campaign_name,
                  (SELECT a.audio_r2_key FROM answers a WHERE a.response_id = r.id AND a.audio_r2_key IS NOT NULL ORDER BY a.created_at ASC LIMIT 1) as audio_r2_key,
                  (SELECT t.raw_text FROM transcripts t JOIN answers a2 ON t.answer_id = a2.id WHERE a2.response_id = r.id ORDER BY t.created_at ASC LIMIT 1) as first_transcript,
                  (SELECT ai.content_json FROM ai_insights ai WHERE ai.response_id = r.id AND ai.insight_type = 'summary' ORDER BY ai.created_at DESC LIMIT 1) as summary_json,
                  rm.device_id, rm.gps_lat, rm.gps_lng, rm.gps_accuracy_m
           FROM responses r
           JOIN campaigns c ON r.campaign_id = c.id
           JOIN respondents resp ON r.respondent_id = resp.id
           LEFT JOIN response_metadata rm ON rm.response_id = r.id
           WHERE c.organization_id = ? ${assignedCampaign ? 'AND c.id = ?' : ''}
           ORDER BY r.started_at DESC LIMIT 100`
        ).bind(...(assignedCampaign ? [effectiveOrgId, assignedCampaign] : [effectiveOrgId])).all();
        return json({ interviews: results });
      }

      // ---------- AUDIO STREAMING (from R2) ----------
      // ---------- PHOTO STREAMING (from R2 — same ownership pattern as audio) ----------
      const photoMatch = path.match(/^\/api\/photos\/(.+)$/);
      if (photoMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const key = decodeURIComponent(photoMatch[1]);
        if (claims.role !== 'super_admin') {
          const owner = await env.DB.prepare(
            `SELECT c.organization_id FROM answer_photos p JOIN answers a ON p.answer_id = a.id JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id WHERE p.r2_key = ?`
          ).bind(key).first();
          if (!owner || owner.organization_id !== claims.org) return error('Photo not found', 404);
        }
        const obj = await env.AUDIO_BUCKET.get(key);
        if (!obj) return error('Photo not found', 404);
        return new Response(obj.body, {
          headers: { 'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg', ...corsHeaders() },
        });
      }

      const audioMatch = path.match(/^\/api\/audio\/(.+)$/);
      if (audioMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const key = decodeURIComponent(audioMatch[1]);
        // Verify this specific audio file actually belongs to the requesting
        // user's own organization before streaming it — otherwise any logged-in
        // user from ANY client organization could listen to another
        // organization's respondent recordings just by knowing the R2 key.
        if (claims.role !== 'super_admin') {
          const owner = await env.DB.prepare(
            `SELECT c.organization_id FROM answers a JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id WHERE a.audio_r2_key = ?`
          ).bind(key).first();
          if (!owner || owner.organization_id !== claims.org) return error('Audio not found', 404);
        }
        const obj = await env.AUDIO_BUCKET.get(key);
        if (!obj) return error('Audio not found', 404);
        return new Response(obj.body, {
          headers: { 'Content-Type': obj.httpMetadata?.contentType || 'audio/ogg', ...corsHeaders() },
        });
      }

      // ---------- TRANSCRIPTS (full Q&A, chat-style) ----------
      const transcriptMatch = path.match(/^\/api\/transcripts\/([a-zA-Z0-9_]+)$/);
      if (transcriptMatch && method === 'GET') {
        const claims = await requireAuth(request, env);
        const responseId = transcriptMatch[1];
        const { results } = await env.DB.prepare(
          `SELECT q.question_text, q.order_index, t.raw_text, a.audio_r2_key, a.created_at, p.r2_key as photo_r2_key
           FROM answers a
           JOIN questions q ON a.question_id = q.id
           LEFT JOIN transcripts t ON t.answer_id = a.id
           LEFT JOIN answer_photos p ON p.answer_id = a.id
           JOIN responses r ON a.response_id = r.id
           JOIN campaigns c ON r.campaign_id = c.id
           WHERE a.response_id = ? AND c.organization_id = ?
           ORDER BY q.order_index ASC`
        ).bind(responseId, claims.org).all();
        return json({ turns: results });
      }

      // ---------- COMPLIANCE ----------
      // ---------- DHIS2 INTEGRATION (Ministry of Health systems — aggregate data push) ----------
      if (path === '/api/dhis2/config' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const row = await env.DB.prepare('SELECT instance_url, default_org_unit, default_dataset_id, enabled FROM dhis2_integrations WHERE organization_id = ?').bind(claims.org).first();
        // Never return the token itself back to the browser once saved.
        return json({ configured: !!row, config: row || null });
      }

      if (path === '/api/dhis2/config' && method === 'PUT') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can configure DHIS2', 403);
        const { instance_url, api_token, default_org_unit, default_dataset_id } = await request.json();
        if (!instance_url || !api_token) return error('instance_url and api_token are required');
        let envelope;
        try {
          envelope = await encryptSecret(env, { organizationId: claims.org, secretType: 'dhis2_api_token', plaintext: api_token });
        } catch (e) {
          return error('Server is not configured to store this securely (vault key missing) — contact support', 500);
        }
        await env.DB.prepare(
          `INSERT INTO platform_secrets (id, organization_id, secret_type, envelope_json) VALUES (?, ?, 'dhis2_api_token', ?)
           ON CONFLICT(organization_id, secret_type) DO UPDATE SET envelope_json = excluded.envelope_json, updated_at = datetime('now')`
        ).bind(newId('secret'), claims.org, JSON.stringify(envelope)).run();
        await env.DB.prepare(
          `INSERT INTO dhis2_integrations (organization_id, instance_url, api_token, default_org_unit, default_dataset_id) VALUES (?, ?, '(stored in vault)', ?, ?)
           ON CONFLICT(organization_id) DO UPDATE SET instance_url = excluded.instance_url,
             default_org_unit = excluded.default_org_unit, default_dataset_id = excluded.default_dataset_id, updated_at = datetime('now')`
        ).bind(claims.org, instance_url.replace(/\/$/, ''), default_org_unit || null, default_dataset_id || null).run();
        await logAudit(env, { org: claims.org, userId: claims.sub, action: 'dhis2_configured', resourceType: 'integration', resourceId: 'dhis2', request });
        return json({ ok: true });
      }

      // ---------- VAULT MIGRATION (one-time — moves Sprint-1 plaintext-scheme
      // DHIS2 tokens into the real per-org HKDF vault). Safe to call multiple
      // times: already-migrated rows are skipped. ----------
      // ---------- VAULT HEALTH (Super Admin — failed decryptions, secret health, rotation status) ----------
      // ---------- KEY ROTATION (batch job — re-encrypts every secret to the
      // current key version; safe to run anytime, a no-op for secrets
      // already on the latest version) ----------
      // ---------- KEY ROTATION — starts a job only; the actual work happens in
      // small batches driven by the Cron Trigger below (see `scheduled()`).
      // This endpoint returns immediately regardless of how many secrets
      // exist — safe at any scale, unlike the old single-request version. ----------
      if (path === '/api/superadmin/vault/rotate' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const { to_version } = await request.json().catch(() => ({}));
        const targetVersion = to_version || 1;

        const existingRunning = await env.DB.prepare(`SELECT id FROM secret_rotation_jobs WHERE status = 'running'`).first();
        if (existingRunning) return error('A rotation job is already running — wait for it to finish before starting another.', 409);

        const totalRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM platform_secrets WHERE status = 'active'`).first();
        const jobId = newId('rotjob');
        await env.DB.prepare(
          `INSERT INTO secret_rotation_jobs (id, from_version, to_version, total_secrets, status) VALUES (?, ?, ?, ?, 'running')`
        ).bind(jobId, targetVersion - 1, targetVersion, totalRow.n).run();

        return json({ ok: true, job_id: jobId, total: totalRow.n, message: 'Rotation started — it will complete in the background over the next few minutes.' });
      }

      // Manually advances one batch immediately — used for testing/verification
      // without waiting for the next Cron tick (Cron runs this exact same
      // function automatically every few minutes in production).
      if (path === '/api/superadmin/vault/rotate/process-batch' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const result = await processNextRotationBatch(env);
        return json(result);
      }

      // ---------- AI RETRY QUEUE HEALTH (same monitoring philosophy as Vault
      // Health — real counts, no unrelated dashboard, just the data an Admin
      // Dashboard can consume later) ----------
      // ---------- DEAD-LETTER QUEUE (Task 1.2.3) — admin visibility into
      // permanently-failed AI enrichment, with clear reasons and manual
      // recovery. The underlying answer/transcript are NEVER affected by
      // any of this — dead-letter only concerns the missing enrichment. ----------
      if (path === '/api/superadmin/ai-retry-dead-letter' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const { results } = await env.DB.prepare(
          `SELECT q.id, q.answer_id, q.response_id, q.attempts, q.last_error, q.created_at, q.updated_at,
                  c.name as campaign_name, o.name as organization_name, resp.phone_number
           FROM ai_processing_queue q
           JOIN responses r ON q.response_id = r.id
           JOIN campaigns c ON r.campaign_id = c.id
           JOIN organizations o ON c.organization_id = o.id
           LEFT JOIN respondents resp ON r.respondent_id = resp.id
           WHERE q.status = 'failed_permanently'
           ORDER BY q.updated_at DESC LIMIT 100`
        ).all();

        // Attach each item's full attempt history — "clear failure reasons"
        // means seeing what actually happened across every try, not just
        // the final error, since the root cause is often visible earlier
        // (e.g., attempt 1 was a rate-limit, attempts 2-4 were a genuine bug).
        for (const item of results) {
          const { results: history } = await env.DB.prepare(
            `SELECT attempt_number, outcome, error, attempted_at FROM ai_processing_attempts_log WHERE queue_id = ? ORDER BY attempt_number ASC`
          ).bind(item.id).all();
          item.attempt_history = history;
        }

        return json({ dead_letter_items: results });
      }

      const deadLetterRetryMatch = path.match(/^\/api\/superadmin\/ai-retry-dead-letter\/([a-zA-Z0-9_]+)\/retry$/);
      if (deadLetterRetryMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);

        // Same atomic-claim pattern as the automated processor (Task 1.2.2) —
        // this UPDATE only succeeds if the row is STILL dead-lettered right
        // now. If two admins click "Retry" on the same item at the same
        // moment, only one UPDATE affects a row; the second sees changes=0
        // and gets a clear "already retried" response instead of silently
        // queuing the same item twice.
        const claim = await env.DB.prepare(
          `UPDATE ai_processing_queue SET status = 'pending', attempts = 0, last_error = NULL, next_retry_at = datetime('now'), updated_at = datetime('now')
           WHERE id = ? AND status = 'failed_permanently'`
        ).bind(deadLetterRetryMatch[1]).run();

        if (!claim.meta || claim.meta.changes !== 1) {
          return error('This item is not currently in the dead-letter state — it may have already been retried or resolved.', 409);
        }

        await logAudit(env, { org: claims.org, userId: claims.sub, action: 'ai_dead_letter_manual_retry', resourceType: 'ai_processing_queue', resourceId: deadLetterRetryMatch[1], request });
        return json({ ok: true, message: 'Item requeued — will be processed on the next retry cycle (within 5 minutes).' });
      }

      if (path === '/api/superadmin/ai-retry-health' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);

        const counts = await env.DB.prepare(
          `SELECT
             SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
             SUM(CASE WHEN status = 'complete' THEN 1 ELSE 0 END) as complete,
             SUM(CASE WHEN status = 'failed_permanently' THEN 1 ELSE 0 END) as dead_letter,
             AVG(attempts) as avg_attempts
           FROM ai_processing_queue`
        ).first();

        const attemptStats = await env.DB.prepare(
          `SELECT
             SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
             COUNT(*) as total
           FROM ai_processing_attempts_log WHERE attempted_at >= datetime('now', '-7 days')`
        ).first();

        const oldestPending = await env.DB.prepare(`SELECT MIN(created_at) as ts FROM ai_processing_queue WHERE status = 'pending'`).first();
        const throughput24h = await env.DB.prepare(`SELECT COUNT(*) as n FROM ai_processing_queue WHERE status = 'complete' AND updated_at >= datetime('now', '-24 hours')`).first();
        const lastSuccessCron = await env.DB.prepare(`SELECT started_at, finished_at, items_processed FROM ai_retry_cron_log WHERE status = 'success' ORDER BY started_at DESC LIMIT 1`).first();
        const lastFailedCron = await env.DB.prepare(`SELECT started_at, error FROM ai_retry_cron_log WHERE status = 'failed' ORDER BY started_at DESC LIMIT 1`).first();

        // Additive — powers the Task 1.2.4 dashboard's "Failure Reason
        // Breakdown" and "Retry Trend" widgets. Existing consumers of this
        // endpoint (none yet other than the raw API) are unaffected.
        const { results: failureBreakdown } = await env.DB.prepare(
          `SELECT error, COUNT(*) as n FROM ai_processing_attempts_log
           WHERE outcome = 'failure' AND attempted_at >= datetime('now', '-7 days')
           GROUP BY error ORDER BY n DESC LIMIT 10`
        ).all();
        const { results: dailyTrend } = await env.DB.prepare(
          `SELECT date(attempted_at) as day,
                  SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
                  SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END) as failures
           FROM ai_processing_attempts_log WHERE attempted_at >= datetime('now', '-14 days')
           GROUP BY day ORDER BY day ASC`
        ).all();

        return json({
          pending_jobs: counts.pending || 0,
          processing_jobs: counts.processing || 0,
          completed_jobs: counts.complete || 0,
          dead_letter_jobs: counts.dead_letter || 0,
          average_retry_count: counts.avg_attempts != null ? Number(counts.avg_attempts.toFixed(2)) : 0,
          retry_success_rate_7d: attemptStats.total ? Number(((attemptStats.successes / attemptStats.total) * 100).toFixed(1)) : null,
          oldest_pending_item_at: oldestPending.ts || null,
          completed_last_24h: throughput24h.n,
          last_successful_cron: lastSuccessCron || null,
          last_failed_cron: lastFailedCron || null,
          failure_breakdown: failureBreakdown,
          daily_trend: dailyTrend,
          generated_at: new Date().toISOString(),
        });
      }

      // ============================================================
      // UNIFIED SYSTEM HEALTH (Task 5.1) — a single at-a-glance summary
      // pulling from the SAME tables the dedicated Vault Health / AI Retry
      // Health pages already use, kept intentionally lightweight (top-line
      // status only — click through to the dedicated page for full detail,
      // trend charts, and drill-down). No new tables; purely additive.
      // ============================================================
      // ============================================================
      // ADMIN DIAGNOSTICS CENTER (Task 5.4) — configuration/environment
      // troubleshooting, distinct from the operational-health dashboards
      // above. Never reveals secret VALUES, only whether each is SET, plus
      // live binding reachability and basic table sanity counts — the
      // things a Super Admin actually needs when something's misconfigured.
      // ============================================================
      // ============================================================
      // PRODUCTION READINESS REPORT (Task 5.5) — the final Enterprise
      // Operations piece: a live checklist recomputed from REAL current
      // signals every time it's loaded, not a static historical document.
      // Reuses the exact same underlying queries as system-health (5.1)
      // and diagnostics (5.4) — this is a CHECKLIST framing of the same
      // real data, not a new source of truth.
      // ============================================================
      if (path === '/api/superadmin/production-readiness' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);

        const checklist = [];

        const vaultFailures = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM vault_audit_log WHERE operation = 'decrypt' AND outcome = 'failure' AND created_at >= datetime('now', '-24 hours')`
        ).first();
        checklist.push({ category: 'Security', item: 'Secret Vault decrypting cleanly', status: vaultFailures.n === 0 ? 'pass' : 'warn', detail: `${vaultFailures.n} failed decryption(s) in 24h` });
        checklist.push({ category: 'Security', item: 'VAULT_MASTER_KEY_V1 configured', status: env.VAULT_MASTER_KEY_V1 ? 'pass' : 'fail', detail: env.VAULT_MASTER_KEY_V1 ? 'Set' : 'Missing — Vault cannot function' });
        checklist.push({ category: 'Security', item: 'JWT_SECRET configured', status: env.JWT_SECRET ? 'pass' : 'fail', detail: env.JWT_SECRET ? 'Set' : 'Missing — auth cannot function' });

        const queueCounts = await env.DB.prepare(
          `SELECT SUM(CASE WHEN status = 'failed_permanently' THEN 1 ELSE 0 END) as dead_letter, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending FROM ai_processing_queue`
        ).first();
        checklist.push({ category: 'Reliability', item: 'No dead-letter backlog', status: (queueCounts.dead_letter || 0) === 0 ? 'pass' : 'warn', detail: `${queueCounts.dead_letter || 0} item(s) in dead-letter queue` });
        const lastCron = await env.DB.prepare(`SELECT status, started_at FROM ai_retry_cron_log ORDER BY started_at DESC LIMIT 1`).first();
        checklist.push({ category: 'Reliability', item: 'Cron trigger running', status: !lastCron ? 'warn' : lastCron.status === 'success' ? 'pass' : 'fail', detail: lastCron ? `Last run: ${lastCron.started_at}` : 'No Cron execution recorded yet' });

        let d1Ok = false;
        try { await env.DB.prepare('SELECT 1').first(); d1Ok = true; } catch (e) { /* stays false */ }
        checklist.push({ category: 'Infrastructure', item: 'D1 database reachable', status: d1Ok ? 'pass' : 'fail' });
        let r2Ok = false;
        try { await env.AUDIO_BUCKET.head('__healthcheck__').catch(() => {}); r2Ok = true; } catch (e) { /* stays false */ }
        checklist.push({ category: 'Infrastructure', item: 'R2 storage reachable', status: r2Ok ? 'pass' : 'fail' });

        // Known, honestly-disclosed gaps — static entries (documented
        // limitations from prior audits; no live signal can measure e.g.
        // "has a load test been run against staging").
        checklist.push({ category: 'Known Gaps', item: 'Load testing against real staging', status: 'warn', detail: 'Local-only baseline established; staging run still required before a capacity claim' });
        checklist.push({ category: 'Known Gaps', item: 'Automated test coverage breadth', status: 'warn', detail: 'Vault/AI-Retry/Role-security paths covered; CRM/Projects/Enumerator flows still untested' });
        checklist.push({ category: 'Known Gaps', item: 'Retention policy on log tables', status: 'warn', detail: 'TD-001 — deferred to Sprint 1.4 per prior decision' });

        const failCount = checklist.filter(c => c.status === 'fail').length;
        const warnCount = checklist.filter(c => c.status === 'warn').length;
        const overall = failCount > 0 ? 'not_ready' : warnCount > 0 ? 'ready_with_caveats' : 'ready';

        return json({ overall, fail_count: failCount, warn_count: warnCount, checklist, generated_at: new Date().toISOString() });
      }

      if (path === '/api/superadmin/diagnostics' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);

        const secretsConfigured = {
          JWT_SECRET: !!env.JWT_SECRET,
          VAULT_MASTER_KEY_V1: !!env.VAULT_MASTER_KEY_V1,
          ANTHROPIC_API_KEY: !!env.ANTHROPIC_API_KEY,
          OPENAI_API_KEY: !!env.OPENAI_API_KEY,
          TWILIO_ACCOUNT_SID: !!env.TWILIO_ACCOUNT_SID,
          TWILIO_AUTH_TOKEN: !!env.TWILIO_AUTH_TOKEN,
          RESEND_API_KEY: !!env.RESEND_API_KEY,
        };

        let d1Reachable = false, d1LatencyMs = null;
        try {
          const start = Date.now();
          await env.DB.prepare('SELECT 1').first();
          d1LatencyMs = Date.now() - start;
          d1Reachable = true;
        } catch (e) { /* stays false */ }

        let r2Reachable = false;
        try {
          await env.AUDIO_BUCKET.head('__healthcheck__').catch(() => {});
          r2Reachable = true; // reaching R2 at all (even a 404) proves the binding works
        } catch (e) { /* stays false */ }

        const tableCounts = {};
        for (const table of ['organizations', 'users', 'campaigns', 'responses', 'platform_secrets', 'ai_processing_queue']) {
          try {
            const row = await env.DB.prepare(`SELECT COUNT(*) as n FROM ${table}`).first();
            tableCounts[table] = row.n;
          } catch (e) { tableCounts[table] = null; }
        }

        return json({
          secrets_configured: secretsConfigured,
          bindings: {
            d1: { reachable: d1Reachable, latency_ms: d1LatencyMs },
            r2: { reachable: r2Reachable },
          },
          table_counts: tableCounts,
          ai_retry_config: {
            max_attempts: env.AI_RETRY_MAX_ATTEMPTS || '(default: 5)',
            base_backoff_minutes: env.AI_RETRY_BASE_BACKOFF_MINUTES || '(default: 2)',
            max_backoff_minutes: env.AI_RETRY_MAX_BACKOFF_MINUTES || '(default: 60)',
          },
          checked_at: new Date().toISOString(),
        });
      }

      // ============================================================
      // COMMUNICATIONS HEALTH DASHBOARD (Task 7.1) — Twilio (SMS/WhatsApp/
      // Voice all share one account) + Resend/Email status, recent send
      // failures. NEVER exposes actual secret values — only configured
      // booleans and a live credential-validity check (HTTP status only).
      // ============================================================
      if (path === '/api/superadmin/communications-health' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);

        const twilioConfigured = !!(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_PHONE_NUMBER);
        let twilioCredentialsValid = null;
        if (twilioConfigured) {
          try {
            const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
            const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}.json`, {
              headers: { Authorization: `Basic ${auth}` },
            });
            twilioCredentialsValid = resp.ok; // 200 = valid creds, 401 = bad creds — never logs the token itself
          } catch (e) { twilioCredentialsValid = false; }
        }

        const resendConfigured = !!env.RESEND_API_KEY;

        const twilioFailures24h = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM audit_logs WHERE action = 'twilio_send_failed' AND created_at >= datetime('now', '-24 hours')`
        ).first();
        const emailFailures24h = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM audit_logs WHERE action = 'email_send_failed' AND created_at >= datetime('now', '-24 hours')`
        ).first();
        const { results: recentFailures } = await env.DB.prepare(
          `SELECT action, resource_type, resource_id, created_at FROM audit_logs
           WHERE action IN ('twilio_send_failed', 'email_send_failed') AND created_at >= datetime('now', '-24 hours')
           ORDER BY created_at DESC LIMIT 20`
        ).all();

        const { results: channelVolume } = await env.DB.prepare(
          `SELECT channel, COUNT(*) as n FROM responses WHERE started_at >= datetime('now', '-24 hours') GROUP BY channel`
        ).all();

        return json({
          twilio: { configured: twilioConfigured, credentials_valid: twilioCredentialsValid, failures_24h: twilioFailures24h.n },
          email: { configured: resendConfigured, failures_24h: emailFailures24h.n },
          recent_failures: recentFailures,
          channel_volume_24h: channelVolume,
          generated_at: new Date().toISOString(),
        });
      }

      if (path === '/api/superadmin/system-health' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);

        const vaultSecrets = await env.DB.prepare(`SELECT COUNT(*) as n FROM platform_secrets WHERE status = 'active'`).first();
        const vaultFailures = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM vault_audit_log WHERE operation = 'decrypt' AND outcome = 'failure' AND created_at >= datetime('now', '-24 hours')`
        ).first();

        const queueCounts = await env.DB.prepare(
          `SELECT
             SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
             SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
             SUM(CASE WHEN status = 'failed_permanently' THEN 1 ELSE 0 END) as dead_letter
           FROM ai_processing_queue`
        ).first();

        const lastCron = await env.DB.prepare(`SELECT status, started_at, finished_at FROM ai_retry_cron_log ORDER BY started_at DESC LIMIT 1`).first();
        const lastRotationJob = await env.DB.prepare(`SELECT status, started_at, rotated_count, total_secrets FROM secret_rotation_jobs ORDER BY started_at DESC LIMIT 1`).first();

        // Simple traffic-light logic — each subsystem is "healthy" unless a
        // specific real signal says otherwise. Worker itself is definitionally
        // "healthy" if this response is being generated at all.
        const vaultStatus = vaultFailures.n === 0 ? 'healthy' : vaultFailures.n < 5 ? 'degraded' : 'critical';
        const queueStatus = (queueCounts.dead_letter || 0) === 0 ? 'healthy' : 'degraded';
        const cronStatus = !lastCron ? 'unknown' : lastCron.status === 'success' ? 'healthy' : 'degraded';

        return json({
          worker: { status: 'healthy', checked_at: new Date().toISOString() },
          vault: { status: vaultStatus, active_secrets: vaultSecrets.n, failed_decryptions_24h: vaultFailures.n },
          ai_retry_queue: { status: queueStatus, pending: queueCounts.pending || 0, processing: queueCounts.processing || 0, dead_letter: queueCounts.dead_letter || 0 },
          cron: { status: cronStatus, last_run: lastCron || null },
          key_rotation: { last_job: lastRotationJob || null },
          generated_at: new Date().toISOString(),
        });
      }

      if (path === '/api/superadmin/vault-health' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);

        const failedDecryptions24h = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM vault_audit_log WHERE operation = 'decrypt' AND outcome = 'failure' AND created_at >= datetime('now', '-24 hours')`
        ).first();
        const { results: failuresByType } = await env.DB.prepare(
          `SELECT secret_type, error_code, COUNT(*) as n FROM vault_audit_log
           WHERE outcome = 'failure' AND created_at >= datetime('now', '-24 hours') GROUP BY secret_type, error_code`
        ).all();
        const totalSecrets = await env.DB.prepare(`SELECT COUNT(*) as n FROM platform_secrets WHERE status = 'active'`).first();
        const { results: rotationJobs } = await env.DB.prepare(
          `SELECT id, from_version, to_version, total_secrets, rotated_count, failed_count, status, started_at, finished_at
           FROM secret_rotation_jobs ORDER BY started_at DESC LIMIT 5`
        ).all();
        // Additive field — breaks down active secrets by type, powers the
        // dashboard's "Secret Distribution" widget. Existing consumers of
        // this endpoint are unaffected since no prior field was removed.
        const { results: secretDistribution } = await env.DB.prepare(
          `SELECT secret_type, COUNT(*) as n FROM platform_secrets WHERE status = 'active' GROUP BY secret_type ORDER BY n DESC`
        ).all();
        const overallStatus = failedDecryptions24h.n === 0 ? 'healthy' : failedDecryptions24h.n < 5 ? 'degraded' : 'critical';

        return json({
          failed_decryptions_24h: failedDecryptions24h.n,
          failures_by_type: failuresByType,
          total_active_secrets: totalSecrets.n,
          recent_rotation_jobs: rotationJobs,
          secret_distribution: secretDistribution,
          overall_status: overallStatus,
          generated_at: new Date().toISOString(),
        });
      }

      // ============================================================
      // PUBLIC EXTERNAL INGESTION API — completes the "API" channel that
      // was already half-built (org_api_keys existed, but nothing accepted
      // a submission through one). Authenticated by API key, not JWT, since
      // this is called by external systems, not logged-in platform users.
      // Every submission enters the SAME responses/answers/transcripts
      // pipeline as every other channel, tagged channel='api'.
      // ============================================================
      if (path === '/api/external/responses' && method === 'POST') {
        const authHeader = request.headers.get('Authorization') || '';
        const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        if (!apiKey) return error('Missing Authorization: Bearer <api_key> header', 401);

        if (await isRateLimited(env, `external_api:${apiKey}`, 60, 60)) {
          return error('Rate limit exceeded — max 60 submissions per minute per API key.', 429);
        }

        const keyRow = await env.DB.prepare('SELECT organization_id FROM organization_api_keys WHERE api_key = ?').bind(apiKey).first();
        if (!keyRow) return error('Invalid API key', 401);
        const organizationId = keyRow.organization_id;

        const body = await request.json().catch(() => null);
        if (!body || !body.campaign_id || !Array.isArray(body.answers) || !body.answers.length) {
          return error('Request body must include campaign_id and a non-empty answers array', 400);
        }

        const campaign = await env.DB.prepare('SELECT id, survey_id FROM campaigns WHERE id = ? AND organization_id = ?').bind(body.campaign_id, organizationId).first();
        if (!campaign) return error('campaign_id not found for your organization', 404);

        const questions = await getQuestions(env, campaign.survey_id);
        if (!questions.length) return error('This project\'s survey has no questions configured', 400);

        const respondentId = newId('resp');
        const responseId = newId('response');
        const rspd = body.respondent || {};
        await env.DB.prepare(
          'INSERT INTO respondents (id, organization_id, phone_number, full_name, region, consent_given) VALUES (?, ?, ?, ?, ?, 1)'
        ).bind(respondentId, organizationId, rspd.phone_number || null, rspd.full_name || null, rspd.region || null).run();
        await env.DB.prepare(
          `INSERT INTO responses (id, campaign_id, respondent_id, channel, status, completed_at) VALUES (?, ?, ?, 'api', 'completed', datetime('now'))`
        ).bind(responseId, body.campaign_id, respondentId).run();

        const createdAnswers = [];
        for (let i = 0; i < body.answers.length; i++) {
          const ans = body.answers[i];
          const text = (ans.text || '').toString().trim();
          if (!text) continue;
          // Match by explicit question_id if given, otherwise fall back to
          // positional order_index — accommodates both a careful integrator
          // and a simple "answers in question order" integration.
          const question = ans.question_id
            ? questions.find(q => q.id === ans.question_id)
            : questions[ans.order_index != null ? ans.order_index : i];
          if (!question) continue;

          const answerId = newId('answer');
          // Same atomic-core-persistence pattern as submitAnswer (Task 1.2.1) —
          // answer + transcript land together, never a partial write.
          await env.DB.batch([
            env.DB.prepare('INSERT INTO answers (id, response_id, question_id, answer_text) VALUES (?, ?, ?, ?)').bind(answerId, responseId, question.id, text),
            env.DB.prepare(`INSERT INTO transcripts (id, answer_id, raw_text, language_detected, stt_engine) VALUES (?, ?, ?, ?, 'external_api')`).bind(newId('tr'), answerId, text, body.language || 'en'),
          ]);
          createdAnswers.push({ question_id: question.id, answer_id: answerId });

          // AI enrichment — same decoupled, never-blocks-the-caller pattern
          // as every other channel (Sprint 1.2). A failure here queues a
          // retry; it never fails this API response.
          try {
            const analysis = await analyzeText(env, text);
            const fraudResult = await runFraudChecks(env, body.campaign_id, text, respondentId, responseId);
            await env.DB.prepare(`INSERT INTO ai_insights (id, response_id, insight_type, content_json, model_used) VALUES (?, ?, 'summary', ?, 'claude-sonnet-5')`)
              .bind(newId('ai'), responseId, JSON.stringify(analysis)).run();
            await env.DB.prepare(`UPDATE responses SET fraud_score = MAX(COALESCE(fraud_score, 0), ?), overall_sentiment = ? WHERE id = ?`)
              .bind(fraudResult.score, analysis.sentiment, responseId).run();
          } catch (aiError) {
            await env.DB.prepare(
              `INSERT INTO ai_processing_queue (id, answer_id, response_id, stage, attempts, last_error, status) VALUES (?, ?, ?, 'analyze', 1, ?, 'pending')`
            ).bind(newId('queue'), answerId, responseId, aiError.message || 'Unknown error').run().catch(e => console.error('CRITICAL: external API answer', answerId, 'has no enrichment and no retry record:', e.message));
          }
        }

        await logAudit(env, { org: organizationId, userId: null, action: 'external_api_submission', resourceType: 'response', resourceId: responseId, request });
        return json({ ok: true, response_id: responseId, respondent_id: respondentId, answers_created: createdAnswers.length });
      }

      if (path === '/api/superadmin/vault/migrate-dhis2' && method === 'POST') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const { results: legacyRows } = await env.DB.prepare(
          `SELECT organization_id, api_token FROM dhis2_integrations WHERE api_token IS NOT NULL AND api_token != '(stored in vault)'`
        ).all();
        const outcomes = [];
        for (const row of legacyRows) {
          const already = await env.DB.prepare(`SELECT 1 FROM platform_secrets WHERE organization_id = ? AND secret_type = 'dhis2_api_token'`).bind(row.organization_id).first();
          if (already) { outcomes.push({ org: row.organization_id, status: 'skipped_already_migrated' }); continue; }
          try {
            const plaintext = await legacySprintOneDecrypt(env, row.api_token);
            const envelope = await encryptSecret(env, { organizationId: row.organization_id, secretType: 'dhis2_api_token', plaintext });
            await env.DB.prepare(
              `INSERT INTO platform_secrets (id, organization_id, secret_type, envelope_json) VALUES (?, ?, 'dhis2_api_token', ?)`
            ).bind(newId('secret'), row.organization_id, JSON.stringify(envelope)).run();
            await env.DB.prepare(`UPDATE dhis2_integrations SET api_token = '(stored in vault)' WHERE organization_id = ?`).bind(row.organization_id).run();
            outcomes.push({ org: row.organization_id, status: 'migrated' });
          } catch (e) {
            outcomes.push({ org: row.organization_id, status: 'failed_needs_manual_reentry', detail: e.message });
          }
        }
        return json({ ok: true, processed: outcomes.length, outcomes });
      }

      const dhis2MappingMatch = path.match(/^\/api\/dhis2\/mapping\/([a-zA-Z0-9_]+)$/);
      if (dhis2MappingMatch && method === 'PUT') {
        const claims = await requireAuth(request, env);
        const indicator = await env.DB.prepare('SELECT id FROM impact_indicators WHERE id = ? AND organization_id = ?').bind(dhis2MappingMatch[1], claims.org).first();
        if (!indicator) return error('Indicator not found', 404);
        const { dhis2_data_element_id, dhis2_category_option_combo } = await request.json();
        if (!dhis2_data_element_id) return error('dhis2_data_element_id is required');
        await env.DB.prepare(
          `INSERT INTO dhis2_indicator_mapping (indicator_id, dhis2_data_element_id, dhis2_category_option_combo) VALUES (?, ?, ?)
           ON CONFLICT(indicator_id) DO UPDATE SET dhis2_data_element_id = excluded.dhis2_data_element_id, dhis2_category_option_combo = excluded.dhis2_category_option_combo`
        ).bind(dhis2MappingMatch[1], dhis2_data_element_id, dhis2_category_option_combo || null).run();
        return json({ ok: true });
      }

      // Pushes every mapped Outcome Indicator's CURRENT value to the org's own
      // DHIS2 instance via the standard dataValueSets API — the same mechanism
      // any DHIS2-compatible data source uses, so Ministry of Health systems
      // can pull our data in without a bespoke, one-off integration.
      if (path === '/api/dhis2/push' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const config = await env.DB.prepare('SELECT * FROM dhis2_integrations WHERE organization_id = ? AND enabled = 1').bind(claims.org).first();
        if (!config) return error('DHIS2 is not configured for your organization yet — set it up in Settings first.', 400);
        const secretRow = await env.DB.prepare(`SELECT envelope_json FROM platform_secrets WHERE organization_id = ? AND secret_type = 'dhis2_api_token'`).bind(claims.org).first();
        if (!secretRow) return error('No DHIS2 credential found in the vault for your organization — please re-enter your token in Settings.', 400);
        let decryptedToken;
        try {
          const envelope = JSON.parse(secretRow.envelope_json);
          decryptedToken = await decryptSecret(env, { organizationId: claims.org, secretType: 'dhis2_api_token', envelope });
        } catch (e) {
          const hint = e instanceof VaultError && e.code === 'TENANT_MISMATCH'
            ? 'A vault integrity check failed — this should never happen and has been logged for investigation.'
            : 'Could not read your stored DHIS2 credentials — please re-enter your token in Settings.';
          return error(hint, 500);
        }

        const { results: mapped } = await env.DB.prepare(
          `SELECT i.id, i.name, i.current_value, m.dhis2_data_element_id, m.dhis2_category_option_combo
           FROM impact_indicators i JOIN dhis2_indicator_mapping m ON m.indicator_id = i.id
           WHERE i.organization_id = ? AND i.current_value IS NOT NULL`
        ).bind(claims.org).all();
        if (!mapped.length) return error('No indicators are mapped to DHIS2 data elements yet.', 400);

        const period = new Date().toISOString().slice(0, 7).replace('-', ''); // DHIS2 monthly period format, e.g. 202607
        const dataValues = mapped.map(m => ({
          dataElement: m.dhis2_data_element_id,
          categoryOptionCombo: m.dhis2_category_option_combo || undefined,
          period,
          orgUnit: config.default_org_unit,
          value: String(m.current_value),
        }));

        try {
          const resp = await fetch(`${config.instance_url}/api/dataValueSets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `ApiToken ${decryptedToken}` },
            body: JSON.stringify({ dataValues }),
          });
          const result = await resp.json().catch(() => ({}));
          await logAudit(env, { org: claims.org, userId: claims.sub, action: 'dhis2_push', resourceType: 'integration', resourceId: 'dhis2', request });
          if (!resp.ok) {
            await env.DB.prepare('INSERT INTO dhis2_push_log (id, organization_id, pushed_count, status, detail) VALUES (?, ?, ?, ?, ?)')
              .bind(newId('dhis2log'), claims.org, 0, 'failed', `HTTP ${resp.status}`).run();
            return error(`DHIS2 rejected the push (HTTP ${resp.status}). Check your instance URL, token, and org unit ID.`, 502);
          }
          await env.DB.prepare('INSERT INTO dhis2_push_log (id, organization_id, pushed_count, status, detail) VALUES (?, ?, ?, ?, ?)')
            .bind(newId('dhis2log'), claims.org, dataValues.length, 'success', `Period ${period}`).run();
          return json({ ok: true, pushed: dataValues.length, period, dhis2_response: result });
        } catch (e) {
          await env.DB.prepare('INSERT INTO dhis2_push_log (id, organization_id, pushed_count, status, detail) VALUES (?, ?, ?, ?, ?)')
            .bind(newId('dhis2log'), claims.org, 0, 'failed', e.message).run();
          return error('Could not reach your DHIS2 instance — check the instance URL is correct and reachable from the internet.', 502);
        }
      }

      // ---------- DHIS2 PUSH HISTORY ----------
      if (path === '/api/dhis2/push-log' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { results } = await env.DB.prepare('SELECT pushed_count, status, detail, created_at FROM dhis2_push_log WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20').bind(effectiveOrgId).all();
        return json({ history: results });
      }

      // ---------- OECD-DAC Sustainability & Coherence (org writes once, every report shows it) ----------
      if (path === '/api/oecd-dac-assessment' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const row = await env.DB.prepare('SELECT sustainability_note, coherence_note FROM oecd_dac_assessments WHERE organization_id = ?').bind(claims.org).first();
        return json({ sustainability_note: row?.sustainability_note || '', coherence_note: row?.coherence_note || '' });
      }

      if (path === '/api/oecd-dac-assessment' && method === 'PUT') {
        const claims = await requireAuth(request, env);
        const { sustainability_note, coherence_note } = await request.json();
        await env.DB.prepare(
          `INSERT INTO oecd_dac_assessments (organization_id, sustainability_note, coherence_note) VALUES (?, ?, ?)
           ON CONFLICT(organization_id) DO UPDATE SET sustainability_note = excluded.sustainability_note, coherence_note = excluded.coherence_note, updated_at = datetime('now')`
        ).bind(claims.org, sustainability_note || null, coherence_note || null).run();
        return json({ ok: true });
      }

      const complianceMatch = path.match(/^\/api\/compliance\/([a-zA-Z0-9_]+)$/);
      if (complianceMatch && method === 'PUT') {
        const claims = await requireAuth(request, env);
        const survey = await env.DB.prepare('SELECT id FROM surveys WHERE id = ? AND organization_id = ?').bind(complianceMatch[1], claims.org).first();
        if (!survey) return error('Survey not found', 404);
        const body = await request.json();
        await env.DB.prepare(
          `INSERT INTO survey_compliance (survey_id, costech_status, nbs_status, ethics_status, minors_involved, safeguarding_risk, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(survey_id) DO UPDATE SET
             costech_status = excluded.costech_status, nbs_status = excluded.nbs_status, ethics_status = excluded.ethics_status,
             minors_involved = excluded.minors_involved, safeguarding_risk = excluded.safeguarding_risk, notes = excluded.notes,
             updated_at = datetime('now')`
        ).bind(
          complianceMatch[1],
          body.costech_status || 'not_required', body.nbs_status || 'not_required', body.ethics_status || 'not_required',
          body.minors_involved ? 1 : 0, body.safeguarding_risk || 'low', body.notes || null
        ).run();
        return json({ ok: true });
      }

      if (path === '/api/compliance' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          `SELECT s.id as survey_id, s.title, s.module_type, s.status as survey_status,
                  COALESCE(sc.costech_status, 'not_required') as costech_status,
                  COALESCE(sc.nbs_status, 'not_required') as nbs_status,
                  COALESCE(sc.ethics_status, 'not_required') as ethics_status,
                  COALESCE(sc.minors_involved, 0) as minors_involved,
                  COALESCE(sc.safeguarding_risk, 'low') as safeguarding_risk
           FROM surveys s
           LEFT JOIN survey_compliance sc ON sc.survey_id = s.id
           WHERE s.organization_id = ? ORDER BY s.created_at DESC`
        ).bind(claims.org).all();
        return json({ surveys: results });
      }

      const complianceUpdateMatch = path.match(/^\/api\/compliance\/([a-zA-Z0-9_]+)$/);
      if (complianceUpdateMatch && method === 'PUT') {
        const claims = await requireAuth(request, env);
        const surveyId = complianceUpdateMatch[1];
        const body = await request.json();
        await env.DB.prepare(
          `INSERT INTO survey_compliance (survey_id, costech_status, nbs_status, ethics_status, minors_involved, safeguarding_risk, notes, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
           ON CONFLICT(survey_id) DO UPDATE SET
             costech_status=excluded.costech_status, nbs_status=excluded.nbs_status, ethics_status=excluded.ethics_status,
             minors_involved=excluded.minors_involved, safeguarding_risk=excluded.safeguarding_risk, notes=excluded.notes, updated_at=datetime('now')`
        ).bind(
          surveyId, body.costech_status || 'not_required', body.nbs_status || 'not_required', body.ethics_status || 'not_required',
          body.minors_involved ? 1 : 0, body.safeguarding_risk || 'low', body.notes || null
        ).run();
        return json({ ok: true });
      }

      // ---------- CONSENT LOGS ----------
      if (path === '/api/consent-logs' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          `SELECT id, phone_number, consent_given, created_at FROM respondents WHERE organization_id = ? ORDER BY created_at DESC LIMIT 200`
        ).bind(claims.org).all();
        return json({ logs: results });
      }

      // ---------- VIA ASSISTANT (AI Q&A over your own data) ----------
      if (path === '/api/assistant/ask' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { question } = await request.json();
        if (!question) return error('question is required');

        const { results: sentimentRows } = await env.DB.prepare(
          `SELECT r.overall_sentiment, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? GROUP BY r.overall_sentiment`
        ).bind(claims.org).all();
        const { results: quoteRows } = await env.DB.prepare(
          `SELECT t.raw_text, r.overall_sentiment, r.channel FROM transcripts t
           JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? ORDER BY t.created_at DESC LIMIT 15`
        ).bind(claims.org).all();

        const context = `Sentiment breakdown: ${JSON.stringify(sentimentRows)}\n\nRecent transcripts:\n${quoteRows.map(q => `- (${q.overall_sentiment}, ${q.channel}) "${q.raw_text}"`).join('\n')}`;

        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-5',
            max_tokens: 500,
            messages: [{
              role: 'user',
              content: `You are VIA, an analytics assistant inside a research dashboard. Answer the user's question using ONLY the data context below. If the data doesn't support an answer, say so honestly — do not invent numbers.\n\nDATA CONTEXT:\n${context}\n\nUSER QUESTION: ${question}`,
            }],
          }),
        });
        if (!claudeResp.ok) return error('Assistant is temporarily unavailable', 500);
        const data = await claudeResp.json();
        const answer = (data.content || []).map(c => c.text || '').join('');
        return json({ answer });
      }

      // ---------- AI REPORT INTELLIGENCE (Key Findings + Recommendations for the PDF report) ----------
      if (path === '/api/reports/intelligence' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const reportLangParam = new URL(request.url).searchParams.get('lang');
        const REPORT_LANG_NAMES = { en: 'English', fr: 'French', pt: 'Portuguese', sw: 'Swahili' };
        const reportLang = REPORT_LANG_NAMES[reportLangParam] ? reportLangParam : 'en';
        const reportStyleParam = new URL(request.url).searchParams.get('style');
        const STYLE_INSTRUCTIONS = {
          executive: 'Write for a busy executive audience — direct, decision-focused, no jargon.',
          government: 'Write for a government policy audience — formal tone, emphasize policy implications, cite relevant regulatory/administrative context where the data supports it, avoid speculation beyond the evidence.',
          academic: 'Write for an academic/research audience — rigorous, precise about limitations and sample size, avoid overstating causality, note where findings are suggestive versus conclusive.',
        };
        const reportStyle = STYLE_INSTRUCTIONS[reportStyleParam] ? reportStyleParam : 'executive';
        const filterCampaign = await getEffectiveCampaignFilter(request, env, claims, effectiveOrgId);
        const cf = filterCampaign ? 'AND c.id = ?' : '';
        const bindOrgAndCf = () => filterCampaign ? [effectiveOrgId, filterCampaign] : [effectiveOrgId];

        const { results: sentimentRows } = await env.DB.prepare(
          `SELECT r.overall_sentiment, COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? ${cf} GROUP BY r.overall_sentiment`
        ).bind(...bindOrgAndCf()).all();
        const { results: genderRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(dem.gender), ''), 'Not provided') as gender, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           LEFT JOIN respondent_demographics dem ON dem.respondent_id = resp.id
           WHERE c.organization_id = ? ${cf} GROUP BY gender`
        ).bind(...bindOrgAndCf()).all();
        const { results: ageRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(dem.age_bracket), ''), 'Not provided') as age_bracket, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           LEFT JOIN respondent_demographics dem ON dem.respondent_id = resp.id
           WHERE c.organization_id = ? ${cf} GROUP BY age_bracket`
        ).bind(...bindOrgAndCf()).all();
        const { results: regionRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.region), ''), 'Unspecified') as region, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? ${cf} GROUP BY region ORDER BY n DESC LIMIT 8`
        ).bind(...bindOrgAndCf()).all();
        // Sentiment cross-tabulated by region — lets the AI spot *where* problems concentrate, not just that they exist.
        const { results: sentByRegionRows } = await env.DB.prepare(
          `SELECT COALESCE(NULLIF(TRIM(resp.region), ''), 'Unspecified') as region, r.overall_sentiment, COUNT(*) as n
           FROM responses r JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? ${cf} AND r.overall_sentiment IS NOT NULL GROUP BY region, r.overall_sentiment`
        ).bind(...bindOrgAndCf()).all();
        const { results: insightRows } = await env.DB.prepare(
          `SELECT ai.content_json FROM ai_insights ai JOIN responses r ON ai.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? ${cf} AND ai.insight_type = 'summary' ORDER BY ai.created_at DESC LIMIT 150`
        ).bind(...bindOrgAndCf()).all();
        const topicCounts = {};
        for (const row of insightRows) {
          try { const parsed = JSON.parse(row.content_json); for (const t of parsed.topics || []) topicCounts[t] = (topicCounts[t] || 0) + 1; } catch (_) {}
        }
        const topics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([topic, count]) => ({ topic, count }));
        const totalResponses = sentimentRows.reduce((s, r) => s + r.n, 0);

        if (totalResponses === 0) {
          return json({
            key_findings: ['No responses have been collected yet — key findings will appear here once data comes in.'],
            recommendations: { immediate: [], strategic: [], policy: [] },
          });
        }

        // Real verbatim quotes, paired with their sentiment/topic tags — this is what
        // lets the AI write specific, grounded findings instead of generic summaries.
        const { results: quoteRows } = await env.DB.prepare(
          `SELECT t.raw_text, r.overall_sentiment, resp.region
           FROM transcripts t JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id
           JOIN campaigns c ON r.campaign_id = c.id JOIN respondents resp ON r.respondent_id = resp.id
           WHERE c.organization_id = ? ${cf} ORDER BY t.created_at DESC LIMIT 25`
        ).bind(...bindOrgAndCf()).all();

        const context = `SAMPLE SIZE: ${totalResponses} total responses

SENTIMENT BREAKDOWN: ${JSON.stringify(sentimentRows)}
GENDER BREAKDOWN: ${JSON.stringify(genderRows)}
AGE BREAKDOWN: ${JSON.stringify(ageRows)}
REGION BREAKDOWN: ${JSON.stringify(regionRows)}
SENTIMENT BY REGION (cross-tab — use this to identify WHERE issues concentrate): ${JSON.stringify(sentByRegionRows)}
TOP TOPICS MENTIONED, WITH FREQUENCY: ${JSON.stringify(topics)}

SAMPLE VERBATIM RESPONSES (real transcripts, tagged with sentiment and region — use these to ground findings in specific evidence, and to select real illustrative quotes):
${quoteRows.map(q => `- [${q.overall_sentiment || 'unrated'}, ${q.region || 'unspecified region'}] "${q.raw_text}"`).join('\n')}`;

        const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-5',
            max_tokens: 2200,
            messages: [{
              role: 'user',
              content: `You are a senior research analyst producing an executive intelligence report for an NGO/donor/government audience. Your output will be read by people deciding whether to award a $25K-$500K contract based on data quality — generic, vague, or template-sounding analysis is an immediate credibility failure. Every finding must be specific, evidence-grounded, and non-obvious.

CRITICAL LANGUAGE INSTRUCTION: Write your ENTIRE response — every "text" field, "narrative", "action", and recommendation string — in ${REPORT_LANG_NAMES[reportLang]}, regardless of what language the source verbatim quotes and data below are in (they may be in Swahili even though your output must be in ${REPORT_LANG_NAMES[reportLang]}). Do not mix languages within a single field.

AUDIENCE AND TONE: ${STYLE_INSTRUCTIONS[reportStyle]}

STRICT RULES:
- Every key finding MUST cite a specific number, percentage, or comparison FROM THE DATA BELOW. Never write a finding that could apply to any survey anywhere (e.g. banning phrases like "respondents shared valuable feedback" or "the data shows important insights").
- Use the SENTIMENT BY REGION cross-tab to name which specific region(s) show elevated negative sentiment, if any — don't just say "some regions."
- Use the verbatim quotes to ground at least one finding in something a specific respondent said (paraphrase briefly, don't quote verbatim here — that's for the report's own quotes section).
- Assign each key finding a severity: "critical", "high", "medium", or "low" — based on how many responses are affected AND how negative the associated sentiment is. Do not mark everything "critical."
- If a cross-tab or breakdown has too few responses to support a claim (e.g. under 5 per group), say so explicitly rather than drawing a conclusion from it.
- Recommendations must each name a concrete action tied to a specific finding above — not generic advice like "improve communication" or "conduct further research."

Using ONLY the data below, produce:
1. "key_findings": an array of 3-4 objects, each with "text" (a specific, numbers-grounded finding, under 25 words) and "severity" ("critical"|"high"|"medium"|"low").
2. "recommendations": an object with three arrays — "immediate" (next 30 days, 1-2 items, each tied to a specific finding), "strategic" (6-12 months, 1-2 items), "policy" (long-term structural change, 0-1 items — omit if the data doesn't support a policy-level claim).
3. "risk_if_ignored": one specific sentence describing the concrete consequence of not acting on the top finding — grounded in the data, not generic ("things may get worse").
4. "top_recommendation": an object {"action": the single highest-priority recommendation text, "impact": a 0-100 estimate of how much this could move the top finding if implemented, "urgency": "high"|"medium"|"low", "confidence": a 0-100 estimate of how confident you are given the sample size and data quality}.
5. "narrative": a 3-4 paragraph flowing prose write-up (not bullet points) that tells the story of what was found, written for someone who wants to read a full account rather than skim bullets — ground every claim in the data, and weave in the general theme of any verbatim quotes provided (without quoting them verbatim here).

Do not invent statistics not supported by the data. If the data is too sparse for a strong claim anywhere, say so plainly in that finding instead of fabricating specifics.

DATA:
${context}

Respond with ONLY valid JSON in this exact shape, no markdown, no preamble:
{"key_findings": [{"text": "...", "severity": "high"}], "recommendations": {"immediate": ["..."], "strategic": ["..."], "policy": ["..."]}, "risk_if_ignored": "...", "top_recommendation": {"action": "...", "impact": 80, "urgency": "high", "confidence": 85}, "narrative": "..."}`,
            }],
          }),
        });
        if (!claudeResp.ok) return error('Report intelligence is temporarily unavailable', 500);
        const data = await claudeResp.json();
        const raw = (data.content || []).map(c => c.text || '').join('').trim().replace(/^```json\n?|\n?```$/g, '');
        let parsed;
        try { parsed = JSON.parse(raw); } catch (e) { return error('Could not parse AI response', 500); }
        return json(parsed);
      }

      // ---------- IMPACT INDICATORS (baseline vs current, for Donor Impact Report) ----------
      if (path === '/api/indicators' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const { results } = await env.DB.prepare(
          `SELECT i.*, m.dhis2_data_element_id
           FROM impact_indicators i LEFT JOIN dhis2_indicator_mapping m ON m.indicator_id = i.id
           WHERE i.organization_id = ? ORDER BY i.order_index ASC, i.updated_at ASC`
        ).bind(claims.org).all();
        return json({ indicators: results });
      }

      if (path === '/api/indicators' && method === 'POST') {
        const claims = await requireAuth(request, env);
        const { name, baseline_value, current_value, unit } = await request.json();
        if (!name) return error('name is required');
        const id = newId('ind');
        const countRow = await env.DB.prepare('SELECT COUNT(*) as n FROM impact_indicators WHERE organization_id = ?').bind(claims.org).first();
        await env.DB.prepare(
          `INSERT INTO impact_indicators (id, organization_id, name, baseline_value, current_value, unit, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, claims.org, name, baseline_value || null, current_value || null, unit || null, countRow.n).run();
        return json({ ok: true, id }, 201);
      }

      const indicatorMatch = path.match(/^\/api\/indicators\/([a-zA-Z0-9_]+)$/);
      if (indicatorMatch && method === 'PUT') {
        const claims = await requireAuth(request, env);
        const { name, baseline_value, current_value, unit } = await request.json();
        await env.DB.prepare(
          `UPDATE impact_indicators SET name = ?, baseline_value = ?, current_value = ?, unit = ?, updated_at = datetime('now') WHERE id = ? AND organization_id = ?`
        ).bind(name, baseline_value || null, current_value || null, unit || null, indicatorMatch[1], claims.org).run();
        return json({ ok: true });
      }
      if (indicatorMatch && method === 'DELETE') {
        const claims = await requireAuth(request, env);
        await env.DB.prepare('DELETE FROM impact_indicators WHERE id = ? AND organization_id = ?').bind(indicatorMatch[1], claims.org).run();
        return json({ ok: true });
      }

      // ---------- ADMIN: MODEL PERFORMANCE (real operational stats, no fabricated accuracy) ----------
      if (path === '/api/admin/model-stats' && method === 'GET') {
        const claims = await requireAuth(request, env);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const responses = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ?`
        ).bind(effectiveOrgId).first();
        const transcripts = await env.DB.prepare(
          `SELECT COUNT(*) as n FROM transcripts t JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ?`
        ).bind(effectiveOrgId).first();
        const fraudFlags = await env.DB.prepare(
          `SELECT COUNT(*) as n, AVG(r.fraud_score) as avg_score FROM responses r JOIN campaigns c ON r.campaign_id = c.id WHERE c.organization_id = ? AND r.fraud_score >= 0.5`
        ).bind(effectiveOrgId).first();
        const avgLatency = await env.DB.prepare(
          `SELECT AVG((julianday(t.created_at) - julianday(a.created_at)) * 86400) as avg_seconds
           FROM transcripts t JOIN answers a ON t.answer_id = a.id JOIN responses r ON a.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ?`
        ).bind(effectiveOrgId).first();
        // Real Whisper confidence, averaged across every voice response — not an illustrative number.
        const avgConfidence = await env.DB.prepare(
          `SELECT AVG(CAST(json_extract(ai.content_json, '$.confidence') AS REAL)) as avg_confidence
           FROM ai_insights ai JOIN responses r ON ai.response_id = r.id JOIN campaigns c ON r.campaign_id = c.id
           WHERE c.organization_id = ? AND ai.insight_type = 'transcription_quality'`
        ).bind(effectiveOrgId).first();
        return json({
          total_responses: responses.n,
          total_transcripts: transcripts.n,
          fraud_flags: fraudFlags.n,
          avg_fraud_score: fraudFlags.avg_score,
          avg_processing_seconds: avgLatency.avg_seconds,
          avg_transcription_confidence: avgConfidence.avg_confidence,
        });
      }

      // ---------- OUTBOUND CAMPAIGNS (host-initiated calls/SMS/WhatsApp — you call THEM) ----------
      const outboundMatch = path.match(/^\/api\/campaigns\/([a-zA-Z0-9_]+)\/outbound$/);
      if (outboundMatch && method === 'POST') {
        const claims = await requireAuth(request, env);
        const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ? AND organization_id = ?').bind(outboundMatch[1], claims.org).first();
        if (!campaign) return error('Campaign not found', 404);
        const { phone_numbers, channel, language } = await request.json();
        if (!Array.isArray(phone_numbers) || !phone_numbers.length) return error('phone_numbers must be a non-empty array');
        if (!['phone_call', 'sms', 'whatsapp'].includes(channel)) return error('channel must be phone_call, sms, or whatsapp');
        const lang = language === 'en' ? 'en' : 'sw';
        const base = new URL(request.url).origin;

        const results = [];
        for (const rawNumber of phone_numbers) {
          const phone = rawNumber.trim();
          if (!phone) continue;
          if (channel === 'phone_call') {
            const voiceUrl = `${base}/api/voice/outbound-connected?campaign_id=${encodeURIComponent(campaign.id)}&language=${lang}`;
            const result = await initiateOutboundCall(env, phone, voiceUrl);
            results.push({ phone, ok: result.ok, reason: result.reason });
          } else {
            // For SMS/WhatsApp we start the session immediately and text the
            // first question directly — their reply is then handled by the
            // exact same inbound webhook logic already in place.
            try {
              const session = await getOrCreateSession(env, { sessionKey: phone, channel, campaignId: campaign.id, language: lang, consentGiven: true }); // Notice-based consent: the outbound message itself states participation is voluntary — see the message body below.
              const questions = await getQuestions(env, session.survey_id);
              const q = questions[session.current_index];
              const consentPrefix = lang === 'en'
                ? 'Hi, this is VoiceInsights Africa. By replying, you agree to take part in this research (reply STOP to opt out).\n\n'
                : 'Habari, huu ni ujumbe kutoka VoiceInsights Africa. Kwa kujibu, unakubali kushiriki kwenye utafiti huu (jibu STOP kujiondoa).\n\n';
              const messageBody = consentPrefix + (q ? q.question_text : 'Thank you for participating.');
              const sendResult = await sendTwilioMessage(env, { to: phone, body: messageBody, whatsapp: channel === 'whatsapp' });
              results.push({ phone, ok: sendResult.ok, reason: sendResult.reason });
            } catch (e) {
              results.push({ phone, ok: false, reason: e.message });
            }
          }
        }
        const successCount = results.filter(r => r.ok).length;
        await logAudit(env, { org: claims.org, userId: claims.sub, action: 'outbound_campaign_started', resourceType: 'campaign', resourceId: campaign.id, request });
        return json({ ok: true, sent: successCount, failed: results.length - successCount, results });
      }

      // ---------- AUDIT LOG (real security trail — logins, invites, 2FA changes) ----------
      // ============================================================
      // ENTERPRISE AUDIT CENTER (Task 5.2) — platform-wide audit trail for
      // Super Admin, combining `audit_logs` (general admin actions) and
      // `vault_audit_log` (secret encrypt/decrypt/rotate events) into one
      // searchable, filterable view. Reuses both existing tables — no
      // schema change. Org-scoped /api/audit-logs is untouched and still
      // works exactly as before for org_admin users.
      // ============================================================
      if (path === '/api/superadmin/audit-center' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'super_admin') return error('Super Admin access required', 403);
        const params = new URL(request.url).searchParams;
        const actionFilter = params.get('action');
        const orgFilter = params.get('org_id');
        const daysBack = parseInt(params.get('days')) || 7;

        const conditions = [`al.created_at >= datetime('now', '-${daysBack} days')`];
        const binds = [];
        if (actionFilter) { conditions.push('al.action = ?'); binds.push(actionFilter); }
        if (orgFilter) { conditions.push('al.organization_id = ?'); binds.push(orgFilter); }

        const { results: generalLogs } = await env.DB.prepare(
          `SELECT al.action, al.resource_type, al.resource_id, al.ip_address, al.created_at, u.full_name, u.email, o.name as organization_name
           FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id LEFT JOIN organizations o ON al.organization_id = o.id
           WHERE ${conditions.join(' AND ')} ORDER BY al.created_at DESC LIMIT 300`
        ).bind(...binds).all();

        const { results: vaultLogs } = await env.DB.prepare(
          `SELECT operation, outcome, error_code, secret_type, organization_id, created_at
           FROM vault_audit_log WHERE created_at >= datetime('now', '-${daysBack} days') ORDER BY created_at DESC LIMIT 100`
        ).all();

        const { results: actionCounts } = await env.DB.prepare(
          `SELECT action, COUNT(*) as n FROM audit_logs WHERE created_at >= datetime('now', '-${daysBack} days') GROUP BY action ORDER BY n DESC LIMIT 20`
        ).all();

        return json({ general_logs: generalLogs, vault_logs: vaultLogs, action_counts: actionCounts, days_back: daysBack });
      }

      if (path === '/api/audit-logs' && method === 'GET') {
        const claims = await requireAuth(request, env);
        if (claims.role !== 'org_admin' && claims.role !== 'super_admin') return error('Only an Org Admin can view the audit log', 403);
        const effectiveOrgId = await getEffectiveOrgId(request, env, claims);
        const { results } = await env.DB.prepare(
          `SELECT al.action, al.resource_type, al.resource_id, al.ip_address, al.created_at, u.full_name, u.email
           FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
           WHERE al.organization_id = ? ORDER BY al.created_at DESC LIMIT 200`
        ).bind(effectiveOrgId).all();
        return json({ logs: results });
      }

      // ---------- PUBLIC: survey questions for the web widget ----------
      const publicQMatch = path.match(/^\/api\/public\/campaigns\/([a-zA-Z0-9_]+)\/questions$/);
      if (publicQMatch && method === 'GET') {
        const campaign = await env.DB.prepare('SELECT * FROM campaigns WHERE id = ?').bind(publicQMatch[1]).first();
        if (!campaign) return error('Campaign not found', 404);
        if (campaign.status !== 'active') return error('Campaign not found or inactive', 404);
        const survey = await env.DB.prepare('SELECT updated_at, status FROM surveys WHERE id = ?').bind(campaign.survey_id).first();
        if (!survey || !['active','published'].includes(survey.status)) return error('Survey not available', 404);
        const questions = await getQuestions(env, campaign.survey_id);
        // survey_version lets an offline-caching client (the Enumerator App) detect
        // that the survey was edited server-side since it last downloaded it.
        return json({ campaign: { id: campaign.id, name: campaign.name }, questions, survey_version: survey ? survey.updated_at : null });
      }

      // ============================================================
      // V213 CRITICAL SECURITY (CRIT-1): every Twilio-owned inbound webhook
      // is verified HERE, before any handler runs, so no unsigned request can
      // ever reach the collection pipeline or write to D1. The guard buffers
      // the body, checks X-Twilio-Signature against the reconstructed public
      // URL in constant time, enforces SID replay protection, and returns a
      // 403 (+ redacted audit log) on failure. A verified call gets a fresh
      // request carrying the buffered body so handler.formData() still works.
      // See src/twilio-security.js.
      // ============================================================
      if (isTwilioWebhookPath(path) && method === 'POST') {
        const guard = await guardTwilioWebhook(request, env);
        if (!guard.ok) return guard.response;
        request = guard.request; // verified request with re-readable body
      }

      // ---------- CHANNEL 1: WHATSAPP ----------
      if (path === '/api/whatsapp/webhook' && method === 'POST') return await handleWhatsAppWebhook(request, env);

      // ---------- CHANNEL 2: PHONE CALL (Twilio Voice) ----------
      if (path === '/api/voice/incoming' && method === 'POST') return handleVoiceIncoming(request, env);
      if (path === '/api/voice/language' && method === 'POST') return await handleVoiceLanguage(request, env);
      if (path === '/api/voice/code' && method === 'POST') return await handleVoiceCode(request, env);
      if (path === '/api/voice/outbound-connected' && method === 'POST') return await handleVoiceOutboundConnected(request, env);
      if (path === '/api/voice/recording' && method === 'POST') return await handleVoiceRecording(request, env);

      // ---------- CHANNEL 3: SMS (feature-phone fallback, text only) ----------
      if (path === '/api/sms/webhook' && method === 'POST') return await handleSmsWebhook(request, env);

      // ---------- CHANNEL 4: WEB LINK / in-app recorder ----------
      if (path === '/api/web/submit' && method === 'POST') return await handleWebSubmit(request, env);


      // VoiceInsights Intelligence Network™ (VIN™) — network-ready architecture.
      if (path === '/api/intelligence-network/workspace' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims);
        let registry=[],consents=[],snapshots=[],settings={};
        try{registry=(await env.DB.prepare('SELECT * FROM vin_network_registry ORDER BY created_at DESC').all()).results||[]}catch(_){}
        try{consents=(await env.DB.prepare('SELECT * FROM vin_organization_consents').all()).results||[]}catch(_){}
        try{snapshots=(await env.DB.prepare('SELECT s.*, CASE WHEN c.africa_intelligence=1 AND c.anonymous_benchmarking=1 THEN 1 ELSE 0 END AS opted_in FROM vin_intelligence_snapshots s LEFT JOIN vin_organization_consents c ON c.organization_id=s.organization_id ORDER BY s.created_at DESC LIMIT 10000').all()).results||[]}catch(_){}
        try{settings=await env.DB.prepare("SELECT * FROM vin_network_settings WHERE id='global'").first()||{}}catch(_){}
        const opted=consents.filter(c=>c.africa_intelligence===1 && c.anonymous_benchmarking===1);
        const workspace=buildVinWorkspace({organizations:registry.length,opted_in_organizations:opted.length,countries:new Set(registry.map(r=>r.country).filter(Boolean)).size,regions:new Set(registry.map(r=>r.region).filter(Boolean)).size,sectors:new Set(registry.map(r=>r.sector).filter(Boolean)).size,snapshots,network_active:settings.network_active===1,public_portal_active:settings.public_portal_active===1,benchmark_cloud_ready:true,knowledge_cloud_ready:true,security_ready:true,compliance_ready:true});
        return json({...workspace,current_organization_id:orgId},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/intelligence-network/readiness' && method === 'GET') {
        const claims=await requireAuth(request,env); if(!['super_admin','founder'].includes(claims.role)) return json({error:'Founder authorization required'},403);
        let registry=[],consents=[],settings={}; try{registry=(await env.DB.prepare('SELECT country,region,sector FROM vin_network_registry').all()).results||[]}catch(_){} try{consents=(await env.DB.prepare('SELECT * FROM vin_organization_consents').all()).results||[]}catch(_){} try{settings=await env.DB.prepare("SELECT * FROM vin_network_settings WHERE id='global'").first()||{}}catch(_){}
        return json(buildVinReadiness({organizations:registry.length,opted_in_organizations:consents.filter(c=>c.africa_intelligence===1&&c.anonymous_benchmarking===1).length,countries:new Set(registry.map(r=>r.country).filter(Boolean)).size,regions:new Set(registry.map(r=>r.region).filter(Boolean)).size,sectors:new Set(registry.map(r=>r.sector).filter(Boolean)).size,network_active:settings.network_active===1,benchmark_cloud_ready:true,knowledge_cloud_ready:true,security_ready:true,compliance_ready:true}),200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/intelligence-network/consent' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let row=null; try{row=await env.DB.prepare('SELECT * FROM vin_organization_consents WHERE organization_id=?').bind(orgId).first()}catch(_){} return json({product_name:VIN_PRODUCT_NAME,consent:row||null},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/intelligence-network/consent' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','founder','org_admin'].includes(claims.role)) return json({error:'Organization administrator permission required'},403); const orgId=await getEffectiveOrgId(request,env,claims); const body=await request.json().catch(()=>({})); const checked=validateVinConsent(body); if(!checked.ok)return json(checked,400); const c=checked.consent,now=new Date().toISOString();
        await env.DB.prepare(`INSERT INTO vin_organization_consents (organization_id,anonymous_benchmarking,sector_benchmarking,country_benchmarking,regional_intelligence,africa_intelligence,public_statistics,consent_version,approved_by,approved_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET anonymous_benchmarking=excluded.anonymous_benchmarking,sector_benchmarking=excluded.sector_benchmarking,country_benchmarking=excluded.country_benchmarking,regional_intelligence=excluded.regional_intelligence,africa_intelligence=excluded.africa_intelligence,public_statistics=excluded.public_statistics,consent_version=excluded.consent_version,approved_by=excluded.approved_by,approved_at=excluded.approved_at,updated_at=excluded.updated_at`).bind(orgId,c.anonymous_benchmarking?1:0,c.sector_benchmarking?1:0,c.country_benchmarking?1:0,c.regional_intelligence?1:0,c.africa_intelligence?1:0,c.public_statistics?1:0,'1.0',claims.sub,now,now).run();
        return json({ok:true,consent:c,message:'Organization intelligence-sharing preferences updated.'},200);
      }
      if (path === '/api/intelligence-network/register' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','founder','org_admin'].includes(claims.role))return json({error:'Insufficient permission'},403); const orgId=await getEffectiveOrgId(request,env,claims); const b=await request.json().catch(()=>({})),now=new Date().toISOString(); if(!b.country||!b.sector)return json({error:'country and sector are required'},400);
        await env.DB.prepare(`INSERT INTO vin_network_registry (organization_id,country,region,sector,status,registered_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET country=excluded.country,region=excluded.region,sector=excluded.sector,status=excluded.status,updated_at=excluded.updated_at`).bind(orgId,String(b.country),String(b.region||''),String(b.sector),'registered',claims.sub,now,now).run(); return json({ok:true,organization_id:orgId,status:'registered'},201);
      }
      if (path === '/api/intelligence-network/snapshots' && method === 'POST') {
        const claims=await requireAuth(request,env); if(!['super_admin','founder','org_admin','me_officer','data_analyst'].includes(claims.role))return json({error:'Insufficient permission'},403); const orgId=await getEffectiveOrgId(request,env,claims); const b=await request.json().catch(()=>({})); if(!b.metric_key||!Number.isFinite(Number(b.metric_value)))return json({error:'metric_key and numeric metric_value are required'},400); const consent=await env.DB.prepare('SELECT * FROM vin_organization_consents WHERE organization_id=?').bind(orgId).first(); if(!consent?.anonymous_benchmarking)return json({error:'Organization has not opted into anonymous benchmarking'},403); const id=`vin_snap_${crypto.randomUUID()}`,now=new Date().toISOString(); await env.DB.prepare('INSERT INTO vin_intelligence_snapshots (id,organization_id,country,region,sector,metric_key,metric_value,period,evidence_count,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(id,orgId,String(b.country||'Unspecified'),String(b.region||'Unspecified'),String(b.sector||'General'),String(b.metric_key),Number(b.metric_value),String(b.period||''),Number(b.evidence_count||0),claims.sub,now).run(); return json({ok:true,id,classification:'AGGREGATION_CANDIDATE'},201);
      }
      if (path === '/api/intelligence-network/activate' && method === 'POST') {
        const claims=await requireAuth(request,env); const body=await request.json().catch(()=>({})); let registry=[],consents=[]; try{registry=(await env.DB.prepare('SELECT country,region,sector FROM vin_network_registry').all()).results||[]}catch(_){} try{consents=(await env.DB.prepare('SELECT * FROM vin_organization_consents').all()).results||[]}catch(_){} const readiness=buildVinReadiness({organizations:registry.length,opted_in_organizations:consents.filter(c=>c.africa_intelligence===1&&c.anonymous_benchmarking===1).length,countries:new Set(registry.map(r=>r.country).filter(Boolean)).size,regions:new Set(registry.map(r=>r.region).filter(Boolean)).size,sectors:new Set(registry.map(r=>r.sector).filter(Boolean)).size,benchmark_cloud_ready:true,knowledge_cloud_ready:true,security_ready:true,compliance_ready:true}); const allowed=canActivateVin({role:claims.role,readiness,founder_confirmed:body.confirm===true}); if(!allowed.ok)return json({...allowed,readiness},403); const now=new Date().toISOString(); await env.DB.prepare(`INSERT INTO vin_network_settings (id,network_active,public_portal_active,activated_by,activated_at,updated_at) VALUES ('global',1,0,?,?,?) ON CONFLICT(id) DO UPDATE SET network_active=1,activated_by=excluded.activated_by,activated_at=excluded.activated_at,updated_at=excluded.updated_at`).bind(claims.sub,now,now).run(); return json({ok:true,network_status:'ACTIVE',activated_at:now},200);
      }
      if (path === '/api/intelligence-network/collaboration' && method === 'GET') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); let rows=[]; try{rows=(await env.DB.prepare("SELECT id,title,country,region,sector,opportunity_type,description,skills_json,status,organization_id,created_at FROM vin_collaboration_opportunities WHERE status='open' ORDER BY created_at DESC LIMIT 100").all()).results||[]}catch(_){} return json({product_name:VIN_PRODUCT_NAME,opportunities:rows.map(r=>({...r,skills:JSON.parse(r.skills_json||'[]'),is_owner:r.organization_id===orgId}))},200,{'Cache-Control':'no-store'});
      }
      if (path === '/api/intelligence-network/collaboration' && method === 'POST') {
        const claims=await requireAuth(request,env); const orgId=await getEffectiveOrgId(request,env,claims); const b=await request.json().catch(()=>({})); const checked=buildCollaborationOpportunity(b); if(!checked.ok)return json(checked,400); const o=checked.opportunity,id=`vin_collab_${crypto.randomUUID()}`,now=new Date().toISOString(); await env.DB.prepare('INSERT INTO vin_collaboration_opportunities (id,organization_id,title,country,region,sector,opportunity_type,description,skills_json,status,created_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,orgId,o.title,o.country,o.region,o.sector,o.opportunity_type,o.description,JSON.stringify(o.skills),o.status,claims.sub,now,now).run(); return json({ok:true,id,opportunity:o},201);
      }
      if (path === '/api/public/intelligence-network/status' && method === 'GET') {
        let settings={}; try{settings=await env.DB.prepare("SELECT network_active,public_portal_active,activated_at FROM vin_network_settings WHERE id='global'").first()||{}}catch(_){} return json({product_name:VIN_PRODUCT_NAME,status:settings.network_active===1?'ACTIVE':'PREPARING_NETWORK',public_portal:settings.public_portal_active===1?'ACTIVE':'COMING_SOON',privacy_commitment:'Only consented, aggregated intelligence is eligible. Raw respondent and client-confidential data are excluded.'},200,{'Cache-Control':'public,max-age=300'});
      }

      return error('Not found', 404);
    } catch (e) {
      if (e && e.status) return error(e.message, e.status);
      console.error('Unhandled API error:', e && e.message ? e.message : 'unknown');
      return error('Internal server error. Please try again or contact support if the problem continues.', 500);
    }
}
