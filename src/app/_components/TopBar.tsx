import Link from "next/link";
import Image from "next/image";
import { XIcon } from "./art";
import { X_URL } from "@/lib/site";

export default function TopBar({ children }: { children?: React.ReactNode }) {
  return (
    <header className="topbar">
      <div className="wrap">
        <Link href="/" className="logo" aria-label="HAUNT home">
          <Image src="/mascot.png" alt="" width={42} height={42} priority />
          <span className="logo-word">HAUNT</span>
        </Link>
        <nav>
          {children}
          <a className="icon-link" href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="HAUNT on X">
            <XIcon />
          </a>
        </nav>
      </div>
    </header>
  );
}
