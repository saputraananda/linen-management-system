import { LayoutDashboard, UserCog } from 'lucide-react';
import PageLayout from '../../components/PageLayout';

// Dihitung saat render (bukan saat import) agar menu muncul setelah login tanpa reload
const getMenuItems = () => [
  {
    category: "Linen",
    items: [
      { to: "/unit", icon: LayoutDashboard, label: "Dashboard", description: "Ringkasan stok linen ruangan", end: true },
      ...(localStorage.getItem('nurseName') ? [{ to: "/unit/profile", icon: UserCog, label: "Profil Saya", description: "Ubah nama, username, password", end: false }] : [])
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
