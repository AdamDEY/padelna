import { useMutation } from "@tanstack/react-query";

import { submitFeedback } from "@/repositories/feedback-repository";

export function useSubmitFeedback() {
  return useMutation({ mutationFn: submitFeedback });
}
