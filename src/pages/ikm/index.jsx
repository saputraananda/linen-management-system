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
    category: "Linen Komersil",
    items: [
      { to: "/valet/serah-terima-custom", icon: FileText, label: "Serah Terima Custom", description: "Form Serah Terima Custom (PxL)", end: false },
      { to: "/valet/kurang-kirim-custom", icon: ClipboardList, label: "Kurang Kirim Custom", description: "Form Kurang Kirim Custom (PxL)", end: false },
    ]
  }
];

export default function ValetPage() {
  return (
    <PageLayout
      menuItems={MENU_ITEMS}
      moduleName="IKM Portal"
      brandIcon={Truck}
      brandTitle="Tim Valet IKM"
      brandSub="By IKM Laundry"
    />
  );
}
