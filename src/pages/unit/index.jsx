import { LayoutDashboard } from 'lucide-react';
import PageLayout from '../../components/PageLayout';

const MENU_ITEMS = [
  {
    category: "Linen",
    items: [
      { to: "/unit", icon: LayoutDashboard, label: "Dashboard", description: "Ringkasan stok linen ruangan", end: true }
    ]
  }
];

export default function UnitPage() {
  return (
    <PageLayout
      menuItems={MENU_ITEMS}
      moduleName="Unit Linen System"
      brandIcon={LayoutDashboard}
      brandTitle="Tim Unit Hospital"
      brandSub="By IKM Laundry"
    />
  );
}
