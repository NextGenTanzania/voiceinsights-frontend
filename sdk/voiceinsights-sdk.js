// VoiceInsights SDK v208 — lightweight REST client contract.
// Replace baseUrl/apiKey with your production organization credentials.
export class VoiceInsights {
  constructor({ baseUrl = 'https://voiceinsights-api.kitentyatsnp.workers.dev', apiKey }) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
  }
  async request(path, options = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        ...(options.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`VoiceInsights API ${res.status}: ${await res.text()}`);
    return res.json();
  }
  createCampaign(payload) { return this.request('/api/campaigns', { method: 'POST', body: JSON.stringify(payload) }); }
  uploadContacts(campaignId, contacts) { return this.request(`/api/campaigns/${campaignId}/contacts`, { method: 'POST', body: JSON.stringify({ contacts }) }); }
  simulateCampaign(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this.request(`/api/voiceinsights-orchestrator-v208${q ? `?${q}` : ''}`);
  }
  launchCampaign(campaignId, policy = 'adaptive_intelligence') { return this.request(`/api/campaigns/${campaignId}/launch`, { method: 'POST', body: JSON.stringify({ policy }) }); }
  getCampaignStatus(campaignId) { return this.request(`/api/campaigns/${campaignId}/status`); }
  getResponses(campaignId) { return this.request(`/api/campaigns/${campaignId}/responses`); }
  getReports(campaignId) { return this.request(`/api/campaigns/${campaignId}/reports`); }
}
