import { HeartPulse, FileText, ScrollText } from 'lucide-react';
import PageLayout from '../../components/PageLayout';

const MENU_ITEMS = [
  {
    category: "Linen",
    items: [
      { to: "/rs/dashboard", icon: HeartPulse, label: "Dashboard", description: "Ringkasan stok linen", end: true },
      { to: "/rs/serah-terima-linen", icon: FileText, label: "Serah Terima Linen", description: "Form Serah Terima Linen", end: false },
      { to: "/rs/bast-linen-sewa", icon: ScrollText, label: "BAST Linen Sewa", description: "Riwayat pengiriman & penarikan", end: false },
    ]
  },
  {
    category: "Linen Komersil",
    items: [
      { to: "/rs/serah-terima-komersil", icon: FileText, label: "Serah Terima Komersil", description: "Form Serah Terima Komersil (PxL)", end: false },
    ]
  }
];

export default function RSPage() {
  return (
    <PageLayout
      menuItems={MENU_ITEMS}
      moduleName="Hospital Portal"
      brandIcon={HeartPulse}
      brandTitle="Tim Linen Hospital"
      brandSub="By IKM Laundry"
    />
  );
}
