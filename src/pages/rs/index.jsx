import { HeartPulse, BarChart3, ClipboardList } from 'lucide-react';
import PageLayout from '../../components/PageLayout';

const MENU_ITEMS = [
  { to: "/rs", icon: HeartPulse, label: "Dashboard", description: "Ringkasan stok linen", end: true },
  { to: "/rs/monitoring", icon: BarChart3, label: "Monitoring", description: "Pantau pengiriman", end: false },
  { to: "/rs/serah-terima", icon: ClipboardList, label: "Serah Terima", description: "Riwayat serah terima", end: false },
];

export default function RSPage() {
  return (
    <PageLayout
      menuItems={MENU_ITEMS}
      moduleName="Hospital Portal"
      brandIcon={HeartPulse}
      brandTitle="RS Linen Management"
      brandSub="PT Intersolusi Karya Mandiri"
    />
  );
}
