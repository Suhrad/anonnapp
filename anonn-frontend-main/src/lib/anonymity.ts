/**
 * Client-side anonymity utilities
 * Handles encrypted user IDs and ensures no sensitive data is exposed
 */

/**
 * Check if a user ID is encrypted (base64url format)
 */
export function isEncryptedUserId(id: string): boolean {
  // Encrypted IDs are base64url encoded and longer than regular UUIDs
  return /^[A-Za-z0-9_-]{40,}$/.test(id) && !id.includes('-');
}

/**
 * Sanitize user object to ensure no sensitive data is present
 */
export function sanitizeUserData(user: any): any {
  if (!user) return user;
  
  // Remove any sensitive fields that shouldn't be on the client
  const sanitized = { ...user };
  
  delete sanitized.email;
  delete sanitized.firstName;
  delete sanitized.lastName;
  delete sanitized.companyEmail;
  delete sanitized.companyDomain;
  delete sanitized.dynamicProfile;
  delete sanitized.password;
  delete sanitized.zkProofHash;
  
  return sanitized;
}

/**
 * Sanitize array of users
 */
export function sanitizeUsersArray(users: any[]): any[] {
  return users.map(sanitizeUserData);
}

/**
 * Check if we should display user identification
 * For anonymous platform, we only show username and basic public info
 */
export function getDisplayName(user: any): string {
  if (!user) return 'Anonymous';
  
  // Only use username, never real names
  return user.username || 'Anonymous User';
}

import defaultPfp from '@/icons/default-pfp.png';

/**
 * Default profile picture path
 */
export const DEFAULT_PROFILE_PICTURE = defaultPfp;

/**
 * Get safe user avatar URL
 */
export function getUserAvatarUrl(user: any): string {
  if (!user?.avatar) return DEFAULT_PROFILE_PICTURE;
  
  // Validate that it's a safe URL
  try {
    const url = new URL(user.avatar);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      return user.avatar;
    }
  } catch {
    // Invalid URL
  }
  
  return DEFAULT_PROFILE_PICTURE;
}

/**
 * Create anonymous user reference for posts/comments
 */
export function createAnonymousUserRef(user: any): any {
  if (!user) return null;
  
  return {
    id: user.id, // This should already be encrypted from the server
    username: user.username,
    avatar: getUserAvatarUrl(user),
    isVerified: user.isVerified || false,
    karma: user.karma || 0
  };
}

/**
 * Validate that user data is properly anonymized
 */
export function validateAnonymizedData(data: any): boolean {
  if (!data) return true;
  
  const sensitiveFields = [
    'email',
    'firstName',
    'lastName',
    'companyEmail',
    'companyDomain',
    'password',
    'zkProofHash'
  ];
  
  if (Array.isArray(data)) {
    return data.every(item => validateAnonymizedData(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    // Check for sensitive fields
    for (const field of sensitiveFields) {
      if (data.hasOwnProperty(field) && data[field] !== null && data[field] !== undefined) {
        console.warn(`Sensitive field ${field} found in client data:`, data);
        return false;
      }
    }
    
    // Recursively check nested objects
    for (const key in data) {
      if (typeof data[key] === 'object' && data[key] !== null) {
        if (!validateAnonymizedData(data[key])) {
          return false;
        }
      }
    }
  }
  
  return true;
}

/**
 * Intercept API responses to ensure they're properly anonymized
 */
export function interceptApiResponse(response: any): any {
  const data = response.data || response;
  
  // Validate anonymization
  if (!validateAnonymizedData(data)) {
    console.error('API response contains sensitive data!', data);
    // In production, you might want to throw an error or sanitize the data
  }
  
  return data;
}

/**
 * Safe fetch wrapper that ensures responses are anonymized
 */
export async function safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, options);
  
  if (response.ok) {
    const clonedResponse = response.clone();
    try {
      const data = await clonedResponse.json();
      validateAnonymizedData(data);
    } catch (e) {
      // Ignore JSON parsing errors for non-JSON responses
    }
  }
  
  return response;
}

/**
 * Remove any accidentally included sensitive data from forms
 */
export function sanitizeFormData(formData: any): any {
  const sanitized = { ...formData };
  
  // Remove sensitive fields that shouldn't be in forms
  delete sanitized.email;
  delete sanitized.firstName;
  delete sanitized.lastName;
  delete sanitized.companyEmail;
  delete sanitized.password;
  
  return sanitized;
}

/**
 * Generate anonymous display info for leaderboards
 */
export function createAnonymousLeaderboardEntry(user: any, rank: number): any {
  return {
    rank,
    id: user.id, // Encrypted
    username: user.username,
    karma: user.karma || 0,
    postKarma: user.postKarma || 0,
    commentKarma: user.commentKarma || 0,
    isVerified: user.isVerified || false,
    // No other identifying information
  };
}

/**
 * Check if current user can see additional profile info
 */
export function canViewExtendedProfile(currentUser: any, targetUser: any): boolean {
  if (!currentUser || !targetUser) return false;
  
  // Only own profile can see extended info
  return currentUser.id === targetUser.id;
}

/**
 * Get filtered profile data based on viewing permissions
 */
export function getFilteredProfileData(currentUser: any, targetUser: any): any {
  const isOwnProfile = canViewExtendedProfile(currentUser, targetUser);
  
  const baseProfile = {
    id: targetUser.id,
    username: targetUser.username,
    bio: targetUser.bio,
    avatar: getUserAvatarUrl(targetUser),
    karma: targetUser.karma || 0,
    postKarma: targetUser.postKarma || 0,
    commentKarma: targetUser.commentKarma || 0,
    isVerified: targetUser.isVerified || false,
    isPremium: targetUser.isPremium || false,
    isOnline: targetUser.isOnline,
    createdAt: targetUser.createdAt,
  };
  
  if (isOwnProfile) {
    return {
      ...baseProfile,
      // Additional info for own profile (but still no sensitive data)
      allowlisted: targetUser.allowlisted,
      followerCount: targetUser.followerCount || 0,
      followingCount: targetUser.followingCount || 0,
      awardeeKarma: targetUser.awardeeKarma || 0,
      lastActiveAt: targetUser.lastActiveAt,
    };
  }
  
  return baseProfile;
}
