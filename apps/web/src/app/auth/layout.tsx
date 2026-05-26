/**
 * Auth layout — overrides the dark body text color (rgb(245,247,251))
 * so form inputs on white cards render with legible dark text.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ color: '#111827' }}>
      {children}
    </div>
  );
}
