import AlloyDashboard from "./AlloyDashboard";
import { getAlloyDatabase } from "@/lib/alloyData";

export default function Home() {
  const database = getAlloyDatabase();
  return <AlloyDashboard database={database} />;
}
