import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import ActivityList from "../components/activity/ActivityList";
import auditActivityService from "../services/auditActivityService";

export default function ActivityPage({ role }) {
  const [activity, setActivity] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);

  const load = useCallback(
    async (requestedPage = 1, isBackgroundRefresh = false) => {
      if (isBackgroundRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      setPage(requestedPage);
      try {
        setActivity(await auditActivityService[role](requestedPage));
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [role]
  );

  useEffect(() => {
    load(1, false);
  }, [load]);

  const handleRefresh = useCallback(() => {
    load(page, Boolean(activity));
  }, [load, page, activity]);

  return (
    <DashboardLayout title="Activity">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <ActivityList
          activity={activity}
          isLoading={isLoading}
          isRefreshing={isRefreshing}
          error={error}
          onRetry={handleRefresh}
          onPrevious={() => load(page - 1, false)}
          onNext={() => load(page + 1, false)}
          description={role === "pm" ? "Track important events across the projects and workflows you manage." : undefined}
        />
      </div>
    </DashboardLayout>
  );
}
