"use client";

import { useCallback } from "react";
import { useToast } from "@/components/ui/use-toast";
import { ApiError } from "@/lib/api";

/**
 * Custom hook for consistent API error handling across the application.
 * Handles ApiError instances and displays appropriate toast notifications.
 */
export function useApiError() {
  const { toast } = useToast();

  const handleError = useCallback(
    (error: unknown, defaultMessage: string) => {
      console.error("API Error:", error);

      let errorMessage = defaultMessage;

      if (error instanceof ApiError) {
        // Handle validation errors (400 with Zod issues)
        if (error.statusCode === 400 && error.details?.issues) {
          const issues = error.details.issues as Array<{ path?: string; message: string }>;
          const issueMessages = issues.map((issue) => issue.message).join(", ");
          errorMessage = `Validierungsfehler: ${issueMessages}`;
        }
        // Handle other API errors
        else if (error.message) {
          errorMessage = error.message;
        }
      }

      toast({
        variant: "destructive",
        title: "Fehler",
        description: errorMessage,
      });
    },
    [toast]
  );

  return { handleError };
}

