"use client";

import { useEffect, useState } from "react";
import { useClock } from "./useClock";
import { createPublicClient, createWalletClient, custom, http, type EIP1193Provider, type Hex } from "viem";
import {
  chain,
  chainReady,
  distributorAbi,
  erc20Abi,
  explorerTx,
  sameAddress,
  shortAddress,
  type Claim,
} from "@/lib/airdrop";
import { LAUNCH_AT } from "@/lib/site";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

type State =
  | { kind: "checking" }
  | { kind: "closed" }
  | { kind: "ready" }
  | { kind: "connecting" }
  | { kind: "sending" }
  | { kind: "confirming"; hash: string }
  | { kind: "claimed"; hash?: string };

const publicClient = chainReady ? createPublicClient({ chain, transport: http() }) : null;

/** Claims are open only when the team says so AND the contract matches the frozen list AND it holds the tokens. */
async function readChain(CLAIM_CONTRACT: Hex | null, CLAIM_OPEN: boolean, claim: Claim, root: string) {
  if (!publicClient || !CLAIM_CONTRACT) return { open: false, claimed: false };
  const [onChainRoot, token, claimed] = await Promise.all([
    publicClient.readContract({ address: CLAIM_CONTRACT, abi: distributorAbi, functionName: "merkleRoot" }),
    publicClient.readContract({ address: CLAIM_CONTRACT, abi: distributorAbi, functionName: "token" }),
    publicClient.readContract({ address: CLAIM_CONTRACT, abi: distributorAbi, functionName: "isClaimed", args: [BigInt(claim.index)] }),
  ]);
  if (claimed) return { open: true, claimed: true };
  const funded = (await publicClient.readContract({ address: token, abi: erc20Abi, functionName: "balanceOf", args: [CLAIM_CONTRACT] })) >= BigInt(claim.amount);
  return { open: CLAIM_OPEN && onChainRoot.toLowerCase() === root.toLowerCase() && funded, claimed: false };
}

type Props = {
  claim: Claim;
  root: string;
  /** Which distributor this claim is paid from, and whether the team has opened it. */
  contract: Hex | null;
  open: boolean;
  /** e.g. "100,000 $HAUNT" */
  amountLabel: string;
};

