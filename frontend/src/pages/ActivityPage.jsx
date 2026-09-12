import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import ActivityList from "../components/activity/ActivityList";
import auditActivityService from "../services/auditActivityService";

export default function ActivityPage({ role }) {
  const [activity, setActivity] = useState(null); const [isLoading, setIsLoading] = useState(true); const [error, setError] = useState(null); const [page, setPage] = useState(1);
  const load = useCallback(async (requestedPage = 1) => { setIsLoading(true); setError(null); setPage(requestedPage); try { setActivity(await auditActivityService[role](requestedPage)); } catch { setError(true); } finally { setIsLoading(false); } }, [role]);
  useEffect(() => { load(); }, [load]);
  return <DashboardLayout title="Activity"><div className="mx-auto flex max-w-4xl flex-col gap-5"><ActivityList activity={activity} isLoading={isLoading} error={error} onRetry={() => load(page)} onPrevious={() => load(page - 1)} onNext={() => load(page + 1)} /></div></DashboardLayout>;
}
