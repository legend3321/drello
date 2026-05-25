import { Button } from "@/components/ui/button";

export default function ShadcnDemo() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground space-y-4 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Shadcn UI + Tailwind CSS</h1>
      <p className="text-muted-foreground text-lg text-center max-w-md">
        This page demonstrates that Tailwind CSS and Shadcn UI components are fully configured and functional.
      </p>
      <div className="flex gap-4">
        <Button>Default Button</Button>
        <Button variant="secondary">Secondary Button</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
    </div>
  );
}
