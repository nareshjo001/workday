const service=require('../services/dashboardExportService');const asyncHandler=require('../utils/asyncHandler');
module.exports={export:asyncHandler(async(req,res)=>{const data=await service.exportRows(req.user.role,req.user.userId,req.params.dataset,req.query);res.type('text/csv').attachment(`${req.params.dataset}.csv`).send(data);})};
