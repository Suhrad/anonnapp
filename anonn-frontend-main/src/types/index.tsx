export interface User {
  id: string;
  _id?: string; // MongoDB ObjectId
  username?: string;
  avatar?: string;
  bannerUrl?: string;
  bio?: string;
  location?: string;
  website?: string;
  walletAddress: string;
  authNonce?: string;
  allowlisted: boolean;
  karma: number;
  postKarma: number;
  commentKarma: number;
  awardeeKarma: number;
  points?: number;
  followerCount: number;
  followingCount: number;
  isVerified: boolean;
  isPremium: boolean;
  premiumExpiresAt?: Date;
  isOnline: boolean;
  lastActiveAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  companyEmail?: string;
  companyDomain?: string;
  companyName?: string;
  isCompanyVerified: boolean;
  companyVerifiedAt?: Date;
  zkProofHash?: string;
  verificationCode?: string;
  verificationCodeExpiresAt?: Date;
}

export interface Bowl {
  id: string | number;
  _id?: string; // MongoDB ObjectId
  name: string;
  displayName?: string | null;
  description?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  category: "industries" | "job-groups" | "general" | "user-moderated" | "crypto" | "technology" | "stocks" | "sports" | "politics" | "entertainment" | "other";
  memberCount: number;
  onlineCount: number;
  isPrivate: boolean;
  isRestricted: boolean;
  isNSFW: boolean;
  primaryColor?: string | null; // Hex color
  rules?: unknown[] | null; // JSON array of rules
  flairs?: unknown[] | null; // JSON array of flairs
  sidebar?: string | null;
  createdBy?: string | null; // References users.id
  createdAt: Date;
  updatedAt: Date;
}

export type BowlWithDetails = Bowl & {
  creator: User;
  postCount: number;
  pollCount?: number;
};

export interface Organization {
  id: number;
  name: string;
  description?: string | null;
  logo?: string | null;
  website?: string | null;
  ticker?: string | null;
  sector?: string | null;
  bullishCount?: number;
  bearishCount?: number;
  followerCount?: number;
  isFeatured: boolean;
  createdBy?: string | null; // References users.id
  createdAt: Date;

  // Security columns
  accessLevel: "public" | "private" | "admin_only";
  allowedUsers?: string[] | null; // Array of user IDs who can access
  adminOnlyFeatures?: Record<string, unknown> | null; // JSON object
  securitySettings?: Record<string, unknown> | null; // JSON object
}

export interface ExternalMarket {
  _id?: string;
  id?: string;
  source: string;
  externalId?: string;
  title: string;
  description?: string | null;
  url?: string | null;
  probabilityYes?: number | null;
  liquidity?: number | null;
  volume24h?: number | null;
  totalVolume?: number | null;
  closeTime?: Date | string | null;
  status?: string;
}

