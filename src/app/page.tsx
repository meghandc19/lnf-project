import Link from "next/link";

type Item = {
  name: string;
  location: string;
  age: string;
  status: "Lost" | "Found";
  image: string;
};

const lostItems: Item[] = [
  {
    name: "Black Backpack",
    location: "Near Park",
    age: "2h ago",
    status: "Lost",
    image:
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Leather Wallet",
    location: "Cafeteria",
    age: "5h ago",
    status: "Lost",
    image:
      "https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Student ID Card",
    location: "Library",
    age: "1d ago",
    status: "Lost",
    image:
      "https://images.unsplash.com/photo-1589330694653-ded6df03f754?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Smartphone",
    location: "Main Block",
    age: "2d ago",
    status: "Lost",
    image:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=700&q=85",
  },
];

const foundItems: Item[] = [
  {
    name: "Wireless Earbuds",
    location: "Library",
    age: "2h ago",
    status: "Found",
    image:
      "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Car Keys",
    location: "Parking Area",
    age: "6h ago",
    status: "Found",
    image:
      "https://images.unsplash.com/photo-1517524206127-48bbd363f3d7?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Water Bottle",
    location: "Sports Area",
    age: "1d ago",
    status: "Found",
    image:
      "https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=700&q=85",
  },
  {
    name: "Black Jacket",
    location: "Auditorium",
    age: "2d ago",
    status: "Found",
    image:
      "https://images.unsplash.com/photo-1551028949-4e8d5f6e1b2a?auto=format&fit=crop&w=700&q=85",
  },
];

