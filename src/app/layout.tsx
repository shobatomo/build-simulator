import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "../styles.css";

export const metadata: Metadata = {
    title: "Deadlock Build Simulator",
    description:
        "ヒーロー、レベル、アイテムを選び、属性とアイテム効果を確認できるDeadlockビルドシミュレーター。",
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
