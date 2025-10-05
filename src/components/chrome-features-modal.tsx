import { useId } from "react";
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
import { useRewriterSupport } from "@/hooks/use-rewriter-support";
import { MINIMUM_CHROME_VERSION } from "@/lib/rewriter";

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
	const rewriterId = useId();
	const { rewriterSupported, isCheckingRewriter, isRewriterDownloading } =
		useRewriterSupport(isOpen);

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
						The AI Rewriter feature is powered by Chrome's Built-in AI and only
						works in Chrome {MINIMUM_CHROME_VERSION}+.
					</p>
					<div className="flex flex-col gap-3">
						<Label
							htmlFor={rewriterId}
							className="hover:bg-accent/50 flex items-start gap-3 rounded-lg border p-3 has-[[aria-checked=true]]:border-foreground has-[[aria-checked=true]]:bg-accent"
						>
							<Checkbox
								id={rewriterId}
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
									Enable AI Rewriter Feature{" "}
									{isRewriterDownloading && "(Downloading...)"}
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
