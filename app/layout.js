import "./globals.css";

export const metadata = {
  title: "Nortov — покупки каждый день",
  description: "Вещи для дома, гардероба и каждого дня.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
