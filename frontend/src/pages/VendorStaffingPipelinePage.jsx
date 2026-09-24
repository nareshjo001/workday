import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import StaffingPipelineView from "../components/staffing/StaffingPipelineView";
import { getVendorStaffingPipeline } from "../services/staffingPipelineService";

export default function VendorStaffingPipelinePage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getVendorStaffingPipeline());
      setLastUpdated(new Date());
      setError(null);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return <DashboardLayout title="Staffing Pipeline">
    <StaffingPipelineView
      data={data}
      loading={loading}
      error={error}
      title="Client staffing pipeline"
      audience="vendor"
      lastUpdated={lastUpdated}
      onRefresh={load}
    />
  </DashboardLayout>;
}
