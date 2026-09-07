const service = require('../services/paymentService');
const asyncHandler = require('../utils/asyncHandler');

module.exports = {
  record: asyncHandler(async (req, res) => res.status(201).json(await service.record(req.user.userId, req.params.id, req.body, { ...req.user, requestId: req.requestId }))),
};
