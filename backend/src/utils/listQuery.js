const ApiError = require("./ApiError");

const MAX_PAGE_SIZE = 100;

function parseListQuery(query = {}, { allowedSorts, allowedFilters = {} }) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const pageSize = query.pageSize === undefined ? 25 : Number(query.pageSize);
  const sort = query.sort === undefined ? "default" : String(query.sort);
  const order = query.order === undefined ? "desc" : String(query.order).toLowerCase();
  if (!Number.isInteger(page) || page < 1) throw ApiError.badRequest("page must be a positive integer.");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw ApiError.badRequest(`pageSize must be an integer from 1 to ${MAX_PAGE_SIZE}.`);
  }
  if (!Object.hasOwn(allowedSorts, sort)) throw ApiError.badRequest("Unsupported sort field.");
  if (!["asc", "desc"].includes(order)) throw ApiError.badRequest("order must be asc or desc.");
  const filters = {};
  for (const [key, normalizer] of Object.entries(allowedFilters)) {
    if (query[key] !== undefined) filters[key] = normalizer(query[key]);
  }
  return { page, pageSize, sort, order, sortColumn: allowedSorts[sort], filters, offset: (page - 1) * pageSize };
}

function pageResult(items, total, query) {
  return { items, page: query.page, page_size: query.pageSize, total, total_pages: Math.ceil(total / query.pageSize) };
}

function enumFilter(values) {
  const accepted = new Set(values);
  return (value) => {
    const normalized = String(value).trim().toUpperCase();
    if (!accepted.has(normalized)) throw ApiError.badRequest("Unsupported filter value.");
    return normalized;
  };
}

function positiveIntegerFilter(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw ApiError.badRequest("Filter must be a positive integer.");
  return parsed;
}

function isoDateFilter(value) {
  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized) || Number.isNaN(Date.parse(`${normalized}T00:00:00Z`))) {
    throw ApiError.badRequest("Date filters must use YYYY-MM-DD.");
  }
  return normalized;
}

module.exports = { parseListQuery, pageResult, enumFilter, positiveIntegerFilter, isoDateFilter, MAX_PAGE_SIZE };
