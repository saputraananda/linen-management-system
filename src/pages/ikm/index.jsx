import { Truck, ClipboardList, FileText } from 'lucide-react';
import PageLayout from '../../components/PageLayout';

const MENU_ITEMS = [
  { to: "/valet", icon: Truck, label: "Dashboard", description: "Ringkasan aktivitas", end: true },
  { to: "/valet/serah-terima-linen", icon: FileText, label: "Serah Terima Linen", description: "Form Serah Terima Linen", end: false },
];

export default function ValetPage() {
  return (
    <PageLayout
      menuItems={MENU_ITEMS}
      moduleName="IKM Portal"
      brandIcon={Truck}
      brandTitle="Valet Linen Management"
      brandSub="PT Intersolusi Karya Mandiri"
    />
  );
}
