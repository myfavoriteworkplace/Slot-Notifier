type HumanisedError = { title: string; description?: string };

const NETWORK_MESSAGES: Record<string, HumanisedError> = {
  "Failed to fetch": {
    title: "You appear to be offline",
    description: "Please check your internet connection and try again.",
  },
  "NetworkError": {
    title: "Connection problem",
    description: "Could not reach the server. Please try again.",
  },
  "Load failed": {
    title: "Connection problem",
    description: "Could not reach the server. Please try again.",
  },
};

const STATUS_MESSAGES: Record<string, HumanisedError> = {
  "400": { title: "Invalid request", description: "Please check the information you entered." },
  "401": { title: "Session expired", description: "Please log in again to continue." },
  "403": { title: "Access denied", description: "You don't have permission to do that." },
  "404": { title: "Not found", description: "The item you're looking for doesn't exist." },
  "409": { title: "Already taken", description: "This slot or record is already in use." },
  "422": { title: "Validation error", description: "Please check the information you entered." },
  "429": { title: "Too many requests", description: "Please wait a moment and try again." },
  "500": { title: "Something went wrong", description: "We hit an error on our end. Please try again." },
  "502": { title: "Server unavailable", description: "We're experiencing issues. Please try again in a moment." },
  "503": { title: "Service unavailable", description: "We're undergoing maintenance. Please check back soon." },
};

export function humaniseError(err: unknown, fallbackTitle?: string): HumanisedError {
  const raw = err instanceof Error ? err.message : String(err ?? "Unknown error");

  for (const [key, value] of Object.entries(NETWORK_MESSAGES)) {
    if (raw.includes(key)) return value;
  }

  const statusMatch = raw.match(/^(\d{3}):/);
  if (statusMatch) {
    const code = statusMatch[1];
    const mapped = STATUS_MESSAGES[code];
    if (mapped) {
      const bodyText = raw.slice(statusMatch[0].length).trim();
      let description = mapped.description;
      try {
        const parsed = JSON.parse(bodyText);
        if (parsed?.message && typeof parsed.message === "string") {
          description = parsed.message;
        }
      } catch {}
      return { title: mapped.title, description };
    }
  }

  if (fallbackTitle) {
    return { title: fallbackTitle, description: raw.length < 120 ? raw : undefined };
  }

  return { title: "Something went wrong", description: raw.length < 120 ? raw : undefined };
}
