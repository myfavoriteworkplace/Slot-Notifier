import type { ComponentProps } from "react";
import AdminOperationsOverview from "@/components/AdminOperationsOverview";

type TenantOperationsProps = Omit<ComponentProps<typeof AdminOperationsOverview>, "view">;

export default function AdminTenantOperations(props: TenantOperationsProps) {
  return <AdminOperationsOverview {...props} view="tenant" />;
}