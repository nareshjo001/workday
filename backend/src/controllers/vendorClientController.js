const repo=require('../repositories/vendorClientRepository'),asyncHandler=require('../utils/asyncHandler'),ApiError=require('../utils/ApiError');
const companyId=value=>{const id=Number(value);if(!Number.isInteger(id)||id<1)throw ApiError.badRequest('Invalid client company id.');return id;};
module.exports={list:asyncHandler(async(req,res)=>res.json({items:await repo.list(req.user.userId)})),detail:asyncHandler(async(req,res)=>{const client=await repo.detail(req.user.userId,companyId(req.params.companyId));if(!client)throw ApiError.notFound('Client company not found.');res.json(client);})};
