import SiteFooter from "@/components/site/SiteFooter";
import SiteHeader from "@/components/site/SiteHeader";
import HomeHeroSection from "@/components/site/HomeHeroSection";
import HomeIntro from "@/components/site/HomeIntro";
import styles from "./HomePage.module.css";
import { requireCanBrowse } from "@/lib/auth/guards";

export default async function Home() {
  let user = null;
  try {
    user = await requireCanBrowse();
  } catch {
    // Public navigation remains available when there is no active session.
  }

  return (
    <>
      <HomeIntro />
      <div className={`site-page ${styles.homePage}`}>
        <SiteHeader home />
        <main><HomeHeroSection signedIn={Boolean(user)} /></main>
        <SiteFooter />
      </div>
    </>
  );
}
