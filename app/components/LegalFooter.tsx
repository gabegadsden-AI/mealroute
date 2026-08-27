// MealRoute Footer with Legal Links
// Add this component to your app, then place <LegalFooter /> 
// right before the closing </main> tag in page.tsx
//
// Or just paste the JSX directly at the bottom of the app-shell.

export default function LegalFooter() {
  return (
    <footer style={{
      textAlign: "center",
      padding: "16px 0 8px",
      fontSize: "11px",
      color: "#566158",
      borderTop: "1px solid #1c2620",
      marginTop: "auto",
    }}>
      <span>© 2026 MealRoute · </span>
      <a href="/terms" style={{ color: "#8e9a91", textDecoration: "none" }}>Terms</a>
      <span> · </span>
      <a href="/privacy" style={{ color: "#8e9a91", textDecoration: "none" }}>Privacy</a>
    </footer>
  );
}
