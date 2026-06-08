import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

const DENTAL_SPECIALIZATIONS = [
  "General Dentist",
  "Orthodontist",
  "Periodontist",
  "Endodontist",
  "Oral Surgeon",
  "Prosthodontist",
  "Pediatric Dentist",
  "Cosmetic Dentist",
  "Implantologist",
  "Oral Pathologist",
  "Maxillofacial Surgeon",
  "Dental Radiologist",
  "Restorative Dentist",
  "Neuromuscular Dentist",
  "Geriatric Dentist",
];

interface SpecializationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  "data-testid"?: string;
  required?: boolean;
}

export function SpecializationInput({
  value,
  onChange,
  placeholder = "General Dentist",
  className,
  id,
  "data-testid": testId,
  required,
}: SpecializationInputProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = value.trim()
    ? DENTAL_SPECIALIZATIONS.filter((s) =>
        s.toLowerCase().includes(value.toLowerCase())
      )
    : DENTAL_SPECIALIZATIONS;

  useEffect(() => {
    setHighlighted(-1);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        setOpen(true);
        return;
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0 && filtered[highlighted]) {
      e.preventDefault();
      onChange(filtered[highlighted]);
      setOpen(false);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        data-testid={testId}
        required={required}
        autoComplete="off"
      />

      {open && filtered.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-border/60 bg-background shadow-lg shadow-black/10 overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((spec, i) => (
            <li
              key={spec}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(spec);
                setOpen(false);
              }}
              onMouseEnter={() => setHighlighted(i)}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-100
                ${i === highlighted
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
                }
                ${i !== 0 ? "border-t border-border/40" : ""}
              `}
            >
              {spec}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
