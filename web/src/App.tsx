import { Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Overview } from "@/pages/Overview";
import { Sites } from "@/pages/Sites";
import { SiteDetail } from "@/pages/SiteDetail";
import { Devices } from "@/pages/Devices";
import { Hosts } from "@/pages/Hosts";
import { Alerts } from "@/pages/Alerts";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Overview />} />
        <Route path="sites" element={<Sites />} />
        <Route path="sites/:siteId" element={<SiteDetail />} />
        <Route path="devices" element={<Devices />} />
        <Route path="hosts" element={<Hosts />} />
        <Route path="alerts" element={<Alerts />} />
      </Route>
    </Routes>
  );
}
