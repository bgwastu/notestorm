import { useOs } from "@mantine/hooks";
import { Key, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface OnboardingModalProps {
	isOpen: boolean;
	onComplete: (useDemoApi: boolean, openSettings: boolean) => void;
}

export function OnboardingModal({ isOpen, onComplete }: OnboardingModalProps) {
	const os = useOs();
	const [selectedOption, setSelectedOption] = useState<"demo" | "local">(
		"demo",
	);

	const isMobile = useMemo(() => {
		return os === "android" || os === "ios";
	}, [os]);

	const modifierKey = useMemo(() => {
		return os === "macos" || os === "ios" ? "⌘" : "Ctrl";
	}, [os]);

	const handleComplete = () => {
		const useDemoApi = selectedOption === "demo";
		const openSettings = selectedOption === "local";
		onComplete(useDemoApi, openSettings);
	};

	return (
		<Dialog open={isOpen} onOpenChange={() => {}}>
			<DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto sm:max-h-[90vh]">
				<DialogHeader className="space-y-1 sm:space-y-2">
					<DialogTitle className="text-xl sm:text-2xl">
						Welcome to Notestorm!
					</DialogTitle>
					<p className="text-xs sm:text-sm text-muted-foreground">
						Notestorm is a scratchpad for quick, dirty draft notes. Perfect for
						temporary brainstorming sessions.
					</p>
				</DialogHeader>
				<div className="flex flex-col gap-3 sm:gap-6 mt-2 sm:mt-4">
					<div className="flex justify-center">
						<video
							src="/demo.mp4"
							autoPlay
							loop
							muted
							playsInline
							className="w-full max-w-sm sm:max-w-lg rounded-lg shadow-sm border"
						/>
					</div>
					<div className="flex flex-col gap-2 sm:gap-3">
						<div className="flex flex-col gap-1.5 sm:gap-2 bg-muted/50 p-3 sm:p-4 rounded-lg">
							<p className="text-xs sm:text-sm font-medium">How to trigger AI:</p>
							{isMobile ? (
								<p className="text-xs sm:text-sm text-muted-foreground">
									AI will automatically suggest text as you write. Tap the
									suggestion to accept it, or press{" "}
									<kbd className="px-1.5 py-0.5 bg-background text-foreground rounded text-xs font-mono border">
										{modifierKey}
									</kbd>{" "}
									+{" "}
									<kbd className="px-1.5 py-0.5 bg-background text-foreground rounded text-xs font-mono border">
										I
									</kbd>{" "}
									if using a keyboard
								</p>
							) : (
								<p className="text-xs sm:text-sm text-muted-foreground">
									Press{" "}
									<kbd className="px-1.5 py-0.5 bg-background text-foreground rounded text-xs font-mono border">
										{modifierKey}
									</kbd>{" "}
									+{" "}
									<kbd className="px-1.5 py-0.5 bg-background text-foreground rounded text-xs font-mono border">
										I
									</kbd>{" "}
									to get AI suggestions as you write
								</p>
							)}
						</div>
					</div>
					<div className="flex flex-col gap-2 sm:gap-3">
						<p className="text-xs sm:text-sm font-medium text-center">
							Choose how to use AI:
						</p>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
							<button
								type="button"
								onClick={() => setSelectedOption("demo")}
								className={`flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 transition-all ${
									selectedOption === "demo"
										? "border-primary bg-primary/5"
										: "border-border hover:border-primary/50"
								}`}
							>
								<div className="flex flex-col items-center gap-1.5 sm:gap-2">
									<Sparkles className="w-4 h-4 text-muted-foreground" />
									<span className="font-medium text-sm sm:text-base">
										Demo API
									</span>
								</div>
								<div className="text-xs text-muted-foreground text-center">
									Try it instantly with our demo API (rate limited)
								</div>
							</button>
							<button
								type="button"
								onClick={() => setSelectedOption("local")}
								className={`flex flex-col gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg border-2 transition-all ${
									selectedOption === "local"
										? "border-primary bg-primary/5"
										: "border-border hover:border-primary/50"
								}`}
							>
								<div className="flex flex-col items-center gap-1.5 sm:gap-2">
									<Key className="w-4 h-4 text-muted-foreground" />
									<span className="font-medium text-sm sm:text-base">
										Local Setup
									</span>
								</div>
								<div className="text-xs text-muted-foreground text-center">
									Use your own API key for unlimited access
								</div>
							</button>
						</div>
					</div>
					<Button onClick={handleComplete} className="w-full" size="lg">
						Get Started
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
