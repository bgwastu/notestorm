import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Notestorm",
			},
			{
				name: "description",
				content: "The writing app that keeps you in flow",
			},
			{
				property: "og:title",
				content: "Notestorm",
			},
			{
				property: "og:description",
				content: "The writing app that keeps you in flow",
			},
			{
				property: "og:title",
				content: "Notestorm",
			},
			{
				property: "og:description",
				content: "The writing app that keeps you in flow",
			},
			{
				property: "og:image",
				content: "/og-image.jpg",
			},
			{
				property: "og:type",
				content: "website",
			},
			{
				name: "twitter:card",
				content: "summary_large_image",
			},
			{
				name: "twitter:title",
				content: "Notestorm",
			},
			{
				name: "twitter:description",
				content: "The writing app that keeps you in flow",
			},
			{
				name: "twitter:description",
				content: "The writing app that keeps you in flow",
			},
			{
				name: "twitter:image",
				content: "/og-image.jpg",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),

	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<Toaster />
				<Scripts />
			</body>
		</html>
	);
}
