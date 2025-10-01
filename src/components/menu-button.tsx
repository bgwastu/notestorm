import { MoreVertical } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";

interface MenuButtonProps {
	spellcheckEnabled: boolean;
	onSpellcheckToggle: (enabled: boolean) => void;
	aiFeatureEnabled: boolean;
	onAiFeatureToggle: (enabled: boolean) => void;
}

export function MenuButton({
	spellcheckEnabled,
	onSpellcheckToggle,
	aiFeatureEnabled,
	onAiFeatureToggle,
}: MenuButtonProps) {
	const [isAboutOpen, setIsAboutOpen] = useState(false);
	const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
	const [feedback, setFeedback] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const feedbackInputId = useId();

	const handleSubmitFeedback = async () => {
		if (!feedback.trim()) return;

		setIsSubmitting(true);
		try {
			const response = await fetch("/api/feedback", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ feedback: feedback.trim() }),
			});

			if (!response.ok) {
				throw new Error("Failed to send feedback");
			}

			toast.success("Thank you for your feedback!");
			setFeedback("");
			setIsFeedbackOpen(false);
		} catch (error) {
			toast.error("Failed to send feedback. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						className="h-9 w-9 rounded-md cursor-pointer transition-colors flex items-center justify-center hover:bg-accent hover:text-accent-foreground"
					>
						<MoreVertical className="w-4 h-4 text-muted-foreground" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuCheckboxItem
						checked={aiFeatureEnabled}
						onCheckedChange={onAiFeatureToggle}
					>
						AI Feature
					</DropdownMenuCheckboxItem>
					<DropdownMenuCheckboxItem
						checked={spellcheckEnabled}
						onCheckedChange={onSpellcheckToggle}
					>
						Spellcheck
					</DropdownMenuCheckboxItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={() => setIsAboutOpen(true)}>
						About
					</DropdownMenuItem>
					<DropdownMenuItem onClick={() => setIsFeedbackOpen(true)}>
						Feedback
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Notestorm</DialogTitle>
						<DialogDescription>
							The minimalist writing app with AI that keeps you in flow
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<p className="text-sm">
							Notestorm is a scratchpad for temporary brainstorming (and
							sometimes draft notes).
						</p>
						<p className="text-sm">
							I skip words when brainstorming. They're on the tip of my tongue
							but I can't get them out, and I lose my train of thought. I made
							this so I can keep writing.
						</p>
						<p className="text-sm text-muted-foreground">
							Created by{" "}
							<a
								href="https://wastu.net"
								target="_blank"
								rel="noopener noreferrer"
								className="underline hover:text-foreground"
							>
								Bagas Wastu
							</a>
						</p>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog open={isFeedbackOpen} onOpenChange={setIsFeedbackOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Feedback</DialogTitle>
						<DialogDescription>
							I'd love to hear your thoughts - your feedback helps me improve
							this app :)
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<label htmlFor={feedbackInputId} className="text-sm font-medium">
								Your feedback
							</label>
							<Textarea
								id={feedbackInputId}
								value={feedback}
								onChange={(e) => setFeedback(e.target.value)}
								placeholder="Tell us what you think..."
								disabled={isSubmitting}
							/>
						</div>
						<Button
							onClick={handleSubmitFeedback}
							className="w-full"
							disabled={isSubmitting || !feedback.trim()}
						>
							{isSubmitting ? "Sending..." : "Submit Feedback"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
