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
      { to: "/valet/serah-terima-komersil", icon: FileText, label: "Serah Terima Komersil", description: "Form Serah Terima Komersil (PxL)", end: false },
      { to: "/valet/kurang-kirim-komersil", icon: ClipboardList, label: "Kurang Kirim Komersil", description: "Form Kurang Kirim Komersil (PxL)", end: false },
    ]
  }
];

export default function ValetPage() {
  return (
    <PageLayout
      menuItems={MENU_ITEMS}
      moduleName="IKM Portal"
      brandIcon={Truck}
      brandTitle="Tim Linen IKM"
      brandSub="By IKM Laundry"
    />
  );
}
