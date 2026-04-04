import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiCall } from "@/lib/api";
import type { ApiCallOptions } from "@/lib/api";

export interface UseApiMutationOptions<TData = unknown, TVariables = unknown>
  extends Omit<ApiCallOptions, "method" | "body" | "params"> {
  method?: "POST" | "PUT" | "PATCH" | "DELETE";
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables, context?: unknown) => void;
  invalidateQueries?: (string | number | boolean | undefined)[][];
  refetchQueries?: (string | number | boolean | undefined)[][];
  mutationFn?: (variables: TVariables) => Promise<TData>;
}

/**
 * Hook for making POST, PUT, PATCH, DELETE requests with TanStack Query
 *
 * @example
 * ```tsx
 * const mutation = useApiMutation({
 *   endpoint: 'posts',
 *   method: 'POST',
 *   invalidateQueries: [['posts']]
 * });
 *
 * mutation.mutate({ title: 'New Post', content: '...' });
 * ```
 */
export function useApiMutation<TData = unknown, TVariables = unknown>(
  options: UseApiMutationOptions<TData, TVariables>
) {
  const {
    endpoint,
    method = "POST",
    headers,
    on401,
    mutationFn,
    onSuccess,
    onError,
    invalidateQueries = [],
    refetchQueries = [],
  } = options;

  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables: TVariables) => {
      if (mutationFn) {
        return mutationFn(variables);
      }

      // Handle variables - can be body object or { body, params } object
      let body: unknown;
      let params: Record<string, string | number | boolean> | undefined;

      if (
        variables &&
        typeof variables === "object" &&
        "body" in variables &&
        "params" in variables
      ) {
        // If variables has body and params structure
        body = (variables as any).body;
        params = (variables as any).params;
      } else {
        // Otherwise, treat variables as the body
        body = variables;
      }

      return apiCall<TData>({
        endpoint,
        method,
        body,
        params,
        headers,
        on401,
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate specified queries
      invalidateQueries.forEach((queryKey) => {
        queryClient.invalidateQueries({ queryKey });
      });

      // Refetch specified queries
      refetchQueries.forEach((queryKey) => {
        queryClient.refetchQueries({ queryKey });
      });

      onSuccess?.(data, variables);
    },
    onError: (error, variables, context) => {
      onError?.(error, variables, context);
    },
    retry: false,
  });
}
