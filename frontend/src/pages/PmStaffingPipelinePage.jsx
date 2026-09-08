import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import StaffingPipelineView from "../components/staffing/StaffingPipelineView";
import { getPmStaffingPipeline } from "../services/staffingPipelineService";
import candidateSubmissionService from "../services/candidateSubmissionService";

import CandidateReviewQueue from "../components/staffing/CandidateReviewQueue";

export default function PmStaffingPipelinePage() {
  const [data, setData] = useState(null); const [submissions, setSubmissions] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(null);
  const load = useCallback(async () => { setLoading(true); try { const [pipeline, candidates] = await Promise.all([getPmStaffingPipeline(), candidateSubmissionService.listForPm()]); setData(pipeline); setSubmissions(candidates); setError(null); } catch (e) { setError(e.message); } finally { setLoading(false); } }, []);
  useEffect(() => { load(); }, [load]);
  const decide = async (id, status, reason) => { await candidateSubmissionService.decide(id, status, reason); await load(); };
  return <DashboardLayout title="Staffing Pipeline"><div className="flex flex-col gap-6"><CandidateReviewQueue submissions={submissions} loading={loading} error={error} onDecision={decide} /><StaffingPipelineView data={data} loading={loading} error={error} title="Staffing pipeline" audience="pm" /></div></DashboardLayout>;
}
