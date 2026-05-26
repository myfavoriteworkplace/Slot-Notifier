import { notify } from "@/lib/notify";

export function isUnauthorizedError(error: Error): boolean {
  return /^401: .*Unauthorized/.test(error.message);
}

export function redirectToLogin() {
  notify.warning("Session expired", { description: "Please log in again to continue." });
  setTimeout(() => {
    window.location.href = "/api/login";
  }, 1000);
}
