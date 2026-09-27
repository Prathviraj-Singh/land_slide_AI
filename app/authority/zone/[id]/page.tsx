import React from 'react';

// TODO: Implement specific high-risk zone detail page (sensors, history, telemetry)
export default async function ZoneDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = await Promise.resolve(params);
  return (
    <main>
      <h1>Zone Detail: {resolvedParams.id}</h1>
    </main>
  );
}