function Icon({
  name,
  size = 20,
}: {
  name: "search" | "arrow" | "pin" | "users" | "box" | "shield" | "heart" | "send" | "menu" | "check";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  switch (name) {
    case "search":
      return <svg {...common}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.2 4.2" /></svg>;
    case "arrow":
      return <svg {...common}><path d="M4.5 12h14" /><path d="m13 6.5 5.5 5.5-5.5 5.5" /></svg>;
    case "pin":
      return <svg {...common}><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.4" /></svg>;
    case "users":
      return <svg {...common}><path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20" /><circle cx="9.5" cy="7" r="3.5" /><path d="M17 11a3.5 3.5 0 0 0 0-7M17 14.5a4 4 0 0 1 4 4V20" /></svg>;
    case "box":
      return <svg {...common}><path d="m12 3 8 4.3v9.4L12 21l-8-4.3V7.3L12 3Z" /><path d="m4.5 7.5 7.5 4 7.5-4M12 12v9" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3 20 6v5.5c0 4.7-3.2 7.7-8 9.5-4.8-1.8-8-4.8-8-9.5V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-5" /></svg>;
    case "heart":
      return <svg {...common}><path d="M20.5 8.8c0 5-8.5 10-8.5 10s-8.5-5-8.5-10A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.4Z" /></svg>;
    case "send":
      return <svg {...common}><path d="m21 3-7.2 18-3.9-7.9L2 9.2 21 3Z" /><path d="M10 13 21 3" /></svg>;
    case "menu":
      return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
    case "check":
      return <svg {...common}><path d="m5 12 4.2 4.2L19 6.5" /></svg>;
  }
}

function ItemCard({ item }: { item: Item }) {
  return (
    <article className="item-card">
      <Link href="/items" className="item-photo-link" aria-label={`View ${item.name}`}>
        {/* Remote image URLs are used for demo cards; replace with approved project images when available. */}
        <img className="item-photo" src={item.image} alt={item.name} loading="lazy" />
        <span className={`status-pill ${item.status.toLowerCase()}`}>{item.status}</span>
      </Link>
      <div className="item-info">
        <div className="item-title-row">
          <h3>{item.name}</h3>
          <span className="item-age">{item.age}</span>
        </div>
        <p className="item-location"><Icon name="pin" size={15} /> {item.location}</p>
        <Link href="/items" className="card-link">View details <Icon name="arrow" size={15} /></Link>
      </div>
    </article>
  );
}

function ItemSection({
  title,
  subtitle,
  items,
  kind,
}: {
  title: string;
  subtitle: string;
  items: Item[];
  kind: "lost" | "found";
}) {
  return (
    <section className={`items-panel ${kind}`} aria-labelledby={`${kind}-heading`}>
      <div className="section-heading">
        <div className={`section-mark ${kind}`}><Icon name="box" size={23} /></div>
        <div className="section-heading-copy">
          <p className="eyebrow">{kind === "lost" ? "NEEDS A WAY HOME" : "READY TO REUNITE"}</p>
          <h2 id={`${kind}-heading`}>{title}</h2>
          <p className="section-subtitle">{subtitle}</p>
        </div>
        <Link href="/items" className="view-all">View all <Icon name="arrow" size={16} /></Link>
      </div>
      <div className="items-grid">
        {items.map((item) => <ItemCard item={item} key={item.name} />)}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="revok-page">
      <header className="site-header">
        <div className="header-inner">
          <Link href="/" className="brand" aria-label="REVOK home">
            <span>RE</span><span className="brand-green">VOK</span><i>.</i>
          </Link>
          <nav className="main-nav" aria-label="Main navigation">
            <Link className="nav-active" href="/">Home</Link>
            <Link href="/items">Browse items</Link>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/about">About</Link>
          </nav>
          <div className="header-actions">
            <Link href="/login" className="login-link">Log in</Link>
            <Link href="/register" className="join-button">Join REVOK <Icon name="arrow" size={16} /></Link>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-image" aria-hidden="true" />
        <div className="hero-wash" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="community-pill"><span className="live-dot" /> A kinder, more connected community</div>
            <h1>Lost Something?<br />Let’s <span>Find It.</span></h1>
            <p className="hero-description">Report, discover, and reunite lost items with their owners. Because every item has a story.</p>
            <form className="search-form" action="/items" method="GET">
              <Icon name="search" size={22} />
              <input name="q" type="search" placeholder="Search for items (e.g. wallet, ID card, phone...)" aria-label="Search lost and found items" />
              <button type="submit" aria-label="Search items"><span>Search</span><Icon name="arrow" size={18} /></button>
            </form>
            <div className="hero-buttons">
              <Link href="/report/lost" className="button button-primary"><Icon name="send" size={19} /> Report lost item <Icon name="arrow" size={17} /></Link>
              <Link href="/report/found" className="button button-secondary"><Icon name="box" size={19} /> Report found item <Icon name="arrow" size={17} /></Link>
            </div>
            <p className="hero-note"><Icon name="check" size={15} /> Simple to use. Community focused. Built to reconnect.</p>
          </div>
          <aside className="hero-note-card">
            <span className="note-card-kicker">EVERY ITEM MATTERS</span>
            <h2>A small discovery can make someone’s day.</h2>
            <p>Help someone find what they thought was lost.</p>
          </aside>
        </div>
      </section>

      <div className="content-wrap">
        <div className="items-columns">
          <ItemSection
            title="Recently Lost Items"
            subtitle="Help bring these belongings back to their owners."
            items={lostItems}
            kind="lost"
          />
          <ItemSection
            title="Recently Found Items"
            subtitle="Check if your lost item has been found."
            items={foundItems}
            kind="found"
          />
        </div>

        <section className="community-stats" aria-label="Community highlights">
          <div className="stat">
            <span className="stat-icon"><Icon name="users" size={26} /></span>
            <div><strong>Community first</strong><span>People helping people</span></div>
          </div>
          <div className="stat">
            <span className="stat-icon"><Icon name="box" size={26} /></span>
            <div><strong>Lost to found</strong><span>Every reunion matters</span></div>
          </div>
          <div className="stat">
            <span className="stat-icon"><Icon name="shield" size={26} /></span>
            <div><strong>Safer connections</strong><span>Designed with care</span></div>
          </div>
        </section>

        <section className="reunion-banner">
          <div className="reunion-pattern" aria-hidden="true" />
          <div className="reunion-copy">
            <p className="eyebrow">BE PART OF A KINDER COMMUNITY</p>
            <h2>Let’s Reunite More <span>Belongings.</span></h2>
            <p>Report items, help others, and make a kinder community together.</p>
          </div>
          <div className="reunion-actions">
            <Link href="/register" className="button button-bright">Join our community <Icon name="arrow" size={17} /></Link>
            <Link href="/items" className="button button-outline-light">Browse items</Link>
          </div>
          <div className="reunion-values">
            <div><Icon name="shield" size={20} /> Reduce losses</div>
            <div><Icon name="users" size={20} /> Help others</div>
            <div><Icon name="heart" size={20} /> Build community</div>
          </div>
        </section>
      </div>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand-block">
            <Link href="/" className="brand"><span>RE</span><span className="brand-green">VOK</span><i>.</i></Link>
            <p>A lost and found platform for a kinder, more connected community.</p>
          </div>
          <div className="footer-links">
            <strong>Explore</strong><Link href="/">Home</Link><Link href="/items">Browse items</Link><Link href="/report/lost">Report an item</Link>
          </div>
          <div className="footer-links">
            <strong>REVOK</strong><Link href="/about">About</Link><Link href="/how-it-works">How it works</Link><Link href="/privacy">Privacy</Link>
          </div>
          <div className="footer-help">
            <span className="footer-help-icon"><Icon name="heart" size={20} /></span>
            <strong>Need a hand?</strong>
            <p>Start by searching for your item or reporting it to the community.</p>
            <Link href="/items">Find an item <Icon name="arrow" size={15} /></Link>
          </div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} REVOK. All rights reserved.</span><span>Built to help belongings find their way home.</span></div>
      </footer>

      <Link href="/help" className="floating-help" aria-label="Get help">
        <span className="help-spark">✦</span><span>?</span>
      </Link>
    </main>
  );
}
