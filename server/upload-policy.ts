export type UploadSession = {
  role?: string;
  adminLoggedIn?: boolean;
  doctorLoggedIn?: boolean;
};

export function canRequestImageFolder(sess: UploadSession, folder: string): boolean {
  if (sess.role === "superuser") return true;
  if (sess.role === "owner" && sess.adminLoggedIn) {
    return folder === "clinics" || folder === "doctors";
  }
  if (sess.role === "doctor" && sess.doctorLoggedIn) {
    return folder === "doctors" || folder === "case-media";
  }
  return false;
}