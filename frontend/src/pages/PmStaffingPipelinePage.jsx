import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import StaffingPipelineView from "../components/staffing/StaffingPipelineView";
import { getPmStaffingPipeline } from "../services/staffingPipelineService";

export default function PmStaffingPipelinePage() { const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(null); const load=useCallback(async()=>{setLoading(true);try{setData(await getPmStaffingPipeline());setError(null);}catch(e){setError(e.message);}finally{setLoading(false);}},[]); useEffect(()=>{load();},[load]); return <DashboardLayout title="Staffing Pipeline"><StaffingPipelineView data={data} loading={loading} error={error} title="Staffing pipeline" audience="pm" /></DashboardLayout>; }
