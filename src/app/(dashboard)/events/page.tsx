import { getEventsAction } from "@/features/events/actions/event-actions";
import { EventListView } from "@/features/events/event-list-view";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const res = await getEventsAction();
  const events = res.success && res.data ? res.data : [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 lg:p-8 animate-tab-enter">
      <div className="mx-auto max-w-7xl">
        <EventListView initialEvents={events} />
      </div>
    </div>
  );
}
