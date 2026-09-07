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
      color: "#9aa49d",
      borderTop: "1px solid #dfe6e0",
      marginTop: "auto",
    }}>
      <span>© 2026 MealRoute · </span>
      <a href="/terms" style={{ color: "#6f7d74", textDecoration: "none" }}>Terms</a>
      <span> · </span>
      <a href="/privacy" style={{ color: "#6f7d74", textDecoration: "none" }}>Privacy</a>
    </footer>
  );
}
