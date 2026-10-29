import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CornerWeb, XIcon } from "./_components/art";
import Countdown from "./_components/Countdown";
import Mansion from "./_components/Mansion";
import TopBar from "./_components/TopBar";
import { BoardSkeleton, HomeBoard } from "./_components/Leaderboard";
import CopyAddress from "./_components/CopyAddress";
import { BUY_URL, CHAIN_NAME, EXPLORER_URL, LAUNCH_AT, TOKEN_ADDRESS, X_HANDLE, X_URL } from "@/lib/site";
import { ALLOCATION } from "@/lib/airdrop";

const fmt = (n: number) => n.toLocaleString("en-US");

export default function Home() {
  const launched = Boolean(TOKEN_ADDRESS && BUY_URL);

  return (
    <>
      <TopBar>
        <Link href="/play" className="btn btn-orange btn-sm">Play</Link>
      </TopBar>

      <main>
        <section className="hero">
          <div className="hero-scene">
            <Mansion />
            <div className="fog" style={{ bottom: 0, height: "40%" }} />
          </div>
          <CornerWeb className="corner-web" />
          <div className="wrap hero-copy">
            <h1 className="hero-title">HAUNT</h1>
            <p className="hero-tag">Something moved into the mansion.</p>
            <p className="hero-intro">
              HAUNT rises on October 31. Step inside the mansion: the 5 fastest souls each win 50,000 $HAUNT.
            </p>
            <Countdown target={LAUNCH_AT} />
            <div className="hero-cta">
              <Link href="/airdrop" className="btn btn-green btn-big">Claim 100,000 $HAUNT</Link>
              <Link href="/play" className="btn btn-orange btn-big">Enter the Mansion</Link>
            </div>
          </div>
        </section>

        <section className="section" id="airdrop">
          <div className="wrap">
            <p className="eyebrow">$HAUNT airdrop</p>
            <h2 className="section-title">Claim <em>100,000</em> $HAUNT</h2>
            <p className="section-lead">Complete 5 tasks to unlock your allocation.</p>
            <div className="ad-grid">
              <div className="ad-card">
                <h3 className="ad-title"><span className="ad-num">1</span> Unlock your allocation</h3>
                <ul className="ad-list">
                  <li>Enter your X username</li>
                  <li>Complete 5 quick tasks</li>
                  <li>Add your Robinhood Chain wallet</li>
                  <li>Get your permit card and post it in the comments</li>
                </ul>
              </div>
              <div className="ad-card">
                <h3 className="ad-title"><span className="ad-num">2</span> Allocation details</h3>
                <dl className="facts">
                  <div><dt>Each allocation</dt><dd>{fmt(ALLOCATION)} $HAUNT</dd></div>
                  <div><dt>Chain</dt><dd>Robinhood Chain</dd></div>
                </dl>
              </div>
              <div className="ad-card">
                <h3 className="ad-title"><span className="ad-num">3</span> Claim status</h3>
                <p className="claim-off"><span className="status-pill status-none">Disabled</span></p>
                <p className="muted">Until launch and claims open.</p>
                <p className="fine">Claims close 2 hours before Halloween.</p>
              </div>
            </div>
            <div className="hero-cta" style={{ justifyContent: "flex-start" }}>
              <Link href="/airdrop" className="btn btn-green btn-big">Claim {fmt(ALLOCATION)} $HAUNT</Link>
            </div>
          </div>
        </section>

        <section className="section" id="leaderboard">
          <div className="wrap">
            <p className="eyebrow">Leaderboard</p>
            <h2 className="section-title">The fastest souls win <em>50,000</em> $HAUNT</h2>
            <p className="section-lead">
              Top 5 of Round 1, each. The round ends 2 hours before Halloween, and winners claim their $HAUNT here when the coin launches.{" "}
              <Link href="/rewards">Check your place</Link>.
            </p>
            <Suspense fallback={<BoardSkeleton rows={5} />}>
              <HomeBoard />
            </Suspense>
          </div>
        </section>

        <section className="section">
          <div className="wrap">
            <h2 className="section-title">Escape the <em>mansion</em></h2>
            <p className="section-lead">Two locked rooms, five minutes each, and something in a hood watching you. The 5 fastest souls each win 50,000 $HAUNT.</p>
            <div className="cards">
              <div className="card">
                <span className="num">1</span>
                <h3>Search</h3>
                <p>Tap anything that looks wrong. Candles, clocks and portraits all hide something.</p>
              </div>
              <div className="card">
                <span className="num">2</span>
                <h3>Solve</h3>
                <p>Every room is shuffled, so the answers change each run. No copying your friends.</p>
              </div>
              <div className="card">
                <span className="num">3</span>
                <h3>Escape</h3>
                <p>Crack the lock before time runs out, then post your time and haunt the leaderboard.</p>
              </div>
            </div>
            <div className="hero-cta" style={{ justifyContent: "flex-start" }}>
              <Link href="/play" className="btn btn-orange">Enter the Study</Link>
              <Link href="/play/cellar" className="btn btn-ghost">The Cellar · opens at launch</Link>
            </div>
          </div>
        </section>

        <section className="section" id="token">
          <div className="wrap">
            <h2 className="section-title">The <em>token</em></h2>
            <p className="section-lead">
              The contract is sealed in the crypt until launch{CHAIN_NAME ? ` on ${CHAIN_NAME}` : ""}.
            </p>
            <div className="token-box">
              <div className="token-row">
                <div className="token-main">
                  <div className="token-label">Contract address</div>
                  <div className={`token-value${launched ? "" : " token-sealed"}`}>
                    {launched ? TOKEN_ADDRESS : "Revealed at launch"}
                  </div>
                </div>
                {launched ? (
                  <div className="token-actions">
                    <CopyAddress address={TOKEN_ADDRESS} />
                    {EXPLORER_URL && (
                      <a className="btn btn-sm btn-ghost" href={`${EXPLORER_URL}/token/${TOKEN_ADDRESS}`} target="_blank" rel="noopener noreferrer">View on explorer</a>
                    )}
                    <a className="btn btn-green" href={BUY_URL} target="_blank" rel="noopener noreferrer">Buy HAUNT</a>
                  </div>
                ) : (
                  <button className="btn" disabled>Buy at launch</button>
                )}
              </div>
              <p className="token-warn">
                <b>Beware of impostors.</b> This page and {X_HANDLE} are the only places the real address is posted. We will never DM you,
                ask for your seed phrase or ask you to send tokens first.
              </p>
              <div className="token-row">
                <div>
                  <div className="token-label">Follow for the reveal</div>
                  <div className="token-value">{X_HANDLE}</div>
                </div>
                <a className="btn btn-ghost" href={X_URL} target="_blank" rel="noopener noreferrer">
                  <span style={{ width: 16, display: "inline-flex" }}><XIcon /></span> Follow
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-banner">
          <Image src="/banner.png" alt="HAUNT" width={1500} height={500} sizes="(max-width: 760px) 100vw, 720px" />
        </div>
        <div className="wrap">
          <a className="footer-x" href={X_URL} target="_blank" rel="noopener noreferrer">
            <span className="btn-icon"><XIcon /></span> {X_HANDLE}
          </a>
          <span>Enter if you dare. Not financial advice.</span>
        </div>
      </footer>
    </>
  );
}
