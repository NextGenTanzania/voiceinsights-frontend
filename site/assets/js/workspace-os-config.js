(function(global){
  'use strict';

  const shared=[
    'Universal Search','Notifications','Pinned Widgets','Saved Views',
    'Quick Actions','Recent Activity','Keyboard Shortcuts','Dark Mode',
    'Accessibility','Responsive Design','Intelligence Timeline'
  ];

  const profiles={
    ceo:{
      label:'CEO Executive Command Center',
      mission:'Understand platform health, material risk and enterprise activity within thirty seconds, then drill into authorized operational context.',
      aliases:['ceo','founder','founder_executive','chief_executive'],
      views:['mission_control','home','explorer','workflow','review','approvals','governance','investigations','risk','compliance','replay','tasks','knowledge','collaboration','versions','notifications','executive'],
      capabilities:['Platform Overview','Organizations','Projects','Research Portfolio','Active Surveys','Interviews Today','Interviews This Week','Reports Generated','Knowledge Publications','Platform Health','AI Usage','Storage','API Activity','Security Status','Compliance Status','System Health','Pending Approvals','Critical Alerts','Executive Notifications','Live Operations Feed','Executive Timeline','Recent Activity','AI Executive Brief','Risk Summary','Global Search','Executive Quick Actions','Executive Favorites','Saved Views','Executive Analytics'],
      missionControl:true
    },
    super_admin:{
      label:'Super Admin Workspace',
      mission:'Operate platform services, customer environments, security controls and support without assuming executive authority.',
      aliases:['super_admin','operations_manager','platform_operator'],
      views:['mission_control','home','explorer','workflow','review','approvals','governance','investigations','risk','compliance','replay','tasks','knowledge','collaboration','versions','notifications','executive'],
      capabilities:['Platform Health','Organizations','Licensing','Billing','Users','Usage','Queues','Workers','Storage','AI Usage','API Usage','Audit Logs','Global Notifications','System Alerts','Incident Management','Feature Flags','Background Jobs','Platform Analytics','Global Search','Support Tickets','Knowledge Hub Analytics','Publication Analytics','Export Analytics','Security Center','Compliance Status'],
      missionControl:true
    },
    organization_admin:{
      label:'Organization Admin Workspace',
      mission:'Operate one organization, its people, portfolio, authority and governed intelligence.',
      aliases:['org_admin','organization_admin'],
      views:['home','explorer','workflow','review','approvals','tasks','knowledge','collaboration','versions','notifications','executive'],
      capabilities:['Organization Overview','Projects','Teams','Users','Permissions','Departments','Budgets','Research Portfolio','Reports','Collections','Knowledge Usage','Activity Timeline','AI Recommendations','Organization Health','Upcoming Deadlines']
    },
    programme_project:{
      label:'Programme & Project Workspace',
      mission:'Coordinate portfolios, delivery, resources, risks and accountable programme decisions.',
      aliases:['project_manager','head_of_programs','programme_manager'],
      views:['home','explorer','workflow','review','approvals','tasks','collaboration','notifications','executive'],
      capabilities:['Portfolio','Projects','Milestones','Field Progress','Budget Tracking','Deliverables','Timeline','Risk Register','Issues','Approvals','Resource Allocation','Dependencies','Decision Log','Programme Performance']
    },
    monitoring_evaluation:{
      label:'Monitoring & Evaluation Workspace',
      mission:'Track indicators, outcomes, evidence quality and programme learning across reporting cycles.',
      aliases:['me_officer','monitoring_officer','evaluation_officer'],
      views:['home','explorer','workflow','review','tasks','knowledge','versions','notifications','executive'],
      capabilities:['Survey Progress','Response Rates','Indicators','Logframes','Outcome Tracking','Impact Tracking','Baseline','Midline','Endline','Evidence Matrix','Research Quality','Datasets','Visualizations','Indicator Explorer']
    },
    research_team:{
      label:'Research Team Workspace',
      mission:'Design studies, govern evidence and perform reproducible quantitative, qualitative and AI-assisted analysis.',
      aliases:['researcher','data_analyst','analyst','research_lead','ai_analyst','ai_reviewer','publication_editor','knowledge_steward','editor'],
      views:['home','explorer','workflow','review','tasks','knowledge','versions','notifications','executive'],
      capabilities:['Studies','Research Questions','Sampling','Questionnaires','Datasets','Analysis Specifications','Analysis Runs','Qualitative Coding','Mixed Methods','Findings','Insights','Uncertainty','Evidence Lineage','AI Contributions','Research Summaries','Knowledge Products']
    },
    quality_assurance:{
      label:'Quality Assurance Workspace',
      mission:'Identify evidence risk early and coordinate review, correction and escalation.',
      aliases:['quality_reviewer','qa_officer','quality_assurance'],
      views:['home','explorer','workflow','review','investigations','risk','tasks','versions','notifications'],
      capabilities:['Interview Quality','GPS Validation','Enumerator Performance','Duplicate Detection','Audio Review','Evidence Review','Consent Review','Completion Quality','Quality Scores','Corrective Actions','Escalations']
    },
    field_supervisor:{
      label:'Field Supervisor Workspace',
      mission:'Coordinate field teams, daily delivery, synchronization and quality response.',
      aliases:['field_supervisor','supervisor'],
      views:['home','workflow','review','tasks','notifications'],
      capabilities:['Assigned Teams','Field Progress','Enumerator Locations','Daily Targets','Issues','Quality Alerts','Approvals','Offline Sync Status','Communication','Assignments']
    },
    enumerator:{
      label:'Enumerator Workspace',
      mission:'Complete assigned fieldwork safely, accurately and with clear synchronization status.',
      aliases:['enumerator','field_worker','viewer'],
      views:['home','tasks','notifications'],
      capabilities:['My Assignments',"Today's Tasks",'Assigned Surveys','Offline Status','Synchronization','Completed Interviews','Pending Interviews','GPS Status','Notifications','Messages','Training Materials','Profile','Settings'],
      minimal:true
    }
  };

  const aliasMap=new Map(Object.entries(profiles).flatMap(([id,profile])=>profile.aliases.map(alias=>[alias,id])));
  function resolve(role){
    const id=aliasMap.get(String(role||'').toLowerCase())||'enumerator';
    return {id,...profiles[id],shared:profiles[id].minimal?[]:shared};
  }
  function canView(role,view){return resolve(role).views.includes(view)}
  function canUseMissionControl(role){return Boolean(resolve(role).missionControl)}

  global.VIAWorkspaceOS=Object.freeze({profiles,shared,resolve,canView,canUseMissionControl});
  if(typeof module!=='undefined')module.exports=global.VIAWorkspaceOS;
})(typeof window!=='undefined'?window:globalThis);
