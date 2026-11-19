import Image from "next/image";
import Link from "next/link";

export type SearchItemCardData = {
  id: string;
  type: "FOUND" | "LOST";
  title: string;
  category: { name: string };
  location: string;
  images: { id: string; url: string }[];
};

export default function SearchItemCard({ item }: { item: SearchItemCardData }) {
  const kind = item.type === "FOUND" ? "Found" : "Lost";
  return <Link href={`/items/${item.type.toLowerCase()}/${item.id}`} className="search-item-card" aria-label={`${kind}: ${item.title}, ${item.category.name}, ${item.location}`}>
    <span className={`search-item-image-wrap${item.images[0] ? "" : " is-placeholder"}`}>
      {item.images[0] ? <Image src={item.images[0].url} alt="" fill sizes="(max-width: 650px) 32vw, (max-width: 1100px) 20vw, 16vw" className="search-item-image" unoptimized /> : <span aria-hidden="true">✳</span>}
      <span className={`report-kind report-kind-${item.type.toLowerCase()}`}>{kind}</span>
    </span>
    <span className="search-item-card-copy"><strong>{item.title}</strong><span>{item.category.name}</span><span className="search-item-location">{item.location}</span></span>
  </Link>;
}
