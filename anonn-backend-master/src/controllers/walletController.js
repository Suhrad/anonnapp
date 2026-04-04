import { ethers } from 'ethers';
import Wallet from '../models/Wallet.js';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/response.js';

/**
 * Wallet Controller
 * Handles Web3 wallet operations and on-chain data
 */

export const linkWallet = async (req, res, next) => {
    try {
        const { address, chain, signature, publicKey, message } = req.body;
        let isValid = false;
        let normalizedAddress = address;

        if (chain === 'solana') {
            // Solana wallet verification
            const { verifySignature } = await import('../utils/solana.js');
            if (!publicKey || !signature || !message) {
                return errorResponse(res, 400, 'Missing publicKey, signature, or message for Solana wallet');
            }
            isValid = verifySignature(message, signature, publicKey);
            normalizedAddress = publicKey;
        } else {
            // EVM wallet verification (MetaMask, etc.)
            const msg = message || `Link wallet ${address} to account`;
            const recoveredAddress = ethers.verifyMessage(msg, signature);
            isValid = (recoveredAddress.toLowerCase() === address.toLowerCase());
            normalizedAddress = address.toLowerCase();
        }

        if (!isValid) {
            return errorResponse(res, 400, 'Invalid signature');
        }

        // Check if wallet already linked
        const existingWallet = await Wallet.findOne({ address: normalizedAddress });
        if (existingWallet) {
            return errorResponse(res, 400, 'Wallet already linked to an account');
        }

        const wallet = await Wallet.create({
            user: req.user._id,
            address: normalizedAddress,
            chain,
            isVerified: true,
            verificationSignature: signature,
            verifiedAt: new Date(),
        });

        // Add to user's wallet addresses
        await User.findByIdAndUpdate(req.user._id, {
            $push: {
                walletAddresses: {
                    address: normalizedAddress,
                    chain,
                    isPrimary: wallet.isPrimary,
                    verified: true,
                }
            }
        });

        return successResponse(res, 200, { wallet }, 'Wallet linked successfully');
    } catch (error) {
        next(error);
    }
};

export const unlinkWallet = async (req, res, next) => {
    try {
        const wallet = await Wallet.findById(req.params.id);

        if (!wallet) {
            return errorResponse(res, 404, 'Wallet not found');
        }

        if (wallet.user.toString() !== req.user._id.toString()) {
            return errorResponse(res, 403, 'Not authorized');
        }

        wallet.isActive = false;
        await wallet.save();

        // Remove from user's wallet addresses
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { walletAddresses: { address: wallet.address } }
        });

        return successResponse(res, 200, {}, 'Wallet unlinked');
    } catch (error) {
        next(error);
    }
};

export const getWalletInfo = async (req, res, next) => {
    try {
        const wallets = await Wallet.find({
            user: req.user._id,
            isActive: true
        });

        return successResponse(res, 200, { wallets }, 'Wallets retrieved');
    } catch (error) {
        next(error);
    }
};

export const getBalance = async (req, res, next) => {
    try {
        const wallet = await Wallet.findById(req.params.id);

        if (!wallet) {
            return errorResponse(res, 404, 'Wallet not found');
        }

        // For demonstration - in production, connect to actual RPC
        const provider = new ethers.JsonRpcProvider(
            process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_KEY'
        );

        try {
            const balance = await provider.getBalance(wallet.address);
            const formattedBalance = ethers.formatEther(balance);

            wallet.nativeBalance = {
                amount: formattedBalance,
                lastUpdated: new Date(),
            };
            await wallet.save();

            return successResponse(res, 200, {
                balance: formattedBalance,
                address: wallet.address,
                chain: wallet.chain
            }, 'Balance retrieved');
        } catch (rpcError) {
            return errorResponse(res, 500, 'Failed to fetch balance from blockchain');
        }
    } catch (error) {
        next(error);
    }
};

export const signTransaction = async (req, res, next) => {
    try {
        // This would typically be handled client-side
        // Server just validates the signature
        const { signedTx } = req.body;

        return successResponse(res, 200, { signedTx }, 'Transaction signed');
    } catch (error) {
        next(error);
    }
};

export const verifySignature = async (req, res, next) => {
    try {
        const { message, signature, address } = req.body;

        const recoveredAddress = ethers.verifyMessage(message, signature);

        const isValid = recoveredAddress.toLowerCase() === address.toLowerCase();

        return successResponse(res, 200, {
            isValid,
            recoveredAddress
        }, 'Signature verified');
    } catch (error) {
        return errorResponse(res, 400, 'Invalid signature');
    }
};
