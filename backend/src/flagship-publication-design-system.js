// VoiceInsights Africa World-Class Publication Design System v1
export const VIA_BRAND={name:'VoiceInsights Africa',tagline:'Every Voice. Every Language. Every Insight.',prepared_by:'VoiceInsights Africa',mark:'five-bar-voice-wave',asset_path:'/assets/voiceinsights-mark.jpeg',green:'#07883F',copyright:`© ${new Date().getUTCFullYear()} VoiceInsights Africa`};

export const PUBLICATION_THEMES={
 government:{primary:'#082B55',secondary:'#1669A8',accent:'#D4AF37',paper:'#F7FAFC',ink:'#102A43',personality:'Cabinet intelligence'},
 donor:{primary:'#3C1B6E',secondary:'#7446A8',accent:'#D4AF37',paper:'#FBF9FD',ink:'#26133F',personality:'Evaluation and value for money'},
 humanitarian:{primary:'#0B4F6C',secondary:'#2D9CDB',accent:'#F28C28',paper:'#F5FBFE',ink:'#123447',personality:'Severity, protection and accountability'},
 board:{primary:'#111827',secondary:'#263244',accent:'#D4AF37',paper:'#F8F7F3',ink:'#111827',personality:'Minimal executive decision intelligence'},
 corporate:{primary:'#102A43',secondary:'#0B7A75',accent:'#D4AF37',paper:'#F7FAF9',ink:'#102A43',personality:'Performance, growth and trust'},
 ngo:{primary:'#174C3C',secondary:'#2F855A',accent:'#E0B33D',paper:'#F7FBF8',ink:'#17372E',personality:'Impact, accountability and inclusion'},
 research:{primary:'#243B53',secondary:'#486581',accent:'#2BB0A6',paper:'#FFFFFF',ink:'#102A43',personality:'Academic evidence and statistical rigor'},
 statistical:{primary:'#1F3A5F',secondary:'#3E6C96',accent:'#2CA58D',paper:'#FAFCFE',ink:'#172B4D',personality:'Statistical rigor and reproducibility'},
 interactive:{primary:'#062C24',secondary:'#07883F',accent:'#D4AF37',paper:'#F4F9F6',ink:'#102A43',personality:'Explorable evidence intelligence'},
 evidence:{primary:'#2B2D42',secondary:'#5C677D',accent:'#00A896',paper:'#FAFAFC',ink:'#1D2433',personality:'Traceability and assurance'},
};

export const TYPE_SCALE={pdf:{display:32,h1:22,h2:16,body:10,caption:8.5,footnote:8},pptx:{display:30,h1:24,h2:18,body:16,caption:11},docx:{title:25,h1:18,h2:14,body:10.5,caption:9},xlsx:{title:18,header:11,body:10}};
export const ACCESSIBILITY_RULES={minimum_contrast:4.5,large_text_contrast:3,never_use_colour_alone:true,pdf_tagged:true,html_wcag:'2.2 AA',pptx_minimum_body_pt:16,pdf_minimum_body_pt:9.5,xlsx_minimum_body_pt:10};

export function themeFor(profile='research'){return PUBLICATION_THEMES[profile]||PUBLICATION_THEMES.research;}
export function brandLockup(){return{...VIA_BRAND,label:`${VIA_BRAND.name} — ${VIA_BRAND.tagline}`};}
// Sector Intelligence Platform: widened from 4 to 8 compositions. At 16
// samples a 4-bucket hash was already the narrowest, completely untested
// collision surface in the whole design system (confirmed by grep — no
// test anywhere asserts on `composition`); at 21+ samples a 4-bucket pool
// would start producing visible cover/layout collisions between unrelated
// publications. Same hash%N mechanism, just a wider N — no new
// randomization system.
const COVER_COMPOSITIONS=['editorial-grid','map-window','signal-band','evidence-frame','quadrant-split','timeline-band','data-portrait','ledger-grid'];
export function coverVariant(key='',profile='research'){
 const hash=[...String(key)].reduce((n,c)=>((n*31+c.charCodeAt(0))>>>0),7);
 return{variant:(hash%16)+1,composition:COVER_COMPOSITIONS[hash%COVER_COMPOSITIONS.length],theme:themeFor(profile),brand:brandLockup()};
}

