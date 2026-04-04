import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { SvgIcon } from '@/components/SvgIcon';
import { useEffect } from 'react';

export default function WalletConnectButton({ onConnect }: { onConnect?: () => void }) {
  const { connected, connecting, publicKey: _publicKey, connect: _connect, disconnect: _disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  useEffect(() => {
    if (connected && onConnect) {
      onConnect();
    }
  }, [connected, onConnect]);

  const buttonText = connecting ? 'Connecting...' : connected ? 'Wallet Connected' : 'Connect Wallet';

  return (
    <button
      onClick={() => setVisible(true)}
      disabled={connecting || connected}
      className="flex items-center gap-2 uppercase text-gray-700 text-xl hover:text-gray-900 hover:scale-105 font-normal px-4 py-2 rounded-md transition-colors disabled:opacity-50 outline-none shadow-none cursor-pointer"
      style={{ pointerEvents: 'auto', position: 'relative', zIndex: 10 }}
    >
      <span style={{ pointerEvents: 'none' }}>
        <SvgIcon src="@/icons/Wallet.svg" />
      </span>
      <span style={{ pointerEvents: 'none' }}>{buttonText.toUpperCase()}</span>
    </button>
  );
}
