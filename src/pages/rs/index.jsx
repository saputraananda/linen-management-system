import { HeartPulse, FileText } from 'lucide-react';
import PageLayout from '../../components/PageLayout';

const MENU_ITEMS = [
  {
    category: "Linen",
    items: [
      { to: "/rs/dashboard", icon: HeartPulse, label: "Dashboard", description: "Ringkasan stok linen", end: true },
      { to: "/rs/serah-terima-linen", icon: FileText, label: "Serah Terima Linen", description: "Form Serah Terima Linen", end: false },
    ]
  },
  {
    category: "Gorden",
    items: [
      { to: "/rs/serah-terima-gorden", icon: FileText, label: "Serah Terima Gorden", description: "Form Serah Terima Gorden", end: false },
    ]
  }
];

export default function RSPage() {
  return (
    <PageLayout
      menuItems={MENU_ITEMS}
      moduleName="Hospital Portal"
      brandIcon={HeartPulse}
      brandTitle="Hospital Linen System"
      brandSub="By IKM"
    />
  );
}
