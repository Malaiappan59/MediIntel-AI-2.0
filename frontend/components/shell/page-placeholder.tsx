import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PagePlaceholderProps = {
  title: string;
  description: string;
};

export function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="section-title text-4xl font-semibold text-slate-900">{title}</h1>
        <p className="max-w-3xl text-base text-slate-600">{description}</p>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Placeholder Module</CardTitle>
          <CardDescription>This area is ready for the next operational capability or workflow module.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-[1.5rem] border border-dashed border-sky-200 bg-sky-50/50 p-8 text-sm text-sky-900">
            Navigation, layout, and access controls are active. This module can now be extended with the next MediIntel workflow.
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
