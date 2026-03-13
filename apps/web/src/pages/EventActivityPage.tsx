import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { api } from "../api/client";

type ActivityItem = {
  id: string;
  occurredAt: string;
  type: string;
  actor: { type: string; id: string | null };
  aggregate: { type: string; id: string };
  summary: string;
};

type ActivityResponse = {
  items: ActivityItem[];
  nextCursor: string | null;
};

export function EventActivityPage() {
  const { eventId = "" } = useParams();
  const [types, setTypes] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({ types: "" });

  const queryStringBase = useMemo(() => {
    const q = new URLSearchParams();
    q.set("limit", "50");
    if (appliedFilters.types) q.set("types", appliedFilters.types);
    return q;
  }, [appliedFilters]);

  const query = useInfiniteQuery({
    queryKey: ["activity", eventId, appliedFilters],
    enabled: Boolean(eventId),
    initialPageParam: "",
    queryFn: ({ pageParam }) => {
      const q = new URLSearchParams(queryStringBase);
      if (pageParam) q.set("cursor", pageParam);
      return api<ActivityResponse>(`/events/${eventId}/activity?${q.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });

  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div>
      <h2>Actividad del evento</h2>
      <p>Event ID: <code>{eventId}</code></p>
      <input placeholder="types (coma)" value={types} onChange={(e) => setTypes(e.target.value)} />
      <button onClick={() => setAppliedFilters({ types })}>Aplicar filtros</button>

      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <strong>{item.type}</strong> - {item.summary} - {new Date(item.occurredAt).toLocaleString()}
            <div>actor: {item.actor.type}{item.actor.id ? `:${item.actor.id}` : ""}</div>
            <div>entidad: {item.aggregate.type}:{item.aggregate.id}</div>
          </li>
        ))}
      </ul>

      {query.hasNextPage && <button disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>Cargar más</button>}
    </div>
  );
}
