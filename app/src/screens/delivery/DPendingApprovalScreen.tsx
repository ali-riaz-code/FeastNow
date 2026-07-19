// Stubbed in Task 12; real pending-approval UI arrives in Task 17.
export function DPendingApprovalScreen({ refresh }: { refresh: () => Promise<void> }) {
  void refresh;
  return (
    <section className="dscreen">
      <h1 className="dscreen__title serif">Application under review</h1>
      <p>We're reviewing your rider application. You'll be able to start delivering once approved.</p>
    </section>
  );
}
