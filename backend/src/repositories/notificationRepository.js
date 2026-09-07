const { pool } = require("../config/db");
async function enabled(userId,eventType){const [r]=await pool.query("SELECT in_app_enabled FROM notification_preferences WHERE user_id=? AND event_type=?",[userId,eventType]);return !r[0]||!!r[0].in_app_enabled;}
async function create(item){const [r]=await pool.query("INSERT IGNORE INTO notifications (recipient_id,event_type,entity_type,entity_id,message,deep_link) VALUES (?,?,?,?,?,?)",[item.recipientId,item.eventType,item.entityType,item.entityId,item.message,item.deepLink]);return r.affectedRows>0;}
async function list(userId){const [r]=await pool.query("SELECT id,event_type,entity_type,entity_id,message,deep_link,read_at,created_at FROM notifications WHERE recipient_id=? ORDER BY created_at DESC LIMIT 100",[userId]);return r;}
async function markRead(userId,id){const [r]=await pool.query("UPDATE notifications SET read_at=COALESCE(read_at,NOW()) WHERE id=? AND recipient_id=?",[id,userId]);return r.affectedRows>0;}
async function markAllRead(userId){await pool.query("UPDATE notifications SET read_at=NOW() WHERE recipient_id=? AND read_at IS NULL",[userId]);}
async function preferences(userId){const [r]=await pool.query("SELECT event_type,in_app_enabled FROM notification_preferences WHERE user_id=?",[userId]);return r;}
async function setPreference(userId,eventType,enabled){await pool.query("INSERT INTO notification_preferences(user_id,event_type,in_app_enabled) VALUES (?,?,?) ON DUPLICATE KEY UPDATE in_app_enabled=VALUES(in_app_enabled)",[userId,eventType,enabled?1:0]);}
async function contractorUserId(contractorId){const [r]=await pool.query("SELECT user_id FROM contractors WHERE id=?",[contractorId]);return r[0]?.user_id||null;}
async function pmForProject(projectId){const [r]=await pool.query("SELECT pm_id FROM projects WHERE id=?",[projectId]);return r[0]?.pm_id||null;}
module.exports={enabled,create,list,markRead,markAllRead,preferences,setPreference,contractorUserId,pmForProject};
