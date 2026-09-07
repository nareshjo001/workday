import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import StaffingPipelineView from "../components/staffing/StaffingPipelineView";
import { getVendorStaffingPipeline } from "../services/staffingPipelineService";

export default function VendorStaffingPipelinePage() { const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(null); const load=useCallback(async()=>{setLoading(true);try{setData(await getVendorStaffingPipeline());setError(null);}catch(e){setError(e.message);}finally{setLoading(false);}},[]); useEffect(()=>{load();},[load]); return <DashboardLayout title="Staffing Pipeline"><StaffingPipelineView data={data} loading={loading} error={error} title="Client staffing pipeline" audience="vendor" /></DashboardLayout>; }
