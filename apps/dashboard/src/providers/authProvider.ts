import type { AuthProvider } from '@refinedev/core';

type ClerkUser = { id: string; fullName?: string | null; username?: string | null; imageUrl?: string };
type ClerkInstance = {
  signOut: () => Promise<void>;
  user?: ClerkUser | null;
  organization?: { role?: string } | null;
};

export const createAuthProvider = (clerk: ClerkInstance): AuthProvider => {
  return {
    login: async () => {
      // Clerk handles login via modal/redirection in views, so return success
      return { success: true };
    },
    logout: async () => {
      await clerk.signOut();
      return { success: true, redirectTo: '/sign-in' };
    },
    onError: async (error) => {
      console.error('AuthProvider Error:', error);
      return { error };
    },
    check: async () => {
      if (clerk.user) {
        return { authenticated: true };
      }
      return {
        authenticated: false,
        redirectTo: '/sign-in',
        error: {
          message: 'Check failed',
          name: 'Not Authenticated',
        },
      };
    },
    getPermissions: async () => {
      return clerk.organization?.role ?? null;
    },
    getIdentity: async () => {
      if (clerk.user) {
        return {
          id: clerk.user.id,
          name: clerk.user.fullName ?? clerk.user.username,
          avatar: clerk.user.imageUrl,
        };
      }
      return null;
    },
  };
};
