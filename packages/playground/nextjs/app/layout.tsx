import type { Metadata } from "next";
import Providers from "./providers";
import "antd/dist/antd.css";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "resea for nextjs",
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
