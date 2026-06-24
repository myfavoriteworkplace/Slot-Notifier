#!/usr/bin/env python3
"""
Panel Import Audit — catches missing imports in extracted panel components
before a Render deploy.

Usage:
    python3 script/audit-panel-imports.py

Add new panel files to the PANELS list as more panels are extracted.
See docs/panel-import-audit.md for full documentation.
"""

import re
import sys

# ── Add new panel paths here as more panels are extracted ─────────────────────
PANELS = [
    "client/src/components/BookingsPanel.tsx",
    "client/src/components/AccountsPanel.tsx",
    "client/src/components/PatientDirectoryPanel.tsx",
    "client/src/components/ManageDoctorsPanel.tsx",
    "client/src/components/ClinicProfilePanel.tsx",
]

# ── PascalCase identifiers that are NOT lucide icons ─────────────────────────
# Add false-positives here with a comment explaining what they are.
NON_LUCIDE = {
    # React core
    "React", "Fragment", "Suspense", "StrictMode",

    # shadcn/ui primitives
    "Alert", "AlertTitle", "AlertDescription",
    "AlertDialog", "AlertDialogAction", "AlertDialogCancel", "AlertDialogContent",
    "AlertDialogDescription", "AlertDialogFooter", "AlertDialogHeader",
    "AlertDialogTitle", "AlertDialogTrigger",
    "Avatar", "AvatarFallback", "AvatarImage",
    "Badge",
    "Button",
    "Calendar",
    "Card", "CardContent", "CardDescription", "CardFooter", "CardHeader", "CardTitle",
    "Checkbox",
    "Collapsible", "CollapsibleContent", "CollapsibleTrigger",
    "Command", "CommandEmpty", "CommandGroup", "CommandInput", "CommandItem", "CommandList",
    "Dialog", "DialogClose", "DialogContent", "DialogDescription", "DialogFooter",
    "DialogHeader", "DialogTitle", "DialogTrigger",
    "DropdownMenu", "DropdownMenuContent", "DropdownMenuGroup", "DropdownMenuItem",
    "DropdownMenuLabel", "DropdownMenuSeparator", "DropdownMenuSub",
    "DropdownMenuSubContent", "DropdownMenuSubTrigger", "DropdownMenuTrigger",
    "Form", "FormControl", "FormDescription", "FormField", "FormItem", "FormLabel", "FormMessage",
    "Input",
    "Label",
    "Popover", "PopoverContent", "PopoverTrigger",
    "Progress",
    "RadioGroup", "RadioGroupItem",
    "ScrollArea", "ScrollBar",
    "Select", "SelectContent", "SelectGroup", "SelectItem", "SelectLabel",
    "SelectTrigger", "SelectValue",
    "Separator",
    "Sheet", "SheetClose", "SheetContent", "SheetDescription", "SheetFooter",
    "SheetHeader", "SheetTitle", "SheetTrigger",
    "Skeleton",
    "Switch",
    "Table", "TableBody", "TableCaption", "TableCell", "TableFooter",
    "TableHead", "TableHeader", "TableRow",
    "Tabs", "TabsContent", "TabsList", "TabsTrigger",
    "Textarea",
    "Tooltip", "TooltipContent", "TooltipProvider", "TooltipTrigger",

    # Custom project components
    "AppointmentCard",        # client/src/components/AppointmentCard.tsx
    "BookingCardSkeleton",    # defined locally in BookingsPanel.tsx
    "BookingNotesThread",     # client/src/components/BookingNotesThread.tsx
    "BookingProgressStrip",   # client/src/components/BookingProgressStrip.tsx
    "CancelDialog",           # inline component inside BookingsPanel.tsx
    "ClinicalRecordsTab",     # client/src/components/ClinicalRecordsTab.tsx
    "Icon",                   # local variable used as a component alias
    "ImageUpload",            # client/src/components/ImageUpload.tsx
    "MapLocationPicker",      # custom map picker component
    "SpecializationInput",    # custom input component in ManageDoctorsPanel
    "ToothIcon",              # exported from clinic-constants.tsx

    # Type-only identifiers (never runtime values)
    "BillingDetails", "BillingService", "ClinicInfo",
    "BookingWithSlot", "DayConfig", "LifecycleStage", "ModalTabType",
    "Patient", "PatientBill", "PatientHistory",
    "QuickFilterType", "SectionConfig", "SlotTiming",

    # JS / DOM built-ins
    "Array", "Boolean", "Date", "Error", "HTMLDivElement",
    "HTMLInputElement", "HTMLTextAreaElement", "JSON", "Map", "Math",
    "Number", "Object", "Promise", "Set", "String", "Symbol",
    "WeakMap", "WeakSet",
}

