const env = require("../config/env");
const { ROLES } = require("../constants/roles");
const { INTELLIGENCE_CONTRACT_VERSION } = require("../constants/intelligence");

function getCapabilities(role) {
  const capabilities = {
    vendor_rate_intelligence: role === ROLES.VENDOR ? env.intelligence.vendorRateIntelligence : false,
    pm_project_control: role === ROLES.PM ? env.intelligence.pmProjectControl : false,
    contractor_timesheet_intelligence: role === ROLES.CONTRACTOR ? env.intelligence.contractorTimesheetIntelligence : false,
    ai_explanations: env.intelligence.aiExplanations,
  };
  return { intelligence_contract_version: INTELLIGENCE_CONTRACT_VERSION, capabilities };
}

module.exports = { getCapabilities };
