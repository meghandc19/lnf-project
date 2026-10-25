"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type AccountMenuProps = {
  name: string;
  username: string | null;
  phoneNumber: string | null;
  image: string | null;
};

export default function AccountMenu({ name, username, phoneNumber, image }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div className="account-menu" ref={rootRef}>
      <button className="header-profile" type="button" aria-expanded={open} aria-haspopup="dialog" aria-label="Open account details" onClick={() => setOpen((current) => !current)}>
        {image ? <Image src={image} width={42} height={42} alt="" unoptimized referrerPolicy="no-referrer" /> : <span aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
        <span className="header-profile-name">{name}</span>
      </button>
      {open && <section className="account-popover" role="dialog" aria-label="Account details">
        <div className="account-popover-heading">
          {image ? <Image src={image} width={54} height={54} alt="" unoptimized referrerPolicy="no-referrer" /> : <span className="account-popover-avatar" aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>}
          <div><strong>{name}</strong><span>REVOK member</span></div>
          <Link className="account-edit-button" href="/profile" aria-label="Edit your profile" title="Edit profile" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5 5 5M4 20l4.4-.9L19.2 8.3a2.1 2.1 0 0 0-3-3L5.4 16.1 4 20Z" /></svg>
          </Link>
        </div>
        <div className="account-popover-details">
          <div><span>Username</span><strong>{username ? `@${username}` : "Set up your username"}</strong></div>
          <div><span>Phone number</span><strong>{phoneNumber || "Not verified"}</strong></div>
        </div>
      </section>}
    </div>
  );
}
