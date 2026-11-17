import { LayoutDashboard, UserCog, MessageSquareWarning, FileText } from 'lucide-react';
import PageLayout from '../../components/PageLayout';

// Dihitung saat render (bukan saat import) agar menu muncul setelah login tanpa reload
const getMenuItems = () => [
  {
    category: "Linen",
    items: [
      { to: "/unit", icon: LayoutDashboard, label: "Dashboard", description: "Ringkasan stok linen ruangan", end: true },
      { to: "/unit/serah-terima-linen", icon: FileText, label: "Serah Terima Linen", description: "Riwayat serah terima unit Anda", end: false },
      { to: "/unit/complaint", icon: MessageSquareWarning, label: "Komplain", description: "Ajukan & pantau komplain", end: false },
      ...(localStorage.getItem('nurseName') ? [{ to: "/unit/profile", icon: UserCog, label: "Profil Saya", description: "Ubah nama, username, password", end: false }] : [])
    ]
  },
  {
    category: "Linen Komersil",
    items: [
      { to: "/unit/serah-terima-komersil", icon: FileText, label: "Serah Terima Komersil", description: "Riwayat serah terima komersil", end: false }
    ]
  }
];

export default function UnitPage() {
  return (
    <PageLayout
      menuItems={getMenuItems()}
      moduleName="Unit Linen System"
      brandIcon={LayoutDashboard}
      brandTitle="Tim Unit Hospital"
      brandSub="By IKM Laundry"
    />
  );
}