/** Connect, claim once, and show Claimed only after the chain confirms it. Used by the airdrop and the game rewards. */
export default function ClaimPanel({ claim, root, contract: CLAIM_CONTRACT, open: CLAIM_OPEN, amountLabel }: Props) {
  const claimConfigured = chainReady && Boolean(CLAIM_CONTRACT);
  const pendingKey = (index: number) => `haunt:claim:${CLAIM_CONTRACT}:${index}`;
  const isClaimedNow = (index: number) =>
    publicClient!.readContract({ address: CLAIM_CONTRACT!, abi: distributorAbi, functionName: "isClaimed", args: [BigInt(index)] });
  const [state, setState] = useState<State>(claimConfigured && CLAIM_OPEN ? { kind: "checking" } : { kind: "closed" });
  const [error, setError] = useState("");
  const now = useClock();
  // Claims never open before launch, whatever the contract says.
  const beforeLaunch = now === null || now < new Date(LAUNCH_AT).getTime();

  async function waitFor(hash: Hex) {
    setState({ kind: "confirming", hash });
    const receipt = await publicClient!.waitForTransactionReceipt({ hash });
    try {
      localStorage.removeItem(pendingKey(claim.index));
    } catch {}
    // Only a mined, successful transaction and the contract's own record count as claimed.
    if (receipt.status === "success" && (await isClaimedNow(claim.index))) setState({ kind: "claimed", hash });
    else {
      setState({ kind: "ready" });
      setError("The claim failed on chain, so nothing was sent. You can try again.");
    }
  }

  useEffect(() => {
    if (!claimConfigured || !CLAIM_OPEN) return;
    let alive = true;
    (async () => {
      try {
        const { open, claimed } = await readChain(CLAIM_CONTRACT, CLAIM_OPEN, claim, root);
        if (!alive) return;
        if (claimed) return setState({ kind: "claimed" });
        if (!open) return setState({ kind: "closed" });
        let pending: string | null = null;
        try {
          pending = localStorage.getItem(pendingKey(claim.index));
        } catch {}
        if (pending) await waitFor(pending as Hex);
        else setState({ kind: "ready" });
      } catch {
        if (alive) setState({ kind: "closed" });
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- read the chain once per claim
  }, [claim.index, root]);

  async function connectAndClaim() {
    setError("");
    const eth = window.ethereum;
    if (!eth) {
      setError("No wallet found. Open this page in your wallet app's browser, or install a browser wallet.");
      return;
    }
    setState({ kind: "connecting" });
    try {
      const [address] = (await eth.request({ method: "eth_requestAccounts" })) as Hex[];
      if (!sameAddress(address, claim.account)) {
        setState({ kind: "ready" });
        setError(`That's ${shortAddress(address)}. Connect ${shortAddress(claim.account)}, the wallet you applied with.`);
        return;
      }
      const wallet = createWalletClient({ account: address, chain, transport: custom(eth) });
      if ((await wallet.getChainId()) !== chain.id) {
        try {
          await wallet.switchChain({ id: chain.id });
        } catch {
          await wallet.addChain({ chain });
          await wallet.switchChain({ id: chain.id });
        }
      }
      // Simulating first catches an already-claimed or wrong proof before the wallet asks to sign.
      const { request } = await publicClient!.simulateContract({
        account: address,
        address: CLAIM_CONTRACT!,
        abi: distributorAbi,
        functionName: "claim",
        args: [BigInt(claim.index), claim.account as Hex, BigInt(claim.amount), claim.proof as Hex[]],
      });
      setState({ kind: "sending" });
      const hash = await wallet.writeContract(request);
      try {
        localStorage.setItem(pendingKey(claim.index), hash);
      } catch {}
      await waitFor(hash);
    } catch (e) {
      if (await isClaimedNow(claim.index).catch(() => false)) return setState({ kind: "claimed" });
      setState({ kind: "ready" });
      const msg = e instanceof Error ? e.message : "";
      setError(/rejected|denied/i.test(msg) ? "You cancelled in your wallet. Nothing was sent." : "The claim didn't go through. Nothing was sent. Try again in a moment.");
    }
  }

  if (state.kind === "claimed") {
    const link = state.hash ? explorerTx(state.hash) : "";
    return (
      <div className="claim-box claim-done">
        <span className="claim-stamp spooky">Claimed</span>
        <p>{amountLabel} landed in {shortAddress(claim.account)}.</p>
        {link && <a href={link} target="_blank" rel="noopener noreferrer">View the transaction</a>}
      </div>
    );
  }

  if (beforeLaunch || state.kind === "closed") {
    return (
      <div className="claim-box">
        <button className="btn btn-green btn-big" disabled>Claim disabled</button>
        <p className="muted">Disabled until launch and claims open. Then connect {shortAddress(claim.account)}, the wallet you applied with, and claim once.</p>
      </div>
    );
  }

  const busy = state.kind === "checking" || state.kind === "connecting" || state.kind === "sending" || state.kind === "confirming";
  const label =
    state.kind === "checking" ? "Checking the claim contract..."
    : state.kind === "connecting" ? "Check your wallet..."
    : state.kind === "sending" ? "Confirm in your wallet..."
    : state.kind === "confirming" ? "Confirming on chain..."
    : "Connect wallet and claim";

  return (
    <div className="claim-box">
      <button className="btn btn-green btn-big" onClick={connectAndClaim} disabled={state.kind !== "ready"} aria-busy={busy}>
        {label}
      </button>
      {state.kind === "ready" && <p className="muted">Connect {shortAddress(claim.account)} on Robinhood Chain. You can claim once.</p>}
      {state.kind === "confirming" && explorerTx(state.hash) && (
        <a href={explorerTx(state.hash)} target="_blank" rel="noopener noreferrer">Watch the transaction</a>
      )}
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
