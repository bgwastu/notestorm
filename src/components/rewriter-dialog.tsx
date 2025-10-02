import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { rewriteText } from "@/lib/rewriter";
import { RotateCw } from "lucide-react";
import { useEffect, useState } from "react";

interface RewriterDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	originalText: string;
	onInsert: (text: string) => void;
}

export function RewriterDialog({
	isOpen,
	onOpenChange,
	originalText,
	onInsert,
}: RewriterDialogProps) {
	const [rewrittenText, setRewrittenText] = useState<string>("");
	const [isRewriting, setIsRewriting] = useState(false);

	useEffect(() => {
		if (isOpen && originalText) {
			performRewrite();
		}
	}, [isOpen, originalText]);

	const performRewrite = async () => {
		setIsRewriting(true);
		setRewrittenText("");
		try {
			const result = await rewriteText(originalText, {
				tone: "as-is",
				length: "as-is",
				format: "as-is",
			});
			if (result) {
				setRewrittenText(result);
			}
		} catch (error) {
			console.error("Rewrite failed:", error);
		} finally {
			setIsRewriting(false);
		}
	};

	const handleInsert = () => {
		if (rewrittenText) {
			onInsert(rewrittenText);
			onOpenChange(false);
			setRewrittenText("");
		}
	};

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			setRewrittenText("");
		}
		onOpenChange(open);
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Rewrite Text</DialogTitle>
					<DialogDescription>
						Review the rewritten text and insert if you like it
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-3">
					<div className="space-y-1.5">
						<h3 className="text-xs font-medium text-muted-foreground">
							Original
						</h3>
						<div className="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap min-h-[100px] max-h-[180px] overflow-auto">
							{originalText}
						</div>
					</div>
					<div className="space-y-1.5">
						<h3 className="text-xs font-medium text-muted-foreground">
							Rewritten
						</h3>
						<div className="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap min-h-[100px] max-h-[180px] overflow-auto">
							{isRewriting ? (
								<span className="text-muted-foreground italic">
									Rewriting...
								</span>
							) : rewrittenText ? (
								rewrittenText
							) : (
								<span className="text-muted-foreground italic">
									No result yet
								</span>
							)}
						</div>
					</div>
				</div>

				<DialogFooter className="gap-2">
					<Button
						variant="outline"
						onClick={performRewrite}
						disabled={isRewriting}
						className="gap-1.5"
					>
						<RotateCw className={`w-3.5 h-3.5 ${isRewriting ? "animate-spin" : ""}`} />
						Regenerate
					</Button>
					<Button
						onClick={handleInsert}
						disabled={isRewriting || !rewrittenText}
					>
						Insert
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
