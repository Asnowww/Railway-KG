import { cn } from "@/lib/utils"

import { buttonVariants } from "@/components/ui/button"

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-sidebar-border bg-background">
      <div className="container flex items-center justify-between p-4 md:px-6">
        <p className="text-xs text-muted-foreground md:text-sm">
          Copyright {currentYear}{" "}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "link" }), "inline p-0")}
          >
            KG知识图谱平台
          </a>
          .
        </p>
      </div>
    </footer>
  )
}
