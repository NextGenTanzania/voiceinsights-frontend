(function () {
  const pages = {
    trust: {
      eyebrow: 'Enterprise Trust Center',
      title: 'One authoritative view of institutional assurance.',
      lead: 'Implemented controls, documented practices, configurable responsibilities and future assurance are distinguished explicitly.',
      statusLegend: true,
      sections: [
        ['Security', 'Technical and organizational controls for identities, access, infrastructure, isolation, monitoring and incident response.', [['Review security', '/security.html']]],
        ['Privacy and data protection', 'Ownership, controller and processor responsibilities, consent, retention, deletion and transfer safeguards.', [['Review data protection', '/data-protection.html'], ['Privacy policy', '/privacy.html']]],
        ['Responsible AI', 'Human oversight, evidence grounding, candidate-output review, limitations and publication approval.', [['Review Responsible AI', '/responsible-ai.html']]],
        ['Compliance', 'A status-aware view of data protection, accessibility, research ethics, safeguarding, governance and continuity.', [['Open Compliance Center', '/compliance-center.html']]],
        ['Accessibility', 'Public experiences are designed toward WCAG 2.2 AA; accessible output validation remains part of publication approval.', [['Accessibility expectations', '/compliance-center.html#accessibility']]],
        ['Publication governance', 'Evidence lineage, human review, versioning, approval, correction and withdrawal govern public intelligence.', [['Explore Knowledge Hub', '/sample-reports.html']]],
        ['Continuity and recovery', 'Managed infrastructure, backups, recovery controls and incident procedures support service resilience.', [['Continuity controls', '/security.html']]],
        ['Audit and transparency', 'Material access, review, approval and publication events are designed to remain attributable and reviewable.', [['Governance model', '/compliance-center.html#audit']]],
        ['Service status and support', 'Operational health and support routes remain separate from sales conversations.', [['Platform Status', '/status.html'], ['Enterprise Support', '/enterprise-support.html']]],
      ],
    },
    responsibleAi: {
      eyebrow: 'Responsible AI',
      title: 'AI assists governed analysis. People retain authority.',
      lead: 'AI contributions remain candidate intelligence until reviewed, accepted or rejected through an accountable workflow.',
      lifecycle: ['Authorized evidence', 'AI contribution', 'Candidate output', 'Human review', 'Accepted, modified or rejected', 'Governed intelligence', 'Publication approval'],
      sections: [
        ['Human oversight', 'AI may assist transcription, translation, classification, summarization, thematic coding and drafting. It does not approve evidence, make institutional decisions or authorize publication.'],
        ['Evidence chain', 'Material AI-supported statements must retain authorized input identities, source versions, citations, operation purpose and review disposition.'],
        ['Hallucination mitigation', 'Retrieval boundaries, citation requirements, uncertainty disclosure, review gates and rejection workflows reduce the risk of unsupported output.'],
        ['Confidence and limitations', 'Confidence is contextual evidence for review—not a guarantee of correctness. Known uncertainty and missing evidence remain visible.'],
        ['Model transparency', 'Governed contributions retain operation type, model identity and version, instruction version, authorized inputs and review outcome.'],
        ['Synthetic data', 'Demonstration evidence and outputs are persistently labelled and must not be interpreted as findings about a real population or institution.'],
        ['Responsible-use boundaries', 'AI must never fabricate observations, consent, authority, approvals, audit history or evidence provenance. Sensitive processing requires authorization and purpose limitation.'],
      ],
    },
    dataProtection: {
      eyebrow: 'Data Protection',
      title: 'Customer data remains governed through its full lifecycle.',
      lead: 'The applicable agreement and implementation scope define ownership, permitted processing, retention, portability and responsibilities.',
      lifecycle: ['Purpose and lawful basis', 'Collection and consent', 'Classification', 'Authorized processing', 'Controlled use', 'Retention or archival', 'Export, anonymization or deletion'],
      sections: [
        ['Personal and sensitive data', 'Classification and purpose determine collection, access, processing, disclosure, retention and safeguarding requirements.'],
        ['Consent', 'Consent records must reflect the collection context, language, scope, withdrawal conditions and applicable research or safeguarding protocol.'],
        ['Ownership and roles', 'Customers retain rights defined by contract. Controller, processor, steward and custodian responsibilities are established for each implementation.'],
        ['Retention and deletion', 'Retention follows applicable law, consent, contractual policy and legal holds. Institutional memory is not used to justify unlawful personal-data retention.'],
        ['Cross-border processing', 'Processing location, subprocessors, residency requirements and transfer safeguards are assessed during implementation and documented contractually.'],
        ['Backups and recovery', 'Recovery copies inherit access, retention and deletion controls. Recovery capability does not create a separate permission to use data.'],
        ['Audit trails', 'Material access, permission, review, export and disposal events are designed to remain attributable without placing sensitive payloads in logs.'],
      ],
    },
    compliance: {
      eyebrow: 'Compliance Center',
      title: 'Assurance status without implied certification.',
      lead: 'This center distinguishes what is implemented, documented, configurable, under review or dependent on external assessment.',
      statusLegend: true,
      sections: [
        ['Data protection', 'Documented and implementation-specific. Controller, processor, transfer, retention and data-subject obligations require project confirmation.'],
        ['Accessibility', 'Design target: WCAG 2.2 AA. Public pages and artifacts require automated and human validation before an accessibility claim.', [], 'accessibility'],
        ['Responsible AI', 'Human review and approval controls are required for candidate AI contributions used in governed intelligence.'],
        ['Research ethics', 'Protocol, consent, risk, vulnerable-population and ethics-review requirements remain study-specific.'],
        ['Safeguarding', 'Consent, access restriction, escalation and referral practices are configured for the approved collection context.'],
        ['Publication governance', 'Evidence lineage, review, approval, version, correction and withdrawal apply to released intelligence.'],
        ['Information security', 'Authentication, scoped authorization, encryption, auditability and tenant isolation are implemented architecture concerns.'],
        ['Continuity and risk', 'Backup and incident controls exist; customer-specific objectives and independent assurance require documented agreement.'],
        ['Audit and transparency', 'Assurance evidence is supplied for the applicable scope without implying unearned accreditation.', [], 'audit'],
      ],
    },
    support: {
      eyebrow: 'Enterprise Support',
      title: 'Support designed around operational consequence.',
      lead: 'Support coverage, named contacts and response targets are agreed in the applicable service arrangement.',
      priorities: [
        ['P1 · Critical', 'Production service unavailable or a confirmed high-impact security incident.', 'Immediate triage under the contracted critical-incident process.'],
        ['P2 · High', 'Major capability impaired with material operational impact and no reasonable workaround.', 'Prioritized investigation and agreed update cadence.'],
        ['P3 · Standard', 'Limited defect, configuration question or non-critical integration issue.', 'Handled through the standard support queue.'],
        ['P4 · Guidance', 'Training, best-practice, documentation or enhancement request.', 'Routed to customer success, product or professional services.'],
      ],
      sections: [
        ['Channels', 'Authorized customers use agreed email, service desk and escalation contacts. Security concerns have a dedicated route.'],
        ['Business hours', 'Standard coverage and applicable time zone are defined in the customer agreement; critical coverage depends on the purchased support model.'],
        ['Knowledge and training', 'Onboarding materials, role-based training, operating guidance and release notes support internal adoption.'],
        ['Customer success', 'Implementation reviews connect platform operation to adoption, governance, reporting cycles and measurable organizational value.'],
      ],
    },
    sla: {
      eyebrow: 'Service Level Overview',
      title: 'Service expectations belong in an explicit agreement.',
      lead: 'This public overview describes the service-level model. Contracted targets, remedies and exclusions are confirmed for each implementation.',
      sections: [
        ['Availability', 'Availability measurement, service boundaries, exclusions and reporting periods are defined contractually. No unsupported universal uptime promise is published.'],
        ['Response targets', 'Targets vary by incident priority, support package, operating hours and the information available to begin investigation.'],
        ['Maintenance', 'Planned maintenance is communicated through agreed channels. Urgent security or reliability work may require accelerated action.'],
        ['Escalation', 'Critical incidents follow named technical, operational and executive escalation paths with an agreed update cadence.'],
        ['Customer obligations', 'Maintain authorized contacts, protect credentials, provide timely diagnostic information, follow supported configurations and meet agreed data-governance duties.'],
        ['Platform obligations', 'Operate the contracted service, protect customer boundaries, investigate incidents, communicate material status and retain required operational evidence.'],
      ],
    },
    architecture: {
      eyebrow: 'Enterprise Architecture',
      title: 'A governed path from collection to institutional intelligence.',
      lead: 'The architecture separates public discovery, customer operations, controlled processing, governed evidence and published product views.',
      architecture: true,
      sections: [
        ['Public experience', 'Website, Knowledge Hub and approved public product views expose only released information.'],
        ['Application and API layer', 'Authenticated operations enforce organization, scope, object state, classification and requested action.'],
        ['Workers and orchestration', 'Synchronous requests and long-running workflows coordinate processing, review, rendering and notifications.'],
        ['Data and storage', 'Managed database and object storage hold governed records and artifacts under tenant, retention and access controls.'],
        ['Offline synchronization', 'Field work synchronizes through conflict-aware, authorization-conscious processes when connectivity returns.'],
        ['AI services', 'Authorized source versions enter governed AI operations; candidate contributions remain separate from accepted intelligence.'],
        ['Exports and reporting', 'Reports, dashboards and files are replaceable expressions of approved intelligence—not independent sources of truth.'],
        ['Audit and monitoring', 'Enterprise events, audit records, health telemetry and security signals support reconstruction and operations.'],
      ],
    },
    integrations: {
      eyebrow: 'Integrations',
      title: 'Connect governed intelligence without inventing unsupported capability.',
      lead: 'Statuses distinguish capabilities available today from integration work that requires validation or customer-specific delivery.',
      integrations: [
        ['Excel / CSV', 'Available', 'Governed tabular export and supported data exchange.'],
        ['REST API', 'Available by approved scope', 'Object- and action-oriented access for authorized integrations.'],
        ['Email, SMS, WhatsApp and Voice', 'Available by configured channel', 'Collection, notifications or communications according to the approved workflow.'],
        ['Power BI / Tableau', 'Supported through governed exports; direct connectors under review', 'Analysis and visualization using authorized datasets.'],
        ['DHIS2, KoboToolbox, ODK, SurveyCTO and CommCare', 'Planned or customer-scoped', 'Programme, health and field-data exchange subject to mapping and validation.'],
        ['Webhooks', 'Planned', 'Event delivery to approved customer endpoints.'],
        ['SSO', 'Enterprise roadmap / scoped evaluation', 'Organization identity federation subject to protocol and customer requirements.'],
      ],
    },
    success: {
      eyebrow: 'Customer Success',
      title: 'Adoption is managed as an organizational capability.',
      lead: 'Customer success connects implementation, role readiness, governance, evidence quality and continuous improvement.',
      lifecycle: ['Onboarding', 'Role-based training', 'Pilot support', 'Go-live review', 'Adoption monitoring', 'Operating reviews', 'Optimization and learning'],
      sections: [
        ['Onboarding', 'Confirm objectives, stakeholders, authority, data responsibilities, workflow and success measures.'],
        ['Training', 'Prepare administrators, programme teams, analysts, reviewers, approvers and field personnel for their responsibilities.'],
        ['Best practices', 'Use governed patterns for evidence, indicators, review, publication, accessibility and responsible AI.'],
        ['Knowledge base and release notes', 'Document operating guidance, changes, known limitations and actions customers may need to take.'],
        ['Versioning and roadmap', 'Released behavior remains versioned; roadmap discussion does not convert planned capability into a contractual promise.'],
        ['Support journey', 'Operational support, professional services and strategic customer-success work remain clearly distinguished.'],
      ],
    },
  };

  function links(items = []) {
    if (!items.length) return '';
    return `<div class="enterprise-doc-links">${items.map(([label, url]) => `<a href="${url}">${label}<span aria-hidden="true">→</span></a>`).join('')}</div>`;
  }

  function statusLegend() {
    return `<aside class="enterprise-status-legend" aria-label="Assurance status meanings">
      <span><strong>Implemented</strong> Operating control</span>
      <span><strong>Documented</strong> Governed practice</span>
      <span><strong>Configurable</strong> Customer-specific decision</span>
      <span><strong>Under review</strong> Not yet an assurance claim</span>
      <span><strong>External assessment</strong> Independent evidence required</span>
    </aside>`;
  }

  function render() {
    const root = document.getElementById('enterprise-doc-root');
    if (!root) return;
    const page = pages[root.dataset.enterprisePage];
    if (!page) return;
    const breadcrumb = root.dataset.enterprisePage === 'trust'
      ? `<a href="/index.html">Home</a><span aria-hidden="true">/</span><span aria-current="page">${page.eyebrow}</span>`
      : `<a href="/index.html">Home</a><span aria-hidden="true">/</span><a href="/trust-center.html">Trust Center</a><span aria-hidden="true">/</span><span aria-current="page">${page.eyebrow}</span>`;
    root.innerHTML = `
      <header class="pub-hero enterprise-doc-hero">
        <nav class="enterprise-breadcrumbs" aria-label="Breadcrumb">${breadcrumb}</nav>
        <span class="eyebrow">${page.eyebrow}</span><h1>${page.title}</h1><p class="lead">${page.lead}</p>
      </header>
      ${page.statusLegend ? statusLegend() : ''}
      ${page.lifecycle ? `<section class="pub-section enterprise-lifecycle" aria-labelledby="lifecycle-title"><div class="section-header"><span class="eyebrow">Governed lifecycle</span><h2 id="lifecycle-title">Responsibilities remain visible from start to finish.</h2></div><ol>${page.lifecycle.map((item, index) => `<li><span>${String(index + 1).padStart(2, '0')}</span><strong>${item}</strong></li>`).join('')}</ol></section>` : ''}
      ${page.architecture ? `<section class="pub-section enterprise-architecture-map" aria-label="Platform architecture relationship"><div>Public Website<br><small>Knowledge Hub</small></div><span>→</span><div>API &amp; Workers<br><small>Authorization</small></div><span>→</span><div>Database &amp; Storage<br><small>Tenant boundaries</small></div><span>→</span><div>Analysis &amp; AI<br><small>Human review</small></div><span>→</span><div>Reports &amp; Exports<br><small>Approved views</small></div></section>` : ''}
      ${page.priorities ? `<section class="pub-section"><div class="section-header"><span class="eyebrow">Priority model</span><h2>Impact determines handling.</h2></div><div class="enterprise-priority-grid">${page.priorities.map(item => `<article><h3>${item[0]}</h3><p>${item[1]}</p><small>${item[2]}</small></article>`).join('')}</div></section>` : ''}
      ${page.integrations ? `<section class="pub-section"><div class="section-header"><span class="eyebrow">Integration register</span><h2>Status is explicit.</h2></div><div class="enterprise-integration-list">${page.integrations.map(item => `<article><div><h3>${item[0]}</h3><span>${item[1]}</span></div><p>${item[2]}</p></article>`).join('')}</div></section>` : ''}
      <section class="pub-section enterprise-doc-grid" aria-label="${page.eyebrow} topics">${page.sections.map(item => `<article id="${item[3] || ''}"><h2>${item[0]}</h2><p>${item[1]}</p>${links(item[2])}</article>`).join('')}</section>
      <section class="pub-section enterprise-doc-cta"><div><span class="eyebrow">Procurement pathway</span><h2>Need evidence for a formal evaluation?</h2><p>Request the current documents applicable to your organization, jurisdiction, implementation scope and assurance requirements.</p></div><a class="btn btn-primary" href="/contact.html?intent=procurement">Request procurement evidence</a></section>`;
    if (window.lucide) window.lucide.createIcons();
  }

  document.addEventListener('DOMContentLoaded', render);
})();
