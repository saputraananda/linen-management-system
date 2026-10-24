import { HeartPulse, FileText, ScrollText, Users } from 'lucide-react';
import PageLayout from '../../components/PageLayout';

const MENU_ITEMS = [
  {
    category: "Master",
    items: [
      { to: "/rs/master-user-unit", icon: Users, label: "Master User Unit", description: "Akun perawat per ruangan", end: false },
    ]
  },
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
