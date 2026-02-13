export function currencySymbol(code?: string | null): string {
  switch (code) {
    case "USD":
      return "$";
    case "GBP":
      return "£";
    case "EUR":
    default:
      return "€";
  }
}
