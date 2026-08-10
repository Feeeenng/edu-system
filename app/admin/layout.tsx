import { AdminSessionProvider } from "@/components/admin/AdminSessionProvider";
import { ManagementUiProvider } from "@/components/ui/ManagementUiProvider";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ManagementUiProvider>
      <AdminSessionProvider>{children}</AdminSessionProvider>
    </ManagementUiProvider>
  );
}
