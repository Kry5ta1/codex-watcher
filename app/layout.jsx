import "./globals.css";

export const metadata = {
  title: "Codex Watcher",
  description: "本地只读的 Codex 额度监控面板。"
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
