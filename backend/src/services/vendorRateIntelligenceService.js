const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const access = require("../repositories/vendorAccessRepository");
const contractors = require("../repositories/contractorRepository");
const repository = require("../repositories/vendorRateIntelligenceRepository");
const { comparableStatistics } = require("../utils/percentiles");
const { createFinding } = require("../utils/intelligenceFinding");
const { MIN_COMPARABLE_SAMPLE, ENGINE, VERSION } = require("../constants/vendorRateIntelligence");

const money = (value) => Math.round(Number(value) * 100) / 100;
const source = { engine: ENGINE, version: VERSION };
const finding = (code, severity, title, summary, evidence, recommended_action) => createFinding({ code, severity, title, summary, evidence, recommended_action, source });

function marginFor(rate, cost) {
  const amount = money(rate - cost);
  return { rate: money(rate), margin_per_hour: amount, margin_percentage: rate ? money((amount / rate) * 100) : null };
}

function selectComparables(levelOne, levelTwo) {
  if (levelOne.length >= MIN_COMPARABLE_SAMPLE) return { scope: "VENDOR_SKILL_CLIENT", values: levelOne };
  if (levelTwo.length >= MIN_COMPARABLE_SAMPLE) return { scope: "VENDOR_SKILL_CURRENCY", values: levelTwo };
  return { scope: "VENDOR_SKILL_CURRENCY", values: levelTwo };
}

async function analyze(vendorId, input) {
  if (!env.intelligence.vendorRateIntelligence) throw ApiError.notFound("Vendor Rate Intelligence is not available.");
  if (!await access.hasProjectAccess(input.projectId, vendorId)) throw ApiError.notFound("Project not found.");
  const context = await repository.getContext(vendorId, input.contractorId, input.projectId, input.requirementId);
  if (!context) {
    const ownedContractor = await contractors.findByVendorAndId(vendorId, input.contractorId);
    if (!ownedContractor) throw ApiError.notFound("Contractor not found.");
    throw ApiError.notFound("Requirement not found on this project.");
  }
  if (!await contractors.hasActiveSkillForContractor(require("../config/db").pool, context.contractor_id, context.skill)) {
    throw ApiError.conflict("Contractor is not eligible for this requirement.");
  }
  const rateCard = await repository.getApplicableRateCard(vendorId, context);
  const projectCurrency = context.project_currency ? String(context.project_currency).toUpperCase() : null;
  const cardCurrency = rateCard?.currency ? String(rateCard.currency).toUpperCase() : null;
  if (projectCurrency && cardCurrency && projectCurrency !== cardCurrency) throw ApiError.conflict("Commercial currency is inconsistent for this analysis.");
  const currency = cardCurrency || projectCurrency;
  if (!currency) throw ApiError.conflict("Commercial currency is unavailable for this analysis.");
  const costRate = money(rateCard?.cost_rate ?? context.contractor_cost_rate);
  const [levelOne, levelTwo] = await Promise.all([
    repository.listComparableSnapshots(vendorId, context.skill_id, currency, context.client_company_id),
    repository.listComparableSnapshots(vendorId, context.skill_id, currency),
  ]);
  const selected = selectComparables(levelOne, levelTwo);
  const findings = [];
  let comparables = { scope: selected.scope, sample_size: selected.values.length };
  let recommendation = { status: "INSUFFICIENT_DATA", lower: null, suggested: null, upper: null, basis: "INTERNAL_HISTORICAL_COMPARABLES" };
  if (selected.values.length >= MIN_COMPARABLE_SAMPLE) {
    const stats = comparableStatistics(selected.values);
    comparables = { scope: selected.scope, ...Object.fromEntries(Object.entries(stats).map(([key, value]) => [key, money(value)])) };
    recommendation = { status: "AVAILABLE", lower: comparables.p25, suggested: comparables.median, upper: comparables.p75, basis: "INTERNAL_HISTORICAL_COMPARABLES" };
  } else {
    findings.push(finding("RATE_INTELLIGENCE_INSUFFICIENT_DATA", "INFO", "Not enough internal comparable assignments", `We found ${selected.values.length} comparable historical assignment${selected.values.length === 1 ? "" : "s"}; at least ${MIN_COMPARABLE_SAMPLE} are required before presenting a historical rate recommendation.`, [{ key: "comparable_count", label: "Comparable historical assignments", value: selected.values.length }, { key: "minimum_sample", label: "Minimum sample required", value: MIN_COMPARABLE_SAMPLE }], "Review the available commercial context; no historical rate recommendation is available yet."));
  }
  let proposedRate = null;
  if (input.proposedBillRate !== null) {
    proposedRate = marginFor(input.proposedBillRate, costRate);
    const baseEvidence = [{ key: "proposed_bill_rate", label: "Proposed bill rate", value: proposedRate.rate, unit: `${currency}/hour` }, { key: "cost_rate", label: "Authoritative cost rate", value: costRate, unit: `${currency}/hour` }, { key: "margin_per_hour", label: "Margin per hour", value: proposedRate.margin_per_hour, unit: `${currency}/hour` }, { key: "margin_percentage", label: "Margin percentage", value: proposedRate.margin_percentage, unit: "%" }];
    if (proposedRate.rate < costRate) findings.push(finding("PROPOSED_RATE_BELOW_COST", "HIGH", "Proposed rate is below cost", "The proposed bill rate is below the authoritative Vendor cost basis.", baseEvidence, "Review the proposed rate before quoting."));
    if (recommendation.status === "AVAILABLE") {
      const rangeEvidence = [...baseEvidence, { key: "historical_p25", label: "Historical comparable lower bound", value: comparables.p25, unit: `${currency}/hour` }, { key: "historical_p75", label: "Historical comparable upper bound", value: comparables.p75, unit: `${currency}/hour` }];
      if (proposedRate.rate < comparables.p25) findings.push(finding("PROPOSED_RATE_BELOW_COMPARABLE_RANGE", "MEDIUM", "Proposed rate is below the historical comparable range", "The proposed rate is below the lower bound of recent comparable Vendor assignments.", rangeEvidence, "Review the proposed rate against the internal comparable range."));
      else if (proposedRate.rate > comparables.p75) findings.push(finding("PROPOSED_RATE_ABOVE_COMPARABLE_RANGE", "MEDIUM", "Proposed rate is above the historical comparable range", "The proposed rate is above the upper bound of recent comparable Vendor assignments.", rangeEvidence, "Review the proposed rate against the internal comparable range."));
      else findings.push(finding("PROPOSED_RATE_WITHIN_COMPARABLE_RANGE", "INFO", "Proposed rate is within the historical comparable range", "The proposed rate falls within the internal comparable band for this scope.", rangeEvidence, "Proceed with normal Vendor commercial review."));
    }
  }
  return {
    contract_version: "1",
    context: { contractor: { id: context.contractor_id, name: context.contractor_name }, project: { id: context.project_id, name: context.project_name }, requirement: { id: context.requirement_id, skill: context.skill }, currency },
    cost: { rate: costRate }, proposed_rate: proposedRate, comparables,
    constraints: { applicable_rate_card: rateCard ? { id: rateCard.id, bill_rate: money(rateCard.bill_rate), cost_rate: money(rateCard.cost_rate), currency } : null, hard_constraint: null },
    recommendation, findings,
  };
}

module.exports = { analyze, marginFor, selectComparables };
