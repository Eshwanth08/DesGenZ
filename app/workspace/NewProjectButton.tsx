"use client";

import Link from "next/link";
import { Button } from "@/components/ui";

export default function NewProjectButton() {
  return (
    <Link href="/workspace/new">
      <Button>New project</Button>
    </Link>
  );
}