export type Post = {
  id: number;
  _id?: string; // MongoDB ObjectId
  title: string;
  content: string;
  type: 'text' | 'link' | 'image' | 'video' | 'poll' | 'review'; // Schema: 'text' | 'link' | 'image' | 'video'
  sentiment: string | null; // 'positive' | 'neutral' | 'negative' (frontend field)
  bias?: 'positive' | 'negative' | 'neutral' | null; // Schema field (maps to sentiment)
  linkUrl: string | null;
  mediaUrl?: string | null; // Schema field (single URL)
  mediaUrls: unknown | null; // Frontend field (can be array of URLs) - kept for backward compatibility
  flair: string | null; // Frontend-specific field
  flairColor: string | null; // Frontend-specific field, default "#0079d3"
  isNSFW: boolean; // Frontend-specific field
  isSpoiler: boolean; // Frontend-specific field
  isOC: boolean; // Frontend-specific field
  isLocked: boolean;
  isPinned: boolean;
  isActive?: boolean; // Schema field, default: true
  isAnonymous: boolean; // Frontend-specific field
  authorId: string; // Frontend field (maps to author ObjectId)
  author?: string; // Schema field (ObjectId ref to User)
  organizationId: number | null; // Frontend field (single org)
  companyTags?: (string | number)[]; // Schema field (array of ObjectIds ref to Company)
  attachedMarket?: string | ExternalMarket | null;
  bowlId: number | null; // Frontend field (maps to bowl ObjectId)
  bowl?: string; // Schema field (ObjectId ref to Bowl)
  community?: string; // Schema field (ObjectId ref to Community)
  imageUrl: string | null; // deprecated
  upvotes: string[]; // Array of user IDs/ObjectIds
  downvotes: string[]; // Array of user IDs/ObjectIds
  commentCount: number;
  viewCount: number;
  shareCount?: number; // Schema field, default: 0
  bookmarkCount?: number; // Schema field, default: 0
  awardCount: number; // Frontend-specific field
  workLifeBalance: number | null; // Frontend-specific field (review ratings)
  cultureValues: number | null; // Frontend-specific field (review ratings)
  careerOpportunities: number | null; // Frontend-specific field (review ratings)
  compensation: number | null; // Frontend-specific field (review ratings)
  management: number | null; // Frontend-specific field (review ratings)
  // Moderation fields from schema
  removedBy?: string | null; // Schema field (ObjectId ref to User)
  removalReason?: string | null; // Schema field
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type PostWithDetails = Post & {
  author: User & {
    karmaLevel?: {
      level: number;
      name: string;
      color: string;
    };
    avatar?: string;
  };
  companyTags?: Organization[];
  bowl?: Bowl;
  community?: Bowl & { avatar?: string; displayName?: string };
  userVote?: Vote;
};

export type Vote = {
  id: number;
  userId: string;
  targetId: string | number;
  targetType: string; // 'post' | 'comment' if you enforce enum later
  voteType: string; // 'upvote' | 'downvote'
  createdAt: Date | null; // defaultNow() may return null on insert
};

// Session storage table (mandatory for Replit Auth)
export interface Session {
  sid: string;
  sess: Record<string, unknown>;
  expire: Date;
}

// Access logs table for security monitoring
export interface AccessLog {
  id: number;
  userId?: string | null;
  action: string; // access_granted, access_denied, create, update, delete
  resourceType: string; // organization, post, user
  resourceId?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
  errorMessage?: string | null;
  createdAt: Date | null;
}

// Bowl follows (replaces memberships)
export interface BowlFollow {
  id: number;
  userId: string;
  bowlId: number;
  followedAt: Date | null;
}

// Bowl favorites table
export interface BowlFavorite {
  id: number;
  userId: string;
  bowlId: number;
  favoritedAt: Date | null;
}

// Bowl moderators table
export interface BowlModerator {
  id: number;
  userId: string;
  bowlId: number;
  role: string; // 'owner' | 'admin' | 'moderator'
  permissions?: Record<string, unknown> | null;
  appointedBy?: string | null;
  appointedAt: Date | null;
}

// Bowl bans table
export interface BowlBan {
  id: number;
  userId: string;
  bowlId: number;
  reason?: string | null;
  bannedBy: string;
  bannedAt: Date | null;
  expiresAt?: Date | null; // null for permanent bans
  isActive: boolean;
}

// User flairs in communities
export interface UserFlair {
  id: number;
  userId: string;
  bowlId: number;
  flairText?: string | null;
  flairColor?: string | null; // Hex color, default "#0079d3"
  isEditable: boolean;
  assignedBy?: string | null;
  assignedAt: Date | null;
}

// User following system
export interface UserFollow {
  id: number;
  followerId: string;
  followedId: string;
  followedAt: Date | null;
}

// Awards system
export interface Award {
  id: number;
  name: string;
  description?: string | null;
  iconUrl: string;
  cost: number; // Cost in coins
  isPremium: boolean;
  giverKarma: number; // Karma given to the giver
  receiverKarma: number; // Karma given to receiver
  coinReward: number; // Coins given to receiver
  createdAt: Date | null;
}

// Post/Comment awards
export interface PostAward {
  id: number;
  postId?: number | null;
  commentId?: number | null;
  awardId: number;
  giverId: string;
  receiverId: string;
  isAnonymous: boolean;
  message?: string | null; // Optional message from giver
  givenAt: Date | null;
}

// User coins/points system
export interface UserCoins {
  id: number;
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  updatedAt: Date | null;
}

// Private messages
export interface PrivateMessage {
  id: number;
  senderId: string;
  receiverId: string;
  subject?: string | null;
  content: string;
  isRead: boolean;
  parentMessageId?: number | null;
  sentAt: Date | null;
}

// User saved posts/comments
export interface SavedContent {
  id: number;
  userId: string;
  postId?: number | null;
  commentId?: number | null;
  savedAt: Date | null;
}

// Comments table
export interface Comment {
  id: number;
  content: string;
  authorId: string;
  postId?: number | null;
  pollId?: number | null;
  parentId?: number | null;
  upvotes: number;
  downvotes: number;
  createdAt: Date | null;
}

export type CommentWithDetails = Comment & {
  author: User & {
    karmaLevel?: {
      level: number;
      name: string;
      color: string;
    };
  };
  userVote?: Vote;
  replies?: CommentWithDetails[];
  reactions?: Record<string, string[]>;
};

// Trust voting table for organizations
export interface OrgTrustVote {
  id: number;
  userId: string;
  organizationId: number;
  trustVote: boolean; // true for trust, false for distrust
  createdAt: Date | null;
}

// Notifications table
export interface Notification {
  id: number;
  userId: string;
  type: string; // 'comment', 'upvote', 'downvote', etc.
  content: string;
  link?: string | null; // URL to the relevant post/discussion
  read: boolean;
  createdAt: Date | null;
}

// Company domains mapping table
export interface CompanyDomain {
  id: number;
  domain: string; // e.g., "google.com", "microsoft.com"
  companyName: string; // e.g., "Google", "Microsoft"
  isVerified: boolean; // Whether this domain is officially verified
  logo?: string | null; // Company logo URL
  createdAt: Date | null;
  updatedAt: Date | null;
}

// Company verification attempts and ZK proofs table
export interface CompanyVerification {
  id: number;
  userId: string;
  email: string;
  domain: string;
  verificationCode: string;
  zkProof?: string | null; // The actual ZK proof data
  zkProofHash?: string | null; // Hash of the ZK proof
  starknetTxHash?: string | null; // Starknet transaction hash for proof verification
  status: string; // pending, verified, failed, expired
  expiresAt: Date;
  verifiedAt?: Date | null;
  createdAt: Date | null;
}

// Polls table
export interface Poll {
  id: number;
  title: string;
  description?: string | null;
  authorId: string;
  bowlId?: number | null;
  organizationId?: number | null;
  postId?: number | null; // Link to the corresponding post
  allowMultipleChoices: boolean;
  isAnonymous: boolean;
  endDate?: Date | null;
  upvotes: number;
  downvotes: number;
  attachedMarket?: string | ExternalMarket | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

// Poll options table
export interface PollOption {
  id: string | number;
  pollId: number;
  text: string;
  voteCount: number;
  createdAt: Date | null;
}

// Poll votes table
export interface PollVote {
  id: number;
  pollId: number;
  optionId: number;
  userId: string;
  createdAt: Date | null;
}

export type PollWithDetails = Poll & {
  author: User;
  bowl?: Bowl;
  organization?: Organization;
  options: (PollOption & { isVotedBy?: boolean })[];
  totalVotes: number;
  userVotes?: PollVote[];
  hasVoted?: boolean;
  selectedOptions?: (string | number)[];
  userVote?: Vote; // For post-style voting
};

// Extended types with relations
export type OrganizationWithStats = Organization & {
  reviewCount: number;
  averageRating: number;
  followerCount: number;
  pollCount: number;
  postCount: number;
  positivePosts?: number;
  negativePosts?: number;
  authorCount?: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    negative: number;
  };
  trustData?: {
    trustVotes: number;
    distrustVotes: number;
    trustPercentage: number;
  };
  insiders?: { name: string; avatar?: string }[];
  riskSignal?: {
    hasRisk: boolean;
    negativePercentageLast30Days: number;
  };
  lastReviewDate?: Date;
  reviewTrends?: {
    date: string;
    count: number;
  }[];
  topReviews?: {
    mostHelpful?: PostWithDetails;
    mostControversial?: PostWithDetails;
  };
  // Rating averages from reviews
  avgWorkLifeBalance?: number | null;
  avgCultureValues?: number | null;
  avgCareerOpportunities?: number | null;
  avgCompensation?: number | null;
  avgManagement?: number | null;
};

export type BowlWithStats = Bowl & {
  memberCount: number;
  postCount: number;
};

// Karma levels helper function
export function getKarmaLevel(karma: number): {
  level: number;
  name: string;
  color: string;
} {
  if (karma >= 200)
    return { level: 3, name: "Trusted", color: "text-purple-600" };
  if (karma >= 50)
    return { level: 2, name: "Experienced", color: "text-blue-600" };
  if (karma >= 10) return { level: 1, name: "Active", color: "text-green-600" };
  return { level: 0, name: "New", color: "text-gray-600" };
}

// ZK Proof related types for company email verification
export interface ZKProofData {
  proof: Uint8Array;
  publicInputs: string[];
  verificationKey?: string;
}

export interface EphemeralKey {
  publicKey: bigint;
  privateKey: bigint;
  salt: bigint;
  expiry: Date;
  ephemeralPubkeyHash: bigint;
}

export interface ZKVerificationResult {
  isValid: boolean;
  proofHash: string;
  errors?: string[];
  starknetTxHash?: string;
}

export interface ZKProvider {
  name: string;
  generateProof(ephemeralKey: EphemeralKey): Promise<{
    proof: Uint8Array;
    anonGroup: AnonGroup;
    proofArgs: Record<string, unknown>;
  }>;
  verifyProof(
    proof: Uint8Array,
    anonGroupId: string,
    ephemeralPubkey: bigint,
    ephemeralPubkeyExpiry: Date,
    proofArgs: Record<string, unknown>
  ): Promise<boolean>;
  getAnonGroup(groupId: string): AnonGroup;
}

export interface AnonGroup {
  id: string;
  title: string;
  logoUrl: string;
}

export interface ZKJWTInputs {
  partial_data: number[];
  partial_hash: number[];
  full_data_length: number;
  base64_decode_offset: number;
  jwt_pubkey_modulus_limbs: bigint[];
  jwt_pubkey_redc_params_limbs: bigint[];
  jwt_signature_limbs: bigint[];
  domain: string;
  ephemeral_pubkey: string;
  ephemeral_pubkey_salt: string;
  ephemeral_pubkey_expiry: string;
}

export interface ZKProofVerification {
  domain: string;
  jwtPubKey: bigint;
  ephemeralPubkey: bigint;
  ephemeralPubkeyExpiry: Date;
}

// Helper function to split big integers into limbs for ZK circuits
export function splitBigIntToLimbs(
  value: bigint,
  limbSize: number,
  numLimbs: number
): bigint[] {
  const limbs: bigint[] = [];
  const mask = (BigInt(1) << BigInt(limbSize)) - BigInt(1);

  for (let i = 0; i < numLimbs; i++) {
    limbs.push(value & mask);
    value >>= BigInt(limbSize);
  }

  return limbs;
}
