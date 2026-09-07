const repo=require("../repositories/notificationRepository");
const documents=require("../repositories/contractorDocumentRepository");
const EVENT_TYPES=new Set(["CANDIDATE_SUBMITTED","CANDIDATE_ACCEPTED","CANDIDATE_REJECTED","ASSIGNMENT_CREATED","ASSIGNMENT_RELEASED","TIMESHEET_SUBMITTED","TIMESHEET_APPROVED","TIMESHEET_REJECTED","DOCUMENT_EXPIRING","MILESTONE_MET","BILLING_ELIGIBLE","INVOICE_SUBMITTED","INVOICE_APPROVED","INVOICE_REJECTED"]);
async function notify(item){try{if(!EVENT_TYPES.has(item.eventType)||!await repo.enabled(item.recipientId,item.eventType))return false;return await repo.create(item);}catch(_){return false;}}
async function materializeExpiringDocuments(){for(const d of await documents.expiring()){for(const recipientId of [d.user_id,d.vendor_id])await notify({recipientId,eventType:"DOCUMENT_EXPIRING",entityType:"contractor_document",entityId:d.id,message:"A required document needs attention soon.",deepLink:"/vendor/compliance"});}}
async function preferences(userId){const saved=new Map((await repo.preferences(userId)).map(x=>[x.event_type,!!x.in_app_enabled]));return [...EVENT_TYPES].map(event_type=>({event_type,in_app_enabled:saved.get(event_type)??true}));}
module.exports={notify,materializeExpiringDocuments,EVENT_TYPES,...repo,preferences};
