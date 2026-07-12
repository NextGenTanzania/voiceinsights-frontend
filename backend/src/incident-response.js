import { buildIncidentResponseRunbook } from './disaster-recovery.js';

export function classifyIncident({ service, severity, customerImpact = false } = {}) {
  if (severity === 'critical' || customerImpact) return { level: 'SEV1', response_time_minutes: 15 };
  if (severity === 'warning') return { level: 'SEV2', response_time_minutes: 60 };
  return { level: 'SEV3', response_time_minutes: 240 };
}

export function buildIncidentPacket(alert) {
  const classification = classifyIncident({ service: alert?.service, severity: alert?.severity, customerImpact: alert?.severity === 'critical' });
  return {
    incident_id: `inc_${Date.now().toString(36)}`,
    classification,
    alert,
    runbook: buildIncidentResponseRunbook({ incidentType: alert?.service || 'generic' }),
    communications: {
      internal_update_cadence_minutes: classification.level === 'SEV1' ? 30 : 120,
      customer_status_required: classification.level === 'SEV1',
    },
    created_at: new Date().toISOString(),
  };
}
