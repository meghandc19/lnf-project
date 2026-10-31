"use client";

import Image from "next/image";
import { useState } from "react";

type CarouselImage = { id: string; url: string };

export default function ItemImageCarousel({ images, title }: { images: CarouselImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  if (!images.length) return <div className="public-report-placeholder item-detail-no-photo" aria-label="No photo provided">No photo provided</div>;
  const move = (amount: number) => setIndex((current) => (current + amount + images.length) % images.length);
  return <div className="item-detail-carousel" role="group" aria-roledescription="carousel" aria-label={`${title} photos`} tabIndex={images.length > 1 ? 0 : undefined} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); } if (event.key === "ArrowRight") { event.preventDefault(); move(1); } }} onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)} onTouchEnd={(event) => { if (touchStart === null) return; const delta = event.changedTouches[0]?.clientX - touchStart; if (delta < -45) move(1); if (delta > 45) move(-1); setTouchStart(null); }}>
    <div className="item-detail-carousel-frame"><Image key={images[index].id} src={images[index].url} alt={`${title}, photo ${index + 1} of ${images.length}`} fill priority sizes="(max-width: 900px) 100vw, 50vw" unoptimized /></div>
    {images.length > 1 && <><button className="item-carousel-arrow item-carousel-prev" type="button" onClick={() => move(-1)} aria-label="Previous photo">‹</button><button className="item-carousel-arrow item-carousel-next" type="button" onClick={() => move(1)} aria-label="Next photo">›</button><span className="item-carousel-count" aria-live="polite">{index + 1} of {images.length}</span><div className="item-carousel-dots" aria-label="Choose photo">{images.map((image, imageIndex) => <button type="button" key={image.id} aria-label={`Show photo ${imageIndex + 1}`} aria-current={index === imageIndex ? "true" : undefined} onClick={() => setIndex(imageIndex)} />)}</div></>}
  </div>;
}
