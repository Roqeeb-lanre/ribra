import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { cvKeys } from '@/features/cv/api';
import { useAuthStore, type User } from '@/stores/auth';

export type Billing = {
  plan: 'free' | 'pro';
  proUntil: string | null;
  status: 'active' | 'non-renewing' | 'attention' | 'cancelled' | 'completed' | null;
  nextPaymentAt: string | null;
  canCancel: boolean;
  canManage: boolean;
  priceNgn: number;
  paymentsEnabled: boolean;
  payments: Array<{ reference: string; amountNgn: number; currency: string; paidAt: string }>;
};

export const billingKeys = {
  all: ['billing'] as const,
  verify: (reference: string) => ['billing', 'verify', reference] as const,
};

export function useBilling() {
  return useQuery({
    queryKey: billingKeys.all,
    queryFn: () => apiRequest<{ billing: Billing }>('/billing').then((d) => d.billing),
  });
}

/** Reloads everything that depends on the plan: profile, usage limits and billing. */
export function useRefreshPlan() {
  const queryClient = useQueryClient();
  return async () => {
    const me = await apiRequest<{ user: User }>('/auth/me').catch(() => null);
    if (me) useAuthStore.getState().setUser(me.user);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: billingKeys.all }),
      queryClient.invalidateQueries({ queryKey: cvKeys.usage }),
    ]);
  };
}

/** Sends the user to Paystack's secure checkout page. */
export function useCheckout() {
  return useMutation({
    mutationFn: () => apiRequest<{ url: string }>('/billing/checkout', { method: 'POST' }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

/** Opens Paystack's page for changing the card or cancelling. */
export function useManageSubscription() {
  return useMutation({
    mutationFn: () => apiRequest<{ url: string }>('/billing/manage', { method: 'POST' }),
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const refresh = useRefreshPlan();
  return useMutation({
    mutationFn: () => apiRequest<{ billing: Billing }>('/billing/cancel', { method: 'POST' }),
    onSuccess: ({ billing }) => {
      queryClient.setQueryData(billingKeys.all, billing);
      void refresh();
    },
  });
}

/** Checks a payment after Paystack sends the user back. Each reference is checked once. */
export function useVerifyPayment(reference: string) {
  return useQuery({
    queryKey: billingKeys.verify(reference),
    queryFn: () =>
      apiRequest<{ ok: boolean; message?: string }>(
        `/billing/verify/${encodeURIComponent(reference)}`,
      ),
    enabled: Boolean(reference),
    staleTime: Infinity,
    retry: 1,
  });
}
