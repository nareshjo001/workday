const repo=require("../repositories/notificationRepository");
const { pool }=require('../config/db');
const EVENT_TYPES=new Set(["CANDIDATE_SUBMITTED","CANDIDATE_ACCEPTED","CANDIDATE_REJECTED","ASSIGNMENT_CREATED","ASSIGNMENT_RELEASED","TIMESHEET_SUBMITTED","TIMESHEET_APPROVED","TIMESHEET_REJECTED","DOCUMENT_EXPIRING","MILESTONE_MET","BILLING_ELIGIBLE","INVOICE_SUBMITTED","INVOICE_APPROVED","INVOICE_REJECTED","PAYMENT_RECORDED","INVOICE_PAID","PAYMENT_DUE_SOON","INVOICE_OVERDUE"]);
async function notifyDetailed(item){
  if(!EVENT_TYPES.has(item.eventType)) throw new Error("Unsupported notification event type.");
  if(!await repo.enabled(item.recipientId,item.eventType)) return "preference_skipped";
  return await repo.create(item) ? "created" : "deduplicated";
}
async function notify(item){try{return (await notifyDetailed(item))==="created";}catch(_){return false;}}
async function materializePaymentAlerts(){const summary={evaluated:0,created:0,deduplicated:0,preference_skipped:0,errors:0};const [invoices]=await pool.query(`SELECT i.id,i.due_date,p.pm_id,COALESCE(SUM(pay.amount),0) paid_amount,i.total_amount
  FROM invoices i JOIN projects p ON p.id=i.project_id LEFT JOIN payments pay ON pay.invoice_id=i.id
  WHERE i.status='APPROVED' AND i.due_date IS NOT NULL GROUP BY i.id,i.due_date,p.pm_id,i.total_amount
  HAVING paid_amount < i.total_amount`);const today=new Date().toISOString().slice(0,10);const soon=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
  for(const invoice of invoices){const eventType=invoice.due_date<today?'INVOICE_OVERDUE':invoice.due_date<=soon?'PAYMENT_DUE_SOON':null;if(eventType){summary.evaluated+=1;try{summary[await notifyDetailed({recipientId:invoice.pm_id,eventType,entityType:'invoice',entityId:invoice.id,message:eventType==='INVOICE_OVERDUE'?'An approved invoice is overdue.':'An approved invoice is due soon.',deepLink:'/pm/invoices'})]+=1;}catch(_){summary.errors+=1;}}}return summary;}
async function preferences(userId){const saved=new Map((await repo.preferences(userId)).map(x=>[x.event_type,!!x.in_app_enabled]));return [...EVENT_TYPES].map(event_type=>({event_type,in_app_enabled:saved.get(event_type)??true}));}
module.exports={notify,notifyDetailed,materializePaymentAlerts,EVENT_TYPES,...repo,preferences};
