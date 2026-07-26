import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { workspaceRoutes } from "@/config/navigation";
import { COMMAND_PALETTE_EVENT } from "@/config/events";
import { Search, Sparkles } from "lucide-react";

export const CommandPalette = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };

    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener(COMMAND_PALETTE_EVENT, onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(COMMAND_PALETTE_EVENT, onOpen);
    };
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search workspace, jump to views, or run quick actions..." />
      <CommandList>
        <CommandEmpty>No underwriting action matched your search.</CommandEmpty>
        <CommandGroup heading="Navigate">
          {workspaceRoutes.map((route) => {
            const Icon = route.icon;
            return (
              <CommandItem
                key={route.to}
                value={`${route.label} ${route.description}`}
                onSelect={() => {
                  navigate(route.to);
                  setOpen(false);
                }}
              >
                <Icon className="mr-2 h-4 w-4" />
                <div className="flex flex-col">
                  <span>{route.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {route.description}
                  </span>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Quick Actions">
          <CommandItem
            onSelect={() => {
              navigate("/document-analyzer");
              setOpen(false);
            }}
          >
            <Search className="mr-2 h-4 w-4" />
            Open ingestion workspace
            <CommandShortcut>U</CommandShortcut>
          </CommandItem>
          <CommandItem
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Toggle {resolvedTheme === "dark" ? "light" : "dark"} theme
            <CommandShortcut>Theme</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};
