import { Truck, ClipboardList, FileText } from 'lucide-react';
import PageLayout from '../../components/PageLayout';

const MENU_ITEMS = [
  {
    category: "Linen",
    items: [
      { to: "/valet", icon: Truck, label: "Dashboard", description: "Ringkasan aktivitas", end: true },
      { to: "/valet/serah-terima-linen", icon: FileText, label: "Serah Terima Linen", description: "Form Serah Terima Linen", end: false },
      { to: "/valet/kurang-kirim-linen", icon: ClipboardList, label: "Kurang Kirim Linen", description: "Form Kurang Kirim Linen", end: false },
    ]
  },
  {
    category: "Gorden",
    items: [
      { to: "/valet/serah-terima-gorden", icon: FileText, label: "Serah Terima Gorden", description: "Form Serah Terima Gorden", end: false },
    ]
  }
];

export default function ValetPage() {
  return (
    <PageLayout
      menuItems={MENU_ITEMS}
      moduleName="IKM Portal"
      brandIcon={Truck}
      brandTitle="Valet Management"
      brandSub="PT Intersolusi Karya Mandiri"
    />
  );
}
