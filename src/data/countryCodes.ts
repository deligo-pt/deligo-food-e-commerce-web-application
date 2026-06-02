export type CountryOption = {
  name: string;
  dialCode: string;
  flagCode: string;
};

export const COUNTRY_OPTIONS: CountryOption[] = [
  { name: "Portugal", dialCode: "+351", flagCode: "pt" },
  { name: "India", dialCode: "+91", flagCode: "in" },
  { name: "United Kingdom", dialCode: "+44", flagCode: "gb" },
  { name: "United States", dialCode: "+1", flagCode: "us" },
  { name: "Canada", dialCode: "+1", flagCode: "ca" },
  { name: "Australia", dialCode: "+61", flagCode: "au" },
  { name: "Germany", dialCode: "+49", flagCode: "de" },
  { name: "France", dialCode: "+33", flagCode: "fr" },
  { name: "Spain", dialCode: "+34", flagCode: "es" },
  { name: "Italy", dialCode: "+39", flagCode: "it" },
  { name: "Brazil", dialCode: "+55", flagCode: "br" },
  { name: "Mexico", dialCode: "+52", flagCode: "mx" },
  { name: "South Africa", dialCode: "+27", flagCode: "za" },
  { name: "United Arab Emirates", dialCode: "+971", flagCode: "ae" },
  { name: "Saudi Arabia", dialCode: "+966", flagCode: "sa" },
  { name: "Singapore", dialCode: "+65", flagCode: "sg" },
  { name: "Malaysia", dialCode: "+60", flagCode: "my" },
  { name: "Bangladesh", dialCode: "+880", flagCode: "bd" },
  { name: "Pakistan", dialCode: "+92", flagCode: "pk" },
  { name: "Sri Lanka", dialCode: "+94", flagCode: "lk" },
];