import { ItineraryView } from "@/components/itinerary/itinerary-view";
export default async function PlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ItineraryView id={id} />;
}
