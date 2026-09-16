import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="text-center">
        <p className="text-5xl font-bold text-accent">404</p>
        <p className="mt-2 text-text-secondary">This page or portal link doesn&apos;t exist.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-accent hover:underline">
          Back to DesGenZ
        </Link>
      </div>
    </main>
  );
}
