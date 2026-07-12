// VoiceInsights Africa Cloudflare Worker entrypoint.
// Runtime routing lives in application.js; queue and scheduled handlers remain
// first-class Worker handlers exported by the application module.
import application from './application.js';

export default application;
