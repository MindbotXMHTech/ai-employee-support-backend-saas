import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-dvh bg-slate-50">
      <main className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center px-6 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Backend as a Service</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
            AI Employee Support Bot Platform
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Multi-tenant backend APIs, RAG knowledge management, safety guardrails, and admin dashboards for existing
            employee support bots.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/dashboard">Tenant Dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/platform">Platform Admin</Link>
            </Button>
          </div>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            ["Tenant Isolation", "RLS policies, API-key tenant resolution, and tenant-filtered vector search."],
            ["RAG Operations", "Document upload, chunking, embeddings, source tracking, and playground testing."],
            ["Usage Controls", "Trial/Pro quota enforcement, token usage, estimated cost, and safety logging."],
          ].map(([title, description]) => (
            <Card key={title}>
              <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-500">Built for existing bot integrations via /api/v1.</CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
