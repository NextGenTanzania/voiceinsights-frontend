/* VoiceInsights Report Design System v1.0 — reusable report component helpers.
   No global rendering is performed automatically; callers opt in component-by-component. */
(function(){
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const list = (items=[]) => items.length ? `<ul>${items.map(i=>`<li>${escapeHtml(i)}</li>`).join('')}</ul>` : '';
  const evidenceClass = (type='model') => {
    const t = String(type).toLowerCase();
    if (t.includes('raw')) return 'vrds-badge--raw';
    if (t.includes('demo') || t.includes('synthetic')) return 'vrds-badge--demo';
    if (t.includes('limited') || t.includes('insufficient')) return 'vrds-badge--limited';
    return 'vrds-badge--model';
  };

  const VRDS = {
    escapeHtml,
    evidenceClass,
    cover({title, subtitle, reportType, organization, country, date, status='Draft', version='v1.0'}={}){
      return `<section class="vrds-cover" data-vrds-component="cover">
        <div class="vrds-cover__meta"><span>${escapeHtml(reportType)}</span><span>${escapeHtml(organization)}</span><span>${escapeHtml(country)}</span><span>${escapeHtml(date)}</span></div>
        <div><h1 class="vrds-cover__title">${escapeHtml(title)}</h1>${subtitle?`<p class="vrds-cover__subtitle">${escapeHtml(subtitle)}</p>`:''}</div>
        <div class="vrds-cover__meta"><span>Status: ${escapeHtml(status)}</span><span>Design: ${escapeHtml(version)}</span></div>
      </section>`;
    },
    kpiCard({label,value,note,evidenceType}={}){
      return `<article class="vrds-kpi-card" data-vrds-component="kpi-card"><div class="vrds-kpi-card__label">${escapeHtml(label)}</div><div class="vrds-kpi-card__value">${escapeHtml(value)}</div><div class="vrds-kpi-card__note">${escapeHtml(note || '')}</div>${evidenceType?`<span class="vrds-badge ${evidenceClass(evidenceType)}">${escapeHtml(evidenceType)}</span>`:''}</article>`;
    },
    executiveSnapshot({kpis=[]}={}){ return `<section class="vrds-snapshot" data-vrds-component="executive-snapshot">${kpis.map(k=>VRDS.kpiCard(k)).join('')}</section>`; },
    executiveBrief({headline, findings=[], risks=[], decisions=[], confidence, evidenceQuality}={}){
      return `<section class="vrds-brief" data-vrds-component="executive-brief"><div><div class="vrds-eyebrow">One-page executive brief</div><h2 class="vrds-h2">${escapeHtml(headline)}</h2>${confidence?`<p class="vrds-caption">Confidence: ${escapeHtml(confidence)} · Evidence quality: ${escapeHtml(evidenceQuality || 'Not assessed')}</p>`:''}</div><div><h3 class="vrds-h4">Key findings</h3>${list(findings)}<h3 class="vrds-h4">Top risks</h3>${list(risks)}<h3 class="vrds-h4">Decisions required</h3>${list(decisions)}</div></section>`;
    },
    insightCard({headline, text, evidenceType, implication}={}){ return `<article class="vrds-insight-card" data-vrds-component="insight-card"><h3 class="vrds-card-title">${escapeHtml(headline)}</h3><p class="vrds-card-text">${escapeHtml(text)}</p>${implication?`<p class="vrds-card-text"><b>Implication:</b> ${escapeHtml(implication)}</p>`:''}${evidenceType?`<span class="vrds-badge ${evidenceClass(evidenceType)}">${escapeHtml(evidenceType)}</span>`:''}</article>`; },
    evidenceCard({claim, evidenceType='Report-model evidence', confidence, source, limitation}={}){ return `<article class="vrds-evidence-card" data-vrds-component="evidence-card"><span class="vrds-badge ${evidenceClass(evidenceType)}">${escapeHtml(evidenceType)}</span><h3 class="vrds-card-title">${escapeHtml(claim)}</h3>${confidence?`<p class="vrds-card-text"><b>Confidence:</b> ${escapeHtml(confidence)}</p>`:''}${source?`<p class="vrds-card-text"><b>Source:</b> ${escapeHtml(source)}</p>`:''}${limitation?`<p class="vrds-caption">Limitation: ${escapeHtml(limitation)}</p>`:''}</article>`; },
    recommendationCard({action, priority, owner, timeline, impact, evidenceType}={}){ return `<article class="vrds-recommendation-card" data-vrds-component="recommendation-card"><h3 class="vrds-card-title">${escapeHtml(action)}</h3><p class="vrds-card-text"><b>Priority:</b> ${escapeHtml(priority)} · <b>Owner:</b> ${escapeHtml(owner)} · <b>Timeline:</b> ${escapeHtml(timeline)}</p>${impact?`<p class="vrds-card-text"><b>Expected impact:</b> ${escapeHtml(impact)}</p>`:''}${evidenceType?`<span class="vrds-badge ${evidenceClass(evidenceType)}">${escapeHtml(evidenceType)}</span>`:''}</article>`; },
    riskCard({risk, likelihood, severity, mitigation, owner}={}){ return `<article class="vrds-risk-card" data-vrds-component="risk-card"><h3 class="vrds-card-title">${escapeHtml(risk)}</h3><p class="vrds-card-text"><b>Likelihood:</b> ${escapeHtml(likelihood)} · <b>Severity:</b> ${escapeHtml(severity)}</p>${mitigation?`<p class="vrds-card-text"><b>Mitigation:</b> ${escapeHtml(mitigation)}</p>`:''}${owner?`<p class="vrds-caption">Owner: ${escapeHtml(owner)}</p>`:''}</article>`; },
    opportunityCard({opportunity, evidence, impact, difficulty}={}){ return `<article class="vrds-opportunity-card" data-vrds-component="opportunity-card"><h3 class="vrds-card-title">${escapeHtml(opportunity)}</h3>${evidence?`<p class="vrds-card-text"><b>Evidence:</b> ${escapeHtml(evidence)}</p>`:''}<p class="vrds-card-text"><b>Impact:</b> ${escapeHtml(impact || 'Not estimated')} · <b>Difficulty:</b> ${escapeHtml(difficulty || 'Not assessed')}</p></article>`; },
    methodologyCard({sampleSize, geography, channels, respondentProfile, limitations, consentCoverage, confidenceLevel}={}){ return `<article class="vrds-methodology-card" data-vrds-component="methodology-card"><h3 class="vrds-card-title">Methodology summary</h3><p class="vrds-card-text"><b>Sample:</b> ${escapeHtml(sampleSize)} · <b>Geography:</b> ${escapeHtml(geography)} · <b>Channels:</b> ${escapeHtml(channels)}</p>${respondentProfile?`<p class="vrds-card-text"><b>Respondents:</b> ${escapeHtml(respondentProfile)}</p>`:''}<p class="vrds-card-text"><b>Consent coverage:</b> ${escapeHtml(consentCoverage || 'Not stated')} · <b>Confidence:</b> ${escapeHtml(confidenceLevel || 'Not stated')}</p>${limitations?`<p class="vrds-caption">Limitations: ${escapeHtml(limitations)}</p>`:''}</article>`; },
    qualityCard({score, label='Report quality', missingData, fraudFlags, coverage, completeness}={}){ return `<article class="vrds-quality-card" data-vrds-component="quality-card"><h3 class="vrds-card-title">${escapeHtml(label)}</h3><div class="vrds-kpi-card__value">${escapeHtml(score)}</div><p class="vrds-card-text">Missing data: ${escapeHtml(missingData || 'Not assessed')} · Fraud flags: ${escapeHtml(fraudFlags || 'Not assessed')}</p><p class="vrds-caption">Coverage: ${escapeHtml(coverage || 'Not assessed')} · Completeness: ${escapeHtml(completeness || 'Not assessed')}</p></article>`; },
    sdgCard({goalNumber, label, contribution, evidenceType}={}){ const n=Number(goalNumber); const color = Number.isInteger(n) && n>=1 && n<=17 ? `var(--sdg-${n})` : 'var(--vi-blue-700)'; return `<article class="vrds-sdg-card" data-vrds-component="sdg-card"><div class="vrds-sdg-card__icon" style="background:${color}">${escapeHtml(goalNumber)}</div><div><h3 class="vrds-card-title">${escapeHtml(label)}</h3><p class="vrds-card-text">${escapeHtml(contribution)}</p>${evidenceType?`<span class="vrds-badge ${evidenceClass(evidenceType)}">${escapeHtml(evidenceType)}</span>`:''}</div></article>`; },
    timeline({items=[]}={}){ return `<div class="vrds-timeline" data-vrds-component="timeline">${items.map(i=>`<div class="vrds-timeline__item"><strong>${escapeHtml(i.phase || i.timeframe)}</strong><div><b>${escapeHtml(i.action)}</b><p class="vrds-caption">${escapeHtml(i.owner || '')}</p></div></div>`).join('')}</div>`; },
    matrix({type='decision', cells=[]}={}){ return `<div class="vrds-matrix" data-vrds-component="${escapeHtml(type)}-matrix">${cells.slice(0,4).map(c=>`<div class="vrds-matrix__cell"><h4 class="vrds-card-title">${escapeHtml(c.label)}</h4><p class="vrds-card-text">${escapeHtml(c.text || '')}</p></div>`).join('')}</div>`; },
    navigationSidebar({items=[]}={}){ return `<aside class="vrds-nav-sidebar" data-vrds-component="navigation-sidebar">${items.map(i=>`<a href="${escapeHtml(i.href)}">${escapeHtml(i.label)}</a><br>`).join('')}</aside>`; },
    assistantPanel({actions=[]}={}){ return `<aside class="vrds-assistant-panel" data-vrds-component="assistant-panel"><h3 class="vrds-card-title">Report Assistant</h3>${actions.map(a=>`<button type="button" class="assistant-action" data-action="${escapeHtml(a.id || a.label)}">${escapeHtml(a.label)}</button>`).join('')}</aside>`; },
    exportToolbar({formats=[]}={}){ return `<div class="vrds-export-toolbar" data-vrds-component="export-toolbar">${formats.map(f=>`<button type="button" class="btn btn-ghost btn-sm" data-format="${escapeHtml(f.id)}">${escapeHtml(f.label)}</button>`).join('')}</div>`; }
  };
  window.VRDS = VRDS;
})();