# Suffixes that identify non-icon PascalCase identifiers (panels, pages, etc.)
SKIP_SUFFIXES = (
    "Bar", "Block", "Body", "Box", "Card", "Col", "Column", "Config",
    "Container", "Context", "Data", "Details", "Drawer", "Empty", "Error",
    "Footer", "Grid", "Group", "Header", "Hook", "Input", "Item", "Layout",
    "List", "Loading", "Menu", "Modal", "Mode", "Output", "Page", "Panel",
    "Picker", "Props", "Provider", "Records", "Ref", "Row", "Section",
    "Service", "Sidebar", "Skeleton", "State", "Store", "Strip", "Tab",
    "Thread", "Type", "View", "Wrapper",
)


def get_all_imports(content: str) -> set:
    """Extract every imported identifier from all import statements."""
    imported = set()
    # Named imports: import { Foo, Bar as Baz } from '...'
    for m in re.finditer(
        r"import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*['\"][^'\"]+['\"]",
        content,
        re.DOTALL,
    ):
        for ident in re.findall(r"\b([A-Za-z_][A-Za-z0-9_]*)\b", m.group(1)):
            if ident not in ("type", "as"):
                imported.add(ident)
    # Default imports: import Foo from '...'
    for m in re.finditer(r"import\s+([A-Z][A-Za-z0-9_]+)\s+from", content):
        imported.add(m.group(1))
    # Alias targets: { X as Y } — Y is the local name
    for m in re.finditer(r"\bas\s+([A-Za-z_][A-Za-z0-9_]+)", content):
        imported.add(m.group(1))
    return imported


def get_jsx_identifiers(content: str) -> set:
    """Return all PascalCase identifiers used as JSX tags or icon prop values."""
    # Remove import lines to avoid matching the source-module strings
    no_imports = re.sub(r"^import\b.*$", "", content, flags=re.MULTILINE)
    # Blank out string literals to avoid false positives
    no_strings = re.sub(r'"[^"]*"|\'[^\']*\'|`[^`]*`', '""', no_imports, flags=re.DOTALL)
    used: set = set()
    # <FooBar or <FooBar.Something
    used |= set(re.findall(r"<([A-Z][A-Za-z0-9]+)[\s/>]", no_strings))
    # Identifiers passed as prop values: icon={Building2}  X={Foo}
    used |= set(re.findall(r"[{=,\s]([A-Z][A-Za-z0-9]+)\s*[},)\]]", no_strings))
    return used


def audit_panel(path: str) -> list:
    """Return a list of likely-missing import names for the given panel file."""
    with open(path) as f:
        content = f.read()

    imported = get_all_imports(content)
    used = get_jsx_identifiers(content)

    missing = used - imported - NON_LUCIDE
    # Drop identifiers that look like component types, not standalone icons
    return sorted(
        ident for ident in missing
        if not any(ident.endswith(s) for s in SKIP_SUFFIXES)
    )


def main():
    all_ok = True
    for path in PANELS:
        try:
            gaps = audit_panel(path)
        except FileNotFoundError:
            print(f"⚠️  {path}: file not found — skipping")
            continue

        name = path.split("/")[-1]
        if gaps:
            all_ok = False
            print(f"❌  {name}: MISSING IMPORTS → {gaps}")
        else:
            print(f"✅  {name}: OK")

    if not all_ok:
        print("\nFix all missing imports before deploying to Render.")
        sys.exit(1)
    else:
        print("\nAll panels clean — safe to deploy.")


if __name__ == "__main__":
    main()
