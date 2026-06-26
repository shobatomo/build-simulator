import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "../styles.css";

export const metadata: Metadata = {
    title: "Deadlock Build Ledger",
    description:
        "An occult companion tool for planning Deadlock builds with a noir, Art Deco atmosphere.",
};

export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="ja">
            <body>{children}</body>
            <Analytics />
        </html>
    );
}
