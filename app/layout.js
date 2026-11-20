import "./globals.css";

export const metadata = {
  title: "Nortov — shopping every day",
  description: "Things for the home, wardrobe and every day.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
