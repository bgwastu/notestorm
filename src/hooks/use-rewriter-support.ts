import { useEffect, useState } from "react";
import { toast } from "sonner";
import { checkRewriterSupport } from "@/lib/rewriter";

export function useRewriterSupport(isOpen?: boolean) {
	const [rewriterSupported, setRewriterSupported] = useState(false);
	const [isCheckingRewriter, setIsCheckingRewriter] = useState(true);
	const [isRewriterDownloading, setIsRewriterDownloading] = useState(false);

	useEffect(() => {
		if (isOpen === false) return;

		checkRewriterSupport().then((result) => {
			setRewriterSupported(result.supported);
			setIsCheckingRewriter(false);

			if (result.supported && result.available === "downloadable") {
				setIsRewriterDownloading(true);
				const toastId = toast.loading(
					"Rewriter AI model is downloading in the background. This may take a few minutes.",
				);

				const checkInterval = setInterval(async () => {
					const checkResult = await checkRewriterSupport();
					if (checkResult.available === "available") {
						setIsRewriterDownloading(false);
						toast.success("Rewriter AI model is ready!", { id: toastId });
						clearInterval(checkInterval);
					}
				}, 5000);

				return () => clearInterval(checkInterval);
			}
		});
	}, [isOpen]);

	return {
		rewriterSupported,
		isCheckingRewriter,
		isRewriterDownloading,
	};
}
