export default function RouteLoading({ label }: { label: string }) {
  return (
    <main className="route-loading" aria-busy="true">
      <div className="route-loading-content">
        <p className="eyebrow">REVOK</p>
        <span className="route-loading-indicator" aria-hidden="true" />
        <p role="status">Loading {label}...</p>
      </div>
    </main>
  );
}
