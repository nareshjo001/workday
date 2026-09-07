const asyncHandler=require("../utils/asyncHandler"),service=require("../services/notificationService"),ApiError=require("../utils/ApiError");
const list=asyncHandler(async(req,res)=>{await service.materializeExpiringDocuments();await service.materializePaymentAlerts();const items=await service.list(req.user.userId);res.json({items,unread_count:items.filter(x=>!x.read_at).length});});
const read=asyncHandler(async(req,res)=>{const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)throw ApiError.badRequest("Invalid notification id.");if(!await service.markRead(req.user.userId,id))throw ApiError.notFound("Notification not found.");res.status(204).end();});
const readAll=asyncHandler(async(req,res)=>{await service.markAllRead(req.user.userId);res.status(204).end();});
const preferences=asyncHandler(async(req,res)=>res.json({items:await service.preferences(req.user.userId)}));
const preference=asyncHandler(async(req,res)=>{const type=String(req.params.eventType||"").toUpperCase();if(!service.EVENT_TYPES.has(type)||typeof req.body.in_app_enabled!=="boolean")throw ApiError.badRequest("Invalid notification preference.");await service.setPreference(req.user.userId,type,req.body.in_app_enabled);res.status(204).end();});
module.exports={list,read,readAll,preferences,preference};
