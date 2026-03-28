'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import QRCode from 'react-qr-code';
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
  parseUnits,
  isAddress,
  type Hash,
} from 'viem';
import { usePrivyWallet } from '@/hooks/usePrivyWallet';
import { monadTestnet } from '@/config/privy';
import { USDC_ADDRESS, USDC_ABI } from '@/lib/contract';

const RPC_URL =
  process.env.NEXT_PUBLIC_MONAD_RPC || 'https://testnet-rpc.monad.xyz';

type Tab = 'receive' | 'send';
type TokenType = 'MON' | 'USDC';

export default function WalletSection() {
  const { address, isConnected, wallet } = usePrivyWallet();
  const [activeTab, setActiveTab] = useState<Tab>('receive');
  const [copied, setCopied] = useState(false);
  const [monBalance, setMonBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);

  // Send form
  const [recipient, setRecipient] = useState('');
  const [token, setToken] = useState<TokenType>('MON');
  const [amount, setAmount] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  const publicClient = useMemo(
    () => createPublicClient({ chain: monadTestnet, transport: http(RPC_URL) }),
    [],
  );

  const fetchBalances = useCallback(async () => {
    if (!address) return;
    setLoadingBalances(true);
    try {
      const native = await publicClient.getBalance({
        address: address as `0x${string}`,
      });
      setMonBalance(parseFloat(formatUnits(native, 18)).toFixed(4));

      const usdc = await publicClient.readContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });
      setUsdcBalance(parseFloat(formatUnits(usdc as bigint, 6)).toFixed(2));
    } catch {
      setMonBalance('--');
      setUsdcBalance('--');
    } finally {
      setLoadingBalances(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    if (isConnected && address) fetchBalances();
  }, [isConnected, address, fetchBalances]);

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = address;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getWalletClient = useCallback(async () => {
    if (!wallet || !address) throw new Error('Wallet not connected');
    const provider = await wallet.getEthereumProvider();
    return createWalletClient({
      chain: monadTestnet,
      transport: custom(provider),
      account: address as `0x${string}`,
    });
  }, [wallet, address]);

  const handleSend = async () => {
    setSendError('');
    setSendSuccess('');

    if (!isAddress(recipient)) {
      setSendError('Invalid recipient address');
      return;
    }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setSendError('Enter a valid amount');
      return;
    }
    const bal =
      token === 'MON'
        ? parseFloat(monBalance || '0')
        : parseFloat(usdcBalance || '0');
    if (amt > bal) {
      setSendError(`Insufficient ${token} balance`);
      return;
    }

    setSending(true);
    try {
      const wc = await getWalletClient();
      let txHash: Hash;

      if (token === 'MON') {
        txHash = await wc.sendTransaction({
          to: recipient as `0x${string}`,
          value: parseUnits(amount, 18),
        });
      } else {
        txHash = await wc.writeContract({
          address: USDC_ADDRESS,
          abi: USDC_ABI,
          functionName: 'transfer',
          args: [recipient as `0x${string}`, parseUnits(amount, 6)],
        });
      }

      setSendSuccess(`Sent! ${txHash.slice(0, 10)}...${txHash.slice(-6)}`);
      setRecipient('');
      setAmount('');
      setTimeout(fetchBalances, 2000);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Transaction failed';
      if (msg.includes('User rejected')) setSendError('Transaction cancelled');
      else if (msg.includes('insufficient funds'))
        setSendError('Insufficient funds for gas');
      else setSendError(msg.length > 60 ? msg.slice(0, 60) + '...' : msg);
    } finally {
      setSending(false);
    }
  };

  // Reset send form on tab switch
  useEffect(() => {
    if (activeTab === 'receive') {
      setRecipient('');
      setAmount('');
      setSendError('');
      setSendSuccess('');
    }
  }, [activeTab]);

  if (!isConnected || !address) return null;

  return (
    <div className="rounded-2xl border border-gray-800 bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">Wallet</h2>
        <button
          onClick={fetchBalances}
          disabled={loadingBalances}
          className="text-xs text-gray-500 transition-colors hover:text-accent active:text-accent-light"
        >
          {loadingBalances ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Balances */}
      <div className="mb-4 flex gap-3">
        <div className="flex-1 rounded-xl bg-surface-light px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">
            MON
          </p>
          <p className="font-mono text-sm font-semibold text-white">
            {loadingBalances ? '...' : monBalance ?? '--'}
          </p>
        </div>
        <div className="flex-1 rounded-xl bg-surface-light px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">
            USDC
          </p>
          <p className="font-mono text-sm font-semibold text-white">
            {loadingBalances ? '...' : usdcBalance ?? '--'}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex rounded-xl bg-surface-light p-1">
        <button
          onClick={() => setActiveTab('receive')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
            activeTab === 'receive'
              ? 'bg-accent text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Receive
        </button>
        <button
          onClick={() => setActiveTab('send')}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
            activeTab === 'send'
              ? 'bg-accent text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Send
        </button>
      </div>

      {/* Receive */}
      {activeTab === 'receive' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-surface-light px-3 py-2.5">
            <p className="min-w-0 flex-1 truncate font-mono text-xs text-gray-300">
              {address}
            </p>
            <button
              onClick={handleCopy}
              className="shrink-0 text-xs font-semibold text-accent transition-colors hover:text-accent-light"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex justify-center rounded-xl bg-white p-4">
            <QRCode value={address} size={140} level="M" />
          </div>
          <p className="text-center text-[11px] text-gray-500">
            Scan or share your address to receive funds
          </p>
        </div>
      )}

      {/* Send */}
      {activeTab === 'send' && (
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">To</label>
            <input
              type="text"
              placeholder="0x..."
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              disabled={sending}
              className="w-full rounded-xl border border-gray-700 bg-surface-light px-3 py-2.5 font-mono text-sm text-white outline-none transition-all placeholder:text-gray-600 focus:border-accent disabled:opacity-50"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-gray-400">Amount</label>
              <input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={sending}
                step="0.000001"
                min="0"
                className="w-full rounded-xl border border-gray-700 bg-surface-light px-3 py-2.5 font-mono text-sm text-white outline-none transition-all placeholder:text-gray-600 focus:border-accent disabled:opacity-50"
              />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-xs text-gray-400">Token</label>
              <select
                value={token}
                onChange={(e) => setToken(e.target.value as TokenType)}
                disabled={sending}
                className="w-full appearance-none rounded-xl border border-gray-700 bg-surface-light px-3 py-2.5 text-sm font-semibold text-white outline-none transition-all focus:border-accent disabled:opacity-50"
              >
                <option value="MON">MON</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
          </div>

          <p className="text-[11px] text-gray-500">
            Available:{' '}
            {token === 'MON' ? monBalance || '0.0000' : usdcBalance || '0.00'}{' '}
            {token}
          </p>

          {sendError && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {sendError}
            </p>
          )}
          {sendSuccess && (
            <p className="rounded-lg bg-green-500/10 px-3 py-2 text-xs text-green-400">
              {sendSuccess}
            </p>
          )}

          <button
            onClick={handleSend}
            disabled={sending || !recipient || !amount}
            className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      )}
    </div>
  );
}
