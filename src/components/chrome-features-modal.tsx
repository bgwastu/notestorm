import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { checkRewriterSupport, MINIMUM_CHROME_VERSION } from "@/lib/rewriter";

interface ChromeFeaturesModalProps {
	isOpen: boolean;
	onClose: () => void;
	rewriterEnabled: boolean;
	onRewriterToggle: (enabled: boolean) => void;
}

export function ChromeFeaturesModal({
	isOpen,
	onClose,
	rewriterEnabled,
	onRewriterToggle,
}: ChromeFeaturesModalProps) {
	const [rewriterSupported, setRewriterSupported] = useState(false);
	const [isCheckingRewriter, setIsCheckingRewriter] = useState(true);
	const [isRewriterDownloading, setIsRewriterDownloading] = useState(false);

	useEffect(() => {
		if (!isOpen) return;

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

	const handleRewriterToggle = (checked: boolean) => {
		if (!rewriterSupported) {
			toast.error(
				`Rewriter API is only available in Chrome ${MINIMUM_CHROME_VERSION}+`,
				{
					duration: 8000,
				},
			);
			return;
		}
		onRewriterToggle(checked);
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Chrome-Only Features</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-4">
					<p className="text-sm text-muted-foreground">
						The Rewriter feature is powered by Chrome's Built-in AI and only
						works in Chrome {MINIMUM_CHROME_VERSION}+.
					</p>
					<div className="flex flex-col gap-3">
						<Label className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-foreground has-[[aria-checked=true]]:bg-accent">
							<Checkbox
								id="rewriter-feature"
								checked={rewriterEnabled}
								onCheckedChange={handleRewriterToggle}
								disabled={
									!rewriterSupported ||
									isCheckingRewriter ||
									isRewriterDownloading
								}
								className="data-[state=checked]:border-foreground data-[state=checked]:bg-foreground data-[state=checked]:text-background"
							/>
							<div className="grid gap-1.5 font-normal">
								<p className="text-sm leading-none font-medium">
									Rewriter {isRewriterDownloading && "(Downloading...)"}
								</p>
								<p className="text-muted-foreground text-sm">
									Help you rewrite and improve selected text with AI
								</p>
							</div>
						</Label>
					</div>
					<Button onClick={onClose} className="w-full">
						Got it
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
