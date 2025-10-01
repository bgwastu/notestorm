import { WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

interface AiButtonProps {
	isPopoverOpen: boolean;
	onPopoverOpenChange: (open: boolean) => void;
	onSettingsClick: () => void;
	hotkeyDisplay: {
		modifierKey: string;
		mainKey: string;
	};
	isMobile: boolean;
	autoTriggerDelay: number;
}

export function AiButton({
	isPopoverOpen,
	onPopoverOpenChange,
	onSettingsClick,
	hotkeyDisplay,
	isMobile,
	autoTriggerDelay,
}: AiButtonProps) {
	const hotkeyHint = isMobile ? (
		<div className="text-xs">
			<p className="mb-1">
				Press{" "}
				<kbd className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs font-mono">
					{hotkeyDisplay.modifierKey}
				</kbd>{" "}
				+{" "}
				<kbd className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs font-mono">
					{hotkeyDisplay.mainKey}
				</kbd>{" "}
				to trigger
			</p>
			<p className="text-muted-foreground">
				Auto-suggestions available after {autoTriggerDelay / 1000} seconds of
				inactivity
			</p>
		</div>
	) : (
		<p className="text-xs">
			Press{" "}
			<kbd className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs font-mono">
				{hotkeyDisplay.modifierKey}
			</kbd>{" "}
			+{" "}
			<kbd className="px-1.5 py-0.5 bg-muted text-foreground rounded text-xs font-mono">
				{hotkeyDisplay.mainKey}
			</kbd>{" "}
			to trigger
		</p>
	);

	return (
		<Popover open={isPopoverOpen} onOpenChange={onPopoverOpenChange}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className={`h-12 w-12 rounded-md cursor-pointer transition-colors flex items-center justify-center ${
						isPopoverOpen
							? "bg-accent text-accent-foreground"
							: "hover:bg-accent hover:text-accent-foreground"
					}`}
				>
					<WandSparkles className="w-5 h-5 text-muted-foreground" />
				</button>
			</PopoverTrigger>
			<PopoverContent side="bottom" className="w-72">
				<div>
					<p className="font-semibold mb-1">AI Writing Assistant</p>
					<p className="text-xs text-muted-foreground mb-2">
						Get intelligent suggestions and completions
					</p>
					{hotkeyHint}
					<Button
						onClick={() => {
							onPopoverOpenChange(false);
							onSettingsClick();
						}}
						variant="outline"
						className="mt-3 w-full"
					>
						Settings
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
